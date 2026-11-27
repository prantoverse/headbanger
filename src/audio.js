// Procedural soundtrack + SFX, all Web Audio. No sample files, no licensing.
// Producer-style pipeline: every instrument is synthesized once into a high-quality one-shot
// sample, then each song is sequenced from those samples (like a sampler/DAW), with sends,
// sidechain, mastering and loudness normalization. Songs render into AudioBuffers so slow-mo
// can bend tempo AND pitch via playbackRate.

export const BPM = 150;
export const BEAT = 60 / BPM;
const BARS = 16;
export const LOOP_LEN = BARS * 4 * BEAT; // 25.6s: verse, build, drop

// Synthwave track per biome: verse (4 bars) -> build (4 bars: roll, riser, sweep) -> drop (8 bars: lead + chops).
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

const SR = 44100;
async function off(len, fn) {
  const c = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
  fn(c);
  return c.startRendering();
}
function env(g, t, a, peak, hold, rel) { // simple AHR envelope
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0008, t + a + hold + rel);
}
function osc(c, type, f, det = 0) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; return o; }
function filt(c, type, f, q = 0.7) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function reverse(buf) {
  const c = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const a = buf.getChannelData(ch), b = c.getChannelData(ch); for (let i = 0; i < a.length; i++) b[i] = a[a.length - 1 - i]; }
  return c;
}
function irBuffer(len, decay, pre = 0, rate = SR) {
  const b = new AudioBuffer({ length: Math.ceil(len * rate), numberOfChannels: 2, sampleRate: rate });
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); const p = Math.floor(pre * rate); for (let i = p; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - (i - p) / (d.length - p), decay); }
  return b;
}

// ---------------------------------------------------------------- instrument samples (rendered once)
let SAMPLES = null;
async function buildSamples() {
  const S = {};
  const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.65); // 808-style hat partials
  // layered kick: pitched body + saturated sub + beater click
  S.kick = await off(0.6, (c) => {
    const o = osc(c, 'sine', 230); o.frequency.exponentialRampToValueAtTime(55, 0.05); o.frequency.exponentialRampToValueAtTime(44, 0.45);
    const ws = c.createWaveShaper(); ws.curve = distCurve(2.5);
    const g = c.createGain(); env(g, 0, 0.002, 1, 0.06, 0.42);
    o.connect(ws).connect(g).connect(c.destination); o.start(0); o.stop(0.6);
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.05);
    const f = filt(c, 'bandpass', 4200, 1.2), ng = c.createGain(); env(ng, 0, 0.001, 0.55, 0.002, 0.012);
    n.connect(f).connect(ng).connect(c.destination); n.start(0);
  });
  // snare: tone + snappy noise + short baked room
  S.snare = await off(0.7, (c) => {
    const room = c.createConvolver(); room.buffer = irBuffer(0.45, 4); const rg = c.createGain(); rg.gain.value = 0.35;
    room.connect(rg).connect(c.destination);
    const o = osc(c, 'triangle', 240); o.frequency.exponentialRampToValueAtTime(175, 0.05);
    const og = c.createGain(); env(og, 0, 0.001, 0.7, 0.01, 0.12); o.connect(og); og.connect(c.destination); og.connect(room); o.start(0); o.stop(0.3);
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.4);
    const hp = filt(c, 'highpass', 1500), pk = filt(c, 'peaking', 5000, 1); pk.gain.value = 6;
    const ng = c.createGain(); env(ng, 0, 0.001, 0.9, 0.02, 0.18);
    n.connect(hp).connect(pk).connect(ng); ng.connect(c.destination); ng.connect(room); n.start(0);
  });
  S.clap = await off(0.5, (c) => {
    for (let k = 0; k < 4; k++) {
      const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.3);
      const f = filt(c, 'bandpass', 1300, 1.1), g = c.createGain(); const t = k * 0.011;
      env(g, t, 0.001, k === 3 ? 0.8 : 0.6, 0.003, k === 3 ? 0.22 : 0.012);
      n.connect(f).connect(g).connect(c.destination); n.start(t);
    }
  });
  const metal = (c, dur, vol, hpF = 7000) => {
    const bp = filt(c, 'bandpass', 10000, 0.9), hp = filt(c, 'highpass', hpF), g = c.createGain(); env(g, 0, 0.001, vol, 0.002, dur);
    bp.connect(hp).connect(g).connect(c.destination);
    for (const f of METAL) { const o = osc(c, 'square', f); o.connect(bp); o.start(0); o.stop(dur + 0.05); }
  };
  S.hatC = await off(0.12, (c) => metal(c, 0.05, 0.5));
  S.hatO = await off(0.5, (c) => metal(c, 0.38, 0.45));
  S.crash = await off(2.6, (c) => {
    metal(c, 2.3, 0.35, 4500);
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 2.6);
    const hp = filt(c, 'highpass', 5500), g = c.createGain(); env(g, 0, 0.003, 0.5, 0.05, 2.2);
    n.connect(hp).connect(g).connect(c.destination); n.start(0);
  });
  S.revCrash = reverse(S.crash);
  S.tom = await off(0.5, (c) => {
    const o = osc(c, 'sine', 160); o.frequency.exponentialRampToValueAtTime(95, 0.3);
    const g = c.createGain(); env(g, 0, 0.002, 0.9, 0.02, 0.35); o.connect(g).connect(c.destination); o.start(0); o.stop(0.5);
  });
  S.impact = await off(3, (c) => {
    const o = osc(c, 'sine', 90); o.frequency.exponentialRampToValueAtTime(28, 1.4);
    const g = c.createGain(); env(g, 0, 0.003, 1, 0.1, 2.2); o.connect(g).connect(c.destination); o.start(0); o.stop(3);
    const n = c.createBufferSource(); n.buffer = noiseBuffer(c, 3);
    const lp = filt(c, 'lowpass', 2500); lp.frequency.exponentialRampToValueAtTime(120, 2.5);
    const ng = c.createGain(); env(ng, 0, 0.002, 0.7, 0.05, 2.5); n.connect(lp).connect(ng).connect(c.destination); n.start(0);
  });
  // sub: clean sine at A1 (55 Hz)
  S.sub = await off(1.6, (c) => { const o = osc(c, 'sine', 55); const g = c.createGain(); env(g, 0, 0.004, 0.9, 1.2, 0.25); o.connect(g).connect(c.destination); o.start(0); o.stop(1.6); });
  // reese bass at A1: detuned saws through an enveloped resonant filter
  S.bass = await off(0.7, (c) => {
    const lp = filt(c, 'lowpass', 2400, 5); lp.frequency.setValueAtTime(2400, 0); lp.frequency.exponentialRampToValueAtTime(320, 0.22);
    const ws = c.createWaveShaper(); ws.curve = distCurve(4);
    const g = c.createGain(); env(g, 0, 0.003, 0.7, 0.12, 0.35);
    lp.connect(ws).connect(g).connect(c.destination);
    for (const d of [-14, 14]) { const o = osc(c, 'sawtooth', 110, d); o.connect(lp); o.start(0); o.stop(0.7); }
  });
  // pluck at A4
  S.pluck = await off(0.6, (c) => {
    const lp = filt(c, 'lowpass', 7000, 2); lp.frequency.exponentialRampToValueAtTime(900, 0.2);
    const g = c.createGain(); env(g, 0, 0.002, 0.5, 0.01, 0.45);
    lp.connect(g).connect(c.destination);
    for (const [t, d] of [['sawtooth', -7], ['square', 7]]) { const o = osc(c, t, 440, d); o.connect(lp); o.start(0); o.stop(0.6); }
  });
  // 7-voice supersaw pad/chord voice at A3, wide stereo
  S.saw = await off(3.6, (c) => {
    const hp = filt(c, 'highpass', 180), lp = filt(c, 'lowpass', 5200);
    const g = c.createGain(); env(g, 0, 0.02, 0.35, 3.1, 0.4);
    hp.connect(lp).connect(g).connect(c.destination);
    [-28, -17, -8, 0, 8, 17, 28].forEach((d, i) => {
      const o = osc(c, 'sawtooth', 220, d); const p = c.createStereoPanner(); p.pan.value = (i - 3) / 3.4;
      o.connect(p).connect(hp); o.start(Math.random() * 0.004); o.stop(3.6);
    });
  });
  // lead at A4: supersaw + square, delayed vibrato
  S.lead = await off(1.8, (c) => {
    const lp = filt(c, 'lowpass', 6000, 1.2), pk = filt(c, 'peaking', 2500, 1); pk.gain.value = 4;
    const g = c.createGain(); env(g, 0, 0.012, 0.5, 1.3, 0.35);
    lp.connect(pk).connect(g).connect(c.destination);
    const vib = osc(c, 'sine', 5.6), vg = c.createGain(); vg.gain.setValueAtTime(0, 0); vg.gain.linearRampToValueAtTime(5, 0.35);
    vib.connect(vg); vib.start(0); vib.stop(1.8);
    for (const [t, d, v] of [['sawtooth', -10, 1], ['sawtooth', 10, 1], ['sawtooth', 0, 0.7], ['square', -1200, 0.5]]) {
      const o = osc(c, t, 440, d); vg.connect(o.frequency); const og = c.createGain(); og.gain.value = v * 0.35;
      o.connect(og).connect(lp); o.start(0); o.stop(1.8);
    }
  });
  // vocal chop "ah" at A4 (formant synth)
  S.vox = await off(0.5, (c) => {
    const o = osc(c, 'sawtooth', 440); const g = c.createGain(); env(g, 0, 0.01, 0.6, 0.12, 0.2);
    const mix = c.createGain(); mix.connect(g).connect(c.destination);
    for (const [f, q, v] of [[800, 8, 1], [1150, 10, 0.7], [2900, 12, 0.35]]) { const b = filt(c, 'bandpass', f, q); const bg = c.createGain(); bg.gain.value = v * 3; o.connect(b).connect(bg).connect(mix); }
    o.start(0); o.stop(0.5);
  });
  return S;
}

// ---------------------------------------------------------------- song: sequenced from the samples
export async function renderSong(song, variant) {
  if (!SAMPLES) SAMPLES = await buildSamples();
  const S = SAMPLES;
  const SONG_SR = 32000; // plenty for a game mix, ~30% cheaper to render
  const ctx = new OfflineAudioContext(2, Math.ceil(LOOP_LEN * SONG_SR), SONG_SR);
  const s16 = BEAT / 4, bar = 4 * BEAT;

  // ---- master: EQ -> glue comp -> soft saturation -> limiter
  const mix = ctx.createGain(); mix.gain.value = 0.42;
  const low = filt(ctx, 'lowshelf', 70); low.gain.value = 2.5;
  const air = filt(ctx, 'highshelf', 9500); air.gain.value = 3;
  const mud = filt(ctx, 'peaking', 320, 0.9); mud.gain.value = -2.5;
  const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -14; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.18; glue.knee.value = 6;
  const sat = ctx.createWaveShaper(); sat.curve = distCurve(1.2);
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06; lim.knee.value = 0;
  mix.connect(low).connect(mud).connect(air).connect(glue).connect(sat).connect(lim).connect(ctx.destination);

  // ---- buses + sends
  const drums = ctx.createGain(); drums.gain.value = 0.9; drums.connect(mix);
  const bassBus = ctx.createGain(); bassBus.connect(mix);
  const music = ctx.createGain(); const musicLP = filt(ctx, 'lowpass', 20000, 0.8); music.connect(musicLP).connect(mix);
  const leadBus = ctx.createGain(); leadBus.gain.value = 0.85; leadBus.connect(mix);
  const verb = ctx.createConvolver(); verb.buffer = irBuffer(2.8, 3, 0.025, SONG_SR);
  const verbRet = filt(ctx, 'highpass', 300); const verbIn = ctx.createGain(); verbIn.gain.value = 0.32;
  verbIn.connect(verb).connect(verbRet).connect(mix);
  musicLP.connect(verbIn); leadBus.connect(verbIn);
  // ping-pong echo for lead + vox
  const dIn = ctx.createGain(); dIn.gain.value = 0.3;
  const dL = ctx.createDelay(2), dR = ctx.createDelay(2); dL.delayTime.value = BEAT * 0.75; dR.delayTime.value = BEAT * 0.75;
  const fbL = ctx.createGain(), fbR = ctx.createGain(); fbL.gain.value = 0.42; fbR.gain.value = 0.42;
  const dlp = filt(ctx, 'lowpass', 4000), dhp = filt(ctx, 'highpass', 400);
  const pL = ctx.createStereoPanner(), pR = ctx.createStereoPanner(); pL.pan.value = -0.85; pR.pan.value = 0.85;
  dIn.connect(dhp).connect(dlp).connect(dL); dL.connect(pL).connect(mix); dL.connect(fbL).connect(dR); dR.connect(pR).connect(mix); dR.connect(fbR).connect(dL);
  leadBus.connect(dIn);

  // ---- sampler voice
  const play = (buf, t, o = {}) => {
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.gain == null ? 1 : o.gain;
    if (o.dur) { g.gain.setValueAtTime(g.gain.value, t + o.dur); g.gain.linearRampToValueAtTime(0, t + o.dur + (o.rel || 0.06)); }
    let node = src.connect(g);
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; node = node.connect(p); }
    node.connect(o.bus || drums);
    if (o.send) node.connect(o.send);
    src.start(Math.max(0, t)); if (o.dur) src.stop(t + o.dur + (o.rel || 0.06) + 0.02);
  };
  const hz = (semis, oct) => song.root * Math.pow(2, semis / 12 + oct);
  const chordAt = (b) => song.chords[Math.floor(b / 2) % song.chords.length];
  const tones = ([r, q]) => [r, r + (q === 'm' ? 3 : 4), r + 7, r + 12, r + (q === 'm' ? 15 : 16), r + 19];
  const swing = (st) => (st % 2 ? s16 * 0.12 : 0); // a touch of groove on off-16ths
  const vel = () => 0.85 + Math.random() * 0.15;

  // sidechain pump on bass + music on every kick
  const pump = (t, depth) => { for (const g of [bassBus, music]) { g.gain.setValueAtTime(1 - depth, t); g.gain.linearRampToValueAtTime(1, t + BEAT * 0.6); } };

  // lead melody: 2-bar call & response motif built from the song's hook notes
  const RHY = [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2], [16, 3], [19, 3], [22, 2], [24, 6], [30, 2]];
  const PIT = [0, 1, 2, 3, 2, 1, 4, 5, 6, 7, 6];

  for (let b = 0; b < BARS; b++) {
    const bt = b * bar, chord = chordAt(b), ct = tones(chord);
    const verse = b < 4, build = b >= 4 && b < 8, drop = b >= 8;
    // ---------- drums
    const kickOn = !(build && b === 7);
    if (kickOn) for (let k = 0; k < 4; k++) { play(S.kick, bt + k * BEAT, { gain: 1 }); pump(bt + k * BEAT, drop ? 0.7 : 0.5); }
    if (!(build && b >= 6)) { play(S.snare, bt + BEAT, { gain: 0.8 * vel() }); play(S.snare, bt + 3 * BEAT, { gain: 0.85 * vel() }); }
    if (drop) { play(S.clap, bt + BEAT, { gain: 0.55, send: verbIn }); play(S.clap, bt + 3 * BEAT, { gain: 0.6, send: verbIn }); }
    for (let st = 0; st < 16; st++) {
      const t = bt + st * s16 + swing(st);
      if (drop) { if (st % 4 === 2) play(S.hatO, t, { gain: 0.32, pan: 0.2 }); else play(S.hatC, t, { gain: (st % 2 ? 0.28 : 0.4) * vel(), pan: 0.25 }); }
      else if (st % 2 === 0 || build) play(S.hatC, t, { gain: (st % 4 === 0 ? 0.38 : 0.26) * vel(), pan: 0.25 });
    }
    // build: accelerating snare roll + riser + filter sweep + reverse crash into the drop
    if (b === 6) for (let k = 0; k < 8; k++) play(S.snare, bt + k * 2 * s16, { gain: 0.35 + k * 0.05, rate: 1 + k * 0.02 });
    if (b === 7) for (let k = 0; k < 16; k++) play(S.snare, bt + k * s16, { gain: 0.45 + k * 0.035, rate: 1.1 + k * 0.03 });
    if (b === 4) { musicLP.frequency.setValueAtTime(700, bt); musicLP.frequency.exponentialRampToValueAtTime(18000, bt + 4 * bar - 0.05); }
    if (b === 6) { // white-noise riser (2 bars)
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 2 * bar + 0.1);
      const bp = filt(ctx, 'bandpass', 400, 2); bp.frequency.setValueAtTime(400, bt); bp.frequency.exponentialRampToValueAtTime(9000, bt + 2 * bar);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.001, bt); g.gain.exponentialRampToValueAtTime(0.35, bt + 2 * bar - 0.05); g.gain.linearRampToValueAtTime(0, bt + 2 * bar);
      n.connect(bp).connect(g); g.connect(mix); g.connect(verbIn); n.start(bt); n.stop(bt + 2 * bar);
    }
    if (b === 8 || b === 0) { play(S.crash, bt, { gain: 0.55, send: verbIn }); }
    if (b === 8) play(S.impact, bt, { gain: 0.9, bus: mix });
    if (b === 12) play(S.crash, bt, { gain: 0.4 });
    if (b === 7) play(S.revCrash, bt + bar - S.revCrash.duration, { gain: 0.5 });
    if (b === 15) [12, 13, 14, 15].forEach((st, k) => play(S.tom, bt + st * s16, { rate: 1.4 - k * 0.15, gain: 0.7 }));

    // ---------- bass + sub
    if (!(build && b === 7)) {
      const pat = drop ? [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12] : [0, -1, 0, -1, 12, -1, 0, -1, 0, -1, 0, -1, 12, -1, 7, -1];
      for (let st = 0; st < 16; st++) if (pat[st] >= 0) play(S.bass, bt + st * s16, { rate: hz(chord[0] + pat[st], 1) / 55, gain: 0.55 * vel(), bus: bassBus, dur: s16 * 0.9 });
      for (let k = 0; k < 4; k++) play(S.sub, bt + k * BEAT, { rate: hz(chord[0], 0) / 55, gain: 0.55, bus: bassBus, dur: BEAT * 0.85 });
    }

    // ---------- chords: soft pad in verse, pumping supersaw stabs in the drop
    if (b % 2 === 0) for (const st of ct.slice(0, 4)) play(S.saw, bt, { rate: hz(st, 2) / 220, gain: verse ? 0.14 : build ? 0.17 : 0.2, bus: music, dur: 2 * bar - 0.1, rel: 0.3 });
    // arps
    const ap = [0, 2, 3, 4, 3, 2, 1, 2];
    if (!drop || b % 2 === 1) for (let st = 0; st < 16; st++) play(S.pluck, bt + st * s16 + swing(st), { rate: hz(ct[ap[st % 8]], 3) / 440, gain: (verse ? 0.16 : 0.2) * vel(), bus: music, pan: st % 2 ? 0.3 : -0.3 });
    // vocal chops: off-beat "ah"s in the build and answering the lead in the drop
    if (build || drop) for (const st of drop ? [6, 14] : [2, 6, 10, 14]) play(S.vox, bt + st * s16, { rate: hz(ct[(st / 2) % 4 | 0], 3) / 440, gain: 0.28, bus: leadBus, pan: st % 8 ? 0.35 : -0.35 });
    // lead melody in the drop
    if (drop) {
      const phrase = (b - 8) >> 1, half = (b - 8) % 2;
      RHY.forEach(([pos, len], i) => {
        if ((pos >= 16) !== (half === 1)) return;
        let semis = song.hook[PIT[i] % song.hook.length];
        if (phrase % 2 === 1 && i >= 9) semis -= 2; // response: resolve lower
        play(S.lead, bt + (pos % 16) * s16, { rate: hz(semis, 4) / 440, gain: 0.32, bus: leadBus, dur: len * s16 * 0.95, rel: 0.08 });
      });
    }
  }
  const out = await ctx.startRendering();
  // loudness normalize to a consistent peak
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) { const d = out.getChannelData(ch); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; } }
  const k = peak > 0 ? 0.85 / peak : 1;
  for (let ch = 0; ch < 2; ch++) { const d = out.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; }
  return out;
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
  update(realDt, timeScale, focus = false, groove = false) {
    if (!this.started) return;
    const rate = focus ? 0.66 : 1 - (1 - timeScale) * 0.4;
    this.rate += (rate - this.rate) * (1 - Math.exp(-realDt * (focus ? 7 : 10)));
    this.src.playbackRate.setTargetAtTime(this.rate, this.ctx.currentTime, 0.02);
    let cut = focus ? 1500 : this.rate < 0.97 ? 2500 + 15000 * (this.rate - 0.6) : 20000;
    // GROOVE ZONE: auto-wah sweeping on half-beats
    if (groove && !focus) cut = 700 + 5200 * (0.5 + 0.5 * Math.sin((this.songPos / BEAT) * Math.PI));
    this.lp.frequency.setTargetAtTime(Math.max(600, cut), this.ctx.currentTime, groove ? 0.02 : 0.06);
    this.lp.Q.setTargetAtTime(focus ? 6 : groove ? 9 : 1.2, this.ctx.currentTime, 0.1);
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
      case 'squeak':
        this._tone(t, { f0: 900, f1: 1900, dur: 0.12, vol: 0.4 }); this._tone(t + 0.12, { f0: 1900, f1: 500, dur: 0.5, vol: 0.35 }); break;
      case 'coo':
        this._tone(t, { f0: 420, f1: 360, dur: 0.18, vol: 0.4 }); this._tone(t + 0.2, { f0: 400, f1: 300, dur: 0.28, vol: 0.35 }); break;
      case 'flap':
        for (let i = 0; i < 8; i++) this._noise(t + i * 0.04, { dur: 0.05, type: 'bandpass', freq: 900 + Math.random() * 600, q: 1, vol: 0.25 }); break;
      case 'whistle':
        this._tone(t, { f0: 500, f1: 1700, dur: 0.35, vol: 0.3 }); this._tone(t + 0.35, { f0: 1700, f1: 400, dur: 0.4, vol: 0.3 }); break;
      case 'twinkle':
        [2093, 2637, 3136, 4186].forEach((f, i) => this._tone(t + i * 0.05, { f0: f, f1: f, dur: 0.25, vol: 0.12 })); break;
      case 'pop':
        this._tone(t, { f0: 1200, f1: 200, dur: 0.08, vol: 0.5 }); this._noise(t, { dur: 0.05, freq: 2000, vol: 0.5 }); break;
      case 'party':
        this._noise(t, { dur: 0.15, freq: 3000, vol: 0.6 }); this._tone(t, { type: 'square', f0: 300, f1: 900, dur: 0.15, vol: 0.15 }); break;
      case 'scratch':
        for (let i = 0; i < 3; i++) this._noise(t + i * 0.09, { dur: 0.08, type: 'bandpass', freq: i % 2 ? 600 : 2400, sweep: i % 2 ? 2400 : 600, q: 3, vol: 0.5 }); break;
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
