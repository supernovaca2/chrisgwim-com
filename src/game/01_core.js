// ===== Wave Invasion · part 1: catalog, save, helpers, links, the hand-off to the shell =====
// The parts are spliced, in order, into one async function (invasion.js), so they share one
// scope. If WebGL 2 is missing this part returns early and tells shell.js, which turns the
// page into its server-rendered track list. An error thrown while starting reaches the
// page's own script, which does the same.

// The catalog, worked out at build time (src/lib/game-data.ts) and inlined in the page.
const DATA = JSON.parse(document.getElementById('data').textContent);
const LANES = DATA.lanes;
const RELEASES = DATA.releases;
const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Seeded random, so a test run can be replayed exactly. Gameplay uses rnd(); cosmetics may too.
function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let rnd = mulberry((Date.now() ^ 0x5eed) >>> 0);
const reseed = (seed) => { rnd = mulberry(seed); };
const rr = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

// ---------- Storage: localStorage only, every access guarded ----------
const KEY = 'gw-invade-';
const store = {
  get(k, fallback) {
    try { const v = localStorage.getItem(KEY + k); return v == null ? fallback : JSON.parse(v); } catch (err) { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (err) { /* storage refused: play on without saving */ } },
};
const bySlug = new Map(RELEASES.map((r) => [r.slug, r]));
const save = (() => {
  const found = store.get('found', []);
  return {
    found: new Set(Array.isArray(found) ? found.filter((s) => bySlug.has(s)) : []),
    hi: Math.max(0, Number(store.get('hi', 0)) || 0),
    muted: store.get('muted', false) === true,
    best: Math.max(0, Number(store.get('best', 0)) || 0),     // furthest wave reached
  };
})();
function persist() {
  store.set('found', [...save.found]);
  store.set('hi', save.hi);
  store.set('muted', save.muted);
  store.set('best', save.best);
}

// ---------- Catalog by lane (never hardcode titles or counts) ----------
const laneOf = new Map(LANES.map((l, i) => [l.name, i]));
const byLane = LANES.map(() => []);
for (const r of RELEASES) {
  const i = laneOf.has(r.lane) ? laneOf.get(r.lane) : LANES.length - 1;
  r._lane = i;
  byLane[i].push(r);
}
RELEASES.forEach((r, i) => { r._idx = i; });
const PREMIERE = RELEASES[0];
const scUrl = (r) => (typeof r.sc === 'string' && r.sc.startsWith('https://soundcloud.com/') ? r.sc : null);
// Site paths, built by game-data.ts: the release page and the three cover sizes.
const pageUrl = (r) => r.page;
const coverUrl = (r, size = 'card') => (size === 'thumb' ? r.thumb : size === 'large' ? r.large : r.card);
const fmtDate = (d) => {
  const t = new Date(`${d}T12:00:00`);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtScore = (n) => String(Math.floor(n)).padStart(6, '0');

// ---------- DOM helpers (catalog text only ever goes in through textContent) ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
// Links to this site open in the same tab, except during a run (see the click handler in
// part 8); links to another site always open a new one.
function link(href, label, cls = 'lnk') {
  const a = el('a', cls, label);
  a.href = href;
  if (!href.startsWith('/')) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}
// Release page, SoundCloud, and Play here: SoundCloud's own player, docked in the corner (part 8).
function releaseLinks(r, mainFirst = false) {
  const box = el('div', 'links');
  if (Number.isInteger(r.scId)) {
    const play = el('button', mainFirst ? 'lnk main' : 'lnk', 'Play here');
    play.type = 'button'; play.dataset.play = r.slug;
    box.append(play);
  }
  box.append(link(pageUrl(r), 'Release page'));
  const sc = scUrl(r);
  if (sc) box.append(link(sc, 'SoundCloud'));
  return box;
}
// The whole catalog grouped by lane, found and not found, for the Records screen.
function buildCatalog(container, foundSet) {
  container.textContent = '';
  LANES.forEach((lane, li) => {
    const list = byLane[li];
    if (!list.length) return;
    const head = el('div', 'lane-h');
    const sw = el('i', 'sw'); sw.style.background = lane.color;
    const name = el('b', null, lane.name); name.style.color = lane.color;
    const got = list.filter((r) => foundSet.has(r.slug)).length;
    head.append(sw, name, el('span', null, lane.blurb), el('em', null, `${got}/${list.length}`));
    container.append(head);
    for (const r of list) {
      const found = foundSet.has(r.slug);
      const row = el('div', found ? 'rel on' : 'rel off');
      const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = coverUrl(r, 'thumb');
      const mid = el('div');
      const meta = el('div', 'rm');
      const tag = el('span', 'rk', found ? 'FOUND' : 'NOT FOUND');
      if (found) tag.style.color = lane.color;
      meta.append(tag, document.createTextNode(`${r.genre} · ${fmtDate(r.date)}`));
      mid.append(el('div', 'rt', r.title), meta);
      row.append(img, mid, releaseLinks(r));
      container.append(row);
    }
  });
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (err) { return false; }
}

// Layout questions, asked each time they matter (a phone can turn mid-game).
const viewW = () => Math.max(innerWidth || 0, 64);
const viewH = () => Math.max(innerHeight || 0, 64);
const upright = () => viewH() > viewW() * 1.15;
const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (err) { return false; } })();
let touchUI = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (err) { return false; } })();

// No WebGL 2: hand the page to shell.js, which shows the track list. Nothing below runs.
if (!webglOK()) {
  document.dispatchEvent(new CustomEvent('game:failed', { detail: 'Wave Invasion needs WebGL 2, which this browser could not start. Here is every release instead.' }));
  return;
}
