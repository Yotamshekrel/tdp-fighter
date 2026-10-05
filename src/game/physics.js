// Gravity, ground, walls and pushboxes. Pure functions over fighter objects.
import { VIEW, PHYS } from '../config.js';

/** Integrate one frame of motion for a fighter (gravity, ground, walls). */
export function stepBody(f) {
  if (!f.grounded) f.vy += PHYS.gravity * (f.gravityScale ?? 1);
  f.x += f.vx;
  f.y += f.vy;

  // Landing
  f.justLanded = false;
  if (f.y >= VIEW.GROUND_Y) {
    if (!f.grounded) f.justLanded = true;
    f.y = VIEW.GROUND_Y;
    f.vy = 0;
    f.grounded = true;
  } else {
    f.grounded = false;
  }
  // Ground friction on knockback / slides
  if (f.grounded && f.friction) f.vx *= PHYS.groundFriction;
  if (Math.abs(f.vx) < 0.05) f.vx = 0;

  clampToArena(f);
}

export function clampToArena(f) {
  const half = (PHYS.pushWidth / 2) * f.scale;
  const min = VIEW.LEFT + half - 10;
  const max = VIEW.RIGHT - half + 10;
  f.atWall = 0;
  if (f.x < min) { f.x = min; f.atWall = -1; }
  if (f.x > max) { f.x = max; f.atWall = 1; }
}

/**
 * Keep two fighters from overlapping. Only applies when their bodies overlap
 * vertically too, so a high jump can cross over (and fighters auto-turn).
 */
export function resolvePush(a, b) {
  if (a.noPush || b.noPush) return;
  const ha = (PHYS.pushWidth / 2) * a.scale;
  const hb = (PHYS.pushWidth / 2) * b.scale;
  const minDist = ha + hb;
  const dx = b.x - a.x;
  const dist = Math.abs(dx);
  if (dist >= minDist) return;
  // Vertical overlap check (feet vs head)
  const aTop = a.y - a.height(), bTop = b.y - b.height();
  if (a.y <= bTop + 6 || b.y <= aTop + 6) return;

  const overlapPx = minDist - dist;
  let dir = Math.sign(dx);
  if (dir === 0) dir = a.facing > 0 ? 1 : -1;
  // Share the push; whoever is at a wall doesn't move.
  let pa = overlapPx / 2, pb = overlapPx / 2;
  a.x -= dir * pa;
  b.x += dir * pb;
  clampToArena(a);
  clampToArena(b);
  // If one got clamped, push the other the rest of the way.
  const d2 = Math.abs(b.x - a.x);
  if (d2 < minDist) {
    const rest = minDist - d2;
    if (a.atWall) b.x += dir * rest; else a.x -= dir * rest;
    clampToArena(a);
    clampToArena(b);
  }
}
