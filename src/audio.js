// Procedural heavy-metal loops + SFX, all Web Audio. No samples, no licensing.
// Music is pre-rendered into AudioBuffers so slow-mo can bend tempo AND pitch via playbackRate.

export const BPM = 150;
export const BEAT = 60 / BPM;
const BARS = 8;
export const LOOP_LEN = BARS * 4 * BEAT; // 12.8s

// riff per biome: semitone offsets per 16th step (null = rest/mute), root note Hz
const BIOME_SONGS = [
  { root: 82.41, riff: [0,0,null,0, 0,null,0,0, 3,null,0,0, 5,null,6,5] },       // E — city
  { root: 73.42, riff: [0,null,0,0, 0,0,null,1, 0,null,0,0, 1,null,3,1] },       // D — machine (phrygian)
  { root: 92.50, riff: [0,0,0,null, 7,null,5,null, 0,0,0,null, 3,null,2,null] }, // F# — alien
  { root: 77.78, riff: [0,null,0,null, 0,0,0,0, 6,null,5,null, 3,null,0,0] },    // Eb — orbital
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

async function renderSong(song, variant) {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(LOOP_LEN * sr), sr);
  const noise = noiseBuffer(ctx, 1);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
  master.connect(comp).connect(ctx.destination);

  // guitar bus: two panned tracks through distortion
  const mkGtrBus = (pan) => {
    const pre = ctx.createGain(); pre.gain.value = 0.55;
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(180); ws.oversample = '2x';
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 750; mid.gain.value = -5; mid.Q.value = 1;
    const out = ctx.createGain(); out.gain.value = 0.16;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    pre.connect(ws).connect(hp).connect(mid).connect(lp).connect(out).connect(p).connect(master);
    return pre;
  };
  const gL = mkGtrBus(-0.7), gR = mkGtrBus(0.7);

  const s16 = BEAT / 4;
  const chug = (t, semis, len, open) => {
    const f = song.root * Math.pow(2, semis / 12);
    for (const [bus, det] of [[gL, -6], [gR, 7]]) {
      for (const mult of [1, 1.5, 2]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f * mult; o.detune.value = det;
        const g = ctx.createGain();
        const peak = mult === 1 ? 0.9 : 0.6;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.004);
        g.gain.exponentialRampToValueAtTime(open ? peak * 0.6 : 0.02, t + (open ? len * 0.9 : Math.min(len, 0.11)));
        g.gain.linearRampToValueAtTime(0, t + len);
        o.connect(g).connect(bus); o.start(t); o.stop(t + len + 0.01);
      }
    }
    // bass
    const b = ctx.createOscillator(); b.type = 'square'; b.frequency.value = f / 2;
    const bl = ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 380;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.22, t); bg.gain.exponentialRampToValueAtTime(0.01, t + len);
    b.connect(bl).connect(bg).connect(master); b.start(t); b.stop(t + len + 0.01);
  };
  const kick = (t, v = 1) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.1 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
    const n = ctx.createBufferSource(); n.buffer = noise;
    const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 2500;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.25 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    n.connect(nf).connect(ng).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.03);
  };
  const snare = (t) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.connect(f).connect(g).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.25);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.15);
  };
  const hat = (t, open) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = ctx.createGain(); g.gain.setValueAtTime(open ? 0.16 : 0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.04));
    n.connect(f).connect(g).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.3);
  };

  for (let bar = 0; bar < BARS; bar++) {
    const bt = bar * 4 * BEAT;
    const doubleKick = variant >= 1 ? bar % 2 === 1 : bar >= 4 && bar % 2 === 1;
    const breakdown = bar === 7;
    for (let s = 0; s < 16; s++) {
      const t = bt + s * s16;
      // drums
      if (breakdown) { if (s % 4 === 0) kick(t); if (s === 4 || s === 12) snare(t); }
      else if (doubleKick) kick(t, s % 4 === 0 ? 1 : 0.7);
      else if (s % 4 === 0 || s === 6 || s === 10) kick(t);
      if (!breakdown && (s === 4 || s === 12)) snare(t);
      if (s % 2 === 0) hat(t, s === 14 && bar % 2 === 1);
      // guitars
      if (breakdown) {
        if (s === 0) chug(t, 0, BEAT * 1.5, true);
        if (s === 8) chug(t, 1, BEAT * 1.5, true);
        if (s === 12) chug(t, -1, BEAT * 1.0, true);
      } else {
        const r = song.riff[s];
        const lift = bar % 4 === 3 ? 2 : 0;
        if (r !== null) chug(t, r + (s > 7 ? lift : 0), s16 * 0.95, false);
      }
    }
  }
  return ctx.startRendering();
}

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
    this.buffers[0] = await renderSong(BIOME_SONGS[0], 0);
    // render the rest in the background
    (async () => { for (let i = 1; i < BIOME_SONGS.length; i++) this.buffers[i] = await renderSong(BIOME_SONGS[i], i); })();
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
  update(realDt, timeScale) {
    if (!this.started) return;
    this.rate = timeScale;
    this.src.playbackRate.setTargetAtTime(timeScale, this.ctx.currentTime, 0.015);
    const cut = timeScale < 0.98 ? 500 + 9000 * Math.pow(timeScale, 2.2) : 20000;
    this.lp.frequency.setTargetAtTime(cut, this.ctx.currentTime, 0.05);
    this.songPos += realDt * timeScale;
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
