// YOTAM — had laser eye surgery. Fires laser beams from his eyes.
import { Entity } from '../entities.js';
import { spHit, SD, eyePos, bodyCenter, clamp, VIEW, SC } from './helpers.js';
import { glowLine, bloomAt } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const HITS = 5;

export default {
  windup: 30,
  duration: 50,
  aiRange: [0, 999],
  costume: { eyes: 'laser' },
  anim: (f, t) => ({ pose: 'charge', frame: t > 30 ? 1 : 0 }),

  start(f, b) {
    b.sfx('charge', f.x);
    b.fx.text('LASER EYES!', f.x, f.y - 96 * f.scale, { color: '#ff5050', life: 40 });
  },

  update(f, b, t, opp) {
    const e = eyePos(f);
    if (t < this.windup) {
      // Energy gathering into the eyes
      if (t % 2 === 0) {
        const a = rand() * Math.PI * 2;
        b.fx.spawn('spark', e.x + Math.cos(a) * 18 * SC, e.y + Math.sin(a) * 18 * SC, {
          vx: -Math.cos(a) * 1.6, vy: -Math.sin(a) * 1.6, life: 11, color: rand() < 0.5 ? '#ff3b3b' : '#ffd0d0', size: 2,
        });
      }
      return;
    }
    if (t === this.windup) {
      // Aim once at the opponent's body, but only within a forward cone.
      const c = bodyCenter(opp);
      const dx = Math.max(20, (c.x - e.x) * f.facing);
      const slope = clamp((c.y - e.y) / dx, -0.15, 0.65);
      b.sfx('laser', f.x);
      b.addShake(2);
      const beam = new Entity({
        owner: f, life: this.duration - 4, wallDie: false, maxHits: HITS, hitEvery: 9, dieOnHit: false,
        hit: spHit({ damage: SD / HITS, hitstun: 14, blockstun: 12, push: 1.2, hitstop: 4, sfx: 'zap' }),
        finalHit: { knockdown: true, push: 4.5, hitstop: 10, shake: 5 },
        slope, ex: e.x, ey: e.y,
        onUpdate(en, bb) {
          const ee = eyePos(f);
          en.ex = ee.x;
          en.ey = ee.y;
          // Beam length: until it hits the floor or a wall.
          const toWall = f.facing > 0 ? VIEW.W - ee.x : ee.x;
          const toFloor = en.slope > 0 ? (VIEW.GROUND_Y - ee.y) / en.slope : 9999;
          en.len = Math.min(toWall, toFloor);
          // Hitbox: a small box where the beam crosses the target's x.
          const tgt = bb.opponentOf(f);
          const d = (tgt.x - ee.x) * f.facing;
          if (d > 0 && d < en.len) {
            en.x = tgt.x;
            en.y = ee.y + en.slope * d;
            en.w = 18 * SC;
            en.h = 14 * SC;
          } else {
            en.x = -999;
          }
          if (en.t % 2 === 0) {
            const endX = ee.x + f.facing * en.len, endY = ee.y + en.slope * en.len;
            bb.fx.burst('spark', endX, endY, 2, { colors: ['#fff', '#ff5050', '#ffb0b0'], speed: 2.5, life: 10 });
          }
        },
        draw(ctx, en) {
          const x1 = en.ex + f.facing * en.len, y1 = en.ey + en.slope * en.len;
          const fl = 0.86 + 0.14 * Math.sin(en.t * 1.9);
          const grow = Math.min(1, en.t / 5);
          glowLine(ctx, en.ex, en.ey, en.ex + (x1 - en.ex) * grow, en.ey + (y1 - en.ey) * grow, 3 * SC * fl, { glow: '#ff1a2a', mid: '#ff4a4a', core: '#ffffff' });
          bloomAt(ctx, en.ex, en.ey, 12 * SC, '#ff3b3b', 0.9);
          if (grow >= 1) bloomAt(ctx, x1, y1, (9 + fl * 4) * SC, '#ff6a5a', 0.95);
        },
      });
      f.sd.beam = b.spawn(beam);
    }
  },

  end(f) {
    if (f.sd.beam) f.sd.beam.dead = true;
  },

  draw(ctx, f, b, t) {
    // Glowing eyes during wind-up
    if (t > this.windup) return;
    const e = eyePos(f);
    const k = t / this.windup;
    bloomAt(ctx, e.x, e.y, (6 + k * 16) * SC, '#ff2020', 0.55 + 0.4 * k);
    bloomAt(ctx, e.x, e.y, (3 + k * 5) * SC, '#ffffff', 0.7 * k);
  },
};
