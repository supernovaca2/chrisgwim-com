// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Serving the apex domain. (Preview-era config used the github.io URL with
// base '/chrisgwim-com' — changed at domain cutover 2026-07-13.)
export default defineConfig({
  site: 'https://chrisgwim.com',
  integrations: [sitemap()],
});
