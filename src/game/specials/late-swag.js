// RASHIDA — "YOU'RE LATE!": yells at the other fighter for showing up late, then pelts them with
// company swag and merch (t-shirts, caps, mugs, tote bags, stickers).
import { Entity } from '../entities.js';
import { spHit, SD, handPos, mouthPos, aimArc, bodyCenter, clamp, SC } from './helpers.js';
import { inked, lingrad, ball, bloomAt, INK } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const COUNT = 6;
const EVERY = 7;
const G = 0.3;

/** Each piece of swag is drawn centred on (0, 0), about 14 units across. */
const SWAG = [
  { burst: ['#2f6df0', '#ffffff'], draw: tshirt },
  { burst: ['#e0182c', '#ffffff'], draw: cap },
  { burst: ['#ffffff', '#ffd23f'], draw: mug },
  { burst: ['#e8d4a8', '#2f6df0'], draw: tote },
  { burst: ['#ffd23f', '#ff7a3a'], draw: sticker },
];

export default {
  windup: 34,
  duration: 96,
  aiRange: [0, 999],
  anim(f, t) {
    if (t < this.windup) return { pose: 'sing', frame: Math.floor(t / 5) % 2 }; // hand at the mouth: yelling
    return { pose: 'throw', frame: ((t - this.windup) % EVERY) < 3 ? 0 : 1 };
  },

  start(f, b) {
    const m = mouthPos(f);
    b.fx.text("YOU'RE LATE!!", f.x, f.y - 98 * f.scale, { color: '#ff4a3a', life: 50 });
    b.sfx('sing', f.x);
    b.addShake(2);
    // a shouting burst of "!" lines in front of her mouth
    for (let i = 0; i < 6; i++) {
      const a = (i - 2.5) * 0.28;
      b.fx.spawn('spark', m.x + f.facing * 6 * SC, m.y, { vx: f.facing * Math.cos(a) * 2.4, vy: Math.sin(a) * 2.4, life: 14, color: '#ffe066' });
    }
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) {
      if (t % 8 === 4) {
        const m = mouthPos(f);
        b.fx.spawn('spark', m.x + f.facing * 8 * SC, m.y - 1, { vx: f.facing * 2.2, vy: (rand() - 0.5) * 0.8, life: 12, color: '#ffffff' });
        b.addShake(1);
      }
      return;
    }
    const k = t - this.windup;
    s.n = s.n || 0;
    if (k % EVERY === 2 && s.n < COUNT) {
      s.n++;
      const last = s.n === COUNT;
      const d = SWAG[s.n % SWAG.length];
      const h = handPos(f, -64);
      const c = bodyCenter(opp);
      const T = clamp(Math.abs(c.x - h.x) / 6.5, 12, 36) + rand() * 4;
      const v = aimArc(h.x, h.y - 4 * SC, c.x + (rand() - 0.5) * 8, c.y + (rand() - 0.5) * 16, T, G);
      const poof = (bb, x, y) => {
        bb.fx.burst('drop', x, y, 10, { colors: d.burst, speed: 2.4, g: 0.18, life: 20 });
        bb.sfx('bonk', x);
      };
      b.sfx('throw', f.x);
      s.last = b.spawn(new Entity({
        owner: f, x: h.x, y: h.y - 4 * SC, vx: v.vx, vy: v.vy, gravity: G, w: 14 * SC, h: 14 * SC, life: 100, vscale: SC,
        spin: (rand() - 0.5) * 0.3,
        hit: spHit({ damage: SD / COUNT, hitstun: 18, blockstun: 12, push: last ? 4.5 : 1.2, hitstop: last ? 10 : 4, knockdown: last, sfx: 'bonk' }),
        onHit(e, bb) { poof(bb, e.x, e.y); },
        onGround(e, bb) { e.dead = true; poof(bb, e.x, e.y + 4); },
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

function tshirt(c) {
  inked(c, lingrad(c, 0, -6, 0, 7, [[0, '#4f8cff'], [1, '#2250c0']]), (p) => {
    p.moveTo(-3, -6); p.lineTo(-7.4, -3.6); p.lineTo(-5.6, -0.4); p.lineTo(-4, -1.4); p.lineTo(-4, 6.4);
    p.lineTo(4, 6.4); p.lineTo(4, -1.4); p.lineTo(5.6, -0.4); p.lineTo(7.4, -3.6); p.lineTo(3, -6);
    p.quadraticCurveTo(0, -3.6, -3, -6); p.closePath();
  });
  c.fillStyle = '#ffd23f'; // logo patch
  c.fillRect(-2.2, 0.4, 4.4, 3);
  c.fillStyle = '#14101e';
  c.fillRect(-1.2, 1.2, 2.4, 1.2);
}
function cap(c) {
  inked(c, lingrad(c, 0, -6, 0, 3, [[0, '#ff4a5a'], [1, '#b0102a']]), (p) => { p.moveTo(-6, 3); p.quadraticCurveTo(-6.4, -6, 0, -6); p.quadraticCurveTo(6.4, -6, 6, 3); p.closePath(); });
  inked(c, '#8a0c20', (p) => { p.moveTo(2, 2.4); p.quadraticCurveTo(9, 0.6, 9.6, 3.6); p.lineTo(2, 3.8); p.closePath(); }); // brim
  ball(c, 0, -6.4, 1.1, '#ffffff', '#ffffff', '#c9c9d0'); // button
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fillRect(-3.4, -3, 3.6, 1.4);
}
function mug(c) {
  c.strokeStyle = INK; // handle
  c.lineWidth = 2.6;
  c.beginPath(); c.arc(6, 0.4, 3, -1.5, 1.5); c.stroke();
  c.strokeStyle = '#f2f2f2';
  c.lineWidth = 1.2;
  c.beginPath(); c.arc(6, 0.4, 3, -1.5, 1.5); c.stroke();
  inked(c, lingrad(c, -6, 0, 6, 0, [[0, '#ffffff'], [1, '#c8cdd8']]), (p) => p.roundRect(-6, -5.6, 12, 11.4, 1.6));
  c.fillStyle = '#6a3a20'; // coffee
  c.fillRect(-5.2, -4.8, 10.4, 1.6);
  c.fillStyle = '#2f6df0'; // logo stripe
  c.fillRect(-6, -0.6, 12, 3);
}
function tote(c) {
  c.strokeStyle = INK; // straps
  c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(-3.4, -2); c.quadraticCurveTo(-3.4, -8, 0, -8); c.quadraticCurveTo(3.4, -8, 3.4, -2); c.stroke();
  c.strokeStyle = '#c0a070';
  c.lineWidth = 1;
  c.stroke();
  inked(c, lingrad(c, 0, -3, 0, 7, [[0, '#f2e4c0'], [1, '#d8c08c']]), (p) => { p.moveTo(-6.6, -3); p.lineTo(6.6, -3); p.lineTo(5.6, 7); p.lineTo(-5.6, 7); p.closePath(); });
  ball(c, 0, 2.2, 2.6, '#2f6df0', '#8fb4ff', '#1a3a90');
  c.fillStyle = '#ffffff';
  c.fillRect(-0.5, 0.6, 1, 3.2);
}
function sticker(c) {
  c.fillStyle = INK;
  c.beginPath(); c.arc(0, 0, 7.6, 0, 6.3); c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.arc(0, 0, 6.8, 0, 6.3); c.fill();
  const gr = c.createRadialGradient(-1.6, -1.6, 0.6, 0, 0, 5.6);
  gr.addColorStop(0, '#ffe680');
  gr.addColorStop(1, '#ff9a2a');
  c.fillStyle = gr;
  c.beginPath(); c.arc(0, 0, 5.6, 0, 6.3); c.fill();
  c.fillStyle = INK; // a bold "!"
  c.fillRect(-0.9, -3.8, 1.8, 4.6);
  c.fillRect(-0.9, 2, 1.8, 1.8);
  bloomAt(c, 0, 0, 10, '#ffd23f', 0.25);
}
