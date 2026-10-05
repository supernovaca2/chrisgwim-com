
// ---------- Sound: synthesized in the browser. No audio files, none of the music. ----------
const sfx = (() => {
  let ctx = null, master, delay, windGain, windFilter, humGain, hum, ducked = false;
  const VOLUME = 0.5;
  const level = () => (ducked ? VOLUME * 0.2 : VOLUME);
  const A3 = 220, C3 = 130.81;
  const ROOTS = [0, 2, 4, 7, 9, 12, 14];          // one root per lane, A major pentatonic
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const hz = (base, semi) => base * Math.pow(2, semi / 12);

  function ensure() {
    if (ctx || !save.sound) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (err) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = level();
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    // A short feedback echo gives the chimes some air.
    delay = ctx.createDelay(1); delay.delayTime.value = 0.31;
    const feedback = ctx.createGain(); feedback.gain.value = 0.3;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(master);
    // Wind: looped noise through a band-pass that opens with speed.
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.7;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wind.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); wind.start();
    // Engine: two detuned triangles under a low-pass.
    humGain = ctx.createGain(); humGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    hum = [0, 9].map((cents) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 60; o.detune.value = cents; o.connect(lp); o.start(); return o; });
    lp.connect(humGain); humGain.connect(master);
  }
  function tone(freq, when, dur, gain, type = 'triangle', echo = true) {
    if (!ctx || !save.sound) return;
    const t0 = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    if (echo) g.connect(delay);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    // While a track plays in the docked player, the game's own sounds step back.
    duck(on) { ducked = on; if (master && save.sound) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.3); },
    setEnabled(on) {
      save.sound = on; persist();
      if (on) { this.resume(); if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05); }
      else if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    drive(speed, boosting, active) {
      if (!ctx) return;
      const k = active ? clamp(speed / P.vboost, 0, 1) : 0, t = ctx.currentTime;
      windGain.gain.setTargetAtTime(k * k * 0.1 + (active && boosting ? 0.03 : 0), t, 0.15);
      windFilter.frequency.setTargetAtTime(320 + k * 1500, t, 0.2);
      humGain.gain.setTargetAtTime(active ? 0.03 + k * 0.045 : 0, t, 0.25);
      hum.forEach((o) => o.frequency.setTargetAtTime(58 + k * 72, t, 0.12));
    },
    found(lane) { const root = ROOTS[lane % ROOTS.length]; [0, 7, 12, 16].forEach((s, i) => tone(hz(A3, root + s), i * 0.085, 1.5, 0.15)); tone(hz(A3, root + 24), 0.34, 2, 0.06, 'sine'); },
    lane(lane) { const root = ROOTS[lane % ROOTS.length]; [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(hz(A3, root + s - 12), i * 0.06, 2.6, 0.12)); },
    all() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => tone(hz(A3, s), i * 0.16, 2.8, 0.13)); },
    key(j) { const f = hz(C3, WHITE[j % 7] + 12 * Math.floor(j / 7)); tone(f, 0, 1.3, 0.2); tone(f * 2, 0, 0.7, 0.05, 'sine', false); },
    blip(high) { tone(high ? 880 : 620, 0, 0.09, 0.05, 'sine', false); },
    whoosh() { tone(180, 0, 0.35, 0.05, 'sine', false); tone(360, 0.05, 0.3, 0.03, 'sine', false); },
    thud(k) {
      if (!ctx || !save.sound) return;
      const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.2);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.1 + k * 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.3);
    },
  };
})();
