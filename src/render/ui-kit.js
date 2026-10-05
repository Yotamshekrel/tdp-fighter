// ---------------------------------------------------------------------------
// Shared building blocks for the game's look: palette, rounded / slanted shapes,
// glass panels, soft glows and the animated menu backdrop. Everything is drawn
// in game units (480x270) but with fractional coordinates, so it is smooth.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';

const { W, H } = VIEW;

export const COLORS = {
  ink: '#070918',
  deep: '#0b0e26',
  panel: 'rgba(12, 16, 42, 0.74)',
  line: 'rgba(255, 255, 255, 0.16)',
  gold: '#ffd23f',
  white: '#ffffff',
  dim: '#8b93c4',
  text: '#dfe4ff',
  // one theme per player side: P1 warm, P2 cool
  side: [
    { a: '#ff5a4e', b: '#ffa03c', glow: '#ff6a3d', dark: '#5a1020' },
    { a: '#38c8ff', b: '#5b6dff', glow: '#3cc8ff', dark: '#10285a' },
  ],
};
export const GOLD = ['#ffffff', '#fff3a0', '#ffd23f', '#ff9b2e'];

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOut = (x) => 1 - (1 - x) ** 3;
export const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

/** Path of a rounded rectangle. */
export function rrPath(g, x, y, w, h, r = 4) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else {
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
}

/** Parallelogram: the top edge is shifted right by `skew` (negative leans the other way). */
export function parallelogram(g, x, y, w, h, skew) {
  g.beginPath();
  g.moveTo(x + skew, y);
  g.lineTo(x + skew + w, y);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
}

function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}
export { vgrad };

/** A frosted-glass panel. */
export function glass(g, x, y, w, h, o = {}) {
  const r = o.r ?? 5;
  g.save();
  if (o.shadow !== false) {
    g.shadowColor = 'rgba(0, 0, 0, 0.5)';
    g.shadowBlur = 10 * VIEW.SCALE;
    g.shadowOffsetY = 2 * VIEW.SCALE;
  }
  rrPath(g, x, y, w, h, r);
  g.fillStyle = o.fill ?? vgrad(g, y, y + h, [[0, 'rgba(26, 32, 74, 0.82)'], [1, 'rgba(8, 11, 32, 0.84)']]);
  g.fill();
  g.restore();
  g.save();
  rrPath(g, x, y, w, h, r);
  g.clip();
  // top sheen
  g.fillStyle = vgrad(g, y, y + h * 0.5, [[0, 'rgba(255,255,255,0.10)'], [1, 'rgba(255,255,255,0)']]);
  g.fillRect(x, y, w, h * 0.5);
  if (o.accent) {
    g.fillStyle = o.accent;
    g.fillRect(x, y, w, 1.2);
  }
  g.restore();
  rrPath(g, x + 0.3, y + 0.3, w - 0.6, h - 0.6, r);
  g.lineWidth = 0.6;
  g.strokeStyle = o.stroke ?? COLORS.line;
  g.stroke();
  if (o.glow) {
    g.save();
    g.shadowColor = o.glow;
    g.shadowBlur = 8 * VIEW.SCALE;
    rrPath(g, x, y, w, h, r);
    g.strokeStyle = o.glow;
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
  }
}

/** Soft additive glow. */
export function glow(g, x, y, r, color, alpha = 1) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = alpha;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/** Darkened edges. */
export function vignette(g, strength = 0.5, inner = 0.55) {
  const gr = g.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(2, 3, 14, ${strength})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
}

/** Dim the whole screen. */
export function dim(g, a = 0.5) {
  g.fillStyle = `rgba(6, 8, 24, ${a})`;
  g.fillRect(0, 0, W, H);
}

// ---- animated menu backdrop ----------------------------------------------------------------
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * W, y: r(2) * H, s: 0.4 + r(3) * 1.1, v: 0.06 + r(4) * 0.2, p: r(5) * 6.28 };
});

/** Deep blue-violet backdrop with drifting light and a soft grid. `hue` shifts the accent colours. */
export function menuBackdrop(g, t, accentA = '#ff3d8b', accentB = '#2fb8ff') {
  g.fillStyle = vgrad(g, 0, H, [[0, '#0a0c26'], [0.55, '#151038'], [1, '#080a1e']]);
  g.fillRect(0, 0, W, H);
  glow(g, W * (0.22 + Math.sin(t * 0.006) * 0.06), H * 0.35, 190, accentA, 0.34);
  glow(g, W * (0.8 + Math.cos(t * 0.005) * 0.05), H * 0.62, 210, accentB, 0.3);
  // perspective floor grid
  g.save();
  g.beginPath();
  g.rect(0, H * 0.62, W, H * 0.38);
  g.clip();
  g.strokeStyle = 'rgba(120, 140, 255, 0.13)';
  g.lineWidth = 0.5;
  const hy = H * 0.62;
  for (let i = -14; i <= 14; i++) {
    g.beginPath();
    g.moveTo(W / 2 + i * 14, hy);
    g.lineTo(W / 2 + i * 70, H);
    g.stroke();
  }
  for (let k = 0; k < 9; k++) {
    const f = ((k + (t * 0.012) % 1) / 9) ** 2;
    const y = hy + f * (H - hy);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.restore();
  // diagonal light streaks
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = ((t * (0.35 + i * 0.12) + i * 190) % (W + 260)) - 130;
    const gr = g.createLinearGradient(x, 0, x + 40, 0);
    gr.addColorStop(0, 'rgba(160,180,255,0)');
    gr.addColorStop(0.5, 'rgba(160,180,255,0.07)');
    gr.addColorStop(1, 'rgba(160,180,255,0)');
    g.fillStyle = gr;
    parallelogram(g, x, 0, 40, H, 90);
    g.fill();
  }
  // motes
  for (const s of STARS) {
    const y = (s.y - t * s.v + H * 4) % H;
    g.globalAlpha = 0.25 + 0.35 * Math.sin(t * 0.04 + s.p) ** 2;
    g.fillStyle = '#cfd8ff';
    g.beginPath();
    g.arc(s.x, y, s.s, 0, 6.3);
    g.fill();
  }
  g.restore();
  vignette(g, 0.55);
}

/** Thin row of key hints along the bottom: [['↑↓', 'MOVE'], ...] drawn by the caller with drawText. */
export function hintBar(g, y = H - 22) {
  g.fillStyle = vgrad(g, y, H, [[0, 'rgba(5,7,20,0)'], [1, 'rgba(5,7,20,0.75)']]);
  g.fillRect(0, y, W, H - y);
}
