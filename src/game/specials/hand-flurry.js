// ESHEL — talks with his hands. A rapid-fire flurry of waving hands.
import { spHit, SD, meleeHit, rushToward } from './helpers.js';
import { rand } from '../rng.js';

const HITS = 8;
const EVERY = 6;

export default {
  windup: 30,
  duration: 110,
  aiRange: [0, 190],
  costume: null,
  anim(f, t) {
    if (t < this.windup) return { pose: 'flurry', frame: Math.floor(t / 8) % 2 };
    if (f.sd.phase === 'rush') return { pose: 'walk', frame: Math.floor(t / 5) % 4 };
    return { pose: 'flurry', frame: Math.floor(t / 2) % 2 };
  },

  start(f, b) {
    b.fx.text('LET ME EXPLAIN...', f.x, f.y - 96 * f.scale, { bubble: true, life: 44 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) return;
    if (t === this.windup) s.phase = 'rush';
    if (s.phase === 'rush') {
      if (rushToward(f, opp, 5.4, 22) || t > this.windup + 36) {
        s.phase = 'flurry';
        s.at = t;
        s.hits = 0;
        b.fx.text('BLA BLA BLA!', f.x, f.y - 96 * f.scale, { color: '#ffe066', life: 40 });
      }
      return;
    }
    if (s.phase === 'flurry') {
      const k = t - s.at;
      // creep forward to stay in range
      f.vx = (opp.x - f.x) * f.facing > 24 ? f.facing * 1.2 : 0;
      f.friction = false;
      // hand particles flying everywhere
      b.fx.spawn('hand', f.x + f.facing * (18 + rand() * 14) * f.scale, f.y - (40 + rand() * 30) * f.scale, {
        vx: f.facing * (1 + rand() * 2), vy: (rand() - 0.5) * 2, life: 10, color: f.def.skinColor || '#e0a878', flip: f.facing < 0,
      });
      if (k % EVERY === 0 && s.hits < HITS) {
        s.hits++;
        const last = s.hits === HITS;
        meleeHit(f, b, { x: 0, y: -70, w: 38, h: 50 }, spHit({
          damage: SD / HITS, hitstun: 14, blockstun: 10, push: last ? 5 : 0.5, hitstop: last ? 10 : 3,
          knockdown: last, shake: last ? 5 : 0, sfx: 'slap',
        }));
        b.sfx('slap', f.x);
      }
      if (s.hits >= HITS && k > HITS * EVERY + 12) f.endSpecial(b);
    }
  },
};
