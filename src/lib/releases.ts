import { getCollection, type CollectionEntry } from 'astro:content';

export type Release = CollectionEntry<'releases'>;

// Lanes are the console buses the catalog is grouped into. Order is display
// order on the home page and in the /music filter. A release's `lane` field
// must match one of these names exactly (the schema enforces it).
export const LANES = [
  { name: 'Classical Fusion', bus: 'A', blurb: 'Symphonic motifs rebuilt at club tempo' },
  { name: 'Techno & Trance', bus: 'B', blurb: 'Melodic techno, trance, story tracks' },
  { name: 'House & EDM', bus: 'C', blurb: 'Progressive, melodic house, synthwave' },
  { name: 'Bass', bus: 'D', blurb: 'Drum & bass, trap, G-funk low end' },
  { name: 'Piano', bus: 'E', blurb: 'Solo piano and baroque crossover' },
  { name: 'Punk & Rock', bus: 'F', blurb: 'Synth punk, electro punk, grunge' },
  { name: 'World & Pop', bus: 'G', blurb: 'Soca, afrobeats, pop' },
] as const;

export type LaneName = (typeof LANES)[number]['name'];

export const laneSlug = (lane: string) =>
  lane.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Newest first; ties broken by title so the order is stable across builds.
export async function getReleases(): Promise<Release[]> {
  const all = await getCollection('releases');
  return all.sort(
    (a, b) =>
      b.data.datePublished.localeCompare(a.data.datePublished) ||
      a.data.title.localeCompare(b.data.title)
  );
}

export const fmtDuration = (ms: number) => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// ISO 8601 duration for schema.org MusicRecording.
export const isoDuration = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `PT${Math.floor(total / 60)}M${total % 60}S`;
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const platformName = (url: string) => {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('music.apple.com')) return 'Apple Music';
  if (url.includes('soundcloud.com')) return 'SoundCloud';
  if (url.includes('deezer.com')) return 'Deezer';
  if (url.includes('youtube.com')) return 'YouTube';
  return 'Stream';
};

// Keep in sync with --accent in src/styles/tokens.css. The SoundCloud embed
// takes a literal hex in its query string and cannot read a custom property.
export const ACCENT_HEX = '9ece6a';

export const playerSrc = (soundcloudId: number) =>
  `https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F${soundcloudId}` +
  `&color=%23${ACCENT_HEX}&auto_play=false&hide_related=true&show_comments=false` +
  '&show_user=true&show_reposts=false&show_teaser=false&visual=false';

export const PLATFORMS = [
  { name: 'Spotify', url: 'https://open.spotify.com/artist/6ig7ktBEad43lWfaIGbVWj' },
  { name: 'Apple Music', url: 'https://music.apple.com/us/artist/chris-gwim/1874278935' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/chrisgwim' },
  { name: 'YouTube', url: 'https://www.youtube.com/channel/UCmEy0B-IqiFATgSFhqSoFFA' },
  { name: 'Deezer', url: 'https://www.deezer.com/us/artist/132090272' },
  { name: 'Amazon Music', url: 'https://music.amazon.com/artists/B0947LL66D' },
  { name: 'Tidal', url: 'https://listen.tidal.com/artist/24720859' },
] as const;
