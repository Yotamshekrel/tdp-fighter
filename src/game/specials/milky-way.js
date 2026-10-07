// DANNY — "MILKY WAY": he pulls the galaxy down over the arena. A band of stars swirls open in the
// sky, then planets break loose from it and are launched at the opponent one after the other
// (Mercury, Venus, Earth, Mars, Neptune), each trailing fire. The finale is ringed Saturn, which
// crashes down and knocks them over.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, bodyCenter, aimArc, clamp, VIEW, SC } from './helpers.js';
import { bloomAt, glowLine, ball, INK } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'neptune'];
const RADIUS = { mercury: 6, venus: 8, earth: 8.5, mars: 7, neptune: 9.5, saturn: 15 };
const EVERY = 11; // frames between planets
const SMALL_DMG = SD * 0.12;
const BIG_DMG = SD - SMALL_DMG * PLANETS.length;
const BIG_AT = PLANETS.length * EVERY + 8; // Saturn follows the last small planet
const FADE = 16; // frames the galaxy takes to fade once the attack is over
/** y of the middle of the galaxy band at screen x: a lazy diagonal, higher on the right. */
const bandY = (x) => 80 - (x / VIEW.W) * 34;

export default {
  windup: 40,
  duration: 150,
  aiRange: [0, 999],
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: Math.floor(t / 7) % 2 }; // pulling the sky open
    const k = t - this.windup;
    return { pose: 'cast', frame: k % EVERY < 5 ? 1 : 0 };
  },

  start(f, b) {
    b.fx.text('LOOK UP!', f.x, f.y - 98 * f.scale, { color: ['#ffffff', '#b78cff'], life: 46 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t === 8) b.sfx('hum', opp.x);
    if (t === this.windup - 6) b.sfx('magic', opp.x);
    if (t < this.windup) return;
    const k = t - this.windup;
    s.n = s.n || 0;
    if (s.n < PLANETS.length && k % EVERY === 2) {
      launch(f, b, opp, PLANETS[s.n], false);
      s.n++;
    } else if (s.n === PLANETS.length && k >= BIG_AT) {
      s.n++;
      s.last = launch(f, b, opp, 'saturn', true);
      b.fx.text('SATURN!', f.x, f.y - 98 * f.scale, { bubble: true, life: 40 });
    }
    if (s.last && s.last.dead && s.endAt === undefined) s.endAt = t + FADE;
    if (s.endAt !== undefined && t >= s.endAt) f.endSpecial(b);
  },

  draw(ctx, f, b, t) {
    const s = f.sd;
    const a = s.endAt !== undefined ? clamp((s.endAt - t) / FADE, 0, 1) : clamp(t / 28, 0, 1);
    galaxy(ctx, t, a);
    // a glow gathers in his hand as he opens the sky
    if (t < this.windup && f.vis?.hand) {
      const h = handPos(f);
      bloomAt(ctx, h.x, h.y, 6 + t * 0.3, '#b78cff', 0.6);
    }
  },
};

/** Launch one planet from the sky, aimed at where the opponent will be. */
function launch(f, b, opp, kind, big) {
  const R = RADIUS[kind];
  const T = big ? 40 : 30; // frames of flight
  const g = 0.08;
  const tx = clamp(opp.x + (opp.vx || 0) * T * 0.5, 20, VIEW.W - 20);
  const c = bodyCenter(opp);
  const x0 = clamp(tx + (rand() - 0.5) * (big ? 60 : 230), 10, VIEW.W - 10), y0 = bandY(x0); // it breaks loose from the band
  const v = aimArc(x0, y0, tx, c.y, T, g);
  const fire = big ? ['#ffe28a', '#ffffff', '#ffb62e'] : ['#ffb62e', '#ff7a1a', '#ffffff'];
  b.sfx(big ? 'whoosh' : 'throw', x0);
  return b.spawn(new Entity({
    owner: f, x: x0, y: y0, vx: v.vx, vy: v.vy, gravity: g,
    w: R * 2 * SC * 0.9, h: R * 2 * SC * 0.9, life: 120, vscale: SC, spin: 0, wallDie: false,
    hit: spHit(big
      ? { damage: BIG_DMG, hitstun: 28, blockstun: 16, push: 5.5, hitstop: 12, knockdown: true, shake: 6, sfx: 'smash' }
      : { damage: SMALL_DMG, hitstun: 18, blockstun: 12, push: 1.6, hitstop: 5, sfx: 'bonk' }),
    onHit(e, bb) { crash(bb, e.x, e.y, fire, big); },
    onGround(e, bb) { e.dead = true; crash(bb, e.x, e.y + 4, fire, big); },
    draw(ctx, e) {
      ctx.save();
      ctx.translate(e.x, e.y);
      // a fiery trail behind the planet
      const sp = Math.hypot(e.vx, e.vy) || 1;
      const len = (big ? 30 : 20) / SC * 1.4;
      glowLine(ctx, 0, 0, -e.vx / sp * len, -e.vy / sp * len, R * 0.55, { glow: '#ff7a1a', mid: '#ffb62e', core: '#ffffff', a: 0.85 });
      bloomAt(ctx, 0, 0, R * 2.4, '#ffb62e', 0.28);
      planet(ctx, kind, R, e.t);
      ctx.restore();
    },
  }));
}

function crash(b, x, y, colors, big) {
  b.fx.burst('spark', x, y, big ? 16 : 8, { colors, speed: big ? 4 : 3, g: 0.1, life: big ? 30 : 20 });
  b.fx.burst('star', x, y, big ? 8 : 3, { colors: ['#ffffff', '#ffe28a', '#b78cff'], speed: big ? 3 : 2, g: 0.05, life: big ? 34 : 22 });
  b.sfx(big ? 'boom' : 'bonk', x);
  if (big) b.fx.text('GALACTIC IMPACT!', clamp(x, 120, VIEW.W - 120), y - 36, { color: ['#ffffff', '#b78cff'], life: 44 });
}

/** One planet, radius R units, centred on (0, 0). */
export function planet(c, kind, R, t) {
  const clipped = (draw) => {
    c.save();
    c.beginPath(); c.arc(0, 0, R, 0, 6.3); c.clip();
    draw();
    c.restore();
  };
  switch (kind) {
    case 'mercury':
      ball(c, 0, 0, R, '#aaa39b', '#e6e0d8', '#5e5852');
      c.fillStyle = 'rgba(70,64,58,0.65)';
      for (const [x, y, r] of [[-2, -1.5, 1.3], [2, 1.6, 1.6], [-0.5, 3, 0.9], [2.6, -2.6, 0.8]]) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }
      break;
    case 'venus':
      ball(c, 0, 0, R, '#e6c26a', '#fff0b8', '#a8782a');
      clipped(() => {
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-R, i * 3); c.quadraticCurveTo(0, i * 3 + 2, R, i * 3 - 1); c.stroke(); }
      });
      break;
    case 'earth':
      ball(c, 0, 0, R, '#3f8cff', '#9ad0ff', '#1a3fa0');
      clipped(() => {
        c.fillStyle = '#3ea85a';
        c.beginPath(); c.ellipse(-2.5, -1.5, 3.4, 2.4, 0.5, 0, 6.3); c.fill();
        c.beginPath(); c.ellipse(3.2, 2.8, 2.4, 1.7, -0.3, 0, 6.3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath(); c.ellipse(1, -4.5, 3.2, 0.9, 0, 0, 6.3); c.fill();
        c.beginPath(); c.ellipse(-3, 4.2, 2.4, 0.8, 0, 0, 6.3); c.fill();
      });
      break;
    case 'mars':
      ball(c, 0, 0, R, '#d8532e', '#ff9a6a', '#7a2210');
      clipped(() => {
        c.fillStyle = 'rgba(110,32,14,0.55)';
        c.beginPath(); c.ellipse(-1.5, 1, 3, 1.6, 0.3, 0, 6.3); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.ellipse(0, -R + 0.6, 2.8, 1.2, 0, 0, 6.3); c.fill();
      });
      break;
    case 'neptune':
      ball(c, 0, 0, R, '#3a5cff', '#9ab0ff', '#13237a');
      clipped(() => {
        c.fillStyle = 'rgba(10,20,90,0.55)';
        c.beginPath(); c.ellipse(-2, 1.5, 3.2, 1.6, 0, 0, 6.3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.fillRect(-R, -3.6, R * 2, 0.8);
      });
      break;
    case 'saturn': {
      const ring = (front) => {
        c.save();
        c.rotate(-0.38);
        c.lineCap = 'butt';
        for (const [w, col, rr] of [[3.4, INK, 1.7], [2.4, '#c9a45c', 1.7], [1.2, '#f0d890', 1.7], [0.9, '#8a6a30', 1.42]]) {
          c.strokeStyle = col;
          c.lineWidth = w;
          c.beginPath();
          c.ellipse(0, 0, R * rr, R * rr * 0.28, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
          c.stroke();
        }
        c.restore();
      };
      ring(false);
      ball(c, 0, 0, R, '#e8cf8a', '#fff4c8', '#9a7a34');
      clipped(() => {
        c.fillStyle = 'rgba(150,110,50,0.4)';
        for (const [y, h] of [[-5, 2], [-0.5, 3], [5, 2.2]]) c.fillRect(-R, y, R * 2, h);
      });
      ring(true);
      break;
    }
    default:
      ball(c, 0, 0, R, '#cccccc');
  }
}

/** The Milky Way: a bright band of stars and dust drifting across the top of the arena. */
export function galaxy(c, t, a) {
  if (a <= 0) return;
  const W = VIEW.W;
  c.save();
  c.globalAlpha = a;
  // the sky darkens a little
  const sky = c.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, 'rgba(6,2,30,0.9)');
  sky.addColorStop(0.55, 'rgba(10,4,40,0.6)');
  sky.addColorStop(1, 'rgba(10,4,40,0)');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, 130);
  // the band, a lazy diagonal made of overlapping soft blooms
  const N = 26;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const x = -20 + u * (W + 40);
    const y = bandY(x) + Math.sin(u * 7 + t * 0.03) * 7;
    const core = 1 - Math.abs(u - 0.5) * 1.3;
    bloomAt(c, x, y, 34 + 9 * Math.sin(i * 1.9), i % 3 === 0 ? '#9a6aff' : i % 3 === 1 ? '#4a78ff' : '#ff7ac8', 0.55 * Math.max(0.35, core));
  }
  bloomAt(c, W * 0.5, bandY(W * 0.5), 52, '#fff0c8', 0.8); // the bright galactic core
  // stars, each with its own twinkle
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const h = Math.sin(i * 127.1) * 43758.5453;
    const r1 = h - Math.floor(h);
    const h2 = Math.sin(i * 311.7) * 43758.5453;
    const r2 = h2 - Math.floor(h2);
    const x = r1 * W;
    const y = clamp(bandY(x) + (r2 - 0.5) * (i % 2 ? 40 : 90), 36, 128);
    const tw = 0.45 + 0.55 * Math.sin(t * 0.12 + i * 2.3);
    c.globalAlpha = a * (0.35 + 0.65 * tw);
    c.fillStyle = i % 5 === 0 ? '#ffe9a8' : '#ffffff';
    const sz = i % 9 === 0 ? 2.2 : 1.3;
    c.fillRect(x, y, sz, sz);
  }
  c.restore();
}
