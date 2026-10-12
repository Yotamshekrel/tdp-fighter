// AYOUB — "FLOOD OF TEARS": he bursts into tears, and keeps going. Streams of tears arc across the
// arena into the opponent while a column of water rises around them, until their head goes under
// and the whole thing bursts over them in a drowning wave.
import { Entity } from '../entities.js';
import { spHit, SD, eyePos, bodyCenter, aimArc, clamp, VIEW, SC } from './helpers.js';
import { bloomAt, ball } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const TEARS = 12;
const EVERY = 4; // frames between tears
const TEAR_DMG = SD * 0.05;
const FINALE_DMG = SD - TEAR_DMG * TEARS;
const RISE_FROM = 14; // the water starts to rise (frames after the wind-up)
const DROWN_AT = TEARS * EVERY + 22; // the water is over their head: it bursts
const END_AT = DROWN_AT + 30;
const WATER = ['#9fe2ff', '#ffffff', '#4fb8ff'];

export default {
  windup: 34,
  duration: 130,
  aiRange: [0, 999],
  costume: { eyes: 'cry' },
  anim(f, t) {
    return { pose: 'cry', frame: Math.floor(t / 5) % 2 };
  },

  start(f, b) {
    b.fx.text('WAAAAAH!', f.x, f.y - 96 * f.scale, { bubble: true, life: 48 });
    b.sfx('sing', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    // tears streaming off his face the whole time
    const e = eyePos(f);
    if (t % 2 === 0) {
      for (const dx of [-3, 3]) {
        b.fx.spawn('drop', e.x + f.facing * (dx + 3) * SC, e.y + 3 * SC, {
          vx: f.facing * (0.4 + rand() * 0.9), vy: -0.2 + rand() * 0.6, g: 0.16, life: 26, color: WATER[rand() < 0.5 ? 0 : 1],
        });
      }
    }
    if (t < this.windup) return;
    const k = t - this.windup;
    if (k === 0) {
      b.sfx('wave', opp.x);
      s.n = 0;
      s.flood = b.spawn(new Entity({
        owner: f, x: opp.x, y: VIEW.GROUND_Y, w: 4, h: 4, life: 400, layer: 1, wallDie: false, level: 0, big: 76 * opp.scale + 14,
        onUpdate(en) {
          if (f.state !== 'special') en.dead = true;
          en.x += (opp.x - en.x) * 0.25;
        },
        draw(ctx, en) {
          drawColumn(ctx, en);
        },
      }));
    }
    if (k === 22) b.fx.text("WHERE'S MY OWL?!", f.x, f.y - 98 * f.scale, { bubble: true, life: 40 });
    if (!s.drowned && s.n < TEARS && k % EVERY === 0) {
      tear(f, b, opp, e);
      s.n++;
    }
    if (!s.drowned) {
      s.flood.level = clamp((k - RISE_FROM) / (DROWN_AT - RISE_FROM), 0, 1);
      if (k % 6 === 0 && s.flood.level > 0) b.sfx('splash', opp.x);
      if (k >= DROWN_AT) drown(f, b, opp, s);
    } else {
      s.flood.level = clamp(1 - (k - DROWN_AT) / 10, 0, 1); // the column bursts
    }
    if (k >= END_AT) f.endSpecial(b);
  },

  end(f) {
    if (f.sd.flood) f.sd.flood.dead = true;
  },
};

/** One tear, thrown from his eye in an arc onto the opponent. */
function tear(f, b, opp, e) {
  const T = 22;
  const g = 0.12;
  const c = bodyCenter(opp);
  const tx = clamp(opp.x + (opp.vx || 0) * T * 0.5 + (rand() - 0.5) * 40, 20, VIEW.W - 20);
  const v = aimArc(e.x, e.y, tx, c.y, T, g);
  b.sfx('throw', e.x);
  b.spawn(new Entity({
    owner: f, x: e.x, y: e.y, vx: v.vx, vy: v.vy, gravity: g, w: 9 * SC, h: 9 * SC, life: 80, vscale: SC, wallDie: false,
    hit: spHit({ damage: TEAR_DMG, hitstun: 12, blockstun: 8, push: 0.8, hitstop: 3, shake: 1, sfx: 'splash' }),
    onHit(en, bb) { splash(bb, en.x, en.y, 5); },
    onGround(en, bb) { en.dead = true; splash(bb, en.x, en.y, 5); },
    draw(ctx, en) {
      const a = Math.atan2(en.vy, en.vx);
      ctx.save();
      ctx.translate(en.x, en.y);
      ctx.rotate(a);
      ctx.fillStyle = '#4fb8ff';
      ctx.beginPath();
      ctx.moveTo(-3, -2.3);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-3, 2.3);
      ctx.fill();
      ball(ctx, 0, 0, 3.4, '#4fb8ff', '#e6f8ff', '#1f6fd0');
      ctx.restore();
    },
  }));
}

function splash(b, x, y, n) {
  b.fx.burst('drop', x, y, n, { colors: WATER, speed: 2.8, g: 0.18, life: 22 });
}

/** The water is over their head: it bursts and slams them down. */
function drown(f, b, opp, s) {
  s.drowned = true;
  const c = bodyCenter(opp);
  b.sfx('boom', opp.x);
  b.sfx('splash', opp.x);
  b.fx.text('GLUB GLUB!', clamp(opp.x, 90, VIEW.W - 90), c.y - 70, { color: ['#ffffff', '#4fb8ff'], scale: 1.4, life: 44 });
  b.fx.burst('drop', opp.x, c.y - 20, 36, { colors: WATER, speed: 5, g: 0.22, life: 34 });
  for (let i = 0; i < 2; i++) b.fx.spawn('ring', opp.x, c.y, { size: 8, grow: 3.4 + i * 1.6, life: 22 + i * 6, color: '#9fe2ff' });
  b.spawn(new Entity({
    owner: f, x: opp.x, y: c.y, w: 70, h: 110, life: 4, wallDie: false, layer: 1,
    hit: spHit({ damage: FINALE_DMG, hitstun: 30, blockstun: 18, knockdown: true, launch: 6.5, push: 5, hitstop: 14, shake: 8, sfx: 'splash' }),
    onUpdate(en) { en.x = opp.x; en.y = bodyCenter(opp).y; },
  }));
}

/** The column of water around the opponent: rising, with a wavy surface and bubbles. */
function drawColumn(ctx, e) {
  const L = e.level;
  if (L <= 0.01) return;
  const gy = VIEW.GROUND_Y;
  const hw = 38 * Math.min(1, 0.35 + L * 1.3);
  const h = L * e.big;
  const top = gy - h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e.x - hw, gy + 4);
  for (let x = -hw; x <= hw; x += 4) ctx.lineTo(e.x + x, top + Math.sin(e.t * 0.25 + x * 0.18) * 2);
  ctx.lineTo(e.x + hw, gy + 4);
  ctx.closePath();
  const gr = ctx.createLinearGradient(0, top, 0, gy);
  gr.addColorStop(0, 'rgba(150,225,255,0.62)');
  gr.addColorStop(1, 'rgba(40,120,220,0.74)');
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(225,248,255,0.95)';
  ctx.stroke();
  ctx.clip();
  // bubbles rising through it
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 12; i++) {
    const bx = e.x + Math.sin(i * 12.9 + e.t * 0.04) * hw * 0.8;
    const by = gy - ((e.t * (0.7 + (i % 3) * 0.3) + i * 23) % Math.max(10, h));
    ctx.beginPath();
    ctx.arc(bx, by, 1.2 + (i % 4) * 0.7, 0, 6.3);
    ctx.stroke();
  }
  // a glossy streak down the side
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(e.x - hw + 5, top + 6, 3, Math.max(0, h - 12));
  ctx.restore();
  bloomAt(ctx, e.x, top, 26, '#9fe2ff', 0.25 * L);
}
