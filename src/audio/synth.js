// Web Audio building blocks: layered / filtered / FM tones, filtered noise, a
// few percussion voices and note helpers. Everything is synthesised, so the
// game ships no audio files.

let noiseBuf = null;
function noiseBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

const pulseCache = new WeakMap();
/** Pulse wave with a given duty cycle. */
export function pulseWave(ctx, duty) {
  let m = pulseCache.get(ctx);
  if (!m) pulseCache.set(ctx, (m = {}));
  if (m[duty]) return m[duty];
  const N = 40;
  const real = new Float32Array(N), imag = new Float32Array(N);
  for (let n = 1; n < N; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return (m[duty] = ctx.createPeriodicWave(real, imag));
}

/** Per-sound pitch multiplier (set by the engine for a little variety between repeats). */
const pitchOf = (ctx) => ctx.__pitch || 1;

/** Connect `node` to `dest`, through a stereo panner if the sound is placed in the stereo field. */
function toDest(ctx, node, dest, o, t0, dur) {
  if (o.pan !== undefined && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(o.pan, t0);
    if (o.panTo !== undefined) p.pan.linearRampToValueAtTime(o.panTo, t0 + dur);
    node.connect(p).connect(dest);
  } else node.connect(dest);
}

/**
 * An oscillator voice with an envelope.
 * o: { type | duty, f0, f1, dur, vol, attack, delay,
 *      layers, detune (cents between layers),
 *      filter: { type, f0, f1, q },     -- sweeping filter
 *      fm: { ratio, index },            -- FM (bells, metal)
 *      vibrato (Hz), pan, panTo }
 */
export function tone(ctx, dest, t, o) {
  const t0 = t + (o.delay || 0);
  const dur = o.dur ?? 0.1;
  const p = pitchOf(ctx);
  const f0 = o.f0 * p, f1 = o.f1 ? o.f1 * p : 0;
  const env = ctx.createGain();
  const v = o.vol ?? 0.2;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(v, t0 + (o.attack ?? 0.005));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let head = env;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type || 'lowpass';
    f.frequency.setValueAtTime(o.filter.f0, t0);
    if (o.filter.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.filter.f1), t0 + dur);
    f.Q.value = o.filter.q ?? 1;
    env.connect(f);
    head = f;
  }
  toDest(ctx, head, dest, o, t0, dur);

  const n = o.layers || 1;
  for (let i = 0; i < n; i++) {
    const osc = ctx.createOscillator();
    if (o.duty) osc.setPeriodicWave(pulseWave(ctx, o.duty));
    else osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (n > 1) osc.detune.value = (i - (n - 1) / 2) * (o.detune ?? 10);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = f0 * 0.02;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    if (o.fm) {
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      mod.frequency.value = f0 * o.fm.ratio;
      mg.gain.setValueAtTime(f0 * o.fm.index, t0);
      mg.gain.exponentialRampToValueAtTime(Math.max(1, f0 * 0.05), t0 + dur);
      mod.connect(mg).connect(osc.frequency);
      mod.start(t0);
      mod.stop(t0 + dur + 0.02);
    }
    osc.connect(env);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }
}

/**
 * Filtered noise.
 * o: { dur, vol, filter, f0, f1, q, attack, delay, filter2, f2, pan, panTo }
 */
export function noise(ctx, dest, t, o) {
  const t0 = t + (o.delay || 0);
  const dur = o.dur ?? 0.1;
  const p = pitchOf(ctx);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'lowpass';
  f.frequency.setValueAtTime((o.f0 ?? 2000) * p, t0);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1 * p, t0 + dur);
  f.Q.value = o.q ?? 0.8;
  let head = f;
  src.connect(f);
  if (o.filter2) {
    const f2 = ctx.createBiquadFilter();
    f2.type = o.filter2;
    f2.frequency.value = o.f2 ?? 4000;
    f.connect(f2);
    head = f2;
  }
  const g = ctx.createGain();
  const v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  head.connect(g);
  toDest(ctx, g, dest, o, t0, dur);
  src.start(t0, Math.random() * 0.8);
  src.stop(t0 + dur + 0.03);
}

// ---- composed voices ---------------------------------------------------------------------

/** A punchy low "thump": a sine that drops in pitch, with a short click on top. */
export function thump(ctx, dest, t, o = {}) {
  tone(ctx, dest, t, { type: 'sine', f0: o.f0 ?? 150, f1: o.f1 ?? 45, dur: o.dur ?? 0.16, vol: o.vol ?? 0.5, attack: 0.002, delay: o.delay, pan: o.pan });
  noise(ctx, dest, t, { dur: 0.012, vol: (o.vol ?? 0.5) * 0.35, filter: 'highpass', f0: 2500, delay: o.delay, pan: o.pan });
}

/** A struck metal / bell sound: inharmonic partials with staggered decays. */
export function ring(ctx, dest, t, f, o = {}) {
  const dur = o.dur ?? 0.4;
  [[1, 1], [2.76, 0.55], [5.4, 0.3], [8.93, 0.14]].forEach(([r, v], i) => {
    tone(ctx, dest, t, { type: 'sine', f0: f * r, dur: dur * (1 - i * 0.18), vol: (o.vol ?? 0.1) * v, attack: 0.002, delay: o.delay, pan: o.pan });
  });
}

/** A rising or falling filtered-noise sweep. */
export function sweep(ctx, dest, t, o = {}) {
  noise(ctx, dest, t, { dur: o.dur ?? 0.4, vol: o.vol ?? 0.25, filter: 'bandpass', f0: o.f0 ?? 300, f1: o.f1 ?? 6000, q: o.q ?? 1.2, attack: o.attack ?? (o.dur ?? 0.4) * 0.6, delay: o.delay, pan: o.pan, panTo: o.panTo });
}

// ---- notes -------------------------------------------------------------------------------

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Note name ("C#4", "Bb3") -> MIDI number. */
export function noteMidi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

/** MIDI number -> note name. */
export function midiName(n) {
  return NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
}

/** Shift a note name by `semis` semitones. */
export const transpose = (name, semis) => midiName(noteMidi(name) + semis);

/** Note name ("C#4") -> frequency in Hz. */
export function noteFreq(name) {
  const m = noteMidi(name);
  return m === null ? 0 : 440 * Math.pow(2, (m - 69) / 12);
}
