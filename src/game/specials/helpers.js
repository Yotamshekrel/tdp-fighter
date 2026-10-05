// Shared helpers for special attacks.
import { RULES, VIEW, BODY } from '../../config.js';
import { toWorld, overlap } from '../collision.js';

/** Fighters' on-screen size: projectiles and props are sized to match. */
export const SC = BODY.SCALE;

/** Total damage budget of every special (keeps them balanced). */
export const SD = RULES.specialDamage;

/** Standard special hit definition; override per hit. */
export function spHit(o = {}) {
  return {
    damage: SD, guard: 'mid', hitstun: 24, blockstun: 18, push: 3, hitstop: 8,
    special: true, ...o,
  };
}

/**
 * Melee hitbox attached to the caster (box is fighter-local, facing right).
 * Returns 'hit' | 'block' | null.
 */
export function meleeHit(f, b, box, hit) {
  const opp = b.opponentOf(f);
  const hb = toWorld(f, box);
  const hurt = opp.hurtbox();
  if (!hurt || !overlap(hb, hurt)) return null;
  const px = f.facing > 0 ? Math.max(hb.x, hurt.x) + 4 : Math.min(hb.x + hb.w, hurt.x + hurt.w) - 4;
  const py = Math.max(hb.y, hurt.y) + Math.min(hb.h, hurt.h) / 2;
  return b.resolveHit(f, opp, hit, f.x, px, py);
}

/** Horizontal distance from f to opp, measured in f's facing direction. */
export function aheadDist(f, opp) {
  return (opp.x - f.x) * f.facing;
}

/**
 * Walk/run forward toward the opponent. Returns true once within `stop` px
 * (or if the opponent is behind us).
 */
export function rushToward(f, opp, speed, stop) {
  const d = aheadDist(f, opp);
  f.friction = false;
  if (d <= stop) {
    f.vx = 0;
    return true;
  }
  f.vx = f.facing * Math.min(speed, d - stop);
  return false;
}

// Where the eyes, front hand and mouth are. The renderer records the real on-screen positions
// from the animation (f.vis); without it (headless simulation) these are close approximations.
/** Eye position (world). */
export function eyePos(f) {
  return f.vis?.eye ?? { x: f.x + f.facing * 4 * f.scale, y: f.y - 66 * f.scale };
}
/** Front-hand position (world) for throws / casts; dy is only the fallback height. */
export function handPos(f, dy = -50) {
  return f.vis?.hand ?? { x: f.x + f.facing * 18 * f.scale, y: f.y + dy * f.scale };
}
/** Mouth position (world). */
export function mouthPos(f) {
  return f.vis?.mouth ?? { x: f.x + f.facing * 6 * f.scale, y: f.y - 58 * f.scale };
}
/** Which way the front forearm points (unit vector, world), for things held in the hand. */
export function handDir(f) {
  return f.vis?.dir ?? { x: f.facing, y: -0.3 };
}

/**
 * Velocity to throw something from (x0,y0) so it reaches (x1,y1) in T frames
 * under gravity g (pixels/frame^2).
 */
export function aimArc(x0, y0, x1, y1, T, g) {
  return { vx: (x1 - x0) / T, vy: (y1 - y0 - 0.5 * g * T * T) / T };
}

/** Clamp a value. */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Centre of the opponent's body (good aim point). */
export function bodyCenter(f) {
  return { x: f.x, y: f.y - (f.isCrouchy() ? 26 : 42) * f.scale };
}

export { VIEW };
