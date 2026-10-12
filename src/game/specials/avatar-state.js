// BEN — "AVATAR STATE": he sits up in the air, his eyes and the arrow on his forehead blaze white, and the four
// elements swirl around him. He throws them at the opponent in turn — air, water, earth — and finishes with a
// huge fireball.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, bodyCenter, clamp, VIEW, SC } from './helpers.js';
import { bloomAt, glowLine, ball, inked } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const LIFT = 26; // how high he floats
const GLOW_AT = 16; // the eyes light up
const AIR_AT = 6, WATER_AT = 28, EARTH_AT = 50, FIRE_AT = 78; // frames after the wind-up
const AIR_DMG = SD * 0.12, WATER_DMG = SD * 0.12, EARTH_DMG = SD * 0.16;
const FIRE_DMG = SD - AIR_DMG - WATER_DMG - EARTH_DMG;
const LAND = 14; // frames he takes to come back down
const ELEMENT = { air: '#d8f4ff', water: '#4fb8ff', earth: '#b98a4a', fire: '#ff8a1e' };

export default {
  windup: 56,
  duration: 190,
  aiRange: [0, 999],
  costume: (f, t) => (t < GLOW_AT ? null : { eyes: 'avatar' }),
  anim(f, t) {
    const s = f.sd;
    if (t < GLOW_AT) return { pose: 'charge', frame: Math.floor(t / 6) % 2 };
    if (s.cast !== undefined && t - s.cast < 10) return { pose: 'cast', frame: 1 };
    return { pose: 'avatar', frame: Math.floor(t / 14) % 2 };
  },

  start(f, b) {
    b.fx.text('...', f.x, f.y - 92 * f.scale, { bubble: true, life: 30 });
    b.sfx('hum', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    const w = this.windup;
    const k = t - w;
    // He floats up while the energy builds, hangs there, and settles back down at the end.
    if (t >= GLOW_AT) {
      const rise = clamp((t - GLOW_AT) / (w - GLOW_AT), 0, 1);
      const fall = s.endAt === undefined ? 0 : clamp((t - s.endAt) / LAND, 0, 1);
      const lift = LIFT * (1 - (1 - rise) * (1 - rise)) * (1 - fall) + Math.sin(t * 0.15) * 1.5 * (1 - fall);
      f.held = true;
      f.grounded = false;
      f.vx = 0;
      f.vy = 0;
      f.y = VIEW.GROUND_Y - Math.max(0, lift);
    }
    if (t === GLOW_AT) {
      b.sfx('charge', f.x);
      b.fx.text('AVATAR STATE!', f.x, f.y - 100 * f.scale, { color: ['#ffffff', '#4fb8ff'], scale: 1.6, life: 64 });
      for (let i = 0; i < 3; i++) b.fx.spawn('ring', f.x, f.y - 40 * f.scale, { size: 10, grow: 3 + i * 1.4, life: 26 + i * 6, color: '#bfefff' });
    }
    if (t >= GLOW_AT && t < w) {
      // light and wind gather around him
      b.fx.spawn('glow', f.x + (rand() - 0.5) * 50 * SC, f.y - rand() * 10, { vy: -1.4 - rand(), life: 32, size: 5, color: '#9fe2ff' });
      if (t % 3 === 0) b.fx.spawn('star', f.x + (rand() - 0.5) * 36 * SC, f.y - 10 - rand() * 70 * SC, { vy: -0.6, life: 24, size: 2, color: '#ffffff' });
    }
    if (t === w - 4) b.sfx('wind', f.x);
    if (t < w) return;
    if (k === 0) {
      f.noPush = true;
      b.sfx('boom', f.x);
      b.fx.burst('star', f.x, f.y - 45 * f.scale, 16, { colors: ['#ffffff', '#9fe2ff'], speed: 4, life: 26 });
    }
    if (k === AIR_AT) air(f, b, opp, s);
    if (k === WATER_AT) water(f, b, opp, s);
    if (k === EARTH_AT) earth(f, b, opp, s);
    if (k === FIRE_AT) s.fire = fire(f, b, opp, s);
    if (s.endAt === undefined && ((s.fire && s.fire.dead) || k > FIRE_AT + 90)) s.endAt = t + 12;
    if (s.endAt !== undefined && t >= s.endAt + LAND) {
      f.grounded = true;
      f.endSpecial(b);
    }
  },

  end(f) {
    f.held = false;
  },

  draw(ctx, f, b, t) {
    if (t < GLOW_AT) return;
    const s = f.sd;
    const a = clamp((t - GLOW_AT) / 14, 0, 1) * (s.endAt === undefined ? 1 : clamp(1 - (t - s.endAt) / LAND, 0, 1));
    const cx = f.x, cy = f.y - 42 * f.scale;
    // a pillar of light and a pulsing aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 * a;
    const gr = ctx.createLinearGradient(0, cy - 120, 0, VIEW.GROUND_Y);
    gr.addColorStop(0, 'rgba(160,220,255,0)');
    gr.addColorStop(0.5, 'rgba(160,220,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0.4)');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - 30, cy - 120, 60, VIEW.GROUND_Y - cy + 120);
    ctx.restore();
    bloomAt(ctx, cx, cy, 56 + Math.sin(t * 0.2) * 5, '#bfe8ff', 0.55 * a);
    bloomAt(ctx, cx, cy, 30, '#ffffff', 0.35 * a);
    // the four elements orbit him
    const cols = [ELEMENT.air, ELEMENT.water, ELEMENT.earth, ELEMENT.fire];
    for (let i = 0; i < 4; i++) {
      const ang = t * 0.1 + (i * Math.PI) / 2;
      const ox = cx + Math.cos(ang) * 34 * SC, oy = cy + Math.sin(ang) * 14 * SC + Math.sin(ang * 2) * 4;
      const front = Math.sin(ang) > 0;
      ctx.save();
      ctx.globalAlpha = a * (front ? 1 : 0.55);
      bloomAt(ctx, ox, oy, 11, cols[i], 0.9);
      ball(ctx, ox, oy, front ? 3.4 : 2.6, cols[i], '#ffffff');
      ctx.restore();
    }
  },
};

/** Where a shot leaves his hand, and its velocity to reach the opponent's body at `speed`. */
function aim(f, opp, speed, dy = 0) {
  const h = handPos(f, -50);
  const c = bodyCenter(opp);
  const T = Math.max(10, Math.abs(opp.x - h.x) / speed);
  return { x: h.x + f.facing * 8, y: h.y, vx: f.facing * speed, vy: (c.y + dy - h.y) / T };
}

function callout(f, b, name, color) {
  f.sd.cast = f.t;
  b.fx.text(name, f.x, f.y - 100 * f.scale, { color: ['#ffffff', color], scale: 1.4, life: 30 });
}

// ---- AIR: a spinning ball of wind -------------------------------------------------------
function air(f, b, opp) {
  callout(f, b, 'AIR!', '#8fdcff');
  b.sfx('whoosh', f.x);
  const v = aim(f, opp, 7);
  b.spawn(new Entity({
    owner: f, x: v.x, y: v.y, vx: v.vx, vy: v.vy, w: 26 * SC, h: 26 * SC, life: 110, wallDie: false,
    hit: spHit({ damage: AIR_DMG, hitstun: 16, blockstun: 12, push: 3, hitstop: 7, shake: 3, sfx: 'whoosh' }),
    onUpdate(e, bb) {
      if (e.t % 2 === 0) bb.fx.spawn('line', e.x - f.facing * (6 + rand() * 12), e.y + (rand() - 0.5) * 22, { life: 10, size: 3, color: '#ffffff', flip: f.facing < 0 });
    },
    onHit(e, bb) { bb.fx.spawn('ring', e.x, e.y, { size: 6, grow: 3, life: 14, color: '#bfefff' }); },
    draw(ctx, e) {
      bloomAt(ctx, e.x, e.y, 24, '#bfefff', 0.65);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 0.45 * f.facing);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.strokeStyle = 'rgba(210,240,255,0.95)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 10, -0.2, 2.1);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0.4, 2.6);
        ctx.stroke();
      }
      ctx.restore();
    },
  }));
}

// ---- WATER: an orb dragging a ribbon of water -----------------------------------------------
function water(f, b, opp) {
  callout(f, b, 'WATER!', '#4fb8ff');
  b.sfx('splash', f.x);
  const v = aim(f, opp, 6.4);
  b.spawn(new Entity({
    owner: f, x: v.x, y: v.y, vx: v.vx, vy: v.vy, w: 22 * SC, h: 22 * SC, life: 110, wallDie: false,
    hit: spHit({ damage: WATER_DMG, hitstun: 16, blockstun: 12, push: 3.4, hitstop: 7, shake: 3, sfx: 'splash' }),
    onUpdate(e, bb) {
      if (e.t % 2 === 0) bb.fx.spawn('drop', e.x - f.facing * 8, e.y + (rand() - 0.5) * 8, { vy: -0.3, g: 0.12, life: 18, color: rand() < 0.5 ? '#9fe2ff' : '#ffffff' });
    },
    onHit(e, bb) { bb.fx.burst('drop', e.x, e.y, 14, { colors: ['#9fe2ff', '#ffffff', '#4fb8ff'], speed: 3.4, g: 0.18, life: 24 }); },
    draw(ctx, e) {
      const sp = Math.hypot(e.vx, e.vy) || 1;
      const ux = -e.vx / sp, uy = -e.vy / sp; // backwards along the flight
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [lw, col] of [[5, 'rgba(60,150,240,0.75)'], [2.2, 'rgba(210,245,255,0.95)']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const d = i * 4.2, wob = Math.sin(e.t * 0.4 - i * 0.8) * (1 + i * 0.5);
          const x = e.x + ux * d - uy * wob, y = e.y + uy * d + ux * wob;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      bloomAt(ctx, e.x, e.y, 20, '#4fb8ff', 0.5);
      ball(ctx, e.x, e.y, 8, '#3aa0ff', '#d6f2ff', '#1450b0');
    },
  }));
}

// ---- EARTH: rock spikes burst up out of the floor beneath them ---------------------------------
function earth(f, b, opp) {
  callout(f, b, 'EARTH!', '#d6a35a');
  b.sfx('thud', opp.x);
  const WARN = 14; // frames of rumbling before the rocks come up
  b.spawn(new Entity({
    owner: f, x: opp.x, y: VIEW.GROUND_Y, w: 44, h: 4, life: 44, wallDie: false, active: false, maxHits: 1, dieOnHit: false, layer: 1,
    hit: spHit({ damage: EARTH_DMG, hitstun: 30, blockstun: 14, push: 1.5, hitstop: 10, shake: 6, sfx: 'smash' }),
    onUpdate(e, bb) {
      if (e.t < WARN) {
        e.x += (opp.x - e.x) * 0.3; // it tracks them while it rumbles
        if (e.t % 2 === 0) bb.fx.spawn('dust', e.x + (rand() - 0.5) * 40, VIEW.GROUND_Y - 2, { vy: -0.6, size: 3, grow: 0.2, life: 16, color: '#b9a27a' });
        return;
      }
      if (e.t === WARN) {
        bb.sfx('smash', e.x);
        bb.fx.burst('chunk', e.x, VIEW.GROUND_Y - 6, 8, { colors: ['#8a6a3a', '#b98a4a', '#5a4428'], speed: 4, g: 0.25, life: 28, size: 2.5 });
        bb.fx.burst('dust', e.x, VIEW.GROUND_Y - 4, 8, { color: '#d8cdb0', size: 4, speed: 2.4, life: 22 });
      }
      const up = clamp((e.t - WARN) / 6, 0, 1), down = clamp((e.life - 8) / 8, 0, 1);
      e.h = 4 + 78 * Math.min(up, down);
      e.y = VIEW.GROUND_Y - e.h / 2;
      e.active = e.t >= WARN && e.t < WARN + 8;
    },
    draw(ctx, e) {
      if (e.t < WARN) {
        // cracks spreading along the floor
        ctx.save();
        ctx.strokeStyle = '#2a1d10';
        ctx.lineWidth = 1.2;
        const r = 8 + e.t * 1.6;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(e.x + i * 3, VIEW.GROUND_Y + 2);
          ctx.lineTo(e.x + i * r * 0.45, VIEW.GROUND_Y + 2 + Math.abs(i) * 1.4 + 1);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      const H = e.h;
      for (const [dx, k, w] of [[-14, 0.62, 13], [14, 0.7, 13], [0, 1, 17]]) {
        const h = H * k;
        inked(ctx, '#9a7440', (c) => {
          c.moveTo(e.x + dx - w, VIEW.GROUND_Y + 1);
          c.lineTo(e.x + dx - w * 0.35, VIEW.GROUND_Y - h);
          c.lineTo(e.x + dx + w * 0.25, VIEW.GROUND_Y - h * 0.9);
          c.lineTo(e.x + dx + w, VIEW.GROUND_Y + 1);
          c.closePath();
        }, 1.1);
        inked(ctx, '#c9a060', (c) => {
          c.moveTo(e.x + dx - w * 0.55, VIEW.GROUND_Y);
          c.lineTo(e.x + dx - w * 0.3, VIEW.GROUND_Y - h * 0.9);
          c.lineTo(e.x + dx + w * 0.02, VIEW.GROUND_Y - h * 0.6);
          c.lineTo(e.x + dx - w * 0.05, VIEW.GROUND_Y);
          c.closePath();
        }, 0);
      }
    },
  }));
}

// ---- FIRE: the finale, a huge fireball ------------------------------------------------------------
function fire(f, b, opp) {
  callout(f, b, 'FIRE!', '#ff8a1e');
  b.sfx('flames', f.x);
  const v = aim(f, opp, 6.6);
  return b.spawn(new Entity({
    owner: f, x: v.x, y: v.y, vx: v.vx, vy: v.vy, w: 44 * SC, h: 44 * SC, life: 130, wallDie: false,
    hit: spHit({ damage: FIRE_DMG, hitstun: 30, blockstun: 18, knockdown: true, launch: 6, push: 6.5, hitstop: 14, shake: 9, sfx: 'smash' }),
    onUpdate(e, bb) {
      bb.fx.spawn('fire', e.x - f.facing * (6 + rand() * 12), e.y + (rand() - 0.5) * 22, { vy: -0.5 - rand() * 0.6, life: 20, size: 8 });
      if (e.t % 3 === 0) bb.fx.spawn('ember', e.x - f.facing * rand() * 18, e.y + (rand() - 0.5) * 26, { vx: -f.facing * rand(), vy: -rand() * 1.2, life: 22, color: '#ffd27a' });
      const out = (f.facing > 0 && e.x > VIEW.RIGHT + 30) || (f.facing < 0 && e.x < VIEW.LEFT - 30);
      if (out) e.dead = true;
    },
    onHit(e, bb) { blast(bb, e.x, e.y); },
    draw(ctx, e) {
      const p = 0.5 + 0.5 * Math.sin(e.t * 0.6);
      // flame tongues streaming back
      for (let i = 0; i < 4; i++) {
        const oy = (i - 1.5) * 8 + Math.sin(e.t * 0.5 + i * 2) * 2, len = 34 + i % 2 * 12 + p * 6;
        glowLine(ctx, e.x, e.y + oy * 0.6, e.x - f.facing * len, e.y + oy, 4.6 - i * 0.5, { glow: '#ff3a14', mid: '#ff8a1e', core: '#fff0a0', a: 0.9 });
      }
      bloomAt(ctx, e.x, e.y, 46, '#ff6a14', 0.6);
      bloomAt(ctx, e.x, e.y, 28, '#ffd27a', 0.8);
      ball(ctx, e.x, e.y, 15 + p * 2, '#ff8a1e', '#fff6c0', '#d6320c');
      bloomAt(ctx, e.x, e.y, 12, '#ffffff', 0.9);
    },
  }));
}

function blast(b, x, y) {
  b.sfx('boom', x);
  b.fx.burst('fire', x, y, 14, { speed: 3.4, life: 26, size: 9 });
  b.fx.burst('spark', x, y, 16, { colors: ['#ffd27a', '#ff8a1e', '#ffffff'], speed: 5, g: 0.1, life: 28 });
  for (let i = 0; i < 2; i++) b.fx.spawn('ring', x, y, { size: 8, grow: 3.6 + i * 1.6, life: 22 + i * 6, color: '#ffb04a' });
}
