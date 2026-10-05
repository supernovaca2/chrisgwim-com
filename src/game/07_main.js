
// ---------- HUD per frame ----------
const speedEl = $('g-speed'), boostEl = $('g-boost'), rushEl = $('rush'), keysEl = $('g-keys');
let hudClock = 0, frameNo = 0, rush = 0, lastSpeed = -1, keysGone = false;
function sizeHud() { fitCanvas(radar); compassW = compassEl.getBoundingClientRect().width; }
function updateHud(dt) {
  frameNo++;
  if (game.mode !== 'play') return;
  const mph = Math.round(player.speed * 2.237);
  if (mph !== lastSpeed) { speedEl.textContent = String(mph); lastSpeed = mph; }
  boostEl.style.transform = `scaleX(${player.boost.toFixed(3)})`;
  rush = damp(rush, player.boosting && !reduced ? 1 : 0, 6, dt);
  rushEl.style.opacity = rush.toFixed(2);
  updateCompass();
  if (frameNo % 2 === 0) drawRadar();
  hudClock -= dt;
  if (hudClock <= 0) { hudClock = 0.25; findGoal(); }
  if (!keysGone && player.moved > 120) { keysGone = true; keysEl.classList.add('gone'); }
}

// A hidden tab reports a zero-size window; never size the buffers to that.
let lastW = 0, lastH = 0;
function syncSize() {
  const w = innerWidth, h = innerHeight;
  if (w < 64 || h < 64 || (w === lastW && h === lastH)) return;
  lastW = w; lastH = h;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); composer.setSize(w, h);
  sizeHud();
  if (game.overlay === 'map') drawMap();
}

// ---------- Loop: simulate in fixed slices, then draw ----------
const IDLE = { throttle: 0, steer: 0, boost: false, drift: false };
function tick(dt, forced) {
  game.time += dt;
  const held_ = forced || (import.meta.env.DEV ? window.__owHold : undefined);        // tests can hold the controls
  if (held_) Object.assign(input, IDLE, held_); else readInput();
  const simulating = game.mode === 'play' && !game.overlay && !game.traveling;
  if (simulating) {
    let left = dt;
    while (left > 1e-6) { const h = Math.min(left, 1 / 120); stepPlayer(h); left -= h; }
    updateProximity();
  }
  updateWorld(dt);
  updatePlayerFx(dt, simulating);
  updateCamera(dt);
  updateHud(dt);
  sfx.drive(player.speed, player.boosting, simulating);
}
// A slow GPU gets fewer pixels, not fewer frames: after a sustained run of long frames the
// drawing resolution steps down, at most three times, and never back up mid-session.
let slowFor = 0, dprNow = DPR;
function adaptResolution(raw) {
  if (raw > 0.25 || game.overlay || game.mode === 'boot') return;      // a tab switch, a pause: not a slow GPU
  slowFor = raw > 0.024 ? slowFor + raw : Math.max(0, slowFor - raw * 0.5);
  if (slowFor < 2.5 || dprNow <= 0.8) return;
  slowFor = 0;
  dprNow = Math.max(0.75, dprNow * 0.8);
  renderer.setPixelRatio(dprNow); composer.setPixelRatio(dprNow);
  starU.uPx.value = dprNow;
}
let lastNow = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  syncSize();
  adaptResolution((now - lastNow) / 1000);
  const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  tick(dt);
  composer.render();
}

// ---------- Boot ----------
placePlayer(SPAWN.x, SPAWN.z, SPAWN.yaw);
syncSize();
function ready() {
  if (game.mode !== 'boot') return;
  game.mode = 'title';
  $('load').hidden = true; $('menu').hidden = false;
  refreshTitleMenu();
  // A bare #token deep-links: #play, #map, #tracks, #lane-b, or a release slug.
  let h = '';
  try { h = decodeURIComponent(location.hash.slice(1)); } catch (err) { h = ''; }
  const lane = /^lane-([a-z])$/.exec(h);
  if (h === 'play') startGame();
  else if (h === 'tracks') openSheet('tracks');
  else if (h === 'map') { startGame(true); openSheet('map'); }
  else if (lane) {
    const d = districts.find((x) => x.lane.bus.toLowerCase() === lane[1]);
    if (d) { startGame(true); placePlayer(d.x - d.dx * (d.r + 8), d.z - d.dz * (d.r + 8), d.bearing); cam.ease = 1; cam.snap = true; }
  } else if (bySlug.has(h)) {
    const m = monoliths.find((x) => x.r.slug === h && !x.hero) || monolithsOf(h)[0];
    startGame(true);
    placePlayer(...frontOf(m));
    updateProximity();
    openItem(interactables.find((it) => it.m === m));
    cam.snap = true;
  }
}
manager.onProgress = (url, loaded, total) => { $('load-bar').style.transform = `scaleX(${(loaded / total).toFixed(3)})`; };
manager.onLoad = ready;
manager.onError = () => {};
setTimeout(ready, 9000);
requestAnimationFrame(frame);

// A handle for testing the simulation without a screen or a keyboard. Development builds only.
if (import.meta.env.DEV) window.__ow = {
  game, player, input, cam, save, monoliths, districts, interactables, colliders,
  startGame, goToRelease, goToDistrict, goToHub, discover, openItem, setOverlay, openSheet, placePlayer, resetProgress, heightAt,
  advance(seconds, forced = {}) {
    syncSize();
    const steps = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < steps; i++) tick(1 / 60, forced);
    composer.render();
    return { x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2), yaw: +player.yaw.toFixed(3), speed: +player.speed.toFixed(2), alt: +player.alt.toFixed(2), found: save.found.size };
  },
};
