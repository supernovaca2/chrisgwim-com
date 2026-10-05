
// ---------- Renderer ----------
const canvasEl = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
const viewW = () => Math.max(innerWidth, 64);
const viewH = () => Math.max(innerHeight, 64);
renderer.setPixelRatio(DPR);
renderer.setSize(viewW(), viewH());
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const SHADOWS = !small;
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c58393', 110, 1250);
const BASE_FOV = small ? 70 : 56;
const camera = new THREE.PerspectiveCamera(BASE_FOV, viewW() / viewH(), 0.3, 3400);
camera.position.set(0, 16, 70);

// Multisampled HDR target: flat-shaded dunes alias badly without it.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: small ? 0 : 4 }));
composer.setSize(viewW(), viewH());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(viewW(), viewH()), 0.5, 0.62, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Sky ----------
const skyU = {
  uHorizon: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
  uSunCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uSunCos: { value: Math.cos(0.04) },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 40, 24), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uHorizon, uLow, uMid, uZenith, uSunCol, uSunDir;
    uniform float uSunCos;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = max(d.y, 0.0);
      vec3 col = mix(uHorizon, uLow, smoothstep(0.0, 0.11, h));
      col = mix(col, uMid, smoothstep(0.07, 0.34, h));
      col = mix(col, uZenith, smoothstep(0.26, 0.88, h));
      float s = max(dot(d, uSunDir), 0.0);
      float low = 1.0 - smoothstep(0.0, 0.42, h);
      col += uSunCol * (pow(s, 4.0) * 0.26 * low + pow(s, 22.0) * 0.3 + pow(s, 260.0) * 0.7);
      col += uSunCol * smoothstep(uSunCos - 0.00025, uSunCos + 0.00025, s) * 5.0;
      col = mix(col, uHorizon, 1.0 - smoothstep(-0.06, 0.0, d.y));
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
sky.renderOrder = -1000; sky.frustumCulled = false;
scene.add(sky);

const starU = { uTime: { value: 0 }, uAlpha: { value: 0.4 }, uPx: { value: DPR } };
const stars = (() => {
  const n = small ? 700 : 1700, rand = rng(7);
  const pos = new Float32Array(n * 3), aux = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const y = 0.03 + rand() * 0.97, a = rand() * TAU, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 95, y * 95, Math.sin(a) * r * 95], i * 3);
    aux.set([rand(), 1.1 + Math.pow(rand(), 3) * 2.6], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 2));
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthTest: false, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec2 aAux; uniform float uTime, uPx; varying float vA;
      void main() {
        vA = (0.62 + 0.38 * sin(uTime * (0.5 + aAux.x * 1.9) + aAux.x * 44.0)) * smoothstep(0.02, 0.3, normalize(position).y);
        gl_PointSize = aAux.y * uPx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.95, 0.9) * 1.25, (1.0 - smoothstep(0.05, 0.5, d)) * vA * uAlpha); }`,
  }));
  points.renderOrder = -999; points.frustumCulled = false;
  scene.add(points);
  return points;
})();

// ---------- Light ----------
const hemi = new THREE.HemisphereLight('#8f7fd6', '#6a3f52', 1.5);
const sun = new THREE.DirectionalLight('#ffb184', 3.4);
scene.add(hemi, sun, sun.target);
const SUN_BEARING = THREE.MathUtils.degToRad(322);
const bearingDir = (bearing, elev) => new THREE.Vector3(Math.sin(bearing) * Math.cos(elev), Math.sin(elev), -Math.cos(bearing) * Math.cos(elev));
const LIGHT_DIR = bearingDir(SUN_BEARING, THREE.MathUtils.degToRad(20));     // where the light comes from; fixed, so shadows never swim
const SHADOW_R = 120, SHADOW_MAP = 2048;
if (SHADOWS) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  const c = sun.shadow.camera;
  c.left = -SHADOW_R; c.right = SHADOW_R; c.top = SHADOW_R; c.bottom = -SHADOW_R; c.near = 40; c.far = 900;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5;
}
// The shadow box follows the glider in whole texels, which keeps edges from crawling.
const lightX = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), LIGHT_DIR).normalize();
const lightY = new THREE.Vector3().crossVectors(LIGHT_DIR, lightX).normalize();
const shadowCenter = new THREE.Vector3();
function aimSun(p) {
  const texel = (SHADOW_R * 2) / SHADOW_MAP;
  const px = Math.round(p.dot(lightX) / texel) * texel, py = Math.round(p.dot(lightY) / texel) * texel;
  shadowCenter.set(0, 0, 0).addScaledVector(lightX, px).addScaledVector(lightY, py).addScaledVector(LIGHT_DIR, p.dot(LIGHT_DIR));
  sun.target.position.copy(shadowCenter);
  sun.position.copy(shadowCenter).addScaledVector(LIGHT_DIR, 420);
}
aimSun(new THREE.Vector3());

// ---------- Time of day: dusk at the start, deeper with every beacon, dawn when all are lit ----------
const mkPal = (o) => { const p = {}; for (const k in o) p[k] = typeof o[k] === 'string' ? new THREE.Color(o[k]) : o[k]; return p; };
const PAL = {
  dusk: mkPal({ horizon: '#e29a8c', low: '#a8629a', mid: '#4f3a86', zenith: '#14143a', sunCol: '#ffc48c', fog: '#c98694', hemiSky: '#9484da', hemiGround: '#6d4256', sunLight: '#ffb184', sunI: 3.5, hemiI: 1.5, stars: 0.4, elev: 6.5, bloom: 0.5 }),
  night: mkPal({ horizon: '#6a5fb0', low: '#41408e', mid: '#1d2262', zenith: '#070a26', sunCol: '#b68ad0', fog: '#5a5298', hemiSky: '#7c8cf0', hemiGround: '#35305f', sunLight: '#b9b4ff', sunI: 2.0, hemiI: 1.45, stars: 1, elev: -3.5, bloom: 0.62 }),
  dawn: mkPal({ horizon: '#ffd2a0', low: '#f29c8e', mid: '#8292d8', zenith: '#2a3d8e', sunCol: '#fff0c8', fog: '#eeb49c', hemiSky: '#aab8ff', hemiGround: '#8a5c52', sunLight: '#ffd6a2', sunI: 4.1, hemiI: 1.8, stars: 0.05, elev: 9, bloom: 0.46 }),
};
const palNow = mkPal({ horizon: '#000', low: '#000', mid: '#000', zenith: '#000', sunCol: '#000', fog: '#000', hemiSky: '#000', hemiGround: '#000', sunLight: '#000', sunI: 0, hemiI: 0, stars: 0, elev: 0, bloom: 0 });
const mood = { night: 0, dawn: 0 };
function applyMood() {
  const a = PAL.dusk, b = PAL.night, c = PAL.dawn, n = mood.night, d = mood.dawn;
  for (const k in palNow) {
    if (palNow[k].isColor) { palNow[k].lerpColors(a[k], b[k], n); if (d > 0) palNow[k].lerp(c[k], d); }
    else palNow[k] = lerp(lerp(a[k], b[k], n), c[k], d);
  }
  skyU.uHorizon.value.copy(palNow.horizon); skyU.uLow.value.copy(palNow.low); skyU.uMid.value.copy(palNow.mid); skyU.uZenith.value.copy(palNow.zenith);
  skyU.uSunCol.value.copy(palNow.sunCol);
  skyU.uSunDir.value.copy(bearingDir(SUN_BEARING, THREE.MathUtils.degToRad(palNow.elev)));
  scene.fog.color.copy(palNow.fog);
  hemi.color.copy(palNow.hemiSky); hemi.groundColor.copy(palNow.hemiGround); hemi.intensity = palNow.hemiI;
  sun.color.copy(palNow.sunLight); sun.intensity = palNow.sunI;
  starU.uAlpha.value = palNow.stars;
  bloom.strength = palNow.bloom;
}
applyMood();

// ---------- Terrain ----------
const terrain = (() => {
  const pos = new Float32Array(G1 * G1 * 3), col = new Float32Array(G1 * G1 * 3);
  const cLo = new THREE.Color('#6b4a66'), cHi = new THREE.Color('#dba88c'), cRoad = new THREE.Color('#caa097'), cPlaza = new THREE.Color('#8d7088');
  const cRock = new THREE.Color('#473752'), cPeak = new THREE.Color('#d4aeb6'), tmp = new THREE.Color();
  const laneC = lanes.map((l) => new THREE.Color(l.color));
  for (let iz = 0; iz < G1; iz++) {
    for (let ix = 0; ix < G1; ix++) {
      const i = iz * G1 + ix, h = heights[i];
      const road = groundMask[i * 3], plaza = groundMask[i * 3 + 1], rim = groundMask[i * 3 + 2], lane = groundLane[i];
      pos[i * 3] = -HALF_GRID + ix * CELL; pos[i * 3 + 1] = h; pos[i * 3 + 2] = -HALF_GRID + iz * CELL;
      tmp.lerpColors(cLo, cHi, clamp(smooth(-6, 9, h) + (hash(ix, iz) - 0.5) * 0.1, 0, 1));
      if (road > 0) tmp.lerp(cRoad, road * 0.62);
      if (plaza > 0) tmp.lerp(cPlaza, plaza * 0.72);
      if (lane >= 0) tmp.lerp(laneC[lane], 0.08 * Math.max(road, plaza));
      if (rim > 0) { tmp.lerp(cRock, smooth(0, 0.3, rim)); tmp.lerp(cPeak, smooth(64, 150, h) * 0.85); }
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
  }
  const index = new Uint32Array(GRID_N * GRID_N * 6);
  let k = 0;
  for (let iz = 0; iz < GRID_N; iz++) {
    for (let ix = 0; ix < GRID_N; ix++) {
      const a = iz * G1 + ix, b = a + 1, c = a + G1, d = c + 1;
      index[k++] = a; index[k++] = c; index[k++] = b;
      index[k++] = b; index[k++] = c; index[k++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0 }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
})();

// ---------- Shared bits ----------
function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, a]) => grd.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW_TEX = radialTexture([[0, 1], [0.25, 0.5], [0.6, 0.12], [1, 0]]);
const POOL_TEX = radialTexture([[0, 0.9], [0.35, 0.42], [0.75, 0.08], [1, 0]]);
// A shaft of light: brightest where you look through its middle, gone at its edges and its top.
// A plain transparent cylinder reads as a flat bar; this reads as a volume.
function beamMaterial(hex, k, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: hdr(hex, k) }, uOpacity: { value: opacity } },
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vP; varying float vV;
      void main() {
        vV = uv.y; vN = normalMatrix * normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vP; varying float vV;
      void main() {
        // Clamp before pow(): multisampling can extrapolate vV a hair past 1, pow() of a negative
        // number is undefined, and one invalid pixel is smeared by bloom into a black block.
        float up = clamp(1.0 - vV, 0.0, 1.0);
        float f = abs(dot(normalize(vN), normalize(-vP)));
        float fall = pow(up, 1.7) * 0.86 + up * 0.14;
        gl_FragColor = vec4(max(uColor * (f * f * fall * uOpacity), vec3(0.0)), 1.0);
      }`,
  });
}
const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const glowMat = (hex, k = 1.6, opts = {}) => new THREE.MeshBasicMaterial({ color: hdr(hex, k), ...opts });
const addMat = (hex, k, opacity, map = null) => new THREE.MeshBasicMaterial({ color: hdr(hex, k), map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
const STONE = new THREE.MeshStandardMaterial({ color: '#2b2535', roughness: 0.82, metalness: 0.06, flatShading: true });
const STONE_DARK = new THREE.MeshStandardMaterial({ color: '#17141f', roughness: 0.7, metalness: 0.15, flatShading: true });
const shade = (mesh, cast = true, receive = false) => { mesh.castShadow = SHADOWS && cast; mesh.receiveShadow = SHADOWS && receive; return mesh; };
const colliders = [];       // circles the glider cannot enter: { x, z, r, top }. A top marks it tall enough to block the camera too.
const animated = [];        // things with a per-frame update(time, dt)

// Crisp text on a canvas texture, drawn once the web fonts are in.
function textTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; t.generateMipmaps = true;
  return t;
}
const FONT_DISPLAY = (px, weight = 900) => `${weight} ${px}px "Big Shoulders Display Variable", "Arial Narrow", Impact, sans-serif`;
const FONT_MONO = (px, weight = 500) => `${weight} ${px}px "Geist Mono Variable", ui-monospace, Consolas, monospace`;
function fitText(g, text, maxW, px, font) {
  let size = px;
  g.font = font(size);
  while (g.measureText(text).width > maxW && size > 12) { size -= 2; g.font = font(size); }
  return size;
}
function spaced(g, text, x, y, spacing) {       // canvas letter-spacing without relying on the newer API
  let cx = x;
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + spacing; }
  return cx - x;
}
