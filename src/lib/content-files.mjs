import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { imageMetadata } from 'astro/assets/utils';

export const assetTypes = new Map([
  ['.pdf', 'application/pdf'], ['.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'], ['.gif', 'image/gif'], ['.avif', 'image/avif'],
  ['.csv', 'text/csv'], ['.txt', 'text/plain'], ['.bib', 'text/plain'], ['.zip', 'application/zip'],
  ['.mp4', 'video/mp4'], ['.webm', 'video/webm'],
]);

export function contentFileUrl(filePath, href, base = '/') {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return href;
  const match = href.match(/^([^?#]+)(.*)$/);
  if (!match) return href;
  const root = resolve('content');
  const target = resolve(dirname(filePath), decodeURIComponent(match[1]));
  const path = relative(root, target);
  if (path === '..' || path.startsWith(`..${sep}`) || path.startsWith('.')) {
    throw new Error(`Local link must stay inside content/: ${href}`);
  }
  if (!existsSync(target)) throw new Error(`Missing local file in ${filePath}: ${href}`);
  if (extname(target) === '.md') {
    const route = path.replaceAll(sep, '/').replace(/\/index\.md$/, '').replace(/^home$/, '');
    return `${base.replace(/\/$/, '')}/${route ? `${route}/` : ''}${match[2]}`;
  }
  if (!assetTypes.has(extname(target).toLowerCase())) throw new Error(`Unsupported attachment: ${href}`);
  return `${base.replace(/\/$/, '')}/files/${path.split(sep).map(encodeURIComponent).join('/')}${match[2]}`;
}

const viewable = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif']);

async function viewerSource(filePath, href, base) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return;
  const url = href.replace(/[?#].*$/, '');
  if (!viewable.has(extname(url).toLowerCase())) return;
  const original = contentFileUrl(filePath, href, base);
  try {
    const { width, height } = await imageMetadata(readFileSync(resolve(dirname(filePath), decodeURIComponent(url))), href);
    return { url, original, width, height };
  } catch {}
}

const part = (hName, hProperties, children = []) => ({ type: 'viewerPart', data: { hName, hProperties }, children });
const text = (value) => ({ type: 'text', value });

// Clicking the image opens it enlarged over the page in a popover, with zoom. Both images stay Markdown
// images so Astro optimizes them; the original file is one click away. No browser JavaScript.
function viewer(image, full, id) {
  const label = image.alt || 'Image';
  const zoom = `${id}-zoom`;
  return part('span', { className: ['viewer'] }, [
    part('button', { type: 'button', className: ['viewer-open'], popoverTarget: id }, [image, part('span', { className: ['viewer-hint'], ariaHidden: 'true' })]),
    part('span', { id, popover: '', role: 'dialog', ariaLabel: label, className: ['viewer-panel'] }, [
      part('input', { type: 'checkbox', id: zoom, className: ['viewer-zoom', 'sr-only'], ariaLabel: 'Zoom in' }),
      part('label', { htmlFor: zoom, className: ['viewer-stage'], style: `--natural: ${full.width}px; --ratio: ${+(full.width / full.height).toFixed(4)}` }, [{ type: 'image', url: full.url, alt: label }]),
      part('span', { className: ['viewer-bar'] }, [
        part('label', { htmlFor: zoom, className: ['viewer-action', 'viewer-zoom-label'] }, [part('span', { className: ['viewer-zoom-in'] }, [text('Zoom in')]), part('span', { className: ['viewer-zoom-out'] }, [text('Zoom out')])]),
        part('a', { href: full.original, target: '_blank', rel: ['noopener', 'noreferrer'], className: ['viewer-action'] }, [text('Open original')]),
        part('button', { type: 'button', popoverTarget: id, popoverTargetAction: 'hide', className: ['viewer-action'] }, [text('Close')]),
      ]),
    ]),
  ]);
}

export function imageViewer({ base = '/' } = {}) {
  return async (tree, file) => {
    let count = 0;
    const visit = async (node) => {
      for (const [index, child] of (node.children || []).entries()) {
        const linked = child.type === 'link' && child.children?.length === 1 && child.children[0].type === 'image';
        const image = child.type === 'image' ? child : linked ? child.children[0] : undefined;
        const full = image && await viewerSource(file.path, child.url, base);
        if (full) node.children[index] = viewer(image, full, `viewer-${++count}`);
        else if (child.type !== 'link') await visit(child);
      }
    };
    await visit(tree);
  };
}

export function localLinks({ base = '/' } = {}) {
  return (tree, file) => {
    const walk = (node) => {
      if (node.type === 'link') node.url = contentFileUrl(file.path, node.url, base);
      if (node.children) node.children.forEach(walk);
    };
    walk(tree);
  };
}
