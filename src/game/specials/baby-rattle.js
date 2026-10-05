// GAL — the youngest. Turns into a baby and bonks you with a rattle.
import { spHit, SD, meleeHit, rushToward } from './helpers.js';

const BONKS = 3;
const BONK_EVERY = 12;
const POOF = 14;

export default {
  windup: 30,
  duration: 100,
  aiRange: [0, 200],
  costume(f, t) {
    if (t < POOF) return null;
    return { baby: true, hat: 'bonnet', prop: 'rattle' };
  },
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: t < POOF ? 'charge' : 'win', frame: Math.floor(t / 6) % 2 };
    if (s.phase === 'rush') return { pose: 'run', frame: Math.floor(t / 4) % 2 };
    if (s.phase === 'bonk') return { pose: 'swing', frame: (t - s.bonkStart) % BONK_EVERY < 5 ? 0 : 1 };
    return { pose: 'win', frame: 0 };
  },

  start(f, b) {
    b.fx.text('GOO GOO GA GA!', f.x, f.y - 96 * f.scale, { color: '#ffb3d9', life: 50 });
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t === POOF) {
      b.fx.burst('smoke', f.x, f.y - 40 * f.scale, 16, { color: '#ffffff', speed: 1.6, size: 6, grow: -0.12, life: 26 });
      b.sfx('poof', f.x);
    }
    if (t < this.windup) return;
    if (t === this.windup) s.phase = 'rush';
    if (s.phase === 'rush') {
      const there = rushToward(f, opp, 4.4, 20);
      if (t % 5 === 0) b.fx.spawn('dust', f.x - f.facing * 6 * f.scale, f.y - 2, { size: 3, grow: 0.2, life: 14, color: '#d8d0c0' });
      if (there || t > this.windup + 42) {
        s.phase = 'bonk';
        s.bonkStart = t;
        s.bonks = 0;
      }
      return;
    }
    if (s.phase === 'bonk') {
      f.vx = 0;
      const k = (t - s.bonkStart) % BONK_EVERY;
      if (k === 5) {
        s.bonks++;
        const last = s.bonks === BONKS;
        const res = meleeHit(f, b, { x: 0, y: -46, w: 34, h: 46 }, spHit({
          damage: SD / BONKS, hitstun: 22, push: last ? 5 : 1.5, knockdown: last, sfx: 'squeak', shake: last ? 5 : 0,
        }));
        if (res) b.fx.burst('star', opp.x, opp.y - 50 * opp.scale, 5, { colors: ['#ffe066', '#ff8cf0', '#7de7ff'], speed: 2, life: 22 });
        b.sfx('squeak', f.x);
        if (last) {
          s.phase = 'done';
          s.doneAt = t;
        }
      }
      return;
    }
    if (s.phase === 'done' && t - s.doneAt > 14) {
      b.fx.burst('smoke', f.x, f.y - 40 * f.scale, 14, { color: '#ffffff', speed: 1.6, size: 6, grow: -0.12, life: 22 });
      b.sfx('poof', f.x);
      f.endSpecial(b);
    }
  },
};
