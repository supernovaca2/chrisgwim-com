// @ts-check
import { defineConfig } from 'astro/config';

// Preview deploy: GitHub Pages project site.
// At domain cutover (chrisgwim.com): change site to 'https://chrisgwim.com' and remove base.
export default defineConfig({
  site: 'https://supernovaca2.github.io',
  base: '/chrisgwim-com',
});
