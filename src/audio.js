// Procedural heavy-metal loops + SFX, all Web Audio. No samples, no licensing.
// Music is pre-rendered into AudioBuffers so slow-mo can bend tempo AND pitch via playbackRate.

export const BPM = 150;
export const BEAT = 60 / BPM;
const BARS = 8;
export const LOOP_LEN = BARS * 4 * BEAT; // 12.8s

// Melodic trap-rock, built to headbang to: half-time bounce at 150 BPM (feels like 75),
// booming gliding 808s, trap hats with rolls, a big reverb clap on beat 3, moody clean guitar,
// a wordless "oh-oh" hook and crunchy guitar strums in the chorus.
// chords: [semitones from root, quality 'm' | 'M'] — one chord per 2 bars
const BIOME_SONGS = [
  { root: 41.2,  chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']], hook: [7, 10, 12, 10, 7, 5, 3, 5] },   // E minor
  { root: 36.71, chords: [[0, 'm'], [5, 'm'], [-4, 'M'], [-5, 'M']], hook: [12, 10, 8, 7, 8, 10, 12, 15] },  // D minor
  { root: 46.25, chords: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-2, 'M']], hook: [3, 5, 7, 10, 7, 5, 7, 3] },     // F# minor
  { root: 38.89, chords: [[0, 'm'], [-4, 'M'], [5, 'm'], [7, 'M']], hook: [10, 12, 15, 12, 10, 7, 10, 12] }, // Eb minor
];

function distCurve(k = 120) {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}

function noiseBuffer(ctx, sec = 1) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export async function renderSong(song, variant) {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(LOOP_LEN * sr), sr);
  const noise = noiseBuffer(ctx, 1);
  const master = ctx.createGain(); master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
  const post = ctx.createGain(); post.gain.value = 0.7;
  master.connect(comp).connect(post).connect(ctx.destination);
  // reverb (generated plate-ish impulse)
  const ir = ctx.createBuffer(2, sr * 2.4, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  const verb = ctx.createConvolver(); verb.buffer = ir;
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb).connect(master);
  const sat = distCurve(8), crunch = distCurve(70);

  const s16 = BEAT / 4, bar = 4 * BEAT;
  const hz = (semis, oct = 0) => song.root * Math.pow(2, semis / 12 + oct);
  const chordAt = (b) => song.chords[Math.floor(b / 2) % song.chords.length];
  const tones = ([r, q]) => [r, r + (q === 'm' ? 3 : 4), r + 7, r + 12, r + (q === 'm' ? 15 : 16)];

  // ---- 808: saturated sine with glide + click
  const bass808 = (t, semis, len, glideFrom) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = hz(semis, 1);
    if (glideFrom != null) { o.frequency.setValueAtTime(hz(glideFrom, 1), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); }
    else { o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035); }
    const ws = ctx.createWaveShaper(); ws.curve = sat;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.85, t + 0.006);
    g.gain.setValueAtTime(0.85, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(ws).connect(lp).connect(g).connect(master); o.start(t); o.stop(t + len + 0.02);
  };
  const kick = (t, v = 1) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
    const n = ctx.createBufferSource(); n.buffer = noise; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3000;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.4 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    n.connect(nf).connect(ng).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.02);
  };
  // big clap+snare on beat 3 — the headbang hit
  const clap = (t, v = 1) => {
    for (let k = 0; k < 3; k++) {
      const n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9;
      const g = ctx.createGain(); const tt = t + k * 0.011;
      g.gain.setValueAtTime(0.75 * v, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + (k === 2 ? 0.22 : 0.03));
      n.connect(f).connect(g); g.connect(master); if (k === 2) g.connect(verbIn);
      n.start(tt, Math.random() * 0.5); n.stop(tt + 0.25);
    }
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.06);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.55 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.14);
  };
  const hat = (t, v = 1, open = false) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g = ctx.createGain(); g.gain.setValueAtTime((open ? 0.16 : 0.11) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.035));
    const p = ctx.createStereoPanner(); p.pan.value = 0.25;
    n.connect(f).connect(g).connect(p).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.25);
  };
  const crash = (t) => {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    n.connect(f).connect(g); g.connect(master); g.connect(verbIn); n.start(t); n.stop(t + 1.9);
  };
  // clean chorus guitar pluck
  const pluck = (t, semis, pan) => {
    const f = hz(semis, 3);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3600, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    lp.connect(g).connect(p); p.connect(master); p.connect(verbIn);
    for (const [type, det, vol] of [['triangle', 0, 1], ['sawtooth', 9, 0.35], ['sawtooth', -9, 0.35]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = vol; o.connect(og).connect(lp); o.start(t); o.stop(t + 0.95);
    }
  };
  // warm pad
  const pad = (t, chord, len) => {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.setValueAtTime(0.05, t + len - 0.3); g.gain.linearRampToValueAtTime(0, t + len);
    lp.connect(g); g.connect(master); g.connect(verbIn);
    for (const st of tones(chord).slice(0, 3)) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(st, 3); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + len + 0.02);
    }
  };
  // crunchy power-chord strum (chorus)
  const strum = (t, chord, len, pan) => {
    const pre = ctx.createGain(); pre.gain.value = 2;
    const ws = ctx.createWaveShaper(); ws.curve = crunch;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.01); g.gain.exponentialRampToValueAtTime(0.02, t + len);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    pre.connect(ws).connect(hp).connect(lp).connect(g).connect(p); p.connect(master); p.connect(verbIn);
    const r = chord[0];
    [r, r + 7, r + 12].forEach((st, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(st, 2); o.detune.value = pan * 8;
      o.connect(pre); o.start(t + i * 0.008); o.stop(t + len + 0.02);
    });
  };
  // wordless vocal-ish "oh" hook (formant synth)
  const vox = (t, semis, len, prevSemis) => {
    const f = hz(semis, 4);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    if (prevSemis != null) { o.frequency.setValueAtTime(hz(prevSemis, 4), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); }
    else o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.value = f * 0.012; vib.connect(vg).connect(o.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1080; f2.Q.value = 8;
    const mix = ctx.createGain(); mix.gain.value = 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.05); g.gain.setValueAtTime(0.32, t + len * 0.8); g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(f1).connect(mix); o.connect(f2).connect(mix); mix.connect(g); g.connect(master); g.connect(verbIn);
    o.start(t); vib.start(t); o.stop(t + len + 0.02); vib.stop(t + len + 0.02);
  };

  let prev808 = null, prevVox = null;
  for (let b = 0; b < BARS; b++) {
    const bt = b * bar, chord = chordAt(b), chorus = b >= 4, ct = tones(chord);
    if (b % 2 === 0) pad(bt, chord, bar * 2);
    if (b === 0 || b === 4) crash(bt);
    // drums: half-time bounce — kick 1 & the "and" of 3, clap on 3 (step 8)
    const kicks = chorus ? [0, 3, 10, 11] : [0, 10];
    for (const k of kicks) kick(bt + k * s16, k === 0 ? 1 : 0.85);
    clap(bt + 8 * s16, chorus ? 1.15 : 1);
    for (let st = 0; st < 16; st += 2) hat(bt + st * s16, st % 4 === 0 ? 1 : 0.7, st === 14 && b % 2 === 1);
    if (b % 2 === 1) for (let r = 0; r < 6; r++) hat(bt + 12 * s16 + r * (s16 * 4 / 6), 0.55 + r * 0.08); // triplet roll
    if (b === 3 || b === 7) for (let r = 0; r < 8; r++) hat(bt + 14 * s16 + r * s16 / 4, 0.5 + r * 0.06); // 32nd roll
    // 808 follows the kick, glides on the turnaround
    bass808(bt, chord[0], BEAT * 2.4, prev808 != null && prev808 !== chord[0] && b % 2 === 0 ? prev808 : null);
    bass808(bt + 10 * s16, chord[0] + (b % 2 ? 7 : 0), BEAT * 1.4, chord[0]);
    prev808 = chord[0] + (b % 2 ? 7 : 0);
    // clean arpeggio on 8ths
    const arp = [0, 2, 3, 1, 4, 2, 3, 1];
    for (let i = 0; i < 8; i++) pluck(bt + i * 2 * s16, ct[arp[i]], i % 2 ? 0.35 : -0.35);
    if (chorus) {
      strum(bt, chord, BEAT * 1.9, -0.7); strum(bt, chord, BEAT * 1.9, 0.7);
      strum(bt + 2 * BEAT, chord, BEAT * 1.9, -0.7); strum(bt + 2 * BEAT, chord, BEAT * 1.9, 0.7);
      // hook: two notes per bar
      const h = song.hook, i0 = ((b - 4) * 2) % h.length;
      vox(bt, h[i0], BEAT * 1.8, prevVox); vox(bt + 2 * BEAT, h[i0 + 1], BEAT * 1.6, h[i0]);
      prevVox = h[i0 + 1];
    }
  }
  return ctx.startRendering();
}

export { BIOME_SONGS };
// start rendering riffs as soon as the page loads so PLAY is instant
const prerender = [];
let chain = Promise.resolve();
for (let i = 0; i < BIOME_SONGS.length; i++) { chain = chain.then(() => renderSong(BIOME_SONGS[i], i)); prerender[i] = chain; }

export class AudioEngine {
  constructor() {
    this.ctx = null; this.buffers = []; this.src = null; this.rate = 1;
    this.songPos = 0; this.curSong = 0; this.started = false;
  }
  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0.85;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.Q.value = 1.2;
    this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.7;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -8;
    this.musicGain.connect(this.lp).connect(this.comp);
    this.sfxGain.connect(this.comp);
    this.comp.connect(c.destination);
    this.noise = noiseBuffer(c, 1.5);
    this.ws = distCurve(60);
    this.buffers[0] = await prerender[0];
    prerender.forEach((p, i) => p.then((b) => (this.buffers[i] = b)));
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }

  play(song = 0) {
    this.stop();
    this.songPos = 0; this.curSong = song;
    this._startSource(song, 0, 0);
    this.started = true;
  }
  _startSource(song, offset, fadeIn) {
    const c = this.ctx, buf = this.buffers[song] || this.buffers[0];
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = this.rate;
    const g = c.createGain();
    g.gain.setValueAtTime(fadeIn ? 0 : 1, c.currentTime);
    if (fadeIn) g.gain.linearRampToValueAtTime(1, c.currentTime + fadeIn);
    s.connect(g).connect(this.musicGain);
    s.start(c.currentTime, offset % LOOP_LEN);
    this.src = s; this.srcGain = g;
  }
  switchSong(song) {
    if (!this.started || song === this.curSong) return;
    this.curSong = song;
    const old = this.src, oldG = this.srcGain, c = this.ctx;
    if (oldG) { oldG.gain.setValueAtTime(oldG.gain.value, c.currentTime); oldG.gain.linearRampToValueAtTime(0, c.currentTime + 0.6); }
    if (old) old.stop(c.currentTime + 0.65);
    this._startSource(song, this.songPos, 0.5); // phase-aligned, same BPM
  }
  stop() { if (this.src) { try { this.src.stop(); } catch (e) {} this.src = null; } this.started = false; }

  // called every frame with real dt and desired time scale
  // music bends with game time but much less: slow-mo stays groovy instead of turning to mud.
  // focus mode = a deliberate half-time, pitched-down, filtered version of the song.
  update(realDt, timeScale, focus = false) {
    if (!this.started) return;
    const rate = focus ? 0.66 : 1 - (1 - timeScale) * 0.4;
    this.rate += (rate - this.rate) * (1 - Math.exp(-realDt * (focus ? 7 : 10)));
    this.src.playbackRate.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
    const cut = focus ? 1500 : this.rate < 0.97 ? 2500 + 15000 * (this.rate - 0.6) : 20000;
    this.lp.frequency.setTargetAtTime(Math.max(600, cut), this.ctx.currentTime, 0.06);
    this.lp.Q.setTargetAtTime(focus ? 6 : 1.2, this.ctx.currentTime, 0.1);
    this.songPos += realDt * this.rate;
  }
  get beat() { return this.songPos / BEAT; }

  // ---------- SFX ----------
  _noise(t, { dur = 0.1, type = 'bandpass', freq = 1000, q = 1, vol = 0.5, sweep = 0 } = {}) {
    const c = this.ctx, n = c.createBufferSource(); n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.sfxGain); n.start(t, Math.random()); n.stop(t + dur + 0.02);
  }
  _tone(t, { type = 'sine', f0 = 200, f1 = 50, dur = 0.15, vol = 0.5, dist = false } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o;
    if (dist) { const w = c.createWaveShaper(); w.curve = this.ws; node = o.connect(w); }
    node.connect(g).connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  sfx(name, opt = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'pistol':
        this._noise(t, { dur: 0.09, freq: 1800, q: 0.6, vol: 0.9 });
        this._tone(t, { type: 'square', f0: 180, f1: 40, dur: 0.12, vol: 0.5, dist: true }); break;
      case 'shotgun':
        this._noise(t, { dur: 0.3, type: 'lowpass', freq: 3000, sweep: 300, vol: 1.1 });
        this._tone(t, { type: 'square', f0: 120, f1: 30, dur: 0.25, vol: 0.7, dist: true }); break;
      case 'smg':
        this._noise(t, { dur: 0.05, freq: 2500, q: 0.8, vol: 0.6 });
        this._tone(t, { type: 'square', f0: 220, f1: 80, dur: 0.05, vol: 0.3, dist: true }); break;
      case 'slash':
        this._noise(t, { dur: 0.18, type: 'bandpass', freq: 6000, sweep: 1200, q: 2, vol: 0.6 }); break;
      case 'punch':
        this._tone(t, { f0: 140, f1: 50, dur: 0.12, vol: 0.9 }); this._noise(t, { dur: 0.05, freq: 900, vol: 0.5 }); break;
      case 'throw':
        this._noise(t, { dur: 0.25, type: 'bandpass', freq: 600, sweep: 3000, q: 3, vol: 0.5 }); break;
      case 'empty':
        this._tone(t, { type: 'square', f0: 2400, f1: 2000, dur: 0.03, vol: 0.2 }); break;
      case 'hit':
        this._tone(t, { type: 'triangle', f0: 600, f1: 200, dur: 0.1, vol: 0.4 }); this._noise(t, { dur: 0.08, freq: 400, vol: 0.5 }); break;
      case 'headshot':
        this._tone(t, { type: 'square', f0: 1400, f1: 700, dur: 0.18, vol: 0.25 });
        this._tone(t + 0.02, { type: 'sine', f0: 2100, f1: 2000, dur: 0.35, vol: 0.2 });
        this._noise(t, { dur: 0.15, freq: 500, vol: 0.7 }); break;
      case 'enemyShot':
        this._tone(t, { type: 'sawtooth', f0: 900, f1: 200, dur: 0.14, vol: 0.18 }); break;
      case 'whiz':
        this._noise(t, { dur: 0.22, type: 'bandpass', freq: 3500, sweep: 800, q: 6, vol: 0.5 }); break;
      case 'heart':
        this._tone(t, { f0: 70, f1: 40, dur: 0.18, vol: 0.9 }); this._tone(t + 0.16, { f0: 60, f1: 35, dur: 0.16, vol: 0.6 }); break;
      case 'tapeStop':
        this._tone(t, { type: 'sawtooth', f0: 600, f1: 30, dur: 0.55, vol: 0.25, dist: true }); this._tone(t, { f0: 300, f1: 30, dur: 0.6, vol: 0.6 });
        this._noise(t, { dur: 0.5, type: 'lowpass', freq: 3000, sweep: 100, vol: 0.4 }); break;
      case 'tapeStart':
        this._tone(t, { type: 'sawtooth', f0: 40, f1: 500, dur: 0.3, vol: 0.2, dist: true }); this._tone(t, { f0: 50, f1: 400, dur: 0.3, vol: 0.4 }); break;
      case 'slowIn':
        this._tone(t, { f0: 400, f1: 40, dur: 0.7, vol: 0.7 }); this._noise(t, { dur: 0.6, type: 'lowpass', freq: 2000, sweep: 100, vol: 0.6 }); break;
      case 'slowOut':
        this._tone(t, { f0: 50, f1: 500, dur: 0.35, vol: 0.5 }); break;
      case 'glass':
        for (let i = 0; i < 5; i++) this._tone(t + i * 0.025, { type: 'sine', f0: 2500 + Math.random() * 2500, f1: 1500, dur: 0.2, vol: 0.12 });
        this._noise(t, { dur: 0.3, type: 'highpass', freq: 4000, vol: 0.5 }); break;
      case 'mark':
        this._tone(t, { type: 'square', f0: 1200 + (opt.n || 0) * 200, f1: 1200 + (opt.n || 0) * 200, dur: 0.06, vol: 0.15 }); break;
      case 'ricochet':
        this._tone(t, { type: 'sine', f0: 3000, f1: 900, dur: 0.3, vol: 0.25 }); break;
      case 'hurt':
        this._tone(t, { type: 'sawtooth', f0: 300, f1: 60, dur: 0.4, vol: 0.6, dist: true }); this._noise(t, { dur: 0.3, freq: 300, vol: 0.6 }); break;
      case 'boom':
        this._tone(t, { f0: 90, f1: 25, dur: 0.8, vol: 1 }); this._noise(t, { dur: 0.7, type: 'lowpass', freq: 1500, sweep: 80, vol: 1 }); break;
      case 'jump':
        this._noise(t, { dur: 0.15, type: 'bandpass', freq: 500, sweep: 1500, q: 2, vol: 0.25 }); break;
      case 'pickup':
        this._tone(t, { type: 'square', f0: 500, f1: 1000, dur: 0.1, vol: 0.2 }); break;
      case 'warn':
        this._tone(t, { type: 'square', f0: 880, f1: 880, dur: 0.08, vol: 0.12 }); break;
    }
  }
}
