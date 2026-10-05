// AYOUB — loves Harry Potter. Wand flick, "Abracadabra!", sparkly magic bolt.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, handDir, SC } from './helpers.js';
import { bloomAt, glint, ball } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

/** The wand tip: a little beyond the hand along the forearm. */
function wandTip(f) {
  const h = handPos(f, -64);
  const d = handDir(f);
  const l = Math.hypot(d.x, d.y) || 1;
  return { x: h.x + (d.x / l) * 15 * SC, y: h.y + (d.y / l) * 15 * SC };
}

export default {
  windup: 30,
  duration: 34,
  aiRange: [0, 999],
  costume: { hat: 'wizard', prop: 'wand', scarf: true },
  anim(f, t) {
    if (t < this.windup - 6) return { pose: 'raise', frame: 0 };
    return { pose: 'cast', frame: 1 };
  },

  start(f, b) {
    b.fx.text('ABRACADABRA!', f.x, f.y - 96 * f.scale, { bubble: true, life: 48 });
    b.sfx('magic', f.x);
  },

  update(f, b, t) {
    const h = wandTip(f);
    if (t < this.windup) {
      // Sparkles orbiting the wand tip
      const a = t * 0.5;
      b.fx.spawn('plus', h.x + Math.cos(a) * 10 * SC, h.y + Math.sin(a) * 10 * SC, { life: 14, size: 2, color: rand() < 0.5 ? '#a6ff4d' : '#fff7a1' });
      return;
    }
    if (t === this.windup) {
      b.sfx('zap', f.x);
      const s = wandTip(f);
      f.sd.bolt = b.spawn(new Entity({
        owner: f, x: s.x + f.facing * 6, y: s.y, vx: f.facing * 8, w: 18 * SC, h: 16 * SC, life: 120, clash: true, vscale: SC,
        hit: spHit({ damage: SD, knockdown: true, push: 5, hitstop: 12, shake: 6, sfx: 'zap' }),
        onUpdate(e, bb) {
          e.y = s.y + Math.sin(e.t * 0.5) * 3;
          bb.fx.spawn('plus', e.x - f.facing * 6, e.y + (rand() - 0.5) * 10, { life: 16, size: 2, vy: (rand() - 0.5) * 0.6, color: rand() < 0.5 ? '#a6ff4d' : '#fff7a1' });
        },
        onHit(e, bb, tgt) {
          bb.fx.burst('star', e.x, e.y, 14, { colors: ['#a6ff4d', '#fff7a1', '#ffffff'], speed: 3.5, life: 26 });
        },
        draw(ctx, e) {
          const p = 0.5 + 0.5 * Math.sin(e.t * 0.7);
          // zig-zag lightning tail
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (const [w, col, al] of [[3.2, '#2fa800', 0.5], [1.6, '#9bff4a', 1], [0.6, '#ffffff', 1]]) {
            ctx.globalAlpha = al;
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            for (let i = 1; i <= 6; i++) ctx.lineTo(e.x - f.facing * i * 5.5, e.y + (i % 2 ? -3.2 : 3.2) * (1 - i / 8));
            ctx.stroke();
          }
          ctx.restore();
          bloomAt(ctx, e.x, e.y, 20, '#7dff2e', 0.85);
          ball(ctx, e.x, e.y, 6 + p, '#7dff2e', '#f4ffd0', '#2e8a00');
          glint(ctx, e.x, e.y, 9 + p * 3, '#ffffff', 0.9);
        },
      }));
    }
  },
};
