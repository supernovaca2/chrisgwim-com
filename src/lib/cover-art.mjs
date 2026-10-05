// Questions the build asks of a cover image. Plain .mjs so astro.config.mjs
// (which Vite does not bundle) and the pages can both import it.
import sharp from 'sharp';

const tiny = (path) => sharp(path).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();

/**
 * True when two files show the same artwork. public/covers/hd holds the
 * original upload; a cover replaced by hand (distribution art, a renamed track)
 * can leave a stale hi-res file behind, so it is used only while it still
 * matches the 500px cover.
 */
export async function sameArt(a, b) {
  const [x, y] = await Promise.all([tiny(a), tiny(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff += Math.abs(x[i] - y[i]);
  return diff / x.length < 12;
}

/**
 * The color a cover casts when it is lit: the mean of its brightest, most
 * saturated pixels, as #rrggbb. Overworld tints each beacon's light with it.
 */
export async function castColor(path) {
  const data = await sharp(path).resize(48, 48, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const pixels = [];
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    pixels.push({ r, g, b, score: (max - min) * 0.7 + max * 0.3 });
  }
  pixels.sort((p, q) => q.score - p.score);
  const top = pixels.slice(0, Math.round(pixels.length * 0.15));
  const mean = (k) => Math.round(top.reduce((sum, p) => sum + p[k], 0) / top.length);
  return '#' + [mean('r'), mean('g'), mean('b')].map((v) => v.toString(16).padStart(2, '0')).join('');
}
