import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { imageViewer, localLinks } from './src/lib/content-files.mjs';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://ronnieser.github.io',
  base,
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  prefetch: false,
  markdown: { processor: unified({ remarkPlugins: [[imageViewer, { base }], [localLinks, { base }]] }) },
  devToolbar: { enabled: false },
});
