// Axis-aligned box helpers. Boxes are {x, y, w, h} with (x, y) = top-left.

/** True if two world-space boxes overlap. */
export function overlap(a, b) {
  return !!a && !!b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Convert a fighter-local box (defined facing right, relative to the feet)
 * into a world box, honouring facing direction and scale.
 */
export function toWorld(f, box, scale = f.scale) {
  const w = box.w * scale;
  const h = box.h * scale;
  const lx = box.x * scale;
  const x = f.facing > 0 ? f.x + lx : f.x - lx - w;
  return { x, y: f.y + box.y * scale, w, h };
}

/** Centre x of a box. */
export const centerX = (b) => b.x + b.w / 2;
