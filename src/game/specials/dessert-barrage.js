// MAYA — makes desserts. A barrage of cakes, ice creams and cupcakes.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, aimArc, bodyCenter, clamp, SC } from './helpers.js';
import { inked, lingrad, ball, INK } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const COUNT = 6;
const EVERY = 7;
const G = 0.3;

/** Each dessert is drawn centred on (0, 0), about 14 units across. */
const DESSERTS = [
  { cream: '#ff8cc6', draw: cake },
  { cream: '#a6f0ff', draw: iceCream },
  { cream: '#fff6e0', draw: cupcake },
  { cream: '#ff6fb5', draw: donut },
];

export default {
  windup: 30,
  duration: 90,
  aiRange: [0, 999],
  costume: { hat: 'chef', apron: true },
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: 0 };
    return { pose: 'throw', frame: ((t - this.windup) % EVERY) < 3 ? 0 : 1 };
  },

  start(f, b) {
    b.fx.text('DESSERT TIME!', f.x, f.y - 96 * f.scale, { color: '#ff8cc6', life: 44 });
    b.sfx('magic', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) return;
    const k = t - this.windup;
    s.n = s.n || 0;
    if (k % EVERY === 2 && s.n < COUNT) {
      s.n++;
      const last = s.n === COUNT;
      const d = DESSERTS[s.n % DESSERTS.length];
      const h = handPos(f, -64);
      const c = bodyCenter(opp);
      const T = clamp(Math.abs(c.x - h.x) / 6.5, 12, 36) + rand() * 4;
      const v = aimArc(h.x, h.y - 4 * SC, c.x + (rand() - 0.5) * 8, c.y + (rand() - 0.5) * 16, T, G);
      const splat = (bb, x, y) => {
        bb.fx.burst('drop', x, y, 12, { colors: [d.cream, '#ffffff'], speed: 2.5, g: 0.18, life: 22 });
        bb.sfx('splat', x);
      };
      b.sfx('throw', f.x);
      s.last = b.spawn(new Entity({
        owner: f, x: h.x, y: h.y - 4 * SC, vx: v.vx, vy: v.vy, gravity: G, w: 14 * SC, h: 14 * SC, life: 100, vscale: SC,
        spin: (rand() - 0.5) * 0.25,
        hit: spHit({ damage: SD / COUNT, hitstun: 18, blockstun: 12, push: last ? 4.5 : 1.2, hitstop: last ? 10 : 4, knockdown: last, sfx: 'splat' }),
        onHit(e, bb) { splat(bb, e.x, e.y); },
        onGround(e, bb) { e.dead = true; splat(bb, e.x, e.y + 4); },
        draw(ctx, e) {
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          ctx.scale(1.35, 1.35);
          d.draw(ctx);
          ctx.restore();
        },
      }));
    }
    if (s.n >= COUNT && s.last && s.last.dead) f.endSpecial(b);
  },
};

function cake(c) {
  inked(c, lingrad(c, 0, -2, 0, 6, [[0, '#a05a34'], [1, '#6a381c']]), (p) => p.roundRect(-7, -1, 14, 7, 1.6));
  inked(c, '#ffe9a8', (p) => p.rect(-7, 1.4, 14, 1.6), 0.5);
  inked(c, lingrad(c, 0, -6, 0, 0, [[0, '#ffffff'], [1, '#ff8cc6']]), (p) => { p.moveTo(-7, -0.6); p.quadraticCurveTo(-7, -5.6, 0, -5.6); p.quadraticCurveTo(7, -5.6, 7, -0.6); p.lineTo(5, 0.4); p.lineTo(3, -1); p.lineTo(1, 0.6); p.lineTo(-1, -1); p.lineTo(-3, 0.4); p.lineTo(-5, -1); p.closePath(); });
  ball(c, 0, -7.4, 1.5, '#ff2a4a', '#ffb0b8', '#b01028');
}
function iceCream(c) {
  inked(c, lingrad(c, 0, 0, 0, 8, [[0, '#f0c070'], [1, '#c08a40']]), (p) => { p.moveTo(-3.6, 0); p.lineTo(3.6, 0); p.lineTo(0, 8.4); p.closePath(); });
  c.strokeStyle = 'rgba(120,70,20,0.5)';
  c.lineWidth = 0.4;
  c.beginPath();
  c.moveTo(-2, 1); c.lineTo(1.2, 5); c.moveTo(2, 1); c.lineTo(-1.2, 5);
  c.stroke();
  ball(c, 0, -2.6, 4.2, '#a6f0ff', '#ffffff', '#5ab8d8');
  ball(c, 0.6, -6.4, 3, '#ffb8e0', '#ffffff', '#e070b0');
}
function cupcake(c) {
  inked(c, lingrad(c, 0, 0, 0, 6, [[0, '#d88adf'], [1, '#9a4aa8']]), (p) => { p.moveTo(-5, 0); p.lineTo(5, 0); p.lineTo(3.6, 6); p.lineTo(-3.6, 6); p.closePath(); });
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 0.4;
  for (let i = -3; i <= 3; i += 2) { c.beginPath(); c.moveTo(i, 0.4); c.lineTo(i * 0.8, 5.6); c.stroke(); }
  inked(c, lingrad(c, 0, -6, 0, 0, [[0, '#ffffff'], [1, '#ffe0c8']]), (p) => { p.moveTo(-5.6, 0.4); p.quadraticCurveTo(-5.6, -3, -1.6, -3.2); p.quadraticCurveTo(-2, -6, 0.6, -6.4); p.quadraticCurveTo(3, -6, 2.4, -3.2); p.quadraticCurveTo(5.6, -3, 5.6, 0.4); p.closePath(); });
  ball(c, 0.4, -7.4, 1.4, '#ff2a2a', '#ffb0b0', '#a01010');
}
function donut(c) {
  c.fillStyle = INK;
  c.beginPath();
  c.arc(0, 0, 7.6, 0, 6.3);
  c.fill();
  const gr = c.createRadialGradient(-2, -2, 1, 0, 0, 7);
  gr.addColorStop(0, '#f0b070');
  gr.addColorStop(1, '#b0702c');
  c.fillStyle = gr;
  c.beginPath();
  c.arc(0, 0, 6.8, 0, 6.3);
  c.fill();
  c.fillStyle = '#ff6fb5';
  c.beginPath();
  c.arc(0, 0, 5.8, 0, 6.3);
  c.fill();
  for (const [x, y, col] of [[-3, -2.6, '#fff'], [2.6, -3, '#ffe066'], [3.6, 1, '#7de7ff'], [-1, 3.6, '#fff'], [-4, 1.2, '#c9a0ff']]) {
    c.fillStyle = col;
    c.fillRect(x - 0.9, y - 0.3, 1.8, 0.7);
  }
  c.fillStyle = INK;
  c.beginPath();
  c.arc(0, 0, 2.1, 0, 6.3);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath();
  c.ellipse(-2.6, -3.6, 2, 0.8, -0.6, 0, 6.3);
  c.fill();
}
