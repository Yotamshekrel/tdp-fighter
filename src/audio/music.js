// A small synth-band sequencer and the game's songs, written as text patterns.
//
// Tokens: a note ("A4", "C#5", "Bb3"), several at once for a chord ("A3+C4+E4"),
// "-" = hold the previous note, "." = rest.
// Drums: k kick, s snare, c clap, h closed hat, o open hat, t tom, d darbuka dum,
// e darbuka tek; join with "+" to hit several at once ("k+c").
//
// Instruments: lead (detuned saws), pluck, oud, bass (saw + sub), pad (slow detuned
// saws), stab (short chord hits), drums. Everything except the drums ducks briefly
// on every kick, which gives the "pumping" feel of modern dance music.
import { tone, noise, thump, noteFreq, transpose } from './synth.js';

// ---- pattern helpers ---------------------------------------------------------------------
const bars = (...s) => s.flatMap((x) => x.trim().split(/\s+/));
const hold = (tok, n = 16) => [tok, ...Array(n - 1).fill('-')];
/** Bass line from a root note: x = root, o = octave up, f = fifth, - = hold, . = rest. */
const bass = (root, pat) => [...pat].map((ch) => (ch === 'x' ? root : ch === 'o' ? transpose(root, 12) : ch === 'f' ? transpose(root, 7) : ch === '-' ? '-' : '.'));
/** Arpeggio: digits pick notes of the chord (continuing into the next octave). */
const arp = (chord, pat) => {
  const ext = [...chord, ...chord.map((n) => transpose(n, 12))];
  return [...pat].map((ch) => (ch === '.' ? '.' : ext[Number(ch)]));
};
/** Chord hits on the given steps of a bar. */
const stabs = (chord, steps) => Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? chord.join('+') : '.'));
const concat = (...a) => a.flat();
const up = (notes, semis = 12) => notes.map((n) => (/^[A-G]/.test(n) ? transpose(n, semis) : n));

// ---- songs -----------------------------------------------------------------------------------

// MENU: A minor, laid-back synthwave
const AM = ['A3', 'C4', 'E4'], FM = ['F3', 'A3', 'C4'], CM = ['C4', 'E4', 'G4'], GM = ['G3', 'B3', 'D4'];
const menu = {
  bpm: 100,
  delay: 0.75,
  tracks: [
    { inst: 'pad', vol: 0.045, notes: concat(...[AM, FM, CM, GM, AM, FM, CM, GM].map((c) => hold(c.join('+')))) },
    { inst: 'pluck', vol: 0.05, notes: concat(arp(AM, '0.12.21.0.12.21.'), arp(FM, '0.12.21.0.12.21.'), arp(CM, '0.12.21.0.12.21.'), arp(GM, '0.12.21.0.12.21.'), arp(AM, '0.12.21.0.12.24.'), arp(FM, '0.12.21.0.12.24.'), arp(CM, '0.12.21.0.12.24.'), arp(GM, '0.12.21.0.12.24.')) },
    { inst: 'bass', vol: 0.13, notes: concat(bass('A2', 'x.x.x.x.x.x.x.o.'), bass('F2', 'x.x.x.x.x.x.x.o.'), bass('C3', 'x.x.x.x.x.x.x.o.'), bass('G2', 'x.x.x.x.x.x.x.o.'), bass('A2', 'x.x.x.x.x.x.x.o.'), bass('F2', 'x.x.x.x.x.x.x.o.'), bass('C3', 'x.x.x.x.x.x.x.o.'), bass('G2', 'x.x.xf..x.x.x.f.')) },
    { inst: 'lead', vol: 0.055, notes: bars(
      'E5 - - - D5 - C5 - A4 - - - C5 - D5 -', 'C5 - - - A4 - F4 - A4 - - - C5 - - -', 'G4 - - - C5 - E5 - G5 - - - E5 - C5 -', 'D5 - - - B4 - G4 - B4 - D5 - G5 - - -',
      'A5 - - - G5 - E5 - D5 - - - E5 - G5 -', 'F5 - - - E5 - C5 - A4 - - - C5 - - -', 'E5 - - - G5 - C6 - B5 - - - G5 - E5 -', 'D5 - . . G5 - . . B5 - - - . . . .',
    ) },
    { inst: 'drums', vol: 0.11, notes: concat(...Array(7).fill(bars('k . h . c . h . k . h k c . h .')), bars('k . h . c . h . k k c c c c c c')) },
  ],
};

// FIGHT, GORDON BEACH: F# minor, sunset synthwave, four on the floor
const FSM = ['F#3', 'A3', 'C#4'], D = ['D3', 'F#3', 'A3'], A = ['A3', 'C#4', 'E4'], E = ['E3', 'G#3', 'B3'];
const beachLead = bars(
  'C#5 - F#5 - A5 - G#5 F#5 E5 - C#5 - F#5 - - -', 'D5 - F#5 - A5 - F#5 D5 A4 - D5 - F#5 - - -', 'C#5 - E5 - A5 - G#5 E5 C#5 - E5 - A5 - - -', 'B4 - E5 - G#5 - F#5 E5 B4 - G#4 - B4 - - -',
);
const beach = {
  bpm: 126,
  delay: 0.75,
  tracks: [
    { inst: 'pad', vol: 0.045, notes: concat(...[FSM, D, A, E, FSM, D, A, E].map((c) => hold(c.join('+')))) },
    { inst: 'pluck', vol: 0.045, notes: concat(...[FSM, D, A, E, FSM, D, A, E].map((c) => arp(c, '0.1.2.1.0.1.2.3.'))) },
    { inst: 'bass', vol: 0.14, notes: concat(bass('F#2', 'x.x.xx.xx.x.xx.x'), bass('D2', 'x.x.xx.xx.x.xx.x'), bass('A2', 'x.x.xx.xx.x.xx.x'), bass('E2', 'x.x.xx.xx.x.xx.x'), bass('F#2', 'x.x.xx.xx.x.xx.x'), bass('D2', 'x.x.xx.xx.x.xx.x'), bass('A2', 'x.x.xx.xx.x.xx.x'), bass('E2', 'x.x.xxfxx.x.xfxo')) },
    { inst: 'lead', vol: 0.06, notes: concat(beachLead, up(beachLead)) },
    { inst: 'drums', vol: 0.12, notes: concat(...Array(7).fill(bars('k . h . k+c . h . k . h . k+c . o .')), bars('k . h . k+c . h . k . k . k+c c c c')) },
  ],
};

// FIGHT, ROOFTOP: C minor, dark and driving, pulsing 16th bass
const CMn = ['C4', 'Eb4', 'G4'], AB = ['Ab3', 'C4', 'Eb4'], EB = ['Eb4', 'G4', 'Bb4'], BB = ['Bb3', 'D4', 'F4'];
const rooftopLead = bars(
  'G4 - . Bb4 - . C5 - . Bb4 - G4 - F4 . .', 'Eb4 - . G4 - . Ab4 - . G4 - Eb4 - C4 . .', 'Bb4 - . D5 - . Eb5 - . D5 - Bb4 - G4 . .', 'D5 - . F5 - . D5 - . Bb4 - D5 - F5 - -',
);
const rooftop = {
  bpm: 140,
  delay: 0.75,
  tracks: [
    { inst: 'pad', vol: 0.04, notes: concat(...[['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['Eb3', 'G3', 'Bb3'], ['Bb2', 'D3', 'F3'], ['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['Eb3', 'G3', 'Bb3'], ['Bb2', 'D3', 'F3']].map((c) => hold(c.join('+')))) },
    { inst: 'stab', vol: 0.045, notes: concat(stabs(CMn, [2, 6, 10, 14]), stabs(AB, [2, 6, 10, 14]), stabs(EB, [2, 6, 10, 14]), stabs(BB, [2, 6, 10, 14]), stabs(CMn, [2, 6, 10, 14]), stabs(AB, [2, 6, 10, 14]), stabs(EB, [2, 6, 10, 14]), stabs(BB, [2, 6, 7, 10, 14, 15])) },
    { inst: 'bass', vol: 0.15, notes: concat(bass('C2', 'xxoxxxoxxxoxxxox'), bass('Ab1', 'xxoxxxoxxxoxxxox'), bass('Eb2', 'xxoxxxoxxxoxxxox'), bass('Bb1', 'xxoxxxoxxxoxxxox'), bass('C2', 'xxoxxxoxxxoxxxox'), bass('Ab1', 'xxoxxxoxxxoxxxox'), bass('Eb2', 'xxoxxxoxxxoxxxox'), bass('Bb1', 'xxoxxxoxxxoxxxxx')) },
    { inst: 'lead', vol: 0.055, notes: concat(rooftopLead, up(rooftopLead)) },
    { inst: 'drums', vol: 0.13, notes: concat(...Array(7).fill(bars('k+h . h k s+h . h . k+h . h k s+h . h h')), bars('k+h . h k s+h . s s k+s s s s s s s s')) },
  ],
};

// FIGHT, BLOOMFIELD STADIUM: G major, stomp-stomp-clap anthem
const G = ['G3', 'B3', 'D4'], DM = ['D3', 'F#3', 'A3'], EMn = ['E3', 'G3', 'B3'], C = ['C3', 'E3', 'G3'];
const stadium = {
  bpm: 120,
  delay: 0.5,
  tracks: [
    { inst: 'pad', vol: 0.05, notes: concat(...[G, DM, EMn, C, G, DM, EMn, C].map((c) => hold(c.join('+')))) },
    { inst: 'stab', vol: 0.05, notes: concat(...[G, DM, EMn, C, G, DM, EMn, C].map((c) => stabs(c, [0, 6, 8, 14]))) },
    { inst: 'bass', vol: 0.15, notes: concat(bass('G2', 'x...x...x...x...'), bass('D3', 'x...x...x...x...'), bass('E3', 'x...x...x...x...'), bass('C3', 'x...x...x...x...'), bass('G2', 'x.x.x.x.x.x.x.x.'), bass('D3', 'x.x.x.x.x.x.x.x.'), bass('E3', 'x.x.x.x.x.x.x.x.'), bass('C3', 'x.x.x.x.x...xo.o')) },
    { inst: 'lead', vol: 0.06, notes: bars(
      'G4 - - - B4 - D5 - G5 - - - D5 - B4 -', 'F#4 - - - A4 - D5 - F#5 - - - D5 - A4 -', 'E5 - - - G5 - E5 - B4 - - - G4 - E4 -', 'C5 - - - E5 - G5 - E5 - - - C5 - . .',
      'B4 - - - D5 - G5 - B5 - - - G5 - D5 -', 'A4 - - - D5 - F#5 - A5 - - - F#5 - D5 -', 'G5 - - - B5 - G5 - E5 - - - B4 - G4 -', 'E5 - - - G5 - C6 - B5 - A5 - G5 - - -',
    ) },
    { inst: 'drums', vol: 0.13, notes: concat(...Array(7).fill(bars('k . k . c . . . k . k . c . . .')), bars('k . k . c . . . k k k . c c c c')) },
  ],
};

// FIGHT, CARMEL MARKET: D phrygian dominant, darbuka groove and oud
const DD = ['D3', 'F#3', 'A3'], EBM = ['Eb3', 'G3', 'Bb3'], CC = ['C3', 'E3', 'G3'];
const shukLead = bars(
  'D5 . D5 Eb5 F#5 . Eb5 D5 C5 . D5 . . . . .', 'Eb5 . Eb5 F#5 G5 . F#5 Eb5 D5 . Eb5 . . . . .', 'A5 . G5 F#5 G5 . F#5 Eb5 D5 Eb5 F#5 . D5 . . .', 'C5 . Bb4 A4 Bb4 . C5 D5 Eb5 . D5 . . . . .',
);
const shuk = {
  bpm: 112,
  delay: 0.75,
  tracks: [
    { inst: 'pad', vol: 0.04, notes: concat(...[DD, EBM, DD, CC, DD, EBM, DD, CC].map((c) => hold(c.join('+')))) },
    { inst: 'oud', vol: 0.07, notes: concat(shukLead, shukLead) },
    { inst: 'bass', vol: 0.14, notes: concat(bass('D2', 'x..x..x.x..x..o.'), bass('Eb2', 'x..x..x.x..x..o.'), bass('D2', 'x..x..x.x..x..o.'), bass('C2', 'x..x..x.x..x..f.'), bass('D2', 'x..x..x.x..x..o.'), bass('Eb2', 'x..x..x.x..x..o.'), bass('D2', 'x..x..x.x..x..o.'), bass('C2', 'x..x..x.xx.x.xo.')) },
    { inst: 'drums', vol: 0.14, notes: concat(...Array(7).fill(bars('d . e . d . e e d . e . d e e c')), bars('d . e . d . e e d e e e d e e e')) },
  ],
};

export const SONGS = {
  menu,
  fight_beach: beach,
  fight_rooftop: rooftop,
  fight_stadium: stadium,
  fight_shuk: shuk,
  fight: rooftop,
};

// ---- the player ---------------------------------------------------------------------------------

export class Sequencer {
  constructor(ctx, dest, song) {
    this.ctx = ctx;
    this.song = song;
    this.step = 0;
    this.stepDur = 60 / song.bpm / 4;
    this.length = Math.max(...song.tracks.map((t) => t.notes.length));
    this.next = ctx.currentTime + 0.1;
    this.timer = null;

    // mix buses: fade -> dest; "mel" ducks on kicks; an echo for the lead instruments
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(dest);
    this.mel = ctx.createGain();
    this.mel.connect(this.out);
    this.dry = ctx.createGain();
    this.dry.connect(this.out);
    const dl = ctx.createDelay(2);
    dl.delayTime.value = (60 / song.bpm) * (song.delay ?? 0.75);
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    dl.connect(lp).connect(fb).connect(dl);
    const dlOut = ctx.createGain();
    dlOut.gain.value = 0.5;
    lp.connect(dlOut).connect(this.out);
    this.echo = ctx.createGain();
    this.echo.connect(dl);
    // each instrument plays into its own little bus
    this.bus = {};
    const mk = (name, melodic, send) => {
      const g = ctx.createGain();
      g.connect(melodic ? this.mel : this.dry);
      if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.echo); }
      this.bus[name] = g;
    };
    mk('lead', true, 0.35); mk('pluck', true, 0.45); mk('oud', true, 0.3); mk('stab', true, 0.2);
    mk('pad', true, 0); mk('bass', true, 0); mk('drums', false, 0);
  }

  start() {
    const t = this.ctx.currentTime;
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(1, t + 0.6);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  /** Fade out and stop. */
  stop(fade = 0.4) {
    clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { try { this.out.disconnect(); } catch { /* already gone */ } }, (fade + 0.5) * 1000);
  }

  schedule() {
    const ahead = this.ctx.currentTime + 0.18;
    while (this.next < ahead) {
      for (const tr of this.song.tracks) this.playStep(tr, this.step % tr.notes.length, this.next);
      this.step = (this.step + 1) % this.length;
      this.next += this.stepDur;
    }
  }

  playStep(tr, i, t) {
    const tok = tr.notes[i];
    if (!tok || tok === '.' || tok === '-') return;
    const { ctx } = this;
    const dest = this.bus[tr.inst];
    const v = tr.vol;
    if (tr.inst === 'drums') {
      for (const d of tok.split('+')) this.drum(d, t, v);
      return;
    }
    // note length: this step plus the "-" tokens that follow
    let len = 1;
    while (tr.notes[(i + len) % tr.notes.length] === '-' && len < 32) len++;
    const dur = len * this.stepDur * 0.97;
    for (const name of tok.split('+')) {
      const f = noteFreq(name);
      if (!f) continue;
      switch (tr.inst) {
        case 'lead':
          tone(ctx, dest, t, { type: 'sawtooth', f0: f, dur, vol: v, attack: 0.012, layers: 2, detune: 9, vibrato: len >= 3 ? 5.2 : 0, filter: { f0: 3600, f1: 1500, q: 1.2 } });
          break;
        case 'pluck':
          tone(ctx, dest, t, { type: 'triangle', f0: f, dur: Math.min(dur, 0.3), vol: v, layers: 2, detune: 6, attack: 0.003, filter: { f0: 4000, f1: 700, q: 2 } });
          break;
        case 'oud':
          tone(ctx, dest, t, { type: 'sawtooth', f0: f, dur: Math.min(dur, 0.4), vol: v, layers: 2, detune: 4, attack: 0.003, filter: { f0: 2800, f1: 450, q: 2.5 } });
          tone(ctx, dest, t, { type: 'triangle', f0: f * 2, dur: Math.min(dur, 0.2), vol: v * 0.5, attack: 0.003 });
          break;
        case 'bass':
          tone(ctx, dest, t, { type: 'sawtooth', f0: f, dur: Math.min(dur, this.stepDur * 3), vol: v, attack: 0.006, filter: { f0: 900, f1: 200, q: 3 } });
          tone(ctx, dest, t, { type: 'sine', f0: f, dur: Math.min(dur, this.stepDur * 3), vol: v * 1.1, attack: 0.006 });
          break;
        case 'pad':
          tone(ctx, dest, t, { type: 'sawtooth', f0: f, dur, vol: v, attack: Math.min(0.35, dur * 0.4), layers: 3, detune: 9, filter: { f0: 700, f1: 1100, q: 0.8 } });
          break;
        case 'stab':
          tone(ctx, dest, t, { type: 'sawtooth', f0: f, dur: Math.max(0.1, Math.min(dur, 0.16)), vol: v, layers: 2, detune: 10, attack: 0.004, filter: { f0: 3200, f1: 500, q: 1.5 } });
          break;
        default:
      }
    }
  }

  drum(d, t, v) {
    const { ctx } = this;
    const dest = this.bus.drums;
    switch (d) {
      case 'k':
        thump(ctx, dest, t, { f0: 165, f1: 42, dur: 0.17, vol: v * 4.2 });
        tone(ctx, dest, t, { type: 'sine', f0: 60, dur: 0.2, vol: v * 3, attack: 0.002 });
        // pump: everything melodic dips and swells back
        this.mel.gain.cancelScheduledValues(t);
        this.mel.gain.setValueAtTime(0.45, t);
        this.mel.gain.linearRampToValueAtTime(1, t + 0.2);
        break;
      case 's':
        noise(ctx, dest, t, { dur: 0.14, vol: v * 2, filter: 'bandpass', f0: 1900, q: 0.8 });
        tone(ctx, dest, t, { type: 'triangle', f0: 210, f1: 150, dur: 0.09, vol: v * 1.6 });
        break;
      case 'c':
        for (const dl of [0, 0.011, 0.024]) noise(ctx, dest, t, { dur: 0.04, vol: v * 1.6, filter: 'bandpass', f0: 1500, q: 0.9, delay: dl });
        noise(ctx, dest, t, { dur: 0.16, vol: v * 1.2, filter: 'bandpass', f0: 1300, q: 0.8, delay: 0.03 });
        break;
      case 'h':
        noise(ctx, dest, t, { dur: 0.035, vol: v * 0.75, filter: 'highpass', f0: 8000 });
        break;
      case 'o':
        noise(ctx, dest, t, { dur: 0.2, vol: v * 0.7, filter: 'highpass', f0: 7000 });
        break;
      case 't':
        tone(ctx, dest, t, { type: 'sine', f0: 210, f1: 90, dur: 0.18, vol: v * 3 });
        break;
      case 'd': // darbuka "dum"
        tone(ctx, dest, t, { type: 'sine', f0: 135, f1: 78, dur: 0.2, vol: v * 3.4 });
        noise(ctx, dest, t, { dur: 0.05, vol: v * 0.8, f0: 700 });
        break;
      case 'e': // darbuka "tek"
        noise(ctx, dest, t, { dur: 0.045, vol: v * 1.3, filter: 'bandpass', f0: 3200, q: 2 });
        tone(ctx, dest, t, { type: 'sine', f0: 420, f1: 300, dur: 0.05, vol: v * 1.2 });
        break;
      default:
    }
  }
}
