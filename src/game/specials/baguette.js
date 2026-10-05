// NOA — is French. "Oui oui!" Two baguette swings, then she throws it.
import { Entity } from '../entities.js';
import { spHit, SD, meleeHit, rushToward, handPos, SC } from './helpers.js';
import { bloomAt, inked, lingrad } from '../../render/fx-kit.js';

const SWING_DMG = SD * 0.27;
const THROW_DMG = SD - SWING_DMG * 2;
// Timeline (frames after wind-up, once in range)
const S1 = 0, S2 = 14, THROW = 30;

export default {
  windup: 30,
  duration: 110,
  aiRange: [0, 999],
  costume(f) {
    return { hat: 'beret', stripes: true, prop: f.sd.thrown ? null : 'baguette' };
  },
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: 'raise', frame: 0 };
    if (s.phase === 'step') return { pose: 'walk', frame: Math.floor(t / 5) % 4 };
    const k = t - s.at;
    if (k < S2) return { pose: 'swing', frame: k < S1 + 5 ? 0 : 1 };
    if (k < THROW) return { pose: 'swing', frame: k < S2 + 5 ? 0 : 1 };
    return { pose: 'throw', frame: k < THROW + 3 ? 0 : 1 };
  },

  start(f, b) {
    b.fx.text('OUI OUI!', f.x, f.y - 98 * f.scale, { bubble: true, color: '#1f4fd8', life: 50 });
    b.sfx('magic', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) return;
    if (t === this.windup) s.phase = 'step';
    if (s.phase === 'step') {
      if (rushToward(f, opp, 3.2, 26) || t > this.windup + 18) {
        s.phase = 'attack';
        s.at = t;
      }
      return;
    }
    f.vx = 0;
    const k = t - s.at;
    const box = { x: 0, y: -84, w: 42, h: 70 };
    if (k === S1 + 5 || k === S2 + 5) {
      const res = meleeHit(f, b, box, spHit({ damage: SWING_DMG, hitstun: 26, push: 1.4, hitstop: 7, sfx: 'whack' }));
      if (!res) s.missed = (s.missed || 0) + 1;
      b.sfx('whoosh', f.x);
    }
    if (k === THROW + 3) {
      s.thrown = true;
      b.sfx('throw', f.x);
      const h = handPos(f, -56);
      // Missed swings? The baguette flies with all that extra energy instead:
      // one hit per missed swing on top of the throw, so the total stays fair.
      const hits = 1 + (s.missed || 0);
      const per = (THROW_DMG + SWING_DMG * (s.missed || 0)) / hits;
      s.bread = b.spawn(new Entity({
        owner: f, x: h.x, y: h.y, vx: f.facing * 6.8, w: 22 * SC, h: 10 * SC, life: 120, clash: true, vscale: SC,
        maxHits: hits, hitEvery: 9, big: hits > 1,
        hit: spHit({ damage: per, hitstun: 22, push: 1.2, hitstop: 6, sfx: 'whack' }),
        finalHit: { knockdown: true, push: 4.5, hitstop: 12, shake: 5 },
        onHit(e, bb) {
          bb.fx.burst('spark', e.x, e.y, 14, { colors: ['#e8b060', '#fff0c8'], speed: 3, g: 0.15, life: 22 });
          if (e.hits === e.maxHits) bb.fx.text('BAGUETTE!', e.x, e.y - 24 * SC, { color: '#ffd9a0', life: 30 });
          else e.stickT = 9; // spin in place on the target for the next hit
        },
        onUpdate(e, bb) {
          if (e.stickT > 0) {
            e.stickT--;
            e.x = bb.opponentOf(f).x - f.facing * 4 * SC;
            e.vx = 0;
          } else e.vx = f.facing * 6.8;
        },
        draw(ctx, e) { drawBaguette(ctx, e.x, e.y, e.t); },
      }));
    }
    if (s.thrown && k > THROW + 16) f.endSpecial(b);
  },
};

/** A spinning baguette, about 24 long. */
function drawBaguette(ctx, x, y, t) {
  bloomAt(ctx, x, y, 16, '#ffd9a0', 0.35);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.3);
  inked(ctx, lingrad(ctx, 0, -3.2, 0, 3.2, [[0, '#f0c070'], [0.5, '#c98a3c'], [1, '#8a5a1c']]), (c) => {
    c.moveTo(-11.5, 0); c.quadraticCurveTo(-10, -3.6, -4, -3.4); c.lineTo(5, -3.4); c.quadraticCurveTo(11, -3.6, 12, 0); c.quadraticCurveTo(11, 3.6, 5, 3.4); c.lineTo(-4, 3.4); c.quadraticCurveTo(-10, 3.6, -11.5, 0);
  }, 0.9);
  ctx.strokeStyle = '#f8d890';
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4.2 - 1.4, -2);
    ctx.lineTo(i * 4.2 + 1, 1.6);
    ctx.stroke();
  }
  ctx.restore();
}
