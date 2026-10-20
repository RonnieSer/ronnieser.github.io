import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { contentFileUrl, localLinks } from '../src/lib/content-files.mjs';

// Link checks must keep working when the owner replaces or removes any research entry.
const fixture = mkdtempSync(resolve('content/link-test-'));
after(() => rmSync(fixture, { recursive: true, force: true }));
for (const name of ['map', 'poster']) {
  mkdirSync(resolve(fixture, 'research', name), { recursive: true });
  writeFileSync(resolve(fixture, 'research', name, 'index.md'), `# ${name}\n`);
}
writeFileSync(resolve(fixture, 'research/map/map.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
const source = resolve(fixture, 'research/map/index.md');
const prefix = relative(resolve('content'), fixture).replaceAll('\\', '/');

test('a file next to an entry works under a GitHub Pages subpath', () => {
  assert.equal(contentFileUrl(source, './map.svg', '/Veronica_Website/'), `/Veronica_Website/content/${prefix}/research/map/map.svg`);
});
test('file links preserve viewer fragments and query parameters', () => {
  assert.equal(contentFileUrl(source, './map.svg?view=full#detail'), `/content/${prefix}/research/map/map.svg?view=full#detail`);
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
  assert.equal(tree.children[0].children[1].url, `/content/${prefix}/research/map/map.svg`);
});
