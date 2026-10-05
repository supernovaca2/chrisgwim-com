// Derived cover sizes, written to dist/covers/<size>/ by the cover-images
// integration in astro.config.mjs. The source art in public/covers is 500x500
// (~65 KB); the pages draw it from 28px thumbnails up to a full-width letterbox.
// Dev has no derived files, so it serves the source art.
const file = (cover: string) => cover.replace(/^\/?covers\//, '');

/** 132px square, for 28-44px slots. */
export function coverThumb(cover: string, base: string): string {
  return import.meta.env.DEV ? `${base}covers/${file(cover)}` : `${base}covers/thumbs/${file(cover)}`;
}

/** 360px square, for poster tiles up to ~180 CSS px. */
export function coverPoster(cover: string, base: string): string {
  return import.meta.env.DEV ? `${base}covers/${file(cover)}` : `${base}covers/posters/${file(cover)}`;
}

/** 2.39:1 crop for the letterbox hero, from the hi-res art when it matches the cover. */
export function coverWide(cover: string, base: string): string {
  return import.meta.env.DEV ? `${base}covers/${file(cover)}` : `${base}covers/wide/${file(cover)}`;
}
