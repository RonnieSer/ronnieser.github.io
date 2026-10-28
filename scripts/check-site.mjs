import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('dist');
const base = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const pages = [];
const hasCv = existsSync('content/cv/cv.pdf');
async function walk(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, item.name);
    if (item.isDirectory()) await walk(path);
    else if (item.name.endsWith('.html')) pages.push(path);
  }
}
await walk(root);
for (const path of pages) {
  const html = await readFile(path, 'utf8');
  assert.ok(!/<script\b[^>]*\bsrc="(?:[a-z]+:)?\/\//i.test(html), `${path}: expected no third-party JavaScript`);
  assert.ok(Buffer.byteLength(html) < 60_000, `${path}: page is unexpectedly large`);
  assert.match(html, /<html lang="en"/, `${path}: missing page language`);
  assert.match(html, /aria-label="Main navigation"/, `${path}: missing navigation`);
  if (hasCv) assert.match(html, /href="[^"]*\/files\/cv\/cv\.pdf"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/, `${path}: CV must open the PDF safely in a new tab`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: expected one main heading`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = match[1].replaceAll('&amp;', '&');
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) continue;
    const url = new URL(raw, `https://example.test${base}/${path.slice(root.length + 1).replace(/index\.html$/, '')}`);
    assert.ok(!base || url.pathname.startsWith(`${base}/`), `${path}: link escapes the deployment base: ${raw}`);
    const target = join(root, decodeURIComponent(url.pathname.slice(base.length)));
    let exists = false;
    for (const candidate of [target, join(target, 'index.html')]) {
      try { if ((await stat(candidate)).isFile()) { exists = true; break; } } catch {}
    }
    assert.ok(exists, `${path}: broken local link ${raw}`);
  }
  for (const image of html.matchAll(/<img\b[^>]*>/g)) {
    assert.match(image[0], /\balt="[^"]+"/, `${path}: image needs descriptive alt text`);
    assert.match(image[0], /\bwidth="\d+"/, `${path}: image needs an intrinsic width`);
    assert.match(image[0], /\bheight="\d+"/, `${path}: image needs an intrinsic height`);
  }
}
assert.ok(pages.length >= 4, 'Expected Home, Research, About, and a 404 page');
console.log(`Verified ${pages.length} static pages: local links, CV ${hasCv ? 'PDF in a new tab' : 'link hidden (no content/cv/cv.pdf)'}, image dimensions, accessibility basics, and no third-party JavaScript.`);
