// Procedural heavy-metal loops + SFX, all Web Audio. No samples, no licensing.
// Music is pre-rendered into AudioBuffers so slow-mo can bend tempo AND pitch via playbackRate.

export const BPM = 150;
export const BEAT = 60 / BPM;
const BARS = 16;
export const LOOP_LEN = BARS * 4 * BEAT; // 25.6s: verse, chorus, verse 2, big chorus

// Darksynth / synth-pop: four-on-the-floor, gated-reverb snare, rolling octave bass,
// pumping supersaw chords, 16th arps and a soaring lead hook with echo.
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
  const sr = 32000; // plenty for a game mix, ~30% cheaper to render
  const ctx = new OfflineAudioContext(2, Math.ceil(LOOP_LEN * sr), sr);
  const noise = noiseBuffer(ctx, 1);
  const master = ctx.createGain(); master.gain.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.12;
  const post = ctx.createGain(); post.gain.value = 0.62;
  master.connect(comp).connect(post).connect(ctx.destination);
  // big 80s reverb
  const ir = ctx.createBuffer(2, sr * 2.2, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
  const verb = ctx.createConvolver(); verb.buffer = ir;
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.3; verbIn.connect(verb).connect(master);
  // dotted-8th echo for the lead
  const dly = ctx.createDelay(1); dly.delayTime.value = BEAT * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3000;
  const dIn = ctx.createGain(); dIn.gain.value = 0.35;
  dIn.connect(dly).connect(dlp).connect(fb).connect(dly); dlp.connect(master);
  const grit = distCurve(6);

  const s16 = BEAT / 4, bar = 4 * BEAT, total = BARS * bar;
  const hz = (semis, oct = 0) => song.root * Math.pow(2, semis / 12 + oct);
  const chordAt = (b) => song.chords[Math.floor(b / 2) % song.chords.length];
  const tones = ([r, q]) => [r, r + (q === 'm' ? 3 : 4), r + 7, r + 12, r + (q === 'm' ? 15 : 16), r + 19];

  // sidechain-style pump bus for chords & arps (ducks on every kick)
  const pump = ctx.createGain(); pump.connect(master); pump.connect(verbIn);
  for (let i = 0; i < BARS * 4; i++) { const t = i * BEAT; pump.gain.setValueAtTime(0.25, t); pump.gain.linearRampToValueAtTime(1, t + BEAT * 0.55); }

  const kick = (t, v = 1) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.07);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.95 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.28);
    const n = ctx.createBufferSource(); n.buffer = noise; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3500;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.35 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    n.connect(nf).connect(ng).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.02);
  };
  // gated-reverb snare (the 80s smack)
  const snare = (t, v = 1) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.setValueAtTime(0.6 * v, t + 0.16); g.gain.linearRampToValueAtTime(0, t + 0.2);
    n.connect(f).connect(g); g.connect(master); g.connect(verbIn); n.start(t, Math.random() * 0.5); n.stop(t + 0.22);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.06);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.6 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.14);
  };
  const hat = (t, v = 1, open = false) => {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8500;
    const g = ctx.createGain(); g.gain.setValueAtTime((open ? 0.13 : 0.08) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.18 : 0.03));
    n.connect(f).connect(g).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.2);
  };
  const tom = (t, f0) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.75, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(master); g.connect(verbIn); o.start(t); o.stop(t + 0.32);
  };
  const crash = (t) => {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    n.connect(f).connect(g); g.connect(master); g.connect(verbIn); n.start(t); n.stop(t + 1.9);
  };
  // rolling octave bass on 16ths (root, root, octave, root...)
  const bass = (t, semis, len, accent) => {
    const f = hz(semis, 1);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(accent ? 1800 : 1100, t); lp.frequency.exponentialRampToValueAtTime(260, t + len);
    const ws = ctx.createWaveShaper(); ws.curve = grit;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.004); g.gain.exponentialRampToValueAtTime(0.02, t + len);
    lp.connect(ws).connect(g).connect(master);
    { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + len + 0.01); }
    const sub = ctx.createOscillator(); sub.frequency.value = f / 2; const sg = ctx.createGain(); sg.gain.setValueAtTime(0.25, t); sg.gain.exponentialRampToValueAtTime(0.01, t + len);
    sub.connect(sg).connect(master); sub.start(t); sub.stop(t + len + 0.01);
  };
  // supersaw chord stab/pad through the pump
  const chords = (t, chord, len, bright) => {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright ? 4200 : 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(bright ? 0.075 : 0.06, t + 0.03); g.gain.setValueAtTime(bright ? 0.075 : 0.06, t + len - 0.05); g.gain.linearRampToValueAtTime(0, t + len);
    lp.connect(g).connect(pump);
    for (const st of tones(chord).slice(0, 4)) for (const det of [-12, 12]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(st, 3); o.detune.value = det;
      const p = ctx.createStereoPanner(); p.pan.value = det / 18; o.connect(p).connect(lp); o.start(t); o.stop(t + len + 0.02);
    }
  };
  // 16th arpeggio pluck
  const arp = (t, semis) => {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(semis, 4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(lp).connect(g).connect(pump); o.start(t); o.stop(t + 0.15);
  };
  // soaring lead hook
  const lead = (t, semis, len, prev) => {
    const f = hz(semis, 4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.08, t + len * 0.85); g.gain.linearRampToValueAtTime(0, t + len);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    lp.connect(g); g.connect(master); g.connect(dIn); g.connect(verbIn);
    for (const [type, det] of [['sawtooth', -8], ['sawtooth', 8], ['square', 0]]) {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = det;
      if (prev != null) { o.frequency.setValueAtTime(hz(prev, 4), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); } else o.frequency.value = f;
      const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.01, t + 0.25);
      vib.connect(vg).connect(o.frequency);
      o.connect(lp); o.start(t); vib.start(t); o.stop(t + len + 0.02); vib.stop(t + len + 0.02);
    }
  };

  // 16-bar song: verse (0-3) -> chorus (4-7) -> verse 2 (8-11, variations) -> big chorus (12-15, lead up an octave)
  let prevLead = null;
  for (let b = 0; b < BARS; b++) {
    const bt = b * bar, chord = chordAt(b), ct = tones(chord);
    const sec = b < 4 ? 'verse' : b < 8 ? 'chorus' : b < 12 ? 'verse2' : 'chorus2';
    const chorus = sec === 'chorus' || sec === 'chorus2', big = sec === 'chorus2';
    if (b === 0 || b === 4 || b === 8 || b === 12) crash(bt);
    // verse 2 opens with a half-time breath: kicks on 1 & 3 only for its first bar
    const halfTime = b === 8;
    for (let beat = 0; beat < 4; beat++) if (!halfTime || beat % 2 === 0) kick(bt + beat * BEAT);
    snare(bt + BEAT); snare(bt + 3 * BEAT, b % 4 === 3 ? 1.2 : 1);
    if (big && b % 2 === 1) snare(bt + 3.5 * BEAT, 0.6); // extra ghost hit in the big chorus
    for (let st = 0; st < 16; st++) if (st % 2 === 1 || chorus || (sec === 'verse2' && b >= 10)) hat(bt + st * s16, st % 2 ? 1 : 0.55, st % 4 === 2 && chorus);
    if (b % 4 === 3) { tom(bt + 12 * s16, 220); tom(bt + 13 * s16, 180); tom(bt + 14 * s16, 140); tom(bt + 15 * s16, 110); }
    if (b === 11) for (let k = 0; k < 8; k++) snare(bt + 2 * BEAT + k * s16, 0.45 + k * 0.07); // roll into the big chorus
    // octave bass: verse 2 switches to a bouncier off-beat pattern
    const pat = sec === 'verse2' ? [0, -1, 12, 0, -1, 12, 0, -1, 0, -1, 12, 0, -1, 12, 7, -1] : [0, 0, 12, 0, 0, 12, 0, 12, 0, 0, 12, 0, 0, 12, 7, 12];
    for (let st = 0; st < 16; st++) if (pat[st] >= 0) bass(bt + st * s16, chord[0] + pat[st], s16 * 0.95, st % 4 === 2);
    chords(bt, chord, bar, chorus);
    // arps: verse 2 rests for 2 bars then comes back with a new shape
    const ap = sec === 'verse2' ? [4, 3, 2, 0, 1, 2, 3, 2] : [0, 2, 3, 4, 3, 2, 1, 2];
    if (!(sec === 'verse2' && b < 10)) for (let st = 0; st < 16; st++) arp(bt + st * s16, ct[ap[st % 8]] + (big && st % 4 === 0 ? 12 : 0));
    if (chorus) {
      const h = song.hook, i0 = ((b % 4) * 2) % h.length, up = big ? 12 : 0;
      lead(bt, h[i0] + up, BEAT * 1.9, prevLead); lead(bt + 2 * BEAT, h[i0 + 1] + up, BEAT * 1.9, h[i0] + up);
      prevLead = h[i0 + 1] + up;
    }
  }
  return ctx.startRendering();
}

// ---------------------------------------------------------------- GRID MODE: filtered French-house
// four-on-the-floor, off-beat open hats, filtered disco chord stabs with a pumping filter,
// slap-octave funk bass, a robot "talkbox" hook, arps; 16 bars: filtered intro -> groove ->
// breakdown -> full drop.
const GRID_SONGS = [
  { root: 55.0,  chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-7, 'm']], hook: [12, 12, 10, 7, 10, 12, 15, 12] }, // A minor
  { root: 49.0,  chords: [[0, 'm'], [3, 'M'], [-2, 'M'], [5, 'm']],  hook: [7, 10, 12, 10, 7, 5, 7, 3] },     // G minor
  { root: 58.27, chords: [[0, 'm'], [-4, 'M'], [-5, 'M'], [-2, 'M']], hook: [15, 12, 10, 12, 15, 17, 15, 12] }, // Bb minor
  { root: 46.25, chords: [[0, 'm'], [5, 'm'], [-4, 'M'], [-5, 'M']], hook: [10, 12, 15, 12, 10, 7, 10, 12] },  // F# minor
];

export async function renderGridSong(song, variant) {
  const sr = 32000;
  const ctx = new OfflineAudioContext(2, Math.ceil(LOOP_LEN * sr), sr);
  const noise = noiseBuffer(ctx, 1);
  const master = ctx.createGain(); master.gain.value = 0.5;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.12;
  const post = ctx.createGain(); post.gain.value = 0.62;
  master.connect(comp).connect(post).connect(ctx.destination);
  const ir = ctx.createBuffer(2, sr * 1.8, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
  const verb = ctx.createConvolver(); verb.buffer = ir;
  const verbIn = ctx.createGain(); verbIn.gain.value = 0.22; verbIn.connect(verb).connect(master);

  const s16 = BEAT / 4, bar = 4 * BEAT;
  const hz = (semis, oct = 0) => song.root * Math.pow(2, semis / 12 + oct);
  const chordAt = (b) => song.chords[Math.floor(b / 2) % song.chords.length];
  const tones = ([r, q]) => [r, r + (q === 'm' ? 3 : 4), r + 7, r + 10, r + 12, r + 14]; // 7ths & 9ths: disco colour

  // the "French filter": music bus lowpass that opens over the intro, dips in the breakdown, pumps per beat
  const musicIn = ctx.createGain(), mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.Q.value = 3;
  const pumpG = ctx.createGain(); musicIn.connect(mlp).connect(pumpG); pumpG.connect(master); pumpG.connect(verbIn);
  mlp.frequency.setValueAtTime(350, 0); mlp.frequency.exponentialRampToValueAtTime(9000, 4 * bar);
  mlp.frequency.setValueAtTime(9000, 8 * bar); mlp.frequency.exponentialRampToValueAtTime(600, 9 * bar); mlp.frequency.exponentialRampToValueAtTime(12000, 12 * bar);
  for (let i = 0; i < BARS * 4; i++) { const t = i * BEAT; pumpG.gain.setValueAtTime(0.3, t); pumpG.gain.linearRampToValueAtTime(1, t + BEAT * 0.7); }
  const bassBus = ctx.createGain(); bassBus.connect(master);
  for (let i = 0; i < BARS * 4; i++) { const t = i * BEAT; bassBus.gain.setValueAtTime(0.45, t); bassBus.gain.linearRampToValueAtTime(1, t + BEAT * 0.5); }

  const kick = (t) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.06);
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(3);
    const g = ctx.createGain(); g.gain.setValueAtTime(1.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(ws).connect(g).connect(master); o.start(t); o.stop(t + 0.32);
  };
  const clap = (t, v = 1) => {
    for (let k = 0; k < 3; k++) {
      const n = ctx.createBufferSource(); n.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1;
      const g = ctx.createGain(); const tt = t + k * 0.012; g.gain.setValueAtTime(0.7 * v, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + (k === 2 ? 0.2 : 0.03));
      n.connect(f).connect(g); g.connect(master); if (k === 2) g.connect(verbIn); n.start(tt, Math.random() * 0.5); n.stop(tt + 0.22);
    }
  };
  const hat = (t, open, v = 1) => {
    const n = ctx.createBufferSource(); n.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = open ? 7000 : 9000;
    const g = ctx.createGain(); g.gain.setValueAtTime((open ? 0.2 : 0.09) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.2 : 0.03));
    const p = ctx.createStereoPanner(); p.pan.value = open ? -0.2 : 0.3;
    n.connect(f).connect(g).connect(p).connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.22);
  };
  // funky slap-octave bass (square + saw through a plucky filter)
  const bass = (t, semis, len) => {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.42, t + 0.004); g.gain.exponentialRampToValueAtTime(0.03, t + len);
    lp.connect(g).connect(bassBus);
    for (const [ty, det] of [['square', 0], ['sawtooth', 7]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = hz(semis, 1); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + len + 0.01); }
    const sub = ctx.createOscillator(); sub.frequency.value = hz(semis, 0); const sg = ctx.createGain(); sg.gain.setValueAtTime(0.35, t); sg.gain.exponentialRampToValueAtTime(0.01, t + len); sub.connect(sg).connect(bassBus); sub.start(t); sub.stop(t + len + 0.01);
  };
  // disco chord stab (sampled-disco feel: detuned saws + squares)
  const stab = (t, chord, len) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.008); g.gain.setValueAtTime(0.055, t + len * 0.7); g.gain.linearRampToValueAtTime(0, t + len);
    g.connect(musicIn);
    for (const st of tones(chord).slice(0, 5)) for (const [ty, det] of [['sawtooth', -9], ['sawtooth', 9], ['square', 0]]) {
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = hz(st, 3); o.detune.value = det;
      const p = ctx.createStereoPanner(); p.pan.value = det / 12; o.connect(p).connect(g); o.start(t); o.stop(t + len + 0.02);
    }
  };
  const arp = (t, semis) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(semis, 4);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(lp).connect(g).connect(musicIn); o.start(t); o.stop(t + 0.13);
  };
  // robot "talkbox": square through a formant filter that sweeps "ow-ah" per note
  const talk = (t, semis, len, prev) => {
    const f = hz(semis, 3);
    const o = ctx.createOscillator(); o.type = 'square';
    if (prev != null) { o.frequency.setValueAtTime(hz(prev, 3), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); } else o.frequency.value = f;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 9; f1.frequency.setValueAtTime(400, t); f1.frequency.exponentialRampToValueAtTime(900, t + len * 0.5);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 11; f2.frequency.setValueAtTime(900, t); f2.frequency.exponentialRampToValueAtTime(1500, t + len * 0.5);
    const mix = ctx.createGain(); mix.gain.value = 2.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.02); g.gain.setValueAtTime(0.3, t + len * 0.8); g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(f1).connect(mix); o.connect(f2).connect(mix); mix.connect(g); g.connect(master); g.connect(verbIn);
    o.start(t); o.stop(t + len + 0.02);
  };

  let prevTalk = null;
  for (let b = 0; b < BARS; b++) {
    const bt = b * bar, chord = chordAt(b), ct = tones(chord);
    const intro = b < 4, groove = b >= 4 && b < 8, breakdown = b === 8 || b === 9, drop = b >= 10;
    if (!breakdown) for (let k = 0; k < 4; k++) kick(bt + k * BEAT);
    if (!intro || b >= 2) { clap(bt + BEAT); clap(bt + 3 * BEAT); }
    for (let k = 0; k < 4; k++) { hat(bt + k * BEAT + BEAT / 2, true, breakdown ? 0.5 : 1); if (!intro) { hat(bt + k * BEAT + BEAT / 4, false); hat(bt + k * BEAT + BEAT * 0.75, false); } }
    if (b === 9) for (let k = 0; k < 8; k++) clap(bt + 2 * BEAT + k * s16, 0.4 + k * 0.08); // clap roll into the drop
    // syncopated disco stabs
    for (const st of [0, 3, 6, 10, 12, 14]) stab(bt + st * s16, chord, s16 * (st === 6 || st === 14 ? 2 : 1.6));
    // slap octave bass
    if (!breakdown) {
      const pat = [[0, 0], [2, 12], [3, 0], [6, 12], [8, 0], [10, 12], [11, 7], [14, 12]];
      for (const [st, o] of pat) bass(bt + st * s16, chord[0] + o, s16 * 1.6);
    }
    if (groove || drop) { const ap = [0, 2, 4, 2, 1, 3, 4, 3]; for (let st = 0; st < 16; st++) arp(bt + st * s16, ct[ap[st % 8]]); }
    // talkbox hook: answers every bar in the groove, sings over the drop
    if (groove || drop || breakdown) {
      const h = song.hook, i0 = (b * 2) % h.length;
      const rhythm = drop ? [[0, 3], [3, 3], [6, 2], [8, 6], [14, 2]] : [[0, 3], [6, 2], [8, 4]];
      rhythm.forEach(([pos, len], k) => { const n = h[(i0 + k) % h.length]; talk(bt + pos * s16, n, len * s16 * 0.95, prevTalk); prevTalk = n; });
    }
  }
  const out = await ctx.startRendering();
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) { const d = out.getChannelData(ch); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  const k = peak > 0 ? 0.85 / peak : 1;
  for (let ch = 0; ch < 2; ch++) { const d = out.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; }
  return out;
}

export { BIOME_SONGS, GRID_SONGS };
// style-aware prerender: songs for a style render once, in order, starting as soon as asked
const cache = {};
export function prerender(mode) {
  if (cache[mode]) return cache[mode];
  const list = mode === 'grid' ? GRID_SONGS : BIOME_SONGS, render = mode === 'grid' ? renderGridSong : renderSong;
  let chain = Promise.resolve();
  cache[mode] = list.map((song, i) => (chain = chain.then(() => render(song, i))));
  return cache[mode];
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

  }
  async loadStyle(mode) {
    this.mode = mode;
    const ps = prerender(mode);
    const first = await ps[0];
    if (this.mode !== mode) return;
    this.buffers = [first];
    ps.forEach((p, i) => p.then((b) => { if (this.mode === mode) this.buffers[i] = b; }));
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
      case 'clang':
        [1800, 2690, 3970].forEach((f, i) => this._tone(t, { type: 'triangle', f0: f, f1: f * 0.98, dur: 0.5 - i * 0.1, vol: 0.18 })); this._noise(t, { dur: 0.06, freq: 6000, vol: 0.5 }); break;
      case 'shuriken':
        this._noise(t, { dur: 0.16, type: 'bandpass', freq: 5000, sweep: 9000, q: 4, vol: 0.4 }); this._tone(t, { type: 'triangle', f0: 3200, f1: 2600, dur: 0.06, vol: 0.12 }); break;
      case 'bonk':
        this._tone(t, { type: 'triangle', f0: 420, f1: 180, dur: 0.12, vol: 0.7 }); this._noise(t, { dur: 0.08, type: 'bandpass', freq: 1400, q: 2, vol: 0.8 }); break;
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
