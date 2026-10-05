// Part 1 of 7. The numbered parts are spliced, in order, into the body of the
// async function in overworld.js, so they share one scope: a name declared in
// one part is visible in every later one. See README.md in this folder.

// ---------- Catalog (built by src/lib/game-data.ts, inlined in the page) ----------
const DATA = JSON.parse(document.getElementById('data').textContent);
const ACCENT = `#${DATA.accent}`;
const CONTACT = DATA.contact;
const PLATFORMS = DATA.platforms;

const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches;
const coarse = matchMedia('(pointer: coarse)').matches || document.body.classList.contains('touch');
if (coarse) document.body.classList.add('touch');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
// Everything from the catalog that reaches innerHTML goes through esc(); every
// link through https(). Titles and descriptions arrive from SoundCloud unreviewed.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const https = (url) => (/^https:\/\//.test(url) || /^\/(?!\/)/.test(url) ? esc(url) : '#');
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (ms) => { const t = Math.round(ms / 1000); return `${Math.floor(t / 60)}:${pad2(t % 60)}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateShort = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const platform = (url) => /spotify/.test(url) ? 'Spotify' : /music\.apple\.com/.test(url) ? 'Apple Music' : /deezer/.test(url) ? 'Deezer' : /youtube/.test(url) ? 'YouTube' : 'Stream';
const tidy = (s) => String(s || '').replace(/"\s+"/g, ' ').replace(/^"|"$/g, '');

const releases = DATA.releases;                 // newest first
const newest = releases[0];
const lanes = DATA.lanes
  .map((l) => ({ ...l, tracks: releases.filter((r) => r.lane === l.name) }))
  .filter((l) => l.tracks.length);
const laneOf = new Map();
lanes.forEach((l) => l.tracks.forEach((r) => laneOf.set(r.slug, l)));
const TOTAL = releases.length;

const PLAY_ICON = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"></path></svg>';
const linksHtml = (r) => {
  const out = [
    `<button class="btn btn-main plain" type="button" data-play="${esc(r.slug)}">${PLAY_ICON}Play here</button>`,
    `<a class="btn" href="${https(r.sc)}" target="_blank" rel="noopener">SoundCloud</a>`,
  ];
  if (!/soundcloud\.com/.test(r.primary)) out.push(`<a class="btn" href="${https(r.primary)}" target="_blank" rel="noopener">${platform(r.primary)}</a>`);
  out.push(`<a class="btn plain" href="${https(r.page)}">Release page</a>`);
  return out.join('');
};

// ---------- Save game (this browser only) ----------
const SAVE_KEY = 'gwim-overworld-v1';
const save = { found: new Set(), sound: true };
try {
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (raw) {
    // Only slugs that are still in the catalog: a save is read back as data, never trusted.
    (Array.isArray(raw.found) ? raw.found : []).forEach((slug) => { if (laneOf.has(slug)) save.found.add(slug); });
    save.sound = raw.sound !== false;
  }
} catch (err) { /* private window or blocked storage: play without a save */ }
const persist = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ found: [...save.found], sound: save.sound })); } catch (err) { /* ignore */ }
};
const laneFound = (lane) => lane.tracks.filter((r) => save.found.has(r.slug)).length;

// ---------- Track list: rendered by the server as plain links, taken over here ----------
paintLanes();
const trackRows = new Map();
document.querySelectorAll('#tl-lanes .tl-row').forEach((row) => trackRows.set(row.dataset.slug, row));
for (const lane of lanes) {
  const section = document.querySelector(`#tl-lanes .tl-lane[data-lane="${lane.bus}"]`);
  lane.listCount = section ? section.querySelector('h3 span') : null;
}
function refreshTrackList() {
  for (const [slug, row] of trackRows) {
    const on = save.found.has(slug);
    row.classList.toggle('found', on);
    row.setAttribute('aria-label', `${row.dataset.title}, beacon ${on ? 'lit' : 'dark'}`);
  }
  for (const lane of lanes) if (lane.listCount) lane.listCount.textContent = `${laneFound(lane)} / ${lane.tracks.length}`;
  $('tracks-sub').textContent = `${save.found.size} of ${TOTAL} beacons lit. Pick any release to travel there.`;
}
refreshTrackList();

// Without WebGL 2 the track list is the whole page: every release, linked.
const GL_OK = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (err) { return false; } })();
if (!GL_OK) { showFallback('This browser cannot draw the 3D world, so here is every release.'); return; }

// Sign and plate lettering is drawn to canvas, so the faces must be in first.
await Promise.race([
  Promise.all(['900 64px "Big Shoulders Display Variable"', '800 64px "Big Shoulders Display Variable"', '500 24px "Geist Mono Variable"', '600 16px "Instrument Sans Variable"'].map((f) => document.fonts.load(f))),
  new Promise((done) => setTimeout(done, 2500)),
]).catch(() => {});

// ---------- Deterministic noise ----------
function hash(ix, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), u), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
// Small seeded generator for scatter that must not change between visits.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- The plan of the world ----------
// North is -Z. A bearing is measured clockwise from north, like a compass.
const HUB = { x: 0, z: 0, r: 50 };
const DIST_R = 250;        // hub to district center
const EDGE_R = 392;        // the playable world ends here; mountains beyond
const ARC = (250 / 360) * TAU;    // a district's monoliths fan across this much of a circle
const districts = lanes.map((lane, i) => {
  const bearing = (i / lanes.length) * TAU;
  const dx = Math.sin(bearing), dz = -Math.cos(bearing);
  // The ring the monoliths stand on, and the flat plaza around it. The catalog grows on its
  // own (the SoundCloud sync), so a lane that outgrows the default ring gets a wider one
  // instead of overlapping slabs. Fourteen releases fit before it starts to widen.
  const ring = Math.max(42, ((lane.tracks.length - 1) * 13.6) / ARC);
  const d = { lane, i, bearing, dx, dz, x: dx * DIST_R, z: dz * DIST_R, ring, r: ring + 20, road: [] };
  // A gently curved road from the hub rim to the plaza gate.
  const sx = dx * (HUB.r - 6), sz = dz * (HUB.r - 6);
  const ex = d.x - dx * (d.r - 8), ez = d.z - dz * (d.r - 8);
  const bend = (i % 2 ? 1 : -1) * 17;
  const N = 28;
  for (let k = 0; k <= N; k++) {
    const t = k / N, s = Math.sin(Math.PI * t) * bend;
    d.road.push({ x: lerp(sx, ex, t) - dz * s, z: lerp(sz, ez, t) + dx * s });
  }
  lane.district = d;
  return d;
});
const SECTOR = TAU / districts.length;
function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const t = clamp(((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
}
// Distance to the nearest road. A road never strays far from its radial, so
// only the two districts either side of the point's bearing can own it.
const roadHit = { d: 1e9, i: -1 };
function roadInfo(x, z) {
  roadHit.d = 1e9; roadHit.i = -1;
  let f = Math.atan2(x, -z) / SECTOR;
  if (f < 0) f += districts.length;
  const i0 = Math.floor(f) % districts.length, i1 = (i0 + 1) % districts.length;
  for (const i of [i0, i1]) {
    const pts = districts[i].road;
    for (let k = 0; k < pts.length - 1; k++) {
      const dd = segDist(x, z, pts[k], pts[k + 1]);
      if (dd < roadHit.d) { roadHit.d = dd; roadHit.i = i; }
    }
  }
  return roadHit;
}

function dune(x, z) {
  const u = x * 0.82 + z * 0.57, v = -x * 0.57 + z * 0.82;        // crests run across the wind
  const warp = vnoise(x * 0.004 + 40, z * 0.004 + 7) * 60;
  const n = vnoise((u + warp) * 0.011, v * 0.0042);
  const ridge = 1 - Math.abs(2 * n - 1);
  let h = ridge * ridge * 11;
  h += (vnoise(u * 0.027 + 13, v * 0.016 + 3) - 0.5) * 6;
  h += (vnoise(x * 0.09, z * 0.09) - 0.5) * 0.9;
  return h - 4.2;
}
const ground = { h: 0, road: 0, plaza: 0, rim: 0, lane: -1 };
function sampleGround(x, z) {
  const r = Math.hypot(x, z);
  let h = dune(x, z), road = 0, plaza = 0, lane = -1;
  if (r < EDGE_R + 60) {
    plaza = 1 - smooth(HUB.r, HUB.r + 34, r);
    for (const d of districts) {
      const dd = Math.hypot(x - d.x, z - d.z);
      if (dd < d.r + 40) { const m = 1 - smooth(d.r, d.r + 36, dd); if (m > plaza) { plaza = m; lane = d.i; } }
    }
    if (r > HUB.r - 12 && r < DIST_R) {
      const hit = roadInfo(x, z);
      road = 1 - smooth(7, 25, hit.d);
      if (road > 0.02 && lane < 0) lane = hit.i;
    }
    h *= (1 - 0.86 * road) * (1 - plaza);
  }
  const rim = smooth(EDGE_R + 4, EDGE_R + 250, r);
  if (rim > 0) {
    const n = vnoise(x * 0.0065 + 90, z * 0.0065 + 20);
    // A rounded crest: a knife edge running diagonally across the grid draws as a row of teeth.
    const ridge = 1 - Math.abs(2 * n - 1), crest = ridge * ridge * (3 - 2 * ridge);
    h += Math.pow(rim, 1.5) * (38 + crest * 96 + vnoise(x * 0.016, z * 0.016) * 26);
  }
  ground.h = h; ground.road = road; ground.plaza = plaza; ground.rim = rim; ground.lane = lane;
  return ground;
}

// The height grid: the terrain mesh is drawn from it and the physics reads it,
// so the glider can never disagree with the ground it sees.
const GRID_SIZE = 1560;
const GRID_N = small ? 208 : 312;
const CELL = GRID_SIZE / GRID_N;
const G1 = GRID_N + 1;
const HALF_GRID = GRID_SIZE / 2;
const heights = new Float32Array(G1 * G1);
const groundMask = new Float32Array(G1 * G1 * 3);    // road, plaza, rim
const groundLane = new Int8Array(G1 * G1);
for (let iz = 0; iz < G1; iz++) {
  for (let ix = 0; ix < G1; ix++) {
    const s = sampleGround(-HALF_GRID + ix * CELL, -HALF_GRID + iz * CELL);
    const i = iz * G1 + ix;
    heights[i] = s.h; groundMask[i * 3] = s.road; groundMask[i * 3 + 1] = s.plaza; groundMask[i * 3 + 2] = s.rim; groundLane[i] = s.lane;
  }
}
function heightAt(x, z) {
  const gx = clamp((x + HALF_GRID) / CELL, 0, GRID_N - 1e-4), gz = clamp((z + HALF_GRID) / CELL, 0, GRID_N - 1e-4);
  const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz;
  const i = iz * G1 + ix;
  const h00 = heights[i], h10 = heights[i + 1], h01 = heights[i + G1], h11 = heights[i + G1 + 1];
  return fx + fz <= 1 ? h00 + fx * (h10 - h00) + fz * (h01 - h00) : h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
}
