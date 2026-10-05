// Small pixel-art drawing helpers on a 2D canvas context.
// Everything snaps to whole pixels so it stays crisp when upscaled.

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Filled pixel circle. */
export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const rr = r * r;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    const span = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
    if (rr - dy * dy < 0) continue;
    ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
  }
}

/** Pixel circle outline (thickness t). */
export function ring(ctx, cx, cy, r, color, t = 1) {
  ctx.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  const steps = Math.max(12, Math.ceil(r * 7));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r - t / 2), Math.round(cy + Math.sin(a) * r - t / 2), t, t);
  }
}

/** Arc outline from angle a0 to a1 (radians). */
export function arc(ctx, cx, cy, r, a0, a1, color, t = 1) {
  ctx.fillStyle = color;
  const steps = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r * 1.2));
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r - t / 2), Math.round(cy + Math.sin(a) * r - t / 2), t, t);
  }
}

/** Thick pixel line (Bresenham with square stamps). */
export function line(ctx, x0, y0, x1, y1, color, t = 1) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = Math.floor(t / 2);
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0 - o, y0 - o, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * Draw a little pixel map. rows = array of strings, palette = { char: colour }.
 * '.' or ' ' are transparent. flip mirrors horizontally. Anchor = top-left.
 */
export function pixmap(ctx, rows, palette, x, y, scale = 1, flip = false) {
  x = Math.round(x);
  y = Math.round(y);
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      const cx = flip ? w - 1 - c : c;
      ctx.fillRect(x + cx * scale, y + r * scale, scale, scale);
    }
  }
}

// ---- colour utilities -------------------------------------------------------

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. amt in [-1, 1]. */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

export function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix two hex colours. */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
