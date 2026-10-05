// SHAY — loves singing. Mic out, giant speakers up: sound waves blast you back.
import { Entity } from '../entities.js';
import { spHit, SD, mouthPos, VIEW, SC } from './helpers.js';
import { bloomAt, inked, lingrad, INK } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const WAVES = 4;
const EVERY = 12;

export default {
  windup: 30,
  duration: 100,
  aiRange: [0, 999],
  costume: { hat: 'shades', prop: 'mic' },
  anim(f, t) {
    return { pose: 'sing', frame: Math.floor(t / 8) % 2 };
  },

  start(f, b) {
    b.fx.text('LA LA LAAA!', f.x, f.y - 98 * f.scale, { color: '#c9a0ff', life: 44 });
    b.sfx('sing', f.x);
    f.sd.speakers = [-1, 1].map((side) =>
      b.spawn(new Entity({
        owner: f, x: f.x + side * 38 * SC, y: VIEW.GROUND_Y, life: 400, layer: 0, active: false, wallDie: false, rise: 0, pulse: 0,
        onUpdate(e) { e.rise = Math.min(1, e.rise + 0.08); if (e.pulse > 0) e.pulse--; },
        draw(ctx, e) { drawSpeaker(ctx, e.x, e.y, e.rise, e.pulse); },
      })),
    );
  },

  update(f, b, t) {
    const s = f.sd;
    if (t % 6 === 0) {
      b.fx.spawn('note', f.x + (rand() - 0.5) * 60 * SC, f.y - (80 + rand() * 20) * SC, { vy: -0.7, vx: (rand() - 0.5) * 0.6, life: 40, color: rand() < 0.5 ? '#c9a0ff' : '#ffe066' });
    }
    if (t < this.windup) return;
    const k = t - this.windup;
    s.n = s.n || 0;
    if (k % EVERY === 0 && s.n < WAVES) {
      s.n++;
      const last = s.n === WAVES;
      const m = mouthPos(f);
      for (const sp of s.speakers) sp.pulse = 6;
      b.addShake(2);
      b.sfx('boomwave', f.x);
      s.last = b.spawn(new Entity({
        owner: f, x: m.x + f.facing * 10 * SC, y: f.y - 46 * SC, vx: f.facing * 5.5, w: 14 * SC, h: 76 * SC, life: 90,
        hit: spHit({ damage: SD / WAVES, hitstun: 22, blockstun: 14, push: last ? 7 : 3, hitstop: last ? 12 : 5, knockdown: last, shake: last ? 6 : 2, sfx: 'boomwave' }),
        draw(ctx, e) {
          // concentric sound arcs, the front one brightest
          const r = (14 + Math.min(e.t, 20)) * SC;
          const cx = e.x - f.facing * r;
          const a0 = f.facing > 0 ? -0.85 : Math.PI - 0.85;
          ctx.save();
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const rr = r - i * 6 * SC;
            ctx.beginPath();
            ctx.arc(cx - f.facing * i * 6 * SC, e.y, rr, a0, a0 + 1.7);
            ctx.globalAlpha = 1 - i * 0.28;
            ctx.strokeStyle = '#a070ff';
            ctx.lineWidth = 4.4 - i;
            ctx.stroke();
            ctx.strokeStyle = i === 0 ? '#ffffff' : '#e0ccff';
            ctx.lineWidth = 1.8 - i * 0.4;
            ctx.stroke();
          }
          ctx.restore();
          bloomAt(ctx, e.x, e.y, 26 * SC, '#a070ff', 0.5);
        },
      }));
    }
    if (s.n >= WAVES && k > WAVES * EVERY + 30) f.endSpecial(b);
  },

  end(f) {
    for (const sp of f.sd.speakers || []) sp.dead = true;
  },
};

/** A tall stage speaker with a big woofer and a tweeter that thumps with the music. */
function drawSpeaker(ctx, x, groundY, rise, pulse) {
  const Hh = 50 * rise * SC;
  if (Hh < 3) return;
  const Wd = 25 * SC;
  const top = groundY - Hh;
  const left = x - Wd / 2;
  ctx.save();
  inked(ctx, lingrad(ctx, left, 0, left + Wd, 0, [[0, '#3c3c4e'], [0.5, '#2a2a38'], [1, '#1c1c28']]), (c) => c.roundRect(left, top, Wd, Hh, 2.4), 1);
  if (Hh > 34 * SC) {
    const p = pulse > 3 ? 1.2 : 0;
    const cx = x;
    const wy = top + Hh * 0.62;
    // woofer
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, wy, 8.4 * SC + p, 0, 6.3);
    ctx.fill();
    const wg = ctx.createRadialGradient(cx - 2, wy - 2, 1, cx, wy, 7.4 * SC + p);
    wg.addColorStop(0, '#8a8aa2');
    wg.addColorStop(1, '#3c3c50');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.arc(cx, wy, 7.4 * SC + p, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, wy, 2.6 * SC, 0, 6.3);
    ctx.fill();
    // tweeter
    const ty = top + Hh * 0.2;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, ty, 3.8 * SC + p * 0.4, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#a0a0b8';
    ctx.beginPath();
    ctx.arc(cx, ty, 2.2 * SC, 0, 6.3);
    ctx.fill();
    if (p) bloomAt(ctx, cx, wy, 18 * SC, '#a070ff', 0.5);
  }
  ctx.restore();
}
