// Fatalities that burst: Ayoub (drawn and quartered by magic), Maya (sugar overdose), Shay (the head pops),
// Rashida (t-shirt cannon), Dvir (a wave of blood) and Yaara (the bear hug). See runtime.js for the shape of a fatality.
import { BODY } from '../../config.js';
import { handPos, mouthPos } from '../specials/helpers.js';
import { inked } from '../../render/fx-kit.js';
import { GY, NECK, at, ease, lerp, prog, goreOf, slice, grid, decap, free, topple, spray, mist, chunks, geyser, lens, splatter, randRange, pick } from './kit.js';

const SC = BODY.SCALE;

// ---- AYOUB: drawn and quartered -----------------------------------------------------------------------------
export const ayoub = {
  name: 'ABRACADABRA',
  dist: 100,
  zoom: 1.25,
  duration: 150,
  killAt: 58,
  start(w, l, b) {
    w.costume = { hat: 'wizard', prop: 'wand', scarf: true };
    b.sfx('magic', w.x);
    b.fx.text('ABRACADABRA!', w.x, w.y - 100 * w.scale, { color: '#b58cff', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    w.fpose = t < 14 ? { pose: 'cast', frame: 0 } : { pose: 'cast', frame: 1 };
    l.fpose = { pose: 'fall', frame: 0 };
    if (!d.cut) {
      // lifted off the ground and slowly turned over by the spell
      const k = ease(prog(t, 8, 44));
      G.oy = -46 * k + Math.sin(t * 0.12) * 2 * k;
      G.rot = Math.sin(t * 0.07) * 0.25 * k;
      if (t % 3 === 0) {
        const a = t * 0.4;
        b.fx.spawn('star', l.x + Math.cos(a) * 24, l.y + G.oy - 50 + Math.sin(a) * 40, { vx: 0, vy: -0.5, life: 22, color: pick(['#ffe066', '#ff8cf0', '#7de7ff']) });
      }
    }
    if (t === 58) {
      d.cut = true;
      const cx = at(l, 0, -48).x, cy = l.y + G.oy - 48 * SC;
      const ps = slice(l, [
        { r: [-70, -135, 0, -48], e: [['r', 20], ['b', 12]] },
        { r: [0, -135, 70, -48], e: [['l', 20], ['b', 12]] },
        { r: [-70, -48, 0, 32], e: [['r', 20], ['t', 12]] },
        { r: [0, -48, 70, 32], e: [['l', 20], ['t', 12]] },
      ]);
      const fw = w.facing;
      free(ps[0], { vx: fw * 4.5, vy: -7, vr: fw * 0.3 });
      free(ps[1], { vx: -fw * 4.5, vy: -7, vr: -fw * 0.3 });
      free(ps[2], { vx: fw * 3.4, vy: -2.5, vr: fw * 0.22 });
      free(ps[3], { vx: -fw * 3.4, vy: -2.5, vr: -fw * 0.22 });
      spray(b, cx, cy, 44, { speed: 7, spread: 6.3 });
      chunks(b, cx, cy, 10, { speed: 6 });
      b.fx.burst('star', cx, cy, 14, { colors: ['#ffe066', '#ff8cf0', '#7de7ff'], speed: 5, life: 30 });
      b.sfx('gore', cx);
      b.sfx('magic', cx);
      b.addShake(10);
      lens(b, 4);
      splatter(w, 4);
    }
  },
};

// ---- MAYA: a sugar overdose -------------------------------------------------------------------------------------
const TREATS = ['cupcake', 'cone', 'cake', 'donut'];

function drawTreat(g, it) {
  g.save();
  g.translate(it.x, it.y);
  g.rotate(it.rot);
  if (it.kind === 'cupcake') {
    inked(g, '#c9885a', (c) => { c.moveTo(-4, 0); c.lineTo(4, 0); c.lineTo(3, 5); c.lineTo(-3, 5); c.closePath(); });
    inked(g, '#ff8cc8', (c) => c.arc(0, -1, 4.6, Math.PI, 0));
    g.fillStyle = '#ff2a4a';
    g.beginPath();
    g.arc(0, -5.6, 1.4, 0, 6.3);
    g.fill();
  } else if (it.kind === 'cone') {
    inked(g, '#e0a050', (c) => { c.moveTo(-3.4, 0); c.lineTo(3.4, 0); c.lineTo(0, 9); c.closePath(); });
    inked(g, '#ffd0e8', (c) => c.arc(0, -1, 4.2, 0, 6.3));
    inked(g, '#8a5a3a', (c) => c.arc(0, -4.6, 3.2, 0, 6.3));
  } else if (it.kind === 'cake') {
    inked(g, '#fff0d0', (c) => { c.moveTo(-6, 4); c.lineTo(6, 4); c.lineTo(6, -2); c.lineTo(-6, -4); c.closePath(); });
    g.fillStyle = '#ff5a6a';
    g.fillRect(-6, -1, 12, 1.8);
    g.fillStyle = '#ff2a4a';
    g.beginPath();
    g.arc(-2, -5, 1.5, 0, 6.3);
    g.fill();
  } else {
    inked(g, '#ff9ad0', (c) => c.arc(0, 0, 5, 0, 6.3));
    g.fillStyle = '#2a1020';
    g.beginPath();
    g.arc(0, 0, 1.8, 0, 6.3);
    g.fill();
  }
  g.restore();
}

export const maya = {
  name: 'SUGAR RUSH',
  dist: 110,
  zoom: 1.2,
  duration: 150,
  killAt: 84,
  start(w, l, b, F) {
    w.costume = { hat: 'chef', apron: true };
    b.fx.text('SUGAR RUSH!', w.x, w.y - 100 * w.scale, { color: '#ff8cd0', life: 44 });
    F.d.items = [];
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    const fw = w.facing;
    w.fpose = { pose: 'throw', frame: t % 10 < 5 ? 1 : 0 };
    l.fpose = { pose: 'hit', frame: Math.floor(t / 6) % 2 };
    if (t >= 4 && t < 76 && t % 5 === 0) {
      const h = handPos(w);
      const m = mouthPos(l);
      const T = 22;
      d.items.push({
        x: h.x, y: h.y, vx: (m.x - h.x) / T, vy: (m.y - h.y - 0.5 * 0.25 * T * T) / T, g: 0.25, rot: 0, vr: randRange(-0.4, 0.4), kind: pick(TREATS), t: 0, T,
      });
      b.sfx('throw', w.x);
    }
    for (const it of d.items) {
      if (it.dead) continue;
      it.t++;
      it.vy += it.g;
      it.x += it.vx;
      it.y += it.vy;
      it.rot += it.vr;
      if (it.t >= it.T) {
        it.dead = true;
        b.sfx('splat', l.x);
        b.fx.burst('confetti', it.x, it.y, 10, { colors: ['#ff8cd0', '#ffffff', '#ffd23f', '#7de7ff'], speed: 3, g: 0.1, life: 36, size: 2 });
        spray(b, it.x, it.y, 5, { angle: fw > 0 ? -0.4 : Math.PI + 0.4, spread: 2, speed: 2.8, size: 2 });
      }
    }
    // filling up
    const k = ease(prog(t, 8, 82));
    G.sx = 1 + 0.8 * k;
    G.sy = 1 + 0.5 * k;
    G.ox = Math.sin(t * 1.3) * 1.2 * k;
    G.filter = `sepia(${0.3 * k}) saturate(${1 + 0.6 * k}) hue-rotate(${-14 * k}deg)`;
    G.noWounds = true;
    if (t === 84) {
      const ps = grid(l, 3, 5, -22, 22);
      ps.forEach((p, i) => {
        const dir = (i % 3) - 1;
        free(p, { vx: dir * randRange(2, 5.5) + randRange(-1, 1), vy: -randRange(2, 8), vr: randRange(-0.3, 0.3), g: 0.36 });
      });
      const c = at(l, 0, -40);
      spray(b, c.x, c.y, 50, { speed: 7, spread: 6.3 });
      chunks(b, c.x, c.y, 18, { speed: 7, colors: ['#d4546a', '#ff8cc8', '#fff0d0', '#b01c2e'] });
      b.fx.burst('confetti', c.x, c.y, 60, { colors: ['#ff8cd0', '#ffffff', '#ffd23f', '#7de7ff', '#7dff6a'], speed: 7, g: 0.12, life: 80, size: 2 });
      b.sfx('boom', c.x);
      b.sfx('gore', c.x);
      b.addShake(12);
      b.fx.pool(l.x, 46);
      lens(b, 6);
      splatter(w, 7);
    }
  },
  draw(g, w, l, b, t, F) {
    for (const it of F.d.items) if (!it.dead) drawTreat(g, it);
  },
};

// ---- SHAY: the head pops -------------------------------------------------------------------------------------------
function drawSpeaker(g, x, y, beat) {
  inked(g, '#1c1c28', (c) => c.rect(x - 14, y - 40, 28, 40), 1);
  for (const [cy, r] of [[y - 29, 5.5], [y - 12, 9]]) {
    g.fillStyle = '#34344a';
    g.beginPath();
    g.arc(x, cy, r + 1.4, 0, 6.3);
    g.fill();
    g.fillStyle = '#0a0a12';
    g.beginPath();
    g.arc(x, cy, (r - 1) * (1 + 0.1 * beat), 0, 6.3);
    g.fill();
    g.fillStyle = '#4a4a66';
    g.beginPath();
    g.arc(x, cy, (r - 3) * (1 + 0.14 * beat), 0, 6.3);
    g.fill();
  }
}

export const shay = {
  name: 'MIC DROP',
  dist: 130,
  zoom: 1.2,
  duration: 150,
  killAt: 58,
  start(w, l, b) {
    w.costume = { hat: 'shades', prop: 'mic' };
    b.sfx('sing', w.x);
    b.fx.text('MIC DROP!', w.x, w.y - 100 * w.scale, { color: '#ff7ab8', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    const fw = w.facing;
    w.fpose = { pose: 'sing', frame: Math.floor(t / 7) % 2 };
    l.fpose = { pose: 'hit', frame: Math.floor(t / 4) % 2 };
    if (t % 18 === 4 && t < 58) b.sfx('boomwave', w.x);
    if (t < 58 && !d.cut) {
      // the sound shakes the victim apart from the inside
      const k = prog(t, 6, 58);
      G.ox = Math.sin(t * 2.4) * (0.6 + k * 2.4);
      if (t % 5 === 0) {
        const e = at(l, 4, -64);
        spray(b, e.x, e.y, 2 + Math.floor(k * 3), { angle: fw > 0 ? -0.3 : Math.PI + 0.3, spread: 3, speed: 2.4, size: 1.8 }); // from the ears and eyes
        spray(b, e.x, e.y, 2, { angle: -fw > 0 ? -0.3 : Math.PI + 0.3, spread: 3, speed: 2.4, size: 1.8 });
      }
    }
    if (t === 58) {
      d.cut = true;
      G.ox = 0;
      const { head, body } = decap(l);
      head.hidden = true; // gone: it burst
      d.body = body;
      const p = at(l, 0, -78);
      spray(b, p.x, p.y, 50, { speed: 7, spread: 6.3 });
      chunks(b, p.x, p.y, 16, { speed: 6.5 });
      mist(b, p.x, p.y, 6, 9);
      b.sfx('boom', p.x);
      b.sfx('gore', p.x);
      b.addShake(12);
      lens(b, 5);
      splatter(w, 4);
    }
    if (d.body && t > 58 && t < 112 && t % 2 === 0) {
      const p = at(l, 0, NECK);
      geyser(b, p.x, p.y + 2, 1, randRange(-0.25, 0.25));
    }
    if (t === 112) topple(l, d.body, fw);
  },
  drawBack(g, w, l, b, t) {
    const beat = Math.sin(t * 0.7);
    drawSpeaker(g, w.x - w.facing * 34, GY, beat);
    drawSpeaker(g, w.x - w.facing * 62, GY, -beat);
  },
  draw(g, w, l, b, t) {
    // sound waves rolling from the mic to the victim
    if (t > 66) return;
    const m = mouthPos(w);
    for (let i = 0; i < 4; i++) {
      const u = ((t * 0.045 + i * 0.25) % 1);
      const x = m.x + w.facing * u * (Math.abs(l.x - m.x) + 8);
      g.save();
      g.globalAlpha = (1 - u) * 0.8;
      g.strokeStyle = '#ff7ab8';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, m.y, 6 + u * 22, w.facing > 0 ? -1.1 : Math.PI - 1.1, w.facing > 0 ? 1.1 : Math.PI + 1.1);
      g.stroke();
      g.restore();
    }
  },
};

// ---- RASHIDA: the t-shirt cannon ---------------------------------------------------------------------------------
export const rashida = {
  name: "YOU'RE LATE!",
  dist: 140,
  zoom: 1.2,
  duration: 160,
  killAt: 54,
  start(w, l, b) {
    b.fx.text("YOU'RE LATE!", w.x, w.y - 100 * w.scale, { color: '#ffd23f', life: 46 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = { pose: 'cast', frame: t < 20 ? 0 : 1 };
    l.fpose = { pose: 'hit', frame: 1 };
    const h = handPos(w);
    d.muzzle = { x: h.x + fw * 22, y: h.y - 4 };
    d.recoil = t > 44 ? Math.max(0, 6 - (t - 44) * 0.8) : 0;
    if (t === 14) b.sfx('charge', w.x);
    if (t === 44) {
      d.shot = { x: d.muzzle.x, y: d.muzzle.y, vx: fw * 15, vy: 0 };
      b.sfx('boom', w.x);
      b.addShake(4);
      b.fx.burst('smoke', d.muzzle.x, d.muzzle.y, 8, { color: '#d8d8d8', speed: 2, size: 5, grow: 0.2, life: 24, angle: fw > 0 ? 0 : Math.PI, spread: 1 });
    }
    if (d.shot && !d.hit) {
      const s = d.shot;
      s.x += s.vx;
      s.y += (GY - 44 * SC - s.y) * 0.25; // drifts onto the victim's belly
      b.fx.spawn('smoke', s.x - s.vx, s.y, { color: '#e8e8e8', size: 3, grow: 0.2, life: 10 });
      if (fw * (s.x - l.x) >= 0) {
        d.hit = true;
        d.shot = null;
        // the middle of the victim is simply gone
        const ps = slice(l, [
          { r: [-70, -135, 70, -40], e: [['b', 10]] },
          { r: [-70, -14, 70, 32], e: [['t', 10]] },
        ]);
        free(ps[0], { vx: -fw * 1.2, vy: -3, vr: -fw * 0.12, g: 0.4 });
        free(ps[1], { vx: fw * 0.8, vy: -1, vr: fw * 0.08, g: 0.34 });
        const c = at(l, 0, -28);
        spray(b, c.x, c.y, 50, { speed: 8, spread: 6.3 });
        chunks(b, c.x, c.y, 20, { speed: 7 });
        mist(b, c.x, c.y, 5, 9);
        b.fx.burst('confetti', c.x, c.y, 40, { colors: ['#ff5a4e', '#ffd23f', '#3ec1ff', '#ffffff', '#7dff6a'], speed: 6, g: 0.14, life: 70, size: 2 });
        b.sfx('gore', c.x);
        b.sfx('smash', c.x);
        b.addShake(12);
        lens(b, 5);
        splatter(w, 3);
      }
    }
  },
  draw(g, w, l, b, t, F) {
    const d = F.d;
    if (!d.muzzle) return;
    const fw = w.facing;
    const h = handPos(w);
    // the cannon: a fat barrel in the winner's hands
    g.save();
    g.translate(h.x - fw * d.recoil, h.y - 2);
    if (fw < 0) g.scale(-1, 1);
    inked(g, '#c92a2a', (c) => c.rect(-4, -6, 30, 11), 1);
    inked(g, '#7a1a1a', (c) => c.rect(22, -7.5, 6, 14), 1);
    inked(g, '#3a3a48', (c) => c.rect(-9, -2, 7, 9), 1);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(-2, -5, 22, 2);
    g.restore();
    if (d.shot) {
      g.save();
      g.translate(d.shot.x, d.shot.y);
      g.rotate(t * 0.5);
      inked(g, '#ffd23f', (c) => c.rect(-4, -2.6, 8, 5.2), 0.8);
      g.fillStyle = '#e0141c';
      g.fillRect(-4, -0.5, 8, 1.2);
      g.restore();
    }
  },
};

// ---- DVIR: a wave of blood ----------------------------------------------------------------------------------------
const WAVE_V = 5.6;

function waveProfile(u) {
  // u = distance behind the crest in px: a steep front that curls, a long tail
  if (u < 0) return Math.max(0, 1 + u / 6) * 0.9;
  return Math.exp(-u / 70);
}

export const dvir = {
  name: 'COWABUNGA',
  dist: 160,
  zoom: 1.05,
  duration: 150,
  killAt: 66,
  start(w, l, b, F) {
    w.costume = { shirt: '#14a3c7', shirt2: '#0b5f8a', hat: 'shades' };
    b.sfx('wave', w.x);
    b.fx.text('COWABUNGA!', w.x, w.y - 100 * w.scale, { color: '#ff5a5a', life: 44 });
    F.d.x0 = w.x;
    F.d.front = w.x - w.facing * 60;
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    if (t < 14) {
      w.fpose = { pose: 'surf', frame: 0 };
      return;
    }
    d.front += fw * WAVE_V;
    const stop = l.x + fw * 80;
    w.x = fw * (d.front - 8 - stop) > 0 ? stop : d.front - fw * 8; // rides the crest, then glides to a stop past the victim
    w.y = GY - 14 - Math.sin(t * 0.2) * 1.5;
    w.fpose = { pose: 'surf', frame: Math.floor(t / 8) % 2 };
    if (t % 6 === 0) b.fx.spawn('blood', w.x, GY - 4, { vx: -fw * randRange(1, 3), vy: -randRange(1, 3), g: 0.2, life: 30, size: 2.2, color: '#c4142a', land: 'stain' });
    if (!d.hit && fw * (d.front - l.x) >= 0) {
      d.hit = true;
      const ps = grid(l, 3, 4, -22, 22);
      ps.forEach((p) => free(p, { vx: fw * randRange(4, 9), vy: -randRange(2, 8), vr: fw * randRange(0.1, 0.4), g: 0.34 }));
      const c = at(l, 0, -40);
      spray(b, c.x, c.y, 50, { angle: fw > 0 ? -0.3 : Math.PI + 0.3, spread: 2.4, speed: 9 });
      chunks(b, c.x, c.y, 18, { angle: fw > 0 ? -0.3 : Math.PI + 0.3, spread: 2.4, speed: 8 });
      b.sfx('gore', c.x);
      b.sfx('splash', c.x);
      b.addShake(10);
      b.fx.pool(l.x, 70);
      lens(b, 6);
      splatter(w, 5);
    }
    if (d.hit && w.x !== d.lastX) { /* the pool keeps growing behind the wave */ }
    if (t % 3 === 0 && fw * (d.front - d.x0) > 0) b.fx.stain(d.front - fw * randRange(0, 120), GY + randRange(0, 16), 3.4);
    d.lastX = w.x;
  },
  draw(g, w, l, b, t, F) {
    const d = F.d;
    if (d.front === undefined || t < 14) return;
    const fw = w.facing;
    // the wave: a red mass with a pale foamy crest
    const len = 170;
    g.save();
    g.beginPath();
    g.moveTo(d.front - fw * len, GY + 6);
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * len; // distance behind the crest
      const x = d.front - fw * u;
      const y = GY + 4 - 74 * waveProfile(u) * (1 + 0.05 * Math.sin(t * 0.3 + i));
      g.lineTo(x, y);
    }
    g.lineTo(d.front + fw * 6, GY + 6);
    g.closePath();
    const gr = g.createLinearGradient(0, GY - 76, 0, GY + 6);
    gr.addColorStop(0, 'rgba(210,50,66,0.9)');
    gr.addColorStop(0.5, 'rgba(160,16,34,0.9)');
    gr.addColorStop(1, 'rgba(90,6,18,0.95)');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(255,190,190,0.85)';
    g.lineWidth = 2.2;
    g.lineJoin = 'round';
    g.stroke();
    g.restore();
    // the board under the surfer
    g.save();
    g.translate(w.x, w.y);
    g.rotate(fw * -0.08);
    inked(g, '#ffd23f', (c) => c.ellipse(0, 0, 22, 3.2, 0, 0, 6.3), 0.9);
    g.fillStyle = '#0b5f8a';
    g.fillRect(-14, -1, 28, 1.4);
    g.restore();
  },
};

// ---- YAARA: the bear hug ------------------------------------------------------------------------------------------
const CRACKS = [24, 44, 62];

export const yaara = {
  name: 'BEAR HUG',
  dist: 36,
  zoom: 1.5,
  duration: 150,
  killAt: 70,
  start(w, l, b) {
    w.costume = { hearts: true };
    b.fx.text('HUGS!', w.x, w.y - 100 * w.scale, { color: '#ff7ab8', life: 40 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    const fw = w.facing;
    if (t < 12) {
      w.fpose = { pose: 'hugOpen', frame: 0 };
      return;
    }
    w.fpose = { pose: 'hug', frame: Math.floor(t / 6) % 2 };
    l.fpose = { pose: 'hit', frame: 1 };
    if (!d.cut) {
      // closing in: she steps in until they overlap, and the victim is held right in front of her
      w.x = lerp(F.to[0], l.x + (-fw * 18), ease(prog(t, 12, 22)));
      const sq = ease(prog(t, 14, 66));
      G.sx = 1 - 0.34 * sq;
      G.sy = 1 + 0.08 * sq;
      G.ox = Math.sin(t * 1.5) * 0.8 * sq;
      l.squish = 4;
      const m = mouthPos(l);
      if (t % 4 === 0 && t > 20) spray(b, m.x, m.y, 2, { angle: -Math.PI / 2, spread: 2, speed: 2.4, size: 1.8 });
    }
    CRACKS.forEach((c, i) => {
      if (t !== c) return;
      b.sfx('crack', l.x);
      b.sfx('squeeze', l.x);
      b.addShake(4 + i * 2);
      const p = at(l, 0, -40);
      spray(b, p.x, p.y, 12 + i * 6, { speed: 3.4, spread: 6.3 });
      b.fx.text('CRACK!', l.x, GY - 100 * SC, { color: '#fff3a0', life: 20 });
    });
    if (t === 70) {
      d.cut = true;
      const ps = slice(l, [
        { r: [-70, -135, 70, -22], e: [['b', 8]] },
        { r: [-70, -22, 70, 32], e: [['t', 8]] },
      ]);
      ps.forEach((p) => { p.sx = G.sx; p.sy = G.sy; });
      d.p = ps;
      free(ps[0], { vx: fw * 1.8, vy: -11, vr: fw * 0.24, g: 0.4 });
      const c = at(l, 0, -22);
      spray(b, c.x, c.y, 54, { speed: 8, spread: 6.3 });
      chunks(b, c.x, c.y, 16, { speed: 7 });
      mist(b, c.x, c.y, 5, 9);
      b.sfx('gore', c.x);
      b.sfx('smash', c.x);
      b.addShake(12);
      lens(b, 6);
      splatter(w, 10);
    }
    if (d.p && t > 70 && t < 120 && t % 2 === 0) {
      const p = at(l, 0, -20);
      geyser(b, p.x, p.y, 0.9, randRange(-0.2, 0.2));
    }
    if (t === 96) topple(l, d.p[1], -fw);
  },
};
