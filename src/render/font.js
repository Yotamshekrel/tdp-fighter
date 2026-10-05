// ---------------------------------------------------------------------------
// Text for the whole game. A bold condensed UI font (see fonts.js) drawn with
// canvas text, so it stays smooth at any size.
//
// The API is what the pixel font used to have, so every scene shares it:
// `scale` 1 = text with a 7 game-pixel cap height, and y is the TOP of the text.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';
import { FONT_FAMILY } from './fonts.js';

const SIZE = 10; // font px per scale unit (cap height of the font is 0.7 em, i.e. 7 px per scale unit)
const CAP = 7;
const ICONS = '▶◀▲▼★♥♪';
const ICON_RE = new RegExp(`([${ICONS}])`);

let mctx = null;
const widthCache = new Map();

function spacingFor(scale) {
  return scale >= 3 ? 0.03 : 0.07;
}

function fontFor(scale, italic, weight) {
  return `${italic ? 'italic ' : ''}${weight} ${SIZE * scale}px ${FONT_FAMILY}`;
}

function styleFor(scale, opts) {
  return {
    italic: opts.italic ?? scale >= 2,
    weight: opts.weight ?? (scale >= 3 ? 800 : 700),
  };
}

function setFont(ctx, scale, st) {
  ctx.font = fontFor(scale, st.italic, st.weight);
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(spacingFor(scale) * SIZE * scale).toFixed(2)}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function iconWidth(scale) {
  return CAP * scale * 0.95;
}

/** Width in game pixels of a string at a given scale. */
export function textWidth(str, scale = 1, opts = {}) {
  str = String(str).toUpperCase();
  if (!str) return 0;
  const st = styleFor(scale, opts);
  const key = `${scale}|${st.italic}|${st.weight}|${str}`;
  let w = widthCache.get(key);
  if (w !== undefined) return w;
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  setFont(mctx, scale, st);
  w = 0;
  for (const part of str.split(ICON_RE)) {
    if (!part) continue;
    w += ICONS.includes(part) ? iconWidth(scale) : mctx.measureText(part).width;
  }
  if (widthCache.size > 600) widthCache.clear();
  widthCache.set(key, w);
  return w;
}

/** Little vector icons for the symbols the UI font does not have. */
function icon(ctx, ch, x, y, scale, fill) {
  const h = CAP * scale, w = iconWidth(scale);
  ctx.beginPath();
  switch (ch) {
    case '▶': ctx.moveTo(x + w * 0.1, y); ctx.lineTo(x + w * 0.9, y + h / 2); ctx.lineTo(x + w * 0.1, y + h); break;
    case '◀': ctx.moveTo(x + w * 0.9, y); ctx.lineTo(x + w * 0.1, y + h / 2); ctx.lineTo(x + w * 0.9, y + h); break;
    case '▲': ctx.moveTo(x, y + h * 0.9); ctx.lineTo(x + w / 2, y + h * 0.05); ctx.lineTo(x + w, y + h * 0.9); break;
    case '▼': ctx.moveTo(x, y + h * 0.1); ctx.lineTo(x + w / 2, y + h * 0.95); ctx.lineTo(x + w, y + h * 0.1); break;
    case '★':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = (i % 2 ? 0.22 : 0.52) * Math.max(w, h) * 1.05;
        ctx[i ? 'lineTo' : 'moveTo'](x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r);
      }
      break;
    case '♥':
      ctx.moveTo(x + w / 2, y + h * 0.95);
      ctx.bezierCurveTo(x - w * 0.2, y + h * 0.5, x + w * 0.1, y - h * 0.1, x + w / 2, y + h * 0.3);
      ctx.bezierCurveTo(x + w * 0.9, y - h * 0.1, x + w * 1.2, y + h * 0.5, x + w / 2, y + h * 0.95);
      break;
    case '♪':
      ctx.ellipse(x + w * 0.3, y + h * 0.82, w * 0.26, h * 0.16, -0.4, 0, Math.PI * 2);
      ctx.rect(x + w * 0.48, y + h * 0.05, w * 0.12, h * 0.78);
      ctx.moveTo(x + w * 0.58, y + h * 0.05);
      ctx.quadraticCurveTo(x + w * 1.05, y + h * 0.3, x + w * 0.62, y + h * 0.5);
      break;
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A fill for the text: a plain colour, or a top -> bottom gradient from an array of colours. */
function fillFor(ctx, color, y, scale) {
  if (!Array.isArray(color)) return color;
  if (color.length === 1) return color[0];
  const gr = ctx.createLinearGradient(0, y, 0, y + CAP * scale);
  color.forEach((c, i) => gr.addColorStop(i / (color.length - 1), c));
  return gr;
}

/**
 * Draw text.
 * opts: scale, color (string, or array of colours for a top->bottom gradient),
 *       align ('left'|'center'|'right'), shadow (colour), outline (colour),
 *       glow (colour), alpha, italic, weight
 */
export function drawText(ctx, str, x, y, opts = {}) {
  str = String(str).toUpperCase();
  const scale = opts.scale ?? 1;
  const st = styleFor(scale, opts);
  const w = textWidth(str, scale, opts);
  if (opts.align === 'center') x -= w / 2;
  else if (opts.align === 'right') x -= w;
  if (!str) return 0;

  ctx.save();
  setFont(ctx, scale, st);
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  const base = y + CAP * scale; // baseline: the bottom of capital letters
  const parts = str.split(ICON_RE).filter(Boolean);
  const run = (draw) => {
    let px = x;
    for (const part of parts) {
      if (ICONS.includes(part)) {
        draw(null, part, px);
        px += iconWidth(scale);
      } else {
        draw(part, null, px);
        px += ctx.measureText(part).width;
      }
    }
  };
  const o = Math.max(1, Math.floor(scale / 2));
  if (opts.outline) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = o * 2 + 0.6;
    ctx.strokeStyle = opts.outline;
    run((t, ic, px) => {
      if (t) ctx.strokeText(t, px, base);
      else {
        ctx.save();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.translate(0, 0);
        icon(ctx, ic, px - o * 0.6, y - o * 0.6, scale * 1.08, opts.outline);
        ctx.restore();
      }
    });
  }
  if (opts.shadow) {
    const d = Math.max(0.8, scale * 0.5);
    run((t, ic, px) => (t ? (ctx.fillStyle = opts.shadow, ctx.fillText(t, px + d, base + d)) : icon(ctx, ic, px + d, y + d, scale, opts.shadow)));
  }
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = Math.max(4, scale * 3) * VIEW.SCALE;
  }
  const fill = fillFor(ctx, opts.color ?? '#fff', y, scale);
  run((t, ic, px) => {
    if (t) { ctx.fillStyle = fill; ctx.fillText(t, px, base); } else icon(ctx, ic, px, y, scale, Array.isArray(opts.color) ? opts.color[Math.floor(opts.color.length / 2)] : fill);
  });
  ctx.restore();
  return w;
}

/** Word-wrap a string to lines no wider than maxChars characters. */
export function wrap(str, maxChars) {
  const words = String(str).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export const FONT = { CAP, SIZE };
