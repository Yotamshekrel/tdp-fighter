// HADAR — loves Mexico. Sombrero + poncho, lobs a bottle of tequila: SPLASH.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, aimArc, bodyCenter, clamp, VIEW, SC } from './helpers.js';
import { inked, lingrad, glint } from '../../render/fx-kit.js';

const G = 0.35;

export default {
  windup: 30,
  duration: 64,
  aiRange: [0, 999],
  costume(f) {
    return { hat: 'sombrero', poncho: true, prop: f.sd.thrown ? null : 'bottle' };
  },
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: 0 };
    return { pose: 'throw', frame: t < this.windup + 4 ? 0 : 1 };
  },

  start(f, b) {
    b.fx.text('OLE!', f.x, f.y - 100 * f.scale, { color: '#ffd23f', scale: 2, life: 40 });
    b.sfx('maracas', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t === this.windup + 4) {
      s.thrown = true;
      b.sfx('whoosh', f.x);
      const h = handPos(f, -62);
      const c = bodyCenter(opp);
      const T = clamp(Math.abs(c.x - h.x) / 6, 16, 40);
      const v = aimArc(h.x, h.y - 6 * SC, c.x, c.y, T, G);
      const splash = (e, bb, x, y) => {
        bb.fx.burst('drop', x, y, 26, { colors: ['#e0a020', '#ffd23f', '#fff3b0'], speed: 3.5, g: 0.2, life: 28 });
        bb.fx.burst('spark', x, y, 8, { colors: ['#9fe8a0', '#ffffff'], speed: 3, life: 14 });
        bb.fx.text('SALUD!', x, y - 26 * SC, { color: '#ffd23f', life: 36 });
        bb.sfx('splash', x);
      };
      s.bottle = b.spawn(new Entity({
        owner: f, x: h.x, y: h.y - 6 * SC, vx: v.vx, vy: v.vy, gravity: G, w: 10 * SC, h: 12 * SC, life: 120, spin: 0.4, vscale: SC,
        hit: spHit({ damage: SD, knockdown: true, push: 4, hitstop: 12, shake: 5, sfx: 'splash' }),
        onHit(e, bb) {
          splash(e, bb, e.x, e.y);
        },
        onGround(e, bb) {
          if (e.dead) return;
          e.dead = true;
          splash(e, bb, e.x, VIEW.GROUND_Y - 4);
          // A splash puddle can still catch a target standing right there.
          bb.spawn(new Entity({
            owner: f, x: e.x, y: VIEW.GROUND_Y - 14 * SC, w: 44 * SC, h: 28 * SC, life: 8,
            hit: spHit({ damage: SD, knockdown: true, push: 4, hitstop: 12, shake: 5, sfx: 'splash' }),
          }));
        },
        draw(ctx, e) {
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          const glass = lingrad(ctx, -3, 0, 3, 0, [[0, '#1d5a2a'], [0.4, '#3fbf5a'], [1, '#17481f']]);
          inked(ctx, glass, (c) => {
            c.moveTo(-1.4, -8.4); c.lineTo(1.4, -8.4); c.lineTo(1.4, -4.6); c.quadraticCurveTo(3.4, -3.4, 3.4, -1); c.lineTo(3.4, 5.4); c.quadraticCurveTo(0, 6.6, -3.4, 5.4); c.lineTo(-3.4, -1); c.quadraticCurveTo(-3.4, -3.4, -1.4, -4.6); c.closePath();
          }, 0.8);
          ctx.fillStyle = '#f0b030';
          ctx.fillRect(-3.4, -0.4, 6.8, 4);
          ctx.fillStyle = '#fff3b0';
          ctx.fillRect(-1.6, 0.6, 3.2, 1.6);
          ctx.fillStyle = '#c8c8d0';
          ctx.fillRect(-1.6, -9.4, 3.2, 1.4);
          ctx.restore();
          glint(ctx, e.x - 1, e.y - 3, 2.6, '#ffffff', 0.6);
        },
      }));
    }
    if (s.thrown && t > this.windup + 30 && (!s.bottle || s.bottle.dead)) f.endSpecial(b);
  },
};
