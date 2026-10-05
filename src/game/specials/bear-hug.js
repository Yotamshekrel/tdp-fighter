// YAARA — loves hugs. Runs in for a huge bear hug: squeeze, squeeze, squeeze,
// then a friendly toss. It's a grab: can't be blocked, but you can jump it.
import { spHit, SD, aheadDist } from './helpers.js';
import { rand } from '../rng.js';

const SQUEEZES = 3;
const SQ_DMG = SD * 0.27;
const TOSS_DMG = SD - SQ_DMG * SQUEEZES;
const EVERY = 16;

export default {
  windup: 30,
  duration: 120,
  aiRange: [0, 210],
  escape: 'jump', // hint for the CPU: grabs can't be blocked, jump away
  costume: { hearts: true },
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: 'hugOpen', frame: 0 };
    if (s.phase === 'run') return { pose: 'run', frame: Math.floor(t / 4) % 2 };
    if (s.phase === 'hug') return { pose: 'hug', frame: Math.floor((t - s.at) / 8) % 2 };
    if (s.phase === 'toss') return { pose: 'throw', frame: 1 };
    return { pose: 'hugOpen', frame: 0 };
  },

  start(f, b) {
    b.fx.text('HUGGIES!', f.x, f.y - 98 * f.scale, { color: '#ff8cc6', scale: 2, life: 40 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) {
      if (t % 6 === 0) b.fx.spawn('heart', f.x + (rand() - 0.5) * 30 * f.scale, f.y - 70 * f.scale, { vy: -0.8, life: 30, color: '#ff5fa2' });
      return;
    }
    if (t === this.windup) s.phase = 'run';
    if (s.phase === 'run') {
      f.vx = f.facing * 6.5;
      f.friction = false;
      const d = aheadDist(f, opp);
      const grabbable = opp.grounded && !opp.isInvulnerable() && opp.state !== 'ko';
      if (d > -4 && d < 30 * f.scale && grabbable) {
        // GRAB!
        s.phase = 'hug';
        s.at = t;
        s.n = 0;
        f.vx = 0;
        opp.go('hitstun');
        opp.stun = { left: 999, knockdown: false, phase: 'stun' };
        opp.attack = null;
        opp.held = true;
        opp.vx = opp.vy = 0;
        opp.facing = -f.facing;
        b.sfx('grab', f.x);
      } else if (t > this.windup + 30) {
        s.phase = 'whiff';
        s.at = t;
        b.fx.text('AWW...', f.x, f.y - 92 * f.scale, { bubble: true, life: 30 });
      }
      return;
    }
    if (s.phase === 'hug') {
      f.vx = 0;
      opp.x = f.x + f.facing * 17 * f.scale;
      opp.y = f.y;
      const k = t - s.at;
      if (k % EVERY === EVERY - 1 && s.n < SQUEEZES) {
        s.n++;
        opp.squish = 10;
        b.resolveHit(f, opp, spHit({ damage: SQ_DMG, guard: 'unblockable', hitstun: 999, push: 0, hitstop: 5, sfx: 'squeeze' }), f.x, opp.x, opp.y - 50 * opp.scale);
        opp.held = opp.state !== 'ko';
        b.fx.burst('heart', (f.x + opp.x) / 2, f.y - 60 * f.scale, 6, { color: '#ff5fa2', speed: 2, vy: -1, life: 30 });
        b.fx.text('SQUEEZE!', (f.x + opp.x) / 2, f.y - 100 * f.scale, { color: '#ff8cc6', life: 20 });
        b.sfx('squeeze', f.x);
      }
      if (opp.state === 'ko') {
        s.phase = 'done';
        s.at = t;
        return;
      }
      if (s.n >= SQUEEZES && k > EVERY * SQUEEZES + 6) {
        s.phase = 'toss';
        s.at = t;
        opp.held = false;
        b.resolveHit(f, opp, spHit({ damage: TOSS_DMG, guard: 'unblockable', knockdown: true, push: 5, launch: 6, hitstop: 10, shake: 5, sfx: 'smash' }), f.x, opp.x, opp.y - 50 * opp.scale);
        b.fx.text('LOVE YOU!', f.x, f.y - 96 * f.scale, { bubble: true, life: 36 });
      }
      return;
    }
    if ((s.phase === 'toss' || s.phase === 'whiff' || s.phase === 'done') && t - s.at > 18) f.endSpecial(b);
  },

  end(f, b) {
    const opp = b?.opponentOf(f);
    if (opp && opp.held) {
      opp.held = false;
      if (opp.state === 'hitstun' && opp.stun) opp.stun.left = 10;
    }
  },
};
