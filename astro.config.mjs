// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://wasifkarim.com',
  // Static output: nothing needs a server yet. The contact endpoint (FIG. 16)
  // is the first thing that would pull in @astrojs/vercel.
  output: 'static',
  // The CSS is small and nearly all of it is on every page, so it ships inside
  // the HTML instead of as requests that block the first paint.
  build: { inlineStylesheets: 'always' },
  integrations: [sitemap()],
});
