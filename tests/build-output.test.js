import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const distRoot = fileURLToPath(new URL('../dist', import.meta.url));
const dist = (file) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));
const releasesDir = fileURLToPath(new URL('../src/content/releases', import.meta.url));

function walk(dir) {
  if (!existsSync(dir)) {
    throw new Error(
      `${dir} not found. Run \`npm run build\` before the tests (or use \`npm test\`, which builds first).`
    );
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Every text asset the browser will actually receive.
const textFiles = () => walk(distRoot).filter((f) => /\.(html|css|js)$/.test(f));
const htmlPages = () => walk(distRoot).filter((f) => f.endsWith('.html'));

// All the CSS the site ships, whether Astro emits an external stylesheet or
// inlines it into the page (it inlines any sheet under ~4KB). Concatenating
// both keeps CSS assertions valid across that threshold.
const shippedStyles = () =>
  textFiles().filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n') +
  readFileSync(dist('index.html'), 'utf8');

const releaseFiles = () => readdirSync(releasesDir).filter((f) => f.endsWith('.json'));
const releases = () =>
  releaseFiles().map((f) => ({ slug: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(`${releasesDir}/${f}`, 'utf8')) }));
const newestFirst = () =>
  releases().sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.title.localeCompare(b.title));

test('the homepage is generated', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html should exist');
});

// Without this file in the published output, GitHub Pages drops the custom
// domain on every deploy and chrisgwim.com stops resolving to the site.
test('CNAME survives the build into dist', () => {
  assert.equal(readFileSync(dist('CNAME'), 'utf8').trim(), 'chrisgwim.com');
});

// --- Premiere (2026-10-04) --------------------------------------------------

// The accent is a literal hex in two places the CSS token cannot reach: the
// SoundCloud embed's color param and this test.
const ACCENT = 'ff3d3d';
test('the current accent reaches the build, including the SoundCloud embed', () => {
  assert.match(shippedStyles(), new RegExp(`#${ACCENT}`, 'i'), `expected --accent #${ACCENT} in shipped CSS`);
  assert.match(readFileSync(dist('index.html'), 'utf8'), new RegExp(`color=%23${ACCENT}`, 'i'),
    'the SoundCloud embed must use the current accent');
});

// Earlier themes bypassed their tokens in several places, including the embed's
// own color param. Any survivor leaves the page visibly half-repainted.
test('no earlier theme survives anywhere in the build', () => {
  const legacy = [/e2a33f/i, /226,\s*163,\s*63/, /9ece6a/i, /158,\s*206,\s*106/, /#111213/i, /#1a1b1d/i, /Barlow Condensed/];
  const offenders = textFiles().filter((f) => {
    const body = readFileSync(f, 'utf8');
    return legacy.some((re) => re.test(body));
  });
  assert.deepEqual(offenders.map((f) => f.replace(distRoot, 'dist')), [], 'amber, green, graphite or Barlow found in the build');
});

test('both faces are self-hosted and reach the build', () => {
  const css = shippedStyles();
  assert.match(css, /Big Shoulders Display Variable/, 'expected the display @font-face');
  assert.match(css, /Instrument Sans Variable/, 'expected the body @font-face');
  assert.ok(walk(distRoot).some((f) => /big-shoulders-display.*\.woff2$/.test(f)), 'display woff2 missing from dist');
  assert.ok(walk(distRoot).some((f) => /instrument-sans.*\.woff2$/.test(f)), 'body woff2 missing from dist');
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'fonts must not load from Google');
});

test('the homepage premieres the newest release with a player', () => {
  const newest = newestFirst()[0];
  const home = readFileSync(dist('index.html'), 'utf8');
  assert.match(home, new RegExp(`api\\.soundcloud\\.com%2Ftracks%2F${newest.soundcloudId}`),
    'homepage must embed the newest release');
  assert.match(home, /Now showing/, 'expected the letterbox premiere');
  assert.match(home, new RegExp(`src="/covers/wide/${newest.slug}\\.jpg"`), 'the premiere uses the letterbox crop');
  assert.match(home, /"@type":"MusicGroup"/, 'expected MusicGroup JSON-LD');
});

test('the classical series lists every composer release and the nav can reach it', () => {
  const home = readFileSync(dist('index.html'), 'utf8');
  const composers = ['Bach', 'Beethoven', 'Mozart', 'Tchaikovsky', 'Vivaldi'];
  const inSeries = releases().filter((r) => composers.some((c) => r.title.startsWith(`${c} `)));
  assert.ok(inSeries.length >= 2, 'expected at least two composer releases');
  assert.match(home, /id="series"/, 'the header links to #series');
  for (const r of inSeries) assert.match(home, new RegExp(`href="/music/${r.slug}/"[^>]*>\\s*<img[^>]*${r.slug}`), `${r.slug} missing from the series`);
});

// The sibling brand sits on every page; the SoundCloud referral on the home page.
test('the Lunthra cross-link is on every page and links out cleanly', () => {
  for (const page of htmlPages()) {
    const html = readFileSync(page, 'utf8');
    assert.match(html, /<a[^>]*href="https:\/\/lunthra\.com"[^>]*rel="noopener"/, `${page.replace(distRoot, 'dist')}: Lunthra link`);
    assert.doesNotMatch(html, /lunthra\.com[^"]*utm_/, 'UTM parameters are not allowed on the Lunthra link');
  }
  assert.match(readFileSync(dist('index.html'), 'utf8'), /invite\.soundcloud\.com/, 'the referral sits on the home page');
});

// --- Catalog integrity (v2, 2026-09-13) -----------------------------------
// SoundCloud is the source of truth for what is public. Every release JSON
// must produce a page, every page must carry its own embedded player, and
// nothing that was pulled from SoundCloud may linger as a stale page.

test('every release in the collection builds a page with its own player', () => {
  const all = releases();
  assert.ok(all.length >= 24, `expected at least 24 releases, found ${all.length}`);
  for (const r of all) {
    const page = dist(`music/${r.slug}/index.html`);
    assert.ok(existsSync(page), `missing page for ${r.slug}`);
    const html = readFileSync(page, 'utf8');
    assert.match(
      html,
      new RegExp(`api\\.soundcloud\\.com%2Ftracks%2F${r.soundcloudId}`),
      `${r.slug}: release page must embed SoundCloud track ${r.soundcloudId}`
    );
    assert.match(html, /"@type":"MusicRecording"/, `${r.slug}: expected MusicRecording JSON-LD`);
    assert.match(html, new RegExp(`src="/covers/wide/${r.slug}\\.jpg"`), `${r.slug}: expected its letterbox`);
    assert.ok(existsSync(dist(r.cover.replace(/^\//, ''))), `${r.slug}: cover ${r.cover} missing from dist`);
  }
});

// Checks the invariant, not a list of slugs: a hardcoded "removed" list failed the
// sync when Julian's Shadow was made public again on 2026-10-02.
test('every release page in dist has a release file (no lingering pages)', () => {
  const known = new Set(releases().map((r) => r.slug));
  const pages = readdirSync(dist('music'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.deepEqual(pages.filter((slug) => !known.has(slug)), [], 'release pages with no release file');
  assert.equal(pages.length, known.size, 'every release file should build a page');
});

test('unknown paths get the site 404, kept out of search and the sitemap', () => {
  const page = readFileSync(dist('404.html'), 'utf8');
  assert.match(page, /<meta name="robots" content="noindex"/);
  assert.doesNotMatch(readFileSync(dist('index.html'), 'utf8'), /noindex/, 'real pages must stay indexable');
  assert.match(page, /href="\/music\/"/, '404 should link to the catalogue');
  assert.doesNotMatch(readFileSync(dist('sitemap-0.xml'), 'utf8'), /404/);
});

test('every release has exactly one SoundCloud id, and ids are unique', () => {
  const ids = releases().map((r) => r.soundcloudId);
  assert.equal(new Set(ids).size, ids.length, 'duplicate soundcloudId across releases');
});

test('the catalogue lists every release and filters by lane', () => {
  const page = readFileSync(dist('music/index.html'), 'utf8');
  const tiles = [...page.matchAll(/<li class="poster"[^>]*data-lane="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(tiles.length, releases().length, 'one poster per release');
  for (const lane of new Set(tiles)) assert.match(page, new RegExp(`data-lane="${lane}" aria-pressed="false"`), `missing ${lane} chip`);
});

test('story page, catalogue page, sitemap and robots are generated', () => {
  assert.ok(existsSync(dist('story/index.html')), 'missing /story/');
  assert.ok(existsSync(dist('music/index.html')), 'missing /music/');
  assert.ok(existsSync(dist('sitemap-index.xml')), 'missing sitemap');
  assert.match(readFileSync(dist('robots.txt'), 'utf8'), /sitemap-index\.xml/);
});

test('no audio file is shipped from this origin', () => {
  const audio = walk(distRoot).filter((f) => /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(f));
  assert.deepEqual(audio, [], 'audio must be streamed from a platform, never self-hosted');
});

// Spotify for Artists verifies a requester by finding their email publicly
// shown next to the artist. A mailto href behind a "CONTACT" label is invisible
// to a reviewer, so the address has to be readable text on every page.
test('the contact email is visible text on every page and in the JSON-LD', () => {
  const email = 'chrisgwim@chrisgwim.com';
  const pages = htmlPages();
  assert.ok(pages.length > 0, 'expected built pages');
  const hidden = pages.filter((f) => {
    const visible = readFileSync(f, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    return !visible.includes(email);
  });
  assert.deepEqual(hidden, [], `email not visible as text in: ${hidden.join(', ')}`);

  const home = readFileSync(dist('index.html'), 'utf8');
  assert.match(home, /"email":"chrisgwim@chrisgwim\.com"/, 'MusicGroup JSON-LD should carry the email');
});

// Grid columns narrow on phones; without these the width/height attributes
// alone squashed the art (2026-10-03, 40x44 covers on every phone).
test('poster covers stay square at any column width', () => {
  const css = shippedStyles();
  assert.match(css, /\.poster-img[^{]*\{[^}]*aspect-ratio:\s*1[^}]*\}/, 'poster-img needs aspect-ratio: 1');
  assert.match(css, /\.poster-img[^{]*\{[^}]*width:\s*100%[^}]*\}/, 'poster-img should fill its column');
});

// Covers are 500x500 (~65 KB). The wall draws them at ~150px, the prev/next
// links at 64px, and the letterbox crops them to 2.39:1 at full width.
test('every cover gets its derived sizes, and the pages use them', async () => {
  const hd = fileURLToPath(new URL('../public/covers/hd', import.meta.url));
  for (const { slug, cover } of releases()) {
    const file = cover.replace(/^\/covers\//, '');
    for (const [size, px, maxBytes] of [['thumbs', 132, 20_000], ['posters', 360, 60_000]]) {
      const path = dist(`covers/${size}/${file}`);
      assert.ok(existsSync(path), `missing ${size} for ${slug}`);
      const { width, height } = await sharp(path).metadata();
      assert.deepEqual([width, height], [px, px], `${slug} ${size} size`);
      assert.ok(readFileSync(path).length < maxBytes, `${slug} ${size} too heavy`);
    }
    const wide = dist(`covers/wide/${file}`);
    assert.ok(existsSync(wide), `missing letterbox crop for ${slug}`);
    const { width, height } = await sharp(wide).metadata();
    assert.ok(Math.abs(width / height - 2.39) < 0.01, `${slug} letterbox ratio ${width}x${height}`);
    if (existsSync(`${hd}/${file}`)) assert.ok(width >= 1000 || width === 500, `${slug} letterbox only ${width}px wide`);
  }
  const wall = [...readFileSync(dist('music/index.html'), 'utf8').matchAll(/<img class="poster-img" src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(wall.length, releases().length, 'one cover per poster');
  assert.deepEqual(wall.filter((src) => !src.startsWith('/covers/posters/')), [], 'the wall must use the 360px posters');
});
