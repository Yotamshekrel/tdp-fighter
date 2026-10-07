// ---------------------------------------------------------------------------
// Particle effects + popup text. Pure data while simulating (safe to run
// headless), drawn as smooth, glowing shapes when rendering.
// ---------------------------------------------------------------------------
import { rand, randRange, pick } from '../game/rng.js';
import { VIEW } from '../config.js';
import { drawText, textWidth } from './font.js';
import { rrPath } from './ui-kit.js';

const CONFETTI = ['#ff4d6d', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff8cf0', '#ffffff'];
const INK = '#14101e';

export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    // Grown-up mode: blood that has landed on the floor. Lives for the whole match (clear() leaves it alone).
    this.pending = []; // stains not yet painted
    this.layer = null; // the floor's blood, painted as it lands
    this.pools = [];
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
  }

  /** Add one particle. */
  spawn(kind, x, y, o = {}) {
    if (this.parts.length > 1300) return;
    const life = o.life ?? 30;
    this.parts.push({
      kind, x, y,
      land: o.land ?? null, // 'stain' = leaves a mark on the floor and vanishes, 'bounce' = tumbles to rest
      floor: o.land ? VIEW.GROUND_Y + 1 + rand() * 17 : 0,
      vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, drag: o.drag ?? 1,
      life, max: life,
      color: o.color ?? '#fff',
      size: o.size ?? 2,
      grow: o.grow ?? 0,
      flip: o.flip ?? false,
      spin: o.spin ?? 0,
      a: rand() * 6.28,
    });
  }

  /** A burst of n particles flying outward from (x, y). */
  burst(kind, x, y, n, o = {}) {
    const sp = o.speed ?? 2.5;
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + randRange(-(o.spread ?? 3.2), o.spread ?? 3.2) / 2 : rand() * Math.PI * 2;
      const s = randRange(sp * 0.35, sp);
      this.spawn(kind, x + randRange(-2, 2), y + randRange(-2, 2), {
        ...o,
        vx: Math.cos(a) * s + (o.vx ?? 0),
        vy: Math.sin(a) * s + (o.vy ?? 0),
        life: Math.round(randRange((o.life ?? 24) * 0.6, o.life ?? 24)),
        color: o.colors ? pick(o.colors) : o.color,
      });
    }
  }

  /** Floating popup text ("OLE!", "JACKPOT!", ...). */
  text(str, x, y, o = {}) {
    this.texts.push({
      str, x, y,
      vy: o.vy ?? -0.6,
      life: o.life ?? 50,
      max: o.life ?? 50,
      color: o.color ?? (o.bubble ? INK : '#fff'),
      scale: o.scale ?? 1,
      bubble: !!o.bubble,
    });
  }

  /** A mark of blood on the floor (painted once into a picture of the floor, see drawStains). */
  stain(x, y, size = 2) {
    if (typeof document === 'undefined') return; // headless simulation: nothing to draw on
    if (this.pending.length < 400) this.pending.push({ x, y, w: size * (1.1 + rand() * 1.6), a: 0.55 + rand() * 0.35, k: rand() });
  }

  /** A pool that spreads slowly under something bleeding (x, with a final radius r). */
  pool(x, r, y = VIEW.GROUND_Y + 5) {
    this.pools.push({ x, y, r: 2, rmax: r });
  }

  update() {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.vy += p.g;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.size += p.grow;
      p.a += p.spin;
      if (p.land && p.vy > 0 && p.y >= p.floor) {
        if (p.land === 'stain') {
          this.stain(p.x, p.floor, p.size);
          P.splice(i, 1);
          continue;
        }
        p.y = p.floor;
        p.vy *= -0.32;
        p.vx *= 0.55;
        p.spin *= 0.4;
        if (Math.abs(p.vy) < 0.7) { p.vy = 0; p.vx = 0; p.g = 0; p.spin = 0; p.life = Math.max(p.life, 80); p.land = null; }
      }
      if (--p.life <= 0) P.splice(i, 1);
    }
    for (const q of this.pools) q.r += (q.rmax - q.r) * 0.025;
    const T = this.texts;
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i];
      t.y += t.vy;
      t.vy *= 0.94;
      if (--t.life <= 0) T.splice(i, 1);
    }
  }

  /** The blood on the floor (drawn under the fighters). Stains are painted into one picture once, then it is just one draw. */
  drawStains(ctx) {
    if (this.pending.length) {
      if (!this.layer) {
        this.layer = document.createElement('canvas');
        this.layer.width = VIEW.W * VIEW.SCALE;
        this.layer.height = VIEW.H * VIEW.SCALE;
      }
      const lg = this.layer.getContext('2d');
      lg.setTransform(VIEW.SCALE, 0, 0, VIEW.SCALE, 0, 0);
      for (const s of this.pending) {
        lg.fillStyle = s.k > 0.5 ? `rgba(112, 8, 22, ${s.a})` : `rgba(150, 12, 30, ${s.a})`;
        lg.beginPath();
        lg.ellipse(s.x, s.y, s.w, s.w * 0.3, 0, 0, 6.3);
        lg.fill();
      }
      this.pending.length = 0;
    }
    if (this.layer) ctx.drawImage(this.layer, 0, 0, VIEW.W, VIEW.H);
    for (const q of this.pools) {
      ctx.fillStyle = 'rgba(92, 6, 18, 0.9)';
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, q.r, q.r * 0.24, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = 'rgba(150, 12, 30, 0.55)';
      ctx.beginPath();
      ctx.ellipse(q.x - q.r * 0.1, q.y - q.r * 0.03, q.r * 0.72, q.r * 0.15, 0, 0, 6.3);
      ctx.fill();
    }
  }

  draw(ctx) {
    for (const p of this.parts) drawParticle(ctx, p);
    for (const t of this.texts) {
      const k = Math.min(1, t.life / 10);
      const pop = t.max - t.life < 6 ? 0.7 + (t.max - t.life) * 0.05 : 1;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      if (t.bubble) speechBubble(ctx, t.str, 0, 0, t.color);
      else drawText(ctx, t.str, 0, 0, { scale: t.scale * 1.7, align: 'center', color: Array.isArray(t.color) ? t.color : [t.color, t.color], outline: INK, glow: Array.isArray(t.color) ? t.color[1] : t.color });
      ctx.restore();
    }
  }
}

/** Comic speech bubble with text and a tail pointing down to (x, y). */
export function speechBubble(ctx, str, x, y, color = INK) {
  const tw = textWidth(str, 1.3);
  const w = tw + 12, h = 15;
  const bx = x - w / 2, by = y - h - 4;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8 * 4;
  ctx.shadowOffsetY = 1.5 * 4;
  rrPath(ctx, bx, by, w, h, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 3.5, by + h - 0.5);
  ctx.lineTo(x + 0.5, by + h + 5);
  ctx.lineTo(x + 3.5, by + h - 0.5);
  ctx.fill();
  ctx.restore();
  rrPath(ctx, bx, by, w, h, 6);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 3.5, by + h);
  ctx.lineTo(x + 0.5, by + h + 5);
  ctx.lineTo(x + 3.5, by + h);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 3, by + h - 1.2, 6, 1.6);
  drawText(ctx, str, x, by + 4, { scale: 1.3, align: 'center', color, weight: 800 });
}

const star = (ctx, x, y, r, pts = 5, inner = 0.45, rot = -Math.PI / 2) => {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = rot + (i * Math.PI) / pts, rr = i % 2 ? r * inner : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
};

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.6, y - s * 0.95, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.95, x + s * 1.3, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

function puff(ctx, x, y, r, color, a) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function drawParticle(ctx, p) {
  const k = p.life / p.max;
  const x = p.x, y = p.y;
  switch (p.kind) {
    case 'spark': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.lineCap = 'round';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, p.size * 0.42 * (0.4 + k * 0.6));
      ctx.beginPath();
      ctx.moveTo(x - p.vx * 1.8, y - p.vy * 1.8);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth *= 0.45;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'flare': {
      // impact flash: a sharp starburst with a hot core
      const r = p.size * (0.5 + (1 - k) * 0.9);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, k * 1.8);
      puff(ctx, x, y, r * 1.5, p.color, 0.9);
      ctx.fillStyle = p.color;
      star(ctx, x, y, r, 8, 0.2, p.a);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      star(ctx, x, y, r * 0.55, 8, 0.28, p.a + 0.4);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'plus': {
      const s = Math.max(0.6, p.size * k);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.color;
      star(ctx, x, y, s * 1.5, 4, 0.18, 0);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'dust':
    case 'smoke': {
      const r = p.size * (1.3 + (1 - k) * 0.7);
      puff(ctx, x, y, r, p.color, Math.min(1, k * 1.4) * (p.kind === 'dust' ? 0.6 : 0.85));
      break;
    }
    case 'ring':
      if (k > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.5 + 2.2 * k;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, 6.3);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'line': {
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.5);
      const len = p.size * 6 * k + 3;
      const gr = ctx.createLinearGradient(x, 0, x + len, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, p.color);
      ctx.fillStyle = gr;
      ctx.fillRect(x, y - 0.4, len, 0.8);
      ctx.restore();
      break;
    }
    case 'drop':
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, 6.3);
      ctx.fill();
      break;
    case 'confetti': {
      const w = 0.4 + Math.abs(Math.cos(p.a)) * 2.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.a * 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(-w / 2, -1.1, w, 2.2);
      ctx.restore();
      break;
    }
    case 'heart':
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5 * 4;
      heart(ctx, x, y, 3.4);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.2, 0.8, 0, 6.3);
      ctx.fill();
      break;
    case 'flake': {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.55;
      ctx.lineCap = 'round';
      ctx.translate(x, y);
      ctx.rotate(p.a);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(Math.cos(a) * -2.8, Math.sin(a) * -2.8);
        ctx.lineTo(Math.cos(a) * 2.8, Math.sin(a) * 2.8);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'note':
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4 * 4;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(x - 1, y + 2, 1.7, 1.2, -0.4, 0, 6.3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 0.4, y + 1.6);
      ctx.lineTo(x + 0.4, y - 3.4);
      ctx.quadraticCurveTo(x + 3.2, y - 2.6, x + 2.2, y - 0.4);
      ctx.stroke();
      ctx.restore();
      break;
    case 'star':
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5 * 4;
      star(ctx, x, y, 3.4, 5, 0.45, p.a);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
      break;
    case 'hand': {
      ctx.save();
      ctx.translate(x, y);
      if (p.flip) ctx.scale(-1, 1);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 1.5, 4.2, 3.6, 0, 0, 6.3);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        rrPath(ctx, -3.6 + i * 2.4, -5.2 + (i === 0 || i === 3 ? 1 : 0), 1.8, 5.2, 0.9);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'coin': {
      const w = Math.abs(Math.cos(p.a));
      ctx.save();
      ctx.shadowColor = '#ffd84a';
      ctx.shadowBlur = 5 * 4;
      ctx.fillStyle = '#c98b12';
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.5, 2.8 * w), 2.8, 0, 0, 6.3);
      ctx.fill();
      ctx.restore();
      if (w > 0.35) {
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.ellipse(x, y, 2.2 * w, 2.1, 0, 0, 6.3);
        ctx.fill();
      }
      break;
    }
    case 'glow':
      puff(ctx, x, y, p.size * 1.6, p.color, k * 0.7);
      break;
    case 'blood': {
      // a streak along the way it is travelling
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.lineCap = 'round';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.7, p.size * 0.62);
      ctx.beginPath();
      ctx.moveTo(x - p.vx * 1.1, y - p.vy * 1.1);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'bloodmist':
      puff(ctx, x, y, p.size * (1.2 + (1 - k)), '#b3101f', Math.min(1, k * 1.4) * 0.5);
      break;
    case 'chunk': {
      // a ragged lump of meat
      const r = Math.max(0.8, p.size);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.a);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * 6.283, rr = r * (0.65 + 0.45 * Math.abs(Math.sin(i * 2.7 + p.max)));
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = '#3a0610';
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'bone': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.a);
      ctx.fillStyle = '#f1e6c8';
      ctx.strokeStyle = '#7a6c4e';
      ctx.lineWidth = 0.4;
      const l = p.size * 1.6;
      rrPath(ctx, -l, -p.size * 0.28, l * 2, p.size * 0.56, p.size * 0.28);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-l, 0, p.size * 0.42, 0, 6.3);
      ctx.arc(l, 0, p.size * 0.42, 0, 6.3);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'shard': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.a);
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.5, -p.size * 1.3);
      ctx.lineTo(p.size * 0.7, 0);
      ctx.lineTo(-p.size * 0.5, p.size * 1.1);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.4;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'fire': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (0.7 + k * 0.7);
      puff(ctx, x, y, r * 1.6, k > 0.55 ? '#ffb02e' : '#ff3a14', Math.min(1, k * 1.4) * 0.85);
      puff(ctx, x, y, r * 0.8, '#fff0a0', k * 0.7);
      ctx.restore();
      break;
    }
    case 'ember':
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(x - 0.5, y - 0.5, 1.2, 1.2);
      ctx.restore();
      break;
    case 'ash':
      ctx.globalAlpha = Math.min(1, k * 1.6) * 0.8;
      ctx.fillStyle = p.color;
      ctx.fillRect(x, y, 1.6, 1.2);
      ctx.globalAlpha = 1;
      break;
    case 'bug': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.9, 1.15, 0, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-0.6, -1.9); ctx.lineTo(0.6, 1.9);
      ctx.moveTo(0.6, -1.9); ctx.lineTo(-0.6, 1.9);
      ctx.stroke();
      ctx.restore();
      break;
    }
    default:
      ctx.fillStyle = p.color;
      ctx.fillRect(x, y, 2, 2);
  }
}

/** Helper: random confetti colour. */
export const confettiColor = () => pick(CONFETTI);
