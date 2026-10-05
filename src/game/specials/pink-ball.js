// MOR — magic with a pink soccer ball. Hops and volleys a bouncing pink ball.
import { Entity } from '../entities.js';
import { spHit, SD, SC } from './helpers.js';
import { bloomAt, INK } from '../../render/fx-kit.js';

export default {
  windup: 30,
  duration: 90,
  aiRange: [0, 999],
  costume: { hat: 'pinkband' },
  anim(f, t) {
    if (t < this.windup) return { pose: 'kick', frame: 0 };
    if (!f.sd.kicked) return { pose: 'jumpUp', frame: 0 };
    return { pose: 'kick', frame: t - f.sd.kickT < 10 ? 1 : 0 };
  },

  start(f, b) {
    b.fx.text('PINK POWER!', f.x, f.y - 96 * f.scale, { color: '#ff8cf0', life: 40 });
    b.sfx('charge', f.x);
  },

  update(f, b, t) {
    const s = f.sd;
    if (t < this.windup) return;
    if (t === this.windup) {
      f.vy = -5;
      f.grounded = false;
      b.sfx('jump', f.x);
    }
    if (t === this.windup + 9) {
      s.kicked = true;
      s.kickT = t;
      b.sfx('kickball', f.x);
      s.ball = b.spawn(new Entity({
        owner: f, x: f.x + f.facing * 16 * SC, y: f.y - 20 * SC, vx: f.facing * 6.2, vy: -3.2, gravity: 0.32, bounce: 0.8,
        w: 14 * SC, h: 14 * SC, life: 130, clash: true, spin: 0.35 * f.facing, vscale: SC,
        hit: spHit({ damage: SD, knockdown: true, push: 5, hitstop: 12, shake: 6, sfx: 'kickball' }),
        onUpdate(e, bb) {
          if (e.t % 3 === 0) bb.fx.spawn('spark', e.x - e.vx, e.y, { life: 10, size: 2, color: '#ff8cf0' });
        },
        onHit(e, bb) {
          bb.fx.text('GOOOAL!', e.x, e.y - 30 * SC, { color: '#ff8cf0', scale: 2, life: 40 });
          bb.fx.burst('confetti', e.x, e.y, 16, { speed: 3, g: 0.08, life: 40, colors: ['#ff8cf0', '#ffffff', '#ff4d9d'] });
        },
        draw(ctx, e) {
          bloomAt(ctx, e.x, e.y, 15, '#ff69c8', 0.7);
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(0, 0, 7.8, 0, 6.3);
          ctx.fill();
          const gr = ctx.createRadialGradient(-2.4, -2.6, 0.8, 0, 0, 7);
          gr.addColorStop(0, '#ffd0ee');
          gr.addColorStop(0.5, '#ff69c8');
          gr.addColorStop(1, '#c0388e');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, 6.3);
          ctx.fill();
          // pentagon patches
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 0.5;
          const pent = (cx, cy, r, rot) => {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const a = rot + (i * Math.PI * 2) / 5;
              ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          };
          pent(0, 0, 2.6, -Math.PI / 2);
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * Math.PI * 2) / 5 + 0.62;
            pent(Math.cos(a) * 6.4, Math.sin(a) * 6.4, 1.8, a);
          }
          ctx.restore();
        },
      }));
    }
    if (s.kicked && f.grounded && t - s.kickT > 14) f.endSpecial(b);
  },
};
