// ===== part 5: game state, the cannon, shots, bombs, the Record Ship, falling records, power-ups, effects =====
const G = {
  mode: 'boot',           // boot | title | play | over | results
  overlay: null,          // null | 'pause' | 'records' | 'how'
  wave: 0,                // 0..6 = lanes A..G, 7 = the Mothership
  phase: 'intro',         // intro | fight | clear
  phaseT: 0,
  time: 0,
  score: 0, lives: 3, nextLife: 10000, combo: 0, best: 0,
  shots: 0, hits: 0, caught: [], waveShots: 0, waveHits: 0, waveShotHits: 0,
  freeze: false, auto: false, continues: 0,
  steps: 0,               // formation march steps taken this wave (tests compare with the conductor)
  hitstop: 0,
};
const LIFE_EVERY = 15000;
const POWERS = {
  spread: { name: 'SPREAD', color: new THREE.Color('#ffb347'), css: '#ffb347', time: 11 },
  pierce: { name: 'PIERCE', color: new THREE.Color('#33e6ff'), css: '#33e6ff', time: 10 },
  shield: { name: 'SHIELD', color: new THREE.Color('#6f8bff'), css: '#8fa4ff', time: 12 },
  rapid: { name: 'OVERDRIVE', color: new THREE.Color('#ff3f8e'), css: '#ff5c9e', time: 9 },
};
const POWER_KEYS = Object.keys(POWERS);

// ---------- Effects: sparks, rings, popups, shake ----------
const SPK = 1400;
const spk = { p: new Float32Array(SPK * 3), v: new Float32Array(SPK * 3), c: new Float32Array(SPK * 4), s: new Float32Array(SPK), life: new Float32Array(SPK), max: new Float32Array(SPK), g: new Float32Array(SPK), next: 0 };
const spkU = { uScale: { value: 400 } };
const sparks = (() => {
  const geo = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(new Float32Array(SPK * 3), 3); pa.setUsage(THREE.DynamicDrawUsage);
  const ca = new THREE.BufferAttribute(new Float32Array(SPK * 4), 4); ca.setUsage(THREE.DynamicDrawUsage);
  const sa = new THREE.BufferAttribute(new Float32Array(SPK), 1); sa.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pa); geo.setAttribute('aCol', ca); geo.setAttribute('aSize', sa);
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: spkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = aCol; gl_PointSize = aSize * uScale / max(-mv.z, 0.5); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      varying vec4 vC;
      void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = clamp(1.0 - d, 0.0, 1.0); gl_FragColor = vec4(vC.rgb * (a * a * 1.6 + a), vC.a * a); }`,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();
function spark(x, y, z, vx, vy, vz, color, size = 0.5, life = 0.6, gravity = 18, bright = 2.2) {
  const i = spk.next; spk.next = (spk.next + 1) % SPK;
  spk.p.set([x, y, z], i * 3); spk.v.set([vx, vy, vz], i * 3);
  spk.c[i * 4] = color.r * bright; spk.c[i * 4 + 1] = color.g * bright; spk.c[i * 4 + 2] = color.b * bright; spk.c[i * 4 + 3] = 1;
  spk.s[i] = size; spk.life[i] = life; spk.max[i] = life; spk.g[i] = gravity;
}
function sparkBurst(x, y, z, color, n = 24, speed = 14, size = 0.5, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, b = rr(-1, 1), r = Math.sqrt(1 - b * b), s = speed * rr(0.3, 1);
    spark(x, y, z, Math.cos(a) * r * s, b * s * 0.8 + speed * 0.25, Math.sin(a) * r * s, color, size * rr(0.6, 1.3), life * rr(0.6, 1.3));
  }
}
function updateSparks(dt) {
  const pa = sparks.geometry.attributes.position.array, ca = sparks.geometry.attributes.aCol.array, sa = sparks.geometry.attributes.aSize.array;
  for (let i = 0; i < SPK; i++) {
    if (spk.life[i] <= 0) { if (ca[i * 4 + 3] !== 0) { ca[i * 4 + 3] = 0; sa[i] = 0; } continue; }
    spk.life[i] -= dt;
    const o = i * 3, k = Math.max(0, spk.life[i] / spk.max[i]);
    spk.v[o + 1] -= spk.g[i] * dt;
    const drag = Math.exp(-2.2 * dt);
    spk.v[o] *= drag; spk.v[o + 1] *= drag; spk.v[o + 2] *= drag;
    spk.p[o] += spk.v[o] * dt; spk.p[o + 1] += spk.v[o + 1] * dt; spk.p[o + 2] += spk.v[o + 2] * dt;
    if (spk.p[o + 1] < 0.05) { spk.p[o + 1] = 0.05; spk.v[o + 1] *= -0.3; }
    pa[o] = spk.p[o]; pa[o + 1] = spk.p[o + 1]; pa[o + 2] = spk.p[o + 2];
    ca[i * 4] = spk.c[i * 4]; ca[i * 4 + 1] = spk.c[i * 4 + 1]; ca[i * 4 + 2] = spk.c[i * 4 + 2]; ca[i * 4 + 3] = k;
    sa[i] = spk.s[i] * (0.4 + 0.6 * k);
  }
  sparks.geometry.attributes.position.needsUpdate = true;
  sparks.geometry.attributes.aCol.needsUpdate = true;
  sparks.geometry.attributes.aSize.needsUpdate = true;
}

// Shockwave rings: flat on the grid or standing up facing the camera.
const RINGS = 32;
const ringMesh = (() => {
  const geo = new THREE.PlaneGeometry(1, 1);
  const life = new THREE.InstancedBufferAttribute(new Float32Array(RINGS * 2), 2); life.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(RINGS * 3), 3); col.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aRing', life); geo.setAttribute('aRCol', col);
  const m = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec2 aRing; attribute vec3 aRCol; varying vec2 vUv; varying vec2 vR; varying vec3 vC;
      void main() { vUv = uv; vR = aRing; vC = aRCol; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec2 vR; varying vec3 vC;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float th = clamp(vR.y, 0.02, 0.9);
        float a = smoothstep(1.0 - th, 1.0 - th * 0.35, d) * (1.0 - smoothstep(0.94, 1.0, d));
        a += (1.0 - smoothstep(0.0, 1.0, d)) * 0.05;
        float k = clamp(1.0 - vR.x, 0.0, 1.0);
        gl_FragColor = vec4(vC * a * k * k * 2.5, 1.0);
      }`,
  }), RINGS);
  m.frustumCulled = false; m.count = RINGS;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < RINGS; i++) m.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
  scene.add(m);
  return m;
})();
const rings = Array.from({ length: RINGS }, () => ({ t: 1, dur: 1, x: 0, y: 0, z: 0, r0: 0, r1: 1, th: 0.2, flat: true, col: new THREE.Color() }));
let ringNext = 0;
function ring(x, y, z, r1, color, dur = 0.5, flat = true, th = 0.22, r0 = 0.2) {
  const r = rings[ringNext]; ringNext = (ringNext + 1) % RINGS;
  Object.assign(r, { t: 0, dur, x, y, z, r0, r1, th, flat }); r.col.copy(color);
  const lum = r.col.r * 0.3 + r.col.g * 0.55 + r.col.b * 0.15;
  if (lum > 0.6) r.col.multiplyScalar(0.6 / lum);      // pale colors would bloom into a white disc
}
const _rq = new THREE.Quaternion(), _rflat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
function updateRings(dt) {
  const life = ringMesh.geometry.attributes.aRing.array, col = ringMesh.geometry.attributes.aRCol.array;
  rings.forEach((r, i) => {
    if (r.t >= 1) { life[i * 2] = 1; _m4.makeScale(0, 0, 0); ringMesh.setMatrixAt(i, _m4); return; }
    r.t = Math.min(1, r.t + dt / r.dur);
    const e = 1 - Math.pow(1 - r.t, 3);
    const s = (r.r0 + (r.r1 - r.r0) * e) * 2;
    if (r.flat) _rq.copy(_rflat); else _rq.copy(camera.quaternion);
    _m4.compose(_v.set(r.x, r.y, r.z), _rq, _s.set(s, s, s));
    ringMesh.setMatrixAt(i, _m4);
    life[i * 2] = r.t; life[i * 2 + 1] = r.th;
    col[i * 3] = r.col.r; col[i * 3 + 1] = r.col.g; col[i * 3 + 2] = r.col.b;
  });
  ringMesh.instanceMatrix.needsUpdate = true;
  ringMesh.geometry.attributes.aRing.needsUpdate = true;
  ringMesh.geometry.attributes.aRCol.needsUpdate = true;
}

// Score popups and toasts live in the DOM: crisp at any resolution.
const popLayer = $('popups');
const pops = Array.from({ length: 18 }, () => { const e = el('div', 'pop'); e.hidden = true; popLayer.append(e); return { e, t: 0, x: 0, y: 0, z: 0, life: 0 }; });
let popNext = 0;
function popup(text, x, y, z, color = '#ffffff', big = false) {
  const p = pops[popNext]; popNext = (popNext + 1) % pops.length;
  p.e.textContent = text; p.e.style.color = color; p.e.className = big ? 'pop big' : 'pop'; p.e.hidden = false;
  p.x = x; p.y = y; p.z = z; p.t = 0; p.life = big ? 1.4 : 0.9;
}
function updatePopups(dt) {
  const w = viewW(), h = viewH();
  for (const p of pops) {
    if (p.e.hidden) continue;
    p.t += dt;
    if (p.t >= p.life) { p.e.hidden = true; continue; }
    _v.set(p.x, p.y + p.t * 2.2, p.z).project(camera);
    const k = p.t / p.life;
    p.e.style.transform = `translate(${((_v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - _v.y) / 2 * h).toFixed(1)}px) translate(-50%, -50%) scale(${(k < 0.12 ? 0.6 + k * 4 : 1).toFixed(2)})`;
    p.e.style.opacity = (k > 0.7 ? (1 - k) / 0.3 : 1).toFixed(2);
  }
}
let toastT = 0;
function toast(text, secs = 2.2, always = false) {
  if (G.mode === 'title' && !always) return;      // the attract demo stays quiet
  const t = $('toast'); t.textContent = text; t.classList.add('on'); toastT = secs; }
function shake(k) { if (!reduced) cam.shake = Math.min(1.6, cam.shake + k); }
let flashK = 0;
function flash(k, red = false) { flashK = Math.max(flashK, reduced ? k * 0.3 : k); $('flash').classList.toggle('red', red); }

// ---------- The cannon ----------
const PVOX = 0.4;
const PLAYER_LAYERS = [
  ['.....###.....', '....#####....', '..#########..', '.###########.', 'L###########L', 'L#.#######.#L'],
  ['......#......', '.....###.....', '....##o##....', '..#########..', '.##+#####+##.', '.#..#####..#.'],
  ['......#......', '......#......', '.....###.....', '....#+#+#....', '.....###.....', '.............'],
  ['.............', '......o......', '......#......', '.....#o#.....', '.............', '.............'],
];
const playerMesh = voxelMesh(260);
const playerGroup = new THREE.Group();
playerGroup.add(playerMesh);
scene.add(playerGroup);
const playerVox = [];
PLAYER_LAYERS.forEach((layer, ly) => layer.forEach((row, rz) => {
  for (let i = 0; i < row.length; i++) if (row[i] !== '.') playerVox.push({ x: (i - (row.length - 1) / 2) * PVOX, y: (ly + 0.5) * PVOX, z: (rz - 2.5) * PVOX, c: row[i] });
}));
const PLAYER_BODY = new THREE.Color('#d9e2ff');
function paintPlayer(laneColor, flashAmt = 0) {
  playerVox.forEach((v, i) => {
    let col = PLAYER_BODY, glow = 0.22;
    if (v.c === 'L') { col = laneColor; glow = 1.6; } else if (v.c === 'o') { col = WHITE; glow = 1.8; } else if (v.c === '+') { col = laneColor; glow = 0.9; }
    if (flashAmt > 0) { col = _col.copy(col).lerp(WHITE, flashAmt); glow += flashAmt; }
    putVoxel(playerMesh, i, v.x, v.y, v.z, PVOX * 0.96, col, glow);
  });
  finishVoxels(playerMesh, playerVox.length);
}
// Shield bubble and engine glow.
const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 16), new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color('#6f8bff') }, uK: { value: 0 }, uTime: skyU.uTime },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; vP = position; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uCol; uniform float uK, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main() {
      float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
      float hex = 0.5 + 0.5 * sin(vP.y * 9.0 + uTime * 3.0) * sin(vP.x * 9.0);
      gl_FragColor = vec4(uCol * (f * 1.8 + hex * 0.08) * uK, 1.0);
    }`,
}));
shieldMesh.position.y = 1.2; shieldMesh.scale.set(1, 0.7, 1);
playerGroup.add(shieldMesh);
const engineMat = new THREE.SpriteMaterial({ map: GLOW_TEX, color: hdr('#7fd8ff', 2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const engines = [-1, 1].map((s) => { const sp = new THREE.Sprite(engineMat); sp.position.set(s * 1.5, 0.6, 1.4); sp.scale.set(1.3, 1.3, 1); playerGroup.add(sp); return sp; });
const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: hdr('#ffffff', 3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
muzzle.position.set(0, 1.7, -1.3); muzzle.scale.set(2.4, 2.4, 1);
playerGroup.add(muzzle);

const player = { x: 0, vx: 0, alive: true, dead: 0, inv: 0, cool: 0, power: null, powerT: 0, shield: 0, tilt: 0, recoil: 0, flash: 0 };
const PLAYER_SPEED = 30, PLAYER_HALF = 2.5;
function resetPlayer(keepPower = false) {
  Object.assign(player, { x: 0, vx: 0, alive: true, dead: 0, inv: 2, cool: 0, tilt: 0, recoil: 0, flash: 0 });
  if (!keepPower) { player.power = null; player.powerT = 0; player.shield = 0; }
}

// ---------- Shots ----------
const MAX_SHOTS = 48, MAX_BOMBS = 96;
const shots = [];
const bombs = [];
const shotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 2.6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_SHOTS);
shotMesh.setColorAt(0, WHITE); shotMesh.instanceColor.setUsage(THREE.DynamicDrawUsage); shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
shotMesh.frustumCulled = false; shotMesh.count = 0;
scene.add(shotMesh);
const bombMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_BOMBS);
bombMesh.setColorAt(0, WHITE); bombMesh.instanceColor.setUsage(THREE.DynamicDrawUsage); bombMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
bombMesh.frustumCulled = false; bombMesh.count = 0;
scene.add(bombMesh);
const SHOT_SPEED = 88;
const BOMB_COL = { zig: new THREE.Color('#ff5a3a'), orb: new THREE.Color('#ff3f8e'), bass: new THREE.Color('#b56bff'), confetti: new THREE.Color('#ffe066'), beam: new THREE.Color('#ff2a5a') };

function fire() {
  if (!player.alive || player.cool > 0) return false;
  const live = shots.length;
  const rapid = player.power === 'rapid';
  const cap = rapid ? 9 : player.power === 'spread' ? 9 : 3;
  if (live >= cap) return false;
  player.cool = rapid ? 0.085 : 0.24;
  const lane = waveColor();
  const mk = (vx) => shots.push({ x: player.x, z: -1.4, px: player.x, pz: -1.4, vx, pierce: player.power === 'pierce', hitSet: null, col: lane });
  const n = player.power === 'spread' ? 3 : 1;
  if (n === 3) { mk(-9); mk(0); mk(9); } else mk(0);
  G.shots += n; G.waveShots += n;
  player.recoil = 1;
  muzzle.material.opacity = 1;
  audio.fx.shoot(player.x, rapid ? 2 : player.power === 'pierce' ? 1 : 0);
  return true;
}
function bomb(x, z, kind = 'zig', vz = 22, vx = 0, extra = {}) {
  if (bombs.length >= MAX_BOMBS) return;
  bombs.push({ x, z, vx, vz, kind, t: 0, ...extra });
}

// ---------- Hazards: bass-bomb shockwaves crawling across the grid ----------
const quakes = [];
function quake(x, z, maxR = 9) {
  quakes.push({ x, z, r: 0.5, maxR, t: 0, hit: false });
  ring(x, 0.1, z, maxR, LANE_COL[3], 0.9, true, 0.12, 0.5);
  ring(x, 0.1, z, maxR * 0.7, WHITE, 0.6, true, 0.3, 0.3);
  ripple(x, z, 2.2);
  shake(0.45);
  audio.fx.bassBomb(x);
}

// ---------- The Record Ship ----------
const shipMesh = voxelMesh(900);
const shipGroup = new THREE.Group();
shipGroup.add(shipMesh);
scene.add(shipGroup);
const shipVox = [];
(() => {
  const SV = 0.42;
  const profile = [[0, 1.8], [1, 3.1], [2, 3.7], [3, 2.6], [4, 1.5], [5, 0.8]];        // layer, radius in units
  for (const [ly, rad] of profile) {
    const n = Math.ceil(rad / SV);
    for (let i = -n; i <= n; i++) for (let k = -n; k <= n; k++) {
      const d = Math.hypot(i * SV, k * SV);
      if (d > rad) continue;
      const shell = d > rad - SV * 1.2 || ly === 0 || ly >= 4;
      if (!shell) continue;
      let c = '#';
      if (ly === 2 && d > rad - SV * 1.1) c = (Math.round(Math.atan2(k, i) / TAU * 16) % 2 === 0) ? 'o' : 'L';
      if (ly >= 4) c = 'g';
      if (ly === 0) c = '+';
      shipVox.push({ x: i * SV, y: (ly - 2) * SV, z: k * SV, c, a: Math.atan2(k, i) });
    }
  }
})();
const GLASS = new THREE.Color('#a8f0ff');
function paintShip(laneColor, t) {
  shipVox.forEach((v, i) => {
    let col = _col2.copy(laneColor).multiplyScalar(0.75), glow = 0.4;
    if (v.c === 'o' || v.c === 'L') {
      const chase = 0.5 + 0.5 * Math.sin(v.a * 8 - t * 14);
      col = v.c === 'o' ? WHITE : laneColor; glow = 0.6 + chase * 2.4;
    } else if (v.c === 'g') { col = GLASS; glow = 0.7; } else if (v.c === '+') { col = _col2.copy(laneColor).multiplyScalar(0.35); glow = 0.2; }
    putVoxel(shipMesh, i, v.x, v.y, v.z, 0.42 * 0.95, col, glow);
  });
  finishVoxels(shipMesh, shipVox.length);
}
const shipPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), coverMaterial(null, 1.25));
shipPanel.position.set(0, -2.9, 0.9); shipPanel.rotation.x = -0.25;
shipGroup.add(shipPanel);
const beamMat = new THREE.MeshBasicMaterial({ map: GLOW_TEX, color: hdr('#ffffff', 0.5), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const shipBeam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 24, 1, true), beamMat);
shipBeam.position.set(0, -3.3, 0);
shipGroup.add(shipBeam);
shipGroup.visible = false;
const ship = { active: false, x: 0, dir: 1, speed: 10, z: Z_SHIP, y: 8, release: null, t: 0, pass: 0, hp: 1 };

// ---------- Falling records ----------
const vinylMat = (release) => new THREE.ShaderMaterial({
  uniforms: { map: { value: atlasTex }, uRect: { value: atlasRect(release) }, uTime: skyU.uTime, uLane: { value: LANE_COL[release._lane].clone() } },
  vertexShader: /* glsl */`
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D map; uniform vec4 uRect; uniform float uTime; uniform vec3 uLane;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vec2 p = vUv - 0.5; float r = length(p) * 2.0;
      vec3 col;
      if (r < 0.42) {
        vec2 q = p / 0.42 + 0.5;
        col = texture2D(map, uRect.xy + clamp(q, 0.0, 1.0) * uRect.zw).rgb * 1.2;
        if (r < 0.05) col = vec3(0.02);
      } else {
        float grooves = 0.5 + 0.5 * sin(r * 160.0);
        float a = atan(p.y, p.x);
        float sheen = pow(clamp(abs(sin(a * 2.0 + uTime * 2.0)), 0.0, 1.0), 12.0);
        col = vec3(0.025) + vec3(0.06) * grooves + vec3(0.9) * sheen * 0.35 + uLane * smoothstep(0.93, 1.0, r) * 2.5;
      }
      float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
      gl_FragColor = vec4(col + uLane * f * 0.6, 1.0);
    }`,
});
const recordGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 48, 1);
recordGeo.rotateX(Math.PI / 2);      // the disc faces +z; uv of the caps is a disc map
const records = [];
function dropRecord(release, x, y, z, ttl = 3.3) {
  const mesh = new THREE.Mesh(recordGeo, vinylMat(release));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: hdr(LANES[release._lane].color, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(6, 6, 1);
  const g = new THREE.Group(); g.add(halo, mesh);
  scene.add(g);
  // it drifts into the cannon's reach while it falls, wherever it was shot down
  records.push({ release, x, x0: x, tx: clamp(x, -(HW - PLAYER_HALF - 1), HW - PLAYER_HALF - 1), y0: y, z0: z, y, z, t: 0, ttl, g, mesh, spin: 0, done: false });
}
function removeRecord(rec) {
  scene.remove(rec.g); rec.mesh.material.dispose(); rec.g.children[0].material.dispose();
  const i = records.indexOf(rec); if (i >= 0) records.splice(i, 1);
}

// ---------- Power-ups ----------
const powerGeo = new THREE.OctahedronGeometry(1, 0);
const powerups = [];
const iconTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  // spread
  g.beginPath(); g.moveTo(32, 54); g.lineTo(14, 12); g.moveTo(32, 54); g.lineTo(32, 10); g.moveTo(32, 54); g.lineTo(50, 12); g.stroke();
  // pierce
  g.beginPath(); g.moveTo(96, 56); g.lineTo(96, 12); g.moveTo(82, 26); g.lineTo(96, 10); g.lineTo(110, 26); g.stroke();
  g.beginPath(); g.moveTo(84, 40); g.lineTo(108, 40); g.stroke();
  // shield
  g.beginPath(); g.arc(160, 32, 20, 0, TAU); g.stroke(); g.beginPath(); g.arc(160, 32, 8, 0, TAU); g.fill();
  // overdrive
  g.beginPath(); g.moveTo(210, 46); g.lineTo(224, 32); g.lineTo(238, 46); g.moveTo(210, 30); g.lineTo(224, 16); g.lineTo(238, 30); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function dropPower(x, z, kind = pick(POWER_KEYS)) {
  const P = POWERS[kind];
  const mesh = new THREE.Mesh(powerGeo, new THREE.MeshBasicMaterial({ color: P.color.clone().multiplyScalar(2.2), toneMapped: false, wireframe: false }));
  const tex = iconTex.clone(); tex.repeat.set(0.25, 1); tex.offset.set(POWER_KEYS.indexOf(kind) * 0.25, 0); tex.needsUpdate = true;
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false }));
  icon.scale.set(1.6, 1.6, 1);
  const g = new THREE.Group(); g.add(mesh, icon); scene.add(g);
  powerups.push({ x, z, kind, t: 0, g, mesh, icon, tex });
}
function removePower(p) {
  scene.remove(p.g); p.mesh.material.dispose(); p.icon.material.dispose(); p.tex.dispose();
  const i = powerups.indexOf(p); if (i >= 0) powerups.splice(i, 1);
}

// ---------- Score ----------
function addScore(n, x, y, z, color = '#ffffff', big = false) {
  const mult = comboMult();
  const pts = Math.round(n * mult);
  G.score += pts;
  if (x != null) popup(mult > 1 ? `${pts} x${mult}` : String(pts), x, y, z, color, big);
  if (G.score > save.hi) save.hi = G.score;
  while (G.score >= G.nextLife) {
    G.nextLife += LIFE_EVERY;
    G.lives = Math.min(9, G.lives + 1);
    toast('EXTRA CANNON');
    audio.fx.life();
  }
  return pts;
}
const comboMult = () => Math.min(8, 1 + Math.floor(G.combo / 6));
