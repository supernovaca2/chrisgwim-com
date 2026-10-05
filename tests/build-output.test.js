import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
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
const rel = (f) => f.replace(distRoot, 'dist');

// Every text asset the browser will actually receive.
const textFiles = () => walk(distRoot).filter((f) => /\.(html|css|js)$/.test(f));
const htmlPages = () => walk(distRoot).filter((f) => f.endsWith('.html'));

// All the CSS the site ships, whether Astro emits an external stylesheet or
// inlines it into a page (it inlines any sheet under ~4KB). Every page is read,
// not just the home page: the home page is Overworld and shares no styles with
// the others.
const shippedStyles = () =>
  textFiles().filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n') +
  htmlPages().map((f) => readFileSync(f, 'utf8')).join('\n');

const releaseFiles = () => readdirSync(releasesDir).filter((f) => f.endsWith('.json'));
const releases = () =>
  releaseFiles().map((f) => ({ slug: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(`${releasesDir}/${f}`, 'utf8')) }));
const newestFirst = () =>
  releases().sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.title.localeCompare(b.title));

const home = () => readFileSync(dist('index.html'), 'utf8');
// The catalog as Overworld receives it: one JSON block inlined in the home page.
const gameData = () => {
  const block = home().match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'the home page should inline the catalog for the game');
  return JSON.parse(block[1]);
};

test('the homepage is generated', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html should exist');
});

// Without this file in the published output, GitHub Pages drops the custom
// domain on every deploy and chrisgwim.com stops resolving to the site.
test('CNAME survives the build into dist', () => {
  assert.equal(readFileSync(dist('CNAME'), 'utf8').trim(), 'chrisgwim.com');
});

// --- Premiere (2026-10-04) --------------------------------------------------

// The accent is a literal hex in three places the CSS token cannot reach: the
// SoundCloud embeds on the release pages, the player Overworld docks, and this test.
const ACCENT = 'ff3d3d';
test('the current accent reaches the build, including both SoundCloud players', () => {
  assert.match(shippedStyles(), new RegExp(`#${ACCENT}`, 'i'), `expected --accent #${ACCENT} in shipped CSS`);
  const newest = newestFirst()[0];
  assert.match(readFileSync(dist(`music/${newest.slug}/index.html`), 'utf8'), new RegExp(`color=%23${ACCENT}`, 'i'),
    'the SoundCloud embed on a release page must use the current accent');
  assert.equal(gameData().accent, ACCENT, 'Overworld builds its docked player with the same accent');
});

// Earlier themes bypassed their tokens in several places, including the embed's
// own color param. Any survivor leaves the page visibly half-repainted.
test('no earlier theme survives anywhere in the build', () => {
  const legacy = [/e2a33f/i, /226,\s*163,\s*63/, /9ece6a/i, /158,\s*206,\s*106/, /#111213/i, /#1a1b1d/i, /Barlow Condensed/];
  const offenders = textFiles().filter((f) => {
    const body = readFileSync(f, 'utf8');
    return legacy.some((re) => re.test(body));
  });
  assert.deepEqual(offenders.map(rel), [], 'amber, green, graphite or Barlow found in the build');
});

test('every face is self-hosted and reaches the build', () => {
  const css = shippedStyles();
  assert.match(css, /Big Shoulders Display Variable/, 'expected the display @font-face');
  assert.match(css, /Instrument Sans Variable/, 'expected the body @font-face');
  assert.match(css, /Geist Mono Variable/, "expected Overworld's HUD @font-face");
  assert.ok(walk(distRoot).some((f) => /big-shoulders-display.*\.woff2$/.test(f)), 'display woff2 missing from dist');
  assert.ok(walk(distRoot).some((f) => /instrument-sans.*\.woff2$/.test(f)), 'body woff2 missing from dist');
  assert.ok(walk(distRoot).some((f) => /geist-mono.*\.woff2$/.test(f)), 'mono woff2 missing from dist');
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'fonts must not load from Google');
});

test('the classical series lists every composer release and the nav can reach it', () => {
  const page = readFileSync(dist('music/index.html'), 'utf8');
  const composers = ['Bach', 'Beethoven', 'Mozart', 'Tchaikovsky', 'Vivaldi'];
  const inSeries = releases().filter((r) => composers.some((c) => r.title.startsWith(`${c} `)));
  assert.ok(inSeries.length >= 2, 'expected at least two composer releases');
  assert.match(page, /id="series"/, 'the series sits on the catalog page');
  assert.match(page, /href="\/music\/#series"/, 'the header links to it');
  for (const r of inSeries) assert.match(page, new RegExp(`href="/music/${r.slug}/"[^>]*>\\s*<img[^>]*${r.slug}`), `${r.slug} missing from the series`);
});

// The sibling brand sits on every page; the SoundCloud referral on the home page.
test('the Lunthra cross-link is on every page and links out cleanly', () => {
  for (const page of htmlPages()) {
    const html = readFileSync(page, 'utf8');
    assert.match(html, /<a[^>]*href="https:\/\/lunthra\.com"[^>]*rel="noopener"/, `${rel(page)}: Lunthra link`);
    assert.doesNotMatch(html, /lunthra\.com[^"]*utm_/, 'UTM parameters are not allowed on the Lunthra link');
  }
  assert.match(home(), /invite\.soundcloud\.com/, 'the referral sits on the home page');
});

// --- Overworld, the home page (2026-10-05) ----------------------------------
// The home page is a game. What must stay true of it is that it is still a
// page: the whole catalog is in its markup as plain links, and the game is
// handed exactly the catalog the rest of the site is built from.

test('the home page is Overworld, and still carries the whole catalog as plain links', () => {
  const html = home();
  assert.match(html, /<canvas id="scene"/, 'expected the game canvas');
  assert.match(html, /<h1[^>]*>Chris Gwim<\/h1>/, 'the artist name is the page heading, in the markup');
  assert.match(html, /"@type":"MusicGroup"/, 'expected MusicGroup JSON-LD');
  assert.match(html, /<noscript>/, 'visitors without JavaScript are told where the catalog is');
  for (const r of releases()) {
    assert.match(html, new RegExp(`<a class="tl-row" href="/music/${r.slug}/"`), `${r.slug} is not linked from the home page`);
  }
  assert.match(html, /href="\/music\/"/, 'the way to the catalog does not depend on the game');
  assert.match(html, /href="\/story\/"/, 'nor does the way to the story');
});

test('Overworld is handed the same catalog the pages are built from', () => {
  const data = gameData();
  const expected = newestFirst();
  assert.deepEqual(data.releases.map((r) => r.slug), expected.map((r) => r.slug), 'every release, newest first');
  for (const [i, r] of data.releases.entries()) {
    const source = expected[i];
    assert.equal(r.scId, source.soundcloudId, `${r.slug}: the docked player needs its SoundCloud id`);
    assert.equal(r.page, `/music/${r.slug}/`, `${r.slug}: release page link`);
    assert.match(r.tint, /^#[0-9a-f]{6}$/, `${r.slug}: beacon tint`);
    assert.match(r.card, /^\/covers\/posters\//, `${r.slug}: monoliths use the 360px posters`);
    assert.ok(existsSync(dist(r.card.replace(/^\//, ''))), `${r.slug}: ${r.card} missing from dist`);
    assert.ok(existsSync(dist(r.large.replace(/^\//, ''))), `${r.slug}: ${r.large} missing from dist`);
  }
  const used = new Set(data.releases.map((r) => r.lane));
  for (const lane of data.lanes.filter((l) => used.has(l.name))) {
    assert.match(lane.color, /^#[0-9a-f]{6}$/i, `${lane.name} needs a color: it lights a whole district`);
  }
  assert.deepEqual([...used].filter((name) => !data.lanes.some((l) => l.name === name)), [], 'a release sits in a lane the game does not know');
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
  assert.doesNotMatch(home(), /noindex/, 'real pages must stay indexable');
  assert.match(page, /href="\/music\/"/, '404 should link to the catalog');
  assert.doesNotMatch(readFileSync(dist('sitemap-0.xml'), 'utf8'), /404/);
});

test('every release has exactly one SoundCloud id, and ids are unique', () => {
  const ids = releases().map((r) => r.soundcloudId);
  assert.equal(new Set(ids).size, ids.length, 'duplicate soundcloudId across releases');
});

test('the catalog page lists every release and filters by lane', () => {
  const page = readFileSync(dist('music/index.html'), 'utf8');
  const tiles = [...page.matchAll(/<li class="poster"[^>]*data-lane="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(tiles.length, releases().length, 'one poster per release');
  for (const lane of new Set(tiles)) assert.match(page, new RegExp(`data-lane="${lane}" aria-pressed="false"`), `missing ${lane} chip`);
});

test('story page, catalog page, sitemap and robots are generated', () => {
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

  assert.match(home(), /"email":"chrisgwim@chrisgwim\.com"/, 'MusicGroup JSON-LD should carry the email');
  // On the home page the address must be on the title screen itself, in view before anyone presses Start.
  assert.match(home().match(/<section class="title"[\s\S]*?<\/section>/)[0], new RegExp(email), 'the title screen shows the address');
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

// --- Security (2026-10-05) ---------------------------------------------------
// GitHub Pages cannot send response headers, so the policy is a <meta> element
// on every page (astro.config.mjs). These tests hold the two halves together:
// the policy stays strict, and no page needs something the policy refuses.

const cspOf = (html) => {
  const meta = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i);
  return meta ? meta[1] : null;
};
const directive = (csp, name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '').slice(name.length + 1);

test('every page ships a content security policy that admits no origin but the SoundCloud player', () => {
  for (const page of htmlPages()) {
    const csp = cspOf(readFileSync(page, 'utf8'));
    assert.ok(csp, `${rel(page)}: no content security policy`);
    assert.equal(directive(csp, 'default-src'), "'self'", `${rel(page)}: default-src`);
    assert.equal(directive(csp, 'frame-src'), 'https://w.soundcloud.com', `${rel(page)}: only SoundCloud may be framed`);
    assert.equal(directive(csp, 'object-src'), "'none'", `${rel(page)}: object-src`);
    assert.equal(directive(csp, 'base-uri'), "'self'", `${rel(page)}: base-uri`);
    assert.equal(directive(csp, 'form-action'), "'none'", `${rel(page)}: form-action`);
    assert.equal(directive(csp, 'connect-src'), "'self'", `${rel(page)}: connect-src`);
    for (const name of ['script-src', 'style-src']) {
      const value = directive(csp, name);
      assert.match(value, /'self'/, `${rel(page)}: ${name} should allow this origin`);
      assert.doesNotMatch(value, /unsafe-inline|unsafe-eval|https?:|\*/, `${rel(page)}: ${name} must not allow inline code, eval or another origin`);
    }
  }
});

test('no page needs anything the policy refuses', () => {
  for (const page of htmlPages()) {
    const html = readFileSync(page, 'utf8');
    const markup = html.replace(/<script[\s\S]*?<\/script>/g, '<script></script>');
    const name = rel(page);
    assert.doesNotMatch(markup, /<[^>]+\sstyle="/, `${name}: inline style attribute (set styles from script or a stylesheet)`);
    assert.doesNotMatch(markup, /<[^>]+\son[a-z]+="/, `${name}: inline event handler`);
    assert.doesNotMatch(markup, /(?:href|src)="\s*javascript:/i, `${name}: javascript: URL`);
    for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) assert.match(src, /^\/(?!\/)/, `${name}: script from another origin: ${src}`);
    for (const [, href] of html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) assert.match(href, /^\/(?!\/)/, `${name}: stylesheet from another origin: ${href}`);
    for (const [, src] of html.matchAll(/<iframe[^>]*\ssrc="([^"]+)"/g)) assert.match(src, /^https:\/\/w\.soundcloud\.com\//, `${name}: frame from an unexpected origin: ${src}`);
    for (const [tag] of markup.matchAll(/<a[^>]*target="_blank"[^>]*>/g)) assert.match(tag, /rel="[^"]*noopener/, `${name}: new-tab link without rel=noopener: ${tag}`);
  }
});

test('nothing is loaded from a CDN: three.js and the fonts are part of the build', () => {
  const hosts = /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|esm\.sh|fonts\.googleapis\.com|fonts\.gstatic\.com/;
  const offenders = textFiles().filter((f) => hosts.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map(rel), [], 'a third-party host is referenced in the build');
  const js = walk(dist('_astro')).filter((f) => f.endsWith('.js'));
  assert.ok(js.some((f) => /WebGLRenderer/.test(readFileSync(f, 'utf8'))), 'three.js should be bundled into the site');
});

// Titles and descriptions arrive from SoundCloud on a timer with nobody
// reviewing them. Inside a data block a "</script>" would end the block early.
test('catalog text cannot break out of a data block, and release links are https', () => {
  for (const page of htmlPages()) {
    for (const [, body] of readFileSync(page, 'utf8').matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.doesNotMatch(body, /</, `${rel(page)}: a data block contains a raw "<"`);
      assert.doesNotThrow(() => JSON.parse(body), `${rel(page)}: a data block is not valid JSON`);
    }
  }
  for (const r of releases()) {
    for (const url of [r.primaryUrl, r.soundcloudUrl]) assert.match(url, /^https:\/\//, `${r.slug}: ${url} is not an https link`);
  }
});

test('the production build carries no debug handle', () => {
  const offenders = walk(dist('_astro')).filter((f) => f.endsWith('.js') && /__ow\b/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map(rel), [], 'window.__ow is for development builds only');
});

// --- GitHub Pages limits (2026-10-05) ------------------------------------------
// Published site: 1 GB. Source repository: 1 GB recommended. Bandwidth: 100 GB a
// month, soft. https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
// The catalog grows by itself (the SoundCloud sync adds art), so the budgets are
// set far below the limits: these fail long before GitHub would.
const MB = 1024 * 1024;
const sizeOf = (files) => files.reduce((sum, f) => sum + statSync(f).size, 0);

test('the published site stays far inside the 1 GB GitHub Pages limit', () => {
  const files = walk(distRoot);
  const total = sizeOf(files);
  assert.ok(total < 250 * MB, `dist is ${(total / MB).toFixed(1)} MB; the budget is 250 MB, a quarter of the limit`);
  const [largest] = files.map((f) => [statSync(f).size, f]).sort((a, b) => b[0] - a[0]);
  assert.ok(largest[0] < 5 * MB, `${rel(largest[1])} is ${(largest[0] / MB).toFixed(1)} MB; no single file should pass 5 MB`);
});

test('what the repository keeps in public/ stays far inside the 1 GB source limit', () => {
  const pub = fileURLToPath(new URL('../public', import.meta.url));
  const total = sizeOf(walk(pub));
  assert.ok(total < 250 * MB, `public/ is ${(total / MB).toFixed(1)} MB; the budget is 250 MB`);
});

// Bandwidth is the limit a game could actually reach. What a visit costs is
// the home page's own code plus the art it draws, so both are held down here.
test('a visit to the home page stays light', () => {
  const html = home();
  const assets = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+\.(?:js|css))"/g)].map((m) => dist(m[1].replace(/^\//, '')));
  assert.ok(assets.length >= 2, 'expected the home page to load its script and its stylesheet');
  // Chunks the entry script imports are part of the cost too.
  const seen = new Set(assets);
  for (const file of seen) {
    if (!file.endsWith('.js')) continue;
    for (const [, name] of readFileSync(file, 'utf8').matchAll(/from\s*"\.\/([^"]+\.js)"/g)) seen.add(dist(`_astro/${name}`));
  }
  const bytes = [...seen].reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0) + gzipSync(Buffer.from(html)).length;
  assert.ok(bytes < 300_000, `home page code is ${(bytes / 1000).toFixed(0)} KB gzipped; the budget is 300 KB`);
  const cards = sizeOf(gameData().releases.map((r) => dist(r.card.replace(/^\//, ''))));
  const perRelease = cards / gameData().releases.length;
  assert.ok(perRelease < 40_000, `monolith art averages ${(perRelease / 1000).toFixed(0)} KB a release; the budget is 40 KB`);
});
