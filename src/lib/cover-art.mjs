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
