import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

// All the CSS the homepage actually ships, whether Astro emits an external
// stylesheet or inlines it into index.html (it inlines any sheet under ~4KB).
// Concatenating both keeps CSS assertions valid across that threshold.
const homepageStyles = () => {
  const css = textFiles()
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const inline = readFileSync(dist('index.html'), 'utf8');
  return css + inline;
};

const releaseFiles = () => readdirSync(releasesDir).filter((f) => f.endsWith('.json'));
const releases = () =>
  releaseFiles().map((f) => ({ slug: f.replace(/\.json$/, ''), ...JSON.parse(readFileSync(`${releasesDir}/${f}`, 'utf8')) }));

test('the homepage is generated', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html should exist');
});

// Without this file in the published output, GitHub Pages drops the custom
// domain on every deploy and chrisgwim.com stops resolving to the site.
test('CNAME survives the build into dist', () => {
  assert.equal(readFileSync(dist('CNAME'), 'utf8').trim(), 'chrisgwim.com');
});

// Signal Blue (2026-09-28). The accent is a literal hex in two places the
// token cannot reach: the SoundCloud embed's color param and this test.
const ACCENT = '5cc8ff';
test('the current accent reaches the build, including the SoundCloud embed', () => {
  const found = textFiles().some((f) => new RegExp(ACCENT, 'i').test(readFileSync(f, 'utf8')));
  assert.ok(found, `expected accent #${ACCENT} somewhere in dist`);
  const home = readFileSync(dist('index.html'), 'utf8');
  assert.match(home, new RegExp(`color=%23${ACCENT}`, 'i'), 'the SoundCloud embed must use the current accent');
});

// Earlier themes bypassed the token in several places, including the embed's
// own color param. Any survivor leaves the page visibly half-repainted.
test('no legacy accent survives anywhere in the build', () => {
  const legacy = [/e2a33f/i, /226,\s*163,\s*63/, /9ece6a/i, /158,\s*206,\s*106/, /#111213/i, /#1a1b1d/i];
  const offenders = textFiles().filter((f) => {
    const body = readFileSync(f, 'utf8');
    return legacy.some((re) => re.test(body));
  });
  assert.deepEqual(
    offenders.map((f) => f.replace(distRoot, 'dist')),
    [],
    'legacy amber, green or graphite found in built output'
  );
});

test('the shell becomes a two-track grid on wide viewports', () => {
  const all = homepageStyles();
  // Lightning CSS (Astro's build minifier) rewrites `min-width: 1100px` to
  // `width>=1100px`, so accept either spelling of the same breakpoint.
  assert.match(all, /min-width:\s*1100px|width\s*>=\s*1100px/, 'expected a 1100px breakpoint');
  assert.match(all, /grid-template-columns:\s*var\(--console-w\)\s+var\(--rail-w\)/,
    'expected the console + rail grid');
});

test('the Lunthra rail is present and links out cleanly', () => {
  const home = readFileSync(dist('index.html'), 'utf8');
  assert.match(home, /https:\/\/lunthra\.com/, 'expected a lunthra.com link');
  assert.match(
    home,
    /<a class="rail-link"[^>]*rel="noopener"/,
    'expected rel=noopener on the rail\'s own outbound link'
  );
  assert.doesNotMatch(home, /utm_/, 'UTM parameters are not allowed on the Lunthra link');
});

test('the rail also renders for narrow viewports', () => {
  const home = readFileSync(dist('index.html'), 'utf8');
  // The rail must be in the document at every width, not display:none'd away
  // on mobile - most music traffic is phones.
  assert.match(home, /class="rail"/, 'expected the rail markup in the document');
  // The scoped `.rail` rule ships as `.rail[data-astro-cid-...]{...}` in either
  // an external dist/_astro/*.css file or, if Astro inlines that sheet, inside
  // index.html. Search both the way the layout test does so the guard cannot go
  // inert when the stylesheet crosses Astro's inlining threshold.
  assert.doesNotMatch(
    homepageStyles(),
    /\.rail\b[^{}]*\{[^}]*display:\s*none/,
    'the rail must reflow on mobile, not disappear'
  );
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
  assert.match(page, /href="\/music\/"/, '404 should link to the track list');
  assert.doesNotMatch(readFileSync(dist('sitemap-0.xml'), 'utf8'), /404/);
});

test('every release has exactly one SoundCloud id, and ids are unique', () => {
  const ids = releases().map((r) => r.soundcloudId);
  assert.equal(new Set(ids).size, ids.length, 'duplicate soundcloudId across releases');
});

test('the homepage features the newest release with a player', () => {
  const all = releases().sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.title.localeCompare(b.title));
  const newest = all[0];
  const home = readFileSync(dist('index.html'), 'utf8');
  assert.match(home, new RegExp(`api\\.soundcloud\\.com%2Ftracks%2F${newest.soundcloudId}`),
    'homepage must embed the newest release');
  assert.match(home, /LATEST RELEASE/, 'expected the featured rack unit');
  assert.match(home, /"@type":"MusicGroup"/, 'expected MusicGroup JSON-LD');
});

test('the display face is self-hosted and reaches the build', () => {
  assert.ok(existsSync(dist('fonts/barlow-condensed-800.woff2')), 'display font missing from dist');
  assert.ok(existsSync(dist('fonts/barlow-condensed-600.woff2')), 'display font missing from dist');
  const css = homepageStyles();
  assert.match(css, /Barlow Condensed/, 'expected the @font-face in shipped CSS');
  assert.doesNotMatch(css, /fonts\.googleapis\.com|fonts\.gstatic\.com/, 'fonts must not load from Google');
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
  const pages = walk(distRoot).filter((f) => f.endsWith('.html'));
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
