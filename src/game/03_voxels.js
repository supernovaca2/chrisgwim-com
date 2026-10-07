// ===== part 3: invader designs, the invader voxel batch, debris, bunkers =====
// Original bitmaps, two frames each, flipped on every march step.
// '#' body (the wave color), 'o' white-hot detail, '+' the dark inner part, 'A' armor plate.
const SHAPES = {
  // A speaker cone that pumps on the beat.
  woofer: [[
    '...#####...',
    '.##+++++##.',
    '#++#####++#',
    '#+###o###+#',
    '#++#####++#',
    '.##+++++##.',
    '..#..#..#..',
    '.#..#.#..#.',
  ], [
    '...#####...',
    '.##+++++##.',
    '#+++###+++#',
    '#++##o##++#',
    '#+++###+++#',
    '.##+++++##.',
    '.#..#.#..#.',
    '#..#...#..#',
  ]],
  // Tuning-fork claws.
  tuner: [[
    '#.........#',
    '#.#.....#.#',
    '#.#.###.#.#',
    '###########',
    '..#o###o#..',
    '..#######..',
    '...#+.+#...',
    '..##...##..',
  ], [
    '...........',
    '#.#.....#.#',
    '#.#.###.#.#',
    '###########',
    '#.#o###o#.#',
    '#.#######.#',
    '...#+.+#...',
    '...##.##...',
  ]],
  // A metronome; its needle ticks left and right.
  metronome: [[
    '.o.......',
    '..#......',
    '...#.....',
    '...###...',
    '..##o##..',
    '.#######.',
    '##.#+#.##',
    '#.#...#.#',
  ], [
    '.......o.',
    '......#..',
    '.....#...',
    '...###...',
    '..##o##..',
    '.#######.',
    '##.#+#.##',
    '.#.#.#.#.',
  ]],
  // An armored cabinet. Plates come off one hit at a time.
  brute: [[
    '..AAAAAAAAA..',
    '.AA#######AA.',
    'AA##o###o##AA',
    'A###########A',
    'A##+++#+++##A',
    'AA#########AA',
    '.AAAAAAAAAAA.',
    '.##.##.##.##.',
    '##.........##',
  ], [
    '..AAAAAAAAA..',
    '.AA#######AA.',
    'AA##o###o##AA',
    'A###########A',
    'A##+#+++#+##A',
    'AA#########AA',
    '.AAAAAAAAAAA.',
    '..##.##.##...',
    '.##..##..##..',
  ]],
  // A diving manta for the punk wave.
  diver: [[
    '#.........#',
    '##.......##',
    '.##.###.##.',
    '..##o#o##..',
    '...#####...',
    '....#+#....',
    '.....#.....',
  ], [
    '...........',
    '...........',
    '...#####...',
    '####o#o####',
    '#.#######.#',
    '....#+#....',
    '.....#.....',
  ]],
  // Small escorts the Mothership launches.
  drone: [[
    '.#####.',
    '##o#o##',
    '#######',
    '.#.+.#.',
    '#.....#',
  ], [
    '.#####.',
    '##o#o##',
    '#######',
    '.#.+.#.',
    '.#...#.',
  ]],
};
const VOX = 0.36;
const VOX_DEPTH = 1.7;          // voxels are stretched front to back, so they read as solid from above
const TYPES = {
  woofer: { pts: 10, hp: 1, name: 'Woofer' },
  tuner: { pts: 20, hp: 1, name: 'Tuner' },
  metronome: { pts: 30, hp: 1, name: 'Metronome' },
  brute: { pts: 40, hp: 3, name: 'Brute' },
  diver: { pts: 40, hp: 1, name: 'Diver' },
  drone: { pts: 15, hp: 1, name: 'Drone' },
};
for (const [key, frames] of Object.entries(SHAPES)) {
  const t = TYPES[key];
  t.frames = frames.map((rows) => {
    const h = rows.length, w = rows[0].length, out = [];
    rows.forEach((row, j) => {
      for (let i = 0; i < w; i++) {
        const ch = row[i];
        if (ch !== '.') out.push({ x: (i - (w - 1) / 2) * VOX, y: ((h - 1) / 2 - j) * VOX, c: ch, k: out.length });
      }
    });
    return out;
  });
  t.w = rows0(frames).w * VOX; t.h = rows0(frames).h * VOX;
  t.halfW = t.w * 0.46; t.halfD = 1.1;
  t.maxVox = Math.max(...t.frames.map((f) => f.length));
}
function rows0(frames) { return { w: frames[0][0].length, h: frames[0].length }; }

// Draws a bitmap onto a 2D canvas (title score table, HUD icons).
function drawShapeCanvas(canvasEl, type, color, frame = 0) {
  const rows = SHAPES[type][frame], h = rows.length, w = rows[0].length;
  const g = canvasEl.getContext('2d'), cw = canvasEl.width, ch = canvasEl.height;
  const px = Math.floor(Math.min(cw / (w + 1), ch / (h + 1)));
  const ox = Math.floor((cw - px * w) / 2), oy = Math.floor((ch - px * h) / 2);
  g.clearRect(0, 0, cw, ch);
  rows.forEach((row, j) => {
    for (let i = 0; i < w; i++) {
      const c = row[i];
      if (c === '.') continue;
      g.fillStyle = c === 'o' ? '#ffffff' : c === '+' ? 'rgba(255,255,255,0.28)' : c === 'A' ? '#8d93ad' : color;
      if (c === '+') { g.fillStyle = color; g.globalAlpha = 0.35; } else g.globalAlpha = 1;
      g.fillRect(ox + i * px, oy + j * px, px, px);
    }
  });
  g.globalAlpha = 1;
}

const WHITE = new THREE.Color(1, 1, 1);
const ARMOR = new THREE.Color('#8d93ad');
const HOT = new THREE.Color('#ffd9a0');
const _col = new THREE.Color(), _col2 = new THREE.Color();
const _rot = new Float32Array(9);

// ---------- The invader batch: one draw call for the whole formation ----------
const invMesh = voxelMesh(6000);
scene.add(invMesh);
let invVox = 0;
// Writes an invader's voxels. inv: { type, x, z, y, frame, color, flash, hp, scale, yaw, pitch, roll, armor[] }
function drawInvader(inv) {
  const t = TYPES[inv.type], shape = t.frames[inv.frame & 1];
  const s = VOX * 0.94 * inv.scale;
  if (s <= 0.001) return;
  const R = rotMat(inv.yaw || 0, (inv.pitch || 0) + INV_PITCH, inv.roll || 0, _rot);
  const cx = inv.x, cy = inv.y, cz = inv.z, sc = inv.scale;
  const flash = inv.flash || 0;
  for (const v of shape) {
    if (invVox >= 6000) return;
    let col, glow;
    if (v.c === 'A') {
      if ((inv.armorLayer ? inv.armorLayer[v.k % inv.armorLayer.length] : 1) >= inv.hp) continue;
      col = ARMOR; glow = 0.12;
    } else if (v.c === 'o') { col = WHITE; glow = 1.3; } else if (v.c === '+') { col = _col2.copy(inv.color).multiplyScalar(0.42); glow = 0.25; } else { col = inv.color; glow = inv.glow != null ? inv.glow : 0.85; }
    if (flash > 0) { col = _col.copy(col).lerp(WHITE, flash); glow += flash * 1.5; }
    const ox = v.x * sc, oy = v.y * sc;
    const x = cx + R[0] * ox + R[3] * oy, y = cy + R[1] * ox + R[4] * oy, z = cz + R[2] * ox + R[5] * oy;
    putVoxel(invMesh, invVox++, x, y, z, s, col, glow, VOX_DEPTH, R);
  }
}
const INV_PITCH = -0.32;      // the bitmaps lean back to face the camera

// ---------- Debris: a fixed pool of cubes that fall, bounce on the grid and cool down ----------
const DEB = 2400;
const debMesh = voxelMesh(DEB);
debMesh.count = DEB;
scene.add(debMesh);
const deb = {
  p: new Float32Array(DEB * 3), v: new Float32Array(DEB * 3), ax: new Float32Array(DEB * 3), ang: new Float32Array(DEB), spin: new Float32Array(DEB),
  life: new Float32Array(DEB), max: new Float32Array(DEB), size: new Float32Array(DEB), col: new Float32Array(DEB * 3), glow: new Float32Array(DEB), next: 0, alive: 0,
};
(() => { const a = debMesh.instanceMatrix.array; a.fill(0); })();
function spawnDebris(x, y, z, vx, vy, vz, size, color, glow, life = 1.8) {
  const i = deb.next; deb.next = (deb.next + 1) % DEB;
  deb.p[i * 3] = x; deb.p[i * 3 + 1] = y; deb.p[i * 3 + 2] = z;
  deb.v[i * 3] = vx; deb.v[i * 3 + 1] = vy; deb.v[i * 3 + 2] = vz;
  const ax = rnd() - 0.5, ay = rnd() - 0.5, az = rnd() - 0.5, il = 1 / Math.max(1e-3, Math.hypot(ax, ay, az));
  deb.ax[i * 3] = ax * il; deb.ax[i * 3 + 1] = ay * il; deb.ax[i * 3 + 2] = az * il;
  deb.ang[i] = rnd() * TAU; deb.spin[i] = rr(-14, 14);
  deb.life[i] = life * rr(0.75, 1.25); deb.max[i] = deb.life[i]; deb.size[i] = size;
  deb.col[i * 3] = color.r; deb.col[i * 3 + 1] = color.g; deb.col[i * 3 + 2] = color.b; deb.glow[i] = glow;
}
// Bursts an invader into its own voxels, flung away from the hit.
function burstInvader(inv, dirZ = -1, power = 1) {
  const t = TYPES[inv.type], shape = t.frames[inv.frame & 1];
  const R = rotMat(inv.yaw || 0, (inv.pitch || 0) + INV_PITCH, inv.roll || 0, _rot);
  const step = shape.length > 70 ? 2 : 1;
  for (let n = 0; n < shape.length; n += step) {
    const v = shape[n];
    if (v.c === 'A' && (inv.armorLayer ? inv.armorLayer[v.k % inv.armorLayer.length] : 1) >= inv.hp) continue;
    const ox = v.x * inv.scale, oy = v.y * inv.scale;
    const x = inv.x + R[0] * ox + R[3] * oy, y = inv.y + R[1] * ox + R[4] * oy, z = inv.z + R[2] * ox + R[5] * oy;
    const col = v.c === 'o' ? WHITE : v.c === 'A' ? ARMOR : v.c === '+' ? _col2.copy(inv.color).multiplyScalar(0.5) : inv.color;
    const sp = rr(3, 9) * power;
    spawnDebris(x, y, z, ox * sp * 0.9 + rr(-2, 2), rr(3, 11) * power + oy * 2, dirZ * rr(2, 9) * power + rr(-2, 2), VOX * 0.9, col, v.c === 'o' ? 2 : 1.6, rr(1.4, 2.4));
  }
}
const _qd = new THREE.Quaternion(), _ad = new THREE.Vector3(), _md = new THREE.Matrix4(), _pd = new THREE.Vector3(), _sd = new THREE.Vector3();
function updateDebris(dt) {
  const a = debMesh.instanceMatrix.array, c = debMesh.userData.col.array;
  let alive = 0;
  for (let i = 0; i < DEB; i++) {
    if (deb.life[i] <= 0) {
      if (a[i * 16 + 15] !== 0) { for (let k = 0; k < 16; k++) a[i * 16 + k] = 0; }
      continue;
    }
    alive++;
    deb.life[i] -= dt;
    const o = i * 3;
    deb.v[o + 1] -= 34 * dt;
    deb.p[o] += deb.v[o] * dt; deb.p[o + 1] += deb.v[o + 1] * dt; deb.p[o + 2] += deb.v[o + 2] * dt;
    const half = deb.size[i] * 0.5;
    if (deb.p[o + 1] < half && Math.abs(deb.p[o]) < 200) {
      deb.p[o + 1] = half;
      if (deb.v[o + 1] < -2) {
        deb.v[o + 1] *= -0.42; deb.v[o] *= 0.72; deb.v[o + 2] *= 0.72; deb.spin[i] *= 0.6;
      } else { deb.v[o + 1] = 0; deb.v[o] *= 0.9; deb.v[o + 2] *= 0.9; deb.spin[i] *= 0.9; }
    }
    deb.ang[i] += deb.spin[i] * dt;
    const k = deb.life[i] / deb.max[i];
    const s = deb.size[i] * Math.min(1, k * 3.2);
    _ad.set(deb.ax[o], deb.ax[o + 1], deb.ax[o + 2]);
    _qd.setFromAxisAngle(_ad, deb.ang[i]);
    _md.compose(_pd.set(deb.p[o], deb.p[o + 1], deb.p[o + 2]), _qd, _sd.set(s, s, s));
    _md.toArray(a, i * 16);
    c[i * 4] = deb.col[o]; c[i * 4 + 1] = deb.col[o + 1]; c[i * 4 + 2] = deb.col[o + 2];
    c[i * 4 + 3] = deb.glow[i] * (0.15 + 0.85 * k * k);
  }
  deb.alive = alive;
  debMesh.instanceMatrix.needsUpdate = true;
  debMesh.userData.col.needsUpdate = true;
}
function clearDebris() { deb.life.fill(0); }

// ---------- Bunkers: voxel shields that erode cube by cube ----------
const BUNKER_ROWS = [
  '...######...',
  '..########..',
  '.##########.',
  '############',
  '############',
  '############',
  '####....####',
  '###......###',
];
const BVOX = 0.5, BW = 12, BH = 8, BD = 3;
const BUNKER_COL = new THREE.Color('#8fb0ff');
const bunkerMesh = voxelMesh(4 * BW * BH * BD + 8);
scene.add(bunkerMesh);
const bunkers = [];
const bunkerHeat = [];       // [bunkerIndex, cellIndex, heat]
function buildBunkers(count = 4) {
  bunkers.length = 0;
  bunkerHeat.length = 0;
  const xs = count === 4 ? [-19.5, -6.5, 6.5, 19.5] : count === 3 ? [-16, 0, 16] : [];
  let inst = 0;
  xs.forEach((bx) => {
    const b = { x: bx, z: Z_BUNKER, cells: new Uint8Array(BW * BH * BD), inst: new Int32Array(BW * BH * BD).fill(-1), left: 0 };
    for (let j = 0; j < BH; j++) {
      const row = BUNKER_ROWS[BH - 1 - j];
      for (let i = 0; i < BW; i++) {
        if (row[i] !== '#') continue;
        for (let k = 0; k < BD; k++) {
          const ci = (j * BD + k) * BW + i;
          b.cells[ci] = 1; b.inst[ci] = inst; b.left++;
          const [x, y, z] = bunkerCellPos(b, i, j, k);
          const shade = 0.82 + 0.18 * ((i + j + k) % 2);
          _col.copy(BUNKER_COL).multiplyScalar(shade);
          putVoxel(bunkerMesh, inst++, x, y, z, BVOX * 0.96, _col, 0.32);
        }
      }
    }
    bunkers.push(b);
  });
  finishVoxels(bunkerMesh, inst);
}
function bunkerCellPos(b, i, j, k) { return [b.x + (i - (BW - 1) / 2) * BVOX, (j + 0.5) * BVOX, b.z + (k - (BD - 1) / 2) * BVOX]; }
function zeroInstance(mesh, idx) { const a = mesh.instanceMatrix.array; for (let n = 0; n < 16; n++) a[idx * 16 + n] = 0; }
// Is there a bunker voxel at this point? Returns the bunker or null.
function bunkerAt(x, y, z) {
  for (const b of bunkers) {
    if (Math.abs(x - b.x) > BW * BVOX * 0.5 + 0.2 || Math.abs(z - b.z) > BD * BVOX * 0.5 + 0.2) continue;
    const i = Math.round((x - b.x) / BVOX + (BW - 1) / 2), j = Math.floor(y / BVOX), k = Math.round((z - b.z) / BVOX + (BD - 1) / 2);
    if (i < 0 || i >= BW || j < 0 || j >= BH || k < 0 || k >= BD) continue;
    if (b.cells[(j * BD + k) * BW + i]) return b;
  }
  return null;
}
// Blows a crater around a point; returns how many cubes went.
function erodeBunker(b, x, y, z, radius, push = -1) {
  let n = 0;
  const r2 = radius * radius;
  for (let j = 0; j < BH; j++) for (let k = 0; k < BD; k++) for (let i = 0; i < BW; i++) {
    const ci = (j * BD + k) * BW + i;
    if (!b.cells[ci]) continue;
    const [cx, cy, cz] = bunkerCellPos(b, i, j, k);
    const d2 = (cx - x) ** 2 + (cy - y) ** 2 + ((cz - z) * 0.7) ** 2;
    if (d2 > r2 || (d2 > r2 * 0.45 && rnd() < 0.45)) {
      if (d2 < r2 * 2.6) bunkerHeat.push([bunkers.indexOf(b), ci, 1]);
      continue;
    }
    b.cells[ci] = 0; b.left--;
    zeroInstance(bunkerMesh, b.inst[ci]);
    if (n < 14) spawnDebris(cx, cy, cz, rr(-4, 4), rr(2, 8), push * rr(1, 6), BVOX * 0.8, n % 3 ? BUNKER_COL : HOT, 1.4, rr(0.8, 1.5));
    n++;
  }
  bunkerMesh.instanceMatrix.needsUpdate = true;
  return n;
}
// Clears every cube inside a box (an invader marching through).
function crushBunkers(x, z, halfW, halfD) {
  for (const b of bunkers) {
    if (Math.abs(x - b.x) > BW * BVOX * 0.5 + halfW || Math.abs(z - b.z) > BD * BVOX * 0.5 + halfD) continue;
    for (let j = 0; j < BH; j++) for (let k = 0; k < BD; k++) for (let i = 0; i < BW; i++) {
      const ci = (j * BD + k) * BW + i;
      if (!b.cells[ci]) continue;
      const [cx, cy, cz] = bunkerCellPos(b, i, j, k);
      if (Math.abs(cx - x) > halfW || Math.abs(cz - z) > halfD) continue;
      b.cells[ci] = 0; b.left--;
      zeroInstance(bunkerMesh, b.inst[ci]);
      if (rnd() < 0.3) spawnDebris(cx, cy, cz, rr(-3, 3), rr(2, 6), rr(1, 5), BVOX * 0.8, BUNKER_COL, 1.2, 1);
    }
    bunkerMesh.instanceMatrix.needsUpdate = true;
  }
}
// Freshly cut edges glow hot and cool down.
function updateBunkerHeat(dt) {
  if (!bunkerHeat.length) return;
  const c = bunkerMesh.userData.col.array;
  for (let n = bunkerHeat.length - 1; n >= 0; n--) {
    const h = bunkerHeat[n], b = bunkers[h[0]];
    h[2] -= dt * 1.4;
    if (!b || !b.cells[h[1]] || h[2] <= 0) {
      if (b && b.cells[h[1]]) { const o = b.inst[h[1]] * 4; c[o] = BUNKER_COL.r; c[o + 1] = BUNKER_COL.g; c[o + 2] = BUNKER_COL.b; c[o + 3] = 0.32; }
      bunkerHeat.splice(n, 1);
      continue;
    }
    const o = b.inst[h[1]] * 4, k = h[2];
    c[o] = lerp(BUNKER_COL.r, HOT.r * 1.4, k); c[o + 1] = lerp(BUNKER_COL.g, HOT.g * 1.1, k); c[o + 2] = lerp(BUNKER_COL.b, HOT.b * 0.6, k); c[o + 3] = 0.32 + k * 1.6;
  }
  if (bunkerHeat.length > 400) bunkerHeat.splice(0, bunkerHeat.length - 400);
  bunkerMesh.userData.col.needsUpdate = true;
}
