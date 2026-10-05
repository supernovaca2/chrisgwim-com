// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Derived sizes of every cover (see src/lib/images.ts). Written to dist only:
// the SoundCloud sync commits whatever changes under public/covers, so
// generated files must not land there.
const THUMB_PX = 132; // 44 CSS px at 3x
const POSTER_PX = 360; // ~180 CSS px tiles at 2x
const WIDE_RATIO = 2.39; // the letterbox hero
const WIDE_FOCUS = 0.4; // crop window sits 40% down the art

// public/covers/hd holds the original upload when it is the same artwork as the
// 500px cover. A cover replaced by hand (distribution art, a renamed track) can
// leave a stale hi-res file behind, so it is used only if it still matches.
async function sameArt(a, b) {
  const tiny = (p) => sharp(p).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const [x, y] = await Promise.all([tiny(a), tiny(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff += Math.abs(x[i] - y[i]);
  return diff / x.length < 12;
}

async function wideCrop(src, out) {
  const { width = 0, height = 0 } = await sharp(src).metadata();
  const cropH = Math.round(width / WIDE_RATIO);
  await sharp(src)
    .extract({ left: 0, top: Math.round((height - cropH) * WIDE_FOCUS), width, height: cropH })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(out);
}

const coverImages = () => ({
  name: 'cover-images',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const src = new URL('./public/covers/', import.meta.url);
      const hd = new URL('hd/', src);
      const out = (size) => new URL(`covers/${size}/`, dir);
      await Promise.all(['thumbs', 'posters', 'wide'].map((size) => mkdir(out(size), { recursive: true })));
      const files = (await readdir(src)).filter((f) => f.endsWith('.jpg'));
      const lowRes = [];
      await Promise.all(files.map(async (file) => {
        const cover = fileURLToPath(new URL(file, src));
        const square = (px, size) => sharp(cover)
          .resize(px, px, { fit: 'cover' })
          .jpeg({ quality: 78, mozjpeg: true })
          .toFile(fileURLToPath(new URL(file, out(size))));
        const hiRes = fileURLToPath(new URL(file, hd));
        const useHd = existsSync(hiRes) && (await sameArt(cover, hiRes));
        if (!useHd) lowRes.push(file.replace(/\.jpg$/, ''));
        await Promise.all([
          square(THUMB_PX, 'thumbs'),
          square(POSTER_PX, 'posters'),
          wideCrop(useHd ? hiRes : cover, fileURLToPath(new URL(file, out('wide')))),
        ]);
      }));
      logger.info(`${files.length} covers: thumbs ${THUMB_PX}px, posters ${POSTER_PX}px, letterbox crops`);
      if (lowRes.length) logger.info(`letterbox from 500px art (no matching hi-res): ${lowRes.sort().join(', ')}`);
    },
  },
});

// Serving the apex domain. (Preview-era config used the github.io URL with
// base '/chrisgwim-com' — changed at domain cutover 2026-07-13.)
export default defineConfig({
  site: 'https://chrisgwim.com',
  integrations: [sitemap(), coverImages()],
});
