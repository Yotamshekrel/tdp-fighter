// Audio engine: owns the AudioContext and the mix.
//
//   sound effects -> (stereo pan) -> sfx bus ----+--> master -> compressor -> limiter -> speakers
//   music (sequencer) -> music bus -> muffle ----+
//   both send a little into one shared reverb
//
// Extras: effects are panned by where they happen on screen, repeats get a tiny
// pitch variation, the music ducks under big moments and goes muffled while the
// game is paused, and an optional spoken announcer calls the rounds.
// Browsers only allow audio after a user gesture, so call unlock() from one.
import { SFX, WET } from './sfx.js';
import { SONGS, Sequencer } from './music.js';

/** Sounds that get a slight random pitch each time (so a flurry of punches does not machine-gun). */
const VARY = new Set(['punch', 'kick', 'smash', 'block', 'swing', 'jump', 'land', 'thud', 'whoosh', 'slap', 'bonk', 'whack', 'splat', 'squeak', 'bounce', 'throw', 'zap', 'clang', 'kickball', 'splash', 'bugs', 'grab']);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.announcer = true;
    try { this.muted = localStorage.getItem('tdp-muted') === '1'; } catch { /* private mode */ }
    this.seq = null;
    this.track = null;
    this.last = {};
    this.musicBase = 0.4;
    this.muffled = false;
    this.voice = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      // output chain: master -> compressor -> limiter
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      this.master.connect(comp).connect(limiter).connect(ctx.destination);
      // shared reverb
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = impulse(ctx, 1.7, 2.6);
      this.reverbIn = ctx.createGain();
      const rtone = ctx.createBiquadFilter();
      rtone.type = 'lowpass';
      rtone.frequency.value = 5200;
      const rout = ctx.createGain();
      rout.gain.value = 0.8;
      this.reverbIn.connect(rtone).connect(this.reverb).connect(rout).connect(this.master);
      // buses
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicBase;
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 20000;
      this.musicGain.connect(this.musicFilter).connect(this.master);
      const msend = ctx.createGain();
      msend.gain.value = 0.16;
      this.musicFilter.connect(msend).connect(this.reverbIn);
      this.master.gain.value = this.muted ? 0 : 1;
      if (this.track) this.playMusic(this.track, true);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /**
   * Play a named sound effect. opts.x = where it happens on screen (0..480) for stereo
   * placement; opts.vol scales it.
   */
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const fn = SFX[name];
    if (!fn) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (now - (this.last[name] || 0) < 0.03) return;
    this.last[name] = now;
    try {
      const bus = ctx.createGain();
      bus.gain.value = opts.vol ?? 1;
      let out = bus;
      if (opts.x !== undefined && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-0.8, Math.min(0.8, ((opts.x - 240) / 240) * 0.8));
        bus.connect(p);
        out = p;
      }
      out.connect(this.sfxGain);
      const wet = ctx.createGain();
      wet.gain.value = WET[name] ?? 0.1;
      out.connect(wet).connect(this.reverbIn);
      ctx.__pitch = VARY.has(name) ? 1 + (Math.random() - 0.5) * 0.1 : 1;
      fn(ctx, bus, now);
      ctx.__pitch = 1;
    } catch (e) { /* ignore audio glitches */ }
  }

  /** Duck the music (e.g. under a special attack or a KO), then bring it back. */
  duck(level = 0.35, hold = 0.5, release = 0.4) {
    if (!this.ctx) return;
    const g = this.musicGain.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(this.musicBase * level, now, 0.03);
    g.setTargetAtTime(this.musicBase, now + hold, release / 3);
  }

  /** Muffle the music (a low-pass), used while the game is paused. */
  muffle(on) {
    if (!this.ctx || this.muffled === on) return;
    this.muffled = on;
    this.musicFilter.frequency.setTargetAtTime(on ? 450 : 20000, this.ctx.currentTime, 0.06);
  }

  playMusic(name, force = false) {
    if (this.track === name && this.seq && !force) return;
    this.track = name;
    this.seq?.stop();
    this.seq = null;
    if (!this.ctx || !SONGS[name]) return;
    this.seq = new Sequencer(this.ctx, this.musicGain, SONGS[name]);
    this.seq.start();
  }

  stopMusic() {
    this.seq?.stop();
    this.seq = null;
    this.track = null;
  }

  /** The announcer: speaks short lines ("Round one", "Fight!") if the browser can. */
  say(text, o = {}) {
    if (this.muted || !this.announcer || typeof speechSynthesis === 'undefined') return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = o.rate ?? 0.95;
      u.pitch = o.pitch ?? 0.55;
      u.volume = o.volume ?? 1;
      u.lang = 'en-US';
      const v = this.pickVoice();
      if (v) u.voice = v;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* no speech available */ }
  }

  pickVoice() {
    if (this.voice) return this.voice;
    const voices = speechSynthesis.getVoices?.() || [];
    if (!voices.length) return null;
    const pref = ['Daniel', 'Alex', 'Fred', 'Google UK English Male', 'Microsoft David', 'Microsoft Mark', 'Google US English'];
    for (const p of pref) {
      const v = voices.find((x) => x.name.includes(p) && /^en/i.test(x.lang));
      if (v) return (this.voice = v);
    }
    return (this.voice = voices.find((x) => /^en/i.test(x.lang)) || voices[0]);
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('tdp-muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (m && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}

/** A synthetic room: stereo noise that fades out exponentially, getting darker as it decays. */
function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = 0.55 - 0.45 * t; // smoothing grows over time = darker tail
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, decay) * (i < 60 ? i / 60 : 1);
    }
  }
  return buf;
}
