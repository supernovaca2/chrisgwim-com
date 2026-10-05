
// ---------- Loading ----------
const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const lazyLoader = new THREE.TextureLoader();
const prepTex = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t; };
const loadTex = (url) => prepTex(texLoader.load(url));

// A cover that is gray until its beacon is lit, then floods with color.
function coverMaterial(tex) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uLit: { value: 0 } }]),
    fog: true,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float uLit;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        vec3 t = texture2D(map, vUv).rgb;
        float g = dot(t, vec3(0.2126, 0.7152, 0.0722));
        vec3 c = mix(vec3(g) * vec3(0.5, 0.48, 0.6), t * 0.9, uLit);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.map.value = tex;
  return mat;
}

// ---------- Monoliths: one per release ----------
const monoliths = [];
const interactables = [];
const planeGeo = new THREE.PlaneGeometry(1, 1);
const beamGeo = new THREE.CylinderGeometry(0.2, 0.42, 1, 16, 1, true).translate(0, 0.5, 0);
const haloGeo = new THREE.CylinderGeometry(1.1, 2.3, 1, 20, 1, true).translate(0, 0.5, 0);
const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const BEAM_H = 250;

function plateTexture(r, lane, hero) {
  return textTexture(1024, 96, (g, w, h) => {
    g.fillStyle = '#0c0b11'; g.fillRect(0, 0, w, h);
    g.fillStyle = lane.color; g.fillRect(0, 0, 10, h);
    g.textBaseline = 'middle';
    g.font = FONT_DISPLAY(70); g.fillStyle = lane.color; g.fillText(lane.bus, 34, h / 2 + 4);
    const meta = hero ? `NEW · ${dateShort(r.date).toUpperCase()}` : `${dateShort(r.date).toUpperCase()} · ${fmt(r.ms)}`;
    g.font = FONT_MONO(25); g.fillStyle = '#a5a1b2';
    const mw = g.measureText(meta).width;
    g.fillText(meta, w - mw - 28, h / 2 + 2);
    const title = r.title.toUpperCase();
    fitText(g, title, w - mw - 150, 58, (px) => FONT_DISPLAY(px, 800));
    g.fillStyle = '#f3f1ee'; g.fillText(title, 96, h / 2 + 4);
  });
}

function makeMonolith(r, lane, x, z, nx, nz, size, hero) {
  const g = new THREE.Group();
  const y0 = heightAt(x, z);
  g.position.set(x, y0, z);
  g.rotation.y = Math.atan2(nx, nz);
  const W = size + 1.1, baseH = hero ? 2.6 : 1.5, sunk = 0.25;
  const plinth = shade(new THREE.Mesh(new THREE.BoxGeometry(W + 2.6, baseH, 3.4), STONE), true, true);
  plinth.position.y = baseH / 2 - sunk;
  const cy = baseH - sunk + W / 2;
  const slab = shade(new THREE.Mesh(new THREE.BoxGeometry(W, W, 0.8), STONE_DARK));
  slab.position.y = cy;
  g.add(plinth, slab);

  const tex = loadTex(r.card);
  const cover = coverMaterial(tex);
  const frameMat = glowMat(lane.color, 0.2);
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture(r, lane, hero) });
  const plateW = W + 2.2, plateH = plateW * (96 / 1024);
  // Both faces of the slab carry the cover. Only the one toward the camera is ever seen, so the
  // two sets are kept apart and updateWorld draws just that one.
  const sides = { 1: [], [-1]: [] };
  for (const s of [1, -1]) {
    const frame = new THREE.Mesh(planeGeo, frameMat);
    frame.scale.set(size + 0.42, size + 0.42, 1); frame.position.set(0, cy, s * 0.405);
    const face = new THREE.Mesh(planeGeo, cover);
    face.scale.set(size, size, 1); face.position.set(0, cy, s * 0.42);
    const plate = new THREE.Mesh(planeGeo, plateMat);
    plate.scale.set(plateW, plateH, 1); plate.position.set(0, (baseH - sunk) / 2 + 0.04, s * 1.705);
    if (s < 0) { frame.rotation.y = Math.PI; face.rotation.y = Math.PI; plate.rotation.y = Math.PI; }
    g.add(frame, face, plate);
    sides[s].push(frame, face, plate);
  }

  const top = cy + W / 2;
  const core = new THREE.Mesh(beamGeo, beamMaterial('#ffffff', 1, 0.1));
  const halo = new THREE.Mesh(haloGeo, beamMaterial(lane.color, 1, 0));
  core.position.y = top; halo.position.y = top;
  core.scale.set(1, BEAM_H, 1); halo.scale.set(1, BEAM_H, 1);
  const pool = new THREE.Mesh(poolGeo, addMat(lane.color, 0.9, 0, POOL_TEX));
  pool.position.y = 0.16; pool.scale.setScalar(size * 3.6);
  pool.renderOrder = 2;
  g.add(core, halo, pool);

  if (hero) {
    const marquee = textTexture(1024, 128, (c, w, h) => {
      c.fillStyle = ACCENT; c.fillRect(0, 0, w, h);
      c.fillStyle = '#08090b'; c.textBaseline = 'middle'; c.font = FONT_DISPLAY(84);
      const text = 'NOW PREMIERING';
      const tw = [...text].reduce((sum, ch) => sum + c.measureText(ch).width + 14, -14);
      spaced(c, text, (w - tw) / 2, h / 2 + 6, 14);
    });
    const mMat = new THREE.MeshBasicMaterial({ map: marquee });
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(planeGeo, mMat);
      m.scale.set(W, W * 0.125, 1); m.position.set(0, top + W * 0.0625 + 0.25, s * 0.2);
      if (s < 0) m.rotation.y = Math.PI;
      g.add(m);
      sides[s].push(m);
    }
    const bar = shade(new THREE.Mesh(new THREE.BoxGeometry(W, W * 0.125 + 0.5, 0.36), STONE_DARK));
    bar.position.set(0, top + W * 0.0625 + 0.25, 0);
    g.add(bar);
  }
  scene.add(g);

  for (const o of [-0.34, 0, 0.34]) colliders.push({ x: x + nz * o * (W + 2.6), z: z - nx * o * (W + 2.6), r: 2.25, top: y0 + cy + W / 2 });
  const m = {
    r, lane, x, z, y0, nx, nz, size, hero, group: g, cy: y0 + cy, cover, frameMat, core, halo, pool, tex, front: sides[1], back: sides[-1], frontShown: null,
    laneColor: new THREE.Color(lane.color), found: false, k: 0, large: false, reach: size * 1.15 + 7, sense: size * 1.5 + 8,
  };
  monoliths.push(m);
  interactables.push({ kind: 'release', m, x, z, reach: m.reach, label: r.title, verb: 'Open' });
  return m;
}

// The newest release holds the middle of the hub, as it holds the top of the live site.
const HERO = makeMonolith(newest, laneOf.get(newest.slug), 0, 0, 0, 1, 13, true);

for (const d of districts) {
  const tracks = d.lane.tracks, n = tracks.length;
  const spread = n > 1 ? Math.min(THREE.MathUtils.degToRad(38), ARC / (n - 1)) : 0;
  d.monoliths = tracks.map((r, k) => {
    const b = d.bearing + (k - (n - 1) / 2) * spread;
    const ox = Math.sin(b), oz = -Math.cos(b);
    return makeMonolith(r, d.lane, d.x + ox * d.ring, d.z + oz * d.ring, -ox, -oz, 9, false);
  });
}
const monolithsOf = (slug) => monoliths.filter((m) => m.r.slug === slug);

// The portrait in black and white, as the story page shows it. Grayed here, pixel by pixel
// (canvas filters are not in every browser), so the site keeps a single portrait file.
function portraitTexture() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 640;
  const tex = prepTex(new THREE.CanvasTexture(c));
  const img = new Image();
  manager.itemStart(DATA.portrait);
  img.onload = () => {
    const g = c.getContext('2d');
    const s = Math.max(c.width / img.width, c.height / img.height), w = img.width * s, h = img.height * s;
    g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    const px = g.getImageData(0, 0, c.width, c.height), d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = clamp((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] - 128) * 1.1 + 128, 0, 255);
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    g.putImageData(px, 0, 0);
    tex.needsUpdate = true;
    manager.itemEnd(DATA.portrait);
  };
  img.onerror = () => { manager.itemError(DATA.portrait); manager.itemEnd(DATA.portrait); };
  img.src = DATA.portrait;
  return tex;
}

// ---------- Hub: the story and the platforms either side of the premiere ----------
function makeStele(x, z, nx, nz, kind) {
  const g = new THREE.Group();
  const y0 = heightAt(x, z);
  g.position.set(x, y0, z);
  g.rotation.y = Math.atan2(nx, nz);
  const w = 7.2, h = 9.6;
  const plinth = shade(new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, 1.3, 3), STONE), true, true);
  plinth.position.y = 0.45;
  const slab = shade(new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, h + 0.9, 0.7), STONE_DARK));
  slab.position.y = 1.1 + (h + 0.9) / 2;
  g.add(plinth, slab);
  const label = kind === 'story' ? 'THE STORY' : 'LISTEN EVERYWHERE';
  const back = textTexture(768, 1024, (c, cw, ch) => {
    c.fillStyle = '#0c0b11'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = ACCENT; c.fillRect(64, 96, 96, 10);
    c.fillStyle = '#f3f1ee'; c.textBaseline = 'alphabetic';
    if (kind === 'story') {
      c.font = FONT_DISPLAY(190); c.fillText('CHRIS', 56, 330); c.fillText('GWIM', 56, 500);
      c.font = FONT_MONO(30); c.fillStyle = '#a5a1b2';
      ['WRITTEN AND PRODUCED', 'IN ABLETON LIVE', '', `${TOTAL} RELEASES`, `${lanes.length} LANES`, 'NO LIVE DATES'].forEach((line, i) => c.fillText(line, 64, 610 + i * 52));
    } else {
      c.font = FONT_MONO(30); c.fillStyle = '#a5a1b2'; c.fillText('LISTEN ON', 64, 190);
      c.fillStyle = '#f3f1ee';
      // Every platform fits: the lines close up as the list grows.
      const step = Math.min(150, 800 / PLATFORMS.length);
      c.font = FONT_DISPLAY(Math.round(step * 0.88));
      PLATFORMS.forEach((p, i) => c.fillText(p.name.toUpperCase(), 56, 220 + (i + 0.82) * step));
    }
  });
  const front = kind === 'story' ? portraitTexture() : back;
  const frameMat = glowMat(kind === 'story' ? '#ffd9a8' : ACCENT, 1.2);
  const plateMat = new THREE.MeshBasicMaterial({ map: textTexture(1024, 128, (c, cw, ch) => {
    c.fillStyle = '#0c0b11'; c.fillRect(0, 0, cw, ch);
    c.fillStyle = ACCENT; c.fillRect(0, 0, 12, ch);
    c.fillStyle = '#f3f1ee'; c.textBaseline = 'middle'; c.font = FONT_DISPLAY(78, 800);
    c.fillText(label, 48, ch / 2 + 5);
  }) });
  [[1, front], [-1, back]].forEach(([s, map]) => {
    const frame = new THREE.Mesh(planeGeo, frameMat);
    frame.scale.set(w + 0.36, h + 0.36, 1); frame.position.set(0, slab.position.y, s * 0.355);
    const face = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map, color: hdr('#ffffff', 0.88) }));
    face.scale.set(w, h, 1); face.position.set(0, slab.position.y, s * 0.37);
    const plate = new THREE.Mesh(planeGeo, plateMat);
    plate.scale.set(w + 1.8, (w + 1.8) * 0.125, 1); plate.position.set(0, 0.56, s * 1.505);
    if (s < 0) { frame.rotation.y = Math.PI; face.rotation.y = Math.PI; plate.rotation.y = Math.PI; }
    g.add(frame, face, plate);
  });
  scene.add(g);
  for (const o of [-0.3, 0.3]) colliders.push({ x: x + nz * o * (w + 2.2), z: z - nx * o * (w + 2.2), r: 2.3, top: y0 + slab.position.y + h / 2 });
  interactables.push({ kind, x, z, reach: 15, label: kind === 'story' ? 'The story' : 'Listen everywhere', verb: kind === 'story' ? 'Read' : 'Open', stele: { x, z, nx, nz, cy: y0 + slab.position.y, size: h } });
}
makeStele(-28, 6, 0.67, 0.74, 'story');
makeStele(28, 6, -0.67, 0.74, 'links');

// ---------- Gates: a lane's name over the road, at the hub rim and at the plaza ----------
function makeGate(x, z, nx, nz, lane, s, sub) {
  const g = new THREE.Group();
  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = Math.atan2(nx, nz);
  const poleH = 6.5 + 6.5 * s, half = 8 * s;
  for (const side of [-1, 1]) {
    const pole = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s + 0.1, 0.32 * s + 0.12, poleH, 6), STONE_DARK));
    pole.position.set(side * half, poleH / 2 - 0.3, 0);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 * s + 0.12), glowMat(lane.color, 2.4));
    cap.position.set(side * half, poleH + 0.25, 0);
    g.add(pole, cap);
    colliders.push({ x: x + nz * side * half, z: z - nx * side * half, r: 0.8 });
  }
  const tex = textTexture(1024, 300, (c, w, h) => {
    c.fillStyle = 'rgba(10, 9, 14, 0.9)'; c.fillRect(0, 0, w, h);
    c.fillStyle = lane.color; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
    c.textBaseline = 'alphabetic';
    c.font = FONT_DISPLAY(250); c.fillText(lane.bus, 40, 242);
    const lw = c.measureText(lane.bus).width;
    const name = lane.name.toUpperCase();
    c.fillStyle = '#f3f1ee';
    fitText(c, name, w - lw - 120, 128, (px) => FONT_DISPLAY(px));
    c.fillText(name, lw + 84, 170);
    const line = sub.toUpperCase();
    let px = 30;
    c.font = FONT_MONO(px);
    while ([...line].reduce((sum, ch) => sum + c.measureText(ch).width + 5, 0) > w - lw - 130 && px > 16) c.font = FONT_MONO(px -= 2);
    c.fillStyle = '#b9b5c4';
    spaced(c, line, lw + 88, 232, 5);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const bw = half * 2 - 0.9 * s, bh = bw * (300 / 1024);
  for (const face of [1, -1]) {
    const b = new THREE.Mesh(planeGeo, mat);
    b.scale.set(bw, bh, 1); b.position.set(0, poleH - bh / 2 - 0.5 * s, face * 0.04);
    if (face < 0) b.rotation.y = Math.PI;
    g.add(b);
  }
  scene.add(g);
}
for (const d of districts) {
  const n = d.lane.tracks.length;
  makeGate(d.x - d.dx * (d.r - 6), d.z - d.dz * (d.r - 6), -d.dx, -d.dz, d.lane, 1, `District ${d.lane.bus} · ${n} release${n === 1 ? '' : 's'}`);
  makeGate(d.dx * (HUB.r - 5), d.dz * (HUB.r - 5), -d.dx, -d.dz, d.lane, 0.56, d.lane.blurb);
}

// ---------- Road studs and plaza rings ----------
{
  const spots = [];
  for (const d of districts) {
    const pts = d.road;
    let carry = 4;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], len = Math.hypot(b.x - a.x, b.z - a.z), tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
      for (let s = carry; s < len; s += 10) {
        for (const side of [-1, 1]) spots.push({ x: a.x + tx * s - tz * side * 6.4, z: a.z + tz * s + tx * side * 6.4, yaw: Math.atan2(tx, tz), color: d.lane.color });
      }
      carry = (carry - len) % 10; if (carry < 0) carry += 10;
    }
  }
  const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.16, 1.1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  spots.forEach((s, i) => {
    p.set(s.x, heightAt(s.x, s.z) + 0.12, s.z);
    studs.setMatrixAt(i, m4.compose(p, q.setFromAxisAngle(up, s.yaw), one));
    studs.setColorAt(i, hdr(s.color, 1.25));
  });
  studs.frustumCulled = false;
  scene.add(studs);

  const ringGeo = (r) => new THREE.RingGeometry(r - 0.24, r, 160).rotateX(-Math.PI / 2);
  // Ground markings: a ring around each plaza and its letter, laid out like a landing pad.
  const padTexture = (letter, hex) => textTexture(512, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = hex; c.fillStyle = hex; c.lineWidth = 5;
    c.beginPath(); c.arc(w / 2, h / 2, 236, 0, TAU); c.stroke();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU, r0 = i % 4 ? 222 : 206;
      c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); c.lineTo(w / 2 + Math.cos(a) * 236, h / 2 + Math.sin(a) * 236); c.stroke();
    }
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = FONT_DISPLAY(330);
    c.fillText(letter, w / 2, h / 2 + 116);
  });
  const padGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const d of districts) {
    const ring = new THREE.Mesh(ringGeo(d.r - 6), addMat(d.lane.color, 1.2, 0.42));
    ring.position.set(d.x, 0.13, d.z);
    // The letter sits between the gate and the monument and reads upright as you arrive.
    const pad = new THREE.Mesh(padGeo, addMat(d.lane.color, 1, 0.3, padTexture(d.lane.bus, d.lane.color)));
    pad.scale.setScalar(26);
    pad.position.set(d.x - d.dx * (d.r - 25), 0.11, d.z - d.dz * (d.r - 25));
    pad.rotation.y = Math.atan2(-d.dx, -d.dz);
    scene.add(ring, pad);
  }
  const hubRing = new THREE.Mesh(ringGeo(HUB.r - 7), addMat('#ffd9c8', 1.1, 0.34));
  hubRing.position.y = 0.13;
  scene.add(hubRing);
}

// ---------- Rocks ----------
{
  const count = small ? 190 : 360, rand = rng(4242);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#5b4963', roughness: 0.9, flatShading: true }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p = new THREE.Vector3();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 30) {
    const a = rand() * TAU, rr = 40 + Math.sqrt(rand()) * (EDGE_R + 30);
    const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
    const s = sampleGround(x, z);
    if (s.road > 0.02 || s.plaza > 0.02) continue;
    const big = rand() < 0.14, k = big ? 3 + rand() * 3.4 : 0.5 + rand() * rand() * 2.2;
    s3.set(k * (0.8 + rand() * 0.5), k * (0.5 + rand() * 0.5), k * (0.8 + rand() * 0.5));
    p.set(x, heightAt(x, z) + s3.y * 0.22, z);
    rocks.setMatrixAt(placed++, m4.compose(p, q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3)), s3));
    if (big) colliders.push({ x, z, r: k * 0.82 });
  }
  rocks.count = placed;
  rocks.castShadow = SHADOWS; rocks.receiveShadow = SHADOWS;
  rocks.frustumCulled = false;
  scene.add(rocks);
}

// ---------- District monuments: one silhouette per lane ----------
// Each builder works in the district's own frame: +Z looks back down the road to the hub.
function monumentFrame(d) {
  const g = new THREE.Group();
  const y0 = heightAt(d.x, d.z), phi = Math.atan2(-d.dx, -d.dz);
  g.position.set(d.x, y0, d.z);
  g.rotation.y = phi;
  const c = Math.cos(phi), s = Math.sin(phi);
  const world = (lx, lz) => ({ x: d.x + c * lx + s * lz, z: d.z - s * lx + c * lz });
  const local = (wx, wz, out) => { const dx = wx - d.x, dz = wz - d.z; out.x = c * dx - s * dz; out.z = s * dx + c * dz; return out; };
  const block = (lx, lz, r, height) => { const p = world(lx, lz); colliders.push({ x: p.x, z: p.z, r, top: height ? y0 + height : undefined }); };
  // Seven point lights would sit in every lit shader; builders fill this record
  // and one real light (districtLight) plays whichever district is nearest.
  const lamp = (lx, ly, lz) => { const p = world(lx, lz); d.lamp = { x: p.x, y: y0 + ly, z: p.z, intensity: 0 }; return d.lamp; };
  scene.add(g);
  return { g, block, local, lamp };
}
const sprite = (hex, k, size, opacity = 0.6) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: hdr(hex, k), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
};

const MONUMENTS = {
  // A: a rotunda of marble columns around a floating flame.
  'Classical Fusion'(d) {
    const { g, block, lamp } = monumentFrame(d);
    const marble = new THREE.MeshStandardMaterial({ color: '#e2d3bd', roughness: 0.6, side: THREE.DoubleSide });
    const colGeo = new THREE.CylinderGeometry(0.95, 1.12, 13, 14), blockGeo = new THREE.BoxGeometry(2.8, 0.6, 2.8);
    const N = 10, R = 12.5;
    for (let k = 0; k < N; k++) {
      const a = ((k + 0.5) / N) * TAU, x = Math.sin(a) * R, z = Math.cos(a) * R;
      const col = shade(new THREE.Mesh(colGeo, marble), true, true); col.position.set(x, 7.1, z);
      const base = shade(new THREE.Mesh(blockGeo, marble), true, true); base.position.set(x, 0.3, z); base.rotation.y = a;
      const cap = shade(new THREE.Mesh(blockGeo, marble)); cap.position.set(x, 13.9, z); cap.rotation.y = a;
      g.add(col, base, cap);
      block(x, z, 1.5);       // no height: a column stops the glider, but the camera may pass between them
    }
    const outer = shade(new THREE.Mesh(new THREE.CylinderGeometry(R + 1.5, R + 1.5, 2, 56, 1, true), marble)); outer.position.y = 15.2;
    const inner = shade(new THREE.Mesh(new THREE.CylinderGeometry(R - 1.5, R - 1.5, 2, 56, 1, true), marble)); inner.position.y = 15.2;
    const lid = new THREE.RingGeometry(R - 1.5, R + 1.5, 56).rotateX(-Math.PI / 2);
    const topLid = shade(new THREE.Mesh(lid, marble)); topLid.position.y = 16.2;
    const botLid = new THREE.Mesh(lid, marble); botLid.position.y = 14.2;
    const dais = shade(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.5, 28), marble), false, true); dais.position.y = 0.2;
    const orbMat = glowMat(d.lane.color, 2);
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 2), orbMat); orb.position.y = 7.4;
    const glow = sprite(d.lane.color, 1.2, 15, 0.5); glow.position.y = 7.4;
    const light = lamp(0, 7.4, 0);
    g.add(outer, inner, topLid, botLid, dais, orb, glow);
    const base = new THREE.Color(d.lane.color);
    return (t) => {
      const p = d.power;
      orb.position.y = glow.position.y = 7.4 + Math.sin(t * 0.9) * 0.55;
      orb.scale.setScalar(1 + p * 0.3 + Math.sin(t * 2.2) * 0.03);
      orbMat.color.copy(base).multiplyScalar(1.3 + p * 1.9);
      glow.material.opacity = 0.3 + p * 0.45;
      light.intensity = 40 + p * 150;
    };
  },

  // B: a spire that sweeps the dunes with lasers.
  'Techno & Trance'(d) {
    const { g, block, lamp } = monumentFrame(d);
    const spire = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 2.5, 36, 4), STONE_DARK), true, true);
    spire.position.y = 18; spire.rotation.y = Math.PI / 4;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), glowMat(d.lane.color, 2.6)); tip.position.y = 38;
    const glow = sprite(d.lane.color, 1.3, 16, 0.55); glow.position.y = 38;
    const rings = [[5.2, 13, 0.5], [3.8, 22, -0.8], [2.6, 29, 1.2]].map(([r, y, tilt]) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.11, 8, 64), glowMat(d.lane.color, 2)); m.position.y = y; m.rotation.x = Math.PI / 2 + tilt * 0.25; g.add(m); return m;
    });
    const fan = new THREE.Group(); fan.position.y = 38;
    const laserGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true).translate(0, 0.5, 0).rotateZ(-Math.PI / 2);   // along +X
    const lasers = [0, 1, 2, 3].map((k) => {
      const arm = new THREE.Group(); arm.rotation.y = (k / 4) * TAU;
      const m = new THREE.Mesh(laserGeo, addMat(d.lane.color, 2.2, 0.75)); m.scale.set(190, 1, 1);
      arm.add(m); fan.add(arm); return m;
    });
    const light = lamp(0, 16, 6);
    g.add(spire, tip, glow, fan);
    block(0, 0, 3, 36);
    return (t) => {
      const p = d.power;
      fan.rotation.y = t * (0.14 + p * 0.22);
      lasers.forEach((m, k) => { m.rotation.z = -0.06 + Math.sin(t * 0.5 + k * 1.6) * 0.1; m.material.opacity = 0.25 + p * 0.6; });
      rings.forEach((m, k) => { m.rotation.z = t * (0.5 + k * 0.3) * (k % 2 ? -1 : 1); });
      tip.rotation.y = t * 1.2;
      glow.material.opacity = 0.35 + p * 0.4;
      light.intensity = 50 + p * 130;
    };
  },

  // C: a live equalizer, kicked at 124 BPM.
  'House & EDM'(d) {
    const { g, block, lamp } = monumentFrame(d);
    // Each bar is a stack of LED segments; a level lights the stack from the ground up.
    const N = 17, R = 15, SEG = 11, STEP = 1.45;
    const segs = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, STEP - 0.34, 2.3), new THREE.MeshBasicMaterial({ color: '#ffffff' }), N * SEG);
    const capGeo = new THREE.BoxGeometry(2.3, 0.22, 2.3), capMat = glowMat('#eafffa', 1.6);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    const dim = hdr(d.lane.color, 0.07), lit = new THREE.Color(), base = new THREE.Color(d.lane.color);
    const bars = [];
    for (let k = 0; k < N; k++) {
      const a = Math.PI + (k / (N - 1) - 0.5) * THREE.MathUtils.degToRad(210), x = Math.sin(a) * R, z = Math.cos(a) * R;
      q.setFromAxisAngle(up, a);
      for (let s = 0; s < SEG; s++) { segs.setMatrixAt(k * SEG + s, m4.compose(v.set(x, 0.75 + s * STEP, z), q, one)); segs.setColorAt(k * SEG + s, dim); }
      const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(x, 3, z); cap.rotation.y = a;
      g.add(cap);
      block(x, z, 1.55);      // as with the columns: solid to the glider, not a wall to the camera
      bars.push({ cap, f: Math.abs(k - (N - 1) / 2) / ((N - 1) / 2), hold: 3, k });
    }
    segs.castShadow = SHADOWS;
    g.add(segs);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7.5, 48).rotateX(-Math.PI / 2), addMat(d.lane.color, 1, 0.2, POOL_TEX)); disc.position.y = 0.15;
    const light = lamp(0, 6, 0);
    g.add(disc);
    return (t, dt) => {
      const p = d.power, kick = Math.exp(-5 * ((t * 124 / 60) % 1));
      for (const b of bars) {
        const wob = (0.5 + 0.5 * Math.sin(t * (2.1 + b.f * 5.3) + b.k * 1.7)) * (0.55 + 0.45 * Math.sin(t * 0.43 + b.k * 0.6));
        const level = clamp((0.12 + 0.5 * kick * (1 - b.f) * (1 - b.f) + 0.36 * wob) * (0.55 + 0.45 * p), 0.09, 1);
        const on = level * SEG;
        for (let s = 0; s < SEG; s++) {
          // The top lit segment burns hottest, like a real meter.
          if (s < on) segs.setColorAt(b.k * SEG + s, lit.copy(base).multiplyScalar(s + 1 >= on ? 2.6 : 1.1 + 0.5 * (s / SEG)));
          else segs.setColorAt(b.k * SEG + s, dim);
        }
        const h = Math.ceil(on) * STEP + 0.3;
        b.hold = Math.max(h, b.hold - dt * 5);
        b.cap.position.y = b.hold;
      }
      segs.instanceColor.needsUpdate = true;
      disc.material.opacity = 0.1 + kick * (0.15 + p * 0.3);
      disc.scale.setScalar(1 + kick * 0.25);
      light.intensity = 30 + kick * (60 + p * 160);
    };
  },

  // D: a standing ring you can fly through; the ground thumps at half time.
  'Bass'(d) {
    const { g, block, lamp } = monumentFrame(d);
    const R = 11, CY = 8;
    const ring = shade(new THREE.Mesh(new THREE.TorusGeometry(R, 1.3, 10, 64), STONE_DARK), true, true); ring.position.y = CY;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 1.36, 0.14, 8, 96), glowMat(d.lane.color, 2.4)); rim.position.y = CY;
    const coreMat = new THREE.MeshStandardMaterial({ color: '#0d0a14', roughness: 0.25, metalness: 0.7, emissive: d.lane.color, emissiveIntensity: 0.25 });
    const core = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 2), coreMat)); core.position.y = CY + 2.2;
    const waves = [0, 1, 2].map((k) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 96).rotateX(-Math.PI / 2), addMat(d.lane.color, 1.5, 0)); m.position.y = 0.15 + k * 0.01; g.add(m); return m;
    });
    const light = lamp(0, CY, 5);
    g.add(ring, rim, core);
    for (const side of [-1, 1]) { block(side * 7.6, 0, 1.9, 6); block(side * 9.6, 0, 1.5, 9); block(side * 10.8, 0, 1.2, 12); }
    return (t) => {
      const p = d.power, beat = (t * 87 / 60) % 1, kick = Math.exp(-6 * beat);
      core.scale.setScalar(1 + kick * (0.1 + p * 0.22));
      coreMat.emissiveIntensity = 0.15 + kick * (0.5 + p * 2);
      waves.forEach((m, k) => {
        const ph = (beat + k / 3) % 1;
        m.scale.setScalar(5 + ph * 44);
        m.material.opacity = (1 - ph) * (1 - ph) * (0.1 + p * 0.26);
      });
      light.intensity = 40 + kick * (60 + p * 200);
    };
  },

  // E: standing keys, and a keyboard in the road that plays as you cross it.
  'Piano'(d) {
    const { g, block, local, lamp } = monumentFrame(d);
    const ivory = new THREE.MeshStandardMaterial({ color: '#b9bdcb', roughness: 0.5, metalness: 0.05, emissive: d.lane.color, emissiveIntensity: 0.03 });
    const ebony = new THREE.MeshStandardMaterial({ color: '#0e0e16', roughness: 0.25, metalness: 0.5 });
    const heights7 = [15, 19, 23, 17, 21, 25, 18];
    heights7.forEach((h, k) => {
      const x = (k - 3) * 2.5;
      const key = shade(new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 1.3), ivory), true, true); key.position.set(x, h / 2 - 0.2, 0);
      g.add(key);
      if ([0, 1, 3, 4, 5].includes(k)) {
        const sharp = shade(new THREE.Mesh(new THREE.BoxGeometry(1.4, h * 0.62, 1.5), ebony)); sharp.position.set(x + 1.25, h * 0.69 + 0.5, 0.55);
        g.add(sharp);
      }
    });
    for (const x of [-6, 0, 6]) block(x, 0, 2.4, 24);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.16, 1.9), glowMat(d.lane.color, 1.05)); strip.position.set(0, 0.1, 0);
    const light = lamp(0, 9, 6);
    g.add(strip);
    // The playable keyboard: 14 white keys from the gate to the monument.
    const KEYS = 14, PITCH = 3, Z0 = 56, HALF_W = 6.5;
    const keyGeo = new THREE.BoxGeometry(HALF_W * 2, 0.34, PITCH - 0.28), sharpGeo = new THREE.BoxGeometry(7.4, 0.5, 1.5);
    const keys = [];
    for (let j = 0; j < KEYS; j++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#b4b8c6', roughness: 0.5, emissive: d.lane.color, emissiveIntensity: 0 });
      const key = shade(new THREE.Mesh(keyGeo, mat), false, true); key.position.set(0, 0.05, Z0 - (j + 0.5) * PITCH);
      g.add(key); keys.push({ key, mat, glow: 0 });
      if ([0, 1, 3, 4, 5].includes(j % 7) && j < KEYS - 1) {
        const sharp = shade(new THREE.Mesh(sharpGeo, ebony), false, true); sharp.position.set(-2.8, 0.2, Z0 - (j + 1) * PITCH);
        g.add(sharp);
      }
    }
    const lp = { x: 0, z: 0 };
    let last = -1;
    return (t, dt) => {
      const p = d.power;
      ivory.emissiveIntensity = 0.03 + p * 0.2 + Math.sin(t * 1.3) * 0.01;
      light.intensity = 40 + p * 120;
      local(player.pos.x, player.pos.z, lp);
      const over = Math.abs(lp.x) < HALF_W && lp.z < Z0 && lp.z > Z0 - KEYS * PITCH && player.alt < 3.2 ? Math.floor((Z0 - lp.z) / PITCH) : -1;
      if (over !== last) {
        if (over >= 0 && game.mode === 'play') { keys[over].glow = 1; sfx.key(over); }
        last = over;
      }
      for (const k of keys) {
        k.glow = Math.max(0, k.glow - dt * 1.6);
        k.mat.emissiveIntensity = k.glow * 0.75;
        k.key.position.y = 0.05 - k.glow * 0.12;
      }
    };
  },

  // F: obsidian shards with live edges.
  'Punk & Rock'(d) {
    const { g, block, lamp } = monumentFrame(d);
    const obsidian = new THREE.MeshStandardMaterial({ color: '#191218', roughness: 0.3, metalness: 0.45, flatShading: true });
    const edgeMat = new THREE.LineBasicMaterial({ color: hdr(d.lane.color, 2.6) });
    const rand = rng(77);
    const shards = [[0, 0, 26, 3.4, 0.05, 0], [4.5, 2, 17, 2.6, 0.32, 0.6], [-4.8, 1, 19, 2.8, 0.3, 3.4], [2, -5, 14, 2.4, 0.38, 5.2], [-2.5, 5.2, 11, 2.2, 0.42, 1.9], [7.5, -3, 9, 2, 0.5, 5.9], [-7.6, -3.4, 10, 2, 0.48, 4.1], [0.5, 8, 7, 1.8, 0.55, 2.6]];
    for (const [x, z, h, r, tilt, dir] of shards) {
      const geo = new THREE.ConeGeometry(r, h, 5, 1).translate(0, h / 2 - 1.5, 0);
      const m = shade(new THREE.Mesh(geo, obsidian), true, true);
      m.position.set(x, 0, z);
      m.rotation.set(Math.cos(dir) * tilt, rand() * TAU, -Math.sin(dir) * tilt, 'YXZ');
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat);
      m.add(edges);
      g.add(m);
    }
    block(0, 0, 5.2, 24); block(5.5, 1, 2.6, 14); block(-5.6, 0, 2.8, 15); block(1.5, -5, 2.4, 11); block(-2.5, 5.6, 2.2, 9);
    const light = lamp(0, 7, 5);
    const glow = sprite(d.lane.color, 1.1, 30, 0.3); glow.position.y = 9;
    g.add(glow);
    const base = new THREE.Color(d.lane.color);
    return (t) => {
      const p = d.power;
      const flick = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3) + (Math.sin(t * 3.1) > 0.96 ? 0.6 : 0);
      edgeMat.color.copy(base).multiplyScalar((1.2 + p * 2.6) * flick);
      light.intensity = (50 + p * 150) * flick;
      glow.material.opacity = (0.16 + p * 0.3) * flick;
    };
  },

  // G: a wire globe with three small worlds in tow.
  'World & Pop'(d) {
    const { g, block, lamp } = monumentFrame(d);
    const CY = 13.5;
    const ped = shade(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.4, 4, 8), STONE_DARK), true, true); ped.position.y = 1.8;
    const globe = new THREE.Group(); globe.position.y = CY; globe.rotation.z = 0.41;
    const wireMat = new THREE.LineBasicMaterial({ color: hdr(d.lane.color, 2.2) });
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(8.6, 2), 1), wireMat);
    const innerMat = new THREE.MeshStandardMaterial({ color: '#2a1326', roughness: 0.5, metalness: 0.2, emissive: d.lane.color, emissiveIntensity: 0.25, flatShading: true });
    const inner = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(5.4, 1), innerMat));
    globe.add(wire, inner);
    const moons = [[11.5, 0.5, 0.7, '#ffd26a'], [13.5, -0.35, 0.45, '#7ae0ff'], [15.5, 0.2, 0.3, '#ffffff']].map(([r, tilt, speed, hex]) => {
      const arm = new THREE.Group(); arm.position.y = CY; arm.rotation.z = tilt;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), glowMat(hex, 2.2)); m.position.x = r;
      arm.add(m); g.add(arm);
      return { arm, speed };
    });
    const light = lamp(0, CY - 4, 7);
    const glow = sprite(d.lane.color, 1.1, 30, 0.3); glow.position.y = CY;
    g.add(ped, globe, glow);
    block(0, 0, 3.6);
    const base = new THREE.Color(d.lane.color);
    return (t) => {
      const p = d.power;
      globe.rotation.y = t * (0.12 + p * 0.2);
      moons.forEach((m, k) => { m.arm.rotation.y = t * m.speed + k * 2; });
      wireMat.color.copy(base).multiplyScalar(1 + p * 2);
      innerMat.emissiveIntensity = 0.18 + p * 0.7 + Math.sin(t * 1.4) * 0.05;
      light.intensity = 50 + p * 150;
      glow.material.opacity = 0.18 + p * 0.3;
    };
  },
};
for (const d of districts) {
  d.power = 0.25;
  const build = MONUMENTS[d.lane.name];
  if (build) animated.push({ d, update: build(d) });
}
