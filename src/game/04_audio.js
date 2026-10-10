// ===== part 4: sound. Web Audio synthesis only; no audio files, none of the released music =====
// The conductor owns time. It walks sixteenth notes, schedules each one into Web Audio a
// little ahead, and hands the same event to the game when its moment comes. A march step
// is one of those events, so the formation and its bass note can never drift apart.
const MINOR = [0, 2, 3, 5, 7, 8, 10], HARM = [0, 2, 3, 5, 7, 8, 11], MAJOR = [0, 2, 4, 5, 7, 9, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10], MIXO = [0, 2, 4, 5, 7, 9, 10];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const degMidi = (key, scale, d) => key + 12 * Math.floor(d / 7) + scale[((d % 7) + 7) % 7];
const mel = (s) => s.trim().split(/\s+/).map((x) => (x === '.' ? null : Number(x)));

// One style per lane (bus A to G), then the finale and the title.
const STYLES = [
  { // A · Classical Fusion: strings, timpani, pizzicato march, a harp
    key: 50, scale: HARM, prog: [0, 5, 3, 4], bpm: [90, 178],
    march: { inst: 'pizz', oct: -1, also: 'timp' },
    pad: { inst: 'strings', from: 0 },
    drums: [
      { inst: 'kick', pat: 'x.......x.......', from: 0, vel: 0.7 },
      { inst: 'kick', pat: '....x.......x...', from: 1, vel: 0.75 },
      { inst: 'hat', pat: '..x...x...x...x.', from: 1, vel: 0.5 },
      { inst: 'snare', pat: '....x.......x...', from: 3, vel: 0.55 },
    ],
    bass: { inst: 'cello', pat: 'x..x..x.x..x..x.', from: 2, oct: -2 },
    arp: { inst: 'harp', pat: 'x.x.x.x.x.x.x.x.', seq: [0, 1, 2, 3, 2, 1, 0, 1], from: 2, oct: 1 },
    lead: { inst: 'violin', from: 3, notes: mel(`4 . . . 3 . 2 . 4 . . . 7 . . .  5 . . . 4 . 2 . 0 . . . 2 . . .  3 . . . 5 . 7 . 8 . . . 7 . 5 .  6 . . . 4 . . . 1 . . . . . . .`) },
  },
  { // B · Techno & Trance: supersaw arps, rolling offbeat bass, drops every four bars
    key: 45, scale: MINOR, prog: [0, 5, 2, 6], bpm: [96, 180], drops: true,
    march: { inst: 'acid', oct: 0 },
    pad: { inst: 'sawpad', from: 0 },
    drums: [
      { inst: 'kick', pat: 'x...x...x...x...', from: 0, vel: 0.95 },
      { inst: 'ohat', pat: '..x...x...x...x.', from: 1, vel: 0.5 },
      { inst: 'clap', pat: '....x.......x...', from: 1, vel: 0.6 },
      { inst: 'hat', pat: 'xxxxxxxxxxxxxxxx', from: 2, vel: 0.28 },
    ],
    bass: { inst: 'reese', pat: '..x...x...x...x.', from: 1, oct: -2 },
    arp: { inst: 'supersaw', pat: 'x.xxx.xxx.xxx.xx', seq: [0, 1, 2, 1, 2, 3, 2, 1], from: 2, oct: 1 },
    lead: { inst: 'supersaw', from: 3, notes: mel(`4 . 7 . 4 . 9 . 7 . 4 . 7 . 4 .  5 . 7 . 5 . 9 . 7 . 5 . 7 . 5 .  4 . 6 . 4 . 9 . 6 . 4 . 6 . 4 .  3 . 6 . 3 . 8 . 6 . 3 . 6 . 1 .`) },
  },
  { // C · House & EDM: organ stabs, a pumping groove; the invaders fire on the kick
    key: 41, scale: DORIAN, prog: [0, 6, 5, 6], bpm: [100, 178],
    march: { inst: 'housebass', oct: -1 },
    pad: { inst: 'warmpad', from: 0 },
    drums: [
      { inst: 'kick', pat: 'x...x...x...x...', from: 0, vel: 0.95 },
      { inst: 'clap', pat: '....x.......x...', from: 1, vel: 0.65 },
      { inst: 'ohat', pat: '..x...x...x...x.', from: 1, vel: 0.55 },
      { inst: 'shaker', pat: 'xxxxxxxxxxxxxxxx', from: 2, vel: 0.3 },
    ],
    stab: { inst: 'organ', pat: '..x..x....x..x..', from: 1, oct: 1 },
    bass: { inst: 'housebass', pat: '.x.x...x.x.x...x', from: 2, oct: -1 },
    arp: { inst: 'pluck', pat: 'x..x..x..x..x.x.', seq: [2, 1, 0, 1, 3, 2, 1, 2], from: 3, oct: 2 },
  },
  { // D · Bass: half time, a sub you feel, a wobble that opens with the wave
    key: 40, scale: MINOR, prog: [0, 0, 5, 6], bpm: [86, 172],
    march: { inst: 'sub', oct: -1 },
    pad: { inst: 'darkpad', from: 0 },
    drums: [
      { inst: 'kick', pat: 'x.........x.....', from: 0, vel: 1 },
      { inst: 'snare', pat: '........x.......', from: 0, vel: 0.85 },
      { inst: 'hat', pat: 'x.x.x.x.x.x.x.x.', from: 1, vel: 0.35 },
      { inst: 'hat', pat: '.............xxx', from: 2, vel: 0.3 },
      { inst: 'kick', pat: '......x........x', from: 3, vel: 0.8 },
    ],
    bass: { inst: 'wobble', pat: 'x.......x.......', from: 1, oct: -1, len: 8 },
  },
  { // E · Piano: a quiet bed; the melody is the one you shoot
    key: 48, scale: MAJOR, prog: [0, 5, 3, 4], bpm: [88, 170], keys: true,
    march: { inst: 'piano', oct: -1 },
    pad: { inst: 'warmpad', from: 0, vel: 0.6 },
    drums: [
      { inst: 'kick', pat: 'x.......x.......', from: 1, vel: 0.6 },
      { inst: 'hat', pat: '..x...x...x...x.', from: 2, vel: 0.3 },
      { inst: 'rim', pat: '....x.......x...', from: 2, vel: 0.5 },
    ],
    chords: { inst: 'piano', pat: 'x.....x...x.....', from: 1, oct: 0 },
  },
  { // F · Punk & Rock: distorted bass, power chords, a drummer in a hurry
    key: 40, scale: MIXO, prog: [0, 3, 4, 3], bpm: [110, 190],
    march: { inst: 'distbass', oct: 0 },
    drums: [
      { inst: 'kick', pat: 'x...x...x...x...', from: 0, vel: 0.95 },
      { inst: 'snare', pat: '....x.......x...', from: 0, vel: 0.85 },
      { inst: 'hat', pat: 'x.x.x.x.x.x.x.x.', from: 1, vel: 0.45 },
      { inst: 'kick', pat: '..x.......x.x...', from: 2, vel: 0.8 },
      { inst: 'crash', pat: 'x...............', from: 3, vel: 0.5 },
    ],
    bass: { inst: 'distbass', pat: 'x.x.x.x.x.x.x.x.', from: 1, oct: 0 },
    power: { inst: 'power', pat: 'x.....x.x.......', from: 2, oct: 1 },
  },
  { // G · World & Pop: steel pan, soca drums, a party
    key: 55, scale: MAJOR, prog: [0, 4, 5, 3], bpm: [100, 180],
    march: { inst: 'marimba', oct: -1 },
    pad: { inst: 'brightpad', from: 0, vel: 0.7 },
    drums: [
      { inst: 'kick', pat: 'x...x...x...x...', from: 0, vel: 0.9 },
      { inst: 'rim', pat: '...x..x....x..x.', from: 1, vel: 0.6 },
      { inst: 'shaker', pat: 'x.xxx.xxx.xxx.xx', from: 1, vel: 0.3 },
      { inst: 'clap', pat: '....x.......x...', from: 2, vel: 0.5 },
    ],
    bass: { inst: 'pluckbass', pat: 'x..x..x.x.......', from: 1, oct: -2 },
    arp: { inst: 'steel', pat: 'x..x..x.x..x..x.', seq: [0, 2, 1, 2, 0, 3, 2, 1], from: 2, oct: 1 },
  },
  { // Finale · all lanes at once
    key: 50, scale: MINOR, prog: [0, 5, 2, 6], bpm: [112, 176], drops: true,
    march: { inst: 'timp', oct: -1, also: 'reese' },
    pad: { inst: 'choir', from: 0 },
    drums: [
      { inst: 'kick', pat: 'x...x...x...x...', from: 0, vel: 1 },
      { inst: 'clap', pat: '....x.......x...', from: 0, vel: 0.6 },
      { inst: 'ohat', pat: '..x...x...x...x.', from: 1, vel: 0.5 },
      { inst: 'hat', pat: 'xxxxxxxxxxxxxxxx', from: 2, vel: 0.25 },
      { inst: 'crash', pat: 'x...............', from: 2, vel: 0.4 },
    ],
    bass: { inst: 'reese', pat: '..x...x...x...x.', from: 1, oct: -2 },
    arp: { inst: 'supersaw', pat: 'x.xxx.xxx.xxx.xx', seq: [0, 1, 2, 1, 2, 3, 2, 1], from: 2, oct: 1 },
    lead: { inst: 'violin', from: 1, notes: mel(`7 . . . . . 4 . 7 . 8 . 9 . . .  8 . . . 7 . 5 . 4 . . . 2 . . .  2 . . . 4 . 7 . 9 . . . 11 . 9 .  8 . . . . . 6 . 6 . 4 . 3 . . .`) },
  },
  { // Title · attract mode
    key: 45, scale: MINOR, prog: [0, 5, 3, 4], bpm: [96, 96],
    march: { inst: 'pluck', oct: 0 },
    pad: { inst: 'sawpad', from: 0, vel: 0.7 },
    drums: [
      { inst: 'kick', pat: 'x...x...x...x...', from: 0, vel: 0.7 },
      { inst: 'ohat', pat: '..x...x...x...x.', from: 0, vel: 0.35 },
    ],
    bass: { inst: 'reese', pat: '..x...x...x...x.', from: 0, oct: -2 },
  },
];
const STYLE_FINALE = 7, STYLE_TITLE = 8;

const audio = (() => {
  let ctx = null, master, music, sfxBus, pump, revIn, dly, dlyIn, noiseBuf, distCurve, shipVoice = null, humVoice = null;
  let headless = false;
  const VOL = 0.85;
  // The music bed's level is the menu duck (title, pause) times the outside duck: while
  // SoundCloud's docked player is playing a real track, the synthesized music steps aside.
  let duckK = 1, extK = 1;
  const musicLevel = () => 0.62 * duckK * extK;
  // An iPhone mutes Web Audio with its ring/silent switch unless the page says it plays music
  // (Safari's Audio Session API; media elements are exempt, synthesized sound is not). Muted in
  // the game, the page steps back to ambient, so the visitor's own music can play alongside.
  function sessionType() {
    try { if (navigator.audioSession) navigator.audioSession.type = save.muted ? 'ambient' : 'playback'; } catch (err) { /* no Audio Session API */ }
  }
  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    sessionType();
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (err) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = 0.0001;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = musicLevel(); music.connect(master);
    pump = ctx.createGain(); pump.gain.value = 1; pump.connect(music);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7 * (extK < 1 ? 0.55 : 1); sfxBus.connect(master);
    // Reverb: a generated room, stereo noise with an exponential tail.
    const len = Math.floor(ctx.sampleRate * 2.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 1;
    const revOut = ctx.createGain(); revOut.gain.value = 0.32;
    revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    // Tempo-synced echo.
    dlyIn = ctx.createGain(); dly = ctx.createDelay(2); dly.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const dOut = ctx.createGain(); dOut.gain.value = 0.22;
    dlyIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(dOut); dOut.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; distCurve[i] = Math.tanh(x * 4.5) * 0.9; }
    if (!save.muted) master.gain.setTargetAtTime(VOL, ctx.currentTime + 0.02, 0.08);
    return true;
  }
  const live = () => ctx && !headless && ctx.state === 'running';

  // ---------- building blocks ----------
  function envGain(t, a, d, s, dur, r, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(peak * s, 0.0001), t + a + d);
    if (s > 0.001) g.gain.setValueAtTime(Math.max(peak * s, 0.0001), t + Math.max(dur, a + d));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + d) + r);
    return g;
  }
  function osc(type, f, t, end, detune = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.start(t); o.stop(end + 0.05); return o;
  }
  function noiseSrc(t, end) {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    n.start(t, Math.random() * 1.5); n.stop(end + 0.05); return n;
  }
  function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function send(node, rev, echo) {
    if (rev) { const g = ctx.createGain(); g.gain.value = rev; node.connect(g); g.connect(revIn); }
    if (echo) { const g = ctx.createGain(); g.gain.value = echo; node.connect(g); g.connect(dlyIn); }
  }
  function panTo(node, pan, dest) {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); p.connect(dest); }
    else node.connect(dest);
  }

  // ---------- instruments: (t, midi, dur, vel) ----------
  const INST = {
    kick(t, m, dur, v) {
      const end = t + 0.45, o = osc('sine', 155, t, end), g = envGain(t, 0.002, 0.36, 0, 0, 0.05, 0.95 * v);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      o.connect(g); g.connect(music);
      const n = noiseSrc(t, t + 0.02), hp = filt('highpass', 3000), ng = envGain(t, 0.001, 0.012, 0, 0, 0.005, 0.18 * v);
      n.connect(hp); hp.connect(ng); ng.connect(music);
      pump.gain.setTargetAtTime(0.32, t, 0.006); pump.gain.setTargetAtTime(1, t + 0.04, 0.09);
    },
    snare(t, m, dur, v) {
      const n = noiseSrc(t, t + 0.25), bp = filt('bandpass', 1900, 0.8), g = envGain(t, 0.001, 0.17, 0, 0, 0.04, 0.42 * v);
      n.connect(bp); bp.connect(g); g.connect(music); send(g, 0.22);
      const o = osc('triangle', 196, t, t + 0.12), og = envGain(t, 0.001, 0.09, 0, 0, 0.02, 0.28 * v);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08); o.connect(og); og.connect(music);
    },
    clap(t, m, dur, v) {
      const n = noiseSrc(t, t + 0.25), bp = filt('bandpass', 1300, 1.1), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(0.4 * v, t + i * 0.011); g.gain.exponentialRampToValueAtTime(0.05 * v, t + i * 0.011 + 0.009); }
      g.gain.setValueAtTime(0.36 * v, t + 0.034); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      n.connect(bp); bp.connect(g); g.connect(music); send(g, 0.3);
    },
    rim(t, m, dur, v) {
      const o = osc('square', 820, t, t + 0.05), bp = filt('bandpass', 1700, 3), g = envGain(t, 0.001, 0.035, 0, 0, 0.01, 0.2 * v);
      o.connect(bp); bp.connect(g); g.connect(music); send(g, 0.15);
    },
    hat(t, m, dur, v) {
      const n = noiseSrc(t, t + 0.06), hp = filt('highpass', 7600), g = envGain(t, 0.001, 0.04, 0, 0, 0.01, 0.16 * v);
      n.connect(hp); hp.connect(g); g.connect(music);
    },
    ohat(t, m, dur, v) {
      const n = noiseSrc(t, t + 0.3), hp = filt('highpass', 6800), g = envGain(t, 0.002, 0.22, 0, 0, 0.04, 0.14 * v);
      n.connect(hp); hp.connect(g); g.connect(pump);
    },
    shaker(t, m, dur, v) {
      const n = noiseSrc(t, t + 0.07), bp = filt('bandpass', 5200, 1.4), g = envGain(t, 0.006, 0.045, 0, 0, 0.01, 0.13 * v);
      n.connect(bp); bp.connect(g); g.connect(music);
    },
    crash(t, m, dur, v) {
      const n = noiseSrc(t, t + 1.6), hp = filt('highpass', 4200), g = envGain(t, 0.002, 1.4, 0, 0, 0.2, 0.13 * v);
      n.connect(hp); hp.connect(g); g.connect(music); send(g, 0.3);
    },
    timp(t, m, dur, v) {
      const f = mtof(m), o = osc('sine', f * 1.06, t, t + 0.9), g = envGain(t, 0.003, 0.8, 0, 0, 0.1, 0.42 * v);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      const o2 = osc('sine', f * 1.5, t, t + 0.5), g2 = envGain(t, 0.003, 0.35, 0, 0, 0.05, 0.12 * v);
      o.connect(g); o2.connect(g2); g.connect(music); g2.connect(music); send(g, 0.25);
    },
    pizz(t, m, dur, v) {
      const f = mtof(m), end = t + 0.4, lp = filt('lowpass', 2400, 1);
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
      const g = envGain(t, 0.002, 0.28, 0, 0, 0.05, 0.3 * v);
      osc('triangle', f, t, end).connect(lp); osc('sawtooth', f, t, end, 5).connect(lp);
      lp.connect(g); g.connect(music); send(g, 0.3);
    },
    cello(t, m, dur, v) {
      const f = mtof(m), end = t + dur + 0.15, lp = filt('lowpass', 900, 0.8), g = envGain(t, 0.02, 0.1, 0.7, dur, 0.12, 0.16 * v);
      osc('sawtooth', f, t, end, -6).connect(lp); osc('sawtooth', f, t, end, 6).connect(lp);
      lp.connect(g); g.connect(pump); send(g, 0.2);
    },
    harp(t, m, dur, v) {
      const f = mtof(m), g = envGain(t, 0.002, 0.7, 0, 0, 0.1, 0.12 * v);
      osc('triangle', f, t, t + 0.9).connect(g);
      const g2 = envGain(t, 0.002, 0.25, 0, 0, 0.05, 0.04 * v); osc('sine', f * 2, t, t + 0.4).connect(g2); g2.connect(music);
      g.connect(music); send(g, 0.4, 0.25);
    },
    violin(t, m, dur, v) {
      const f = mtof(m), end = t + dur + 0.35, lp = filt('lowpass', 2600, 0.9), g = envGain(t, 0.06, 0.2, 0.75, dur, 0.3, 0.085 * v);
      for (const d of [-8, 0, 8]) {
        const o = osc('sawtooth', f, t, end, d);
        const lfo = osc('sine', 5.5, t, end), lg = ctx.createGain(); lg.gain.value = 7; lfo.connect(lg); lg.connect(o.detune);
        o.connect(lp);
      }
      lp.connect(g); g.connect(music); send(g, 0.45, 0.2);
    },
    strings(t, m, dur, v) { chordVoice(t, m, dur, v, 'sawtooth', 1500, [0.25, 0.4, 0.8, 0.6], 0.045, 0.55, 9); },
    sawpad(t, m, dur, v) { chordVoice(t, m, dur, v, 'sawtooth', 1200, [0.2, 0.3, 0.7, 0.5], 0.04, 0.4, 14); },
    warmpad(t, m, dur, v) { chordVoice(t, m, dur, v, 'triangle', 1800, [0.15, 0.3, 0.8, 0.5], 0.07, 0.45, 7); },
    darkpad(t, m, dur, v) { chordVoice(t, m, dur, v, 'sawtooth', 600, [0.4, 0.5, 0.8, 0.8], 0.05, 0.5, 11); },
    brightpad(t, m, dur, v) { chordVoice(t, m, dur, v, 'square', 2400, [0.1, 0.3, 0.6, 0.4], 0.03, 0.35, 10); },
    choir(t, m, dur, v) {
      const f = mtof(m), end = t + dur + 0.8;
      const g = envGain(t, 0.35, 0.4, 0.8, dur, 0.7, 0.07 * v);
      const f1 = filt('bandpass', 720, 4), f2 = filt('bandpass', 1150, 5), mix = ctx.createGain(); mix.gain.value = 1.6;
      for (const d of [-10, 0, 10]) { const o = osc('sawtooth', f, t, end, d); o.connect(f1); o.connect(f2); }
      f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(pump); send(g, 0.6);
    },
    supersaw(t, m, dur, v) {
      const f = mtof(m), end = t + dur + 0.2, lp = filt('lowpass', 2000, 1.2);
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1600, t + 0.16);
      const g = envGain(t, 0.004, 0.14, 0.4, dur, 0.12, 0.05 * v);
      for (const d of [-18, -8, 0, 8, 18]) osc('sawtooth', f, t, end, d).connect(lp);
      lp.connect(g); g.connect(music); send(g, 0.25, 0.32);
    },
    acid(t, m, dur, v) {
      const f = mtof(m), end = t + 0.3, lp = filt('lowpass', 400, 9);
      lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.2);
      const g = envGain(t, 0.002, 0.2, 0, 0, 0.04, 0.2 * v);
      osc('sawtooth', f, t, end).connect(lp); lp.connect(g); g.connect(music); send(g, 0, 0.25);
    },
    pluck(t, m, dur, v) {
      const f = mtof(m), end = t + 0.35, lp = filt('lowpass', 900, 3);
      lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
      const g = envGain(t, 0.002, 0.22, 0, 0, 0.04, 0.12 * v);
      osc('square', f, t, end).connect(lp); osc('sawtooth', f, t, end, 7).connect(lp);
      lp.connect(g); g.connect(music); send(g, 0.2, 0.3);
    },
    organ(t, m, dur, v) {
      const f = mtof(m), end = t + 0.3, lp = filt('lowpass', 2600, 0.8), g = envGain(t, 0.003, 0.16, 0.2, 0.1, 0.08, 0.06 * v);
      osc('square', f, t, end).connect(lp); osc('sine', f * 2, t, end).connect(lp); osc('sine', f / 2, t, end).connect(lp);
      lp.connect(g); g.connect(pump); send(g, 0.25, 0.15);
    },
    housebass(t, m, dur, v) {
      const f = mtof(m), end = t + Math.max(dur, 0.2) + 0.1, lp = filt('lowpass', 500, 4);
      lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(320, t + 0.15);
      const g = envGain(t, 0.003, 0.14, 0.5, Math.min(dur, 0.25), 0.06, 0.32 * v);
      osc('sawtooth', f, t, end).connect(lp); osc('sine', f, t, end).connect(g);
      lp.connect(g); g.connect(music);
    },
    pluckbass(t, m, dur, v) {
      const f = mtof(m), end = t + 0.4, lp = filt('lowpass', 700, 2);
      lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.2);
      const g = envGain(t, 0.003, 0.28, 0, 0, 0.05, 0.34 * v);
      osc('triangle', f, t, end).connect(lp); osc('sine', f, t, end).connect(g); lp.connect(g); g.connect(music);
    },
    sub(t, m, dur, v) {
      const f = mtof(m), end = t + 0.6, g = envGain(t, 0.004, 0.25, 0.4, 0.2, 0.15, 0.55 * v);
      const o = osc('sine', f * 2, t, end); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      o.connect(g);
      const sh = ctx.createWaveShaper(); sh.curve = distCurve; const sg = ctx.createGain(); sg.gain.value = 0.05;
      o.connect(sh); sh.connect(sg); sg.connect(g);
      g.connect(music);
    },
    reese(t, m, dur, v) {
      const f = mtof(m), end = t + dur + 0.1, lp = filt('lowpass', 700, 1.5), g = envGain(t, 0.006, 0.1, 0.8, dur, 0.06, 0.15 * v);
      osc('sawtooth', f, t, end, -14).connect(lp); osc('sawtooth', f, t, end, 14).connect(lp);
      const s = osc('sine', f / 2, t, end), sg = ctx.createGain(); sg.gain.value = 1.4; s.connect(sg); sg.connect(g);
      lp.connect(g); g.connect(pump);
    },
    wobble(t, m, dur, v) {
      const f = mtof(m), end = t + dur + 0.1, lp = filt('lowpass', 300, 7), g = envGain(t, 0.01, 0.1, 0.85, dur, 0.08, 0.2 * v);
      osc('sawtooth', f, t, end, -10).connect(lp); osc('square', f, t, end, 10).connect(lp);
      const rate = 1 / (music16 * 2), lfo = osc('sine', rate, t, end), lg = ctx.createGain(); lg.gain.value = 900;
      lfo.connect(lg); lg.connect(lp.frequency); lp.frequency.value = 1050;
      const s = osc('sine', f, t, end), sg = ctx.createGain(); sg.gain.value = 1.1; s.connect(sg); sg.connect(g);
      lp.connect(g); g.connect(music);
    },
    piano(t, m, dur, v) {
      const f = mtof(m), end = t + 2.2, g = envGain(t, 0.002, 1.8, 0, 0, 0.2, 0.17 * v);
      osc('triangle', f, t, end).connect(g);
      const g2 = envGain(t, 0.002, 0.6, 0, 0, 0.1, 0.07 * v); osc('sine', f * 2, t, end).connect(g2); g2.connect(g);
      const g3 = envGain(t, 0.001, 0.15, 0, 0, 0.05, 0.05 * v); osc('sine', f * 3.01, t, t + 0.3).connect(g3); g3.connect(g);
      g.connect(music); send(g, 0.45, 0.12);
    },
    distbass(t, m, dur, v) {
      const f = mtof(m), end = t + Math.max(dur, 0.12) + 0.06, sh = ctx.createWaveShaper(); sh.curve = distCurve;
      const pre = ctx.createGain(); pre.gain.value = 1.6;
      const lp = filt('lowpass', 1900, 1), g = envGain(t, 0.003, 0.08, 0.6, Math.min(dur, 0.16), 0.04, 0.11 * v);
      osc('sawtooth', f, t, end).connect(pre); osc('square', f / 2, t, end).connect(pre);
      pre.connect(sh); sh.connect(lp); lp.connect(g); g.connect(music);
    },
    power(t, m, dur, v) {
      const end = t + dur + 0.1, sh = ctx.createWaveShaper(); sh.curve = distCurve;
      const pre = ctx.createGain(); pre.gain.value = 1.2;
      const lp = filt('lowpass', 2800, 0.8), g = envGain(t, 0.004, 0.2, 0.55, dur, 0.1, 0.06 * v);
      for (const st of [0, 7, 12]) { osc('sawtooth', mtof(m + st), t, end, -6).connect(pre); osc('sawtooth', mtof(m + st), t, end, 6).connect(pre); }
      pre.connect(sh); sh.connect(lp); lp.connect(g); g.connect(music); send(g, 0.12);
    },
    marimba(t, m, dur, v) {
      const f = mtof(m), g = envGain(t, 0.002, 0.42, 0, 0, 0.05, 0.3 * v);
      osc('sine', f, t, t + 0.5).connect(g);
      const g2 = envGain(t, 0.001, 0.06, 0, 0, 0.02, 0.12 * v); osc('sine', f * 3.98, t, t + 0.1).connect(g2); g2.connect(music);
      g.connect(music); send(g, 0.2);
    },
    steel(t, m, dur, v) {
      const f = mtof(m), end = t + 0.9, g = envGain(t, 0.003, 0.75, 0, 0, 0.1, 0.12 * v);
      const o = osc('sine', f * 1.012, t, end); o.frequency.exponentialRampToValueAtTime(f, t + 0.04); o.connect(g);
      const g2 = envGain(t, 0.002, 0.35, 0, 0, 0.05, 0.06 * v); osc('sine', f * 2, t, end).connect(g2); g2.connect(g);
      const g3 = envGain(t, 0.002, 0.15, 0, 0, 0.03, 0.035 * v); osc('sine', f * 3, t, end).connect(g3); g3.connect(g);
      g.connect(music); send(g, 0.3, 0.2);
    },
    bell(t, m, dur, v, dest) {
      const f = mtof(m), end = t + 1.8, g = envGain(t, 0.002, 1.5, 0, 0, 0.2, 0.1 * v);
      osc('sine', f, t, end).connect(g);
      const g2 = envGain(t, 0.002, 0.7, 0, 0, 0.1, 0.05 * v); osc('sine', f * 2.76, t, end).connect(g2); g2.connect(g);
      const g3 = envGain(t, 0.001, 0.25, 0, 0, 0.05, 0.03 * v); osc('sine', f * 5.4, t, end).connect(g3); g3.connect(g);
      g.connect(dest || sfxBus); send(g, 0.4, 0.3);
    },
  };
  function chordVoice(t, m, dur, v, type, cut, adsr, peak, rev, det) {
    const f = mtof(m), end = t + dur + adsr[3] + 0.05, lp = filt('lowpass', cut, 0.7);
    const g = envGain(t, adsr[0], adsr[1], adsr[2], dur, adsr[3], peak * v);
    osc(type, f, t, end, -det).connect(lp); osc(type, f, t, end, det).connect(lp);
    lp.connect(g); g.connect(pump); send(g, rev);
  }
  const stats = { voices: 0, errors: 0, last: '' };
  function play(inst, t, m, dur, v, dest) {
    if (!live()) return;
    try { INST[inst](t, m, dur, v, dest); stats.voices++; } catch (err) { stats.errors++; stats.last = `${inst}: ${err.message}`; }      // a voice that fails to build is skipped, and counted
  }

  // ---------- the conductor ----------
  let music16 = 0.167;
  const cond = {
    time: 0, next: 0, s: 0, origin: 0, bpm: 96, target: 96, style: STYLES[STYLE_TITLE], styleIdx: STYLE_TITLE, level: 0,
    queue: [], marchCount: 0, marchScheduled: 0, keyNotes: [], muteDrums: 0, filter: 1,
    onEvent: null, marchDiv: () => 4,
  };
  const LOOK = 0.12;
  function chordAt(st, bar) {
    const root = st.prog[bar % st.prog.length];
    return [0, 2, 4, 7].map((o) => degMidi(st.key, st.scale, root + o));
  }
  function scheduleStep(ev, when) {
    const st = cond.style, rel = ev.rel, pos = rel % 16, bar = Math.floor(rel / 16), lvl = cond.level;
    const sixteenth = 60 / cond.bpm / 4;
    const chord = chordAt(st, bar);
    if (ev.march) {
      const root = st.prog[bar % st.prog.length];
      const m = degMidi(st.key, st.scale, root - (ev.mi % 4)) + 12 * (st.march.oct || 0);
      play(st.march.inst, when, m, sixteenth * 3, 0.95);
      if (st.march.also) play(st.march.also, when, m - 12, sixteenth * 2, 0.55);
    }
    if (cond.muteDrums <= 0) {
      for (const d of st.drums) if (lvl >= d.from && d.pat[pos] === 'x') play(d.inst, when, 0, 0, d.vel);
    }
    // a riser into each drop
    if (st.drops && bar % 4 === 3 && pos >= 8 && lvl >= 1) play('snare', when, 0, 0, 0.18 + (pos - 8) * 0.06);
    if (st.pad && lvl >= st.pad.from && pos === 0) for (const n of chord.slice(0, 3)) play(st.pad.inst, when, n + 12 * (st.pad.oct || 0), sixteenth * 15, st.pad.vel || 1);
    if (st.bass && lvl >= st.bass.from && st.bass.pat[pos] === 'x') play(st.bass.inst, when, chord[0] + 12 * (st.bass.oct || 0), sixteenth * (st.bass.len || 1.6), 0.9);
    if (st.arp && lvl >= st.arp.from && st.arp.pat[pos] === 'x') {
      const k = st.arp.seq[(rel >> 1) % st.arp.seq.length];
      play(st.arp.inst, when, chord[k] + 12 * (st.arp.oct || 0), sixteenth * 1.5, 0.8);
    }
    if (st.stab && lvl >= st.stab.from && st.stab.pat[pos] === 'x') for (const n of chord.slice(0, 3)) play(st.stab.inst, when, n + 12 * st.stab.oct, sixteenth, 0.9);
    if (st.power && lvl >= st.power.from && st.power.pat[pos] === 'x') play(st.power.inst, when, chord[0] + 12 * st.power.oct, sixteenth * 2.5, 0.9);
    if (st.chords && lvl >= st.chords.from && st.chords.pat[pos] === 'x') for (const n of chord.slice(0, 3)) play(st.chords.inst, when, n + 12 * st.chords.oct, sixteenth * 4, 0.55);
    if (st.lead && lvl >= st.lead.from) {
      const d = st.lead.notes[rel % st.lead.notes.length];
      if (d != null) play(st.lead.inst, when, degMidi(st.key, st.scale, d) + 12, sixteenth * 3, 0.85);
    }
    // notes the player plays (the piano wave), quantized to this step
    if (cond.keyNotes.length && pos % 2 === 0) { for (const m of cond.keyNotes) play('piano', when, m, sixteenth * 4, 1.05); cond.keyNotes.length = 0; }
    if (dly && live()) dly.delayTime.setTargetAtTime(Math.min(1.9, sixteenth * 3), when, 0.05);
  }
  // Advances the conductor by dt seconds of game time, scheduling ahead and firing due events.
  function tick(dt) {
    cond.time += dt;
    cond.bpm = damp(cond.bpm, cond.target, 2.5, dt);
    if (cond.muteDrums > 0) cond.muteDrums -= dt;
    const ahead = cond.time + LOOK;
    let guard = 0;
    while (cond.next <= ahead && guard++ < 64) {
      const rel = cond.s - cond.origin;
      const div = cond.marchDiv();
      const ev = { t: cond.next, s: cond.s, rel, pos: rel % 16, bar: Math.floor(rel / 16), march: div > 0 && rel % div === 0, mi: 0, beat: rel % 4 === 0, drop: false };
      if (ev.march) { ev.mi = cond.marchCount++; cond.marchScheduled++; }
      ev.drop = !!cond.style.drops && ev.pos === 0 && ev.bar > 0 && ev.bar % 4 === 0;
      if (live()) scheduleStep(ev, ctx.currentTime + Math.max(0, ev.t - cond.time) + 0.02);
      cond.queue.push(ev);
      music16 = 60 / cond.bpm / 4;
      cond.next += music16;
      cond.s++;
    }
    while (cond.queue.length && cond.queue[0].t <= cond.time) {
      const ev = cond.queue.shift();
      if (cond.onEvent) cond.onEvent(ev);
    }
  }
  // A new section: the bar count restarts on the next sixteenth, march counters reset.
  function setStyle(idx, bpm) {
    cond.styleIdx = idx; cond.style = STYLES[idx];
    cond.origin = cond.s; cond.queue.length = 0; cond.next = Math.max(cond.next, cond.time);
    cond.marchCount = 0; cond.marchScheduled = 0; cond.level = 0;
    cond.target = bpm || cond.style.bpm[0];
    if (bpm) cond.bpm = bpm;
  }
  function pendingMarch() { return cond.queue.filter((e) => e.march).length; }

  // ---------- sound effects (immediate, panned by x) ----------
  const now = () => ctx.currentTime;
  const scaleNote = (i) => degMidi(cond.style.key + 24, cond.style.scale, i);
  const fx = {
    shoot(x, kind = 0) {
      if (!live()) return;
      const t = now(), o = osc('square', kind === 2 ? 1900 : 1500, t, t + 0.12), g = envGain(t, 0.001, 0.09, 0, 0, 0.02, 0.07);
      o.frequency.exponentialRampToValueAtTime(kind === 1 ? 300 : 420, t + 0.09);
      const lp = filt('lowpass', 3500); o.connect(lp); lp.connect(g); panTo(g, x / HW * 0.5, sfxBus);
    },
    hit(x, combo) {
      if (!live()) return;
      const t = now(), m = scaleNote(Math.min(combo, 14));
      const o = osc('triangle', mtof(m), t, t + 0.2), g = envGain(t, 0.001, 0.14, 0, 0, 0.03, 0.12);
      o.connect(g); panTo(g, x / HW * 0.6, sfxBus); send(g, 0.2, 0.15);
      fx.crunch(x, 0.6);
    },
    crunch(x, k = 1) {
      if (!live()) return;
      const t = now(), n = noiseSrc(t, t + 0.4), lp = filt('lowpass', 2400, 0.8), g = envGain(t, 0.001, 0.28 * k, 0, 0, 0.05, 0.22 * k);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.3);
      n.connect(lp); lp.connect(g); panTo(g, x / HW * 0.6, sfxBus);
      const o = osc('sine', 110, t, t + 0.25), og = envGain(t, 0.001, 0.2, 0, 0, 0.03, 0.25 * k);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.2); o.connect(og); og.connect(sfxBus);
    },
    clank(x) {
      if (!live()) return;
      const t = now(), bp = filt('bandpass', 2400, 6), g = envGain(t, 0.001, 0.16, 0, 0, 0.04, 0.14);
      osc('square', 310, t, t + 0.2).connect(bp); osc('square', 467, t, t + 0.2).connect(bp);
      bp.connect(g); panTo(g, x / HW * 0.6, sfxBus); send(g, 0.25);
    },
    tick(x) {
      if (!live()) return;
      const t = now(), n = noiseSrc(t, t + 0.05), hp = filt('highpass', 3000), g = envGain(t, 0.001, 0.03, 0, 0, 0.01, 0.1);
      n.connect(hp); hp.connect(g); panTo(g, x / HW * 0.6, sfxBus);
    },
    die() {
      if (!live()) return;
      const t = now(), n = noiseSrc(t, t + 1.4), lp = filt('lowpass', 5000, 2), g = envGain(t, 0.002, 1.2, 0, 0, 0.1, 0.4);
      lp.frequency.exponentialRampToValueAtTime(120, t + 1.1);
      n.connect(lp); lp.connect(g); g.connect(sfxBus); send(g, 0.3);
      const o = osc('sawtooth', 220, t, t + 1), og = envGain(t, 0.002, 0.9, 0, 0, 0.1, 0.12), ol = filt('lowpass', 900);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.9); o.connect(ol); ol.connect(og); og.connect(sfxBus);
      music.gain.setTargetAtTime(musicLevel() * 0.4, t, 0.05); music.gain.setTargetAtTime(musicLevel(), t + 1.2, 0.4);
    },
    ship(on, x = 0) {
      if (!ctx) return;
      if (on && live() && !shipVoice) {
        const t = now(), o = osc('triangle', 640, t, t + 60), lfo = osc('sine', 7.5, t, t + 60), lg = ctx.createGain();
        lg.gain.value = 170; lfo.connect(lg); lg.connect(o.frequency);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.3);
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        o.connect(g); if (p) { g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
        shipVoice = { o, lfo, g, p };
      } else if (!on && shipVoice) {
        const t = now(), v = shipVoice; shipVoice = null;
        v.g.gain.setTargetAtTime(0.0001, t, 0.06); v.o.stop(t + 0.4); v.lfo.stop(t + 0.4);
      }
      if (shipVoice && shipVoice.p) shipVoice.p.pan.setTargetAtTime(clamp(x / (HW + 8), -1, 1) * 0.8, now(), 0.05);
    },
    hum(on, k = 0) {
      if (!ctx) return;
      if (on && live() && !humVoice) {
        const t = now(), lp = filt('lowpass', 260, 2), g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 1.5);
        const a = osc('sawtooth', 41.2, t, t + 600), b = osc('sawtooth', 41.2, t, t + 600, 16);
        a.connect(lp); b.connect(lp); lp.connect(g); g.connect(sfxBus);
        humVoice = { a, b, g, lp };
      } else if (!on && humVoice) {
        const t = now(), v = humVoice; humVoice = null;
        v.g.gain.setTargetAtTime(0.0001, t, 0.2); v.a.stop(t + 1.5); v.b.stop(t + 1.5);
      }
      if (humVoice) humVoice.lp.frequency.setTargetAtTime(200 + k * 500, now(), 0.3);
    },
    shipHit(x) {
      if (!live()) return;
      const t = now(), base = cond.style.key + 12;
      for (const st of [0, 7, 12, 16]) INST.supersaw(t, base + st, 0.5, 1.2);
      INST.crash(t, 0, 0, 1); fx.crunch(x, 1.2);
    },
    catchRecord() {
      if (!live()) return;
      const t = now(), k = cond.style.key + 24;
      [0, 4, 7, 12, 16, 19, 24].forEach((st, i) => INST.bell(t + i * 0.07, k + st, 0, 1.1));
      INST.crash(t, 0, 0, 0.6);
    },
    miss() {
      if (!live()) return;
      const t = now(), k = cond.style.key + 12;
      INST.bell(t, k + 7, 0, 0.8); INST.bell(t + 0.18, k + 6, 0, 0.8); INST.bell(t + 0.36, k, 0, 0.8);
    },
    powerup() {
      if (!live()) return;
      const t = now();
      for (let i = 0; i < 6; i++) { const o = osc('square', mtof(cond.style.key + 24 + [0, 4, 7, 12, 16, 19][i]), t + i * 0.045, t + i * 0.045 + 0.1), g = envGain(t + i * 0.045, 0.002, 0.08, 0, 0, 0.02, 0.06); o.connect(g); g.connect(sfxBus); send(g, 0, 0.3); }
    },
    life() {
      if (!live()) return;
      const t = now(), k = cond.style.key + 24;
      [0, 7, 12, 7, 12, 19].forEach((st, i) => INST.bell(t + i * 0.09, k + st, 0, 1));
    },
    bassBomb(x) {
      if (!live()) return;
      const t = now(), o = osc('sine', 130, t, t + 1), g = envGain(t, 0.002, 0.9, 0, 0, 0.1, 0.6);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.8); o.connect(g); g.connect(sfxBus);
      fx.crunch(x, 1.1);
    },
    clear() {
      if (!live()) return;
      const t = now(), st = cond.style;
      [0, 4, 7].forEach((d, i) => { [0, 2, 4].forEach((o) => INST.supersaw(t + i * 0.16, degMidi(st.key + 12, st.scale, d + o), i === 2 ? 0.8 : 0.12, 1)); });
      INST.crash(t + 0.32, 0, 0, 0.8);
    },
    over() {
      if (!live()) return;
      const t = now(), k = cond.style.key + 12;
      [7, 6, 5, 3, 0].forEach((st, i) => INST.pizz(t + i * 0.22, k + st, 0, 1));
    },
    shatter(x) {
      if (!live()) return;
      const t = now(), n = noiseSrc(t, t + 0.6), hp = filt('highpass', 2500), g = envGain(t, 0.001, 0.5, 0, 0, 0.05, 0.2);
      n.connect(hp); hp.connect(g); panTo(g, x / HW * 0.6, sfxBus); send(g, 0.3);
      INST.bell(t, cond.style.key + 31, 0, 0.7);
    },
    ui(kind = 0) {
      if (!live()) return;
      const t = now(), o = osc('square', kind ? 1320 : 880, t, t + 0.08), g = envGain(t, 0.001, 0.05, 0, 0, 0.01, 0.04);
      o.connect(g); g.connect(sfxBus);
    },
  };

  return {
    cond, tick, setStyle, pendingMarch, fx, STYLES, stats,
    // Called from every tap, click and key (part 8). Resumes from 'suspended', and from Safari's
    // 'interrupted' (a call, another app taking the audio). Older iOS opens the output only when a
    // source starts inside the gesture itself, hence the one silent sample.
    start() {
      // Outside a gesture (the /#play link, a finger's pointerdown) it would be refused anyway.
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      if (!ensure() || ctx.state === 'running') return;
      ctx.resume().catch(() => {});
      try {
        const blip = ctx.createBufferSource();
        blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        blip.connect(ctx.destination); blip.start(0);
      } catch (err) { /* the resume above is what matters */ }
    },
    get ready() { return !!ctx && ctx.state === 'running'; },
    set headless(v) { headless = v; },
    get headless() { return headless; },
    setMuted(m) {
      save.muted = m; persist();
      sessionType();
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(m ? 0.0001 : VOL, ctx.currentTime, 0.06);
    },
    duck(k) { duckK = k; if (ctx) music.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.15); },
    // SoundCloud's player started (true) or stopped (false): the music bed fades out of its way
    // and the effects drop back, so a real track is heard over the game, not under it.
    external(on) {
      extK = on ? 0 : 1;
      if (!ctx) return;
      music.gain.setTargetAtTime(musicLevel(), ctx.currentTime, on ? 0.12 : 0.6);
      sfxBus.gain.setTargetAtTime(0.7 * (on ? 0.55 : 1), ctx.currentTime, 0.2);
    },
    playKey(m) { cond.keyNotes.push(m); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state !== 'running' && !save.muted) ctx.resume().catch(() => {}); },
  };
})();
