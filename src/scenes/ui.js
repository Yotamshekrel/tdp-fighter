// Shared menu/panel drawing helpers for scenes.
import { VIEW } from '../config.js';
import { drawText, textWidth } from '../render/font.js';
import { COLORS, GOLD, glass, glow, rrPath, vgrad, menuBackdrop, dim as dimScreen, vignette } from '../render/ui-kit.js';

export { GOLD, dimScreen as dim };

const { W } = VIEW;

/** A frosted-glass panel (x, y, w, h in game px). */
export function panel(g, x, y, w, h, fill) {
  glass(g, x, y, w, h, { fill: fill && !fill.startsWith('#') ? fill : undefined, accent: 'rgba(255,255,255,0.22)' });
}

/**
 * Vertical menu centred on cx. Returns hit rects (for mouse/touch).
 * items: array of strings. opts: gap (row pitch), scale, width (button width).
 */
export function drawMenu(g, items, sel, cx, y, frame, opts = {}) {
  const gap = opts.gap ?? 16;
  const scale = opts.scale ?? 1;
  const textScale = 1.15 * scale;
  const rects = [];
  const bh = Math.min(gap - 3, 7 * textScale + 11);
  items.forEach((label, i) => {
    const w = Math.max(opts.width ?? 120, textWidth(label, textScale) + 40);
    const on = i === sel;
    const top = y + i * gap - 2;
    const x = cx - w / 2;
    const pulse = on ? 0.5 + 0.5 * Math.sin(frame * 0.18) : 0;
    g.save();
    if (on) {
      g.shadowColor = 'rgba(255, 170, 40, 0.65)';
      g.shadowBlur = (7 + pulse * 5) * VIEW.SCALE;
    }
    rrPath(g, x, top, w, bh, bh / 2.6);
    g.fillStyle = on ? vgrad(g, top, top + bh, [[0, '#ffe27a'], [1, '#ff9a2a']]) : vgrad(g, top, top + bh, [[0, 'rgba(34,42,94,0.8)'], [1, 'rgba(14,18,48,0.85)']]);
    g.fill();
    g.restore();
    rrPath(g, x + 0.3, top + 0.3, w - 0.6, bh - 0.6, bh / 2.6);
    g.lineWidth = 0.6;
    g.strokeStyle = on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)';
    g.stroke();
    if (on) {
      // gloss
      g.save();
      rrPath(g, x, top, w, bh, bh / 2.6);
      g.clip();
      g.fillStyle = vgrad(g, top, top + bh * 0.55, [[0, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
      g.fillRect(x, top, w, bh * 0.55);
      g.restore();
      drawText(g, '▶', x + 8 + (frame % 40 < 20 ? 0 : 1), top + bh / 2 - (7 * 0.9) / 2, { scale: 0.9, color: '#5a2a00' });
      drawText(g, '◀', x + w - 8 - 7 * 0.9 * 0.95 - (frame % 40 < 20 ? 0 : 1), top + bh / 2 - (7 * 0.9) / 2, { scale: 0.9, color: '#5a2a00' });
    }
    drawText(g, label, cx, top + bh / 2 - (7 * textScale) / 2, {
      scale: textScale, align: 'center', italic: true,
      color: on ? '#2a1400' : '#aab2e0', shadow: on ? undefined : 'rgba(0,0,0,0.55)',
    });
    rects.push({ x, y: top, w, h: bh });
  });
  return rects;
}

/** Index of the rect under the pointer, or -1. */
export function hitTest(pointer, rects) {
  return rects.findIndex((r) => pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h);
}

/** Animated menu backdrop (kept under its old name so scenes read the same). */
export function checker(g, frame, a, b) {
  menuBackdrop(g, frame, a, b);
}

/** A section title with an accent underline. */
export function heading(g, text, x, y, o = {}) {
  const sc = o.scale ?? 3;
  const w = drawText(g, text, x, y, { scale: sc, align: o.align, color: o.color ?? ['#ffffff', '#cdd8ff'], outline: 'rgba(5,6,24,0.9)', glow: o.glow ?? 'rgba(110,140,255,0.8)' });
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const gr = g.createLinearGradient(x0, 0, x0 + Math.max(w, 60), 0);
  gr.addColorStop(0, '#ffd23f');
  gr.addColorStop(1, 'rgba(255,210,63,0)');
  g.fillStyle = gr;
  g.fillRect(x0, y + 7 * sc + 4, Math.max(w, 60), 1.4);
  return w;
}

/** The hint line along the bottom of a menu screen. */
export function hints(g, parts, y = VIEW.H - 14) {
  // parts: [['↑↓', 'MOVE'], ...] -> keycap + caption pairs, centred
  const sc = 1.05;
  const gap = 14;
  let total = 0;
  const sizes = parts.map(([k, c]) => {
    const kw = Math.max(13, textWidth(k, sc) + 8);
    const cw = textWidth(c, sc);
    total += kw + 4 + cw;
    return [kw, cw];
  });
  total += gap * (parts.length - 1);
  let x = W / 2 - total / 2;
  parts.forEach(([k, c], i) => {
    const [kw, cw] = sizes[i];
    rrPath(g, x, y - 1.5, kw, 11, 2.5);
    g.fillStyle = 'rgba(235,240,255,0.92)';
    g.fill();
    drawText(g, k, x + kw / 2, y + 0.3, { scale: sc, align: 'center', color: '#141830', weight: 800, italic: false });
    drawText(g, c, x + kw + 4, y + 0.3, { scale: sc, color: COLORS.dim, shadow: 'rgba(0,0,0,0.6)' });
    x += kw + 4 + cw + gap;
  });
}

export { glow, vignette };
