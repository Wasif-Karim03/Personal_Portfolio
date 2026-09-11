// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://wasifkarim.com',
  // Static output: nothing needs a server yet. The contact endpoint (FIG. 16)
  // is the first thing that would pull in @astrojs/vercel.
  output: 'static',
  integrations: [sitemap()],
});
