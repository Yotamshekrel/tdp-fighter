// ---------------------------------------------------------------------------
// HUD (health bars, timer, round markers, special meters, combo counter),
// announcer banners (ROUND 1 / FIGHT! / K.O.) and the special-move cut-in.
// ---------------------------------------------------------------------------
import { VIEW, RULES } from '../config.js';
import { drawText, textWidth } from './font.js';
import { drawPortrait, drawFighterArt } from './sprites.js';
import { COLORS, glass, glow, rrPath, parallelogram, vgrad, clamp01, easeOut, easeOutBack } from './ui-kit.js';

const { W, H } = VIEW;
const BAR_X = 62, BAR_W = 150, BAR_H = 13, BAR_Y = 11, SKEW = 8;
const PORT_W = 40, PORT_H = 46;
const RAINBOW = ['#ff4d4d', '#ffb02e', '#ffe14d', '#5dff6a', '#3ec1ff', '#b36bff'];

export class Hud {
  constructor() {
    this.trail = [RULES.maxHealth, RULES.maxHealth];
    this.combo = [{ n: 0, t: 0 }, { n: 0, t: 0 }];
    this.hit = [0, 0]; // frames since the fighter was last hit (bar shake)
    this.lastHp = [RULES.maxHealth, RULES.maxHealth];
  }

  reset() {
    this.trail = [RULES.maxHealth, RULES.maxHealth];
    this.lastHp = [RULES.maxHealth, RULES.maxHealth];
  }

  /** Feed battle events (for the combo counter). */
  onEvent(ev) {
    if (ev.type === 'hit' && ev.attacker) {
      const c = this.combo[ev.attacker.side];
      c.n = ev.attacker.combo;
      c.t = c.n >= 2 ? 70 : 0;
      c.pop = 10;
    }
  }

  draw(g, battle, bank, frame) {
    const [a, b] = battle.fighters;
    for (const f of [a, b]) {
      const i = f.side;
      // the pale trail drains slowly toward real health
      if (this.trail[i] > f.health) this.trail[i] = Math.max(f.health, this.trail[i] - 0.5);
      else this.trail[i] = f.health;
      if (f.health < this.lastHp[i]) this.hit[i] = 12;
      this.lastHp[i] = f.health;
      if (this.hit[i] > 0) this.hit[i]--;
      this.healthBar(g, f, i, frame);
      this.portrait(g, f, i, bank, frame);
      this.meterBar(g, f, i, frame);
    }
    this.timer(g, battle, a, b, frame);

    // Combo counters
    for (let i = 0; i < 2; i++) {
      const c = this.combo[i];
      if (c.t <= 0) continue;
      c.t--;
      if (c.pop > 0) c.pop--;
      const x = i === 0 ? 16 : W - 16;
      const pop = 1 + (c.pop || 0) * 0.04;
      const alpha = clamp01(c.t / 14);
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, 78);
      g.scale(pop, pop);
      drawText(g, String(c.n), 0, -3, { scale: 6, align: i === 0 ? 'left' : 'right', color: ['#ffffff', '#fff3a0', '#ffb02e'], outline: '#1a0a14', glow: COLORS.side[i].glow });
      drawText(g, c.n === 1 ? 'HIT' : 'HITS', i === 0 ? 2 : -2, 40, { scale: 1.8, align: i === 0 ? 'left' : 'right', color: '#ffe9a0', outline: '#1a0a14' });
      g.restore();
    }
  }

  healthBar(g, f, i, frame) {
    const left = i === 0;
    const x = left ? BAR_X : W - BAR_X - BAR_W;
    const sk = left ? SKEW : -SKEW;
    const side = COLORS.side[i];
    const shake = this.hit[i] > 0 ? (this.hit[i] % 2 ? 1.2 : -1.2) * (this.hit[i] / 12) : 0;
    g.save();
    g.translate(shake, 0);
    // glass frame
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 8 * VIEW.SCALE;
    g.shadowOffsetY = 1.5 * VIEW.SCALE;
    parallelogram(g, x - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4, sk);
    g.fillStyle = 'rgba(8, 10, 30, 0.9)';
    g.fill();
    g.restore();
    parallelogram(g, x, BAR_Y, BAR_W, BAR_H, sk);
    g.fillStyle = vgrad(g, BAR_Y, BAR_Y + BAR_H, [[0, '#2a1426'], [1, '#12081a']]);
    g.fill();
    g.save();
    parallelogram(g, x, BAR_Y, BAR_W, BAR_H, sk);
    g.clip();
    const hp = Math.max(0, f.health) / RULES.maxHealth;
    const tr = Math.max(0, this.trail[i]) / RULES.maxHealth;
    // bars are anchored at the outer edge and shrink toward the centre, keeping the slanted ends
    const para = (frac) => {
      const w = BAR_W * frac;
      parallelogram(g, left ? x : x + BAR_W - w, BAR_Y, w, BAR_H, sk);
      return w;
    };
    if (tr > 0) {
      para(tr);
      g.fillStyle = vgrad(g, BAR_Y, BAR_Y + BAR_H, [[0, '#ffffff'], [1, '#ff6a4e']]);
      g.fill();
    }
    const danger = hp < 0.28;
    const pulse = danger ? 0.5 + 0.5 * Math.sin(frame * 0.35) : 0;
    const top = danger ? `rgb(255, ${Math.round(150 - pulse * 60)}, ${Math.round(80 - pulse * 30)})` : '#fff07a';
    const bot = danger ? '#d81f2a' : '#ff9a1f';
    if (hp > 0) {
      const w = para(hp);
      g.fillStyle = vgrad(g, BAR_Y, BAR_Y + BAR_H, [[0, top], [0.5, danger ? '#ff4a3a' : '#ffc928'], [1, bot]]);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(left ? x : x + BAR_W - w, BAR_Y, w + SKEW, BAR_H * 0.38);
      g.restore();
    }
    // ticks
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let k = 1; k < 10; k++) g.fillRect(x + (BAR_W * k) / 10 + (left ? 0 : -SKEW / 2), BAR_Y, 0.5, BAR_H);
    // moving shine
    const sh = ((frame * 1.3) % (BAR_W + 60)) - 30;
    const sg = g.createLinearGradient(x + sh, 0, x + sh + 22, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.fillRect(x + sh, BAR_Y, 22, BAR_H);
    g.restore();
    // side-coloured edge
    parallelogram(g, x, BAR_Y, BAR_W, BAR_H, sk);
    g.lineWidth = 0.8;
    g.strokeStyle = side.a;
    g.globalAlpha = 0.9;
    g.stroke();
    g.globalAlpha = 1;
    g.restore();

    // name + round wins
    const nameX = left ? x + 2 : x + BAR_W - 2;
    drawText(g, f.def.name, nameX, BAR_Y + BAR_H + 4, { scale: 1.5, align: left ? 'left' : 'right', color: '#ffffff', shadow: 'rgba(0,0,0,0.6)', weight: 800 });
    for (let k = 0; k < RULES.roundsToWin; k++) {
      const won = f.roundWins > k;
      const cx = left ? x + BAR_W - 6 - k * 11 : x + 6 + k * 11;
      const cy = BAR_Y + BAR_H + 9;
      g.beginPath();
      g.moveTo(cx, cy - 4);
      g.lineTo(cx + 4, cy);
      g.lineTo(cx, cy + 4);
      g.lineTo(cx - 4, cy);
      g.closePath();
      g.fillStyle = won ? vgrad(g, cy - 4, cy + 4, [[0, '#fff6c0'], [1, '#ffb62e']]) : 'rgba(8,10,30,0.8)';
      g.fill();
      g.lineWidth = 0.7;
      g.strokeStyle = won ? '#ffe9a0' : 'rgba(255,255,255,0.3)';
      g.stroke();
      if (won) glow(g, cx, cy, 8, '#ffb62e', 0.6);
    }
  }

  timer(g, battle, a, b, frame) {
    const secs = Math.ceil(battle.timer / 60);
    const low = secs <= 10 && battle.phase === 'fight';
    const cx = W / 2, cy = 17;
    const pulse = low ? 0.5 + 0.5 * Math.sin(frame * 0.4) : 0;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 8 * VIEW.SCALE;
    g.shadowOffsetY = 1.5 * VIEW.SCALE;
    g.beginPath();
    g.moveTo(cx - 24, cy - 12);
    g.lineTo(cx + 24, cy - 12);
    g.lineTo(cx + 19, cy + 14);
    g.lineTo(cx - 19, cy + 14);
    g.closePath();
    g.fillStyle = vgrad(g, cy - 12, cy + 14, [[0, 'rgba(34,40,92,0.95)'], [1, 'rgba(10,12,34,0.95)']]);
    g.fill();
    g.restore();
    g.lineWidth = 0.9;
    g.strokeStyle = low ? `rgba(255, ${Math.round(120 - pulse * 60)}, 90, 1)` : 'rgba(255,255,255,0.35)';
    g.stroke();
    drawText(g, String(secs).padStart(2, '0'), cx, cy - 11, {
      scale: 2.9, align: 'center', italic: false, weight: 800,
      color: low ? ['#ffffff', '#ff7a6a'] : ['#ffffff', '#cdd8ff'],
      glow: low ? '#ff3b30' : 'rgba(120,150,255,0.8)',
    });
    drawText(g, `ROUND ${battle.round}`, cx, cy + 17, { scale: 0.95, align: 'center', color: COLORS.dim, shadow: 'rgba(0,0,0,0.6)' });
  }

  meterBar(g, f, i, frame) {
    const MW = 126, MH = 7, y = H - 16;
    const left = i === 0;
    const x = left ? 14 : W - 14 - MW;
    const sk = left ? 5 : -5;
    const full = f.meter >= RULES.meterMax;
    const frac = Math.min(f.meter, RULES.meterMax) / RULES.meterMax;
    const side = COLORS.side[i];
    g.save();
    g.shadowColor = full ? side.glow : 'rgba(0,0,0,0.5)';
    g.shadowBlur = (full ? 10 : 6) * VIEW.SCALE;
    parallelogram(g, x - 1.5, y - 1.5, MW + 3, MH + 3, sk);
    g.fillStyle = 'rgba(8, 10, 30, 0.88)';
    g.fill();
    g.restore();
    g.save();
    parallelogram(g, x, y, MW, MH, sk);
    g.clip();
    g.fillStyle = '#10142e';
    g.fillRect(x - 6, y, MW + 12, MH);
    const w = MW * frac;
    const fx = left ? x - 6 : x + MW + 6 - w - 6;
    if (full) {
      for (let k = 0; k < MW + 12; k += 6) {
        g.fillStyle = RAINBOW[(Math.floor(k / 6) + Math.floor(frame / 3)) % RAINBOW.length];
        g.fillRect(left ? x - 6 + k : x + MW + 6 - k - 6, y, 6, MH);
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x - 6, y, MW + 12, MH * 0.4);
    } else if (w > 0) {
      g.fillStyle = vgrad(g, y, y + MH, [[0, '#9fe8ff'], [0.5, '#3ec1ff'], [1, '#1f7bdc']]);
      g.fillRect(fx, y, w + 6, MH);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(fx, y, w + 6, MH * 0.35);
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let k = 1; k < 4; k++) g.fillRect(x + (MW * k) / 4, y, 0.6, MH);
    g.restore();
    parallelogram(g, x, y, MW, MH, sk);
    g.lineWidth = 0.7;
    g.strokeStyle = full ? '#ffffff' : 'rgba(255,255,255,0.4)';
    g.stroke();
    const label = full ? '★ SPECIAL READY' : 'SPECIAL';
    const pulse = full ? 0.6 + 0.4 * Math.sin(frame * 0.3) : 1;
    drawText(g, label, left ? x + 2 : x + MW - 2, y - 10, {
      scale: 1.05, align: left ? 'left' : 'right', color: full ? '#fff3a0' : COLORS.dim, shadow: 'rgba(0,0,0,0.7)',
      alpha: pulse, glow: full ? '#ffb62e' : undefined,
    });
  }

  portrait(g, f, i, bank, frame) {
    const p = bank.portrait(f.def.id);
    const left = i === 0;
    const x = left ? 11 : W - 11 - PORT_W, y = 6;
    const side = COLORS.side[i];
    const flashing = this.hit[i] > 6;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 8 * VIEW.SCALE;
    rrPath(g, x - 2, y - 2, PORT_W + 4, PORT_H + 4, 6);
    g.fillStyle = vgrad(g, y, y + PORT_H, [[0, side.a], [1, side.b]]);
    g.fill();
    g.restore();
    g.save();
    rrPath(g, x, y, PORT_W, PORT_H, 4.5);
    g.clip();
    g.fillStyle = vgrad(g, y, y + PORT_H, [[0, '#4a5a9a'], [1, '#1c2250']]);
    g.fillRect(x, y, PORT_W, PORT_H);
    if (p) drawPortrait(g, p, x, y, PORT_W, PORT_H, !left);
    if (flashing) {
      g.fillStyle = 'rgba(255,60,60,0.35)';
      g.fillRect(x, y, PORT_W, PORT_H);
    }
    g.fillStyle = vgrad(g, y, y + PORT_H, [[0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
    g.fillRect(x, y, PORT_W, PORT_H);
    g.restore();
    rrPath(g, x, y, PORT_W, PORT_H, 4.5);
    g.lineWidth = 0.8;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.stroke();
  }
}

/** ROUND 1 / FIGHT! / K.O. / X WINS banners. */
export function drawAnnounce(g, ann, frame) {
  if (!ann) return;
  const t = ann.t;
  const cy = 112;
  const band = (h, a, c0 = 'rgba(6,8,26,0.0)', c1 = 'rgba(6,8,26,0.78)') => {
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, c0);
    gr.addColorStop(0.2, c1);
    gr.addColorStop(0.8, c1);
    gr.addColorStop(1, c0);
    g.save();
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.fillRect(0, cy - h / 2, W, h);
    g.restore();
  };
  const streak = (a, col) => {
    g.save();
    g.globalAlpha = a;
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, col);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, cy - 28, W, 1);
    g.fillRect(0, cy + 28, W, 1);
    g.restore();
  };
  if (ann.kind === 'round') {
    const slide = clamp01(t / 16);
    const out = clamp01((t - 70) / 12);
    const x = -140 + (W / 2 + 140) * easeOut(slide);
    band(54, slide * (1 - out));
    streak(slide * (1 - out), 'rgba(150,190,255,0.9)');
    drawText(g, ann.text, x, cy - 20, { scale: 5.6, align: 'center', color: ['#ffffff', '#e8eeff', '#9bb4ff'], outline: '#0a0d2a', glow: 'rgba(120,150,255,0.9)', alpha: 1 - out });
  } else if (ann.kind === 'fight') {
    const k = clamp01(t / 12);
    const s = 9.5 - (1 - easeOutBack(k)) * 5 + (t > 30 ? (t - 30) * 0.05 : 0);
    const fade = 1 - clamp01((t - 34) / 14);
    band(64, 0.7 * fade, 'rgba(70,10,10,0)', 'rgba(40,6,10,0.8)');
    glow(g, W / 2, cy, 150, '#ff7a2a', 0.35 * fade);
    drawText(g, ann.text, W / 2, cy - (7 * s) / 2, { scale: s, align: 'center', color: ['#fff6c0', '#ffd23f', '#ff7a1a', '#e0240e'], outline: '#220606', glow: '#ff6a1a', alpha: fade });
  } else if (ann.kind === 'ko') {
    if (t < 4 || (t < 30 && t % 8 < 4)) {
      g.fillStyle = 'rgba(255, 32, 32, 0.2)';
      g.fillRect(0, 0, W, H);
    }
    const k = clamp01(t / 10);
    const s = (ann.text.length > 5 ? 6.2 : 10.5) * (1 + (1 - easeOutBack(k)) * 0.6);
    band(78, 0.75 * k, 'rgba(70,0,10,0)', 'rgba(30,0,8,0.85)');
    glow(g, W / 2, cy, 170, '#ff2a2a', 0.4 * k);
    drawText(g, ann.text, W / 2, cy - (7 * s) / 2, { scale: s, align: 'center', color: ['#ffffff', '#ffb0a8', '#ff3b30', '#a00010'], outline: '#1a0206', glow: '#ff2a2a' });
  } else if (ann.kind === 'wins') {
    const k = clamp01(t / 14);
    const s = textWidth(ann.text, 5) > W - 30 ? 3.6 : 5;
    band(54, 0.8 * k);
    streak(k, 'rgba(255,220,120,0.9)');
    drawText(g, ann.text, W / 2, cy - (7 * s) / 2, { scale: s, align: 'center', color: ['#ffffff', '#fff3a0', '#ffd23f'], outline: '#1a1004', glow: '#ffb62e', alpha: k });
  }
}

/** Special-move cut-in: a dark band with the caster popping out of it, and the move's name. */
export function drawCutIn(g, f, bank, t, total) {
  const k = t / total; // 1..0 remaining
  const slide = easeOut(clamp01((total - t) / 8));
  const left = f.side === 0;
  const side = COLORS.side[f.side];
  const y = 74, h = 62;
  g.fillStyle = `rgba(2, 3, 16, ${0.5 * slide})`;
  g.fillRect(0, 0, W, H);
  // band
  g.save();
  g.translate(0, 0);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, 'rgba(10,12,36,0.96)');
  gr.addColorStop(1, 'rgba(4,5,20,0.96)');
  g.fillStyle = gr;
  g.fillRect(0, y, W * slide, h);
  // team colour slash
  g.save();
  g.beginPath();
  g.rect(0, y, W, h);
  g.clip();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const sx = (left ? 1 : -1) * (i * 54 - (total - t) * 5) + (left ? 60 : W - 150);
    const gr2 = g.createLinearGradient(sx, 0, sx + 30, 0);
    gr2.addColorStop(0, 'rgba(0,0,0,0)');
    gr2.addColorStop(0.5, side.glow + (i === 0 ? '88' : '44'));
    gr2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr2;
    parallelogram(g, sx, y, 30, h, 28);
    g.fill();
  }
  g.restore();
  g.fillStyle = side.a;
  g.fillRect(0, y - 1, W * slide, 1.2);
  g.fillRect(0, y + h - 0.2, W * slide, 1.2);
  g.restore();
  // the caster, popping out of the band (never cropped)
  const figX = left ? -50 + 120 * slide : W + 50 - 120 * slide;
  drawFighterArt(g, bank, f.def.id, figX, y + h + 22, 142, !left);
  // text
  const name = f.def.special.name;
  const tx = left ? 150 : W - 150;
  const al = left ? 'left' : 'right';
  drawText(g, `${f.def.name}'S SPECIAL`, tx, y + 8, { scale: 1.3, align: al, color: side.b, shadow: 'rgba(0,0,0,0.7)' });
  drawText(g, name, tx, y + 21, { scale: 4.2, align: al, color: GOLD_STOPS, outline: '#150a04', glow: side.glow, alpha: slide });
  void k;
}
const GOLD_STOPS = ['#ffffff', '#fff3a0', '#ffd23f', '#ff9b2e'];
