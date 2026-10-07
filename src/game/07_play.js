// ===== part 7: the play loop: cannon, shots, collisions, the Record Ship, catching, power-ups, waves =====
const flashes = [];      // short floor lights from blasts
function lightFlash(x, z, r, k, color, decay = 5) { flashes.push({ x, z, r, k, color: color.clone(), decay }); }

// ---------- Which release a ship or panel carries ----------
const inFlight = (r) => (ship.active && ship.release === r) || records.some((x) => x.release === r) || (M.active && M.panels.some((p) => p.alive && p.release === r));
function nextRelease(lane) {
  const list = byLane[lane];
  const open = list.filter((r) => !save.found.has(r.slug) && !inFlight(r));
  if (open.length) return open[0];
  const any = list.filter((r) => !inFlight(r));
  return any.length ? any[Math.floor(rnd() * any.length)] : null;
}
// Kill fractions at which this wave's Record Ships launch.
function planShips(lane) {
  const unfound = byLane[lane].filter((r) => !save.found.has(r.slug)).length;
  const passes = clamp(unfound, 1, 3);
  return passes === 1 ? [0.35] : passes === 2 ? [0.22, 0.58] : [0.16, 0.42, 0.68];
}

// ---------- The cannon ----------
function updatePlayer(dt, inp) {
  if (!player.alive) {
    player.dead -= dt;
    if (player.dead <= 0 && G.lives > 0 && G.mode === 'play') { resetPlayer(); toast('READY'); }
    return;
  }
  player.inv = Math.max(0, player.inv - dt);
  player.cool = Math.max(0, player.cool - dt);
  player.recoil = Math.max(0, player.recoil - dt * 8);
  player.flash = Math.max(0, player.flash - dt * 3);
  const max = HW - PLAYER_HALF + 0.6;
  if (inp.targetX != null) {
    const want = clamp(inp.targetX, -max, max);
    player.vx = clamp((want - player.x) * 14, -PLAYER_SPEED * 1.5, PLAYER_SPEED * 1.5);
  } else player.vx = damp(player.vx, clamp(inp.move, -1, 1) * PLAYER_SPEED, 16, dt);
  player.x = clamp(player.x + player.vx * dt, -max, max);
  if (Math.abs(player.x) >= max - 0.001) player.vx = 0;
  player.tilt = damp(player.tilt, -player.vx / PLAYER_SPEED * 0.3, 10, dt);
  if (inp.fire && G.phase !== 'clear') fire();
  if (player.power) { player.powerT -= dt; if (player.powerT <= 0) { player.power = null; toast('POWER OFF', 1.2); } }
  if (player.shield > 0) player.shield = Math.max(0, player.shield - dt);
}
function playerHit(cause = 'bomb') {
  G.lastCause = cause;
  if (!player.alive || player.inv > 0 || G.mode === 'title') return;
  if (player.shield > 0) {
    player.shield = 0; player.inv = 1;
    ring(player.x, 1.4, 0, 6, POWERS.shield.color, 0.5, false, 0.2);
    sparkBurst(player.x, 1.4, 0, POWERS.shield.color, 26, 14, 0.5, 0.5);
    audio.fx.clank(player.x); toast('SHIELD DOWN', 1.2); shake(0.3);
    return;
  }
  killPlayer();
}
function killPlayer(fromInvasion = false) {
  if (!player.alive) return;
  (G.deaths || (G.deaths = [])).push({ wave: G.wave, cause: fromInvasion ? 'invasion' : G.lastCause || 'bomb', t: +G.time.toFixed(1) });
  player.alive = false; player.dead = 2; G.lives--; G.combo = 0;
  player.power = null; player.shield = 0;
  const lc = waveColor();
  playerVox.forEach((v) => spawnDebris(player.x + v.x, v.y, v.z, v.x * rr(2, 6) + rr(-3, 3), rr(5, 16), v.z * 3 + rr(-4, 6), PVOX * 0.9, v.c === 'L' || v.c === '+' ? lc : PLAYER_BODY, 1.8, rr(1.5, 2.6)));
  sparkBurst(player.x, 1.2, 0, WHITE, 40, 22, 0.7, 0.8);
  sparkBurst(player.x, 1.2, 0, lc, 30, 16, 0.6, 0.9);
  ring(player.x, 0.1, 0, 14, lc, 0.8, true, 0.15);
  ring(player.x, 1.5, 0, 7, WHITE, 0.5, false, 0.2);
  ripple(player.x, 0, 2.5);
  lightFlash(player.x, 0, 14, 3, WHITE, 2.5);
  flash(fromInvasion ? 0.6 : 0.45, true); shake(1.1);
  G.hitstop = 0.18;
  audio.fx.die();
  bombs.length = 0;
  if (G.lives <= 0) { G.overT = 2.2; }
}

// ---------- Kills ----------
function hitInvader(inv, dirZ = -1) {
  inv.hp--; inv.flash = 1;
  if (inv.hp > 0) {
    // an armor plate comes off
    const shape = TYPES[inv.type].frames[inv.frame & 1];
    for (const v of shape) {
      if (v.c !== 'A' || (inv.armorLayer[v.k % inv.armorLayer.length]) !== inv.hp) continue;
      const ox = v.x * inv.scale, oy = v.y * inv.scale;
      spawnDebris(inv.x + ox, inv.y + oy, inv.z + 0.3, ox * 3 + rr(-2, 2), rr(3, 9), rr(2, 7), VOX * 0.9, ARMOR, 0.6, 1.5);
    }
    sparkBurst(inv.x, inv.y, inv.z + 0.8, WHITE, 10, 10, 0.4, 0.3);
    audio.fx.clank(inv.x);
    shake(0.05);
    return;
  }
  killInvader(inv, dirZ);
}
function killInvader(inv, dirZ = -1) {
  inv.alive = false; F.alive = Math.max(0, F.alive - 1);
  burstInvader(inv, dirZ, inv.type === 'brute' ? 1.3 : 1);
  const party = F.def && F.def.twist === 'spiral';
  sparkBurst(inv.x, inv.y, inv.z, inv.color, party ? 10 : 18, 13, 0.55, 0.5);
  if (party) for (let i = 0; i < 26; i++) spark(inv.x, inv.y, inv.z, rr(-9, 9), rr(6, 15), rr(-9, 5), CARNIVAL[i % 7], 0.45, rr(0.8, 1.4), 16);
  ring(inv.x, inv.y, inv.z, inv.type === 'brute' ? 5 : 3.4, inv.color, 0.4, false, 0.22);
  ripple(inv.x, inv.z, 0.9);
  lightFlash(inv.x, inv.z, 8, 2.2, inv.color);
  G.combo++; G.hits++; G.waveHits++;
  if (G.mode === 'play') {
    const base = TYPES[inv.type].pts * (inv.state === 'dive' ? 2 : 1);
    addScore(base, inv.x, inv.y + 1.6, inv.z, inv.state === 'dive' ? '#ffd25a' : '#ffffff');
    if (F.def && F.def.twist === 'keys') keyRun(inv);
    else audio.fx.hit(inv.x, G.combo);
    if (inv.carrier) dropPower(inv.x, inv.z);
    if (party && G.combo % 8 === 0) { addScore(250, inv.x, inv.y + 3, inv.z, '#ff7ad9', true); toast('PARTY POPPER'); for (let i = 0; i < 60; i++) spark(inv.x, inv.y, inv.z, rr(-16, 16), rr(8, 22), rr(-14, 8), CARNIVAL[i % 7], 0.5, rr(1, 1.8), 14); }
  } else if (audio.ready) audio.fx.crunch(inv.x, 0.5);
  shake(inv.type === 'brute' ? 0.16 : 0.07);
}
// Piano wave: the hit plays its key; three rising keys in a row is a run.
function keyRun(inv) {
  audio.playKey(inv.note);
  audio.fx.crunch(inv.x, 0.35);
  const run = F.lastKeys;
  run.push(inv.note);
  if (run.length > 3) run.shift();
  if (run.length === 3 && run[0] < run[1] && run[1] < run[2]) { addScore(300, inv.x, inv.y + 3, inv.z, '#dfe6ff', true); toast('SCALE RUN'); run.length = 0; }
}

// ---------- Shots ----------
// Accuracy counts bullets, not kills: a bullet that hits at least once is one hit, however
// many invaders a Pierce or Spread bullet goes on to take down.
function scored(s) { if (!s.scored) { s.scored = true; G.waveShotHits++; } }
function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    const pz = s.z;
    s.z -= SHOT_SPEED * dt; s.x += s.vx * dt;
    let dead = false;
    // bunkers, sampled along the path
    for (let z = pz; z >= s.z; z -= 0.3) {
      if (z > Z_BUNKER + 1.5 || z < Z_BUNKER - 1.5) continue;
      const b = bunkerAt(s.x, flyY(z), z);
      if (b) { erodeBunker(b, s.x, flyY(z), z, 0.75, -1); audio.fx.tick(s.x); sparkBurst(s.x, flyY(z), z, BUNKER_COL, 5, 6, 0.35, 0.25); dead = true; break; }
    }
    // invaders: the first one along the path
    if (!dead) {
      let best = null;
      for (const inv of invaders) {
        if (!inv.alive || inv.scale < 0.6 || (s.hitSet && s.hitSet.has(inv))) continue;
        const t = TYPES[inv.type];
        if (Math.abs(s.x - inv.x) > t.halfW * inv.scale + 0.15) continue;
        if (inv.z - t.halfD > pz || inv.z + t.halfD < s.z) continue;
        if (!best || inv.z > best.z) best = inv;
      }
      if (best) {
        hitInvader(best, -1);
        if (s.pierce) { (s.hitSet || (s.hitSet = new Set())).add(best); } else dead = true;
        scored(s);
      }
    }
    // bombs can be shot
    if (!dead) for (let j = bombs.length - 1; j >= 0; j--) {
      const b = bombs[j];
      if (b.kind === 'bass' || Math.abs(b.x - s.x) > 0.9 || b.z > pz + 0.8 || b.z < s.z - 0.8) continue;
      bombs.splice(j, 1);
      sparkBurst(b.x, flyY(b.z), b.z, BOMB_COL[b.kind] || WHITE, 10, 8, 0.4, 0.3);
      if (G.mode === 'play') addScore(5, b.x, flyY(b.z) + 1, b.z, '#ffb0a0');
      scored(s);
      if (!s.pierce) dead = true;
      break;
    }
    // the Record Ship
    if (!dead && ship.active && Math.abs(s.x - ship.x) < 3.7 && pz > ship.z - 1.6 && s.z <= ship.z + 1.6) { shootShip(); dead = true; scored(s); }
    if (!dead && G.wave === FINALE && hitMothership(s, pz)) { dead = true; scored(s); }
    if (!dead && (s.z < Z_FAR || Math.abs(s.x) > HW + 6)) {
      dead = true;
      if (!s.scored && G.mode === 'play') G.combo = 0;
    }
    if (dead) shots.splice(i, 1);
  }
}

// ---------- Bombs and quakes ----------
function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (!b) continue;       // a death clears the list mid-loop
    b.t += dt;
    if (b.kind === 'bass') {
      const dist = Math.hypot(b.target - b.x0, b.tz - b.z0), dur = Math.max(0.6, dist / b.vz);
      const k = Math.min(1, b.t / dur);
      b.x = lerp(b.x0, b.target, k); b.z = lerp(b.z0, b.tz, k);
      b.y = flyY(b.z) + Math.sin(k * Math.PI) * 4;
      if (k >= 1) { quake(b.x, b.z, 6.5); bombs.splice(i, 1); }
      continue;
    }
    if (b.kind === 'confetti') b.x += Math.sin(b.t * 6 + b.ph) * 7 * dt;
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.y = flyY(b.z);
    if (Math.abs(b.x) > HW + 1) { b.vx = -b.vx; b.x = clamp(b.x, -HW - 1, HW + 1); }
    if (b.z > Z_BUNKER - 1.5 && b.z < Z_BUNKER + 1.5) {
      const bk = bunkerAt(b.x, b.y, b.z);
      if (bk) { erodeBunker(bk, b.x, b.y, b.z, 0.85, 1); audio.fx.tick(b.x); sparkBurst(b.x, b.y, b.z, BOMB_COL[b.kind] || WHITE, 6, 6, 0.35, 0.25); bombs.splice(i, 1); continue; }
    }
    if (player.alive && b.z > -1.9 && b.z < 1.3 && Math.abs(b.x - player.x) < PLAYER_HALF - 0.45) {
      bombs.splice(i, 1);
      sparkBurst(b.x, 1.5, 0, BOMB_COL[b.kind] || WHITE, 12, 10, 0.4, 0.3);
      playerHit(b.kind);
      continue;
    }
    if (b.z > 7) { bombs.splice(i, 1); ripple(b.x, 6, 0.4); }
  }
  for (let i = quakes.length - 1; i >= 0; i--) {
    const q = quakes[i];
    q.t += dt;
    const k = Math.min(1, q.t / 0.9);
    q.r = q.maxR * (1 - Math.pow(1 - k, 3));
    if (!q.hit && player.alive && Math.abs(Math.hypot(player.x - q.x, -q.z) - q.r) < 1.0) { q.hit = true; playerHit('quake'); }
    addLight(q.x, q.z, q.r + 2, 1.4 * (1 - k), LANE_COL[3]);
    if (k >= 1) quakes.splice(i, 1);
  }
}

// ---------- The Record Ship ----------
function launchShip() {
  const lane = WAVES[G.wave].lane;
  const r = nextRelease(lane);
  if (!r) return;
  ship.active = true; ship.release = r; ship.dir = rnd() < 0.5 ? 1 : -1; ship.x = -ship.dir * (HW + 12);
  ship.speed = 9 + G.wave * 0.45; ship.t = 0; ship.z = Z_SHIP; ship.y = flyY(Z_SHIP) + 1.2; ship.pass++;
  shipPanel.material.uniforms.uRect.value.copy(atlasRect(r));
  shipPanel.material.uniforms.uEdge.value.copy(LANE_COL[r._lane]).multiplyScalar(1.6);
  shipGroup.visible = true;
  audio.fx.ship(true, ship.x);
  toast(save.found.has(r.slug) ? 'RECORD SHIP · BONUS PASS' : 'RECORD SHIP · SHOOT IT DOWN');
}
function updateShip(dt) {
  if ((G.mode === 'play' || G.mode === 'title') && G.phase === 'fight' && !ship.active && G.wave < FINALE && F.shipPlan && F.shipPlan.length && F.total) {
    if (1 - F.alive / F.total >= F.shipPlan[0]) { F.shipPlan.shift(); launchShip(); }
  }
  if (!ship.active) { shipGroup.visible = false; return; }
  ship.t += dt;
  ship.x += ship.dir * ship.speed * dt;
  const lc = LANE_COL[ship.release._lane];
  shipGroup.position.set(ship.x, ship.y + Math.sin(ship.t * 2.2) * 0.4, ship.z);
  shipMesh.rotation.y += dt * 1.6;
  shipGroup.rotation.z = -ship.dir * 0.08;
  paintShip(lc, ship.t);
  beamMat.color.copy(lc).multiplyScalar(0.6 + 0.2 * Math.sin(ship.t * 9));
  addLight(ship.x, ship.z, 9, 1.6, lc);
  pool(ship.x, ship.z, 12, lc, 0.7);
  audio.fx.ship(true, ship.x);
  if (Math.abs(ship.x) > HW + 14) {
    ship.active = false; shipGroup.visible = false; audio.fx.ship(false);
    if (G.mode === 'play') toast('IT GOT AWAY · IT WILL BE BACK');
  }
}
function shootShip() {
  ship.active = false; shipGroup.visible = false; audio.fx.ship(false);
  const lc = LANE_COL[ship.release._lane], y = ship.y;
  shipVox.forEach((v, i) => { if (i % 2 === 0) spawnDebris(ship.x + v.x, y + v.y, ship.z + v.z, v.x * rr(1, 3), rr(3, 14) + v.y * 2, v.z * 2 + rr(-2, 6), 0.38, v.c === 'o' ? WHITE : lc, 1.8, rr(1.4, 2.4)); });
  sparkBurst(ship.x, y, ship.z, lc, 50, 22, 0.8, 0.8);
  sparkBurst(ship.x, y, ship.z, WHITE, 30, 18, 0.6, 0.6);
  ring(ship.x, y, ship.z, 9, lc, 0.6, false, 0.18);
  ring(ship.x, y, ship.z, 5, WHITE, 0.4, false, 0.3);
  lightFlash(ship.x, ship.z, 20, 3, lc, 2);
  flash(0.25); shake(0.5); G.hitstop = 0.12;
  audio.fx.shipHit(ship.x);
  if (G.mode === 'play') addScore(pick([50, 100, 150, 300]), ship.x, y + 2.5, ship.z, LANES[ship.release._lane].color, true);
  dropRecord(ship.release, ship.x, y - 1, ship.z + 1);
}

// ---------- Falling records ----------
function updateRecords(dt) {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    r.t += dt;
    const k = Math.min(1, r.t / r.ttl);
    r.z = lerp(r.z0, 2.6, k);
    r.x = lerp(r.x0, r.tx, smooth(0, 0.6, k));
    r.y = lerp(r.y0, 0.7, k) + Math.sin(k * Math.PI) * 5;
    r.g.position.set(r.x, r.y, r.z);
    r.mesh.rotation.z += dt * 7;
    r.g.rotation.x = -0.55 + Math.sin(r.t * 3) * 0.12;
    r.g.rotation.y = Math.sin(r.t * 2) * 0.3;
    const lc = LANE_COL[r.release._lane];
    const near = k > 0.55 ? 1 : 0.5;
    pool(r.x, 0, 5 + Math.sin(r.t * 10) * 0.8, lc, 0.9 * near);
    addLight(r.x, 0, 4.5, 1.8 * near, lc);
    addLight(r.x, r.z, 5, 1.2, lc);
    if (Math.floor(r.t * 12) !== Math.floor((r.t - dt) * 12)) spark(r.x + rr(-1, 1), r.y, r.z, rr(-1, 1), rr(-1, 1), rr(-1, 1), lc, 0.5, 0.6, -2);
    if (player.alive && r.z > -2.4 && r.z < 1.6 && Math.abs(r.x - player.x) < 2.9) { catchRecord(r); continue; }
    if (k >= 1) {
      for (let n = 0; n < 30; n++) spawnDebris(r.x + rr(-1, 1), 0.4, r.z, rr(-6, 6), rr(2, 9), rr(-2, 6), 0.3, n % 4 ? new THREE.Color(0.04, 0.04, 0.05) : lc, n % 4 ? 0.2 : 1.6, 1.4);
      audio.fx.miss();
      if (G.mode === 'play') toast('MISSED · IT WILL COME BACK');
      removeRecord(r);
    }
  }
}
function catchRecord(r) {
  const rel = r.release, fresh = !save.found.has(rel.slug);
  const lc = LANE_COL[rel._lane];
  if (G.mode === 'play') {
    if (fresh) { save.found.add(rel.slug); persist(); }
    if (!G.caught.includes(rel)) G.caught.push(rel);
    addScore(fresh ? 1000 : 300, player.x, 3.5, 0, LANES[rel._lane].color, true);
    showUnlock(rel, fresh);
  }
  ring(player.x, 0.15, 0, 12, lc, 0.8, true, 0.14);
  ring(player.x, 1.6, 0, 5, WHITE, 0.45, false, 0.25);
  sparkBurst(player.x, 2, 0, lc, 50, 18, 0.6, 0.9);
  ripple(player.x, 0, 2);
  lightFlash(player.x, -2, 10, 1.1, lc, 3);
  player.flash = 1;
  flash(0.18); shake(0.2);
  audio.fx.catchRecord();
  removeRecord(r);
}

// ---------- Power-ups ----------
function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.t += dt;
    p.z += 10 * dt;
    const y = flyY(p.z) + 0.6 + Math.sin(p.t * 4) * 0.3;
    p.g.position.set(p.x, y, p.z);
    p.mesh.rotation.y += dt * 3; p.mesh.rotation.x += dt * 1.3;
    p.icon.position.set(0, 1.9, 0);
    const c = POWERS[p.kind].color;
    pool(p.x, p.z, 4, c, 0.8);
    addLight(p.x, p.z, 4, 0.9, c);
    if (player.alive && p.z > -2.3 && p.z < 1.5 && Math.abs(p.x - player.x) < 3) {
      if (p.kind === 'shield') player.shield = POWERS.shield.time; else { player.power = p.kind; player.powerT = POWERS[p.kind].time; }
      toast(POWERS[p.kind].name, 1.5);
      ring(player.x, 1.4, 0, 6, c, 0.5, false, 0.22);
      sparkBurst(player.x, 1.6, 0, c, 24, 12, 0.5, 0.5);
      audio.fx.powerup();
      if (G.mode === 'play') addScore(100, player.x, 3, 0, POWERS[p.kind].css);
      removePower(p);
      continue;
    }
    if (p.z > 5) removePower(p);
  }
}

// ---------- Wave flow ----------
function clearField() {
  shots.length = 0; bombs.length = 0; quakes.length = 0;
  while (powerups.length) removePower(powerups[0]);
  while (records.length) removeRecord(records[0]);
  ship.active = false; shipGroup.visible = false; audio.fx.ship(false);
}
const _hsl = {};
function setWorldColor(c) {
  floorU.uLine.value.copy(c);
  c.getHSL(_hsl);
  skyU.uNebA.value.setHSL(_hsl.s < 0.6 && _hsl.l > 0.8 ? 0.7 : _hsl.h, Math.max(0.65, _hsl.s), Math.min(0.5, _hsl.l));
}
function startWave(w) {
  G.wave = w; G.phase = 'intro'; G.phaseT = 0; G.steps = 0; G.waveShots = 0; G.waveHits = 0; G.waveShotHits = 0;
  clearField();
  buildFormation(w);
  buildBunkers(w === FINALE ? 3 : 4);
  if (w === FINALE) setupMothership(); else { M.active = false; msGroup.visible = false; audio.fx.hum(false); }
  audio.setStyle(G.mode === 'title' ? STYLE_TITLE : w === FINALE ? STYLE_FINALE : WAVES[w].lane);
  audio.cond.muteDrums = 2.2;
  const lc = w === FINALE ? hdr('#ff3f8e') : LANE_COL[WAVES[w].lane];
  if (w !== FINALE) F.shipPlan = planShips(WAVES[w].lane); else F.shipPlan = [];
  ship.pass = 0;
  setWorldColor(lc);
  setLaneCss(w === FINALE ? '#ff3f8e' : LANES[WAVES[w].lane].color);
  if (G.mode === 'play') {
    save.best = Math.max(save.best, w); persist();
    const lane = WAVES[w].lane;
    showBanner(w === FINALE ? 'FINAL WAVE' : `WAVE ${w + 1} · BUS ${LANES[lane].bus}`, waveName(w), w === FINALE ? WAVES[w].tip : `${LANES[lane].blurb}. ${WAVES[w].tip}`, 2.8);
  }
  updateHudStatic();
}
function waveTempo() {
  const st = audio.cond.style;
  let k;
  if (G.wave === FINALE) k = M.coreOpen ? 0.55 + 0.45 * (1 - M.coreHp / M.coreMax) : Math.min(0.5, M.broken / 12);
  else k = F.total ? 1 - F.alive / F.total : 0;
  audio.cond.target = lerp(st.bpm[0], st.bpm[1], Math.pow(clamp(k, 0, 1), 1.35));
  audio.cond.level = G.phase === 'intro' ? 0 : clamp(Math.floor(k * 4 + 0.35), 0, 3);
}
// The march: quarter notes, eighth notes for a lone survivor, none while the cannon is down.
audio.cond.marchDiv = () => {
  if (G.freeze) return 0;
  if (G.mode === 'title') return 4;
  if (G.mode !== 'play' || G.phase !== 'fight' || !player.alive || G.overlay) return 0;
  if (G.wave === FINALE) return 4;
  return F.alive === 1 ? 2 : 4;
};
audio.cond.onEvent = onBeatEvent;

function updateWave(dt) {
  G.phaseT += dt;
  if (G.phase === 'intro') {
    const ready = G.wave === FINALE ? G.phaseT > 3 : invaders.every((i) => i.state === 'form') || G.phaseT > 4;
    if (ready && G.phaseT > 2.4) { G.phase = 'fight'; G.phaseT = 0; }
    return;
  }
  if (G.phase === 'fight') {
    const cleared = G.wave === FINALE ? M.dead : F.alive === 0;
    if (cleared) {
      G.phase = 'clear'; G.phaseT = 0;
      const acc = G.waveShots ? Math.min(1, G.waveShotHits / G.waveShots) : 0;
      const bonus = (G.wave + 1) * 1000 + Math.round(acc * 2000 / 100) * 100;
      if (G.mode === 'play') {
        addScore(bonus);
        showBanner(G.wave === FINALE ? 'VICTORY' : 'WAVE CLEAR', G.wave === FINALE ? 'EARTH HOLDS' : waveName(G.wave), '', 2.8, `ACCURACY ${Math.round(acc * 100)}% · BONUS ${bonus.toLocaleString('en-US')}`);
      }
      audio.fx.clear();
      bombs.length = 0;
      ship.active = false; shipGroup.visible = false; audio.fx.ship(false);
      return;
    }
    // invasion: the front row crossed the line
    if (G.wave !== FINALE && G.mode === 'title' && frontZ() >= Z_INVADE) { startWave((G.wave + 1) % FINALE); return; }
    if (G.wave !== FINALE && player.alive && frontZ() >= Z_INVADE) {
      toast('THEY BROKE THE LINE');
      killPlayer(true);
      F.oz -= 9;
      placeSlots();
    }
    return;
  }
  if (G.phase === 'clear' && G.phaseT > 3.2 && !records.length) {
    if (G.mode === 'title') { startWave((G.wave + 1) % FINALE); return; }
    if (G.wave >= FINALE) endGame(true);
    else startWave(G.wave + 1);
  }
}

// ---------- One simulation step of play ----------
const NO_INPUT = { move: 0, fire: false, targetX: null };
function stepPlay(dt, inp) {
  G.time += dt;
  audio.tick(dt);
  waveTempo();
  updateWave(dt);
  updateFormation(dt);
  if (G.phase === 'fight' && player.alive) updateEnemyFire(dt);
  updatePlayer(dt, inp);
  updateShots(dt);
  updateBombs(dt);
  updateShip(dt);
  updateRecords(dt);
  updatePowerups(dt);
  if (G.wave === FINALE) updateMothership(dt);
  if (G.overT > 0) { G.overT -= dt; if (G.overT <= 0 && G.mode === 'play') endGame(false); }
}

// ---------- Autopilot: tracks the nearest invader, dodges, catches. Used by the attract mode and the tests ----------
function autopilot() {
  const inp = { move: 0, fire: false, targetX: null };
  if (!player.alive) return inp;
  let goal = null, wantFire = false;
  const rec = records.reduce((a, b) => (!a || b.z > a.z ? b : a), null);
  if (rec && rec.t / rec.ttl > 0.3) goal = rec.x;
  if (goal == null) { const pu = powerups.find((p) => p.z > -16); if (pu) goal = pu.x; }
  if (goal == null && ship.active) {
    const tt = (-1.4 - ship.z) / SHOT_SPEED, lead = ship.x + ship.dir * ship.speed * tt;
    if (Math.abs(lead) < HW - 1) { goal = lead; if (Math.abs(player.x - lead) < 1.5) wantFire = true; }
  }
  if (goal == null && G.wave === FINALE && M.active) {
    const p = M.panels.filter((q) => q.alive).sort((a, b) => Math.abs(M.x + a.x - player.x) - Math.abs(M.x + b.x - player.x))[0];
    if (M.coreOpen) goal = M.x; else if (p) goal = M.x + p.x;
  }
  let target = null;
  for (const inv of invaders) {
    if (!inv.alive || inv.state === 'enter') continue;
    const score = Math.abs(inv.x - player.x) * 1.0 - inv.z * 0.15 + (inv.state === 'dive' ? -8 : 0);
    if (!target || score < target.s) target = { inv, s: score };
  }
  if (goal == null && target) goal = target.inv.x;
  if (goal == null) goal = 0;
  // Fire when anything is lined up.
  for (const inv of invaders) if (inv.alive && inv.state !== 'enter' && Math.abs(inv.x - player.x) < TYPES[inv.type].halfW * 0.85) { wantFire = true; break; }
  if (G.wave === FINALE && M.active && Math.abs(player.x - M.x) < 13) wantFire = true;
  // Dodge what is about to land.
  let threat = null;
  for (const b of bombs) {
    const bx = b.kind === 'bass' ? b.target : b.x, bz = b.kind === 'bass' ? b.tz : b.z;
    const reach = b.kind === 'bass' ? 8.2 : 2.9;
    if (bz > -14 && bz < 1.5 && Math.abs(bx - player.x) < reach && (!threat || bz > threat.z)) threat = { x: bx, z: bz, reach };
  }
  for (const q of quakes) if (Math.abs(q.x - player.x) < q.maxR + 1.5) threat = { x: q.x, z: q.z, reach: q.maxR + 1.5 };
  for (const inv of invaders) if (inv.alive && inv.state === 'dive' && inv.z > -16 && Math.abs(inv.x - player.x) < 4.5) threat = { x: inv.x, z: inv.z, reach: 4.5 };
  if (threat) {
    let away = player.x >= threat.x ? 1 : -1;
    if (Math.abs(player.x + away * 4) > HW - 3) away = -away;
    goal = threat.x + away * (threat.reach + 1.2);
  }
  inp.targetX = clamp(goal, -HW + 2, HW - 2);
  inp.fire = wantFire;
  return inp;
}
