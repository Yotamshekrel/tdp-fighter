// YAIR — loves the AC on max cold. Summons a giant air conditioner: an icy
// blast freezes you, then the whole unit slams down on your head.
import { Entity } from '../entities.js';
import { spHit, SD, VIEW, SC } from './helpers.js';
import { bloomAt, inked, lingrad } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const WIND_HITS = 4;
const WIND_DMG = SD * 0.55;
const SLAM_DMG = SD - WIND_DMG;
const WIND_T = 44;

export default {
  windup: 30,
  duration: 130,
  aiRange: [0, 999],
  costume: { hat: 'beanie', scarf: 'blue' },
  anim(f, t) {
    return { pose: t < this.windup ? 'raise' : 'cast', frame: 1 };
  },

  start(f, b) {
    b.fx.text('BRRRRR!', f.x, f.y - 100 * f.scale, { color: '#bfe9ff', scale: 2, life: 40 });
    b.sfx('hum', f.x);
    // The AC unit: cosmetic until it slams.
    f.sd.ac = b.spawn(new Entity({
      owner: f, x: f.x - f.facing * 10 * SC, y: f.y - 134 * SC, w: 48 * SC, h: 24 * SC, life: 400, wallDie: false, active: false, vscale: SC,
      appear: 0, dir: f.facing,
      hit: spHit({ damage: SLAM_DMG, knockdown: true, push: 3, hitstop: 14, shake: 8, sfx: 'smash' }),
      onUpdate(e) { e.appear = Math.min(1, e.appear + 0.06); },
      onGround(e, bb) {
        if (e.landed) return;
        e.landed = true;
        e.active = false;
        bb.addShake(6);
        bb.sfx('smash', e.x);
        bb.fx.burst('dust', e.x, VIEW.GROUND_Y - 4, 14, { color: '#e8f4ff', size: 5, speed: 3, life: 22 });
        bb.fx.burst('flake', e.x, e.y, 10, { color: '#ffffff', speed: 3, life: 30 });
      },
      draw(ctx, e) { drawAC(ctx, e.x, e.y, e.dir, e.appear, e.t); },
    }));
  },

  update(f, b, t, opp) {
    const s = f.sd;
    const ac = s.ac;
    if (t < this.windup) return;
    if (t === this.windup) {
      b.sfx('wind', f.x);
      s.wind = b.spawn(new Entity({
        owner: f, life: WIND_T, wallDie: false, maxHits: WIND_HITS, hitEvery: 10, dieOnHit: false,
        hit: spHit({ damage: WIND_DMG / WIND_HITS, hitstun: 26, blockstun: 14, push: 2.2, hitstop: 3, sfx: 'wind' }),
        onUpdate(e, bb) {
          // Cone of cold air from the AC to the far wall
          const x0 = ac.x + f.facing * 20 * SC;
          const x1 = f.facing > 0 ? VIEW.RIGHT + 20 : VIEW.LEFT - 20;
          e.x = (x0 + x1) / 2;
          e.w = Math.abs(x1 - x0);
          e.y = VIEW.GROUND_Y - 50 * SC;
          e.h = 100 * SC;
          for (let i = 0; i < 3; i++) {
            bb.fx.spawn(rand() < 0.3 ? 'flake' : 'line', x0, ac.y + (rand() * 30 - 5) * SC, {
              vx: f.facing * (5 + rand() * 3), vy: 0.9 + rand() * 1.4, life: 50, size: 2, color: rand() < 0.5 ? '#ffffff' : '#bfe9ff',
            });
          }
        },
        onHit(e, bb, tgt) { tgt.frozen = 70; },
        // a cold, pale haze fanning out of the unit
        draw(ctx, e) {
          const x0 = ac.x + f.facing * 20 * SC;
          const x1 = f.facing > 0 ? VIEW.RIGHT + 20 : VIEW.LEFT - 20;
          const gr = ctx.createLinearGradient(x0, 0, x1, 0);
          gr.addColorStop(0, 'rgba(190,235,255,0.5)');
          gr.addColorStop(1, 'rgba(190,235,255,0)');
          ctx.save();
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.moveTo(x0, ac.y + 4 * SC);
          ctx.lineTo(x1, VIEW.GROUND_Y - 130 * SC);
          ctx.lineTo(x1, VIEW.GROUND_Y);
          ctx.lineTo(x0, ac.y + 14 * SC);
          ctx.fill();
          ctx.restore();
        },
      }));
    }
    // Slam: AC flies over the opponent, then drops
    if (t === this.windup + WIND_T) {
      s.slam = true;
      b.fx.text('SLAM!', opp.x, opp.y - 110 * SC, { color: '#bfe9ff', life: 30 });
    }
    if (s.slam && !ac.dropping) {
      ac.x += (opp.x - ac.x) * 0.25;
      ac.y += (VIEW.GROUND_Y - 156 * SC - ac.y) * 0.25;
      if (Math.abs(opp.x - ac.x) < 4) {
        ac.dropping = true;
        ac.active = true;
        ac.gravity = 1.3;
        ac.vy = 2;
      }
    }
    if (ac.landed) {
      if (!s.landT) s.landT = t;
      if (t - s.landT > 20) f.endSpecial(b);
    }
  },

  end(f) {
    if (f.sd.ac) f.sd.ac.dead = true;
    if (f.sd.wind) f.sd.wind.dead = true;
  },
};

/** The wall-unit air conditioner (about 48 x 15), centred on x, y. */
function drawAC(ctx, x, y, dir, appear, t) {
  if (appear < 1 && Math.floor(t / 2) % 2) return; // flicker in
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const body = lingrad(ctx, 0, -8, 0, 8, [[0, '#ffffff'], [0.55, '#e3ecf8'], [1, '#aebbd2']]);
  inked(ctx, body, (c) => {
    c.moveTo(-23, -7); c.lineTo(23, -7); c.quadraticCurveTo(24.5, -7, 24.5, -5.5); c.lineTo(24.5, 4.5); c.quadraticCurveTo(24.5, 8, 21, 8); c.lineTo(-21, 8); c.quadraticCurveTo(-24.5, 8, -24.5, 4.5); c.lineTo(-24.5, -5.5); c.quadraticCurveTo(-24.5, -7, -23, -7);
  }, 0.9);
  // top grille lines
  ctx.strokeStyle = 'rgba(120,140,170,0.6)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-20, -5 + i * 1.6);
    ctx.lineTo(18, -5 + i * 1.6);
    ctx.stroke();
  }
  // louvre flap
  inked(ctx, lingrad(ctx, 0, 1, 0, 6, [[0, '#9aa8c0'], [1, '#6b7a94']]), (c) => {
    c.moveTo(-20, 2); c.lineTo(20, 2); c.lineTo(22, 6.2); c.lineTo(-22, 6.2);
  }, 0.6);
  // cold air slits and the display
  ctx.fillStyle = 'rgba(150,220,255,0.9)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-14 + i * 5, 3.4, 3, 0.7);
  ctx.fillStyle = '#0a1a2c';
  ctx.fillRect(13, -4.4, 8, 3.8);
  ctx.fillStyle = '#4fd0ff';
  ctx.fillRect(14, -3.6, 1.2, 2.2);
  ctx.fillRect(16, -3.6, 1.2, 2.2);
  ctx.fillRect(18, -3.6, 2, 0.7);
  ctx.restore();
  bloomAt(ctx, x + dir * 15, y - 2.5, 8, '#4fd0ff', 0.5);
}
