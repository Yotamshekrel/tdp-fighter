// BEN — the runner. Dashes across the screen and bulldozes you away.
import { spHit, SD, meleeHit, VIEW } from './helpers.js';
import { rand } from '../rng.js';

export default {
  windup: 30,
  duration: 64,
  aiRange: [0, 999],
  costume: { hat: 'headband' },
  anim(f, t) {
    if (t < this.windup) return { pose: 'charge', frame: 0 };
    if (f.sd.stopAt) return { pose: 'idle', frame: 0 };
    return { pose: 'run', frame: Math.floor(t / 3) % 2 };
  },

  start(f, b) {
    b.fx.text('ON YOUR MARKS...', f.x, f.y - 92 * f.scale, { bubble: true, life: 40 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) return;
    if (t === this.windup) {
      b.sfx('dash', f.x);
      f.noPush = true;
      b.fx.text('GO!', f.x, f.y - 90 * f.scale, { color: '#7dff6a', scale: 2, life: 24 });
    }
    if (!s.stopAt) {
      f.vx = f.facing * 11;
      f.friction = false;
      b.fx.spawn('line', f.x - f.facing * (10 + rand() * 20) * f.scale, f.y - (10 + rand() * 60) * f.scale, { life: 10, size: 3, color: '#ffffff' });
      if (t % 2 === 0) b.fx.spawn('dust', f.x - f.facing * 8, f.y - 3, { size: 3, grow: 0.25, life: 16, color: '#d8d0c0' });
      if (!s.hit) {
        const res = meleeHit(f, b, { x: -2, y: -76, w: 30, h: 76 }, spHit({
          damage: SD, knockdown: true, push: 8, launch: 5, hitstop: 12, shake: 7, sfx: 'smash',
        }));
        if (res) {
          s.hit = true;
          s.hitAt = t;
          b.fx.burst('dust', opp.x, opp.y - 30 * opp.scale, 10, { color: '#ffffff', size: 4, speed: 3, life: 20 });
        }
      }
      const atWall = (f.facing > 0 && f.x >= VIEW.RIGHT - 12) || (f.facing < 0 && f.x <= VIEW.LEFT + 12);
      if (atWall || t > this.windup + 40 || (s.hit && t - s.hitAt > 6)) s.stopAt = t;
    } else {
      f.vx *= 0.75;
      f.noPush = false;
      if (t - s.stopAt > 14) f.endSpecial(b);
    }
  },
};
