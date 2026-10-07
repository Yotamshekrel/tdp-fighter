// ---------------------------------------------------------------------------
// The gore toolkit that every fatality is built from (grown-up mode only).
//
// A fatality script never touches the renderer. It changes the victim's `gore` descriptor (squash, offset,
// a colour filter, or a set of loose PIECES of the sprite) and spawns blood, chunks and bones. The renderer
// (render/battle-render.js) draws whatever the descriptor says.
//
// Sprite coordinates ("local"): x forward (towards where the fighter faces), y up is negative, feet at 0,0,
// before the fighter's scale. Roughly: head -125..-47, shoulders -47, waist -26, legs -26..0.
// ---------------------------------------------------------------------------
import { VIEW } from '../../config.js';
import { rand, randRange, pick } from '../rng.js';

export const GY = VIEW.GROUND_Y;
export const BLOODS = ['#c4142a', '#a30f22', '#e02a3c', '#7d0a18'];
export const MEATS = ['#b01c2e', '#8c1424', '#d4546a', '#6e0e1c'];

export const NECK = -51;
export const WAIST = -26;
const X0 = -70, X1 = 70, TOP = -135, BOT = 32;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = (k) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));
export const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
/** 0..1 progress of t between a and b. */
export const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/** World position of a spot given in the sprite's local units (see above). */
export function at(f, lx, ly) {
  return { x: f.x + f.facing * lx * f.scale, y: f.y + ly * f.scale };
}

/** The victim's drawing descriptor (created on first use). */
export function goreOf(f) {
  return (f.gore ||= { pieces: [], hidden: false, sx: 1, sy: 1, ox: 0, oy: 0, rot: 0, filter: null, clip: null });
}

// ---- pieces ------------------------------------------------------------------------------------

/**
 * Replace the whole body with loose pieces. Each piece is { r: [x0, y0, x1, y1] (local rectangle), e: edges }
 * where `e` lists cut surfaces as [side ('t'|'b'|'l'|'r'), halfWidth]. Pieces start still, exactly where the body was;
 * `free()` lets one go.
 */
export function slice(f, defs) {
  const G = goreOf(f);
  G.pieces = defs.map((d) => ({
    r: d.r, e: d.e || [], x: G.ox, y: G.oy, rot: G.rot, vx: 0, vy: 0, vr: 0, g: 0, sx: G.sx, sy: G.sy,
    free: false, hold: false, hidden: false, trail: 0, rested: false, name: d.name || '',
  }));
  G.hidden = true;
  return G.pieces;
}

/** Horizontal slabs between the cut lines (top to bottom). Cuts: numbers (y) or [y, halfWidth]. */
export function slabs(f, cuts) {
  const ys = cuts.map((c) => (Array.isArray(c) ? c[0] : c));
  const ws = cuts.map((c) => (Array.isArray(c) ? c[1] : 9));
  const out = [];
  let y0 = TOP;
  for (let i = 0; i <= ys.length; i++) {
    const y1 = i < ys.length ? ys[i] : BOT;
    const e = [];
    if (i > 0) e.push(['t', ws[i - 1], i - 1]);
    if (i < ys.length) e.push(['b', ws[i], i + 1]);
    out.push({ r: [X0, y0 - 0.3, X1, y1 + 0.3], e });
    y0 = y1;
  }
  return slice(f, out);
}

/** Vertical strips between the cut lines (left to right in local x). */
export function strips(f, xs, y0 = TOP, y1 = BOT) {
  const out = [];
  let a = X0;
  for (let i = 0; i <= xs.length; i++) {
    const b = i < xs.length ? xs[i] : X1;
    const e = [];
    if (i > 0) e.push(['l', 20, i - 1]);
    if (i < xs.length) e.push(['r', 20, i + 1]);
    out.push({ r: [a - 0.3, y0, b + 0.3, y1], e });
    a = b;
  }
  return slice(f, out);
}

/** A cols x rows grid over the body: it falls apart into chunks. */
export function grid(f, cols, rows, x0 = -26, x1 = 26, y0 = -126, y1 = 6) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = c === 0 ? X0 : x0 + ((x1 - x0) * c) / cols, b = c === cols - 1 ? X1 : x0 + ((x1 - x0) * (c + 1)) / cols;
      const t = r === 0 ? TOP : y0 + ((y1 - y0) * r) / rows, d = r === rows - 1 ? BOT : y0 + ((y1 - y0) * (r + 1)) / rows;
      const e = [];
      const idx = (rr, cc) => rr * cols + cc;
      if (r > 0) e.push(['t', 14, idx(r - 1, c)]);
      if (c > 0) e.push(['l', 14, idx(r, c - 1)]);
      if (r < rows - 1) e.push(['b', 14, idx(r + 1, c)]);
      if (c < cols - 1) e.push(['r', 14, idx(r, c + 1)]);
      out.push({ r: [a - 0.2, t - 0.2, b + 0.2, d + 0.2], e });
    }
  }
  return slice(f, out);
}

/** The head and the rest, cut at the neck: { head, body }. The head rectangle is centred on the head, so it spins about its middle. */
export function decap(f) {
  const [head, body] = slice(f, [
    { name: 'head', r: [-50, -112, 50, NECK + 0.3], e: [['b', 6, 1]] },
    { name: 'body', r: [X0, NECK - 0.3, X1, BOT], e: [['t', 6, 0]] },
  ]);
  return { head, body };
}

/** The usual burst of blood where a cut happens (ly = height of the cut on the victim, in sprite units). */
export function cutFx(b, f, ly, n = 18, o = {}) {
  const p = at(f, 0, ly);
  spray(b, p.x, p.y, n, { angle: o.angle ?? -Math.PI / 2, spread: o.spread ?? 2, speed: o.speed ?? 5, size: o.size });
  mist(b, p.x, p.y, 2);
  b.sfx('slice', p.x);
  b.sfx('gore', p.x);
  b.addShake(o.shake ?? 4);
  return p;
}

/** Let a piece go: it falls under gravity and tumbles. */
export function free(p, o = {}) {
  p.free = true;
  p.hold = false;
  p.vx = o.vx ?? 0;
  p.vy = o.vy ?? 0;
  p.vr = o.vr ?? 0;
  p.g = o.g ?? 0.4;
  p.trail = o.trail ?? 3;
  return p;
}

/** Local centre of a piece. */
const centre = (p) => [(p.r[0] + p.r[2]) / 2, (p.r[1] + p.r[3]) / 2];

/** World position of the centre of a piece (ignores rotation). */
export function pieceAt(f, p) {
  const [cx, cy] = centre(p);
  return { x: f.x + p.x + f.facing * cx * f.scale * p.sx, y: f.y + p.y + cy * f.scale * p.sy };
}

/**
 * Make a standing piece topple over, pivoting on its feet, towards world direction d (+1 right, -1 left).
 * It thuds down after a moment, splashing.
 */
export function topple(f, p, d, o = {}) {
  p.hold = true;
  p.fall = { rot: 0, v: o.v ?? 0.008, a: o.a ?? 0.011, dir: d * f.facing };
}

/** Rotate a piece by `rot` about the feet (local 0,0) instead of its own middle. */
function rotateAboutFeet(f, p, rot) {
  const [cx, cy] = centre(p);
  const vx = -cx, vy = -cy;
  const wx = vx - (vx * Math.cos(rot) - vy * Math.sin(rot)), wy = vy - (vx * Math.sin(rot) + vy * Math.cos(rot));
  p.rot = rot;
  p.x = f.facing * f.scale * p.sx * wx;
  p.y = f.scale * p.sy * wy;
}

/** Physics for the victim's loose pieces: gravity, the floor, a trail of blood. */
export function stepPieces(f, b) {
  const G = f.gore;
  if (!G) return;
  for (const p of G.pieces) {
    if (p.fall) {
      const F = p.fall;
      F.v += F.a;
      F.rot += F.v;
      const r = Math.min(F.rot, Math.PI / 2 - 0.12);
      rotateAboutFeet(f, p, r * F.dir);
      if (F.rot >= Math.PI / 2 - 0.12) {
        p.fall = null;
        const c = pieceAt(f, p);
        b.sfx('thud', c.x);
        b.sfx('splat', c.x);
        b.addShake(3);
        spray(b, c.x, GY - 4, 12, { angle: -Math.PI / 2, spread: 3, speed: 3 });
        b.fx.pool(c.x, 14 + rand() * 8);
      }
      continue;
    }
    if (!p.free || p.hold) continue;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const c = pieceAt(f, p);
    if (p.trail && Math.hypot(p.vx, p.vy) > 1.4 && b.frame % p.trail === 0) {
      b.fx.spawn('blood', c.x, c.y, { vx: p.vx * 0.2, vy: p.vy * 0.2, g: 0.16, life: 30, size: 2, color: pick(BLOODS), land: 'stain' });
    }
    if (p.g <= 0) continue;
    // lowest point of the piece's visible body (not the whole rectangle) after its rotation
    const cx = (p.r[0] + p.r[2]) / 2, cy = (p.r[1] + p.r[3]) / 2;
    const xa = Math.max(p.r[0], -16), xb = Math.min(p.r[2], 16), ya = Math.max(p.r[1], -125), yb = Math.min(p.r[3], 3);
    const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
    let low = -1e9;
    for (const x of [xa, xb]) for (const y of [ya, yb]) low = Math.max(low, ((x - cx) * sn + (y - cy) * cs) * f.scale * p.sy);
    const he = low;
    const over = c.y + he - (GY + 3);
    if (over > 0) {
      p.y -= over;
      if (p.vy > 2) {
        if (!p.rested || p.vy > 4) {
          b.sfx('splat', c.x);
          spray(b, c.x, GY, 5, { angle: -Math.PI / 2, spread: 2.6, speed: 3, size: 2.2 });
        }
        p.vy *= -0.28;
        p.vx *= 0.7;
        p.vr *= 0.5;
      } else {
        p.vy = 0;
        p.vx *= 0.8;
        p.vr *= 0.6;
        if (!p.rested) {
          p.rested = true;
          b.fx.pool(c.x, 9 + rand() * 9);
        }
      }
      // settle flat once it has stopped tumbling
      if (Math.abs(p.vr) < 0.04) {
        const target = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2);
        p.rot += (target - p.rot) * 0.2;
      }
    }
  }
}

// ---- blood & guts ------------------------------------------------------------------------------

/** A spray of blood. o: angle (radians, omit for all directions), spread, speed, size, g, vx, vy, life. */
export function spray(b, x, y, n, o = {}) {
  b.fx.burst('blood', x, y, n, {
    angle: o.angle, spread: o.spread ?? 6.3, speed: o.speed ?? 4, g: o.g ?? 0.18, life: o.life ?? 50, size: o.size ?? 2.4,
    vx: o.vx, vy: o.vy, colors: BLOODS, land: 'stain',
  });
}

export function mist(b, x, y, n = 3, size = 6) {
  b.fx.burst('bloodmist', x, y, n, { speed: 1.1, size, life: 24 });
}

/** Lumps of meat and a few bones, tumbling and bouncing to rest on the floor. */
export function chunks(b, x, y, n, o = {}) {
  b.fx.burst('chunk', x, y, n, {
    angle: o.angle, spread: o.spread ?? 6.3, speed: o.speed ?? 5, g: 0.3, life: 150, size: o.size ?? 2.6, spin: 0.2, vy: -(o.up ?? 1.5),
    colors: o.colors || MEATS, land: 'bounce',
  });
  const bones = o.bones ?? Math.ceil(n / 4);
  if (bones) {
    b.fx.burst('bone', x, y, bones, {
      angle: o.angle, spread: o.spread ?? 6.3, speed: (o.speed ?? 5) * 0.9, g: 0.3, life: 170, size: 2.4, spin: 0.25, vy: -(o.up ?? 1.5), color: '#f1e6c8', land: 'bounce',
    });
  }
}

/** One frame of a blood fountain (call every frame or two). */
export function geyser(b, x, y, power = 1, lean = 0) {
  b.fx.burst('blood', x, y, 2, { angle: -Math.PI / 2 + lean, spread: 0.5, speed: 4.2 * power, g: 0.2, life: 54, size: 2.4, colors: BLOODS, land: 'stain' });
}

/** Blood on the screen itself, running down (drawn over the HUD's picture, see battle-render.js). */
export function lens(b, n = 4) {
  b.lens ||= [];
  for (let i = 0; i < n; i++) {
    b.lens.push({ x: randRange(30, VIEW.W - 30), y: randRange(30, 190), r: randRange(6, 15), t: 0, life: 330, sp: randRange(0.04, 0.16), seed: rand() * 9 });
  }
}

/** Blood on the winner. */
export function splatter(w, n = 5) {
  for (let i = 0; i < n; i++) {
    w.wounds.push({ k: 'stain', x: randRange(-6, 7), y: randRange(-64, -22), s: randRange(2, 4.4), sd: rand() * 9 });
  }
  if (w.wounds.length > 16) w.wounds.splice(0, w.wounds.length - 16);
}

/** Hold the victim's pieces' fall: pin a piece to a world point (its centre). */
export function pin(f, p, x, y) {
  p.hold = true;
  const [cx, cy] = centre(p);
  p.x = x - f.x - f.facing * cx * f.scale * p.sx;
  p.y = y - f.y - cy * f.scale * p.sy;
}

/** Banner + the screen reacting to the kill. Once per fatality. */
export function fatalityBanner(b, F) {
  if (F.banner) return;
  F.banner = true;
  b.announce = { text: 'FATALITY', t: 0, kind: 'fatality' };
  b.event('fatality');
  b.addShake(10);
  b.addFlash('#ff1a1a', 14);
}

export { rand, randRange, pick };
