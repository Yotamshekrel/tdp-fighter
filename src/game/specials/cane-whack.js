// OFIR — the oldest. Turns into a very old man and whacks you with his cane.
import { spHit, SD, meleeHit, rushToward } from './helpers.js';

export default {
  windup: 30,
  duration: 110,
  aiRange: [0, 210],
  costume: { old: true, prop: 'cane' },
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: 'hobble', frame: Math.floor(t / 10) % 2 };
    if (s.phase === 'walk') return { pose: 'hobble', frame: Math.floor(t / 6) % 2 };
    if (s.phase === 'raise') return { pose: 'swing', frame: 0 };
    if (s.phase === 'whack') return { pose: 'swing', frame: 1 };
    return { pose: 'hobble', frame: 0 };
  },

  start(f, b) {
    b.fx.burst('smoke', f.x, f.y - 40 * f.scale, 14, { color: '#d0d0d0', speed: 1.5, size: 6, grow: -0.12, life: 26 });
    b.fx.text('OY VEY...', f.x, f.y - 92 * f.scale, { bubble: true, life: 40 });
    b.sfx('poof', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) return;
    if (t === this.windup) s.phase = 'walk';
    if (s.phase === 'walk') {
      // Surprisingly fast for his age
      const there = rushToward(f, opp, 3.8, 26);
      if (there || t > this.windup + 52) {
        s.phase = 'raise';
        s.at = t;
      }
    } else if (s.phase === 'raise') {
      f.vx = 0;
      if (t - s.at >= 9) {
        s.phase = 'whack';
        s.at = t;
        const res = meleeHit(f, b, { x: 0, y: -80, w: 40, h: 80 }, spHit({
          damage: SD, knockdown: true, push: 5.5, hitstop: 14, shake: 7, sfx: 'bonk',
        }));
        b.sfx('bonk', f.x);
        if (res) b.fx.burst('star', opp.x, opp.y - 70 * opp.scale, 8, { colors: ['#ffe066', '#ffffff'], speed: 2.5, life: 28 });
      }
    } else if (s.phase === 'whack') {
      if (t - s.at === 14) b.fx.text('MY BACK!', f.x, f.y - 92 * f.scale, { bubble: true, life: 34 });
      if (t - s.at > 34) f.endSpecial(b);
    }
  },
};
