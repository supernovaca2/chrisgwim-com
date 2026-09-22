// Mirrors soundcloud.com/chrisgwim into src/content/releases + public/covers.
// SoundCloud is the source of truth for what is public: new tracks are added,
// tracks gone from SoundCloud are removed, and the permalink and duration are
// refreshed on existing releases. Everything else on an existing release was
// edited by hand and is never overwritten: title and description copy, lane,
// genre, tags, series, cover art (several use the distribution artwork rather
// than SoundCloud's), and a primaryUrl that points at a streaming store.
//
// Usage: node scripts/sync-soundcloud.mjs [--dry-run]
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PROFILE_URL = 'https://soundcloud.com/chrisgwim/tracks';
const RELEASES_DIR = 'src/content/releases';
const COVERS_DIR = 'public/covers';
const DRY_RUN = process.argv.includes('--dry-run');
const UA = { 'user-agent': 'Mozilla/5.0 (chrisgwim.com catalog sync)' };

// First match wins. Only used to pick a lane for a NEW release; existing
// releases keep whatever lane was chosen by hand.
const LANE_RULES = [
  ['Classical Fusion', /classical|orchestra|symphon|bach|mozart|beethoven|vivaldi|tchaikovsky|chopin/],
  ['Piano', /piano/],
  ['Punk & Rock', /punk|rock|metal|grunge/],
  ['Bass', /drum & bass|dnb|trap|dubstep|g-funk|\bbass\b/],
  ['World & Pop', /soca|afro|world|reggae|latin|\bpop\b/],
  ['Techno & Trance', /techno|trance/],
  ['House & EDM', /house|edm|synthwave|dance/],
];
const DEFAULT_LANE = 'House & EDM';

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// The public web client's id is embedded in the profile page's hydration data
// and rotates occasionally, so it is scraped fresh on every run.
async function getClientAndUser() {
  const html = await fetchText(PROFILE_URL);
  const clientId = html.match(/"apiClient","data":\{"id":"([A-Za-z0-9]+)"/)?.[1];
  const userId = html.match(/"id":(\d+),"kind":"user"/)?.[1];
  if (!clientId || !userId) throw new Error('could not read client_id / user id from the profile page');
  return { clientId, userId };
}

async function fetchTracks({ clientId, userId }) {
  const tracks = [];
  let url = `https://api-v2.soundcloud.com/users/${userId}/tracks?limit=100&linked_partitioning=1`;
  while (url) {
    const page = JSON.parse(await fetchText(`${url}&client_id=${clientId}`));
    tracks.push(...page.collection);
    // next_href is returned even on the last page; stop when a page comes back short.
    url = page.collection.length === 100 ? page.next_href : null;
  }
  return tracks.filter((t) => t.sharing === 'public' && t.kind === 'track');
}

// "Drum & Bass" "Melodic House" EDM -> ['drum & bass', 'melodic house', 'edm']
const parseTags = (tagList = '') =>
  [...tagList.matchAll(/"([^"]+)"|(\S+)/g)].map((m) => (m[1] ?? m[2]).trim().toLowerCase()).filter(Boolean);

function pickLane(track) {
  const haystack = [track.genre, track.tag_list, track.title].join(' ').toLowerCase();
  return LANE_RULES.find(([, re]) => re.test(haystack))?.[0] ?? DEFAULT_LANE;
}

const cleanDescription = (text) => (text ?? '').replace(/\s+/g, ' ').trim() || undefined;

// Only fetched when the release has no cover file yet.
async function downloadCover(track, slug) {
  const path = join(COVERS_DIR, `${slug}.jpg`);
  if (existsSync(path)) return false;
  const src = track.artwork_url ?? track.user?.avatar_url;
  if (!src) throw new Error(`no artwork on SoundCloud for ${slug}`);
  const res = await fetch(src.replace('-large.', '-t500x500.'), { headers: UA });
  if (!res.ok) throw new Error(`cover ${res.status} for ${slug}`);
  if (!DRY_RUN) await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function loadReleases() {
  const files = (await readdir(RELEASES_DIR)).filter((f) => f.endsWith('.json'));
  return Promise.all(
    files.map(async (file) => ({
      slug: file.replace(/\.json$/, ''),
      data: JSON.parse(await readFile(join(RELEASES_DIR, file), 'utf8')),
    }))
  );
}

async function saveRelease(slug, data) {
  if (!DRY_RUN) await writeFile(join(RELEASES_DIR, `${slug}.json`), JSON.stringify(data, null, 2) + '\n');
}

const log = [];
const tracks = await fetchTracks(await getClientAndUser());
if (tracks.length === 0) throw new Error('SoundCloud returned no public tracks; refusing to wipe the catalog');
const releases = await loadReleases();
const byId = new Map(releases.map((r) => [r.data.soundcloudId, r]));
const liveIds = new Set(tracks.map((t) => t.id));

for (const track of tracks) {
  const existing = byId.get(track.id);
  if (!existing) {
    const description = cleanDescription(track.description);
    const slug = track.permalink;
    const data = {
      title: track.title.trim(),
      datePublished: (track.display_date ?? track.created_at).slice(0, 10),
      cover: `/covers/${slug}.jpg`,
      primaryUrl: track.permalink_url,
      soundcloudId: track.id,
      soundcloudUrl: track.permalink_url,
      genre: track.genre || 'Electronic',
      lane: pickLane(track),
      durationMs: track.duration,
      ...(description && { description }),
      tags: parseTags(track.tag_list).slice(0, 5),
    };
    await downloadCover(track, slug);
    await saveRelease(slug, data);
    log.push(`+ ${slug} (${data.lane})`);
    continue;
  }

  const { slug, data } = existing;
  const before = JSON.stringify(data);
  const oldSoundcloudUrl = data.soundcloudUrl;
  data.soundcloudUrl = track.permalink_url;
  data.durationMs = track.duration;
  // A primaryUrl that is just the SoundCloud track follows a permalink rename;
  // a Spotify/Deezer/Apple link was set by hand and stays.
  if (data.primaryUrl === oldSoundcloudUrl) data.primaryUrl = track.permalink_url;
  const coverChanged = await downloadCover(track, slug);
  if (JSON.stringify(data) !== before) await saveRelease(slug, data);
  if (JSON.stringify(data) !== before || coverChanged) log.push(`~ ${slug}${coverChanged ? ' (cover)' : ''}`);
}

for (const { slug, data } of releases) {
  if (liveIds.has(data.soundcloudId)) continue;
  if (!DRY_RUN) {
    await unlink(join(RELEASES_DIR, `${slug}.json`));
    const cover = join('public', data.cover.replace(/^\//, ''));
    if (existsSync(cover)) await unlink(cover);
  }
  log.push(`- ${slug}`);
}

console.log(`SoundCloud: ${tracks.length} public tracks. Site before sync: ${releases.length}.`);
console.log(log.length ? log.join('\n') : 'No changes.');
