// ===== part 6: formations, the march, each lane's twist, the Mothership =====
function grid(cols, rowTypes, dx, dz) {
  const slots = [];
  rowTypes.forEach((type, row) => {
    for (let c = 0; c < cols; c++) slots.push({ type, row, col: c, cols, sx: (c - (cols - 1) / 2) * dx, sz: -row * dz });
  });
  return { slots, dx, dz, kind: 'grid' };
}
// Three octaves of a keyboard: white keys in front, black keys behind them.
function keyboard() {
  const slots = [], dx = 4.9, dz = 3.7;
  const blackAt = [0, 1, 3, 4, 5];               // a black key after C, D, F, G and A
  for (let oct = 0; oct < 3; oct++) {
    const zW = -(oct * 2) * dz, zB = -(oct * 2 + 1) * dz;
    for (let c = 0; c < 8; c++) slots.push({ type: 'tuner', row: oct * 2, col: c, cols: 8, sx: (c - 3.5) * dx, sz: zW, white: true, note: degMidi(48 + oct * 12, MAJOR, c) });
    blackAt.forEach((c, i) => slots.push({ type: 'metronome', row: oct * 2 + 1, col: c, cols: 8, sx: (c - 3) * dx, sz: zB, white: false, note: degMidi(48 + oct * 12 + 12, MAJOR, [2, 4, 5, 7, 8][i]) }));
  }
  return { slots, dx, dz, kind: 'grid' };
}
// A carnival wheel: rings that turn on the beat, alternating direction.
function spiral() {
  const slots = [];
  const ringsDef = [[0, 1, 'metronome'], [4.9, 6, 'tuner'], [9.6, 12, 'woofer'], [14.2, 16, 'woofer']];
  ringsDef.forEach(([r, n, type], ri) => {
    for (let i = 0; i < n; i++) slots.push({ type, row: ri, col: i, cols: n, ring: ri, r, ang: (i / n) * TAU + ri * 0.3, sx: 0, sz: 0 });
  });
  return { slots, kind: 'spiral', rmax: 14.2 };
}

const WAVES = [
  { lane: 0, layout: () => grid(9, ['woofer', 'woofer', 'tuner', 'tuner', 'metronome'], 4.7, 4.3), z0: -30, stepX: 1.2, stepZ: 2.2, fire: 1.05, bomb: 'zig', bombSpeed: 19, twist: 'orchestra', tip: 'Strict rows, perfect tempo. Clear a column, they speed up.' },
  { lane: 1, layout: () => grid(10, ['woofer', 'tuner', 'tuner', 'metronome'], 4.4, 4.6), z0: -32, stepX: 1.25, stepZ: 2.3, fire: 0.95, bomb: 'orb', bombSpeed: 23, twist: 'teleport', tip: 'On every drop they strobe and jump a column.' },
  { lane: 2, layout: () => grid(9, ['woofer', 'woofer', 'tuner', 'tuner', 'metronome'], 4.6, 4.3), z0: -31, stepX: 1.1, stepZ: 2.2, fire: 0, beatFire: 0.42, bomb: 'orb', bombSpeed: 21, twist: 'sway', tip: 'They sway to the groove and fire on the kick.' },
  { lane: 3, layout: () => grid(7, ['woofer', 'woofer', 'brute', 'brute'], 5.7, 5.0), z0: -32, stepX: 1.35, stepZ: 2.3, fire: 1.25, bomb: 'zig', bombSpeed: 19, twist: 'bass', tip: 'Brutes take three hits. Bass bombs shake the floor: stay clear of the ring.' },
  { lane: 4, layout: keyboard, z0: -29, stepX: 1.15, stepZ: 2.1, fire: 1.2, bomb: 'zig', bombSpeed: 18, twist: 'keys', tip: 'The formation is a keyboard. Every hit plays its note.' },
  { lane: 5, layout: () => grid(8, ['woofer', 'tuner', 'diver', 'diver'], 5.0, 4.6), z0: -32, stepX: 1.3, stepZ: 2.3, fire: 1.05, bomb: 'zig', bombSpeed: 22, twist: 'divers', tip: 'Divers break formation and come straight at you.' },
  { lane: 6, layout: spiral, z0: -33, stepX: 1.25, stepZ: 2.3, fire: 0.95, bomb: 'confetti', bombSpeed: 16, twist: 'spiral', tip: 'A carnival wheel that turns on the beat.' },
  { lane: -1, boss: true, tip: 'Break the cover-art panels to free the records, then hit the core.' },
];
const FINALE = 7;
const CARNIVAL = LANES.map((l) => new THREE.Color(l.color));
const waveColor = () => (G.wave >= FINALE ? CARNIVAL[Math.floor(G.time * 0.5) % CARNIVAL.length] : LANE_COL[WAVES[G.wave].lane]);
const waveName = (w) => (w >= FINALE ? 'THE MOTHERSHIP' : LANES[WAVES[w].lane].name.toUpperCase());

// ---------- The formation ----------
const F = { ox: 0, oz: -30, dir: 1, stepX: 1.2, stepZ: 2.2, list: [], total: 0, alive: 0, layout: null, def: null, strobe: 0, fireT: 1.5, enterT: 0, swayT: 0, diveT: 0, shipKills: [], lastKeys: [] };
const invaders = F.list;
function buildFormation(w) {
  const def = WAVES[w];
  invaders.length = 0;
  F.def = def;
  F.ox = 0; F.dir = 1; F.strobe = 0; F.fireT = 2; F.swayT = 0; F.diveT = 0; F.lastKeys.length = 0;
  if (def.boss) { F.layout = null; F.total = 0; F.alive = 0; return; }
  F.layout = def.layout();
  F.oz = def.z0; F.stepX = def.stepX; F.stepZ = def.stepZ;
  const lane = LANE_COL[def.lane];
  const carriers = new Set();
  const slots = F.layout.slots;
  while (carriers.size < Math.min(2, slots.length)) carriers.add(Math.floor(rnd() * slots.length));
  slots.forEach((s, i) => {
    const t = TYPES[s.type];
    let color = lane.clone().lerp(WHITE, Math.min(0.3, s.row * 0.05));
    if (def.twist === 'keys') color = s.white ? new THREE.Color('#dfe4f7') : new THREE.Color('#7a6cff');
    if (def.twist === 'spiral') color = CARNIVAL[(i * 3 + s.ring) % CARNIVAL.length].clone();
    const inv = {
      slot: s, type: s.type, x: 0, y: 30, z: -60, tx: 0, tz: 0, alive: true, hp: t.hp, frame: 0, flash: 0, color, glow: carriers.has(i) ? 1.5 : def.twist === 'keys' && s.white ? 0.42 : 0.85,
      scale: 0, yaw: 0, pitch: 0, roll: 0, hop: 0, state: 'enter', enter: 0.15 + (s.row * 0.18) + (s.col % 5) * 0.05 + rnd() * 0.15, carrier: carriers.has(i),
      armorLayer: t.hp > 1 ? Uint8Array.from({ length: 64 }, () => 1 + Math.floor(rnd() * (t.hp - 1))) : null, dive: null, note: s.note,
    };
    invaders.push(inv);
  });
  F.total = invaders.length; F.alive = invaders.length;
  placeSlots();
  for (const inv of invaders) { inv.x = inv.tx + rr(-6, 6); inv.z = inv.tz - 30 - rnd() * 20; inv.y = flyY(inv.z) + 24; }
}
// Puts every slot's target where the formation says it is.
function placeSlots() {
  const L = F.layout;
  if (!L) return;
  const sway = F.def.twist === 'sway' ? Math.sin(F.swayT * Math.PI / 2) * 3.2 : 0;
  for (const inv of invaders) {
    const s = inv.slot;
    if (L.kind === 'spiral') { s.sx = Math.cos(s.ang) * s.r; s.sz = Math.sin(s.ang) * s.r * 0.86 - L.rmax * 0.86; }
    inv.tx = F.ox + s.sx + sway;
    inv.tz = F.oz + s.sz;
  }
}
function formationExtents() {
  let minX = 99, maxX = -99, maxZ = -999;
  for (const inv of invaders) {
    if (!inv.alive || inv.state === 'dive') continue;
    const hw = TYPES[inv.type].halfW;
    minX = Math.min(minX, inv.tx - hw); maxX = Math.max(maxX, inv.tx + hw); maxZ = Math.max(maxZ, inv.tz);
  }
  return { minX, maxX, maxZ };
}
// One march step, on the beat. Sideways, or forward at a wall.
function formationStep() {
  G.steps++;
  if (G.wave === FINALE) { mothershipStep(); return; }
  if (!F.layout || F.alive === 0) return;
  const L = F.layout;
  if (L.kind === 'spiral') for (const inv of invaders) { const s = inv.slot; s.ang += (s.ring % 2 ? -1 : 1) * (TAU / 40); }
  if (F.def.twist === 'sway') F.swayT += 1;
  placeSlots();
  const ext = formationExtents();
  const limit = HW - 0.4;
  if ((F.dir > 0 && ext.maxX + F.stepX > limit) || (F.dir < 0 && ext.minX - F.stepX < -limit)) {
    F.oz += F.stepZ; F.dir = -F.dir;
    // after a turn the sway or the wheel may still stick out; the next steps walk it back
  } else F.ox += F.dir * F.stepX;
  placeSlots();
  for (const inv of invaders) {
    if (!inv.alive) continue;
    inv.frame ^= 1; inv.hop = 1;
  }
  floorU.uMarch.value = 1;
}
// Techno drop: strobe, and a third of them blink one column over.
function teleportDrop() {
  F.strobe = 0.5;
  const rows = new Map();
  for (const inv of invaders) if (inv.alive) { const k = inv.slot.row; if (!rows.has(k)) rows.set(k, new Set()); rows.get(k).add(inv.slot.col); }
  for (const inv of invaders) {
    if (!inv.alive || rnd() > 0.4) continue;
    const s = inv.slot, used = rows.get(s.row), dir = rnd() < 0.5 ? -1 : 1;
    for (const d of [dir, -dir]) {
      const c = s.col + d;
      if (c < 0 || c >= s.cols || used.has(c)) continue;
      used.delete(s.col); used.add(c);
      sparkBurst(inv.x, inv.y, inv.z, inv.color, 8, 8, 0.4, 0.35);
      s.col = c; s.sx = (c - (s.cols - 1) / 2) * F.layout.dx;
      inv.flash = 1;
      break;
    }
  }
  placeSlots();
  for (const inv of invaders) if (inv.alive) { inv.x = inv.tx; inv.z = inv.tz; }
  flash(0.12); shake(0.2);
}

// ---------- Enemy fire ----------
// Like the original, only the invader nearest the cannon in each column may fire.
function shooters() {
  const front = new Map();
  for (const inv of invaders) {
    if (!inv.alive || inv.state !== 'form') continue;
    const key = F.layout.kind === 'spiral' ? Math.round(inv.tx / 4) : inv.slot.col;
    const cur = front.get(key);
    if (!cur || inv.tz > cur.tz) front.set(key, inv);
  }
  return [...front.values()];
}
function invaderFire(inv) {
  const def = F.def;
  const y = inv.y - 1;
  if (def.bomb === 'confetti') bomb(inv.x, inv.z + 1, 'confetti', def.bombSpeed, 0, { ph: rnd() * TAU, col: CARNIVAL[Math.floor(rnd() * 7)] });
  else bomb(inv.x, inv.z + 1, def.bomb, def.bombSpeed * (1 + (1 - F.alive / F.total) * 0.25));
  sparkBurst(inv.x, y, inv.z + 1, BOMB_COL[def.bomb] || inv.color, 5, 5, 0.35, 0.25);
}
function updateEnemyFire(dt) {
  const def = F.def;
  if (!def || def.boss || !def.fire || F.alive === 0) return;
  F.fireT -= dt;
  if (F.fireT > 0) return;
  const frac = F.alive / F.total;
  F.fireT = def.fire * (0.42 + 0.58 * frac) * rr(0.7, 1.3) * (G.continues > 0 ? 1.15 : 1);
  const list = shooters();
  if (!list.length) return;
  let inv;
  if (rnd() < 0.5) { inv = list.reduce((a, b) => (Math.abs(a.tx - player.x) < Math.abs(b.tx - player.x) ? a : b)); } else inv = pick(list);
  invaderFire(inv);
  // Bass wave: brutes drop a bass bomb now and then
  if (def.twist === 'bass' && rnd() < 0.22) {
    const brutes = invaders.filter((i) => i.alive && i.type === 'brute');
    if (brutes.length) { const b = pick(brutes); bomb(b.x, b.z + 1, 'bass', 15, 0, { target: clamp(player.x + rr(-5, 5), -HW + 3, HW - 3), tz: rr(-7, -2.5), x0: b.x, z0: b.z + 1 }); }
  }
}
// Beat-locked events from the conductor.
function onBeatEvent(ev) {
  if (G.mode !== 'play' && G.mode !== 'title') return;
  if (ev.beat) { floorU.uBeat.value = 1; skyU.uBeat.value = 1; hudBeat(); }
  if (ev.march) formationStep();
  if (G.mode !== 'play' || G.phase !== 'fight' || !player.alive) return;
  const def = F.def;
  if (ev.drop && def && def.twist === 'teleport') teleportDrop();
  if (def && def.twist === 'sway' && ev.beat && F.alive) {
    const list = shooters();
    const n = rnd() < def.beatFire * (1.25 - F.alive / F.total * 0.6) ? (rnd() < 0.3 ? 2 : 1) : 0;
    for (let i = 0; i < n && list.length; i++) invaderFire(list.splice(Math.floor(rnd() * list.length), 1)[0]);
  }
  if (def && def.twist === 'divers' && ev.pos === 0 && F.alive) launchDivers(ev.bar);
  if (G.wave === FINALE && M.active) mothershipBeat(ev);
}

// ---------- Punk: divers ----------
function launchDivers(bar) {
  const free = invaders.filter((i) => i.alive && i.state === 'form' && i.type === 'diver');
  if (!free.length) return;
  const n = Math.min(free.length, F.alive < F.total * 0.5 ? 2 : 1 + (bar % 2));
  for (let k = 0; k < n; k++) {
    const inv = free.splice(Math.floor(rnd() * free.length), 1)[0];
    const side = inv.x < player.x ? -1 : 1;
    inv.state = 'dive';
    inv.dive = { t: 0, dur: 2.6, p0: [inv.x, inv.z], p1: [inv.x + side * 14, inv.z + 12], p2: [player.x - side * 4, -14], p3: [player.x + side * 10, 8], fired: 0 };
    sparkBurst(inv.x, inv.y, inv.z, inv.color, 10, 7, 0.45, 0.4);
  }
}
function bez(a, b, c, d, t) { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }

// ---------- Per-frame formation motion ----------
function updateFormation(dt) {
  if (F.strobe > 0) F.strobe -= dt;
  if (G.wave === FINALE) for (const inv of invaders) if (inv.escort) { inv.tx = clamp(M.x + inv.slot.sx, -HW + 2, HW - 2); inv.tz = M.z + 10; }
  const marching = G.phase === 'fight';
  for (const inv of invaders) {
    if (!inv.alive) continue;
    inv.flash = Math.max(0, inv.flash - dt * 5);
    inv.hop = Math.max(0, inv.hop - dt * 7);
    if (inv.state === 'enter') {
      inv.enter -= dt;
      if (inv.enter <= 0) {
        inv.x = damp(inv.x, inv.tx, 5, dt); inv.z = damp(inv.z, inv.tz, 5, dt);
        inv.y = damp(inv.y, flyY(inv.tz), 4.5, dt);
        inv.scale = damp(inv.scale, 1, 6, dt);
        inv.roll = Math.sin(inv.enter * 6) * 0.3 * (1 - inv.scale);
        if (Math.abs(inv.y - flyY(inv.tz)) < 0.08 && Math.abs(inv.z - inv.tz) < 0.1) { inv.state = 'form'; inv.scale = 1; inv.roll = 0; }
      }
      continue;
    }
    if (inv.state === 'dive') { updateDive(inv, dt); continue; }
    // In formation: snap toward the slot (a quick hop on each step).
    inv.x = damp(inv.x, inv.tx, 28, dt);
    inv.z = damp(inv.z, inv.tz, 28, dt);
    const bob = F.def && F.def.twist === 'sway' ? Math.abs(Math.sin(F.swayT * Math.PI / 2 + (inv.slot.col * 0.4))) * 0.4 : 0;
    inv.y = flyY(inv.z) + inv.hop * 0.45 + bob;
    inv.roll = F.def && F.def.twist === 'sway' ? Math.sin(F.swayT * Math.PI / 2) * 0.12 : damp(inv.roll, 0, 8, dt);
    inv.yaw = (inv.x - player.x) * -0.006;
    inv.scale = 1 + inv.hop * 0.06;
    if (marching && inv.z > Z_BUNKER - 3 && inv.z < Z_BUNKER + 3) crushBunkers(inv.x, inv.z, TYPES[inv.type].halfW, 1.2);
  }
}
function updateDive(inv, dt) {
  const d = inv.dive;
  d.t += dt / d.dur;
  if (d.t >= 1) {
    // back in from the far side, into the slot
    inv.state = 'enter'; inv.enter = 0; inv.x = inv.tx; inv.z = -90; inv.y = flyY(-90) + 10; inv.scale = 0.4; inv.dive = null;
    return;
  }
  const t = d.t, nx = bez(d.p0[0], d.p1[0], d.p2[0], d.p3[0], t), nz = bez(d.p0[1], d.p1[1], d.p2[1], d.p3[1], t);
  inv.yaw = Math.atan2(nx - inv.x, nz - inv.z) * 0.5;
  inv.roll = clamp((nx - inv.x) * -2, -0.8, 0.8);
  inv.x = nx; inv.z = nz; inv.y = flyY(nz) + Math.sin(t * Math.PI) * 1.2;
  if (d.fired < 2 && t > 0.25 + d.fired * 0.2) { d.fired++; bomb(inv.x, inv.z + 1, 'zig', 26 + Math.max(0, -inv.z) * 0.1); }
  if (rnd() < 0.6) spark(inv.x, inv.y, inv.z - 1, rr(-1, 1), rr(-1, 1), -4, inv.color, 0.5, 0.35, 0);
  // a diver that reaches the cannon takes it down with it
  if (player.alive && G.mode === 'play' && Math.abs(inv.x - player.x) < 2.7 && Math.abs(inv.z) < 1.8) {
    if (player.inv <= 0) { playerHit('diver'); killInvader(inv, 1); }
  }
}
function frontZ() {
  let z = -999;
  for (const inv of invaders) if (inv.alive && inv.state === 'form') z = Math.max(z, inv.z + TYPES[inv.type].halfD);
  return z;
}

// ---------- The Mothership ----------
const M = { active: false, x: 0, z: -52, tz: -52, dir: 1, coreHp: 0, coreMax: 48, coreOpen: false, panels: [], queue: [], broken: 0, t: 0, dying: 0, dead: false, hp01: 1, launchT: 0 };
const MV = 0.7, MSA = 30, MSB = 6, MSC = 6;     // voxel size; half extents in voxels (x, y, z)
const msVox = [];
// A wide arrowhead hull with a raised bridge, light strips along the leading edge and
// a row of lamps underneath. Only the shell is kept.
(() => {
  const inside = (i, j, k) => {
    const ax = Math.abs(i) / MSA;
    const sweep = ax * ax * MSC * 0.9;                      // wings swept back
    const zz = (k + sweep) / MSC, yy = j / (MSB * (1 - ax * 0.65));
    if (ax > 1) return false;
    const hull = ax * ax + zz * zz * 0.85 + yy * yy <= 1;
    const bridge = Math.abs(i) < 7 - Math.max(0, j - MSB) * 1.5 && j > 0 && j <= MSB + 3 && Math.abs(k + 1) < 4 - Math.max(0, j - MSB);
    const fin = (Math.abs(i) === 20 || Math.abs(i) === 21) && j > 0 && j < MSB + 2 && k > -1 && k < 4;
    return hull || bridge || fin;
  };
  for (let j = -MSB; j <= MSB + 3; j++) for (let k = -MSC - 6; k <= MSC; k++) for (let i = -MSA; i <= MSA; i++) {
    if (!inside(i, j, k)) continue;
    if (inside(i + 1, j, k) && inside(i - 1, j, k) && inside(i, j + 1, k) && inside(i, j - 1, k) && inside(i, j, k + 1) && inside(i, j, k - 1)) continue;
    let c = '#';
    const front = !inside(i, j, k + 1);
    if (front && (j === 0 || j === -1)) c = 'L';
    else if (j <= -MSB + 2 && !inside(i, j - 1, k) && (i + 300) % 4 === 0) c = 'o';
    else if (j > 0 && !inside(i, j + 1, k)) c = (i + 300) % 6 === 0 ? '+' : 'T';
    else if ((i + 300) % 6 === 0) c = '+';
    msVox.push({ x: i * MV, y: j * MV, z: k * MV, c, i });
  }
})();
const msMesh = voxelMesh(msVox.length + 16);
const msGroup = new THREE.Group();
msGroup.add(msMesh);
msGroup.visible = false;
scene.add(msGroup);
const HULL = new THREE.Color('#58629a'), DECK = new THREE.Color('#8994cc');
function paintMothership(t, damage) {
  const n = CARNIVAL.length;
  msVox.forEach((v, idx) => {
    let col = HULL, glow = 0.2;
    if (v.c === 'L') { col = CARNIVAL[Math.floor((v.i + 60) / 6 + t * 4) % n]; glow = 1.6; } else if (v.c === 'o') { col = WHITE; glow = 0.9 + 0.7 * Math.sin(t * 6 + v.i); } else if (v.c === '+') { col = _col2.copy(HULL).multiplyScalar(0.6); glow = 0.1; } else if (v.c === 'T') { col = DECK; glow = 0.25; }
    if (damage > 0 && (v.i * 7 + idx) % 11 < damage * 6) { col = _col.copy(col).lerp(HOT, 0.6); glow += 0.6 + 0.4 * Math.sin(t * 20 + idx); }
    putVoxel(msMesh, idx, v.x, v.y, v.z, MV * 0.96, col, glow);
  });
  finishVoxels(msMesh, msVox.length);
}
// Six cover-art panels across the leading edge, the core in the middle.
const PANEL_X = [-17.5, -11.8, -6.1, 6.1, 11.8, 17.5];
const PANEL_W = 4.7;
const msFrontZ = (x) => { const ax = Math.min(1, Math.abs(x) / (MSA * MV)); return MSC * MV * Math.sqrt(Math.max(0, 1 - ax * ax)) - ax * ax * MSC * MV * 0.9; };
const msCore = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), new THREE.MeshBasicMaterial({ color: hdr('#ff3f8e', 2.4), toneMapped: false }));
const msShield = new THREE.Mesh(new THREE.IcosahedronGeometry(2.9, 1), new THREE.MeshBasicMaterial({ color: hdr('#7f8cff', 0.9), wireframe: true, toneMapped: false, transparent: true, opacity: 0.8 }));
msCore.position.set(0, 0.2, msFrontZ(0) + 0.6); msShield.position.copy(msCore.position);
msGroup.add(msCore, msShield);
function setupMothership() {
  Object.assign(M, { active: true, x: 0, tx: 0, z: -54, tz: -45, dir: 1, coreHp: 48, coreMax: 48, coreOpen: false, broken: 0, t: 0, dying: 0, dead: false, launchT: 0, enter: 1, hop: 0 });
  // Releases still to find; the rest of the catalog after them, so the panels always carry art.
  const unfound = RELEASES.filter((r) => !save.found.has(r.slug) && !inFlight(r));
  M.queue = unfound.length ? unfound.slice() : [];
  M.extra = RELEASES.filter((r) => !M.queue.includes(r));
  for (const p of M.panels) { msGroup.remove(p.mesh); p.mesh.material.dispose(); }
  M.panels = PANEL_X.map((px) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_W), coverMaterial(null, 1.2));
    mesh.position.set(px, 0.2, msFrontZ(px) + 0.7);
    mesh.rotation.x = -0.3;
    msGroup.add(mesh);
    const p = { x: px, mesh, release: null, hp: 0, alive: false, respawn: 0.3 + Math.abs(px) * 0.05, flash: 0 };
    return p;
  });
  msGroup.visible = true;
  msGroup.position.set(0, flyY(M.z) + 2, M.z);
  msShield.visible = true;
}
function refillPanel(p) {
  let r = M.queue.shift();
  let fresh = true;
  if (!r) { if (!M.extra.length) return; r = M.extra[Math.floor(rnd() * M.extra.length)]; fresh = false; }
  p.release = r; p.hp = 5; p.alive = true; p.fresh = fresh; p.flash = 1;
  p.mesh.material.uniforms.uRect.value.copy(atlasRect(r));
  p.mesh.material.uniforms.uEdge.value.copy(LANE_COL[r._lane]).multiplyScalar(1.5);
  p.mesh.visible = true;
}
function mothershipStep() {
  if (!M.active || M.dying) return;
  const limit = HW - MSA * MV - 0.5;
  if ((M.dir > 0 && M.tx + 1 > limit) || (M.dir < 0 && M.tx - 1 < -limit)) { M.tz = Math.min(-28, M.tz + 1.4); M.dir = -M.dir; } else M.tx += M.dir * 1.0;
  M.hop = 1;
}
function mothershipBeat(ev) {
  if (M.dying) return;
  const hpK = 1 - M.hp01;
  const guns = [-15, -9, 0, 9, 15];
  // one aimed shot on most beats
  if (ev.beat && rnd() < 0.55 + hpK * 0.35) {
    const gx = pick(guns), x = M.x + gx;
    bomb(x, M.z + msFrontZ(gx) + 1, 'orb', 20 + hpK * 8, clamp((player.x - x) * 0.25, -6, 6));
  }
  // a fan every two bars
  if (ev.pos === 8 && ev.bar % 2 === 1) for (let i = -3; i <= 3; i++) bomb(M.x + i * 1.6, M.z + 4, 'zig', 18, i * 3.2);
  // escorts every four bars, and they shoot too
  if (ev.pos === 0 && ev.bar % 4 === 2) launchEscorts();
  if (ev.pos % 8 === 4) {
    const esc = invaders.filter((i) => i.alive && i.state === 'form');
    if (esc.length) { const e = pick(esc); bomb(e.x, e.z + 1, 'zig', 20); }
  }
}
function launchEscorts() {
  const alive = invaders.filter((i) => i.alive).length;
  if (alive > 10) return;
  for (let c = 0; c < 6; c++) {
    const slot = { type: 'drone', row: 0, col: c, cols: 6, sx: (c - 2.5) * 4.2, sz: 0 };
    const inv = { slot, type: 'drone', x: M.x, y: flyY(M.z) + 2, z: M.z + 2, tx: 0, tz: 0, alive: true, hp: 1, frame: 0, flash: 1, color: CARNIVAL[c % 7].clone(), glow: 1, scale: 0.3, yaw: 0, pitch: 0, roll: 0, hop: 0, state: 'enter', enter: c * 0.08, carrier: c === 2 && rnd() < 0.5, armorLayer: null, escort: true };
    invaders.push(inv);
  }
  F.total = invaders.length; F.alive = invaders.filter((i) => i.alive).length;
}
function updateMothership(dt) {
  if (!M.active) return;
  M.t += dt;
  M.enter = Math.max(0, (M.enter || 0) - dt * 0.6);
  M.hop = Math.max(0, (M.hop || 0) - dt * 6);
  if (M.tx == null) M.tx = 0;
  M.x = damp(M.x, M.tx, 14, dt);
  M.z = damp(M.z, M.tz, 3, dt);
  const y = flyY(M.z) + 3 + M.hop * 0.3 + Math.sin(M.t * 1.3) * 0.25 + M.enter * 20;
  msGroup.position.set(M.x, y, M.z);
  msGroup.rotation.z = Math.sin(M.t * 0.7) * 0.03 + (M.dying ? Math.sin(M.t * 30) * 0.03 : 0);
  // panels
  let alivePanels = 0;
  for (const p of M.panels) {
    p.flash = Math.max(0, p.flash - dt * 4);
    if (!p.alive && !M.dying) {
      p.mesh.visible = false;
      p.respawn -= dt;
      if (p.respawn <= 0 && G.phase === 'fight') refillPanel(p);
    }
    if (p.alive) { alivePanels++; p.mesh.material.uniforms.uFlash.value = p.flash; }
  }
  M.coreOpen = M.broken >= 6;
  msShield.visible = !M.coreOpen;
  msShield.rotation.y += dt * 0.8; msShield.rotation.x += dt * 0.5;
  msCore.rotation.y -= dt * 1.4;
  const pulse = 1 + Math.sin(M.t * 8) * 0.08;
  msCore.scale.setScalar(pulse * (M.coreOpen ? 1.15 : 0.85));
  M.hp01 = M.coreOpen ? M.coreHp / M.coreMax : 1;
  const dmg = M.coreOpen ? 1 - M.coreHp / M.coreMax : 0;
  paintMothership(M.t, dmg);
  addLight(M.x, M.z + 6, 22, 0.9, CARNIVAL[Math.floor(M.t * 3) % 7]);
  pool(M.x, M.z, 44, CARNIVAL[Math.floor(M.t * 2) % 7], 0.35);
  audio.fx.hum(true, dmg);
  if (M.dying) {
    M.dying += dt;
    if (rnd() < 0.5) {
      const v = msVox[Math.floor(rnd() * msVox.length)];
      const wx = M.x + v.x, wy = y + v.y, wz = M.z + v.z;
      sparkBurst(wx, wy, wz, pick(CARNIVAL), 14, 16, 0.6, 0.7);
      ring(wx, wy, wz, rr(2, 5), pick(CARNIVAL), 0.5, false, 0.2);
      for (let n = 0; n < 6; n++) spawnDebris(wx, wy, wz, rr(-12, 12), rr(4, 16), rr(-6, 10), MV * 0.9, pick([HULL, WHITE, pick(CARNIVAL)]), 1.6, 2);
      if (rnd() < 0.3) audio.fx.crunch(wx, 1.2);
      shake(0.12);
    }
    if (M.dying > 3.2 && !M.dead) {
      M.dead = true; M.active = false; msGroup.visible = false; audio.fx.hum(false);
      for (const v of msVox) if (rnd() < 0.5) spawnDebris(M.x + v.x, y + v.y, M.z + v.z, v.x * rr(0.5, 2), rr(4, 20), v.z * 2 + rr(-4, 8), MV * 0.9, rnd() < 0.2 ? pick(CARNIVAL) : HULL, 1.3, rr(1.5, 3));
      ring(M.x, 0.2, M.z, 40, WHITE, 1.4, true, 0.1);
      ring(M.x, y, M.z, 30, pick(CARNIVAL), 1.0, false, 0.15);
      flash(0.9); shake(1.4);
      audio.fx.shipHit(M.x);
    }
  }
}
// Shots against the Mothership: panels, core, or the hull.
function hitMothership(s, prevZ) {
  if (!M.active || M.dying) return false;
  const dx = s.x - M.x;
  const fz = M.z + msFrontZ(dx) + 0.6;
  if (!(prevZ > fz - 1.2 && s.z <= fz + 0.5)) return false;
  if (Math.abs(dx) > MSA * MV + 0.5) return false;
  const y = flyY(M.z);
  for (const p of M.panels) {
    if (!p.alive || Math.abs(dx - p.x) > PANEL_W / 2) continue;
    p.hp--; p.flash = 1;
    sparkBurst(s.x, y + 2, fz, WHITE, 8, 10, 0.4, 0.3);
    audio.fx.clank(s.x);
    addScore(25, s.x, y + 3, fz, '#ffffff');
    if (p.hp <= 0) breakPanel(p);
    return true;
  }
  if (M.coreOpen && Math.abs(dx) < 2.4) {
    M.coreHp--;
    sparkBurst(s.x, y + 2, fz, hdr('#ff3f8e'), 14, 14, 0.5, 0.4);
    ring(M.x, y + 2.2, fz + 0.5, 3, hdr('#ff3f8e'), 0.35, false, 0.25);
    addScore(50, s.x, y + 3, fz, '#ff7aa8');
    audio.fx.crunch(s.x, 0.7);
    shake(0.08);
    if (M.coreHp <= 0) { M.dying = 0.001; G.hitstop = 0.25; addScore(25000, M.x, y + 5, fz, '#ffd25a', true); toast('MOTHERSHIP DOWN'); }
    return true;
  }
  sparkBurst(s.x, y + 1.5, fz, HULL.clone().multiplyScalar(4), 4, 6, 0.3, 0.25);
  audio.fx.tick(s.x);
  return true;
}
function breakPanel(p) {
  p.alive = false; p.respawn = 2.2; M.broken++;
  const wy = msGroup.position.y + p.mesh.position.y, wx = M.x + p.x, wz = M.z + p.mesh.position.z;
  const lc = LANE_COL[p.release._lane];
  for (let i = 0; i < 40; i++) spawnDebris(wx + rr(-1.5, 1.5), wy + rr(-1.5, 1.5), wz, rr(-6, 6), rr(2, 12), rr(2, 10), 0.32, i % 3 ? lc : WHITE, 1.8, 1.8);
  ring(wx, wy, wz + 0.5, 5, lc, 0.5, false, 0.2);
  sparkBurst(wx, wy, wz, lc, 30, 18, 0.6, 0.6);
  audio.fx.shatter(wx);
  shake(0.35); flash(0.15);
  addScore(500, wx, wy + 2, wz, LANES[p.release._lane].color, true);
  dropRecord(p.release, wx, wy - 1, wz + 1, 3.4);
}
