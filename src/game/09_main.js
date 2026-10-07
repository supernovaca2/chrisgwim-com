// ===== part 9: drawing each frame, the camera, the loop, resize, adaptive resolution, boot, deep links, test hooks =====
const _shotQ = new THREE.Quaternion(), _e = new THREE.Euler();
function renderWorld(dt) {
  const t = G.time;
  // invaders (the techno drop strobes them)
  invVox = 0;
  const strobe = F.strobe > 0 ? Math.floor(F.strobe * 18) % 2 === 0 : false;
  for (const inv of invaders) {
    if (!inv.alive) continue;
    if (strobe && inv.state === 'form' && (inv.slot.col + inv.slot.row) % 2 === 0) continue;
    if (inv.carrier) inv.glow = 1.2 + 0.6 * Math.sin(t * 8);
    drawInvader(inv);
    pool(inv.x, inv.z, inv.type === 'brute' ? 6.5 : 5, inv.color, inv.carrier ? 0.55 : 0.28);
  }
  finishVoxels(invMesh, invVox);
  // the cannon
  const lc = waveColor();
  const blink = player.inv > 0 && G.mode === 'play' && Math.floor(t * 14) % 2 === 0;
  playerGroup.visible = player.alive && !blink;
  playerGroup.position.set(player.x, 0, player.recoil * 0.3);
  playerGroup.rotation.z = player.tilt;
  paintPlayer(lc, player.flash);
  const sk = shieldMesh.material.uniforms.uK;
  sk.value = damp(sk.value, player.shield > 0 ? (player.shield < 2 && Math.floor(t * 10) % 2 ? 0.3 : 1) : 0, 10, dt);
  shieldMesh.visible = sk.value > 0.01;
  for (const e of engines) { const s = 1.1 + Math.sin(t * 40 + e.position.x) * 0.15 + Math.abs(player.vx) * 0.015; e.scale.set(s, s, 1); }
  engineMat.color.copy(lc).lerp(WHITE, 0.4).multiplyScalar(2);
  muzzle.material.opacity = Math.max(0, muzzle.material.opacity - dt * 14);
  if (player.alive) {
    pool(player.x, 0.4, 7, lc, 0.45);
    addLight(player.x, 0.5, 6, 0.7 + player.recoil * 0.6, lc);
  }
  // shots
  const shotCol = _col.copy(lc).lerp(WHITE, 0.45).multiplyScalar(3.2);
  shots.forEach((s, i) => {
    _e.set(0, Math.atan2(-s.vx, SHOT_SPEED), 0); _shotQ.setFromEuler(_e);
    _m4.compose(_v.set(s.x, flyY(s.z), s.z), _shotQ, _s.set(1, 1, s.pierce ? 1.8 : 1));
    shotMesh.setMatrixAt(i, _m4); shotMesh.setColorAt(i, s.pierce ? POWERS.pierce.color.clone().multiplyScalar(3) : shotCol);
    if (i < 4) addLight(s.x, s.z, 3.2, 0.9, lc);
  });
  shotMesh.count = shots.length;
  shotMesh.instanceMatrix.needsUpdate = true; if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;
  // bombs
  bombs.forEach((b, i) => {
    const col = b.kind === 'confetti' ? b.col : BOMB_COL[b.kind];
    const y = b.y != null ? b.y : flyY(b.z);
    _e.set(t * 7 + i, t * 11, b.kind === 'zig' ? Math.sin(t * 30) * 0.6 : t * 5); _shotQ.setFromEuler(_e);
    const sc = b.kind === 'bass' ? 1.3 : b.kind === 'orb' ? 0.75 : b.kind === 'confetti' ? 0.6 : 0.58;
    _m4.compose(_v.set(b.x, y, b.z), _shotQ, b.kind === 'zig' ? _s.set(sc, sc, sc * 2.4) : _s.set(sc, sc, sc));
    bombMesh.setMatrixAt(i, _m4); bombMesh.setColorAt(i, _col2.copy(col).multiplyScalar(2.6));
    if (dt > 0 && Math.random() < 0.6) spark(b.x, y, b.z - 0.5, (Math.random() - 0.5) * 1.5, 0.4, -4, col, b.kind === 'bass' ? 1.1 : 0.6, 0.3, 0, 1.7);
    if (b.z > -26) addLight(b.x, b.z, b.kind === 'bass' ? 5 : 2.4, b.kind === 'bass' ? 1.2 : 0.55, col);
    if (b.kind === 'bass') { pool(b.target, b.tz, 17 + Math.sin(t * 12) * 1.5, col, 0.5); }
  });
  bombMesh.count = bombs.length;
  bombMesh.instanceMatrix.needsUpdate = true; if (bombMesh.instanceColor) bombMesh.instanceColor.needsUpdate = true;
  // blasts light the grid for a moment
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    addLight(f.x, f.z, f.r, f.k, f.color);
    f.k *= Math.exp(-f.decay * dt);
    if (f.k < 0.05) flashes.splice(i, 1);
  }
  updateDebris(dt);
  updateSparks(dt);
  updateRings(dt);
  updateBunkerHeat(dt);
  updatePopups(dt);
  // floor and sky
  floorU.uTime.value += dt; skyU.uTime.value += dt; starU.uTime.value += dt;
  floorU.uBeat.value = Math.max(0, floorU.uBeat.value - dt * 5);
  skyU.uBeat.value = Math.max(0, skyU.uBeat.value - dt * 3);
  floorU.uPlayerX.value = player.x;
  const danger = G.mode === 'play' && G.wave < FINALE && F.alive ? clamp((frontZ() - (Z_BUNKER - 6)) / (Z_INVADE - Z_BUNKER + 6), 0, 1) : 0;
  floorU.uDanger.value = damp(floorU.uDanger.value, danger, 4, dt);
  skyU.uNebB.value.setHSL((t * 0.01) % 1, 0.7, 0.18);
  flushLights();
  flushPools();
  // flash overlay
  flashK = Math.max(0, flashK - dt * 4);
  $('flash').style.opacity = flashK.toFixed(3);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
}

// ---------- Camera ----------
// Wide title screens: the attract formation is fitted into the clear region right of the logo
// column and above the side panels. The box it must fit is the formation's whole march range
// (the field's width at formation depth), so it never wanders under the logo. Measured from the
// DOM, so it follows the fonts, the layout and the window.
function frameTitle() {
  camera.clearViewOffset(); camera.zoom = 1; camera.updateProjectionMatrix();
  cam.framed = false;
  const W = viewW(), H = viewH();
  if (G.mode !== 'title' || W / H <= 1.25 || $('title').hidden) return;
  if (H < 560) { camera.setViewOffset(W, H, -W * 0.16, H * 0.05, W, H); cam.framed = true; return; }   // a phone on its side
  camera.position.copy(cam.base); camera.lookAt(cam.target); camera.updateMatrixWorld();
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const x of [-HW, HW]) for (const z of [-58, -24]) for (const dy of [-1.8, 1.8]) {
    _v.set(x, flyY(z) + dy, z).project(camera);
    const px = (_v.x + 1) / 2 * W, py = (1 - _v.y) / 2 * H;
    minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  const rightOf = (sel) => Math.max(0, ...[...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().right));
  const logoR = Math.max(rightOf('#title .logo-game span'), rightOf('#t-bars'), rightOf('#t-menu'), rightOf('#title .logo-by'));
  const side = document.querySelector('#title .t-side').getBoundingClientRect();
  const L = Math.max(logoR + 32, W / 3), R = W - 32, T = 72, B = (side.height > 0 ? side.top : H) - 16;
  if (R - L < 120 || B - T < 80) return;
  const k = Math.min(1, (R - L) / (maxX - minX), (B - T) / (maxY - minY));
  camera.zoom = k; camera.updateProjectionMatrix();
  const cx = W / 2 + ((minX + maxX) / 2 - W / 2) * k, cy = H / 2 + ((minY + maxY) / 2 - H / 2) * k;
  camera.setViewOffset(W, H, -((L + R) / 2 - cx), -((T + B) / 2 - cy), W, H);
  cam.framed = true;
  cam.titleBox = { L, R, T, B, k: +k.toFixed(3), logoR: Math.round(logoR) };
}
function updateCamera(dt) {
  cam.shake = Math.max(0, cam.shake - dt * 2.6);
  const t = G.time, sh = cam.shake * cam.shake;
  const title = G.mode === 'title';
  const sway = title ? (cam.framed ? 0 : Math.sin(t * 0.21) * 3) : player.x * 0.12;
  camera.position.copy(cam.base);
  camera.position.x += sway + Math.sin(t * 53) * sh * 0.9;
  camera.position.y += Math.sin(t * 61 + 1) * sh * 0.7 + (title ? Math.sin(t * 0.3) * (cam.framed ? 0.3 : 1.2) : 0);
  camera.position.z += Math.sin(t * 47 + 2) * sh * 0.5;
  camera.lookAt(cam.target.x + sway * 0.55, cam.target.y, cam.target.z);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
}

// ---------- Size, resolution ----------
let lastW = 0, lastH = 0, dprNow = DPR_CAP;
function syncSize() {
  const w = viewW(), h = viewH();
  if (w === lastW && h === lastH) return false;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  fitCamera();
  frameTitle();
  spkU.uScale.value = h * dprNow / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  return true;
}
// A slow GPU gets fewer pixels, not fewer frames. Each step down is a trial that is undone if
// frames do not get faster (a phone limited by its CPU only gets blurrier).
let slowFor = 0, frameAvg = 0, trial = null, settled = false;
function setResolution(dpr) {
  dprNow = dpr;
  renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr);
  composer.setSize(viewW(), viewH());
  spkU.uScale.value = viewH() * dpr / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
function adaptResolution(raw) {
  if (raw > 0.25 || G.overlay || G.mode === 'boot') return;
  frameAvg = frameAvg ? frameAvg + (raw - frameAvg) * 0.06 : raw;
  if (trial) {
    trial.time += raw;
    if (trial.time < 1.6) return;
    if (frameAvg > trial.before * 0.86) { setResolution(trial.from); settled = true; }
    trial = null; slowFor = 0;
    return;
  }
  if (settled) return;
  slowFor = raw > 0.022 ? slowFor + raw : Math.max(0, slowFor - raw * 0.5);
  if (slowFor < 2.5 || dprNow <= 0.7) return;
  trial = { before: frameAvg, from: dprNow, time: 0 };
  setResolution(Math.max(0.7, dprNow * 0.8));
}

// ---------- The loop ----------
renderer.info.autoReset = false;
let frameStats = { calls: 0, triangles: 0, points: 0 };
function tick(dt, forced, headless = false) {
  let sim = dt;
  if (G.hitstop > 0) { G.hitstop -= dt; sim = dt * 0.2; }
  if (G.mode === 'play' && !G.overlay) {
    if (!G.freeze) stepPlay(sim, forced || (G.auto ? (pollPad(), autopilot()) : readInput()));
    else if (!headless) pollPad();
  } else if (G.mode === 'title') {
    if (!headless) pollPad();
    if (!G.freeze) stepPlay(sim, autopilot());
  } else {
    if (!headless) pollPad();
    if (G.mode === 'results') { G.time += sim; audio.tick(sim); updateFormation(sim); updateRecords(sim); }
  }
  const visualDt = G.overlay === 'pause' || G.freeze ? 0 : sim;
  renderWorld(visualDt);
  updateCamera(visualDt || 0);
  updateHud();
  updateBanner(dt);
  updateUnlock(dt);
}
function render() {
  renderer.info.reset();
  composer.render();
  frameStats = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, points: renderer.info.render.points };
}
let lastNow = performance.now(), covered = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const resized = syncSize();
  const raw = (now - lastNow) / 1000;
  lastNow = now;
  adaptResolution(raw);
  const dt = Math.min(1 / 20, Math.max(0, raw));
  tick(dt, null);
  // Under a full-screen menu the field is a dim blur; once it has settled the last frame is held.
  covered = G.overlay && G.overlay !== 'results' ? covered + dt : 0;
  if (covered < 0.6 || resized) render();
}

// ---------- Boot ----------
syncSize();
toTitle();
// The cover (in the page's markup) comes down once the cover art and the fonts are in, so the
// title is never seen half-made. 2.5 seconds is the most it waits for them.
const bootBar = $('boot-bar');
const progress = (k) => { if (bootBar) bootBar.style.setProperty('--p', k.toFixed(2)); };
let booted = false;
function ready() {
  if (booted) return;
  booted = true;
  progress(1);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    body.classList.remove('booting');
    openFromHash();
  }));
}
progress(0.4);
Promise.race([Promise.all([coverPromise, document.fonts ? document.fonts.ready : Promise.resolve()]), new Promise((r) => setTimeout(r, 2500))]).then(ready);
if (document.fonts) document.fonts.ready.then(() => frameTitle());      // the logo's width changes when its font arrives
requestAnimationFrame(frame);

// ---------- Deep links ----------
// /#play skips the title, /#records opens the catalog. The Overworld links of old (#tracks,
// #map, a lane or a release) land on the title, except #tracks, which still means the list.
function openFromHash() {
  const h = location.hash.slice(1);
  if (h === 'play') act('play');
  else if (h === 'records' || h === 'tracks') act('records');
}

// ---------- Test hooks (development builds only; the production build has no handle) ----------
if (import.meta.env.DEV) {
  function state() {
    return {
      titleBox: cam.framed ? cam.titleBox : null,
      mode: G.mode, overlay: G.overlay, wave: G.wave, phase: G.phase, score: G.score, lives: G.lives, combo: G.combo,
      accuracy: { shots: G.waveShots, hitShots: G.waveShotHits, kills: G.waveHits },
      alive: F.alive, total: F.total, steps: G.steps, marchScheduled: audio.cond.marchScheduled, marchPending: audio.pendingMarch(),
      bpm: +audio.cond.bpm.toFixed(1), level: audio.cond.level, frontZ: +frontZ().toFixed(2),
      player: { x: +player.x.toFixed(2), alive: player.alive, power: player.power, shield: +player.shield.toFixed(1) },
      ship: ship.active ? { x: +ship.x.toFixed(1), release: ship.release.slug } : null,
      records: records.map((r) => ({ slug: r.release.slug, x: +r.x.toFixed(1), z: +r.z.toFixed(1) })),
      caught: G.caught.map((r) => r.slug), found: save.found.size,
      mothership: M.active || M.dead ? { active: M.active, broken: M.broken, coreOpen: M.coreOpen, coreHp: M.coreHp, dead: M.dead } : null,
      bunkers: bunkers.map((b) => b.left), bombs: bombs.length, shots: shots.length, powerups: powerups.map((p) => p.kind),
      debris: deb.alive, render: frameStats, dpr: dprNow, deaths: (G.deaths || []).slice(-12),
    };
  }
  function toInput(i) {
    if (i === 'auto') return autopilot();
    if (!i) return null;
    return { move: (i.move || 0) + (i.right ? 1 : 0) - (i.left ? 1 : 0), fire: !!i.fire, targetX: i.x != null ? i.x : null };
  }
  // Projects a field point to CSS pixels with the live camera (tests check framing with it).
  window.__proj = (x, y, z) => { _v.set(x, y, z).project(camera); return [(_v.x + 1) / 2 * viewW(), (1 - _v.y) / 2 * viewH()]; };
  window.__game = {
    G, F, M, player, audio, cam, renderer,
    data: { ship, records, invaders, bunkers, shots, bombs, powerups },     // raw state (ship() and records() below are actions)
    state,
    advance(seconds, input = null) {
      syncSize();
      audio.headless = true;
      const steps = Math.max(1, Math.round(seconds * 60));
      for (let i = 0; i < steps; i++) tick(1 / 60, toInput(input) || (input === null ? null : NO_INPUT), true);
      audio.headless = false;
      render();
      return state();
    },
    // Plays with the autopilot until a condition holds or the time runs out. Returns seconds used.
    autoUntil(cond, maxSeconds = 120) {
      audio.headless = true;
      let s = 0;
      for (; s < maxSeconds && !cond(state()); s += 1 / 60) tick(1 / 60, autopilot(), true);
      audio.headless = false;
      render();
      return +s.toFixed(2);
    },
    start(wave = 0) { startGame(wave); return state(); },
    wave(n) { if (G.mode !== 'play') startGame(n); else startWave(n); return state(); },
    skipIntro() { for (const inv of invaders) { inv.state = 'form'; inv.scale = 1; inv.x = inv.tx; inv.z = inv.tz; inv.y = flyY(inv.tz); } if (G.wave === FINALE) M.enter = 0; G.phase = 'fight'; G.phaseT = 0; return state(); },
    kill(n = 1) { const list = invaders.filter((i) => i.alive).sort((a, b) => b.z - a.z); for (let k = 0; k < n && k < list.length; k++) { list[k].hp = 1; hitInvader(list[k]); } return state(); },
    killAll() { for (const inv of invaders) if (inv.alive) { inv.hp = 1; hitInvader(inv); } return state(); },
    ship() { if (!ship.active) launchShip(); return state(); },
    shootShip() { if (ship.active) shootShip(); return state(); },
    catchAll() { for (const r of records.slice()) catchRecord(r); return state(); },
    unlock(slug) { const r = bySlug.get(slug) || PREMIERE; showUnlock(r, !save.found.has(r.slug)); return state(); },
    title() { toTitle(); return state(); },
    pause() { pauseGame(); return state(); },
    resume() { resumeGame(); return state(); },
    records() { openRecords(G.overlay === 'pause' ? 'pause' : G.mode === 'title' ? 'title' : 'results'); return state(); },
    how() { act('how'); return state(); },
    over() { G.lives = 0; endGame(false); return state(); },
    victory() { endGame(true); return state(); },
    freeze(on = true) { G.freeze = on; return state(); },
    auto(on = true) { G.auto = on; return state(); },
    seed(n) { reseed(n); return state(); },
    power(kind) { if (kind === 'shield') player.shield = POWERS.shield.time; else { player.power = kind; player.powerT = POWERS[kind].time; } return state(); },
    dropPower(kind) { dropPower(player.x, -20, kind); return state(); },
    breakPanels(n = 6) { for (const p of M.panels) { if (n <= 0) break; if (p.alive) { breakPanel(p); n--; } } return state(); },
    resetSave() { save.found.clear(); save.hi = 0; save.best = 0; persist(); return state(); },
    autopilot, readInput,
  };
}
