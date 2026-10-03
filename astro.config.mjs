// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Small copies of every cover for the track list and lane cards (see
// src/lib/thumbs.ts). Written to dist only: the SoundCloud sync commits
// whatever changes under public/covers, so generated files must not land there.
const THUMB_PX = 132; // 44 CSS px at 3x
const coverThumbs = () => ({
  name: 'cover-thumbs',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const src = new URL('./public/covers/', import.meta.url);
      const out = new URL('covers/thumbs/', dir);
      await mkdir(out, { recursive: true });
      const files = (await readdir(src)).filter((f) => f.endsWith('.jpg'));
      await Promise.all(files.map((file) =>
        sharp(fileURLToPath(new URL(file, src)))
          .resize(THUMB_PX, THUMB_PX, { fit: 'cover' })
          .jpeg({ quality: 78, mozjpeg: true })
          .toFile(fileURLToPath(new URL(file, out)))
      ));
      logger.info(`${files.length} cover thumbnails at ${THUMB_PX}px`);
    },
  },
});

// Serving the apex domain. (Preview-era config used the github.io URL with
// base '/chrisgwim-com' — changed at domain cutover 2026-07-13.)
export default defineConfig({
  site: 'https://chrisgwim.com',
  integrations: [sitemap(), coverThumbs()],
});
