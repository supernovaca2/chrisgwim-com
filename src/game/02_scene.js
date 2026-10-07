// ===== part 2: renderer, bloom, sky, floor, cover atlas, voxel material, camera =====
// The field: x across, z toward the player (the cannon sits at z = 0, the invaders come
// from negative z). Gameplay is 2D in (x, z); height only follows flyY(z), a gentle ramp
// that lifts the far rows so they never hide behind the near ones.
const HW = 27;                  // half width of the field
const Z_BUNKER = -12;
const Z_INVADE = -4;            // the formation's front reaching this line is an invasion
const Z_SHIP = -64;             // the Record Ship's flight line
const Z_FAR = -80;              // shots die past here
const flyY = (z) => 1.8 + Math.max(0, -z) * 0.1;

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
const small = touchUI || Math.min(screen.width || 1000, screen.height || 1000) < 600;
const DPR_CAP = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(DPR_CAP);
renderer.setSize(viewW(), viewH(), false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x020309, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, viewW() / viewH(), 0.5, 2400);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: small ? 0 : 4 }));
composer.setPixelRatio(DPR_CAP);
composer.setSize(viewW(), viewH());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(viewW(), viewH()), 0.75, 0.5, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const LANE_COL = LANES.map((l) => new THREE.Color(l.color));

// ---------- Sky: deep space, a nebula tinted by the wave, a ringed giant, the limb of Earth below ----------
const NOISE_GLSL = /* glsl */`
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise3(p); p = p * 2.03 + vec3(3.1, 1.7, 4.3); a *= 0.5; } return s; }
`;
const skyU = {
  uNebA: { value: new THREE.Color('#ffb347') }, uNebB: { value: new THREE.Color('#5a2aff') },
  uTime: { value: 0 }, uBeat: { value: 0 },
  uPlanetDir: { value: new THREE.Vector3(-0.5, -0.17, -1).normalize() }, uPlanetR: { value: 0.17 },
  uSunDir: { value: new THREE.Vector3(0.8, 0.1, -0.55).normalize() },
  uP1: { value: new THREE.Color('#2a3f7a') }, uP2: { value: new THREE.Color('#d9739c') },
  uAtmo: { value: new THREE.Color('#3f8dff') },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uNebA, uNebB, uPlanetDir, uSunDir, uP1, uP2, uAtmo;
    uniform float uTime, uBeat, uPlanetR;
    varying vec3 vDir;
    ${NOISE_GLSL}
    void main() {
      vec3 d = normalize(vDir);
      float up = clamp(d.y + 0.4, 0.0, 1.0);
      vec3 col = mix(vec3(0.012, 0.014, 0.04), vec3(0.003, 0.004, 0.014), up);
      // Nebula: two layers of noise, strongest along a tilted band.
      float n = fbm3(d * 2.1 + vec3(0.0, 0.0, uTime * 0.006));
      float n2 = fbm3(d * 4.7 + vec3(5.2, 1.3, uTime * 0.004));
      float by = d.y + 0.12 - 0.16 * d.x;
      float band = exp(-by * by * 9.0);
      float neb = smoothstep(0.38, 0.86, n) * (0.45 + 0.55 * n2);
      float wisps = clamp(n2 - 0.45, 0.0, 1.0);
      col += uNebA * neb * (0.18 + 0.62 * band) * (0.85 + uBeat * 0.25);
      col += uNebB * wisps * wisps * 2.2 * (0.3 + band);
      // Distant sun glare.
      float s = max(dot(d, uSunDir), 0.0);
      col += vec3(1.0, 0.82, 0.62) * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.12 + pow(s, 6.0) * 0.04);
      // A ringed giant beyond the invasion.
      vec3 c = normalize(uPlanetDir);
      float ca = dot(d, c);
      if (ca > 0.0) {
        vec3 u = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
        vec3 v = cross(u, c);
        float sr = sin(uPlanetR);
        vec2 p = vec2(dot(d, u), dot(d, v)) / sr;
        float r = length(p);
        float ang = -0.32;
        vec2 rp = vec2(p.x * cos(ang) - p.y * sin(ang), p.x * sin(ang) + p.y * cos(ang));
        vec2 rq = vec2(rp.x, rp.y / 0.22);
        float rr = length(rq);
        float ringMask = smoothstep(1.32, 1.38, rr) * (1.0 - smoothstep(2.2, 2.32, rr)) * (0.45 + 0.55 * sin(rr * 34.0) * sin(rr * 11.0 + 1.0));
        ringMask *= 1.0 - 0.6 * smoothstep(1.7, 1.78, rr) * (1.0 - smoothstep(1.82, 1.9, rr));
        vec3 ringCol = mix(uP2, vec3(1.0, 0.9, 0.8), 0.35) * 0.55;
        vec3 L = normalize(uSunDir);
        if (r < 1.0) {
          float z = sqrt(max(1.0 - r * r, 0.0));
          vec3 N = normalize(p.x * u + p.y * v - z * c);
          float lit = clamp(dot(N, L) * 1.1 + 0.08, 0.0, 1.0);
          float lat = p.y * 0.8 + p.x * 0.18;
          float bands = fbm3(vec3(lat * 9.0, lat * 2.0, 1.7)) + 0.25 * sin(lat * 38.0);
          vec3 surf = mix(uP1, uP2, clamp(bands, 0.0, 1.0));
          float rim = pow(clamp(1.0 - z, 0.0, 1.0), 2.5);
          col = surf * (0.03 + lit * 0.95) + uAtmo * rim * (0.15 + lit * 0.9);
          // ring shadow on the disc
          if (rp.y > 0.0 && rr > 1.32 && rr < 2.3) col *= 0.55;
          if (rp.y < 0.0) col = mix(col, ringCol, clamp(ringMask, 0.0, 1.0) * 0.9);
        } else {
          col += uAtmo * exp(-(r - 1.0) * 22.0) * 0.5;
          col += ringCol * clamp(ringMask, 0.0, 1.0) * 0.8;
        }
      }
      // Below the horizon: the night side of Earth, its limb glowing. We hold the orbit above it.
      float h = d.y + 0.5 + 0.06 * d.x * d.x;
      if (h < 0.0) {
        float city = smoothstep(0.82, 0.9, noise3(d * 160.0)) * smoothstep(0.45, 0.7, fbm3(d * 9.0));
        col = vec3(0.004, 0.009, 0.022) + vec3(1.0, 0.7, 0.4) * city * 0.35 * clamp(-h * 6.0, 0.0, 1.0);
      }
      float ah = abs(h);
      col += uAtmo * (exp(-ah * 90.0) * 1.3 + exp(-ah * 14.0) * 0.32) * (h < 0.0 ? 0.7 : 1.0);
      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }`,
}));
sky.renderOrder = -1000; sky.frustumCulled = false;
scene.add(sky);

const starU = { uTime: { value: 0 }, uPx: { value: DPR_CAP } };
const stars = (() => {
  const n = small ? 900 : 1800, rand = mulberry(11);
  const pos = new Float32Array(n * 3), aux = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const y = -0.55 + rand() * 1.5, a = rand() * TAU, r = Math.sqrt(Math.max(0, 1 - y * y));
    pos.set([Math.cos(a) * r * 900, y * 900, Math.sin(a) * r * 900], i * 3);
    aux.set([rand(), 0.8 + Math.pow(rand(), 4) * 3.2], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 2));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec2 aAux; uniform float uTime, uPx; varying float vA;
      void main() {
        vec3 d = normalize(position);
        vA = (0.6 + 0.4 * sin(uTime * (0.6 + aAux.x * 2.0) + aAux.x * 40.0)) * smoothstep(-0.01, 0.06, d.y + 0.5 + 0.06 * d.x * d.x);
        gl_PointSize = aAux.y * uPx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.95, 0.96, 1.0) * 1.4, (1.0 - smoothstep(0.1, 0.5, d)) * vA); }`,
  }));
  pts.renderOrder = -999; pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();

// ---------- Floor: a glowing grid that ripples where shots land and catches light from explosions ----------
const MAX_RIP = 8, MAX_LIT = 10;
const floorU = {
  uTime: { value: 0 }, uBeat: { value: 0 }, uLine: { value: new THREE.Color('#ffb347') }, uLine2: { value: new THREE.Color('#ff3f8e') },
  uDanger: { value: 0 }, uInvZ: { value: Z_INVADE }, uHW: { value: HW }, uPlayerX: { value: 0 }, uMarch: { value: 0 },
  uRip: { value: Array.from({ length: MAX_RIP }, () => new THREE.Vector4(0, 0, -99, 0)) },
  uLit: { value: Array.from({ length: MAX_LIT }, () => new THREE.Vector4(0, 0, 1, 0)) },
  uLitC: { value: Array.from({ length: MAX_LIT }, () => new THREE.Color()) },
};
const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 400, 1, 1), new THREE.ShaderMaterial({
  uniforms: floorU, transparent: true, depthWrite: true,
  vertexShader: /* glsl */`
    varying vec3 vW;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uLine, uLine2; uniform float uTime, uBeat, uDanger, uInvZ, uHW, uPlayerX, uMarch;
    uniform vec4 uRip[${MAX_RIP}]; uniform vec4 uLit[${MAX_LIT}]; uniform vec3 uLitC[${MAX_LIT}];
    varying vec3 vW;
    float gridLine(vec2 q, out float lod) {
      vec2 fw = max(fwidth(q), vec2(1e-4));
      vec2 g = abs(fract(q - 0.5) - 0.5) / fw;
      lod = clamp(1.6 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
      return 1.0 - min(min(g.x, g.y), 1.0);
    }
    void main() {
      vec2 p = vW.xz;
      vec2 q = p; float rip = 0.0;
      for (int i = 0; i < ${MAX_RIP}; i++) {
        vec4 r = uRip[i];
        float age = uTime - r.z;
        if (age < 0.0 || age > 1.4) continue;
        vec2 dv = p - r.xy; float dd = length(dv);
        float x = (dd - age * 24.0) * 0.5;
        float b = exp(-x * x) * r.w * (1.0 - age / 1.4);
        rip += b;
        q += dv / max(dd, 0.001) * b * 0.8;
      }
      float lodA, lodB;
      float minor = gridLine(q / 2.25, lodA);
      float major = gridLine(q / 9.0, lodB);
      float inField = 1.0 - smoothstep(uHW + 0.5, uHW + 5.0, abs(p.x));
      float dist = -p.y;
      vec3 col = vec3(0.006, 0.008, 0.022) * (0.6 + 0.4 * inField);
      float pulse = 1.0 + uBeat * 0.9;
      col += uLine * (minor * 0.06 * lodA + major * 0.2 * lodB) * pulse * mix(0.3, 1.0, inField);
      col += uLine * rip * (0.12 + minor * 1.6 * lodA + major * 1.2);
      // rails along the field edges
      float rail = exp(-abs(abs(p.x) - uHW - 1.2) * 5.0);
      col += uLine2 * rail * (0.9 + uBeat * 0.8) * (0.4 + 0.6 * step(0.0, sin(p.y * 0.8 - uTime * 6.0)));
      // the player's lane, lit from the cannon
      float px = (p.x - uPlayerX) * 0.45;
      float pl = exp(-px * px) * exp(-abs(p.y) * 0.08);
      col += uLine * pl * 0.08;
      // dynamic lights: shots, blasts, ships
      for (int i = 0; i < ${MAX_LIT}; i++) {
        vec4 L = uLit[i];
        if (L.w <= 0.0) continue;
        vec2 dv = (p - L.xy) / L.z;
        float f = exp(-dot(dv, dv) * 2.2);
        col += uLitC[i] * L.w * f * (0.22 + minor * 1.2 * lodA + major * 0.8);
      }
      // the line they must not cross
      float inv = exp(-abs(p.y - uInvZ) * 3.5) * step(abs(p.x), uHW + 1.0);
      col += vec3(1.0, 0.12, 0.28) * inv * (0.35 + uDanger * 2.2) * (0.75 + 0.25 * sin(uTime * 9.0));
      float alpha = 1.0 - smoothstep(70.0, 118.0, dist);
      alpha *= 1.0 - smoothstep(40.0, 70.0, p.y);
      alpha *= 1.0 - smoothstep(uHW + 6.0, uHW + 34.0, abs(p.x));
      gl_FragColor = vec4(max(col, vec3(0.0)), alpha);
    }`,
}));
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -110);
floor.renderOrder = -10;
scene.add(floor);
let ripI = 0;
function ripple(x, z, strength = 1) {
  floorU.uRip.value[ripI].set(x, z, floorU.uTime.value, strength);
  ripI = (ripI + 1) % MAX_RIP;
}
// Floor lights are gathered each frame: request with addLight, flushed by flushLights.
const litQueue = [];
function addLight(x, z, radius, intensity, color) { if (intensity > 0.01) litQueue.push([x, z, radius, intensity, color]); }
function flushLights() {
  litQueue.sort((a, b) => b[3] - a[3]);
  for (let i = 0; i < MAX_LIT; i++) {
    const L = litQueue[i];
    if (L) { floorU.uLit.value[i].set(L[0], L[1], L[2], L[3]); floorU.uLitC.value[i].copy(L[4]); }
    else floorU.uLit.value[i].w = 0;
  }
  litQueue.length = 0;
}

// ---------- Glow pools: soft colored light under things that hover over the grid ----------
function radialTexture(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) grd.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW_TEX = radialTexture(128, [[0, 1], [0.2, 0.55], [0.5, 0.16], [1, 0]]);
const POOL_MAX = 200;
const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: GLOW_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), POOL_MAX);
pools.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
pools.setColorAt(0, new THREE.Color(0, 0, 0));
pools.instanceColor.setUsage(THREE.DynamicDrawUsage);
pools.frustumCulled = false; pools.renderOrder = -5;
scene.add(pools);
let poolN = 0;
const _m4 = new THREE.Matrix4(), _c = new THREE.Color(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function pool(x, z, size, color, k) {
  if (poolN >= POOL_MAX || k <= 0.01) return;
  _m4.makeScale(size, 1, size); _m4.setPosition(x, 0.03, z);
  pools.setMatrixAt(poolN, _m4);
  _c.copy(color).multiplyScalar(k);
  pools.setColorAt(poolN, _c);
  poolN++;
}
function flushPools() {
  pools.count = poolN;
  pools.instanceMatrix.needsUpdate = true;
  pools.instanceColor.needsUpdate = true;
  poolN = 0;
}

// ---------- Cover atlas: every cover in one texture, for ship panels, labels and the Mothership ----------
const ATLAS = 2048;
const atlasN = Math.max(1, Math.ceil(Math.sqrt(RELEASES.length)));
const atlasCell = Math.floor(ATLAS / atlasN);
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = ATLAS;
const atlasCtx = atlasCanvas.getContext('2d');
atlasCtx.fillStyle = '#15151f'; atlasCtx.fillRect(0, 0, ATLAS, ATLAS);
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.colorSpace = THREE.SRGBColorSpace;
atlasTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
let coversLoaded = 0;
function atlasRect(r) {
  const i = r._idx, cx = i % atlasN, cy = Math.floor(i / atlasN);
  const pad = 2 / ATLAS;
  return new THREE.Vector4(cx * atlasCell / ATLAS + pad, 1 - (cy + 1) * atlasCell / ATLAS + pad, atlasCell / ATLAS - pad * 2, atlasCell / ATLAS - pad * 2);
}
const coverPromise = Promise.all(RELEASES.map((r) => new Promise((done) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    const i = r._idx, x = (i % atlasN) * atlasCell, y = Math.floor(i / atlasN) * atlasCell;
    try { atlasCtx.drawImage(img, x, y, atlasCell, atlasCell); } catch (err) { /* a broken image stays a dark tile */ }
    atlasTex.needsUpdate = true;
    coversLoaded++;
    done();
  };
  img.onerror = () => { coversLoaded++; done(); };
  img.src = coverUrl(r, 'card');
})));

// A lit cover panel: the art from the atlas, a little emissive so it reads at night, scanline shimmer.
function coverMaterial(release, glow = 1.15) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: atlasTex }, uRect: { value: release ? atlasRect(release) : new THREE.Vector4(0, 0, 1, 1) }, uGlow: { value: glow }, uFlash: { value: 0 }, uTime: skyU.uTime, uEdge: { value: new THREE.Color('#ffffff') } },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec4 uRect; uniform float uGlow, uFlash, uTime; uniform vec3 uEdge;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(map, uRect.xy + vUv * uRect.zw).rgb;
        float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
        float edge = smoothstep(0.9, 0.98, e);
        float scan = 0.94 + 0.06 * sin(vUv.y * 180.0 - uTime * 8.0);
        vec3 col = c * uGlow * scan + uEdge * edge * 1.6 + vec3(uFlash);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------- Voxel material: every invader, bunker, ship and shard is built from these cubes ----------
// aCol.rgb is the voxel color, aCol.a how much it glows. Cube edges are lit, which gives the
// crisp voxel look; light comes from a fixed key above the field.
const voxelU = { uTime: skyU.uTime, uKey: { value: new THREE.Vector3(0.35, 0.85, 0.4).normalize() } };
const voxelMat = new THREE.ShaderMaterial({
  uniforms: voxelU,
  vertexShader: /* glsl */`
    attribute vec4 aCol;
    varying vec3 vN; varying vec4 vCol; varying vec3 vV; varying vec2 vUv;
    void main() {
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
      vCol = aCol; vUv = uv;
      vV = cameraPosition - w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uKey;
    varying vec3 vN; varying vec4 vCol; varying vec3 vV; varying vec2 vUv;
    void main() {
      vec3 n = normalize(vN);
      vec3 v = normalize(vV);
      float diff = max(dot(n, uKey), 0.0);
      float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.0);
      float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
      float edge = smoothstep(0.72, 0.95, e);
      vec3 base = vCol.rgb;
      vec3 col = base * (0.16 + 0.5 * diff + 0.18 * (n.y * 0.5 + 0.5));
      col += base * vCol.a * (0.3 + edge * 0.95);
      col += base * rim * 0.5;
      col *= 1.0 - (1.0 - edge) * 0.18;
      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }`,
});
const CUBE = new THREE.BoxGeometry(1, 1, 1);
function voxelMesh(capacity, geo = CUBE) {
  const g = geo.clone();
  const col = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  col.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aCol', col);
  const mesh = new THREE.InstancedMesh(g, voxelMat, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.userData.col = col;
  return mesh;
}
// Writes one cube: position, uniform size s (z stretched by sz), optional 3x3 rotation r (array of 9).
function putVoxel(mesh, i, x, y, z, s, color, glow, sz = 1, r = null) {
  const a = mesh.instanceMatrix.array, o = i * 16;
  if (r) {
    a[o] = r[0] * s; a[o + 1] = r[1] * s; a[o + 2] = r[2] * s; a[o + 3] = 0;
    a[o + 4] = r[3] * s; a[o + 5] = r[4] * s; a[o + 6] = r[5] * s; a[o + 7] = 0;
    a[o + 8] = r[6] * s * sz; a[o + 9] = r[7] * s * sz; a[o + 10] = r[8] * s * sz; a[o + 11] = 0;
  } else {
    a[o] = s; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = s; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = 0; a[o + 9] = 0; a[o + 10] = s * sz; a[o + 11] = 0;
  }
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
  const c = mesh.userData.col.array, k = i * 4;
  c[k] = color.r; c[k + 1] = color.g; c[k + 2] = color.b; c[k + 3] = glow;
}
function finishVoxels(mesh, n) {
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.col.needsUpdate = true;
}
// Rotation matrix (column-major 3x3) from yaw (y), pitch (x) and roll (z).
function rotMat(yaw, pitch, roll, out = new Float32Array(9)) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry * Rx * Rz, stored by columns
  out[0] = cy * cr + sy * sp * sr; out[1] = cp * sr; out[2] = -sy * cr + cy * sp * sr;
  out[3] = -cy * sr + sy * sp * cr; out[4] = cp * cr; out[5] = sy * sr + cy * sp * cr;
  out[6] = sy * cp; out[7] = -sp; out[8] = cy * cp;
  return out;
}

// ---------- Camera: framed to the field for any screen shape ----------
const cam = { base: new THREE.Vector3(0, 22, 26), target: new THREE.Vector3(0, 0, -26), shake: 0, kick: 0, sway: 0, fov: 48 };
function fitCamera() {
  const w = viewW(), h = viewH(), aspect = w / h;
  const tall = aspect < 0.8, shortScreen = h < 520;
  const pitch = THREE.MathUtils.degToRad(tall ? 57 : aspect < 1.3 ? 46 : 37);
  cam.fov = tall ? 56 : shortScreen ? 46 : 46;
  camera.clearViewOffset(); camera.zoom = 1;
  camera.fov = cam.fov; camera.aspect = aspect; camera.updateProjectionMatrix();
  const box = tall ? { x: 0.97, yb: -0.54, yt: 0.66 } : shortScreen ? { x: 0.93, yb: -0.9, yt: 0.62 } : { x: 0.92, yb: -0.86, yt: 0.7 };
  const pts = [[-HW - 2, 0, 3], [HW + 2, 0, 3], [-HW, 0, -30], [HW, 0, -30], [-HW, flyY(Z_SHIP) + 2.5, Z_SHIP], [HW, flyY(Z_SHIP) + 2.5, Z_SHIP]].map((p) => new THREE.Vector3(...p));
  const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
  let zc = -26, dist = 70;
  const v = new THREE.Vector3();
  for (let it = 0; it < 40; it++) {
    cam.target.set(0, 0, zc);
    camera.position.copy(cam.target).addScaledVector(dir, dist);
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    for (const p of pts) {
      v.copy(p).project(camera);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const sx = Math.max(-minX, maxX) / box.x, sy = (maxY - minY) / (box.yt - box.yb);
    const s = Math.max(sx, sy);
    dist *= 1 + (s - 1) * 0.8;
    const cy = (maxY + minY) / 2, want = (box.yt + box.yb) / 2;
    zc -= (cy - want) * dist * 0.35;
  }
  cam.base.copy(camera.position);
}
