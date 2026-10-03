// The track list and lane cards draw covers at 28-44 CSS px, but the source art
// is 500x500 (~65 KB each). The build writes 132 px copies to dist/covers/thumbs/
// (the cover-thumbs integration in astro.config.mjs). Dev has no thumbs, so it
// serves the original.
export function coverThumb(cover: string, base: string): string {
  const file = cover.replace(/^\/?covers\//, '');
  return import.meta.env.DEV ? `${base}covers/${file}` : `${base}covers/thumbs/${file}`;
}
