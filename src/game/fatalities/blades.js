// Fatalities that cut: Yotam (lasers), Ofek (trophy boomerang), Noa (baguette guillotine),
// Ben (sprint finish) and Nethanel (death by PowerPoint). See runtime.js for the shape of a fatality.
import { BODY } from '../../config.js';
import { eyePos, handPos } from '../specials/helpers.js';
import { glowLine, bloomAt, inked, INK } from '../../render/fx-kit.js';
import { drawText } from '../../render/font.js';
import { GY, NECK, WAIST, at, ease, lerp, prog, slabs, slice, strips, decap, free, topple, spray, chunks, geyser, lens, cutFx, randRange } from './kit.js';

const SC = BODY.SCALE;

// ---- YOTAM: laser surgery -----------------------------------------------------------------------------------
const CUTS = [
  { t0: 14, t1: 40, y: NECK },
  { t0: 48, t1: 68, y: -38 },
  { t0: 76, t1: 96, y: WAIST },
];

export const yotam = {
  name: 'LASIK',
  dist: 110,
  zoom: 1.2,
  duration: 150,
  killAt: 40,
  start(w, l, b) {
    w.costume = { eyes: 'laser' };
    b.sfx('charge', w.x);
    b.fx.text('LASER EYES!', w.x, w.y - 100 * w.scale, { color: '#ff5050', life: 40 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = { pose: 'charge', frame: t > 10 ? 1 : 0 };
    d.beam = CUTS.find((c) => t >= c.t0 && t <= c.t1) || null;
    if (d.beam && t % 5 === 0) b.sfx('laser', w.x);
    if (t === 40) {
      d.p = slabs(l, [[NECK, 5], [-38, 9], [WAIST, 9]]);
      free(d.p[0], { vx: fw * 2, vy: -6.5, vr: fw * 0.18 });
      cutFx(b, l, NECK, 20, { shake: 6 });
    }
    if (d.p && t > 40 && t < 68 && t % 2 === 0) {
      const p = at(l, 0, NECK);
      geyser(b, p.x, p.y + 2, 0.75);
    }
    if (t === 68) {
      free(d.p[1], { vx: -fw * 2.6, vy: -4.5, vr: -fw * 0.12 });
      cutFx(b, l, -38, 16);
    }
    if (t === 96) {
      free(d.p[2], { vx: fw * 2.8, vy: -3, vr: fw * 0.15 });
      topple(l, d.p[3], -fw);
      cutFx(b, l, WAIST, 16);
      lens(b, 3);
    }
  },
  draw(g, w, l, b, t, F) {
    const c = F.d.beam;
    if (!c) return;
    const k = prog(t, c.t0, c.t1);
    const e = eyePos(w);
    const x = l.x + w.facing * (22 - 44 * k), y = GY + c.y * SC;
    glowLine(g, e.x, e.y, x, y, 2.8, { glow: '#ff1a2a', mid: '#ff4a4a', core: '#ffffff' });
    bloomAt(g, e.x, e.y, 14, '#ff3b3b', 0.9);
    bloomAt(g, x, y, 12 + Math.sin(t * 2) * 2, '#ff6a5a', 0.95);
    // the whole line the beam has already burned
    glowLine(g, l.x + w.facing * 22, y, x, y, 1.1, { glow: '#ff2a2a', mid: '#ff6a5a', core: '#fff0e8', a: 0.8 });
  },
};

// ---- OFEK: the Captain's Cup, boomerang style ---------------------------------------------------------------
function drawTrophy(g, x, y, rot, bloody) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.strokeStyle = INK;
  g.lineWidth = 2.6;
  g.beginPath();
  g.arc(-6.6, -3.6, 3.1, Math.PI * 0.5, Math.PI * 1.5);
  g.arc(6.6, -3.6, 3.1, -Math.PI * 0.5, Math.PI * 0.5);
  g.stroke();
  g.strokeStyle = '#e0a21a';
  g.lineWidth = 1.3;
  g.beginPath();
  g.arc(-6.6, -3.6, 3.1, Math.PI * 0.5, Math.PI * 1.5);
  g.arc(6.6, -3.6, 3.1, -Math.PI * 0.5, Math.PI * 0.5);
  g.stroke();
  inked(g, '#f6cc3a', (c) => { c.moveTo(-6.4, -7.4); c.lineTo(6.4, -7.4); c.quadraticCurveTo(6.4, 2, 0, 4.2); c.quadraticCurveTo(-6.4, 2, -6.4, -7.4); c.closePath(); });
  inked(g, '#e0a21a', (c) => { c.rect(-1.2, 4, 2.4, 3.6); });
  inked(g, '#f6cc3a', (c) => { c.rect(-4.4, 7.4, 8.8, 2.6); });
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillRect(-4.6, -6.2, 1.4, 5);
  if (bloody) {
    g.fillStyle = '#b3101f';
    g.fillRect(-5.4, -7.4, 3.2, 5.4);
    g.fillRect(1.2, -7.4, 4.2, 3.2);
    g.beginPath();
    g.arc(-3.8, -2, 1.6, 0, 6.3);
    g.fill();
  }
  g.restore();
}

export const ofek = {
  name: "CAPTAIN'S CUP",
  dist: 150,
  zoom: 1.2,
  duration: 150,
  killAt: 34,
  start(w, l, b, F) {
    w.costume = { shirt: '#d71920', shirt2: '#ffffff', captain: true, prop: 'trophy' };
    b.fx.text("CAPTAIN'S CUP!", w.x, w.y - 100 * w.scale, { color: '#ffd23f', life: 40 });
    F.d.trophy = null;
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = t < 10 ? { pose: 'raise', frame: 0 } : t < 26 ? { pose: 'throw', frame: t < 14 ? 0 : 1 } : t < 86 ? { pose: 'idle', frame: 0 } : { pose: 'raise', frame: 0 };
    if (t === 10) {
      const h = handPos(w);
      d.hx = h.x;
      d.hy = h.y;
      d.far = h.x + fw * (Math.abs(l.x - h.x) + 130);
      w.costume = { shirt: '#d71920', shirt2: '#ffffff', captain: true, prop: null };
      b.sfx('throw', w.x);
    }
    if (t === 86) {
      w.costume = { shirt: '#d71920', shirt2: '#ffffff', captain: true, prop: 'trophy' };
      b.sfx('clang', w.x);
    }
    const neckY = GY + NECK * SC, waistY = GY + (WAIST - 6) * SC;
    // where the cup is: out along the neck, then back along the waist
    if (t >= 10 && t < 46) {
      const u = (t - 10) / 36;
      d.trophy = { x: lerp(d.hx, d.far, u), y: lerp(d.hy, neckY, ease(u * 3)) };
      if (!d.p && fw * (d.trophy.x - l.x) >= 0) {
        d.p = slabs(l, [[NECK, 5], [WAIST, 9]]);
        free(d.p[0], { vx: fw * 2.2, vy: -7, vr: fw * 0.2 });
        cutFx(b, l, NECK, 22, { angle: fw > 0 ? -0.5 : Math.PI + 0.5, shake: 6 });
        b.sfx('clang', l.x);
        d.bloody = true;
      }
    } else if (t >= 46 && t < 86) {
      const u = (t - 46) / 40;
      d.trophy = { x: lerp(d.far, d.hx, ease(u)), y: lerp(neckY, waistY, Math.min(1, u * 2)) };
      if (d.p && !d.cut2 && fw * (d.trophy.x - l.x) <= 0) {
        d.cut2 = true;
        free(d.p[1], { vx: -fw * 3.2, vy: -4.5, vr: -fw * 0.14 });
        topple(l, d.p[2], -fw);
        cutFx(b, l, WAIST, 18, { angle: fw > 0 ? Math.PI + 0.5 : -0.5 });
        lens(b, 3);
      }
    } else d.trophy = null;
    if (d.p && !d.cut2 && t % 2 === 0) {
      const p = at(l, 0, NECK);
      geyser(b, p.x, p.y + 2, 0.7);
    }
  },
  draw(g, w, l, b, t, F) {
    const tr = F.d.trophy;
    if (!tr) return;
    bloomAt(g, tr.x, tr.y, 14, '#ffd23f', 0.35);
    drawTrophy(g, tr.x, tr.y, t * 0.55, F.d.bloody);
  },
};

// ---- NOA: a baguette guillotine (oui oui!) ------------------------------------------------------------------
const BLADE_TOP = 52, BLADE_FALL = 34;

export const noa = {
  name: 'OFF WITH HIS HEAD',
  dist: 76,
  zoom: 1.3,
  duration: 150,
  killAt: 40,
  start(w, l, b) {
    w.costume = { hat: 'beret', stripes: true, prop: 'baguette' };
    b.fx.text('OUI OUI!', w.x, w.y - 100 * w.scale, { bubble: true, life: 46 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = t < BLADE_FALL ? { pose: 'raise', frame: Math.floor(t / 12) % 2 } : t < 70 ? { pose: 'throw', frame: 1 } : { pose: 'win', frame: 0 };
    if (t === BLADE_FALL) b.sfx('whoosh', l.x);
    if (t === 40) {
      const { head, body } = decap(l);
      d.body = body;
      free(head, { vx: fw * 0.9, vy: -2.6, vr: fw * 0.1, g: 0.34 });
      cutFx(b, l, NECK, 26, { shake: 8 });
      b.sfx('clang', l.x);
      lens(b, 3);
    }
    if (d.body && t > 40 && t < 110 && t % 2 === 0) {
      const p = at(l, 0, NECK);
      geyser(b, p.x, p.y + 2, 0.85, randRange(-0.2, 0.2));
    }
    if (t === 100) topple(l, d.body, fw);
    if (t === 52) b.fx.text('OUI OUI!', w.x, w.y - 98 * w.scale, { bubble: true, life: 40 });
  },
  drawBack(g, w, l) {
    // the frame: two posts, a beam and the base
    const x0 = l.x - 25, x1 = l.x + 25;
    for (const x of [x0, x1]) {
      inked(g, '#7a5230', (c) => c.rect(x - 3, BLADE_TOP - 8, 6, GY + 4 - (BLADE_TOP - 8)));
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x - 2, BLADE_TOP - 7, 1.2, GY - BLADE_TOP + 9);
    }
    inked(g, '#6a4528', (c) => c.rect(x0 - 5, BLADE_TOP - 14, x1 - x0 + 10, 8));
    inked(g, '#5a3a20', (c) => c.rect(x0 - 8, GY - 2, x1 - x0 + 16, 7));
  },
  draw(g, w, l, b, t) {
    const neckY = GY + NECK * SC;
    const k = prog(t, BLADE_FALL, BLADE_FALL + 6);
    const y = BLADE_TOP + (neckY + 3 - BLADE_TOP) * k * k;
    const x0 = l.x - 23, x1 = l.x + 23;
    // rope up to the winner's hand until the blade is let go
    const h = handPos(w);
    g.strokeStyle = '#d8c8a0';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(l.x + w.facing * -23, BLADE_TOP - 12);
    if (t < BLADE_FALL) g.lineTo(h.x, h.y);
    else g.quadraticCurveTo(l.x - w.facing * 30, BLADE_TOP + 30, h.x, h.y + 6);
    g.stroke();
    // the slanted blade
    g.save();
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.lineTo(x1, y + 7);
    g.lineTo(x0, y + 17);
    g.closePath();
    const gr = g.createLinearGradient(0, y, 0, y + 17);
    gr.addColorStop(0, '#f2f6ff');
    gr.addColorStop(0.5, '#b3bccd');
    gr.addColorStop(1, '#7f8aa0');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = INK;
    g.stroke();
    if (t > 40) {
      g.fillStyle = '#b3101f';
      g.beginPath();
      g.moveTo(x0 + 1, y + 14);
      g.lineTo(x1 - 1, y + 6);
      g.lineTo(x1 - 1, y + 7);
      g.lineTo(x0 + 1, y + 16);
      g.closePath();
      g.fill();
    }
    g.restore();
    // the basket the head drops into
    const bx = l.x + w.facing * 34;
    inked(g, '#b88a4a', (c) => { c.moveTo(bx - 12, GY - 20); c.lineTo(bx + 12, GY - 20); c.lineTo(bx + 9, GY + 6); c.lineTo(bx - 9, GY + 6); c.closePath(); });
    g.strokeStyle = 'rgba(70,40,10,0.5)';
    g.lineWidth = 0.7;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(bx - 11 + i * 0.4, GY - 20 + i * 6.5); g.lineTo(bx + 11 - i * 0.4, GY - 20 + i * 6.5); g.stroke(); }
    if (t > 60) { g.fillStyle = 'rgba(160,12,28,0.8)'; g.fillRect(bx - 11, GY - 20, 22, 3); }
  },
};

// ---- BEN: the sprint finish ---------------------------------------------------------------------------------
export const ben = {
  name: 'SPRINT FINISH',
  dist: 200,
  zoom: 1.0,
  duration: 120,
  killAt: 26,
  start(w, l, b) {
    w.costume = { hat: 'headband' };
    b.fx.text('SPRINT FINISH!', w.x, w.y - 100 * w.scale, { color: '#ffd23f', life: 40 });
    b.sfx('charge', w.x);
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    if (t < 16) {
      w.fpose = { pose: 'charge', frame: Math.floor(t / 5) % 2 };
      if (t % 4 === 0) b.fx.spawn('dust', w.x - fw * 8, GY - 2, { size: 3, grow: 0.3, life: 14, color: '#d8d0c0' });
      return;
    }
    if (t === 16) { d.speed = 17; b.sfx('dash', w.x); }
    const edge = fw > 0 ? 452 : 28;
    if (d.speed > 0.3) {
      w.x += fw * d.speed;
      if (fw * (w.x - edge) >= 0) { w.x = edge; d.speed = 0; d.skid = t; b.addShake(5); }
      if (d.cutT && t > d.cutT + 12) d.speed *= 0.88;
    }
    w.fpose = d.speed > 6 ? { pose: 'run', frame: Math.floor(t / 3) % 2 } : { pose: 'idle', frame: 0 };
    if (d.speed > 3) {
      b.fx.spawn('line', w.x - fw * 30, w.y - randRange(10, 70), { size: 4, life: 8, color: '#ffffff' });
      b.fx.spawn('dust', w.x - fw * 6, GY - 2, { size: 3, grow: 0.3, life: 14, color: '#d8d0c0' });
    }
    if (!d.p && fw * (w.x - l.x) >= 0) {
      d.cutT = t;
      d.p = slabs(l, [[-34, 9]]);
      free(d.p[0], { vx: fw * 8.5, vy: -5, vr: fw * 0.32, g: 0.34 });
      const p = cutFx(b, l, -34, 40, { angle: fw > 0 ? -0.15 : Math.PI + 0.15, spread: 1.7, speed: 9, shake: 9 });
      chunks(b, p.x, p.y, 10, { angle: fw > 0 ? -0.3 : Math.PI + 0.3, spread: 1.6, speed: 7 });
      b.sfx('boom', l.x);
      lens(b, 4);
    }
    if (d.cutT) {
      // a red line along the floor behind him
      b.fx.stain(w.x - fw * randRange(0, 22), GY + randRange(0, 14), 3);
      if (d.speed > 3) b.fx.spawn('blood', w.x, w.y - 40, { vx: -fw * 3, vy: -1, g: 0.2, life: 30, size: 2.2, color: '#c4142a', land: 'stain' });
      if (t === d.cutT + 36) topple(l, d.p[1], fw);
      if (d.speed < 0.5 && !d.turned) { d.turned = true; w.facing = -fw; }
    }
  },
};

// ---- NETHANEL: death by PowerPoint ------------------------------------------------------------------------
const SLIDES = [
  { t: 22, off: -14, n: 1 },
  { t: 36, off: 14, n: 2 },
  { t: 50, off: 0, n: 3 },
];
const SLIDE_FALL = 9;

export const nethanel = {
  name: 'DEATH BY POWERPOINT',
  dist: 100,
  zoom: 1.25,
  duration: 140,
  killAt: 31,
  start(w, l, b) {
    b.fx.text('NEXT SLIDE...', w.x, w.y - 100 * w.scale, { bubble: true, life: 40 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = SLIDES.some((s) => t >= s.t - 6 && t < s.t + 4) ? { pose: 'throw', frame: 1 } : { pose: 'raise', frame: 0 };
    SLIDES.forEach((s, i) => {
      if (t !== s.t + SLIDE_FALL - 3) return;
      // the slide goes through the victim: a cut along its path
      if (!d.p) d.p = strips(l, [-14, 0, 14]);
      const x = at(l, s.off, 0).x;
      const y = GY - 60;
      spray(b, x, y, 16, { angle: i === 1 ? Math.PI * 0.5 + fw * 0.6 : fw > 0 ? 0 : Math.PI, spread: 2.6, speed: 4.6 });
      b.sfx('slice', x);
      b.sfx('gore', x);
      b.addShake(4);
      if (i === 0) free(d.p[0], { vx: fw * 2.4, vy: -3.2, vr: fw * 0.1, g: 0.36 });
      if (i === 1) free(d.p[3], { vx: -fw * 2.4, vy: -3.2, vr: -fw * 0.1, g: 0.36 });
      if (i === 2) {
        free(d.p[1], { vx: fw * 1.1, vy: -2, vr: fw * 0.05, g: 0.34 });
        free(d.p[2], { vx: -fw * 1.1, vy: -2, vr: -fw * 0.05, g: 0.34 });
        chunks(b, x, y, 12, { speed: 5 });
        lens(b, 3);
      }
    });
    SLIDES.forEach((s) => { if (t === s.t) b.sfx('whoosh', w.x); });
  },
  draw(g, w, l, b, t) {
    for (const s of SLIDES) {
      const u = (t - s.t) / SLIDE_FALL;
      if (u < 0) continue;
      const x = at(l, s.off, 0).x;
      const y = lerp(-40, GY - 24, Math.min(1, u * u));
      const tilt = u >= 1 ? (s.n - 2) * 0.05 : (s.n - 2) * 0.08;
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      inked(g, '#f4f6ff', (c) => c.rect(-13, -9, 26, 18), 0.9);
      g.fillStyle = '#2f6df0';
      g.fillRect(-13, -9, 26, 4.6);
      g.fillStyle = '#9aa6c4';
      for (let i = 0; i < 3; i++) g.fillRect(-10, -2 + i * 3.6, 15 + (i % 2) * 5, 1.2);
      drawText(g, `${s.n}/99`, 8, 4, { scale: 0.7, align: 'center', color: '#2a3050' });
      if (u >= 1) {
        g.fillStyle = 'rgba(176,12,28,0.85)';
        g.fillRect(-13, 5, 26, 4);
      }
      g.restore();
    }
  },
};
