// DVIR — the surfer. Rides a surfboard on a giant wave that sweeps the screen.
import { Entity } from '../entities.js';
import { spHit, SD, VIEW, SC } from './helpers.js';
import { bloomAt, inked, lingrad } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const HITS = 3;
const WAVE_H = 62 * SC;

export default {
  windup: 30,
  duration: 120,
  aiRange: [0, 999],
  costume: { shirt: '#14a3c7', shirt2: '#0b5f8a', hat: 'shades' },
  anim(f, t) {
    return { pose: 'surf', frame: Math.floor(t / 10) % 2 };
  },

  start(f, b) {
    b.fx.text('COWABUNGA!', f.x, f.y - 96 * f.scale, { color: '#7de7ff', life: 44 });
    b.sfx('wave', f.x);
  },

  update(f, b, t) {
    const s = f.sd;
    if (t < this.windup) {
      // Water rising behind him
      b.fx.spawn('drop', f.x - f.facing * (10 + rand() * 20) * SC, f.y - 2, { vy: -2 - rand() * 3, vx: (rand() - 0.5), g: 0.2, life: 20, color: rand() < 0.5 ? '#7de7ff' : '#ffffff' });
      return;
    }
    if (t === this.windup) {
      s.wave = b.spawn(new Entity({
        owner: f, x: f.x - f.facing * 10 * SC, y: VIEW.GROUND_Y - WAVE_H / 2, vx: f.facing * 4.4,
        w: 52 * SC, h: WAVE_H, life: 200, layer: 1, wallDie: false, maxHits: HITS, hitEvery: 11, dieOnHit: false,
        hit: spHit({ damage: SD / HITS, hitstun: 22, push: 4, sfx: 'splash' }),
        finalHit: { knockdown: true, push: 6, launch: 6, shake: 5 },
        onUpdate(e, bb) {
          if (e.crash) {
            e.vx = 0;
            e.h = Math.max(4, e.h - 4);
            e.y = VIEW.GROUND_Y - e.h / 2;
            e.active = false;
            if (e.h <= 4) e.dead = true;
            return;
          }
          const atWall = (f.facing > 0 && e.x > VIEW.RIGHT - 16) || (f.facing < 0 && e.x < VIEW.LEFT + 16);
          if (atWall) {
            e.vx = 0;
            e.wallT = (e.wallT || 0) + 1;
          }
          if (e.wallT > 30 || e.t > 150 || e.hits >= HITS) {
            e.crash = true;
            bb.fx.burst('drop', e.x, e.y - 20, 30, { colors: ['#7de7ff', '#ffffff', '#2f8fd8'], speed: 4, g: 0.25, life: 30 });
            bb.sfx('splash', e.x);
          }
          if (e.t % 2 === 0) bb.fx.spawn('drop', e.x + f.facing * 20 * SC, e.y - WAVE_H / 2 + 4, { vx: f.facing * (1 + rand() * 2), vy: -1 - rand() * 2, g: 0.2, life: 18, color: '#ffffff' });
        },
        onHit(e, bb, tgt) {
          if (e.hits < HITS) tgt.vx = e.vx * 1.1; // carried along by the wave
        },
        draw(ctx, e) {
          drawWave(ctx, e.x, VIEW.GROUND_Y, e.h, f.facing, e.t);
        },
      }));
      f.held = true; // ride the wave (we position him ourselves)
    }
    const w = s.wave;
    if (w && !w.dead && !w.crash) {
      f.x = Math.max(VIEW.LEFT, Math.min(VIEW.RIGHT, w.x + f.facing * 4 * SC));
      f.y = VIEW.GROUND_Y - w.h + 6 * SC + Math.sin(t * 0.3) * 1.5;
      f.grounded = false;
      f.vx = w.vx;
      f.vy = 0;
    } else if (w) {
      // Wave crashed: jump off and land
      if (f.held) {
        f.held = false;
        f.vy = -3;
        f.vx = -f.facing * 1.5;
      }
      if (f.grounded) f.endSpecial(b);
    }
  },

  end(f) {
    f.held = false;
    if (f.sd.wave && !f.sd.wave.dead) f.sd.wave.crash = true;
  },

  draw(ctx, f, b, t) {
    if (t < this.windup || !f.held) return;
    // Surfboard under his feet
    const x = f.x, y = f.y;
    ctx.save();
    ctx.translate(x, y + 1);
    ctx.scale(SC, SC);
    inked(ctx, lingrad(ctx, 0, -2, 0, 3, [[0, '#fff3b0'], [0.5, '#ffd23f'], [1, '#d99a10']]), (c) => {
      c.moveTo(-23, 1); c.quadraticCurveTo(-20, -2.4, -6, -2.2); c.lineTo(10, -2.2); c.quadraticCurveTo(24, -1.6, 27, 1); c.quadraticCurveTo(22, 4, 8, 3.6); c.lineTo(-8, 3.6); c.quadraticCurveTo(-19, 3.6, -23, 1);
    }, 0.8);
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(-3, -2.2, 5, 5.6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-18, -1.2, 36, 0.7);
    ctx.restore();
  },
};

/** The big wave: a curling crest of foam over layered, glassy water. */
export function drawWave(ctx, cx, groundY, h, dir, t) {
  const Wd = 64 * SC;
  const N = 48;
  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(dir, 1); // draw as if travelling right, mirrored when travelling left
  // body
  const top = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N; // 0 = back, 1 = front
    const colH = h * (0.3 + 0.7 * Math.pow(u, 0.75)) + Math.sin(i * 0.5 + t * 0.4) * 1.6;
    top.push([-Wd / 2 + u * Wd, -colH]);
  }
  ctx.beginPath();
  ctx.moveTo(-Wd / 2, 0);
  for (const [x, y] of top) ctx.lineTo(x, y);
  // curling lip at the front
  const [fx, fy] = top[N];
  ctx.quadraticCurveTo(fx + 12 * SC, fy - 2 * SC, fx + 9 * SC, fy + 11 * SC);
  ctx.quadraticCurveTo(fx + 3 * SC, fy + 4 * SC, fx - 2 * SC, fy + 9 * SC);
  ctx.lineTo(fx, 0);
  ctx.closePath();
  ctx.fillStyle = lingrad(ctx, 0, -h, 0, 0, [[0, '#6fd6ff'], [0.35, '#2f9be0'], [1, '#14509a']]);
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(8,40,90,0.85)';
  ctx.stroke();
  // glassy bands
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const [x, y] = top[i];
      const yy = y + (k + 1) * (h * 0.16) + Math.sin(i * 0.4 - t * 0.2 + k) * 1.4;
      if (i) ctx.lineTo(x, yy);
      else ctx.moveTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  // foam along the crest
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const [x, y] = top[i];
    const yy = y + Math.sin(i * 0.9 + t * 0.5) * 1;
    if (i) ctx.lineTo(x, yy);
    else ctx.moveTo(x, yy);
  }
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const [x, y] = top[Math.floor((i / 9) * N)];
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + Math.sin(t * 0.3 + i) * 1.5, y + 1 + (i % 3), 1.5 + (i % 2), 0, 6.3);
    ctx.fill();
  }
  ctx.restore();
  bloomAt(ctx, cx + dir * (Wd / 2 - 6 * SC), groundY - h, 18 * SC, '#bff4ff', 0.35);
}
