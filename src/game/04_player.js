
// ---------- The glider ----------
const game = { mode: 'boot', overlay: null, time: 0, started: false, finale: 0, finaleCard: false, traveling: false };
const input = { throttle: 0, steer: 0, boost: false, drift: false };
const SPAWN = { x: 0, z: 38, yaw: 0 };
const player = {
  pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), vel: new THREE.Vector3(), yaw: SPAWN.yaw, vy: 0,
  steer: 0, pitch: 0, roll: 0, alt: 1.3, fwd: 0, speed: 0, boost: 1, boosting: false, drifting: false, bump: 0, lastGround: 0, moved: 0,
};
const P = { accel: 27, boostAccel: 46, brake: 36, reverse: 13, vmax: 40, vboost: 66, coast: 0.85, grip: 6.5, driftGrip: 1.25, airGrip: 0.9, turn: 2.05, hover: 1.3, cushion: 0.5, gravity: 30, vdamp: 9, radius: 1.05 };

const glider = new THREE.Group();
glider.rotation.order = 'YXZ';
{
  // Rough on purpose: with flat shading a glossy wing is one normal, so a sun glint would light the whole wing at once.
  const hullMat = new THREE.MeshStandardMaterial({ color: '#d8d2c8', roughness: 0.68, metalness: 0.05, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#12141b', roughness: 0.28, metalness: 0.55, flatShading: true });
  const redMat = glowMat(ACCENT, 2.2);
  // Nose points down -Z. A four-sided cone, flattened, reads as a dart.
  const hull = shade(new THREE.Mesh(new THREE.ConeGeometry(0.98, 4.6, 4, 1).rotateX(-Math.PI / 2).scale(1, 0.33, 1), hullMat));
  hull.position.z = -0.1;
  const spine = shade(new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4, 1).rotateX(-Math.PI / 2).scale(0.8, 0.5, 1), hullMat));
  spine.position.set(0, 0.2, 0.9);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10).scale(0.66, 0.5, 1.75), darkMat);
  canopy.position.set(0, 0.2, -0.25);
  glider.add(hull, spine, canopy);
  for (const side of [-1, 1]) {
    // A swept wing: a thin box with its outer edge pushed back, narrowed and dropped.
    const wingGeo = new THREE.BoxGeometry(2, 0.07, 1.7);
    const wp = wingGeo.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      if (wp.getX(i) > 0) { wp.setZ(i, wp.getZ(i) * 0.36 + 1.05); wp.setY(i, wp.getY(i) * 0.5 - 0.2); }
    }
    wingGeo.computeVertexNormals();
    const wing = shade(new THREE.Mesh(wingGeo, hullMat));
    wing.scale.x = side; wing.position.set(side * 1.42, -0.02, 0.95);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.62), redMat);
    tip.position.set(side * 2.43, -0.2, 2.0);
    const fin = shade(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.95), hullMat));
    fin.position.set(side * 0.5, 0.36, 1.75); fin.rotation.set(-0.38, 0, -side * 0.3);
    const pod = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 1.25, 10).rotateX(Math.PI / 2), darkMat));
    pod.position.set(side * 0.45, 0.0, 2.0);
    const flame = new THREE.Mesh(new THREE.CircleGeometry(0.2, 14), glowMat('#ff7a4a', 3.4));
    flame.position.set(side * 0.45, 0.0, 2.635);
    glider.add(wing, tip, fin, pod, flame);
  }
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 2.6), redMat);
  keel.position.set(0, -0.34, 0.2);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glowMat('#fff2dc', 3));
  nose.position.set(0, 0, -2.42);
  glider.add(keel, nose);
}
const engineGlow = [-1, 1].map((side) => { const s = sprite('#ff6a3a', 1.6, 2.2, 0.7); s.position.set(side * 0.45, 0, 2.75); glider.add(s); return s; });
const underglow = new THREE.PointLight('#ff6a4a', 5, 11, 1.8);
underglow.position.set(0, -0.7, 0.3);
// Aimed at the ground only: the top of the cone stays below the horizon, so the beam pools on
// the sand and never floods a pale wall a few meters ahead into pure white.
const headlight = new THREE.SpotLight('#ffe9cf', 150, 110, 0.24, 0.9, 1.25);
headlight.position.set(0, 0.7, -1.6);
headlight.target.position.set(0, -7.5, -30);
glider.add(underglow, headlight, headlight.target);
scene.add(glider);

// One light plays the nearest district; three more follow the nearest lit beacons.
const districtLight = new THREE.PointLight('#ffffff', 0, 80, 1.6);
const beaconLights = [0, 1, 2].map(() => new THREE.PointLight('#ffffff', 0, 52, 1.6));
scene.add(districtLight, ...beaconLights);

// ---------- Trails and particles ----------
function makeTrail(n, hex) {
  const pos = new Float32Array(n * 6), col = new Float32Array(n * 8), idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  const c = hdr(hex, 1.5), pts = [];
  return {
    reset() { pts.length = 0; },
    head(x, y, z, rx, rz) { if (pts.length) { const p = pts[0]; p.x = x; p.y = y; p.z = z; p.rx = rx; p.rz = rz; } else pts.push({ x, y, z, rx, rz }); },
    push(x, y, z, rx, rz) { pts.unshift({ x, y, z, rx, rz }); if (pts.length > n) pts.pop(); },
    draw(width, power) {
      for (let i = 0; i < n; i++) {
        const p = pts[Math.min(i, pts.length - 1)], t = i / (n - 1), w = width * (1 - t * 0.75), o = i * 6, q = i * 8;
        if (!p) continue;
        pos[o] = p.x - p.rx * w; pos[o + 1] = p.y; pos[o + 2] = p.z - p.rz * w;
        pos[o + 3] = p.x + p.rx * w; pos[o + 4] = p.y; pos[o + 5] = p.z + p.rz * w;
        const a = i < pts.length ? Math.pow(1 - t, 2.2) * power : 0;
        col[q] = col[q + 4] = c.r; col[q + 1] = col[q + 5] = c.g; col[q + 2] = col[q + 6] = c.b; col[q + 3] = col[q + 7] = a;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}
const trails = [makeTrail(26, '#ff6a3c'), makeTrail(26, '#ff6a3c')];

function makeParticles(max, { additive, grow, opacity, soft }) {
  const pos = new Float32Array(max * 3), aux = new Float32Array(max * 2), col = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3), life = new Float32Array(max), grav = new Float32Array(max);
  for (let i = 0; i < max; i++) aux[i * 2] = -1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 2));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const uniforms = { uScale: { value: 600 }, uGrow: { value: new THREE.Vector2(grow[0], grow[1]) }, uOpacity: { value: opacity }, uSoft: { value: soft } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */`
      attribute vec2 aAux; attribute vec3 aColor; uniform float uScale; uniform vec2 uGrow; varying float vA; varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float age = aAux.x;
        gl_PointSize = age < 0.0 ? 0.0 : aAux.y * (uGrow.x + age * uGrow.y) * uScale / max(0.2, -mv.z);
        vA = age < 0.0 ? 0.0 : (1.0 - age) * smoothstep(0.0, 0.08, age);
        vC = aColor;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity, uSoft; varying float vA; varying vec3 vC;
      void main() {
        float a = (1.0 - smoothstep(uSoft, 0.5, length(gl_PointCoord - 0.5))) * vA * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vC, a);
      }`,
  }));
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0;
  return {
    uniforms,
    spawn(x, y, z, vx, vy, vz, size, seconds, color, g = 0) {
      const i = cursor; cursor = (cursor + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      aux[i * 2] = 0; aux[i * 2 + 1] = size; life[i] = seconds; grav[i] = g;
      col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
    },
    update(dt) {
      const drag = Math.exp(-1.6 * dt);
      for (let i = 0; i < max; i++) {
        if (aux[i * 2] < 0) continue;
        aux[i * 2] += dt / life[i];
        if (aux[i * 2] >= 1) { aux[i * 2] = -1; continue; }
        vel[i * 3 + 1] -= grav[i] * dt;
        vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aAux.needsUpdate = true; geo.attributes.aColor.needsUpdate = true;
    },
  };
}
const dust = makeParticles(small ? 140 : 260, { additive: false, grow: [0.5, 2.4], opacity: 0.3, soft: 0.05 });
const sparks = makeParticles(small ? 200 : 420, { additive: true, grow: [1, -0.55], opacity: 1, soft: 0.1 });
const dustColor = new THREE.Color();
const SAND = new THREE.Color('#e0b094');

// Expanding rings on the ground, reused.
const shockwaves = [0, 1, 2, 3].map(() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72).rotateX(-Math.PI / 2), addMat('#ffffff', 1.6, 0));
  m.visible = false; m.userData.t = 1;
  scene.add(m);
  return m;
});
function shockwave(x, y, z, hex) {
  const m = shockwaves.reduce((a, b) => (b.userData.t > a.userData.t ? b : a));
  m.position.set(x, y + 0.2, z); m.material.color.copy(hdr(hex, 1.7)); m.userData.t = 0; m.visible = true;
}

function placePlayer(x, z, yaw) {
  player.pos.set(x, heightAt(x, z) + P.hover, z);
  player.vel.set(0, 0, 0); player.vy = 0; player.yaw = yaw; player.steer = 0; player.pitch = 0; player.roll = 0; player.fwd = 0; player.speed = 0;
  player.lastGround = heightAt(x, z);
  trails.forEach((t) => t.reset());
  cam.snap = true;
  syncGlider();
}
function syncGlider() {
  glider.position.copy(player.pos);
  glider.rotation.set(player.pitch, -player.yaw, player.roll);
}

// ---------- Physics: an arcade hovercraft over the height grid ----------
let trailClock = 0;
function stepPlayer(dt) {
  const p = player;
  const sinY = Math.sin(p.yaw), cosY = Math.cos(p.yaw);
  const fx = sinY, fz = -cosY, rx = cosY, rz = sinY;
  let vF = p.vel.x * fx + p.vel.z * fz, vR = p.vel.x * rx + p.vel.z * rz;
  const grounded = p.alt < 2.6;

  p.boosting = input.boost && input.throttle > 0 && p.boost > 0.02;
  p.boost = p.boosting ? Math.max(0, p.boost - dt * 0.3) : Math.min(1, p.boost + dt * 0.17);
  p.drifting = input.drift && grounded && Math.abs(vF) > 6;
  const vmax = p.boosting ? P.vboost : P.vmax;

  if (input.throttle > 0) {
    if (vF < vmax) vF = Math.min(vmax, vF + (p.boosting ? P.boostAccel : P.accel) * input.throttle * (grounded ? 1 : 0.45) * dt);
  } else if (input.throttle < 0) {
    vF = vF > 0.6 ? Math.max(0, vF + P.brake * input.throttle * dt) : Math.max(-P.reverse, vF + P.reverse * 1.7 * input.throttle * dt);
  } else {
    vF *= Math.exp(-P.coast * dt);
  }
  if (vF > vmax) vF = damp(vF, vmax, 1.4, dt);
  vR *= Math.exp(-(grounded ? (p.drifting ? P.driftGrip : P.grip) : P.airGrip) * dt);

  p.vel.x = fx * vF + rx * vR; p.vel.z = fz * vF + rz * vR;
  p.steer = damp(p.steer, input.steer, 10, dt);
  const authority = clamp(Math.abs(vF) / 9, 0.34, 1) * (1 - 0.3 * smooth(30, 66, Math.abs(vF))) * (grounded ? 1 : 0.6);
  p.yaw += p.steer * P.turn * authority * (vF < -0.6 ? -1 : 1) * (p.drifting ? 1.3 : 1) * dt;

  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;

  // Circles: push out along the normal and keep the sliding part of the velocity. In the corner
  // between two props, leaving one circle can mean entering the other, so it is done until
  // nothing touches (three rounds is plenty; most frames need one).
  for (let round = 0; round < 3; round++) {
    let touched = false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i], dx = p.pos.x - c.x, dz = p.pos.z - c.z, min = c.r + P.radius;
      if (dx > min || dx < -min || dz > min || dz < -min) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min - 1e-9 || d2 < 1e-6) continue;
      touched = true;
      const dist = Math.sqrt(d2), nx = dx / dist, nz = dz / dist;
      p.pos.x = c.x + nx * min; p.pos.z = c.z + nz * min;
      const vn = p.vel.x * nx + p.vel.z * nz;
      if (vn < 0) {
        p.vel.x -= 1.25 * vn * nx; p.vel.z -= 1.25 * vn * nz;
        p.vel.multiplyScalar(0.9);
        if (vn < -7) p.bump = Math.max(p.bump, Math.min(1, -vn / 40));
      }
    }
    if (!touched) break;
  }
  // The world ends in mountains; a soft wall turns you around before them.
  const r = Math.hypot(p.pos.x, p.pos.z);
  if (r > EDGE_R - 10) {
    const nx = p.pos.x / r, nz = p.pos.z / r, over = r - (EDGE_R - 10);
    p.vel.x -= nx * over * 5 * dt; p.vel.z -= nz * over * 5 * dt;
    if (r > EDGE_R + 14) { p.pos.x = nx * (EDGE_R + 14); p.pos.z = nz * (EDGE_R + 14); const vn = p.vel.x * nx + p.vel.z * nz; if (vn > 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; } }
  }

  // Height: a spring cushion near the ground, a plain fall above it.
  const gY = heightAt(p.pos.x, p.pos.z);
  const gap = gY + P.hover + P.cushion - p.pos.y;
  let ay = -P.gravity;
  if (gap > 0) ay += (P.gravity / P.cushion) * gap - P.vdamp * p.vy;
  p.vy += ay * dt;
  p.pos.y += p.vy * dt;
  if (p.pos.y < gY + 0.5) {
    const groundVy = (gY - p.lastGround) / dt;
    if (p.vy < -9) p.bump = Math.max(p.bump, Math.min(1, -p.vy / 30));
    p.pos.y = gY + 0.5;
    p.vy = Math.max(p.vy, Math.min(groundVy, 26));
  }
  p.lastGround = gY;
  p.alt = p.pos.y - gY;

  // Attitude: follow the slope on the ground, the fall in the air; bank into turns.
  const hF = heightAt(p.pos.x + fx * 2, p.pos.z + fz * 2), hB = heightAt(p.pos.x - fx * 2, p.pos.z - fz * 2);
  const hR = heightAt(p.pos.x + rx * 1.6, p.pos.z + rz * 1.6), hL = heightAt(p.pos.x - rx * 1.6, p.pos.z - rz * 1.6);
  const air = smooth(1.9, 4.2, p.alt);
  const pitchT = lerp(Math.atan2(hF - hB, 4), clamp(p.vy * 0.03, -0.5, 0.35), air) + (p.boosting ? 0.05 : 0) + Math.min(input.throttle, 0) * 0.06 * clamp(vF / 20, 0, 1);
  const rollT = lerp(Math.atan2(hR - hL, 3.2), 0, air) - p.steer * (p.drifting ? 0.62 : 0.44) * clamp(Math.abs(vF) / 22, 0.15, 1) - clamp(vR * 0.02, -0.3, 0.3);
  p.pitch = damp(p.pitch, pitchT, 9, dt);
  p.roll = damp(p.roll, rollT, 8, dt);
  p.fwd = vF; p.speed = Math.hypot(p.vel.x, p.vel.z);
  p.moved += p.speed * dt;

  // Trail samples at a fixed sim rate, so its length is time, not frames.
  trailClock += dt;
  if (trailClock >= 1 / 60) {
    trailClock = 0;
    const s2 = Math.sin(p.yaw), c2 = Math.cos(p.yaw);
    for (const side of [-1, 1]) {
      trails[side < 0 ? 0 : 1].push(p.pos.x + c2 * side * 0.45 - s2 * 2.7, p.pos.y, p.pos.z + s2 * side * 0.45 + c2 * 2.7, c2, s2);
    }
  }
}

// ---------- Camera ----------
const cam = { mode: 'title', pos: new THREE.Vector3(0, 16, 70), look: new THREE.Vector3(0, 9, 0), tPos: new THREE.Vector3(), tLook: new THREE.Vector3(), fov: baseFov(), snap: true, shake: 0, orbit: 0, ease: 0 };
const camTmp = new THREE.Vector3();
function inspectView(cx, cy, cz, nx, nz, size) {
  const side = (player.pos.x - cx) * nx + (player.pos.z - cz) * nz >= 0 ? 1 : -1;
  const Nx = nx * side, Nz = nz * side, rx = Nz, rz = -Nx;        // the viewer's right when facing the slab
  if (sheetLayout()) {
    // The panel is a sheet over the lower half: the slab goes in the upper half.
    const D = size * 2.5 + 3;
    cam.tPos.set(cx + Nx * D, cy - size * 0.1, cz + Nz * D);
    cam.tLook.set(cx, cy - size * 0.72, cz);
  } else {
    const D = size * 1.95 + 2, off = D * 0.36;
    cam.tPos.set(cx + Nx * D + rx * off, cy - size * 0.06, cz + Nz * D + rz * off);
    cam.tLook.set(cx + rx * off, cy + size * 0.02, cz + rz * off);
  }
  cam.mode = 'inspect';
}
// Spring arm: how far along the line from the glider to a camera position you can go
// before something tall is in the way. 1 means the whole arm is clear.
function armLimit(px, pz, tx, tz, ty) {
  const dx = tx - px, dz = tz - pz, a = dx * dx + dz * dz;
  let best = 1;
  if (a < 1e-4) return best;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.top === undefined || ty > c.top + 1) continue;
    const ox = px - c.x, oz = pz - c.z, R = c.r + 0.9;
    const b = 2 * (dx * ox + dz * oz), cc = ox * ox + oz * oz - R * R;
    const disc = b * b - 4 * a * cc;
    if (disc <= 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}
function updateCamera(dt) {
  const p = player;
  const tall = upright();
  let ratePos = 12, rateY = 4.5, rateLook = 12, fovT = baseFov();
  if (cam.mode === 'title') {
    cam.orbit += dt * (reduced ? 0.008 : 0.04);
    const a = cam.orbit + 0.3, R = tall ? 104 : 92, off = tall ? 0 : 40;
    cam.tPos.set(Math.sin(a) * R, 27 + Math.sin(cam.orbit * 0.7) * 3, Math.cos(a) * R);
    cam.tLook.set(-Math.cos(a) * off, tall ? -6 : -2, Math.sin(a) * off);
    ratePos = rateY = rateLook = 3;
  } else if (cam.mode === 'inspect') {
    ratePos = rateY = rateLook = 3.6;
    fovT = baseFov() - 4;
  } else {
    const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), k = clamp(p.speed / P.vboost, 0, 1);
    const dist = (tall ? 13.5 : 11.8) + k * 1.6, height = (tall ? 6 : 4.9) + k * 0.5;
    cam.tPos.set(p.pos.x - fx * dist, p.pos.y + height, p.pos.z - fz * dist);
    cam.tLook.set(p.pos.x + fx * (7 + k * 6), p.pos.y + 2.1, p.pos.z + fz * (7 + k * 6));
    fovT = baseFov() + (reduced ? 0 : k * 9 + (p.boosting ? 6 : 0));
    // Pull the camera in front of anything solid, and lift it as the arm shortens.
    const clear = armLimit(p.pos.x, p.pos.z, cam.tPos.x, cam.tPos.z, cam.tPos.y);
    if (clear < 1) {
      const t = Math.max(clear - 0.05, 0.28);
      cam.tPos.x = p.pos.x + (cam.tPos.x - p.pos.x) * t; cam.tPos.z = p.pos.z + (cam.tPos.z - p.pos.z) * t;
      cam.tPos.y += (1 - t) * 3.4;
    }
    // Ease in from the title orbit instead of snapping to the chase position.
    if (cam.ease < 1) { cam.ease = Math.min(1, cam.ease + dt / 2.2); const e = 0.12 + 0.88 * cam.ease * cam.ease; ratePos *= e; rateY *= e; rateLook *= e; }
  }
  if (cam.snap) { cam.pos.copy(cam.tPos); cam.look.copy(cam.tLook); cam.snap = false; }
  else {
    const a = 1 - Math.exp(-ratePos * dt), ay = 1 - Math.exp(-rateY * dt), al = 1 - Math.exp(-rateLook * dt);
    cam.pos.x += (cam.tPos.x - cam.pos.x) * a; cam.pos.z += (cam.tPos.z - cam.pos.z) * a; cam.pos.y += (cam.tPos.y - cam.pos.y) * ay;
    cam.look.lerp(cam.tLook, al);
  }
  if (cam.mode === 'chase') {
    // The eased position can still lag into a wall the target has already cleared.
    const now = armLimit(p.pos.x, p.pos.z, cam.pos.x, cam.pos.z, cam.pos.y);
    if (now < 1) { const t = Math.max(now - 0.05, 0.25); cam.pos.x = p.pos.x + (cam.pos.x - p.pos.x) * t; cam.pos.z = p.pos.z + (cam.pos.z - p.pos.z) * t; }
  }
  const floor = heightAt(cam.pos.x, cam.pos.z) + 1.5;
  if (cam.pos.y < floor) cam.pos.y = floor;
  cam.fov = damp(cam.fov, fovT, 3.2, dt);
  if (Math.abs(camera.fov - cam.fov) > 0.02) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  cam.shake = Math.max(0, cam.shake - dt * 2.6);
  camera.position.copy(cam.pos);
  if (cam.shake > 0 && !reduced) camera.position.add(camTmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(cam.shake * 0.5));
  camera.lookAt(cam.look);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
}

// ---------- Per-frame dressing that follows the glider ----------
const tmpColor = new THREE.Color();
function updatePlayerFx(dt, simulating) {
  const p = player;
  const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
  const bob = Math.sin(game.time * 2.4) * 0.07 * (1 - clamp(p.speed / 14, 0, 1));
  glider.position.set(p.pos.x, p.pos.y + bob, p.pos.z);
  glider.rotation.set(p.pitch, -p.yaw, p.roll + Math.sin(game.time * 1.7) * 0.012);

  const thrust = simulating ? clamp(0.25 + Math.max(0, input.throttle) * 0.5 + (p.boosting ? 0.6 : 0) + p.speed / 120, 0, 1.4) : 0.25;
  engineGlow.forEach((g) => { g.material.opacity = 0.35 + thrust * 0.45; g.scale.setScalar(1.5 + thrust * 1.5); });
  underglow.intensity = 4 + thrust * 4;
  for (const side of [-1, 1]) trails[side < 0 ? 0 : 1].head(p.pos.x + c * side * 0.45 - s * 2.7, p.pos.y + bob, p.pos.z + s * side * 0.45 + c * 2.7, c, s);
  const power = clamp((p.speed - 4) / 30, 0, 1) * 0.55 + (p.boosting ? 0.45 : 0);
  trails.forEach((t) => t.draw(p.boosting ? 0.15 : 0.1, power));

  if (simulating && p.alt < 2.7 && p.speed > 5) {
    dustColor.copy(SAND).lerp(palNow.fog, 0.45).multiplyScalar(0.8);
    const n = (p.speed / 40) * (p.drifting ? 110 : 55) * dt;
    const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    const gy = p.pos.y - p.alt + 0.25;
    for (let i = 0; i < count; i++) {
      const lat = (Math.random() - 0.5) * 2.2, back = 1.2 + Math.random() * 1.6;
      dust.spawn(p.pos.x + c * lat - s * back, gy, p.pos.z + s * lat + c * back, -p.vel.x * 0.12 + c * lat * 1.4, 0.8 + Math.random() * 1.8, -p.vel.z * 0.12 + s * lat * 1.4, 1.5 + Math.random() * 1.9, 0.7 + Math.random() * 0.6, dustColor);
    }
  }
  if (p.bump > 0) {
    cam.shake = Math.max(cam.shake, p.bump * 0.9);
    dustColor.copy(SAND).lerp(palNow.fog, 0.45).multiplyScalar(0.8);
    for (let i = 0; i < 16; i++) { const a = Math.random() * TAU; dust.spawn(p.pos.x, p.pos.y - p.alt + 0.3, p.pos.z, Math.cos(a) * 6, 1 + Math.random() * 2, Math.sin(a) * 6, 2.4, 0.9, dustColor); }
    sfx.thud(p.bump);
    p.bump = 0;
  }
  dust.update(dt); sparks.update(dt);
  const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  dust.uniforms.uScale.value = scale; sparks.uniforms.uScale.value = scale;

  for (const m of shockwaves) {
    if (!m.visible) continue;
    m.userData.t += dt / 1.3;
    if (m.userData.t >= 1) { m.visible = false; continue; }
    m.scale.setScalar(3 + easeOut(m.userData.t) * 34);
    m.material.opacity = (1 - m.userData.t) * 0.7;
  }
  aimSun(p.pos);
}
