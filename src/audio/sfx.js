// Sound effect recipes, all synthesised (no audio files). Each is (ctx, dest, time).
// Impacts are layered: a low thump for weight, a noise body, and a bright crack on
// top. Metal and magic use inharmonic bell partials; the jingles use brass-like
// detuned saws through a sweeping filter.
import { tone, noise, thump, ring, sweep } from './synth.js';

const seq = (c, d, t, notes, step, o) => notes.forEach((f, i) => tone(c, d, t, { ...o, f0: f, delay: (o.delay || 0) + i * step }));
/** A brass-ish chord stab: detuned saws through a filter that opens and closes. */
const brass = (c, d, t, notes, o = {}) => notes.forEach((f) => tone(c, d, t, {
  type: 'sawtooth', f0: f, dur: o.dur ?? 0.4, vol: o.vol ?? 0.05, layers: 2, detune: 12, attack: o.attack ?? 0.02, delay: o.delay,
  filter: { f0: o.f0 ?? 600, f1: o.f1 ?? 3500, q: 1.2 },
}));

/** How much of each sound goes into the reverb (default 0.1). */
export const WET = {
  ko: 0.5, smash: 0.3, boom: 0.4, special: 0.35, fight: 0.4, round: 0.35, win: 0.35, vs: 0.3, magic: 0.45, jackpot: 0.3, clang: 0.3,
  cheer: 0.25, wave: 0.3, splash: 0.2, boomwave: 0.35, clash: 0.3, laser: 0.2, grow: 0.25, shrink: 0.2, select: 0.2, sing: 0.3, hum: 0.1,
  move: 0.04, back: 0.06, pause: 0.12, punch: 0.06, kick: 0.07, swing: 0.04, jump: 0.05, land: 0.04, slap: 0.04, whoosh: 0.1,
};

export const SFX = {
  // ---- combat ----
  punch: (c, d, t) => {
    thump(c, d, t, { f0: 170, f1: 55, dur: 0.14, vol: 0.55 });
    noise(c, d, t, { dur: 0.1, vol: 0.32, f0: 1500, f1: 280 });
    noise(c, d, t, { dur: 0.035, vol: 0.26, filter: 'highpass', f0: 4200, f1: 2000 });
    tone(c, d, t, { type: 'triangle', f0: 330, f1: 120, dur: 0.05, vol: 0.14 });
  },
  kick: (c, d, t) => {
    thump(c, d, t, { f0: 125, f1: 38, dur: 0.2, vol: 0.68 });
    noise(c, d, t, { dur: 0.13, vol: 0.4, filter: 'bandpass', f0: 950, f1: 230, q: 0.9 });
    noise(c, d, t, { dur: 0.045, vol: 0.24, filter: 'highpass', f0: 3600, f1: 1800 });
  },
  smash: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 88, f1: 26, dur: 0.55, vol: 0.55, attack: 0.003 });
    noise(c, d, t, { dur: 0.45, vol: 0.38, f0: 3200, f1: 90 });
    noise(c, d, t, { dur: 0.07, vol: 0.4, filter: 'highpass', f0: 3000, f1: 1500 });
    ring(c, d, t, 540, { dur: 0.5, vol: 0.05 });
    thump(c, d, t, { f0: 200, f1: 60, dur: 0.2, vol: 0.3 });
  },
  block: (c, d, t) => {
    ring(c, d, t, 1180, { dur: 0.26, vol: 0.11 });
    noise(c, d, t, { dur: 0.04, vol: 0.26, filter: 'highpass', f0: 3500 });
    thump(c, d, t, { f0: 210, f1: 110, dur: 0.07, vol: 0.28 });
  },
  swing: (c, d, t) => noise(c, d, t, { dur: 0.15, vol: 0.55, filter: 'bandpass', f0: 500, f1: 3200, q: 1.1, attack: 0.07, pan: -0.35, panTo: 0.35 }),
  jump: (c, d, t) => {
    tone(c, d, t, { type: 'triangle', f0: 240, f1: 540, dur: 0.14, vol: 0.14 });
    noise(c, d, t, { dur: 0.07, vol: 0.09, filter: 'bandpass', f0: 1200, q: 1 });
  },
  land: (c, d, t) => {
    thump(c, d, t, { f0: 95, f1: 45, dur: 0.11, vol: 0.32 });
    noise(c, d, t, { dur: 0.08, vol: 0.2, f0: 800, f1: 300 });
  },
  thud: (c, d, t) => {
    thump(c, d, t, { f0: 85, f1: 34, dur: 0.24, vol: 0.62 });
    noise(c, d, t, { dur: 0.2, vol: 0.34, f0: 900, f1: 180 });
  },
  ko: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 72, f1: 22, dur: 1.1, vol: 0.75, attack: 0.004 });
    noise(c, d, t, { dur: 0.9, vol: 0.5, f0: 2200, f1: 55 });
    tone(c, d, t, { type: 'sawtooth', f0: 520, f1: 38, dur: 1.15, vol: 0.11, filter: { f0: 3200, f1: 180, q: 2 } });
    ring(c, d, t, 330, { dur: 1.3, vol: 0.06 });
    thump(c, d, t, { f0: 180, f1: 50, dur: 0.3, vol: 0.5 });
  },
  special: (c, d, t) => {
    sweep(c, d, t, { dur: 0.55, vol: 0.26, f0: 300, f1: 7500, q: 1 });
    seq(c, d, t, [392, 523, 659, 784, 1047], 0.055, { type: 'sawtooth', dur: 0.16, vol: 0.07, layers: 2, detune: 10, filter: { f0: 1500, f1: 4500, q: 1 } });
    seq(c, d, t, [2093, 3136], 0.12, { type: 'sine', dur: 0.5, vol: 0.05, delay: 0.3 });
    thump(c, d, t, { f0: 120, f1: 36, dur: 0.4, vol: 0.55, delay: 0.5 });
  },
  clash: (c, d, t) => {
    noise(c, d, t, { dur: 0.16, vol: 0.38, filter: 'highpass', f0: 5000, f1: 1200 });
    ring(c, d, t, 1500, { dur: 0.32, vol: 0.11 });
    thump(c, d, t, { f0: 160, f1: 55, dur: 0.14, vol: 0.4 });
  },

  // ---- menus / announcer jingles ----
  move: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 1320, dur: 0.045, vol: 0.09, attack: 0.002 });
    noise(c, d, t, { dur: 0.015, vol: 0.06, filter: 'highpass', f0: 6000 });
  },
  select: (c, d, t) => {
    ring(c, d, t, 880, { dur: 0.22, vol: 0.055 });
    tone(c, d, t, { type: 'sine', f0: 880, f1: 1320, dur: 0.12, vol: 0.12 });
    tone(c, d, t, { type: 'sine', f0: 1760, dur: 0.18, vol: 0.07, delay: 0.07 });
  },
  back: (c, d, t) => tone(c, d, t, { type: 'sine', f0: 700, f1: 330, dur: 0.12, vol: 0.12 }),
  pause: (c, d, t) => {
    tone(c, d, t, { type: 'triangle', f0: 659, dur: 0.1, vol: 0.12 });
    tone(c, d, t, { type: 'triangle', f0: 440, dur: 0.14, vol: 0.12, delay: 0.08 });
  },
  round: (c, d, t) => {
    thump(c, d, t, { f0: 115, f1: 48, dur: 0.4, vol: 0.62 });
    noise(c, d, t, { dur: 0.18, vol: 0.22, filter: 'bandpass', f0: 420, q: 1 });
    brass(c, d, t, [196, 247, 294], { dur: 0.45, vol: 0.05, f0: 500, f1: 2600 });
    ring(c, d, t, 260, { dur: 0.8, vol: 0.04 });
  },
  fight: (c, d, t) => {
    sweep(c, d, t, { dur: 0.22, vol: 0.28, f0: 500, f1: 7000 });
    thump(c, d, t, { f0: 105, f1: 34, dur: 0.5, vol: 0.78, delay: 0.1 });
    noise(c, d, t, { dur: 0.3, vol: 0.4, f0: 5000, f1: 300, delay: 0.1 });
    brass(c, d, t, [262, 330, 392, 523], { dur: 0.6, vol: 0.06, f0: 800, f1: 4500, delay: 0.1 });
  },
  win: (c, d, t) => {
    seq(c, d, t, [523, 659, 784, 1047], 0.11, { type: 'sawtooth', dur: 0.2, vol: 0.07, layers: 2, detune: 10, filter: { f0: 1200, f1: 4200, q: 1 } });
    brass(c, d, t, [523, 659, 784, 1047], { dur: 0.9, vol: 0.055, delay: 0.46, f0: 900, f1: 5000 });
    seq(c, d, t, [2093, 2637, 3136], 0.07, { type: 'sine', dur: 0.4, vol: 0.04, delay: 0.5 });
    thump(c, d, t, { f0: 130, f1: 50, dur: 0.25, vol: 0.4, delay: 0.46 });
  },
  vs: (c, d, t) => {
    sweep(c, d, t, { dur: 0.5, vol: 0.34, f0: 200, f1: 5200 });
    tone(c, d, t, { type: 'sawtooth', f0: 70, f1: 220, dur: 0.5, vol: 0.14, filter: { f0: 300, f1: 2400, q: 1 } });
    thump(c, d, t, { f0: 115, f1: 36, dur: 0.5, vol: 0.7, delay: 0.46 });
    ring(c, d, t, 440, { dur: 0.9, vol: 0.05, delay: 0.46 });
  },

  // ---- special flavours ----
  charge: (c, d, t) => {
    tone(c, d, t, { type: 'sawtooth', f0: 140, f1: 900, dur: 0.5, vol: 0.1, layers: 2, detune: 14, filter: { f0: 400, f1: 4200, q: 2 }, vibrato: 7 });
    noise(c, d, t, { dur: 0.5, vol: 0.06, filter: 'highpass', f0: 2000, f1: 8000, attack: 0.3 });
  },
  laser: (c, d, t) => {
    tone(c, d, t, { type: 'sawtooth', f0: 1150, f1: 1020, dur: 0.8, vol: 0.075, layers: 2, detune: 14, vibrato: 36, filter: { f0: 4200, f1: 2600, q: 3 } });
    tone(c, d, t, { type: 'square', f0: 575, dur: 0.8, vol: 0.04 });
    noise(c, d, t, { dur: 0.8, vol: 0.05, filter: 'highpass', f0: 6500 });
    tone(c, d, t, { type: 'sawtooth', f0: 2600, f1: 300, dur: 0.12, vol: 0.1 });
  },
  zap: (c, d, t) => {
    tone(c, d, t, { type: 'sawtooth', f0: 2400, f1: 170, dur: 0.15, vol: 0.12, filter: { type: 'bandpass', f0: 2500, f1: 500, q: 2 } });
    noise(c, d, t, { dur: 0.06, vol: 0.18, filter: 'highpass', f0: 5000 });
  },
  poof: (c, d, t) => {
    noise(c, d, t, { dur: 0.32, vol: 0.26, filter: 'bandpass', f0: 1500, f1: 380, q: 0.7 });
    thump(c, d, t, { f0: 210, f1: 70, dur: 0.14, vol: 0.2 });
  },
  squeak: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 1200, f1: 1900, dur: 0.09, vol: 0.5, filter: { type: 'bandpass', f0: 1800, q: 2 } });
    tone(c, d, t, { type: 'sine', f0: 1500, f1: 2300, dur: 0.09, vol: 0.45, delay: 0.1, filter: { type: 'bandpass', f0: 2000, q: 2 } });
  },
  bonk: (c, d, t) => {
    tone(c, d, t, { type: 'triangle', f0: 820, f1: 290, dur: 0.14, vol: 0.4 });
    ring(c, d, t, 1100, { dur: 0.14, vol: 0.07 });
    noise(c, d, t, { dur: 0.07, vol: 0.38, f0: 1600, f1: 400 });
    thump(c, d, t, { f0: 160, f1: 60, dur: 0.14, vol: 0.4 });
  },
  cheer: (c, d, t) => {
    noise(c, d, t, { dur: 1.2, vol: 0.2, filter: 'bandpass', f0: 1300, q: 0.6, attack: 0.3 });
    noise(c, d, t, { dur: 1.1, vol: 0.1, filter: 'bandpass', f0: 2700, q: 0.8, attack: 0.35, pan: -0.5, panTo: 0.5 });
    noise(c, d, t, { dur: 1.0, vol: 0.08, filter: 'bandpass', f0: 700, q: 0.9, attack: 0.25 });
    brass(c, d, t, [392, 494, 587], { dur: 0.5, vol: 0.04, delay: 0.15, f0: 900, f1: 3000 });
  },
  whoosh: (c, d, t) => sweep(c, d, t, { dur: 0.28, vol: 0.8, f0: 350, f1: 3000, q: 1, pan: -0.5, panTo: 0.5 }),
  clang: (c, d, t) => {
    ring(c, d, t, 1500, { dur: 0.55, vol: 0.11 });
    ring(c, d, t, 2260, { dur: 0.4, vol: 0.06 });
    noise(c, d, t, { dur: 0.05, vol: 0.3, filter: 'highpass', f0: 2000 });
    thump(c, d, t, { f0: 190, f1: 90, dur: 0.1, vol: 0.3 });
  },
  magic: (c, d, t) => {
    seq(c, d, t, [1047, 1319, 1568, 2093, 2637], 0.05, { type: 'sine', dur: 0.4, vol: 0.075, fm: { ratio: 3.5, index: 1.6 } });
    noise(c, d, t, { dur: 0.45, vol: 0.06, filter: 'highpass', f0: 7000, attack: 0.1 });
    tone(c, d, t, { type: 'sine', f0: 400, f1: 1600, dur: 0.3, vol: 0.06 });
  },
  slap: (c, d, t) => {
    noise(c, d, t, { dur: 0.05, vol: 0.4, filter: 'bandpass', f0: 2600, q: 1 });
    thump(c, d, t, { f0: 220, f1: 90, dur: 0.06, vol: 0.18 });
  },
  dash: (c, d, t) => {
    sweep(c, d, t, { dur: 0.42, vol: 0.32, f0: 280, f1: 3600, q: 1 });
    tone(c, d, t, { type: 'sawtooth', f0: 160, f1: 720, dur: 0.36, vol: 0.08, filter: { f0: 500, f1: 3000, q: 1 } });
  },
  wave: (c, d, t) => {
    noise(c, d, t, { dur: 1.0, vol: 0.95, f0: 200, f1: 1900, attack: 0.4 });
    noise(c, d, t, { dur: 0.9, vol: 0.3, filter: 'bandpass', f0: 3000, q: 0.5, attack: 0.5 });
  },
  splash: (c, d, t) => {
    noise(c, d, t, { dur: 0.42, vol: 0.34, filter: 'bandpass', f0: 2600, f1: 600, q: 0.8 });
    [900, 1300, 700, 1600, 1100].forEach((f, i) => tone(c, d, t, { type: 'sine', f0: f, f1: f * 1.5, dur: 0.07, vol: 0.06, delay: 0.04 + i * 0.045 }));
  },
  maracas: (c, d, t) => [0, 0.12, 0.2, 0.32].forEach((dl, i) => noise(c, d, t, { dur: 0.06, vol: 0.6, filter: 'bandpass', f0: 6500, q: 1.5, delay: dl, pan: i % 2 ? 0.4 : -0.4 })),
  hum: (c, d, t) => {
    [60, 121, 181].forEach((f, i) => tone(c, d, t, { type: 'sawtooth', f0: f, dur: 0.7, vol: 0.07 / (i + 1), filter: { f0: 500, q: 1 }, vibrato: 3 }));
  },
  wind: (c, d, t) => noise(c, d, t, { dur: 0.9, vol: 0.8, filter: 'bandpass', f0: 500, f1: 1500, q: 0.5, attack: 0.2, pan: -0.5, panTo: 0.5 }),
  bugs: (c, d, t) => [0, 0.03, 0.07, 0.1].forEach((dl) => noise(c, d, t, { dur: 0.02, vol: 0.09, filter: 'highpass', f0: 4500, delay: dl, pan: Math.random() - 0.5 })),
  grab: (c, d, t) => {
    thump(c, d, t, { f0: 260, f1: 120, dur: 0.1, vol: 0.3 });
    noise(c, d, t, { dur: 0.08, vol: 0.18, f0: 1200, f1: 400 });
  },
  squeeze: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 380, f1: 950, dur: 0.18, vol: 0.22, vibrato: 14 });
    noise(c, d, t, { dur: 0.12, vol: 0.12, filter: 'bandpass', f0: 1200, q: 2 });
  },
  splat: (c, d, t) => {
    noise(c, d, t, { dur: 0.13, vol: 0.38, f0: 1300, f1: 320 });
    tone(c, d, t, { type: 'sine', f0: 260, f1: 70, dur: 0.12, vol: 0.28 });
    noise(c, d, t, { dur: 0.04, vol: 0.14, filter: 'highpass', f0: 4000 });
  },
  throw: (c, d, t) => sweep(c, d, t, { dur: 0.13, vol: 0.5, f0: 1000, f1: 2800, q: 1 }),
  kickball: (c, d, t) => {
    thump(c, d, t, { f0: 230, f1: 70, dur: 0.13, vol: 0.62 });
    noise(c, d, t, { dur: 0.05, vol: 0.28, filter: 'bandpass', f0: 1600, q: 1 });
    tone(c, d, t, { type: 'triangle', f0: 400, f1: 180, dur: 0.06, vol: 0.12 });
  },
  bounce: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 300, f1: 560, dur: 0.07, vol: 0.14 });
    thump(c, d, t, { f0: 150, f1: 80, dur: 0.06, vol: 0.18 });
  },
  slots: (c, d, t) => {
    for (let i = 0; i < 10; i++) {
      tone(c, d, t, { type: 'sine', f0: 900 + (i % 3) * 150, dur: 0.05, vol: 0.07, delay: i * 0.05 });
      noise(c, d, t, { dur: 0.012, vol: 0.08, filter: 'highpass', f0: 5000, delay: i * 0.05 });
    }
  },
  jackpot: (c, d, t) => {
    for (let i = 0; i < 8; i++) ring(c, d, t, [1319, 1568, 1760][i % 3], { dur: 0.3, vol: 0.05, delay: i * 0.075 });
    brass(c, d, t, [523, 659, 784], { dur: 0.7, vol: 0.05, delay: 0.1, f0: 900, f1: 4000 });
  },
  coin: (c, d, t) => {
    ring(c, d, t, 1319, { dur: 0.25, vol: 0.07 });
    ring(c, d, t, 1760, { dur: 0.35, vol: 0.07, delay: 0.07 });
  },
  whack: (c, d, t) => {
    noise(c, d, t, { dur: 0.1, vol: 0.4, f0: 1800, f1: 400 });
    tone(c, d, t, { type: 'triangle', f0: 260, f1: 100, dur: 0.12, vol: 0.28 });
    thump(c, d, t, { f0: 150, f1: 55, dur: 0.12, vol: 0.34 });
  },
  grow: (c, d, t) => {
    tone(c, d, t, { type: 'sawtooth', f0: 65, f1: 380, dur: 0.7, vol: 0.14, layers: 2, detune: 14, filter: { f0: 300, f1: 2400, q: 2 } });
    tone(c, d, t, { type: 'sine', f0: 50, f1: 190, dur: 0.7, vol: 0.3 });
  },
  shrink: (c, d, t) => tone(c, d, t, { type: 'sawtooth', f0: 420, f1: 70, dur: 0.45, vol: 0.12, filter: { f0: 3000, f1: 300, q: 2 } }),
  boom: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 72, f1: 24, dur: 0.8, vol: 0.55, attack: 0.003 });
    noise(c, d, t, { dur: 0.7, vol: 0.42, f0: 800, f1: 45 });
    noise(c, d, t, { dur: 0.1, vol: 0.4, filter: 'highpass', f0: 2500 });
    thump(c, d, t, { f0: 160, f1: 45, dur: 0.3, vol: 0.35 });
  },
  sing: (c, d, t) => {
    [523, 659, 784].forEach((f, i) => tone(c, d, t, { type: 'sawtooth', f0: f, dur: 0.22, vol: 0.06, delay: i * 0.16, layers: 3, detune: 8, vibrato: 6, filter: { type: 'bandpass', f0: 1200, q: 1.5 } }));
  },
  boomwave: (c, d, t) => {
    tone(c, d, t, { type: 'sine', f0: 95, f1: 40, dur: 0.3, vol: 0.55 });
    noise(c, d, t, { dur: 0.22, vol: 0.28, f0: 420, f1: 120 });
    ring(c, d, t, 196, { dur: 0.3, vol: 0.05 });
  },
};
