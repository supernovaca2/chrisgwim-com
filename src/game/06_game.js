
// ---------- Progress ----------
const bySlug = new Map(releases.map((r) => [r.slug, r]));
const laneIndex = new Map(lanes.map((l, i) => [l.name, i]));
for (const m of monoliths) if (save.found.has(m.r.slug)) { m.found = true; m.k = 1; }
for (const d of districts) d.done = laneFound(d.lane) === d.lane.tracks.length;
const hud = $('hud'), titleEl = $('title'), promptEl = $('prompt'), bannerEl = $('banner'), panel = $('panel'), fadeEl = $('fade');
const sheets = { pause: $('pause'), tracks: $('tracks'), map: $('map') };
const FT = 3.281;

function burst(x, y, z, hex, n, speed, up = 0) {
  const color = hdr(hex, 2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, e = Math.acos(2 * Math.random() - 1), s = speed * (0.35 + Math.random() * 0.65);
    sparks.spawn(x, y, z, Math.sin(e) * Math.cos(a) * s, Math.cos(e) * s + up, Math.sin(e) * Math.sin(a) * s, 0.2 + Math.random() * 0.4, 0.9 + Math.random() * 1.2, color, 7);
  }
}

// Sparks thrown off the edge of a cover as it lights, so they frame the art instead of hiding it.
function frameBurst(m, hex, n) {
  const color = hdr(hex, 2), half = m.size / 2 + 0.3, ax = m.nz, az = -m.nx;
  for (let i = 0; i < n; i++) {
    const side = Math.floor(Math.random() * 4), u = (Math.random() * 2 - 1) * half;
    const lx = side === 0 ? -half : side === 1 ? half : u, ly = side === 2 ? -half : side === 3 ? half : u;
    const len = Math.hypot(lx, ly) || 1, s = 4 + Math.random() * 9, out = (Math.random() - 0.5) * 9;
    sparks.spawn(m.x + ax * lx, m.cy + ly, m.z + az * lx, ax * (lx / len) * s + m.nx * out, (ly / len) * s + 3, az * (lx / len) * s + m.nz * out, 0.16 + Math.random() * 0.3, 0.9 + Math.random() * 1.3, color, 6);
  }
}

// ---------- Banners: one at a time, like a location card ----------
const bannerQueue = [];
let bannerBusy = false;
function banner(kicker, title, sub, color = ACCENT, dur = 3.2) {
  if (bannerQueue.length > 3) bannerQueue.shift();
  bannerQueue.push({ kicker, title, sub, color, dur });
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  const b = bannerQueue.shift();
  if (!b) { bannerBusy = false; bannerEl.textContent = ''; return; }
  bannerBusy = true;
  bannerEl.innerHTML = `<div class="card"><small>${esc(b.kicker)}</small><b>${esc(b.title)}</b><span>${esc(b.sub)}</span></div>`;
  // Through the style object, not a style attribute: the site's content security policy refuses those.
  bannerEl.firstElementChild.style.setProperty('--c', b.color);
  bannerEl.firstElementChild.style.setProperty('--dur', `${b.dur}s`);
  setTimeout(nextBanner, b.dur * 1000 - 120);
}

// ---------- Quest tracker ----------
const laneSegs = new Map();
for (const lane of lanes) {
  const li = document.createElement('li');
  li.style.setProperty('--c', lane.color);
  li.innerHTML = `<b>${lane.bus}</b><span class="segs">${lane.tracks.map(() => '<i></i>').join('')}</span>`;
  $('q-lanes').appendChild(li);
  laneSegs.set(lane.name, [...li.querySelectorAll('i')]);
}
function refreshQuest(pop) {
  const el = $('q-found');
  el.textContent = pad2(save.found.size);
  for (const lane of lanes) { const n = laneFound(lane); laneSegs.get(lane.name).forEach((seg, i) => seg.classList.toggle('on', i < n)); }
  if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
refreshQuest(false);

let goal = null, goalDist = 0, moodNight = 0, moodDawn = 0;
function setMoodTargets() {
  moodNight = Math.pow(Math.min(1, save.found.size / (TOTAL - 1)), 1.25);
  moodDawn = save.found.size >= TOTAL ? 1 : 0;
}
setMoodTargets();
mood.night = moodNight; mood.dawn = moodDawn; applyMood();

function findGoal() {
  let best = null, bd = 1e18;
  for (const m of monoliths) {
    if (m.found) continue;
    const dx = m.x - player.pos.x, dz = m.z - player.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < bd) { bd = d2; best = m; }
  }
  goal = best; goalDist = best ? Math.sqrt(bd) : 0;
  const el = $('q-next');
  if (best) el.innerHTML = `<small>Next</small><b>${esc(best.r.title)}</b><span>${Math.max(10, Math.round(goalDist * FT / 10) * 10).toLocaleString('en-US')} ft</span>`;
  else el.innerHTML = '<small>Done</small><b>Every beacon is lit</b>';
}

const FINALE = 16, FINALE_CARD_AT = 12.5;      // seconds: the whole ending, and when its closing card opens
function discover(slug, quiet = false) {
  if (save.found.has(slug) || !bySlug.has(slug)) return;
  save.found.add(slug); persist();
  const r = bySlug.get(slug), lane = laneOf.get(slug), li = laneIndex.get(lane.name);
  for (const m of monolithsOf(slug)) {
    m.found = true;
    if (quiet) { m.k = 1; continue; }
    const near = Math.hypot(m.x - player.pos.x, m.z - player.pos.z) < 140;
    if (!near) { m.k = 1; continue; }
    frameBurst(m, lane.color, small ? 90 : 180);
    shockwave(m.x, m.y0, m.z, lane.color);
  }
  refreshQuest(!quiet); refreshTrackList(); setMoodTargets(); findGoal();
  const n = laneFound(lane), all = lane.tracks.length;
  lane.district.done = n === all;
  if (quiet) return;
  sfx.found(li);
  banner(`Beacon lit · ${save.found.size} / ${TOTAL}`, r.title, r.genre === lane.name ? lane.name : `${lane.name} · ${r.genre}`, lane.color, 3);
  if (n === all) { banner('District complete', lane.name, `All ${all} beacon${all === 1 ? '' : 's'} lit`, lane.color, 3.4); setTimeout(() => sfx.lane(li), 2900); }
  if (save.found.size === TOTAL) {
    // Sixteen seconds of fireworks, counted down in updateWorld. The closing card opens from
    // there too, not from a timer, so starting a new game calls the whole ending off.
    game.finale = FINALE; game.finaleCard = true;
    banner('Overworld complete', `All ${TOTAL} beacons lit`, 'Dawn breaks over the catalog.', '#ffd9a8', 5);
    setTimeout(() => { if (game.finale > 0) sfx.all(); }, 6200);
  }
}

function resetProgress() {
  save.found.clear(); persist();
  for (const m of monoliths) { m.found = false; m.k = 0; }
  for (const d of districts) d.done = false;
  game.finale = 0; game.finaleCard = false;
  refreshQuest(false); refreshTrackList(); setMoodTargets(); findGoal();
}

// ---------- The world, per frame ----------
let lodClock = 0, currentDistrict = null, edgeNotice = 0, scrim = -1;
// Original uploads are up to 1200px. Thirty of them would hold a quarter gigabyte of video
// memory, so only the nearest few are kept; the 360px cards stay loaded for everything else.
const SHARP_MAX = 8, sharp = [];
const nearLit = [];
function updateWorld(dt) {
  const t = game.time, p = player.pos;
  mood.night = damp(mood.night, moodNight, 0.5, dt); mood.dawn = damp(mood.dawn, moodDawn, 0.22, dt);
  applyMood();
  // The HUD's backing deepens as the sky lightens (.hud::before in overworld.css).
  // Night counts too, at half weight: a dark sky, but crossed by every lit beam.
  const glare = Math.max(mood.dawn, mood.night * 0.5);
  const wanted = Math.round((0.45 + 0.4 * glare) * 50) / 50;
  if (wanted !== scrim) {
    scrim = wanted;
    hud.style.setProperty('--scrim', String(scrim));
    titleEl.style.setProperty('--veil', glare.toFixed(2));      // .title::before
  }
  starU.uTime.value = t;

  nearLit.length = 0;
  for (const m of monoliths) {
    if (m.found && m.k < 1) m.k = Math.min(1, m.k + dt / 1.5);
    const e = easeOut(m.k), flash = Math.sin(Math.PI * m.k), shimmer = 0.9 + 0.1 * Math.sin(t * 1.7 + m.x * 0.13);
    m.cover.uniforms.uLit.value = e;
    m.frameMat.color.copy(m.laneColor).multiplyScalar(0.2 + e * 1.4 + flash * 1.6);
    m.core.material.uniforms.uColor.value.setRGB(1, 1, 1).lerp(m.laneColor, e * 0.8).multiplyScalar(1 + e * 1.6 + flash * 2.4);
    // A dark beacon's signal is for finding it from afar; up close it would only be in the way.
    const far = smooth(40, 150, Math.hypot(m.x - p.x, m.z - p.z));
    m.core.material.uniforms.uOpacity.value = (0.3 + 0.12 * Math.sin(t * 2 + m.z)) * far * (1 - e) + e * 1.1 * shimmer;
    const girth = 1 + e * 0.5 + flash * 1.6;
    m.core.scale.set(girth, BEAM_H * (0.5 + 0.5 * e), girth);
    m.halo.material.uniforms.uOpacity.value = e * 0.42 * shimmer + flash * 0.5;
    m.pool.material.opacity = e * 0.4 + flash * 0.4;
    // Draw calls are what a phone's CPU pays for. Nothing invisible is submitted: not the glow of
    // a beacon that is still dark, and not the face of the slab that is turned away.
    m.core.visible = m.core.material.uniforms.uOpacity.value > 0.004;
    m.halo.visible = m.pool.visible = e > 0.004;
    const frontShown = (cam.pos.x - m.x) * m.nx + (cam.pos.z - m.z) * m.nz > 0;
    if (frontShown !== m.frontShown) {
      m.frontShown = frontShown;
      for (const o of m.front) o.visible = frontShown;
      for (const o of m.back) o.visible = !frontShown;
    }
    if (m.found) { const dx = m.x - p.x, dz = m.z - p.z; m.d2 = dx * dx + dz * dz; if (m.d2 < 110 * 110) nearLit.push(m); }
  }
  nearLit.sort((a, b) => a.d2 - b.d2);
  beaconLights.forEach((light, i) => {
    const m = nearLit[i];
    if (!m) { light.intensity = 0; return; }
    light.position.set(m.x, m.cy, m.z);
    light.color.copy(m.laneColor).lerp(tmpColor.set(m.r.tint), 0.5);
    light.intensity = 75 * easeOut(m.k);
  });

  let nearest = null, nd = 1e9;
  for (const d of districts) {
    const n = laneFound(d.lane) / d.lane.tracks.length;
    d.power = damp(d.power, d.done ? 1 : 0.22 + n * 0.45, 1.4, dt);
    const dd = Math.hypot(d.x - p.x, d.z - p.z);
    if (dd < nd) { nd = dd; nearest = d; }
  }
  for (const a of animated) a.update(t, dt);
  if (nearest && nearest.lamp) {
    districtLight.position.set(nearest.lamp.x, nearest.lamp.y, nearest.lamp.z);
    districtLight.color.set(nearest.lane.color);
    districtLight.intensity = nearest.lamp.intensity * (1 - smooth(110, 175, nd));
  }
  const inside = nearest && nd < nearest.r + 10 ? nearest : null;
  if (inside !== currentDistrict) {
    currentDistrict = inside;
    if (inside && game.mode === 'play' && !game.overlay) {
      const n = laneFound(inside.lane), all = inside.lane.tracks.length;
      banner(`District ${inside.lane.bus}`, inside.lane.name, `${inside.lane.blurb} · ${n} of ${all} lit`, inside.lane.color, 3.2);
    }
  }
  edgeNotice -= dt;
  if (Math.hypot(p.x, p.z) > EDGE_R - 4 && edgeNotice <= 0 && game.mode === 'play') { edgeNotice = 9; banner('Edge of the map', 'Nothing but mountains', 'The road home is behind you.', '#d6d2dc', 2.6); }

  // Sharper cover art once you are close enough to see the difference.
  lodClock -= dt;
  if (lodClock <= 0 && !small) {
    lodClock = 0.5;
    for (const m of monoliths) {
      if (m.large) continue;
      const dx = m.x - p.x, dz = m.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 > 80 * 80) continue;
      if (sharp.length >= SHARP_MAX) {
        // Full: make room only by dropping one that is farther away than this one, so a plaza
        // with more monoliths than slots settles instead of swapping forever.
        let far = -1, farD = d2;
        sharp.forEach((s, i) => { const sd = (s.x - p.x) ** 2 + (s.z - p.z) ** 2; if (sd > farD) { farD = sd; far = i; } });
        if (far < 0) continue;
        const drop = sharp.splice(far, 1)[0];
        drop.large = false; drop.cover.uniforms.map.value = drop.tex;
        if (drop.sharpTex) { drop.sharpTex.dispose(); drop.sharpTex = null; }
      }
      m.large = true; sharp.push(m);
      lazyLoader.load(m.r.large, (tex) => {
        if (!m.large) { tex.dispose(); return; }        // dropped again before it arrived
        prepTex(tex); m.cover.uniforms.map.value = tex; m.sharpTex = tex;
      });
    }
  }

  if (game.finale > 0) {
    game.finale -= dt;
    // The closing card waits for a clear moment: not over a menu, not mid-travel.
    if (game.finaleCard && game.finale < FINALE - FINALE_CARD_AT && game.mode === 'play' && !game.overlay && !game.traveling) {
      game.finaleCard = false;
      openItem(interactables.find((it) => it.kind === 'links'));
    }
    if (Math.random() < dt * 3.2) {
      const lane = lanes[Math.floor(Math.random() * lanes.length)], a = Math.random() * TAU, rr = 10 + Math.random() * 46;
      burst(p.x + Math.sin(a) * rr, player.pos.y + 16 + Math.random() * 22, p.z + Math.cos(a) * rr, lane.color, small ? 40 : 80, 15, 2);
    }
  }
}

// ---------- Proximity: light beacons, offer the open prompt ----------
let nearItem = null;
function updateProximity() {
  const p = player.pos;
  let best = null, bd = 1e9;
  for (const it of interactables) {
    const d = Math.hypot(p.x - it.x, p.z - it.z);
    if (d < it.reach && d < bd) { bd = d; best = it; }
  }
  if (best !== nearItem) {
    nearItem = best;
    promptEl.hidden = !best;
    if (best) { $('pr-title').textContent = best.label; $('pr-verb').textContent = best.verb; }
  }
  for (const m of monoliths) {
    if (m.found) continue;
    if (Math.hypot(p.x - m.x, p.z - m.z) < m.sense) discover(m.r.slug);
  }
}

// ---------- Overlays ----------
function setOverlay(name) {
  game.overlay = name;
  for (const k in sheets) { const on = k === name; sheets[k].classList.toggle('on', on); sheets[k].toggleAttribute('inert', !on); }
  const pOn = name === 'panel';
  panel.classList.toggle('on', pOn); panel.toggleAttribute('inert', !pOn);
  // What an overlay covers or fades out must leave the Tab order too, not only the screen.
  hud.toggleAttribute('inert', !!name);
  dock.toggleAttribute('inert', !!name && !pOn);
  if (game.mode === 'title') titleEl.toggleAttribute('inert', !!name);
  document.body.classList.toggle('paused', !!name);
  document.body.classList.toggle('cine', pOn && !sheetLayout());
  releaseAll();
  if (!name) {
    if (cam.mode === 'inspect') { cam.mode = 'chase'; cam.ease = 0.3; }
    if (panelItem) { panelItem = null; setHash(''); }
    if (game.mode === 'play') canvasEl.focus({ preventScroll: true });
    else titleMenu.paint();
    return;
  }
  const first = (pOn ? panel : sheets[name]).querySelector('button:not([disabled]):not([hidden]), a[href]');
  if (first) first.focus({ preventScroll: true });
}
const setHash = (h) => { try { history.replaceState(null, '', h ? `#${h}` : location.pathname + location.search); } catch (err) { /* sandboxed */ } };

let panelItem = null;
function openItem(it) {
  if (!it) return;
  panelItem = it;
  const body = $('panel-body');
  if (it.kind === 'release') {
    const r = it.m.r, lane = it.m.lane, i = lane.tracks.indexOf(r);
    panel.style.setProperty('--c', lane.color);
    panel.setAttribute('aria-label', r.title);
    body.innerHTML = `
      <p class="chip"><i></i>${lane.bus} · ${esc(lane.name)}${r === newest ? ' · New' : ''}</p>
      <h2>${esc(r.title)}</h2>
      <dl class="stats">
        <div><dt>Released</dt><dd>${dateShort(r.date)}</dd></div>
        <div><dt>Length</dt><dd>${fmt(r.ms)}</dd></div>
        <div><dt>Genre</dt><dd>${esc(r.genre)}</dd></div>
      </dl>
      ${r.notes ? `<p class="notes">${esc(tidy(r.notes))}</p>` : ''}
      <div class="actions">${linksHtml(r)}</div>`;
    $('p-prev').disabled = i <= 0; $('p-next').disabled = i >= lane.tracks.length - 1;
    $('p-prev').hidden = $('p-next').hidden = false;
    inspectView(it.m.x, it.m.cy, it.m.z, it.m.nx, it.m.nz, it.m.size);
    setHash(r.slug);
  } else {
    panel.style.setProperty('--c', ACCENT);
    panel.setAttribute('aria-label', it.label);
    const platforms = PLATFORMS.map((pf, i) => `<a class="btn${i ? '' : ' btn-main'}" href="${https(pf.url)}" target="_blank" rel="noopener">${esc(pf.name)}</a>`).join('');
    body.innerHTML = it.kind === 'story' ? `
      <p class="chip"><i></i>The story</p>
      <h2>Chris Gwim</h2>
      <dl class="stats">
        <div><dt>Releases</dt><dd>${TOTAL}</dd></div>
        <div><dt>Lanes</dt><dd>${lanes.length}</dd></div>
        <div><dt>Built in</dt><dd>Ableton Live</dd></div>
      </dl>
      <p class="notes">A producer working in Ableton Live. The output is whatever the idea needs: classical fusion, melodic techno and trance, progressive house, solo piano, synth punk, drum and bass, soca, afrobeats. No live dates. The work is the catalog.</p>
      <div class="actions"><a class="btn btn-main plain" href="${https(DATA.links.story)}">Read the full story</a></div>
      <p class="contact">Contact <b>${esc(CONTACT)}</b></p>` : `
      <p class="chip"><i></i>Listen everywhere</p>
      <h2>Take it with you</h2>
      <p class="notes">Every release is on the major platforms. Following there is the best way to hear the next one first.</p>
      <div class="actions">${platforms}</div>
      <p class="chip also"><i></i>Also from the studio</p>
      <div class="actions">
        <a class="btn" href="${https(DATA.links.lunthra)}" target="_blank" rel="noopener">Lunthra apparel</a>
        <a class="btn" href="${https(DATA.links.referral)}" target="_blank" rel="noopener">A free month of SoundCloud Artist Pro</a>
      </div>
      <p class="contact">Contact <b>${esc(CONTACT)}</b></p>`;
    $('p-prev').hidden = $('p-next').hidden = true;
    inspectView(it.stele.x, it.stele.cy, it.stele.z, it.stele.nx, it.stele.nz, it.stele.size);
  }
  body.scrollTop = 0;
  setOverlay('panel');
  sfx.blip(true);
}
const interact = () => { if (nearItem && game.mode === 'play' && !game.overlay && !game.traveling) openItem(nearItem); };

// ---------- Travel ----------
function travel(x, z, yaw, then) {
  game.traveling = true;
  fadeEl.classList.add('on');
  sfx.whoosh();
  setTimeout(() => {
    placePlayer(x, z, yaw);
    updateProximity(); findGoal();
    if (then) then();
    game.traveling = false;
    requestAnimationFrame(() => requestAnimationFrame(() => fadeEl.classList.remove('on')));
  }, reduced ? 20 : 280);
}
// Close enough that the chase camera, 12 behind the glider, is still clear of the district landmark at its back.
const frontOf = (m) => { const D = m.size + 5; return [m.x + m.nx * D, m.z + m.nz * D, Math.atan2(-m.nx, m.nz)]; };
function goToRelease(slug, open = true) {
  const m = monoliths.find((x) => x.r.slug === slug && !x.hero) || monolithsOf(slug)[0];
  if (!m) return;
  if (game.mode !== 'play') startGame(true);
  setOverlay(null);
  travel(...frontOf(m), () => { if (open) openItem(interactables.find((it) => it.m === m)); });
}
function goToDistrict(d) {
  if (game.mode !== 'play') startGame(true);
  setOverlay(null);
  travel(d.x - d.dx * (d.r + 8), d.z - d.dz * (d.r + 8), d.bearing);
}
function goToHub() {
  if (game.mode !== 'play') startGame(true);
  setOverlay(null);
  travel(SPAWN.x, SPAWN.z, SPAWN.yaw);
}
function resetToRoad() {
  let best = SPAWN, bd = Math.hypot(player.pos.x - SPAWN.x, player.pos.z - SPAWN.z);
  for (const d of districts) for (const pt of d.road) { const dd = Math.hypot(player.pos.x - pt.x, player.pos.z - pt.z); if (dd < bd) { bd = dd; best = pt; } }
  travel(best.x, best.z, player.yaw);
}

// ---------- Compass ----------
const compassEl = $('compass'), ticksEl = $('c-ticks');
const marks = [];
function addMark(text, cls, bearing, color) {
  const el = document.createElement('span');
  el.textContent = text; el.className = cls;
  if (color) el.style.setProperty('--c', color);
  $('c-marks').appendChild(el);
  marks.push({ el, bearing, pin: cls === 'goal' });
}
[['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', Math.PI * 1.5]].forEach(([t, b]) => addMark(t, 'card', () => b));
districts.forEach((d) => addMark(d.lane.bus, 'lane', () => Math.atan2(d.x - player.pos.x, player.pos.z - d.z), d.lane.color));
addMark('', 'goal', () => (goal ? Math.atan2(goal.x - player.pos.x, player.pos.z - goal.z) : null));
let compassW = 0;
function updateCompass() {
  if (!compassW) return;
  const pxRad = compassW / THREE.MathUtils.degToRad(150), half = compassW / 2;
  for (const m of marks) {
    const b = m.bearing();
    if (b === null) { m.el.style.opacity = 0; continue; }
    let x = angDiff(player.yaw, b) * pxRad;
    if (m.pin) x = clamp(x, -half * 0.62, half * 0.62);
    const vis = Math.abs(x) < half + 14;
    m.el.style.opacity = vis ? 1 : 0;
    if (vis) m.el.style.transform = `translateX(${x.toFixed(1)}px) translateX(-50%)`;
  }
  const tile = THREE.MathUtils.degToRad(15) * pxRad;
  ticksEl.style.backgroundSize = `${tile.toFixed(2)}px 9px`;
  ticksEl.style.backgroundPositionX = `${((half - player.yaw * pxRad) % tile).toFixed(1)}px`;
}

// ---------- Radar (heading up) and map (north up) ----------
const radar = $('radar'), rctx = radar.getContext('2d');
const mapCanvas = $('map-canvas'), mctx = mapCanvas.getContext('2d');
const cssDpr = () => Math.min(2, window.devicePixelRatio || 1);
function fitCanvas(c) {
  const r = c.getBoundingClientRect(), d = cssDpr();
  const w = Math.round(r.width * d), h = Math.round(r.height * d);
  if (w > 0 && h > 0 && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
function drawRadar() {
  const W = radar.width;
  if (!W) return;
  const g = rctx, d = cssDpr(), c = W / 2, R = c - 2 * d, range = 215, k = R / range;
  const px = player.pos.x, pz = player.pos.z, s = Math.sin(player.yaw), co = Math.cos(player.yaw);
  const tx = (wx, wz) => { const dx = wx - px, dz = wz - pz; return [c + (dx * co + dz * s) * k, c - (dx * s - dz * co) * k]; };
  g.clearRect(0, 0, W, W);
  g.save();
  g.beginPath(); g.arc(c, c, R, 0, TAU); g.clip();
  g.fillStyle = 'rgba(9, 10, 14, 0.62)'; g.fillRect(0, 0, W, W);
  g.lineWidth = 2.2 * d; g.lineCap = 'round';
  for (const dist of districts) {
    g.strokeStyle = rgba(dist.lane.color, 0.5);
    g.beginPath();
    dist.road.forEach((pt, i) => { const [x, y] = tx(pt.x, pt.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    const [x, y] = tx(dist.x, dist.z);
    g.fillStyle = rgba(dist.lane.color, 0.16); g.strokeStyle = rgba(dist.lane.color, 0.6); g.lineWidth = 1 * d;
    g.beginPath(); g.arc(x, y, dist.r * k, 0, TAU); g.fill(); g.stroke();
    g.lineWidth = 2.2 * d;
  }
  const [hx, hy] = tx(0, 0);
  g.strokeStyle = 'rgba(243, 241, 238, 0.5)'; g.lineWidth = 1 * d;
  g.beginPath(); g.arc(hx, hy, HUB.r * k, 0, TAU); g.stroke();
  for (const m of monoliths) {
    const [x, y] = tx(m.x, m.z), r = (m.hero ? 3.6 : 2.7) * d;
    g.beginPath(); g.arc(x, y, r, 0, TAU);
    if (m.found) { g.fillStyle = m.lane.color; g.fill(); }
    else { g.fillStyle = 'rgba(9, 10, 14, 0.9)'; g.fill(); g.strokeStyle = m.lane.color; g.lineWidth = 1.2 * d; g.stroke(); }
  }
  if (goal) {
    const [x, y] = tx(goal.x, goal.z), pulse = 5 + (game.time * 1.6 % 1) * 7;
    g.strokeStyle = rgba(ACCENT, 1 - (game.time * 1.6 % 1)); g.lineWidth = 1.5 * d;
    g.beginPath(); g.arc(x, y, pulse * d, 0, TAU); g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(243, 241, 238, 0.4)'; g.lineWidth = 1 * d;
  g.beginPath(); g.arc(c, c, R, 0, TAU); g.stroke();
  // Rim: north, and any district that is off the scope.
  g.font = `500 ${10 * d}px "Geist Mono Variable", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const rim = (bearing, text, color) => {
    const a = angDiff(player.yaw, bearing), x = c + Math.sin(a) * (R - 9 * d), y = c - Math.cos(a) * (R - 9 * d);
    g.fillStyle = 'rgba(9, 10, 14, 0.85)'; g.beginPath(); g.arc(x, y, 7 * d, 0, TAU); g.fill();
    g.fillStyle = color; g.fillText(text, x, y + 0.5 * d);
  };
  for (const dist of districts) if (Math.hypot(dist.x - px, dist.z - pz) > range - dist.r * 0.4) rim(Math.atan2(dist.x - px, pz - dist.z), dist.lane.bus, dist.lane.color);
  rim(0, 'N', '#f3f1ee');
  g.fillStyle = '#f3f1ee';
  g.beginPath(); g.moveTo(c, c - 7 * d); g.lineTo(c + 5 * d, c + 6 * d); g.lineTo(c, c + 3 * d); g.lineTo(c - 5 * d, c + 6 * d); g.closePath(); g.fill();
}

let mapHover = null;
const mapItems = [];
function mapScale() { return (Math.min(mapCanvas.width, mapCanvas.height) / 2 - 12 * cssDpr()) / (EDGE_R + 24); }
function drawMap() {
  fitCanvas(mapCanvas);
  const W = mapCanvas.width, H = mapCanvas.height;
  if (!W || !H) return;
  const g = mctx, d = cssDpr(), cx = W / 2, cy = H / 2, k = mapScale();
  const tx = (wx, wz) => [cx + wx * k, cy + wz * k];
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(243, 241, 238, 0.16)'; g.lineWidth = 1 * d; g.setLineDash([4 * d, 6 * d]);
  g.beginPath(); g.arc(cx, cy, EDGE_R * k, 0, TAU); g.stroke(); g.setLineDash([]);
  mapItems.length = 0;
  g.lineCap = 'round';
  for (const dist of districts) {
    g.strokeStyle = rgba(dist.lane.color, 0.55); g.lineWidth = 3 * d;
    g.beginPath();
    dist.road.forEach((pt, i) => { const [x, y] = tx(pt.x, pt.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    const [x, y] = tx(dist.x, dist.z), hot = mapHover && mapHover.d === dist;
    g.fillStyle = rgba(dist.lane.color, hot ? 0.3 : 0.14); g.strokeStyle = rgba(dist.lane.color, 0.8); g.lineWidth = (hot ? 2 : 1) * d;
    g.beginPath(); g.arc(x, y, dist.r * k, 0, TAU); g.fill(); g.stroke();
    mapItems.push({ x, y, r: dist.r * k, d: dist });
    // Label outside the plaza, on the far side from the hub.
    // Two lines of label: push it clear of the plaza when it sits above one.
    const lx = x + dist.dx * (dist.r * k + 16 * d), ly = y + dist.dz * (dist.r * k + 16 * d) - (dist.dz < -0.3 ? 14 * d : 0);
    // A narrow map has no room for names beside the outer plazas: the letter alone, the names are in the list below.
    const compact = W / d < 620;
    g.textAlign = compact ? 'center' : dist.dx > 0.3 ? 'left' : dist.dx < -0.3 ? 'right' : 'center'; g.textBaseline = 'middle';
    g.font = `900 ${22 * d}px "Big Shoulders Display Variable", sans-serif`; g.fillStyle = dist.lane.color;
    g.fillText(compact ? dist.lane.bus : `${dist.lane.bus}  ${dist.lane.name.toUpperCase()}`, lx, ly);
    g.font = `500 ${11 * d}px "Geist Mono Variable", monospace`; g.fillStyle = '#a5a1b2';
    g.fillText(`${laneFound(dist.lane)} / ${dist.lane.tracks.length} LIT`, lx, ly + 17 * d);
  }
  const [hx, hy] = tx(0, 0);
  g.strokeStyle = 'rgba(243, 241, 238, 0.6)'; g.lineWidth = 1.2 * d;
  g.beginPath(); g.arc(hx, hy, HUB.r * k, 0, TAU); g.stroke();
  g.font = `500 ${10 * d}px "Geist Mono Variable", monospace`; g.fillStyle = '#d6d2dc'; g.textAlign = 'center';
  g.fillText('HUB', hx, hy + HUB.r * k + 11 * d);
  for (const m of monoliths) {
    const [x, y] = tx(m.x, m.z), hot = mapHover && mapHover.m === m, r = (hot ? 6.5 : m.hero ? 5 : 4) * d;
    g.beginPath(); g.arc(x, y, r, 0, TAU);
    if (m.found) { g.fillStyle = m.lane.color; g.fill(); }
    else { g.fillStyle = '#0b0c10'; g.fill(); g.strokeStyle = m.lane.color; g.lineWidth = 1.4 * d; g.stroke(); }
    mapItems.push({ x, y, r: 10 * d, m });
  }
  // You.
  const [px, py] = tx(player.pos.x, player.pos.z);
  g.save(); g.translate(px, py); g.rotate(player.yaw);
  g.fillStyle = ACCENT; g.strokeStyle = '#08090b'; g.lineWidth = 1.5 * d;
  g.beginPath(); g.moveTo(0, -10 * d); g.lineTo(7 * d, 8 * d); g.lineTo(0, 4 * d); g.lineTo(-7 * d, 8 * d); g.closePath(); g.fill(); g.stroke();
  g.restore();
  if (mapHover && mapHover.m) {
    const [x, y] = tx(mapHover.m.x, mapHover.m.z), text = mapHover.m.r.title;
    g.font = `600 ${13 * d}px "Instrument Sans Variable", sans-serif`;
    const tw = g.measureText(text).width, bx = clamp(x - tw / 2 - 9 * d, 4 * d, W - tw - 22 * d), by = y - 34 * d;
    g.fillStyle = 'rgba(9, 10, 14, 0.94)'; g.fillRect(bx, by, tw + 18 * d, 24 * d);
    g.strokeStyle = mapHover.m.lane.color; g.lineWidth = 1 * d; g.strokeRect(bx, by, tw + 18 * d, 24 * d);
    g.fillStyle = '#f3f1ee'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, bx + 9 * d, by + 12.5 * d);
  }
}
function mapPick(e) {
  const r = mapCanvas.getBoundingClientRect(), d = cssDpr(), x = (e.clientX - r.left) * d, y = (e.clientY - r.top) * d;
  let best = null, bd = 1e9;
  for (const it of mapItems) {           // beacons first: they sit on top of their plaza
    const dist = Math.hypot(it.x - x, it.y - y);
    if (it.m && dist < it.r && dist < bd) { bd = dist; best = it; }
  }
  if (!best) for (const it of mapItems) if (it.d && Math.hypot(it.x - x, it.y - y) < it.r) best = it;
  return best;
}
mapCanvas.addEventListener('pointermove', (e) => { const hit = mapPick(e); if (hit !== mapHover && (hit || mapHover)) { mapHover = hit; mapCanvas.style.cursor = hit ? 'pointer' : 'crosshair'; drawMap(); } });
mapCanvas.addEventListener('pointerleave', () => { if (mapHover) { mapHover = null; drawMap(); } });
mapCanvas.addEventListener('click', (e) => { const hit = mapPick(e); if (!hit) return; if (hit.m) goToRelease(hit.m.r.slug, false); else goToDistrict(hit.d); });
{
  const side = $('map-side');
  const add = (letter, name, meta, color, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'travel';
    if (color) b.style.setProperty('--c', color);
    b.innerHTML = `<b>${letter}</b><span>${esc(name)}</span><small></small>`;
    b.addEventListener('click', fn);
    side.appendChild(b);
    return b.querySelector('small');
  };
  add('◆', 'The hub', '', null, goToHub);
  for (const d of districts) d.mapCount = add(d.lane.bus, d.lane.name, '', d.lane.color, () => goToDistrict(d));
}

function openSheet(name) {
  if (name === 'pause') $('pause-sub').textContent = `${save.found.size} of ${TOTAL} beacons lit. Progress is saved in this browser.`;
  if (name === 'tracks') refreshTrackList();
  setOverlay(name);
  if (name === 'map') { for (const d of districts) d.mapCount.textContent = `${laneFound(d.lane)}/${d.lane.tracks.length}`; mapHover = null; requestAnimationFrame(drawMap); }
  if (name === 'pause') pauseMenu.reset(0);
  sfx.blip(true);
}

// ---------- Menus ----------
function bindMenu(listEl, onAct) {
  const items = () => [...listEl.querySelectorAll('button:not([hidden])')];
  let sel = 0;
  const paint = () => items().forEach((b, i) => b.classList.toggle('sel', i === sel));
  const pick = (b) => { const i = items().indexOf(b); if (i >= 0 && i !== sel) { sel = i; paint(); } };
  listEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { pick(b); onAct(b.dataset.act, b); } });
  listEl.addEventListener('pointermove', (e) => { const b = e.target.closest('button'); if (b) pick(b); });
  listEl.addEventListener('focusin', (e) => { const b = e.target.closest('button'); if (b) pick(b); });
  return {
    // Focus follows the selection, so Enter (a native click on the focused button) and the red arrow always agree.
    move(d) { const list = items(), n = list.length; sel = (sel + d + n) % n; paint(); list[sel].focus({ preventScroll: true }); sfx.blip(false); },
    act() { const b = items()[sel]; if (b) onAct(b.dataset.act, b); },
    reset(i = 0) { sel = i; paint(); },
    owns(el) { return !!el && listEl.contains(el); },
    paint,
  };
}
function refreshSoundLabels() { $('menu-sound').textContent = $('pause-sound').textContent = save.sound ? 'On' : 'Off'; }
function toggleSound() { sfx.setEnabled(!save.sound); refreshSoundLabels(); if (save.sound) sfx.blip(true); }
refreshSoundLabels();

function armReset(btn, small_, label) {      // a second press confirms; nothing is erased by one
  if (btn.dataset.armed) { delete btn.dataset.armed; return true; }
  btn.dataset.armed = '1';
  small_.textContent = `Press again to erase ${save.found.size} lit beacon${save.found.size === 1 ? '' : 's'}`;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; small_.textContent = label; } }, 4000);
  return false;
}
const startBtn = $('menu').querySelector('[data-act="start"]');
const titleMenu = bindMenu($('menu'), (act, btn) => {
  sfx.resume();
  if (act === 'continue') startGame();
  else if (act === 'start') {
    if (save.found.size) { if (!armReset(btn, btn.querySelector('small'), '')) return; resetProgress(); }
    startGame();
  } else if (act === 'tracks') openSheet('tracks');
  else if (act === 'sound') toggleSound();
});
const pauseMenu = bindMenu($('pause-menu'), (act, btn) => {
  if (act === 'resume') setOverlay(null);
  else if (act === 'map') openSheet('map');
  else if (act === 'tracks') openSheet('tracks');
  else if (act === 'sound') toggleSound();
  else if (act === 'hub') goToHub();
  else if (act === 'reset') {
    if (!save.found.size) { setOverlay(null); goToHub(); return; }
    if (!armReset(btn, $('pause-reset'), '')) return;
    resetProgress(); $('pause-reset').textContent = ''; goToHub();
  }
});
function refreshTitleMenu() {
  const has = save.found.size > 0;
  const cont = $('menu').querySelector('[data-act="continue"]');
  cont.hidden = !has;
  $('menu-progress').textContent = has ? `${save.found.size} / ${TOTAL} lit` : '';
  startBtn.innerHTML = has ? 'New game <small></small>' : 'Start';
  titleMenu.reset(0);
}

function startGame(quiet = false) {
  if (game.mode === 'play') return;
  sfx.resume();
  game.mode = 'play'; game.started = true;
  titleEl.classList.add('off'); titleEl.setAttribute('inert', '');
  hud.hidden = false;
  requestAnimationFrame(() => { hud.classList.remove('off'); sizeHud(); });
  cam.mode = 'chase'; cam.ease = 0;
  findGoal(); updateProximity();
  canvasEl.focus({ preventScroll: true });
  if (!quiet && save.found.size < TOTAL) {
    banner(save.found.size ? 'Welcome back' : 'Objective', `Light all ${TOTAL} beacons`, save.found.size ? `${TOTAL - save.found.size} still dark. Follow the diamond on the compass.` : 'Drive up to a monolith to light it. The premiere is straight ahead.', ACCENT, 4.2);
  }
}

// ---------- Input ----------
const keys = new Set();
const KEYMAP = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], boost: ['ShiftLeft', 'ShiftRight'], drift: ['Space'] };
const DRIVE_KEYS = new Set(Object.values(KEYMAP).flat());
const held = (list) => list.some((c) => keys.has(c));
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target instanceof Element && !!e.target.closest('button, a');
  const up = e.code === 'ArrowUp' || e.code === 'KeyW', down = e.code === 'ArrowDown' || e.code === 'KeyS', go = e.code === 'Enter' || e.code === 'Space';

  if (game.overlay) {
    if (e.code === 'Escape' || (e.code === 'KeyM' && game.overlay === 'map') || (e.code === 'KeyL' && game.overlay === 'tracks') || (e.code === 'KeyP' && game.overlay === 'pause')) { e.preventDefault(); setOverlay(null); sfx.blip(false); return; }
    if (game.overlay === 'pause') {
      if (up || down) { e.preventDefault(); pauseMenu.move(up ? -1 : 1); }
      else if (go && !pauseMenu.owns(document.activeElement) && !onButton) { e.preventDefault(); pauseMenu.act(); }
    } else if (game.overlay === 'panel' && panelItem && panelItem.kind === 'release') {
      if (e.code === 'ArrowLeft') stepRelease(-1); else if (e.code === 'ArrowRight') stepRelease(1);
    }
    return;
  }
  if (game.mode === 'title') {
    if (up || down) { e.preventDefault(); titleMenu.move(up ? -1 : 1); }
    else if (go && !onButton) { e.preventDefault(); titleMenu.act(); }
    return;
  }
  if (game.mode !== 'play') return;
  if (DRIVE_KEYS.has(e.code)) { keys.add(e.code); e.preventDefault(); return; }
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE': interact(); break;
    case 'Enter': if (!onButton) interact(); break;
    case 'KeyM': openSheet('map'); break;
    case 'KeyL': openSheet('tracks'); break;
    case 'Escape': case 'KeyP': openSheet('pause'); break;
    case 'KeyR': if (!game.traveling) resetToRoad(); break;
    case 'KeyN': toggleSound(); banner('Sound', save.sound ? 'On' : 'Off', '', '#d6d2dc', 1.4); break;
    default: break;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));

// Touch: a stick for the left thumb, two holds for the right.
const stick = { id: -1, x: 0, y: 0 };
const pads = { boost: false, drift: false };
const stickEl = $('stick'), nubEl = $('stick-nub'), padEls = { boost: $('pad-boost'), drift: $('pad-drift') };
function moveStick(e) {
  const r = stickEl.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  stick.x = dx; stick.y = dy;
  const reach = r.width * 0.29;      // how far the nub travels inside the ring
  nubEl.style.transform = `translate(${(dx * reach).toFixed(1)}px, ${(dy * reach).toFixed(1)}px)`;
}
function dropStick() { stick.id = -1; stick.x = stick.y = 0; nubEl.style.transform = ''; }
function setPad(key, on) { pads[key] = on; padEls[key].classList.toggle('on', on); }
// A finger can leave without a pointerup: the system takes the gesture, the capture is lost.
const ENDS = ['pointerup', 'pointercancel', 'lostpointercapture'];
stickEl.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); sfx.resume(); e.preventDefault(); });
stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
for (const type of ENDS) stickEl.addEventListener(type, (e) => { if (e.pointerId === stick.id) dropStick(); });
for (const key of ['boost', 'drift']) {
  const b = padEls[key];
  let finger = -1;
  b.addEventListener('pointerdown', (e) => { finger = e.pointerId; setPad(key, true); b.setPointerCapture(e.pointerId); sfx.resume(); e.preventDefault(); });
  for (const type of ENDS) b.addEventListener(type, (e) => { if (e.pointerId === finger) { finger = -1; setPad(key, false); } });
}
// The first real touch turns the touch controls on where the main pointer is not a finger.
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && useTouch()) sizeHud(); }, { capture: true, passive: true });

// Everything held is let go when the window loses focus, the tab is hidden or a menu opens.
// Otherwise a key or a thumb that was down at that moment would still be driving afterwards.
function releaseAll() { keys.clear(); dropStick(); setPad('boost', false); setPad('drift', false); }
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', releaseAll);
addEventListener('pagehide', releaseAll);

// Controller: left stick steers, right trigger drives, A opens, X or RB boosts, B drifts and backs out.
const padPrev = [];
const dead = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
function readGamepad(out) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of list) if (g && g.connected && g.buttons.length >= 10) { gp = g; break; }
  if (!gp) return;
  const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), val = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
  const edge = (i) => { const now = btn(i), was = padPrev[i]; padPrev[i] = now; return now && !was; };
  out.steer += dead(gp.axes[0] || 0) + (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
  const trig = val(7) - val(6);
  out.throttle += Math.abs(trig) > 0.05 ? trig : -dead(gp.axes[1] || 0);
  out.boost = out.boost || btn(2) || btn(5);
  out.drift = out.drift || btn(1) || btn(4);
  const a = edge(0), b = edge(1), startB = edge(9), y = edge(3), dUp = edge(12), dDown = edge(13);
  if (game.overlay) {
    if (b || startB) setOverlay(null);
    else if (game.overlay === 'pause') { if (dUp) pauseMenu.move(-1); if (dDown) pauseMenu.move(1); if (a) pauseMenu.act(); }
  } else if (game.mode === 'title') {
    if (dUp) titleMenu.move(-1); if (dDown) titleMenu.move(1); if (a || startB) titleMenu.act();
  } else if (game.mode === 'play') {
    if (a) interact(); if (startB) openSheet('pause'); if (y) openSheet('map');
  }
}
const scratch = { throttle: 0, steer: 0, boost: false, drift: false };
function readInput() {
  scratch.throttle = (held(KEYMAP.forward) ? 1 : 0) - (held(KEYMAP.back) ? 1 : 0);
  scratch.steer = (held(KEYMAP.right) ? 1 : 0) - (held(KEYMAP.left) ? 1 : 0);
  scratch.boost = held(KEYMAP.boost) || pads.boost; scratch.drift = held(KEYMAP.drift) || pads.drift;
  if (stick.id >= 0) {
    const len = Math.hypot(stick.x, stick.y);
    scratch.steer += stick.x;
    // One thumb cannot hold a throttle and steer: any push drives forward, a pull straight back reverses.
    if (len > 0.22) scratch.throttle += stick.y > 0.55 ? -1 : Math.min(1, len * 1.15);
  }
  if (pads.boost && scratch.throttle === 0) scratch.throttle = 1;
  readGamepad(scratch);
  input.throttle = clamp(scratch.throttle, -1, 1); input.steer = clamp(scratch.steer, -1, 1);
  input.boost = scratch.boost; input.drift = scratch.drift;
}

// ---------- Buttons ----------
function stepRelease(dir) {
  if (!panelItem || panelItem.kind !== 'release' || game.traveling) return;
  const lane = panelItem.m.lane, i = lane.tracks.indexOf(panelItem.m.r) + dir;
  if (i < 0 || i >= lane.tracks.length) return;
  goToRelease(lane.tracks[i].slug, true);
}
$('p-prev').addEventListener('click', () => stepRelease(-1));
$('p-next').addEventListener('click', () => stepRelease(1));
$('p-close').addEventListener('click', () => setOverlay(null));
$('tracks-close').addEventListener('click', () => setOverlay(null));
$('map-close').addEventListener('click', () => setOverlay(null));
$('t-map').addEventListener('click', () => openSheet('map'));
$('t-tracks').addEventListener('click', () => openSheet('tracks'));
$('t-pause').addEventListener('click', () => openSheet('pause'));
promptEl.addEventListener('click', interact);
// The rows are real links to the release pages. A plain click travels there in the world
// instead; a modified click (new tab, new window) is left to the browser.
$('tl-lanes').addEventListener('click', (e) => {
  const row = e.target.closest('.tl-row');
  if (!row || !row.dataset.slug || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  goToRelease(row.dataset.slug, true);
});

// ---------- Player: SoundCloud's own widget, docked, created only when someone presses play ----------
// Nothing is requested from SoundCloud until then, and no audio is ever served from this site.
const SC_ORIGIN = 'https://w.soundcloud.com';
const dock = $('dock'), dockFrame = $('dock-frame');
let dockSlug = null;
function playRelease(r) {
  if (!r || !Number.isInteger(r.scId)) return;
  const frame = document.createElement('iframe');
  frame.title = `${r.title} by Chris Gwim on SoundCloud`;
  frame.allow = 'autoplay';
  // The widget may run its scripts and open soundcloud.com in a new tab. It may not navigate this page.
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = `${SC_ORIGIN}/player/?url=${encodeURIComponent(`https://api.soundcloud.com/tracks/${r.scId}`)}&color=%23${DATA.accent}` +
    '&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=true';
  dockFrame.replaceChildren(frame);
  dockSlug = r.slug;
  $('dock-title').textContent = r.title;
  dock.style.setProperty('--c', laneOf.get(r.slug).color);
  dock.classList.remove('paused');
  dock.hidden = false;
  sfx.duck(true);
}
function closePlayer() {
  dockFrame.replaceChildren();       // removing the frame is what stops the music
  dock.hidden = true; dockSlug = null;
  sfx.duck(false);
}
// The widget reports ready, play, pause and finish as JSON strings over postMessage (the wire
// format its own api.js speaks). Accepted only from the docked frame, only from SoundCloud's
// origin, and only the method name is read.
addEventListener('message', (e) => {
  const frame = dockFrame.firstElementChild;
  if (e.origin !== SC_ORIGIN || !frame || e.source !== frame.contentWindow || typeof e.data !== 'string') return;
  let msg;
  try { msg = JSON.parse(e.data); } catch (err) { return; }
  if (!msg || typeof msg.method !== 'string') return;
  if (msg.method === 'ready') for (const name of ['play', 'pause', 'finish']) frame.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: name }), SC_ORIGIN);
  else if (msg.method === 'play') { dock.classList.remove('paused'); sfx.duck(true); }
  else if (msg.method === 'pause' || msg.method === 'finish') { dock.classList.add('paused'); sfx.duck(false); }
});
$('dock-close').addEventListener('click', closePlayer);
$('dock-title').addEventListener('click', () => { if (dockSlug && game.mode === 'play' && !game.traveling) goToRelease(dockSlug, true); });
$('panel-body').addEventListener('click', (e) => {
  const button = e.target.closest('[data-play]');
  if (!button) return;
  playRelease(bySlug.get(button.dataset.play));
  setOverlay(null);       // back to the world, with the music
});
canvasEl.addEventListener('pointerdown', () => { sfx.resume(); if (game.mode === 'play') canvasEl.focus({ preventScroll: true }); });
