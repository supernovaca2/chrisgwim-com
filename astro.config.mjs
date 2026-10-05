// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { sameArt } from './src/lib/cover-art.mjs';

// Derived sizes of every cover (see src/lib/images.ts). Written to dist only:
// the SoundCloud sync commits whatever changes under public/covers, so
// generated files must not land there.
const THUMB_PX = 132; // 44 CSS px at 3x
const POSTER_PX = 360; // ~180 CSS px tiles at 2x
const WIDE_RATIO = 2.39; // the letterbox hero
const WIDE_FOCUS = 0.4; // crop window sits 40% down the art

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
        // public/covers/hd holds the original upload. It is used only while it
        // is still the same artwork as the 500px cover (see sameArt).
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

// Overworld (the home page) is written as numbered parts that share one scope;
// see src/game/README.md. This splices them, in order, into overworld.js.
const overworldParts = () => {
  const dir = fileURLToPath(new URL('./src/game/', import.meta.url));
  return {
    name: 'overworld-parts',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].replaceAll('\\', '/').endsWith('/src/game/overworld.js')) return null;
      if (!code.includes('/* @parts */')) this.error('src/game/overworld.js has lost its /* @parts */ marker');
      const files = readdirSync(dir).filter((f) => /^[0-9][0-9]_.+[.]js$/.test(f)).sort();
      for (const f of files) this.addWatchFile(join(dir, f));
      const body = files.map((f) => `// ---- ${f} ----\n${readFileSync(join(dir, f), 'utf8')}`).join('\n');
      // A function, not a string: the parts are full of "$" and replace() would read them as patterns.
      return { code: code.replace('/* @parts */', () => body), map: null };
    },
  };
};

// GitHub Pages cannot send response headers, so the content security policy
// ships as a <meta> element. Astro adds script-src and style-src with a hash
// for every script and style it emits; everything else is listed here.
// Nothing loads from another origin except the SoundCloud player frame.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://w.soundcloud.com",
  "media-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
];

// Serving the apex domain. (Preview-era config used the github.io URL with
// base '/chrisgwim-com' — changed at domain cutover 2026-07-13.)
export default defineConfig({
  site: 'https://chrisgwim.com',
  integrations: [sitemap(), coverImages()],
  security: { csp: { directives: CSP_DIRECTIVES } },
  vite: { plugins: [overworldParts()] },
});
