import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { contentFileUrl, imageViewer, localLinks } from '../src/lib/content-files.mjs';

// Link checks must keep working when the owner replaces or removes any research entry.
const fixture = mkdtempSync(resolve('content/link-test-'));
after(() => rmSync(fixture, { recursive: true, force: true }));
for (const name of ['map', 'poster']) {
  mkdirSync(resolve(fixture, 'research', name), { recursive: true });
  writeFileSync(resolve(fixture, 'research', name, 'index.md'), `# ${name}\n`);
}
writeFileSync(resolve(fixture, 'research/map/map.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
writeFileSync(resolve(fixture, 'research/map/full.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const source = resolve(fixture, 'research/map/index.md');
const prefix = relative(resolve('content'), fixture).replaceAll('\\', '/');

test('a file next to an entry works under a GitHub Pages subpath', () => {
  assert.equal(contentFileUrl(source, './map.svg', '/Veronica_Website/'), `/Veronica_Website/files/${prefix}/research/map/map.svg`);
});
test('file links preserve viewer fragments and query parameters', () => {
  assert.equal(contentFileUrl(source, './map.svg?view=full#detail'), `/files/${prefix}/research/map/map.svg?view=full#detail`);
});
test('relative Markdown links point to website pages', () => {
  assert.equal(contentFileUrl(source, '../poster/index.md#overview'), `/${prefix}/research/poster/#overview`);
  assert.equal(contentFileUrl(source, relative(dirname(source), resolve('content/home/index.md'))), '/');
});
test('external URLs and same-page anchors stay unchanged', () => {
  for (const href of ['https://example.org/paper.pdf', 'mailto:veronica@example.org', '#overview']) {
    assert.equal(contentFileUrl(source, href), href);
  }
});
test('missing files and paths outside content fail clearly', () => {
  assert.throws(() => contentFileUrl(source, './missing.pdf'), /Missing local file/);
  assert.throws(() => contentFileUrl(source, relative(dirname(source), resolve('package.json'))), /inside content/);
});
test('Markdown images stay available to Astro image optimization', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [
    { type: 'image', url: './map.svg' }, { type: 'link', url: './map.svg', children: [] },
  ] }] };
  localLinks()(tree, { path: source });
  assert.equal(tree.children[0].children[0].url, './map.svg');
  assert.equal(tree.children[0].children[1].url, `/files/${prefix}/research/map/map.svg`);
});
test('images open enlarged on the page, using the linked full-size image when there is one', async () => {
  const plain = { type: 'image', url: './full.png', alt: 'Full map' };
  const preview = { type: 'image', url: './map.svg', alt: 'Map preview' };
  const toPage = { type: 'link', url: '../poster/index.md', children: [{ type: 'image', url: './full.png', alt: 'Poster' }] };
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [
    plain, { type: 'link', url: './full.png', children: [preview] }, toPage,
  ] }] };
  await imageViewer()(tree, { path: source });
  const [first, second, third] = tree.children[0].children;
  const panel = (node) => node.children[1];
  const stage = (node) => panel(node).children[1];
  const original = (node) => panel(node).children[2].children[1].data.hProperties.href;
  assert.deepEqual(first.children[0].children[0], plain);
  assert.deepEqual(stage(first).children[0], { type: 'image', url: './full.png', alt: 'Full map' });
  assert.equal(stage(first).data.hProperties.style, '--natural: 1px; --ratio: 1');
  assert.equal(original(first), `/files/${prefix}/research/map/full.png`);
  assert.equal(second.children[0].children[0].url, './map.svg', 'the preview stays a Markdown image');
  assert.equal(stage(second).children[0].url, './full.png', 'the linked full-size image opens enlarged');
  assert.equal(panel(second).data.hProperties.id, 'viewer-2');
  assert.equal(third, toPage, 'an image linking to a page stays a link');
});
