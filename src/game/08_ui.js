// ===== part 8: HUD, banners, the unlock card, screens, menus, input =====
const body = document.body;
const SCREENS = ['title', 'how', 'pause', 'records', 'results'];
function setLaneCss(color) { document.documentElement.style.setProperty('--lane', color); }
function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  menuFocus(id);
  frameTitle();
}

// ---------- HUD ----------
const hud = { score: -1, hi: -1, combo: -1, lives: -1, rec: '', power: '', bossK: -1 };
function updateHudStatic() {
  $('h-wave-n').textContent = G.wave >= FINALE ? 'FINAL' : `W${G.wave + 1}`;
  $('h-wave-l').textContent = waveName(G.wave);
  hud.lives = -1; hud.rec = '';
}
let beatFlip = false;
function hudBeat() {
  beatFlip = !beatFlip;
  $('h-wave').classList.toggle('beat', beatFlip);
  if (G.mode === 'title' && !$('title').hidden) {
    const bars = titleBars;
    bars.forEach((b, i) => { b.style.transform = `scaleY(${(0.35 + Math.random() * 0.65 * (i === (audio.cond.s >> 2) % 7 ? 1.6 : 1)).toFixed(2)})`; });
  }
}
function updateHud() {
  if (G.mode !== 'play') return;
  if (hud.score !== G.score) { hud.score = G.score; $('h-score').textContent = fmtScore(G.score); }
  if (hud.hi !== save.hi) { hud.hi = save.hi; $('h-hi').textContent = fmtScore(save.hi); }
  const mult = comboMult();
  if (hud.combo !== G.combo) {
    hud.combo = G.combo;
    const c = $('h-combo');
    c.textContent = `COMBO ${G.combo} · x${mult}`;
    c.classList.toggle('on', G.combo >= 3);
  }
  const lives = Math.max(0, G.lives - (player.alive ? 1 : 0));
  if (hud.lives !== lives) {
    hud.lives = lives;
    const box = $('h-lives'); box.textContent = '';
    for (let i = 0; i < Math.min(lives, 6); i++) box.append(el('i'));
  }
  const rec = `${save.found.size}/${RELEASES.length}`;
  if (hud.rec !== rec) { hud.rec = rec; $('h-rec').textContent = rec; }
  const pw = player.power ? player.power : player.shield > 0 ? 'shield' : '';
  const pwBox = $('h-power');
  if (pw) {
    const P = POWERS[pw], left = pw === 'shield' ? player.shield : player.powerT;
    if (hud.power !== pw) { hud.power = pw; $('h-power-n').textContent = P.name; pwBox.style.color = P.css; }
    $('h-power-b').style.transform = `scaleX(${clamp(left / P.time, 0, 1).toFixed(3)})`;
    pwBox.hidden = false;
  } else if (!pwBox.hidden) { pwBox.hidden = true; hud.power = ''; }
  const boss = $('h-boss');
  if (G.wave === FINALE && M.active && G.phase !== 'intro') {
    boss.hidden = false;
    const k = M.coreOpen ? M.coreHp / M.coreMax : 1 - Math.min(1, M.broken / 6);
    if (Math.abs(k - hud.bossK) > 0.002) { hud.bossK = k; $('h-boss-b').style.transform = `scaleX(${k.toFixed(3)})`; $('h-boss-n').textContent = M.coreOpen ? 'MOTHERSHIP · CORE EXPOSED' : `MOTHERSHIP · PANELS ${Math.min(M.broken, 6)}/6`; }
  } else boss.hidden = true;
}

// ---------- Banner ----------
let bannerT = 0;
function showBanner(small, big, line = '', secs = 2.6, extra = '') {
  const b = $('banner');
  $('bn-s').textContent = small; $('bn-t').textContent = big; $('bn-b').textContent = line; $('bn-x').textContent = extra;
  b.hidden = false; b.className = ''; void b.offsetWidth; b.className = 'show';
  bannerT = secs;
}
function updateBanner(dt) {
  if (bannerT <= 0) return;
  bannerT -= dt;
  const b = $('banner');
  if (bannerT <= 0.35 && b.className === 'show') b.className = 'hide';
  if (bannerT <= 0) b.hidden = true;
}

// ---------- The unlock card: shown without stopping the game ----------
const unlockQ = [];
let unlockT = 0;
function showUnlock(r, fresh) {
  unlockQ.push([r, fresh]);
  if (unlockT <= 0) nextUnlock();
}
function nextUnlock() {
  const item = unlockQ.shift();
  const card = $('unlock');
  if (!item) { card.className = 'hide'; setTimeout(() => { if (unlockT <= 0) card.hidden = true; }, 400); return; }
  const [r, fresh] = item, lane = LANES[r._lane];
  card.style.setProperty('--lane', lane.color);
  $('u-img').src = coverUrl(r, 'card');
  $('u-img').alt = `Cover of ${r.title}`;
  $('u-k').textContent = fresh ? `RECORD CAUGHT · ${lane.name.toUpperCase()}` : `ALREADY IN YOUR RECORDS · ${lane.name.toUpperCase()}`;
  $('u-t').textContent = r.title;
  $('u-m').textContent = `${r.genre} · ${fmtDate(r.date)}${r === PREMIERE ? ' · NEW' : ''}`;
  const links = $('u-links'); links.textContent = '';
  links.append(...releaseLinks(r, true).children);
  card.hidden = false; card.className = ''; void card.offsetWidth; card.className = 'show';
  unlockT = 7;
}
function updateUnlock(dt) {
  if (unlockT <= 0) return;
  unlockT -= dt;
  if (unlockT <= 0) nextUnlock();
}

// ---------- Title screen ----------
// The menu, Press Start, the side panels and the stats are hidden in the page's markup:
// without script they would be dead buttons and empty boxes.
for (const id of ['t-menu', 't-press', 't-side', 't-stats']) $(id).hidden = false;
const titleBars = LANES.map((l) => { const i = el('i'); i.style.background = l.color; i.style.boxShadow = `0 0 12px ${l.color}`; return i; });
$('t-bars').append(...titleBars);
(() => {
  const table = $('t-score');
  const rows = [['metronome', 'Metronome', 'Back row. Ticks on the beat.'], ['tuner', 'Tuner', 'Middle rows.'], ['woofer', 'Woofer', 'Front rows. Pumps with the kick.'], ['brute', 'Brute', 'Armored. Three hits.']];
  rows.forEach(([type, name, note], i) => {
    const r = el('div', 'sct-row'), c = el('canvas');
    c.width = 92; c.height = 64;
    drawShapeCanvas(c, type, LANES[[0, 1, 2, 3][i]].color);
    const mid = el('div', null, name); mid.append(el('small', null, note));
    r.append(c, mid, el('b', null, `${TYPES[type].pts} PTS`));
    table.append(r);
  });
  const shipRow = el('div', 'sct-row'), sc = el('canvas'); sc.width = 92; sc.height = 64;
  const g = sc.getContext('2d');
  g.fillStyle = '#ff7ad9'; g.fillRect(22, 26, 48, 10); g.fillRect(32, 18, 28, 8); g.fillStyle = '#fff'; g.fillRect(28, 29, 4, 4); g.fillRect(44, 29, 4, 4); g.fillRect(60, 29, 4, 4);
  g.fillStyle = '#111'; g.beginPath(); g.arc(46, 50, 9, 0, TAU); g.fill(); g.fillStyle = '#ff7ad9'; g.beginPath(); g.arc(46, 50, 3, 0, TAU); g.fill();
  const mid = el('div', null, 'Record Ship'); mid.append(el('small', null, 'Shoot it, catch the record.'));
  shipRow.append(sc, mid, el('b', null, '? PTS'));
  table.append(shipRow);
  // the premiere
  const p = $('t-prem'), img = el('img');
  img.src = coverUrl(PREMIERE, 'card'); img.alt = `Cover of ${PREMIERE.title}`;
  const info = el('div');
  info.append(el('div', 'pk', 'NEW RELEASE'), el('div', 'pt', PREMIERE.title), el('div', 'pm', `${PREMIERE.lane} · ${fmtDate(PREMIERE.date)}`), releaseLinks(PREMIERE, true));
  p.append(img, info);
  $('t-lanes').textContent = `${LANES.length} LANES · ${RELEASES.length} RELEASES`;
  const pu = $('how-pu');
  for (const k of POWER_KEYS) { const s = el('span', 'pu', POWERS[k].name); s.style.color = POWERS[k].css; pu.append(s); }
})();
function refreshTitle() {
  $('t-hi').textContent = fmtScore(save.hi);
  $('t-rec').textContent = `${save.found.size}/${RELEASES.length}`;
  const label = save.muted ? 'Sound: off' : 'Sound: on';
  for (const id of ['t-mute', 'p-mute']) { const b = $(id); b.firstChild.textContent = label; }
}

// ---------- Records screen ----------
let recordsBack = 'title';
function openRecords(back) {
  recordsBack = back;
  buildCatalog($('r-list'), save.found);
  $('r-count').textContent = `${save.found.size} OF ${RELEASES.length} FOUND`;
  G.overlay = 'records';
  showScreen('records');
  $('r-list').scrollTop = 0;
}
function closeRecords() {
  G.overlay = recordsBack === 'pause' ? 'pause' : recordsBack === 'results' ? 'results' : null;
  showScreen(recordsBack);
  if (recordsBack === 'title') refreshTitle();
}

// ---------- Mode changes ----------
function toTitle() {
  G.mode = 'title'; G.overlay = null; G.freeze = false;
  body.classList.remove('playing');
  $('hud').hidden = true; $('touchpad').hidden = true; $('h-power').hidden = true; $('h-boss').hidden = true; $('banner').hidden = true; bannerT = 0;
  showScreen('title');
  refreshTitle();
  setLaneCss('#ff3f8e');
  G.lives = 3; resetPlayer(); player.inv = 9999;
  startWave(0);
  audio.duck(0.7);
}
function startGame(fromWave = 0, isContinue = false) {
  audio.start();
  G.mode = 'play'; G.overlay = null; G.freeze = false;
  if (!isContinue) { G.score = 0; G.caught = []; G.continues = 0; G.nextLife = LIFE_EVERY; } else { G.continues++; G.score = 0; G.nextLife = LIFE_EVERY; }
  G.lives = 3; G.combo = 0; G.shots = 0; G.hits = 0; G.overT = 0;
  showScreen(null);
  $('hud').hidden = false;
  $('touchpad').hidden = !touchUI;
  body.classList.toggle('touch', touchUI);
  body.classList.add('playing');
  armHint();
  resetPlayer(); player.inv = 2.5;
  clearDebris();
  unlockQ.length = 0;
  startWave(fromWave);
  audio.duck(1);
  hud.score = -1; hud.combo = -1;
  canvas.focus({ preventScroll: true });
}
function pauseGame() {
  if (G.mode !== 'play' || G.overlay) return;
  G.overlay = 'pause';
  $('p-wave').textContent = G.wave >= FINALE ? 'THE MOTHERSHIP' : `WAVE ${G.wave + 1} · ${waveName(G.wave)}`;
  refreshTitle();
  showScreen('pause');
  body.classList.remove('playing');
  audio.duck(0.3);
  releaseAll();
}
function resumeGame() {
  if (G.mode !== 'play') return;
  G.overlay = null;
  showScreen(null);
  body.classList.add('playing');
  audio.duck(1);
  canvas.focus({ preventScroll: true });
}
function endGame(victory) {
  if (G.mode !== 'play') return;
  G.mode = 'results'; G.overlay = 'results';
  if (G.score > save.hi) save.hi = G.score;
  persist();
  body.classList.remove('playing');
  $('touchpad').hidden = true; $('h-power').hidden = true; $('h-boss').hidden = true;
  $('res-k').textContent = victory ? 'VICTORY' : `GAME OVER · WAVE ${Math.min(G.wave, FINALE) + 1}`;
  $('res-t').textContent = victory ? 'Earth holds the line' : 'The wave broke through';
  $('res-score').textContent = fmtScore(G.score);
  $('res-wave').textContent = G.wave >= FINALE ? 'FINAL' : String(G.wave + 1);
  $('res-rec').textContent = `${save.found.size}/${RELEASES.length}`;
  const list = $('res-recs'); list.textContent = '';
  for (const r of G.caught) {
    const row = el('div', 'rel on'), img = el('img'); img.alt = ''; img.src = coverUrl(r, 'thumb');
    const mid = el('div'); const tag = el('span', 'rk', LANES[r._lane].name.toUpperCase()); tag.style.color = LANES[r._lane].color;
    const meta = el('div', 'rm'); meta.append(tag, document.createTextNode(`${r.genre} · ${fmtDate(r.date)}`));
    mid.append(el('div', 'rt', r.title), meta);
    row.append(img, mid, releaseLinks(r));
    list.append(row);
  }
  $('res-none').textContent = G.caught.length ? `Records caught this run: ${G.caught.length}` : 'No records caught this run. Shoot the Record Ship, then catch the record it drops.';
  const menu = $('res-menu'); menu.textContent = '';
  const btn = (act, label, primary) => { const b = el('button', primary ? 'btn primary' : 'btn', label); b.type = 'button'; b.dataset.act = act; menu.append(b); };
  if (!victory) btn('continue', `Continue · wave ${Math.min(G.wave, FINALE) + 1}`, true);
  btn('again', 'Play again', victory);
  btn('records', 'Records');
  btn('title', 'Title');
  showScreen('results');
  if (victory) audio.fx.clear(); else audio.fx.over();
}

// ---------- Menus: buttons, arrow keys, the gamepad ----------
function activeMenuButtons() {
  const scr = SCREENS.find((s) => !$(s).hidden);
  return scr ? [...$(scr).querySelectorAll('button')] : [];
}
function menuFocus(id) {
  if (!id) return;
  const first = $(id).querySelector('button.primary') || $(id).querySelector('button');
  if (first) requestAnimationFrame(() => first.focus({ preventScroll: true }));
}
function moveFocus(d) {
  const list = activeMenuButtons();
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const n = list[(i + d + list.length) % list.length];
  n.focus({ preventScroll: true });
  audio.fx.ui(0);
}
function act(a) {
  audio.start();
  audio.fx.ui(1);
  switch (a) {
    case 'play': startGame(0); break;
    case 'records': openRecords(G.overlay === 'pause' ? 'pause' : G.mode === 'results' ? 'results' : 'title'); break;
    case 'how': G.overlay = 'how'; showScreen('how'); break;
    case 'back': if (G.overlay === 'records') closeRecords(); else { G.overlay = null; showScreen('title'); } break;
    case 'mute': audio.setMuted(!save.muted); refreshTitle(); break;
    case 'resume': resumeGame(); break;
    case 'restart': G.lives = Math.max(G.lives, 1); resumeGame(); resetPlayer(); startWave(G.wave); break;
    case 'quit': audio.fx.hum(false); toTitle(); break;
    case 'continue': startGame(Math.min(G.wave, FINALE), true); break;
    case 'again': startGame(0); break;
    case 'title': toTitle(); break;
    default: break;
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (b) { e.preventDefault(); act(b.dataset.act); return; }
  const play = e.target.closest('button[data-play]');
  if (play) { e.preventDefault(); audio.start(); playRelease(bySlug.get(play.dataset.play)); }
});
// A release page opens in this tab, except during a run: then it opens in a new one, so the
// run is still here afterward (the game pauses itself when the tab is hidden).
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || !a.closest('#unlock, #records, #results, #t-prem, #dock')) return;
  if (G.mode === 'play') { a.target = '_blank'; a.rel = 'noopener'; } else a.removeAttribute('target');
}, true);

// ---------- Play here: SoundCloud's own player, docked, created only when someone asks ----------
// Nothing is requested from SoundCloud until then, and no audio is ever served from this site.
const SC_ORIGIN = 'https://w.soundcloud.com';
const dock = $('dock'), dockFrame = $('dock-frame');
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
  const title = $('dock-title');
  title.textContent = r.title; title.href = pageUrl(r);
  dock.style.setProperty('--lane', LANES[r._lane].color);
  dock.classList.remove('paused');
  dock.hidden = false;
  body.classList.add('docked');
  audio.external(true);
}
function closePlayer() {
  dockFrame.replaceChildren();       // removing the frame is what stops the music
  dock.hidden = true;
  body.classList.remove('docked');
  audio.external(false);
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
  else if (msg.method === 'play') { dock.classList.remove('paused'); audio.external(true); }
  else if (msg.method === 'pause' || msg.method === 'finish') { dock.classList.add('paused'); audio.external(false); }
});
$('dock-close').addEventListener('click', closePlayer);
$('b-pause').addEventListener('click', (e) => { e.stopPropagation(); audio.start(); pauseGame(); });

// ---------- Input ----------
const held = { left: false, right: false, fire: false };
const touch = { on: false, id: null, sx: 0, used: false };
const pad = { prev: [], axis: 0, fire: false };
function releaseAll() { held.left = held.right = held.fire = false; touch.on = false; touch.id = null; }
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', KeyZ: 'fire', KeyX: 'fire' };
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  audio.start();
  const code = e.code;
  if (code === 'KeyM') { audio.setMuted(!save.muted); refreshTitle(); toast(save.muted ? 'SOUND OFF' : 'SOUND ON', 1, true); return; }
  const inMenu = G.mode !== 'play' || G.overlay;
  if (inMenu) {
    if (code === 'ArrowDown' || code === 'ArrowRight' || code === 'KeyS') { e.preventDefault(); moveFocus(1); return; }
    if (code === 'ArrowUp' || code === 'ArrowLeft' || code === 'KeyW') { e.preventDefault(); moveFocus(-1); return; }
    if (code === 'Escape' || code === 'KeyP') {
      e.preventDefault();
      if (G.overlay === 'records') closeRecords(); else if (G.overlay === 'how') act('back'); else if (G.overlay === 'pause') resumeGame();
      return;
    }
    if (G.mode === 'title' && !G.overlay) {
      if (code === 'KeyR') { act('records'); return; }
      if ((code === 'Enter' || code === 'Space') && !(document.activeElement && document.activeElement.tagName === 'BUTTON') && !(document.activeElement && document.activeElement.tagName === 'A')) { e.preventDefault(); act('play'); }
    }
    return;
  }
  if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); pauseGame(); return; }
  const k = KEYMAP[code];
  if (k) { e.preventDefault(); held[k] = true; }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) held[k] = false; });
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { releaseAll(); if (G.mode === 'play' && !G.overlay) pauseGame(); audio.suspend(); } else audio.resume();
});
// Touch: drag along the lower part of the screen, the cannon follows the finger; it fires while held.
const tp = $('touchpad');
// The touch hint goes after the first drag, or after 8 seconds of play.
let hintTimer = 0;
function hideHint() { touch.used = true; tp.classList.add('used'); clearTimeout(hintTimer); }
function armHint() { clearTimeout(hintTimer); if (!touch.used) hintTimer = setTimeout(hideHint, 8000); }
function enableTouch() {
  if (touchUI) return;
  touchUI = true;
  if (G.mode === 'play') { tp.hidden = false; body.classList.add('touch'); armHint(); }
}
addEventListener('touchstart', enableTouch, { passive: true, once: true });
tp.addEventListener('pointerdown', (e) => {
  audio.start();
  touch.on = true; touch.id = e.pointerId; touch.sx = e.clientX;
  try { tp.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  hideHint();
  e.preventDefault();
});
tp.addEventListener('pointermove', (e) => { if (touch.on && e.pointerId === touch.id) touch.sx = e.clientX; });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) tp.addEventListener(ev, (e) => { if (e.pointerId === touch.id) { touch.on = false; touch.id = null; } });
tp.addEventListener('contextmenu', (e) => e.preventDefault());
// Screen x to field x along the cannon's line.
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2), _hit = new THREE.Vector3();
function screenToFieldX(sx) {
  _v.set(0, 1.2, 0).project(camera);
  _ndc.set(sx / viewW() * 2 - 1, _v.y);
  _ray.setFromCamera(_ndc, camera);
  return _ray.ray.intersectPlane(_plane, _hit) ? _hit.x : player.x;
}
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  if (!gp) { pad.axis = 0; pad.fire = false; return; }
  const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const edge = (i) => b(i) && !pad.prev[i];
  let ax = gp.axes[0] || 0;
  if (Math.abs(ax) < 0.18) ax = 0;
  if (b(14)) ax = -1; if (b(15)) ax = 1;
  pad.axis = ax;
  pad.fire = b(0) || b(7) || b(5);
  const inMenu = G.mode !== 'play' || G.overlay;
  if (inMenu) {
    if (edge(12) || edge(14)) moveFocus(-1);
    if (edge(13) || edge(15)) moveFocus(1);
    if (edge(0)) { const f = document.activeElement; if (f && f.tagName === 'BUTTON') f.click(); else if (G.mode === 'title') act('play'); }
    if (edge(1)) { if (G.overlay === 'records') closeRecords(); else if (G.overlay === 'how') act('back'); else if (G.overlay === 'pause') resumeGame(); }
    if (edge(9) && G.overlay === 'pause') resumeGame();
    else if (edge(9) && G.mode === 'title' && !G.overlay) act('play');
  } else if (edge(9)) pauseGame();
  pad.prev = gp.buttons.map((x) => x.pressed);
}
function readInput() {
  pollPad();
  const inp = { move: 0, fire: false, targetX: null };
  inp.move = (held.right ? 1 : 0) - (held.left ? 1 : 0) + pad.axis;
  inp.fire = held.fire || pad.fire;
  if (touch.on) { inp.targetX = screenToFieldX(touch.sx); inp.fire = true; }
  return inp;
}
