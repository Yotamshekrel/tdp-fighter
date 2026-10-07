// NETHANEL — "Lekader!": points at the other fighter and makes them give a lecture in the
// guild. They're stuck behind a lectern in front of a projector screen while the slides about
// KADER (noun) / LEKADER (verb) click by, and every slide hurts. It's a grab: can't be blocked,
// but you can jump out of it while Nethanel is still winding up. It's a virtual lecture: the
// victim gets a MacBook on the lectern, headphones and a boom mic.
import { spHit, SD, eyePos, mouthPos } from './helpers.js';
import { INK } from '../../render/fx-kit.js';
import { drawText, textWidth } from '../../render/font.js';
import { rand } from '../rng.js';

const SLIDES = [
  { title: 'LEKADER 101', lines: [0.8, 0.55, 0.65] },
  { title: 'WHAT IS A KADER?', lines: [0.9, 0.7, 0.4] },
  { title: 'HOW TO LEKADER', lines: [0.6, 0.85, 0.75] },
  { title: 'Q&A: KADER?', lines: [0.5, 0.3, 0.7] },
];
const EVERY = 26; // frames per slide
const BORE_DMG = SD * 0.2;
const FINAL_DMG = SD - BORE_DMG * (SLIDES.length - 1);
const WOOD = '#8a5a34', WOOD_DARK = '#5a3a20', WOOD_LIGHT = '#b07a48';

function drawLectern(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(x - 12 * s - 1, y - 27 * s - 1, 24 * s + 2, 27 * s + 2);
  ctx.fillStyle = WOOD;
  ctx.fillRect(x - 12 * s, y - 27 * s, 24 * s, 27 * s);
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x - 12 * s, y - 27 * s, 24 * s, 3 * s);
  ctx.fillStyle = WOOD_LIGHT;
  ctx.fillRect(x - 12 * s, y - 24 * s, 24 * s, 1 * s);
  // a little guild crest on the front
  ctx.fillStyle = '#e8b923';
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y - 18 * s);
  ctx.lineTo(x + 4 * s, y - 18 * s);
  ctx.lineTo(x + 4 * s, y - 11 * s);
  ctx.lineTo(x, y - 7 * s);
  ctx.lineTo(x - 4 * s, y - 11 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** An open laptop (we see the silver back of the lid) standing on the lectern, with its glowing logo. */
function drawLaptop(ctx, x, y, s, k) {
  const w = 22 * s, h = 14 * s;
  ctx.save();
  // lid
  ctx.fillStyle = INK;
  ctx.fillRect(x - w / 2 - 1, y - h - 1, w + 2, h + 1);
  ctx.fillStyle = '#c9ced8';
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#e6e9f0';
  ctx.fillRect(x - w / 2, y - h, w, 1.5 * s);
  ctx.fillStyle = '#9aa0ad';
  ctx.fillRect(x - w / 2, y - 1.6 * s, w, 1.6 * s); // hinge / base edge
  // the glowing logo
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(k * 6.3);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.5, 1.7 * s, 0, 6.3);
  ctx.fill();
  ctx.restore();
}

/** Over-ear headphones with a boom mic reaching the mouth, on the victim's head. */
function drawHeadset(ctx, opp) {
  const sc = opp.scale;
  const eye = eyePos(opp), mouth = mouthPos(opp);
  const cx = eye.x - opp.facing * 2.5 * sc, cy = eye.y - 1 * sc; // middle of the head
  const r = 9.5 * sc;
  ctx.save();
  ctx.lineCap = 'round';
  // headband over the top
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4 * sc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = '#3a3f52';
  ctx.lineWidth = 2 * sc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.stroke();
  // ear cups
  const cups = [cx - r, cx + r];
  for (const ex of cups) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(ex, cy + 2 * sc, 3.4 * sc, 4.8 * sc, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e8416a';
    ctx.beginPath();
    ctx.ellipse(ex, cy + 2 * sc, 2.4 * sc, 3.8 * sc, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#ff9ab4';
    ctx.fillRect(ex - 0.6 * sc, cy - 0.6 * sc, 1.2 * sc, 2 * sc);
  }
  // boom mic from the cup nearest the camera down to the mouth
  const ex = cx + opp.facing * r, ey = cy + 5 * sc;
  const mx = mouth.x + opp.facing * 2.5 * sc, my = mouth.y + 1.5 * sc;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2 * sc;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.quadraticCurveTo(ex + opp.facing * 1 * sc, my + 3 * sc, mx, my);
  ctx.stroke();
  ctx.strokeStyle = '#3a3f52';
  ctx.lineWidth = 1 * sc;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.quadraticCurveTo(ex + opp.facing * 1 * sc, my + 3 * sc, mx, my);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(mx, my, 2.4 * sc, 0, 6.3);
  ctx.fill();
  ctx.fillStyle = '#7a7f92';
  ctx.beginPath();
  ctx.arc(mx, my, 1.6 * sc, 0, 6.3);
  ctx.fill();
  ctx.restore();
}

function drawScreen(ctx, x, y, s, slide, k) {
  const w = 70 * s, h = 40 * s;
  const x0 = x - w / 2, y0 = y - h;
  ctx.save();
  // the beam from the projector in the ceiling
  ctx.fillStyle = 'rgba(190,220,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, 0);
  ctx.lineTo(x + 4 * s, 0);
  ctx.lineTo(x0 + w, y0 + h);
  ctx.lineTo(x0, y0 + h);
  ctx.closePath();
  ctx.fill();
  // frame + white screen
  ctx.fillStyle = INK;
  ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = '#f6f8ff';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = '#2a4fd0';
  ctx.fillRect(x0, y0, w, 10 * s);
  const ts = Math.min(1.05 * s, ((w - 6 * s) / textWidth(slide.title, 1))); // long titles shrink to fit the bar
  drawText(ctx, slide.title, x, y0 + 2 * s, { scale: ts, align: 'center', color: '#ffffff', weight: 800 });
  // it's a call: red LIVE dot in the corner
  ctx.fillStyle = k % 0.5 < 0.25 ? '#ff2a3a' : '#a01020';
  ctx.beginPath();
  ctx.arc(x0 + w - 20 * s, y0 + h - 4.2 * s, 1.5 * s, 0, 6.3);
  ctx.fill();
  drawText(ctx, 'LIVE', x0 + w - 5 * s, y0 + h - 6.4 * s, { scale: 0.8 * s, align: 'right', color: '#d01830', weight: 800 });
  // "bullet points": bars that fill in from the left as the slide plays
  slide.lines.forEach((len, i) => {
    const by = y0 + (14.5 + i * 7) * s;
    ctx.fillStyle = '#2a4fd0';
    ctx.fillRect(x0 + 6 * s, by, 2.4 * s, 2.4 * s);
    ctx.fillStyle = '#9aa6c8';
    ctx.fillRect(x0 + 12 * s, by, (w - 20 * s) * len * Math.min(1, k * 4 - i * 0.6 + 0.2), 2.4 * s);
  });
  ctx.restore();
}

export default {
  windup: 40,
  duration: 190,
  aiRange: [40, 300],
  escape: 'jump', // hint for the CPU: it can't be blocked, so jump away
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: 'raise', frame: Math.floor(t / 8) % 2 };
    if (s.phase === 'lecture') return { pose: 'cast', frame: Math.floor((t - s.at) / 13) % 2 };
    return { pose: 'cast', frame: 0 };
  },

  start(f, b) {
    b.fx.text('LEKADER!', f.x, f.y - 98 * f.scale, { color: '#ffd23f', scale: 2, life: 44 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) {
      if (t % 6 === 0) b.fx.spawn('star', f.x + f.facing * 14 * f.scale, f.y - 64 * f.scale, { vx: f.facing * (0.5 + rand()), vy: -0.5 - rand(), life: 20, size: 2, color: '#ffd23f' });
      return;
    }
    if (t === this.windup) s.phase = 'summon';
    if (s.phase === 'summon') {
      // the summon lands if they are on the ground during a short window after the wind-up (jump to dodge it)
      const grabbable = opp.grounded && !opp.isInvulnerable() && opp.state !== 'ko';
      if (grabbable) {
        s.phase = 'lecture';
        s.at = t;
        s.n = 0;
        opp.go('hitstun');
        opp.stun = { left: 999, knockdown: false, phase: 'stun' };
        opp.attack = null;
        opp.held = true;
        opp.vx = opp.vy = 0;
        opp.facing = -f.facing;
        b.sfx('grab', f.x);
        b.fx.text("YOU'RE ON MUTE!", f.x, f.y - 98 * f.scale, { bubble: true, life: 40 });
        b.fx.burst('star', opp.x, opp.y - 40 * opp.scale, 8, { color: '#ffd23f', speed: 2, vy: -1, life: 24 });
      } else if (t > this.windup + 24) {
        s.phase = 'whiff';
        s.at = t;
        b.fx.text('NO ONE CAME...', f.x, f.y - 92 * f.scale, { bubble: true, life: 36 });
      }
      return;
    }
    if (s.phase === 'lecture') {
      f.vx = 0;
      const k = t - s.at;
      const slide = Math.min(SLIDES.length - 1, Math.floor(k / EVERY));
      if (k % EVERY === 0 && k > 0 && s.n < SLIDES.length - 1) b.sfx('slap', f.x); // slide change click
      // snoring in the audience
      if (t % 12 === 0) b.fx.text('Z', f.x + f.facing * (6 + rand() * 8) * f.scale, f.y - 84 * f.scale, { color: '#bcd0ff', life: 30, vy: -0.4 });
      // every slide bores them a little more; the last one lands the knockdown
      if (k % EVERY === EVERY - 6 && s.n < SLIDES.length) {
        s.n++;
        const last = s.n === SLIDES.length;
        opp.squish = 8;
        if (last) opp.held = false;
        b.resolveHit(f, opp, spHit({
          damage: last ? FINAL_DMG : BORE_DMG, guard: 'unblockable', hitstun: 999, push: last ? 5 : 0, launch: last ? 5 : 0,
          knockdown: last, shake: last ? 5 : 0, hitstop: last ? 10 : 4, sfx: last ? 'smash' : 'bonk',
        }), f.x, opp.x, opp.y - 50 * opp.scale);
        if (!last) opp.held = opp.state !== 'ko';
        b.fx.text(last ? 'KADER!!' : 'KADER!', (f.x + opp.x) / 2, f.y - 100 * f.scale, { color: '#ffd23f', life: 22, scale: last ? 1.6 : 1 });
        if (last) b.fx.text('SO BORING!', opp.x, opp.y - 110 * opp.scale, { bubble: true, life: 36 });
        s.fin = last ? t : 0;
      }
      if (opp.state === 'ko') {
        s.phase = 'done';
        s.at = t;
        return;
      }
      if (s.fin && t - s.fin > 20) f.endSpecial(b);
      return;
    }
    if ((s.phase === 'whiff' || s.phase === 'done') && t - s.at > 18) f.endSpecial(b);
  },

  end(f, b) {
    const opp = b?.opponentOf(f);
    if (opp && opp.held) {
      opp.held = false;
      if (opp.state === 'hitstun' && opp.stun) opp.stun.left = 10;
    }
  },

  draw(ctx, f, b, t) {
    const s = f.sd;
    const opp = b.opponentOf(f);
    if (s.phase !== 'lecture' || !opp) return;
    const k = t - s.at;
    const slide = Math.min(SLIDES.length - 1, Math.floor(k / EVERY));
    const kk = (k % EVERY) / EVERY;
    const sc = opp.scale;
    drawScreen(ctx, opp.x, opp.y - 100 * sc, 1, SLIDES[slide], kk);
    drawLectern(ctx, opp.x, opp.y, sc);
    drawLaptop(ctx, opp.x, opp.y - 27 * sc, sc, k / 60);
    drawHeadset(ctx, opp);
  },
};
