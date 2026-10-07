// NOA T. — "MANDATORY PLE": assigns the other fighter their yearly online training. A "NEW
// ASSIGNMENT" notification pops over their head, then course windows (cyber security, data privacy,
// fire safety, code of conduct) rain down and home in on them, each stuck at 99%. And since she
// sends a feedback form after every lecture, the finale is a giant FEEDBACK FORM that slams down
// with its five stars filling in.
import { Entity } from '../entities.js';
import { spHit, SD, handPos, bodyCenter, clamp, VIEW, SC } from './helpers.js';
import { inked, lingrad, bloomAt, INK } from '../../render/fx-kit.js';
import { drawText, textWidth } from '../../render/font.js';
import { rand } from '../rng.js';

const COURSES = [
  { title: 'CYBER SECURITY', col: '#2f6df0', col2: '#1a3a90' },
  { title: 'DATA PRIVACY', col: '#8a3df0', col2: '#4f1a9a' },
  { title: 'FIRE SAFETY', col: '#e8502a', col2: '#9a2210' },
  { title: 'CODE OF CONDUCT', col: '#1fa874', col2: '#0e6a48' },
];
const EVERY = 15; // frames between course windows
const FORM_AT = COURSES.length * EVERY + 6; // the feedback form follows the last course
const COURSE_DMG = SD * 0.15;
const FORM_DMG = SD - COURSE_DMG * COURSES.length;
const GROUND = VIEW.GROUND_Y;

export default {
  windup: 36,
  duration: 130,
  aiRange: [0, 999],
  anim(f, t) {
    if (t < this.windup) return { pose: 'raise', frame: Math.floor(t / 6) % 2 }; // holding up the tablet
    const k = t - this.windup;
    return { pose: 'cast', frame: k % EVERY < 5 ? 1 : 0 };
  },

  start(f, b) {
    b.fx.text('PLE TIME!', f.x, f.y - 98 * f.scale, { color: ['#ffffff', '#7fb2ff'], life: 46 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t === this.windup - 12) b.sfx('magic', opp.x); // the notification ping
    if (t < this.windup) return;
    const k = t - this.windup;
    s.n = s.n || 0;
    if (s.n < COURSES.length && k % EVERY === 2) {
      spawnWindow(f, b, opp, COURSES[s.n], false);
      s.n++;
    } else if (s.n === COURSES.length && k >= FORM_AT) {
      s.n++;
      s.last = spawnWindow(f, b, opp, null, true);
      b.fx.text('PLEASE RATE US!', f.x, f.y - 98 * f.scale, { bubble: true, life: 40 });
    }
    if (s.last && s.last.dead) f.endSpecial(b);
  },

  draw(ctx, f, b, t) {
    const opp = b.opponentOf(f);
    // the tablet in her hand, with the PLE logo
    const h = f.vis?.hand ? handPos(f) : null;
    if (h) {
      ctx.save();
      ctx.translate(h.x, h.y - 5);
      ctx.rotate(-0.15 * f.facing);
      ctx.scale(f.facing * 0.9, 0.9);
      inked(ctx, '#2a2e3c', (c) => c.roundRect(-5.5, -8, 11, 15, 1.4), 0.8);
      ctx.fillStyle = lingrad(ctx, 0, -7, 0, 6, [[0, '#4f8cff'], [1, '#1f3fa0']]);
      ctx.fillRect(-4.4, -6.8, 8.8, 12.6);
      drawText(ctx, 'PLE', 0, -4.2, { scale: 0.62, align: 'center', color: '#ffffff', weight: 800, italic: false });
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-3.2, 1.2, 6.4, 1.2);
      ctx.restore();
    }
    // the notification toast pops up over the opponent's head
    if (opp && t >= this.windup - 12 && t < this.windup + 8) {
      const k = t - (this.windup - 12);
      const pop = Math.min(1, k / 6);
      const fade = clamp((this.windup + 8 - t) / 6, 0, 1);
      const x = opp.x, y = opp.y - 128 * opp.scale;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y - (1 - pop) * 10);
      ctx.scale(pop, pop);
      const w = 70, hgt = 20;
      inked(ctx, '#f6f8ff', (c) => c.roundRect(-w / 2, -hgt / 2, w, hgt, 3), 1);
      ctx.fillStyle = '#2f6df0';
      ctx.fillRect(-w / 2 + 2, -hgt / 2 + 2, 3, hgt - 4);
      drawText(ctx, 'NEW ASSIGNMENT', 3, -hgt / 2 + 3, { scale: 0.75, align: 'center', color: '#14101e', weight: 800, italic: false });
      drawText(ctx, 'PLE - DUE: YESTERDAY', 3, 2, { scale: 0.62, align: 'center', color: '#d01830', weight: 700, italic: false });
      ctx.fillStyle = '#ff2a3a'; // unread badge
      ctx.beginPath(); ctx.arc(w / 2 - 1, -hgt / 2 + 1, 4, 0, 6.3); ctx.fill();
      drawText(ctx, '1', w / 2 - 1, -hgt / 2 - 2.2, { scale: 0.7, align: 'center', color: '#ffffff', weight: 800, italic: false });
      ctx.restore();
    }
  },
};

/** One falling window (a course or the feedback form). It drifts toward the opponent as it falls. */
function spawnWindow(f, b, opp, course, form) {
  const c = bodyCenter(opp);
  const big = form;
  const k = big ? 1.1 : 1.4; // on-screen enlargement of the art
  const w = (big ? 40 : 34) * k * SC, h = (big ? 50 : 24) * k * SC;
  const confetti = course ? [course.col, '#ffffff'] : ['#ffd23f', '#ffffff', '#2f6df0'];
  b.sfx('throw', f.x);
  return b.spawn(new Entity({
    owner: f, x: opp.x + (rand() - 0.5) * 50, y: big ? -34 : -18, vy: big ? 4.2 : 4.8, gravity: big ? 0.3 : 0.32,
    w: w * 0.8, h: h * 0.8, life: 140, vscale: SC, spin: 0,
    hit: spHit(big
      ? { damage: FORM_DMG, hitstun: 26, blockstun: 16, push: 5, hitstop: 12, knockdown: true, shake: 5, sfx: 'smash' }
      : { damage: COURSE_DMG, hitstun: 18, blockstun: 12, push: 1.2, hitstop: 5, sfx: 'bonk' }),
    onUpdate(e, bb) {
      const o = bb.opponentOf(f);
      if (o && e.y < GROUND - 70) e.vx = clamp((o.x - e.x) * 0.08, big ? -1.7 : -2.4, big ? 1.7 : 2.4);
      else e.vx *= 0.8;
    },
    onHit(e, bb) { burst(bb, e.x, e.y, confetti, big); },
    onGround(e, bb) { e.dead = true; burst(bb, e.x, e.y + 4, confetti, big); },
    draw(ctx, e) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(k, k);
      if (big) feedbackForm(ctx, e.t);
      else courseWindow(ctx, course, e.t);
      ctx.restore();
    },
  }));
}

function burst(b, x, y, colors, big) {
  b.fx.burst('confetti', x, y, big ? 16 : 8, { colors, speed: big ? 3.4 : 2.4, g: 0.12, life: big ? 34 : 22 });
  b.sfx(big ? 'coin' : 'bonk', x);
  if (big) b.fx.text('THANKS FOR YOUR FEEDBACK!', clamp(x, 110, VIEW.W - 110), y - 36, { color: ['#fff6a0', '#ffd23f'], life: 44 });
}

/** A learning-portal window, ~34 x 24 units, centred on (0, 0): title bar, text lines, a progress bar stuck at 99%. */
function courseWindow(c, course, t) {
  const x0 = -17, y0 = -12, w = 34, h = 24;
  bloomAt(c, 0, 0, 24, course.col, 0.22);
  inked(c, '#f6f8ff', (p) => p.roundRect(x0, y0, w, h, 1.6), 0.9);
  c.fillStyle = lingrad(c, 0, y0, 0, y0 + 6, [[0, course.col], [1, course.col2]]);
  c.fillRect(x0 + 0.4, y0 + 0.4, w - 0.8, 5.6);
  const ts = Math.min(0.6, (w - 14) / textWidth(course.title, 1));
  drawText(c, course.title, x0 + 3, y0 + 1.2, { scale: ts, color: '#ffffff', weight: 800, italic: false });
  c.fillStyle = '#ff4a5a'; // the close button that never closes
  c.fillRect(x0 + w - 5.4, y0 + 1, 4, 4);
  c.fillStyle = '#ffffff';
  c.fillRect(x0 + w - 4.6, y0 + 2.8, 2.4, 0.6);
  // video placeholder with a play triangle, and text lines
  c.fillStyle = '#dde3f5';
  c.fillRect(x0 + 2, y0 + 8, 13, 8);
  c.fillStyle = course.col;
  c.beginPath(); c.moveTo(x0 + 6.4, y0 + 9.6); c.lineTo(x0 + 6.4, y0 + 14.4); c.lineTo(x0 + 10.6, y0 + 12); c.closePath(); c.fill();
  c.fillStyle = '#9aa6c8';
  for (let i = 0; i < 3; i++) c.fillRect(x0 + 17, y0 + 8.4 + i * 2.8, 12 - i * 2.4, 1.2);
  // progress bar fills, then freezes at 99%
  const pct = Math.min(99, Math.floor(t * 5));
  c.fillStyle = '#c6cde4';
  c.fillRect(x0 + 2, y0 + 18, 20, 2.4);
  c.fillStyle = pct >= 99 ? '#ffb62e' : '#3ec97a';
  c.fillRect(x0 + 2, y0 + 18, 20 * pct / 100, 2.4);
  drawText(c, `${pct}%`, x0 + 24, y0 + 16.8, { scale: 0.55, color: '#14101e', weight: 800, italic: false });
  // NEXT button
  c.fillStyle = course.col;
  c.fillRect(x0 + w - 11, y0 + 17.4, 9.6, 4.4);
  drawText(c, 'NEXT', x0 + w - 6.2, y0 + 18.2, { scale: 0.5, align: 'center', color: '#ffffff', weight: 800, italic: false });
}

/** The feedback form, ~40 x 50 units, centred on (0, 0): a paper with five stars that fill in as it falls. */
function feedbackForm(c, t) {
  const x0 = -20, y0 = -25, w = 40, h = 50;
  bloomAt(c, 0, 0, 34, '#ffd23f', 0.28);
  inked(c, lingrad(c, 0, y0, 0, y0 + h, [[0, '#ffffff'], [1, '#e4e8f4']]), (p) => p.roundRect(x0, y0, w, h, 1.8), 1);
  c.fillStyle = '#2f6df0';
  c.fillRect(x0 + 0.5, y0 + 0.5, w - 1, 8);
  drawText(c, 'FEEDBACK FORM', 0, y0 + 1.6, { scale: 0.8, align: 'center', color: '#ffffff', weight: 800, italic: false });
  drawText(c, 'HOW WAS THE LECTURE?', 0, y0 + 11, { scale: 0.58, align: 'center', color: '#14101e', weight: 700, italic: false });
  // five stars, filling in one after the other
  const lit = Math.min(5, Math.floor(t / 4));
  for (let i = 0; i < 5; i++) {
    drawText(c, '★', x0 + 5.6 + i * 7.2, y0 + 17, { scale: 1.3, align: 'center', color: i < lit ? '#ffc21a' : '#c8cde0', outline: i < lit ? INK : undefined, weight: 800, italic: false });
  }
  // a few more questions: tick boxes and lines
  for (let i = 0; i < 3; i++) {
    const by = y0 + 28 + i * 5.4;
    c.fillStyle = '#ffffff';
    c.fillRect(x0 + 4, by, 3.4, 3.4);
    c.strokeStyle = INK;
    c.lineWidth = 0.5;
    c.strokeRect(x0 + 4, by, 3.4, 3.4);
    if (t > 8 + i * 5) {
      c.strokeStyle = '#1fa874';
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(x0 + 4.6, by + 1.8); c.lineTo(x0 + 5.6, by + 2.8); c.lineTo(x0 + 7.4, by + 0.4); c.stroke();
    }
    c.fillStyle = '#9aa6c8';
    c.fillRect(x0 + 9.4, by + 1, 20 - i * 3, 1.3);
  }
  // SUBMIT
  c.fillStyle = '#ff7a1a';
  c.fillRect(x0 + w - 17, y0 + h - 7.6, 14, 5);
  drawText(c, 'SUBMIT', x0 + w - 10, y0 + h - 6.9, { scale: 0.58, align: 'center', color: '#ffffff', weight: 800, italic: false });
}
