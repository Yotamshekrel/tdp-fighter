// ---------------------------------------------------------------------------
// Smooth shapes for the special attacks' projectiles and props: glowing
// beams, orbs, inked outlines. All in game units, fractional coordinates.
// ---------------------------------------------------------------------------
export const INK = '#14101e';

/** Additive soft glow. */
export function bloomAt(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** A glowing beam: wide soft halo, bright body, white-hot core. */
export function glowLine(ctx, x0, y0, x1, y1, w, { glow = '#ff2a2a', mid = '#ff5a5a', core = '#ffffff', a = 1 } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const stroke = (lw, col, al) => {
    ctx.globalAlpha = al * a;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  stroke(w * 3.2, glow, 0.28);
  stroke(w * 1.9, glow, 0.55);
  ctx.globalCompositeOperation = 'source-over';
  stroke(w * 1.1, mid, 1);
  stroke(w * 0.45, core, 1);
  ctx.restore();
}

/** A glossy ball: dark outline, radial shading, highlight. */
export function ball(ctx, x, y, r, base, light = '#ffffff', dark = null) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, r + 0.9, 0, 6.3);
  ctx.fill();
  const gr = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, light);
  gr.addColorStop(0.35, base);
  gr.addColorStop(1, dark || base);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.3);
  ctx.fill();
  ctx.restore();
}

/** Fill a path built by `build(ctx)` and outline it in ink. */
export function inked(ctx, fill, build, lw = 0.9) {
  ctx.beginPath();
  build(ctx);
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function lingrad(ctx, x0, y0, x1, y1, stops) {
  const gr = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}

/** A four-point sparkle. */
export function glint(ctx, x, y, r, color = '#ffffff', a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4, rr = i % 2 ? r * 0.22 : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
