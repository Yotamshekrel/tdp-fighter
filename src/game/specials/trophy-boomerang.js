// OFEK — the captain. Red Hapoel-style kit, throws the championship trophy
// like a boomerang: it hits on the way out AND on the way back.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, VIEW, SC } from './helpers.js';
import { bloomAt, inked, lingrad, glint } from '../../render/fx-kit.js';
import { confettiColor } from '../../render/effects.js';
import { rand } from '../rng.js';

export default {
  windup: 30,
  duration: 110,
  aiRange: [0, 999],
  costume(f, t) {
    return { shirt: '#d71920', shirt2: '#ffffff', captain: true, prop: f.sd.thrown ? null : 'trophy' };
  },
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: 0 };
    if (!f.sd.thrown || t < f.sd.thrownAt + 12) return { pose: 'throw', frame: f.sd.thrown ? 1 : 0 };
    return { pose: f.sd.caught ? 'raise' : 'idle', frame: 0 };
  },

  start(f, b) {
    b.fx.text('CAPTAIN!', f.x, f.y - 100 * f.scale, { color: '#ff4d4d', life: 40 });
    b.sfx('cheer', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) {
      if (t % 3 === 0) b.fx.spawn('confetti', f.x + (rand() - 0.5) * 60 * SC, f.y - 120 * SC, { vy: 1, g: 0.03, life: 50, color: confettiColor() });
      return;
    }
    if (t === this.windup + 6) {
      s.thrown = true;
      s.thrownAt = t;
      b.sfx('whoosh', f.x);
      const h = handPos(f, -56);
      s.trophy = b.spawn(new Entity({
        owner: f, x: h.x, y: h.y - 4 * SC, vx: f.facing * 6.2, w: 18 * SC, h: 16 * SC, life: 150, wallDie: false, vscale: SC,
        maxHits: 2, hitEvery: 16, dieOnHit: false, startX: h.x, back: false,
        hit: spHit({ damage: SD / 2, hitstun: 34, push: 1.5, sfx: 'clang' }),
        finalHit: { knockdown: true, push: 4.5, shake: 5 },
        onUpdate(e, bb) {
          const out = (e.x - e.startX) * f.facing;
          const nearWall = e.x < VIEW.LEFT || e.x > VIEW.RIGHT;
          if (!e.back && (out > 320 || nearWall)) e.back = true;
          if (e.back) {
            const dx = f.x - e.x;
            e.vx += Math.sign(dx) * 0.45;
            e.vx = Math.max(-7, Math.min(7, e.vx));
            e.vy = ((f.y - 50 * SC) - e.y) * 0.08;
            if (Math.abs(dx) < 12) {
              e.dead = true;
              s.caught = true;
              s.caughtAt = bb.frame;
            }
          }
          if (e.t % 4 === 0) bb.fx.spawn('star', e.x, e.y, { life: 12, color: '#ffe066' });
        },
        draw(ctx, e) {
          // the cup spins around its vertical axis, so it squashes and flips sideways
          const w = Math.cos(e.t * 0.35);
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(Math.sin(e.t * 0.2) * 0.35);
          bloomAt(ctx, 0, 0, 16, '#ffd23f', 0.5);
          ctx.scale(Math.max(0.22, Math.abs(w)), 1);
          const gold = lingrad(ctx, -6, 0, 6, 0, [[0, '#a87a10'], [0.35, '#ffe680'], [0.7, '#e8b923'], [1, '#8a5e08']]);
          inked(ctx, gold, (c) => {
            c.moveTo(-6, -9); c.lineTo(6, -9); c.quadraticCurveTo(5.6, -1.6, 1.8, -0.6); c.lineTo(1.8, 3); c.lineTo(4.4, 3); c.lineTo(4.4, 5.6); c.lineTo(-4.4, 5.6); c.lineTo(-4.4, 3); c.lineTo(-1.8, 3); c.lineTo(-1.8, -0.6); c.quadraticCurveTo(-5.6, -1.6, -6, -9);
          });
          ctx.restore();
          glint(ctx, e.x + 3, e.y - 6, 3 + Math.abs(w) * 2, '#ffffff', 0.9);
        },
      }));
    }
    if (s.thrown && s.trophy && s.trophy.dead && !s.caught) s.caught = true; // lost somewhere
    if (s.caught) {
      if (!s.endT) {
        s.endT = t;
        b.fx.burst('confetti', f.x, f.y - 80 * SC, 14, { speed: 2, g: 0.06, life: 40, colors: ['#ff4d4d', '#ffffff', '#ffd23f'] });
      }
      if (t - s.endT > 16) f.endSpecial(b);
    }
  },
  end(f) {
    if (f.sd.trophy) f.sd.trophy.dead = true;
  },
};
