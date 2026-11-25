// Procedural heavy-metal loops + SFX, all Web Audio. No samples, no licensing.
// Music is pre-rendered into AudioBuffers so slow-mo can bend tempo AND pitch via playbackRate.

export const BPM = 150;
export const BEAT = 60 / BPM;
const BARS = 8;
export const LOOP_LEN = BARS * 4 * BEAT; // 12.8s

// riff per biome — 16 steps per bar. 'mN' = palm-muted chug N semitones above root,
// 'oN' = open ringing power chord, '-' = sustain/rest. lead = tremolo melody (semitones above root+24)
const BIOME_SONGS = [
  { root: 82.41, // E — city: gallop
    riff: ['m0','-','m0','m0','m0','-','m0','m0','o3','-','m0','m0','o5','-','o6','o5'],
    riff2: ['m0','m0','m0','m0','o7','-','m0','m0','o6','-','m0','m0','o5','-','o3','-'],
    lead: [12,12,15,15,17,17,19,19,22,22,19,19,17,17,15,15, 12,12,15,15,17,17,22,22,24,24,22,22,19,19,17,17] },
  { root: 73.42, // D — machine: phrygian chug
    riff: ['m0','m0','m1','m0','m0','m0','o1','-','m0','m0','m0','m1','o3','-','o1','-'],
    riff2: ['m0','-','m0','-','o1','-','m0','m0','m0','-','m0','-','o6','-','o5','-'],
    lead: [12,13,12,13,15,13,12,10,12,13,15,17,15,13,12,13, 12,13,16,13,12,13,16,17,19,17,16,13,12,13,12,10] },
  { root: 92.50, // F# — alien: syncopated
    riff: ['m0','-','-','m0','-','-','o7','-','m0','-','-','m0','-','-','o5','o3'],
    riff2: ['m0','m0','-','m0','m0','-','o10','-','m0','m0','-','m0','o8','-','o7','-'],
    lead: [19,19,22,22,24,24,22,22,19,19,17,17,15,15,17,17, 19,19,22,22,26,26,24,24,22,22,19,19,17,17,19,19] },
  { root: 77.78, // Eb — orbital: thrash
    riff: ['m0','m0','m0','m0','m0','m0','m0','m0','o5','-','o6','-','m0','m0','o3','-'],
    riff2: ['m0','m0','m0','m0','o1','-','m0','m0','m0','m0','o6','-','o5','-','o3','-'],
    lead: [24,22,19,17,24,22,19,17,22,19,17,15,22,19,17,15, 24,22,19,17,24,22,19,17,27,24,22,19,17,15,12,15] },
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
  const master = ctx.createGain(); master.gain.value = 0.42;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.1; comp.knee.value = 4;
  const post = ctx.createGain(); post.gain.value = 0.55;
  master.connect(comp).connect(post).connect(ctx.destination);
  const hiGain = distCurve(900), midGain = distCurve(60);

  // ---- high-gain guitar amp + cab sim, quad-tracked (2 left, 2 right)
  const mkAmp = (pan, gain) => {
    const pre = ctx.createGain(); pre.gain.value = 3.2;
    const hp0 = ctx.createBiquadFilter(); hp0.type = 'highpass'; hp0.frequency.value = 120; // tighten before drive
    const ws1 = ctx.createWaveShaper(); ws1.curve = hiGain; ws1.oversample = '2x';
    const mid = ctx.createGain(); mid.gain.value = 0.6;
    const ws2 = ctx.createWaveShaper(); ws2.curve = midGain;
    const thump = ctx.createBiquadFilter(); thump.type = 'peaking'; thump.frequency.value = 110; thump.gain.value = 5; thump.Q.value = 0.9;
    const scoop = ctx.createBiquadFilter(); scoop.type = 'peaking'; scoop.frequency.value = 480; scoop.gain.value = -7; scoop.Q.value = 0.8;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 2700; pres.gain.value = 5; pres.Q.value = 1.2;
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 5200; cab.Q.value = 0.7;
    const cab2 = ctx.createBiquadFilter(); cab2.type = 'lowpass'; cab2.frequency.value = 7500;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 75;
    const out = ctx.createGain(); out.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    pre.connect(hp0).connect(ws1).connect(mid).connect(ws2).connect(hp).connect(thump).connect(scoop).connect(pres).connect(cab).connect(cab2).connect(out).connect(p).connect(master);
    return pre;
  };
  const amps = [[mkAmp(-0.8, 0.09), -8], [mkAmp(0.8, 0.09), 7]];

  const s16 = BEAT / 4;
  const guitar = (t, semis, len, open) => {
    const f = song.root * Math.pow(2, semis / 12);
    for (const [amp, det] of amps) {
      // per-note palm-mute filter before the amp: mutes = dark & short, opens = bright & ringing
      const pm = ctx.createBiquadFilter(); pm.type = 'lowpass'; pm.Q.value = 2;
      if (open) { pm.frequency.setValueAtTime(5000, t); pm.frequency.exponentialRampToValueAtTime(2200, t + len); }
      else { pm.frequency.setValueAtTime(2600, t); pm.frequency.exponentialRampToValueAtTime(380, t + 0.07); }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.003);
      g.gain.setValueAtTime(0.9, t + len - 0.02); g.gain.linearRampToValueAtTime(0, t + len);
      pm.connect(g).connect(amp);
      for (const mult of [1, 1.4983, 2]) { // root, fifth, octave
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f * mult; o.detune.value = det + (Math.random() - 0.5) * 4;
        o.connect(pm); o.start(t); o.stop(t + len + 0.01);
      }
    }
    // distorted bass, an octave down
    const b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = f / 2;
    const bw = ctx.createWaveShaper(); bw.curve = midGain;
    const bl = ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = open ? 900 : 520;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0, t); bg.gain.linearRampToValueAtTime(0.16, t + 0.004); bg.gain.setValueAtTime(0.16, t + len - 0.02); bg.gain.linearRampToValueAtTime(0, t + len);
    b.connect(bw).connect(bl).connect(bg).connect(master); b.start(t); b.stop(t + len + 0.01);
  };
  const lead = (t, semis, len) => {
    const f = song.root * 4 * Math.pow(2, semis / 12);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = f * 0.008;
    vib.connect(vg).connect(o.frequency);
    const pre = ctx.createGain(); pre.gain.value = 2;
    const ws = ctx.createWaveShaper(); ws.curve = hiGain;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1500; pk.gain.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.02, t + len);
    const p = ctx.createStereoPanner(); p.pan.value = 0.15;
    o.connect(pre).connect(ws).connect(pk).connect(lp).connect(g).connect(p).connect(master);
    o.start(t); vib.start(t); o.stop(t + len + 0.01); vib.stop(t + len + 0.01);
  };
  const kick = (t, v = 1) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.06);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.3 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.22);
    // beater click — the metal "tick"
    const n = ctx.createBufferSource(); n.buffer = noise;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3800; nf.Q.value = 1.5;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.7 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    n.connect(nf).connect(ng).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.02);
  };
  const snare = (t, v = 1) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.2);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.05);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.7 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.12);
  };
  const cymbal = (t, dur, vol, freq = 6000) => {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 9000; pk.gain.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(pk).connect(g).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  };
  const tom = (t, f0) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.27);
  };

  const parse = (tok) => tok === '-' ? null : { open: tok[0] === 'o', semis: parseInt(tok.slice(1), 10) };
  for (let bar = 0; bar < BARS; bar++) {
    const bt = bar * 4 * BEAT;
    const breakdown = bar === 7;
    const blast = bar >= 4 && bar < 7;          // double-kick section with lead
    const riff = bar % 2 ? song.riff2 : song.riff;
    if (bar === 0 || bar === 4) cymbal(bt, 1.6, 0.35, 4500);
    for (let s = 0; s < 16; s++) {
      const t = bt + s * s16;
      // ---- drums
      if (breakdown) {
        if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11) kick(t);
        if (s === 4 || s === 12) { snare(t); cymbal(t, 0.4, 0.25, 3500); } // china-ish
        if (s >= 12) tom(t, 180 - (s - 12) * 25);
      } else if (blast) {
        kick(t, s % 2 ? 0.75 : 1);
        if (s === 4 || s === 12) snare(t);
        if (s % 2 === 0) cymbal(t, 0.12, 0.08, 8000);
      } else {
        if (s % 4 === 0 || s === 2 || s === 7 || s === 10 || s === 14) kick(t, s % 4 === 0 ? 1 : 0.8);
        if (s === 4 || s === 12) snare(t);
        if (s % 2 === 0) cymbal(t, s % 4 === 0 ? 0.25 : 0.06, s % 4 === 0 ? 0.12 : 0.07, s % 4 === 0 ? 5000 : 8500);
      }
      // ---- guitars
      if (breakdown) {
        const bd = { 0: 0, 6: 1, 8: 0, 12: -1 };
        if (s in bd) guitar(t, bd[s], (s === 12 ? 4 : s === 0 ? 6 : 2) * s16, true);
        if (s === 3 || s === 11) guitar(t, 0, s16, false);
      } else {
        const n = parse(riff[s]);
        if (n) {
          let len = s16;
          if (n.open) { let k = s + 1; while (k < 16 && riff[k] === '-') k++; len = (k - s) * s16; }
          guitar(t, n.semis, len * 0.97, n.open);
        }
        if (blast) lead(t, song.lead[((bar - 4) % 2) * 16 + s], s16 * 0.95);
      }
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
