// NADAV — always wins polls and lotteries. JACKPOT! Lottery balls, tickets
// and coins rain down on the opponent.
import { Entity } from '../entities.js';
import { spHit, SD, VIEW, SC } from './helpers.js';
import { ball, inked, lingrad, bloomAt, INK } from '../../render/fx-kit.js';
import { drawText } from '../../render/font.js';
import { rand } from '../rng.js';

const BALLS = 6;
const EVERY = 9;
const BALL_COLORS = ['#ff4d4d', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff8cf0', '#ffffff'];

export default {
  windup: 30,
  duration: 110,
  aiRange: [0, 999],
  costume: { hat: 'tophat' },
  anim(f, t) {
    return { pose: t < this.windup ? 'raise' : 'win', frame: t < this.windup ? 0 : Math.floor(t / 10) % 2 };
  },

  start(f, b) {
    b.sfx('slots', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t === this.windup - 4) {
      b.fx.text('JACKPOT!', VIEW.W / 2, 64, { color: ['#fff6a0', '#ffd23f', '#ff9b00'], scale: 3, life: 70, vy: 0 });
      b.sfx('jackpot', f.x);
    }
    if (t < this.windup) return;
    const k = t - this.windup;
    s.n = s.n || 0;
    // Decorative money rain
    if (k < 70 && k % 2 === 0) {
      b.fx.spawn(rand() < 0.5 ? 'coin' : 'confetti', opp.x + (rand() - 0.5) * 120, -6, {
        vy: 1.5 + rand() * 2, g: 0.06, life: 120, color: rand() < 0.5 ? '#9fe8a0' : '#ffe066',
      });
    }
    if (k % EVERY === 0 && s.n < BALLS) {
      s.n++;
      const last = s.n === BALLS;
      const num = 1 + Math.floor(rand() * 49);
      const col = BALL_COLORS[s.n % BALL_COLORS.length];
      s.last = b.spawn(new Entity({
        owner: f, x: opp.x + (rand() - 0.5) * 16, y: -10, vy: 4.5, gravity: 0.25, w: 14 * SC, h: 14 * SC, life: 120, bounce: 0.5, vscale: SC,
        hit: spHit({ damage: SD / BALLS, hitstun: 20, blockstun: 12, push: last ? 4 : 0.8, hitstop: last ? 10 : 4, knockdown: last, sfx: 'coin' }),
        onHit(e, bb) {
          bb.fx.burst('coin', e.x, e.y, 4, { speed: 2.5, g: 0.2, life: 24 });
        },
        onGround(e) { e.active = false; if (e.t > 60) e.dead = true; },
        draw(ctx, e) {
          bloomAt(ctx, e.x, e.y, 12, col, 0.45);
          ball(ctx, e.x, e.y, 7, col, '#ffffff', '#00000055');
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(e.x, e.y, 3.6, 0, 6.3);
          ctx.fill();
          drawText(ctx, String(num % 10), e.x, e.y - 3.2, { scale: 0.9, align: 'center', color: INK, weight: 800, italic: false });
        },
      }));
      b.sfx('coin', f.x);
    }
    if (s.n >= BALLS && k > BALLS * EVERY + 40) f.endSpecial(b);
  },

  draw(ctx, f, b, t) {
    // Slot machine reels above his head during the wind-up
    if (t >= this.windup + 20) return;
    const x = f.x - 24 * SC, y = f.y - 128 * SC;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(SC, SC);
    bloomAt(ctx, 24, 8, 40, '#ffd23f', 0.35);
    inked(ctx, lingrad(ctx, 0, 0, 0, 17, [[0, '#ff4a5a'], [1, '#a01428']]), (c) => c.roundRect(-2, -2, 52, 19, 3), 1);
    for (let i = 0; i < 3; i++) {
      inked(ctx, '#ffffff', (c) => c.roundRect(1.5 + i * 15.5, 1, 13, 13, 1.6), 0.6);
      const stop = t > 10 + i * 6;
      const sym = stop ? '7' : String((t + i * 3) % 10);
      drawText(ctx, sym, 8 + i * 15.5, 3, { scale: 1.2, align: 'center', color: stop ? '#ff2a2a' : '#14101e', weight: 800, italic: false });
    }
    ctx.restore();
  },
};
