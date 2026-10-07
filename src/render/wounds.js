// ---------------------------------------------------------------------------
// Grown-up mode, what you see: cuts, bruises and blood on the fighters (worse the less health they have),
// the pieces of a fatality's victim, and blood running down the screen. Everything is drawn in the
// fighter's local space (feet at 0,0, x forward, y up is negative; see game/fatalities/kit.js).
// ---------------------------------------------------------------------------
import { drawFrame } from './sprites.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function blob(g, x, y, r, a = 0.78, rot = 0) {
  // an uneven splash: a few overlapping lobes, darker in the middle
  for (let k = 0; k < 4; k++) {
    g.fillStyle = `rgba(${k % 2 ? 132 : 112}, 10, 24, ${a * 0.85})`;
    g.beginPath();
    g.ellipse(x + Math.cos(rot + k * 1.9) * r * 0.38, y + Math.sin(rot + k * 2.3) * r * 0.32, r * (0.62 + 0.2 * Math.sin(k * 3 + rot)), r * (0.5 + 0.18 * Math.cos(k * 2 + rot)), rot + k * 0.7, 0, 6.3);
    g.fill();
  }
  g.fillStyle = `rgba(78, 5, 14, ${a * 0.7})`;
  g.beginPath();
  g.ellipse(x + r * 0.1, y + r * 0.08, r * 0.42, r * 0.34, rot, 0, 6.3);
  g.fill();
}

/** How far a tired fighter slumps forward (radians). */
export function leanOf(f, hp, frame) {
  if (!['idle', 'walk', 'crouch', 'block'].includes(f.state)) return 0;
  if (hp > 0.5) return 0;
  const k = clamp01((0.5 - hp) / 0.4);
  return k * (0.075 + 0.02 * Math.sin(frame * 0.12 + f.side));
}

/** Splashes of blood on a winner after a fatality (the wounds of a hurt fighter are painted into the sprite, damage.js). */
export function drawWounds(g, f) {
  if (!f.wounds.length) return;
  g.save();
  for (const w of f.wounds) {
    blob(g, w.x, w.y, w.s, 0.8, w.sd);
    g.fillStyle = 'rgba(170, 14, 30, 0.8)';
    g.fillRect(w.x + w.s * 1.3, w.y - w.s * 0.6, 0.9, 0.9);
    g.fillRect(w.x - w.s * 1.1, w.y + w.s * 0.9, 0.8, 0.8);
  }
  g.restore();
}

/** One loose piece of a fatality victim (see kit.js slice()). */
function drawPiece(g, f, spr, p, G) {
  g.save();
  g.translate(f.x + p.x, f.y + p.y);
  g.scale(f.facing * f.scale * p.sx, f.scale * p.sy);
  const cx = (p.r[0] + p.r[2]) / 2, cy = (p.r[1] + p.r[3]) / 2;
  g.translate(cx, cy);
  g.rotate(p.rot);
  g.translate(-cx, -cy);
  g.beginPath();
  g.rect(p.r[0], p.r[1], p.r[2] - p.r[0], p.r[3] - p.r[1]);
  g.clip();
  if (G.filter) g.filter = G.filter;
  drawFrame(g, spr);
  g.filter = 'none';
  // the raw surface where it was cut (only once whatever was on the other side has come away)
  const xa = Math.max(p.r[0], -16), xb = Math.min(p.r[2], 16), ya = Math.max(p.r[1], -125), yb = Math.min(p.r[3], 2);
  for (const [side, hw, nb] of p.e) {
    const other = nb === undefined ? G.pieces.some((q) => q !== p && (q.free || q.hidden)) : G.pieces[nb].free || G.pieces[nb].hidden;
    if (!other) continue;
    const horiz = side === 't' || side === 'b';
    const x = horiz ? (xa + xb) / 2 : side === 'l' ? p.r[0] : p.r[2];
    const y = horiz ? (side === 't' ? p.r[1] : p.r[3]) : (ya + yb) / 2;
    const rx = horiz ? Math.min(hw, (xb - xa) / 2) : 2.4, ry = horiz ? 2.6 : ((yb - ya) / 2) * 0.95;
    g.fillStyle = '#7a0a1a';
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, 6.3);
    g.fill();
    g.fillStyle = '#d02a40';
    g.beginPath();
    g.ellipse(x, y, rx * 0.62, ry * 0.55, 0, 0, 6.3);
    g.fill();
  }
  g.restore();
}

/** Draw a fighter that a fatality has taken over (squashed, floating, or in pieces). */
export function drawGored(g, f, spr, V, hp, frame) {
  const G = f.gore;
  if (G.pieces.length) {
    for (const p of G.pieces) if (!p.hidden) drawPiece(g, f, spr, p, G);
    return;
  }
  if (G.hidden) return;
  g.save();
  g.translate(f.x + G.ox, f.y + G.oy);
  g.scale(f.facing * f.scale * G.sx, f.scale * G.sy);
  if (G.rot) g.rotate(G.rot);
  if (G.clip) {
    g.beginPath();
    g.rect(G.clip[0], G.clip[1], G.clip[2] - G.clip[0], G.clip[3] - G.clip[1]);
    g.clip();
  }
  if (G.filter) g.filter = G.filter;
  drawFrame(g, spr);
  g.filter = 'none';
  if (!G.noWounds) drawWounds(g, f, V, hp, frame);
  g.restore();
}

/** Blood on the screen itself, running down slowly. */
export function drawLens(g, battle) {
  const L = battle.lens;
  if (!L) return;
  for (const s of L) {
    s.t++;
    const a = clamp01((s.life - s.t) / 70);
    if (a <= 0) continue;
    const grow = clamp01(s.t / 6);
    const y = s.y + s.t * s.sp;
    g.save();
    g.globalAlpha = a * 0.92;
    g.strokeStyle = 'rgba(120, 6, 20, 0.95)'; // the run
    g.lineWidth = s.r * 0.26;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x, y);
    g.stroke();
    const rr = s.r * grow;
    // an uneven splat: overlapping lobes, a few thin streaks and droplets around it
    g.fillStyle = 'rgba(128, 8, 24, 0.95)';
    g.strokeStyle = 'rgba(128, 8, 24, 0.95)';
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const ang = s.seed + i * 0.9, d = rr * (0.35 + 0.3 * ((i * 5) % 4) / 4);
      g.beginPath();
      g.arc(s.x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr * (0.5 + 0.22 * ((i * 3) % 3)), 0, 6.3);
      g.fill();
    }
    for (let i = 0; i < 6; i++) {
      const ang = s.seed * 1.7 + i * 1.1, len = rr * (1.3 + 0.9 * ((i * 7) % 5) / 5);
      g.lineWidth = Math.max(0.6, rr * 0.07);
      g.beginPath();
      g.moveTo(s.x + Math.cos(ang) * rr * 0.8, y + Math.sin(ang) * rr * 0.8);
      g.lineTo(s.x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      g.stroke();
      g.beginPath();
      g.arc(s.x + Math.cos(ang) * len * 1.08, y + Math.sin(ang) * len * 1.08, rr * 0.09, 0, 6.3);
      g.fill();
    }
    g.fillStyle = 'rgba(190, 22, 42, 0.8)';
    g.beginPath();
    g.arc(s.x - rr * 0.18, y - rr * 0.2, rr * 0.45, 0, 6.3);
    g.fill();
    g.restore();
  }
}

