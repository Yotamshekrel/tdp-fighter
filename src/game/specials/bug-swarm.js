// YOVEL — loves bugs. Releases a swarm of ants and beetles that crawl all
// over you. Bugs come along the ground: block LOW (crouch + defend)!
import { Entity } from '../entities.js';
import { spHit, SD, VIEW, SC } from './helpers.js';
import { INK } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const HITS = 6;
const BUG_COLORS = ['#2a1818', '#2a1818', '#5a2d14', '#3f8a2a', '#c42a2a'];

export default {
  windup: 30,
  duration: 140,
  aiRange: [0, 999],
  guard: 'low', // hint for the CPU: block this crouching
  costume(f) {
    return { hat: 'safari', prop: f.sd.released ? null : 'jar' };
  },
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: 0 };
    return { pose: 'cast', frame: 1 };
  },

  start(f, b) {
    b.fx.text('GO, MY BABIES!', f.x, f.y - 96 * f.scale, { bubble: true, life: 44 });
    b.sfx('bugs', f.x);
  },

  update(f, b, t) {
    const s = f.sd;
    if (t === this.windup) {
      s.released = true;
      const bugs = [];
      for (let i = 0; i < 28; i++) {
        bugs.push({ ox: (rand() - 0.5) * 34, oy: -rand() * 6, ph: rand() * 6.28, c: BUG_COLORS[i % BUG_COLORS.length], big: i % 5 === 3, climb: rand() });
      }
      s.swarm = b.spawn(new Entity({
        owner: f, x: f.x + f.facing * 20 * SC, y: VIEW.GROUND_Y - 7 * SC, vx: f.facing * 3.2, w: 34 * SC, h: 14 * SC,
        life: 170, maxHits: HITS, hitEvery: 9, dieOnHit: false, bugs, attached: null, climbT: 0,
        hit: spHit({ damage: SD / HITS, guard: 'low', hitstun: 16, blockstun: 12, push: 0.6, hitstop: 3, sfx: 'bugs' }),
        finalHit: { knockdown: true, push: 4, shake: 4 },
        onUpdate(e, bb) {
          if (e.attached) {
            e.x = e.attached.x;
            e.climbT = Math.min(1, e.climbT + 0.05);
            e.h = (14 + 56 * e.climbT) * SC;
            e.y = VIEW.GROUND_Y - e.h / 2;
            if (e.hits >= HITS || e.attached.state === 'ko') {
              e.dead = true;
              bb.fx.burst('spark', e.x, e.y, 16, { colors: BUG_COLORS, speed: 3, g: 0.2, life: 24 });
            }
          }
          if (e.t % 8 === 0) bb.sfx('bugs', e.x);
        },
        onHit(e, bb, tgt) {
          e.attached = tgt;
          e.vx = 0;
          e.life = Math.max(e.life, 90);
        },
        draw(ctx, e) {
          for (const g of e.bugs) {
            const wig = Math.sin(e.t * 0.6 + g.ph);
            let x, y;
            if (e.attached) {
              const h = g.climb * 60 * SC * e.climbT;
              x = e.x + g.ox * 0.6 * SC + wig * 2;
              y = VIEW.GROUND_Y - 2 - h + Math.sin(e.t * 0.2 + g.ph) * 3;
            } else {
              x = e.x + g.ox * SC + wig;
              y = VIEW.GROUND_Y - 2 + g.oy;
            }
            drawBug(ctx, x, y, g, e.t, f.facing);
          }
        },
      }));
    }
    if (s.swarm && s.swarm.dead && t > this.windup + 10) {
      if (!s.endT) s.endT = t;
      if (t - s.endT > 10) f.endSpecial(b);
    }
  },

  end(f) {
    if (f.sd.swarm) f.sd.swarm.dead = true;
  },
};

function drawBug(ctx, x, y, g, t, dir) {
  const leg = Math.sin(t * 0.7 + g.ph);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * SC, SC);
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.55;
  const k = g.big ? 1 : 0.8;
  // legs
  for (const lx of g.big ? [-2.6, 0, 2.6] : [-2, 0.6, 3]) {
    ctx.beginPath();
    ctx.moveTo(lx, -1.2);
    ctx.lineTo(lx + leg * 1.2, 1);
    ctx.stroke();
  }
  if (g.big) {
    // beetle: glossy shell, head, antennae
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(-0.4, -2.6, 4.6, 3.2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = g.c;
    ctx.beginPath();
    ctx.ellipse(-0.4, -2.6, 4, 2.7, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-1.4, -3.6, 1.5, 0.7, -0.3, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(4.4, -2.6, 1.5, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5.4, -3.4);
    ctx.lineTo(7.2, -5.2);
    ctx.moveTo(5.4, -1.8);
    ctx.lineTo(7.4, -2.2);
    ctx.stroke();
  } else {
    // ant: head, thorax, abdomen
    ctx.fillStyle = g.c;
    for (const [bx, by, r] of [[-2.6, -1.8, 1.5 * k], [0.2, -1.8, 1.1 * k], [2.6, -2.2, 1.2 * k]]) {
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, 6.3);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(3.4, -3);
    ctx.lineTo(4.8, -4.4);
    ctx.stroke();
  }
  ctx.restore();
}
