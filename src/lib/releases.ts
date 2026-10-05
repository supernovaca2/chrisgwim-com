import { getCollection, type CollectionEntry } from 'astro:content';

export type Release = CollectionEntry<'releases'>;

// Lanes are the genre groups the catalog is filed under. Order is display
// order in the /music filter and the order of Overworld's districts, clockwise
// from north. A release's `lane` field must match one of these names exactly
// (the schema enforces it). `color` is the lane's light in Overworld: its
// beacons, road studs and district landmark.
export const LANES = [
  { name: 'Classical Fusion', bus: 'A', blurb: 'Symphonic motifs rebuilt at club tempo', color: '#ffb347' },
  { name: 'Techno & Trance', bus: 'B', blurb: 'Melodic techno, trance, story tracks', color: '#5a7dff' },
  { name: 'House & EDM', bus: 'C', blurb: 'Progressive, melodic house, synthwave', color: '#2ee6c5' },
  { name: 'Bass', bus: 'D', blurb: 'Drum & bass, trap, G-funk low end', color: '#a35cff' },
  { name: 'Piano', bus: 'E', blurb: 'Solo piano and baroque crossover', color: '#dfe6ff' },
  { name: 'Punk & Rock', bus: 'F', blurb: 'Synth punk, electro punk, grunge', color: '#ff4d5e' },
  { name: 'World & Pop', bus: 'G', blurb: 'Soca, afrobeats, pop', color: '#ff7ad9' },
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
export const ACCENT_HEX = 'ff3d3d';

// The classical series: club records built on a composer's work. A release
// joins when its title starts with one of these names ("Bach Divine"), so a new
// composer track needs only its name here, not a schema field the sync can't set.
const COMPOSERS = [
  'Bach', 'Beethoven', 'Brahms', 'Chopin', 'Debussy', 'Dvorak', 'Grieg', 'Handel', 'Haydn',
  'Liszt', 'Mahler', 'Mozart', 'Pachelbel', 'Paganini', 'Rachmaninoff', 'Satie', 'Schubert',
  'Strauss', 'Tchaikovsky', 'Verdi', 'Vivaldi', 'Wagner',
];

export function classicalSeries(releases: Release[]) {
  return releases.flatMap((release) => {
    const composer = COMPOSERS.find((name) => release.data.title.startsWith(`${name} `));
    return composer ? [{ release, composer, work: release.data.title.slice(composer.length + 1) }] : [];
  });
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const inWords = (n: number) => NUMBER_WORDS[n] ?? String(n);

// American order, built by hand so the output never depends on the ICU data of
// whichever machine runs the build: "October 5, 2026" and "Oct 5".
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const dateLong = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
export const dateShort = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}`;

// Visual mode puts the art behind the controls; the white classic widget glared on black.
export const playerSrc = (soundcloudId: number) =>
  `https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F${soundcloudId}` +
  `&color=%23${ACCENT_HEX}&auto_play=false&hide_related=true&show_comments=false` +
  '&show_user=true&show_reposts=false&show_teaser=false&visual=true';

export const PLATFORMS = [
  { name: 'Spotify', url: 'https://open.spotify.com/artist/6ig7ktBEad43lWfaIGbVWj' },
  { name: 'Apple Music', url: 'https://music.apple.com/us/artist/chris-gwim/1874278935' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/chrisgwim' },
  { name: 'YouTube', url: 'https://www.youtube.com/channel/UCmEy0B-IqiFATgSFhqSoFFA' },
  { name: 'Deezer', url: 'https://www.deezer.com/us/artist/132090272' },
  { name: 'Amazon Music', url: 'https://music.amazon.com/artists/B0947LL66D' },
  { name: 'Tidal', url: 'https://listen.tidal.com/artist/24720859' },
] as const;
