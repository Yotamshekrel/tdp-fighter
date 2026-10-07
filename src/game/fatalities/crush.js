// Fatalities that flatten: Gal (baby bonk), Ido (giant stomp), Yair (frozen, then the AC), Nadav (jackpot of
// coins) and Noa T. (the PLE windows close in). See runtime.js for the shape of a fatality.
import { BODY } from '../../config.js';
import { drawText } from '../../render/font.js';
import { inked, bloomAt } from '../../render/fx-kit.js';
import { GY, at, ease, easeOut, lerp, prog, goreOf, grid, decap, free, spray, mist, chunks, geyser, lens, splatter, rand, randRange, pick } from './kit.js';

const SC = BODY.SCALE;

// ---- GAL: three bonks and a pop ------------------------------------------------------------------------------
const BONKS = [22, 46, 70];

export const gal = {
  name: 'BABY BONK',
  dist: 46,
  zoom: 1.4,
  duration: 150,
  killAt: 70,
  start(w, l, b) {
    w.costume = { baby: true, hat: 'bonnet', prop: 'rattle' };
    b.sfx('poof', w.x);
    b.fx.burst('smoke', w.x, w.y - 30, 12, { color: '#ffffff', speed: 1.6, size: 6, grow: -0.12, life: 24 });
    b.fx.text('GOO GOO GA GA!', w.x, w.y - 80, { color: '#ffb3d9', life: 50 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    const fw = w.facing;
    // the baby hops up to reach, and swings at the top
    let hop = 0, hit = false;
    for (const bt of BONKS) {
      const k = (t - (bt - 12)) / 16;
      if (k >= 0 && k <= 1) { hop = 36 * Math.sin(Math.PI * k); hit = k > 0.7; }
    }
    w.y = GY - hop;
    w.fpose = { pose: 'swing', frame: hit ? 1 : 0 };
    l.fpose = { pose: 'crouchHit', frame: 0 };
    const head = at(l, 0, -112 * G.sy);
    BONKS.forEach((bt, i) => {
      if (t !== bt) return;
      b.sfx('bonk', l.x);
      b.sfx('squeak', w.x);
      b.addShake(5 + i * 2);
      spray(b, head.x, head.y, 14 + i * 6, { angle: -Math.PI / 2, spread: 3, speed: 4 });
      b.fx.burst('star', head.x, head.y, 5, { colors: ['#ffe066', '#ff8cf0', '#7de7ff'], speed: 2, life: 22 });
      if (i === 0) { G.sy = 0.74; G.sx = 1.16; }
      if (i === 1) { G.sy = 0.5; G.sx = 1.42; }
      if (i === 2) {
        // the third one pops the head clean off and flattens the rest
        const { head: hd, body } = decap(l);
        free(hd, { vx: fw * 1.4, vy: -10, vr: fw * 0.3, g: 0.38 });
        body.sx = 2.5;
        body.sy = 0.13;
        b.sfx('gore', l.x);
        spray(b, l.x, GY - 8, 40, { angle: -Math.PI / 2, spread: 5, speed: 5 });
        chunks(b, l.x, GY - 10, 12, { speed: 5 });
        b.fx.pool(l.x, 38);
        lens(b, 4);
        d.done = true;
      }
    });
    if (G.sx > 1 && !d.done) G.ox = Math.sin(t * 1.4) * 0.8; // wobbling
    if (d.done && t > 74 && t < 100 && t % 3 === 0) spray(b, l.x + randRange(-14, 14), GY - 6, 3, { angle: -Math.PI / 2, spread: 2, speed: 2 });
    if (t === 128) { b.sfx('poof', w.x); b.fx.burst('smoke', w.x, w.y - 30, 12, { color: '#ffffff', speed: 1.6, size: 6, grow: -0.12, life: 24 }); }
  },
};

// ---- IDO: giant stomp -----------------------------------------------------------------------------------------
const GIANT = 2.8;

export const ido = {
  name: 'GIANT STOMP',
  dist: 110,
  zoom: 1.0,
  duration: 150,
  killAt: 58,
  start(w, l, b, F) {
    b.sfx('grow', w.x);
    b.fx.text('FEE FI FO FUM!', w.x, w.y - 100 * w.scale, { color: '#ffb36b', life: 44 });
    F.d.x0 = w.x;
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    const G = goreOf(l);
    if (t < 34) {
      w.scale = SC * lerp(1, GIANT / SC, ease(t / 34));
      w.fpose = { pose: 'win', frame: Math.floor(t / 8) % 2 };
      if (t % 8 === 0) b.addShake(3);
      return;
    }
    if (t < 58) {
      const u = (t - 34) / 24;
      const tx = l.x - fw * 8 * w.scale; // the front foot comes down on the victim
      w.x = lerp(d.x0, tx, ease(u));
      w.y = GY - 90 * Math.sin(Math.PI * u);
      w.fpose = { pose: 'stompAir', frame: 0 };
      return;
    }
    if (t === 58) {
      w.y = GY;
      d.land = true;
      b.addShake(14);
      b.sfx('boom', l.x);
      b.sfx('gore', l.x);
      b.fx.burst('dust', l.x, GY - 4, 24, { color: '#d8c8a8', size: 7, speed: 4.5, life: 30, angle: -Math.PI / 2, spread: 3.4 });
      b.fx.spawn('ring', l.x, GY - 2, { size: 8, grow: 4, life: 16, color: '#ffffff' });
      for (const dir of [-1, 1]) spray(b, l.x, GY - 4, 28, { angle: dir > 0 ? -0.15 : Math.PI + 0.15, spread: 1.6, speed: 8 });
      spray(b, l.x, GY - 4, 30, { angle: -Math.PI / 2, spread: 2, speed: 6 });
      chunks(b, l.x, GY - 6, 16, { speed: 7 });
      b.fx.pool(l.x, 70);
      lens(b, 6);
      w.fpose = { pose: 'crouch', frame: 0 };
    }
    if (d.land) {
      const k = t - 58;
      G.sy = Math.max(0.05, 1 - k / 3);
      G.sx = lerp(1, 3, Math.min(1, k / 3));
      G.noWounds = true;
      if (k > 16) w.fpose = { pose: 'idle', frame: 0 };
      if (k < 40 && k % 4 === 0) spray(b, l.x + randRange(-30, 30), GY - 3, 3, { angle: -Math.PI / 2, spread: 3, speed: 3 });
    }
    if (t === 118) b.sfx('shrink', w.x);
    if (t >= 118) w.scale = Math.max(SC, w.scale - 0.06);
  },
};

// ---- YAIR: frozen solid, then the AC drops --------------------------------------------------------------------
function drawAC(g, cx, top, t, frost) {
  const w = 66, h = 28;
  g.save();
  g.translate(cx, top);
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 10 * 4;
  inked(g, '#eef3f8', (c) => { c.roundRect ? c.roundRect(-w / 2, 0, w, h, 4) : c.rect(-w / 2, 0, w, h); }, 1);
  g.shadowColor = 'transparent';
  g.fillStyle = '#c2ccd8';
  g.fillRect(-w / 2 + 2, h - 8, w - 4, 6);
  g.strokeStyle = '#7e8b9e';
  g.lineWidth = 0.9;
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(-w / 2 + 6 + i * 8.6, h - 7); g.lineTo(-w / 2 + 6 + i * 8.6, h - 2); g.stroke(); }
  g.fillStyle = '#d6e2ee';
  g.fillRect(-w / 2 + 4, 4, 28, 9);
  drawText(g, '16°', -w / 2 + 18, 5.2, { scale: 1.1, align: 'center', color: '#1b6fe0' });
  g.fillStyle = frost > 0.4 ? '#59e0ff' : '#5aa0ff';
  g.beginPath();
  g.arc(w / 2 - 8, 8, 2.4, 0, 6.3);
  g.fill();
  g.restore();
  bloomAt(g, cx, top + h, 36, '#9fe8ff', 0.25 * frost);
}

export const yair = {
  name: 'ABSOLUTE ZERO',
  dist: 100,
  zoom: 1.2,
  duration: 150,
  killAt: 74,
  start(w, l, b, F) {
    w.costume = { hat: 'beanie', scarf: 'blue' };
    b.fx.text('ARCTIC AC!', w.x, w.y - 100 * w.scale, { color: '#9fe8ff', life: 44 });
    F.d.ac = { x: l.x, y: -60 };
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = t < 74 ? { pose: 'raise', frame: Math.floor(t / 14) % 2 } : { pose: 'throw', frame: 1 };
    const ac = d.ac;
    if (t < 20) ac.y = lerp(-60, 22, easeOut(t / 20));
    else if (t < 66) ac.y = 22 + Math.sin(t * 0.3) * 0.8;
    else if (t < 74) ac.y = lerp(22, GY - 28, ((t - 66) / 8) ** 2);
    else ac.y = GY - 28;
    if (t === 8) b.sfx('hum', l.x);
    if (t >= 20 && t < 66) {
      // icy air pours out of the AC onto the victim
      if (t % 2 === 0) b.fx.spawn('flake', ac.x + randRange(-24, 24), ac.y + 28, { vx: randRange(-0.4, 0.4), vy: randRange(1.6, 2.8), life: 40, color: '#dff6ff', spin: 0.1 });
      if (t === 30) { l.frozen = 99999; b.sfx('wind', l.x); }
      l.x += Math.sin(t * 1.7) * 0.25; // shivering
      if (t % 12 === 0) b.sfx('wind', l.x);
    }
    if (t === 74) {
      // SLAM: the frozen victim shatters
      b.addShake(14);
      b.sfx('boom', l.x);
      b.sfx('smash', l.x);
      b.sfx('gore', l.x);
      const ps = grid(l, 3, 5, -22, 22);
      ps.forEach((p, i) => {
        const dir = (i % 3) - 1;
        free(p, { vx: dir * randRange(2.5, 5) + randRange(-1, 1), vy: -randRange(2, 7), vr: randRange(-0.3, 0.3), g: 0.38 });
      });
      b.fx.burst('shard', l.x, GY - 40, 32, { colors: ['#dff6ff', '#9fe8ff', '#ffffff'], speed: 6, g: 0.25, life: 50, size: 2.6, spin: 0.3 });
      b.fx.burst('flake', l.x, GY - 40, 24, { color: '#ffffff', speed: 4, life: 44 });
      spray(b, l.x, GY - 30, 36, { speed: 6, spread: 6.3 });
      chunks(b, l.x, GY - 30, 14, { speed: 6, colors: ['#d4546a', '#b01c2e', '#9fd8ee'] });
      b.fx.pool(l.x, 54);
      lens(b, 5);
      l.frozen = 99999;
    }
    if (t > 74 && t < 130 && t % 8 === 0) b.fx.spawn('flake', ac.x + randRange(-24, 24), ac.y + 28, { vx: 0, vy: 1.6, life: 30, color: '#dff6ff' });
    void fw;
  },
  draw(g, w, l, b, t, F) {
    const ac = F.d.ac;
    if (!ac) return;
    drawAC(g, ac.x, ac.y, t, prog(t, 20, 60));
    if (t > 76) {
      // blood running out from under it
      g.fillStyle = 'rgba(150,12,28,0.85)';
      g.fillRect(ac.x - 33, GY - 2, 66, 4);
    }
  },
};

// ---- NADAV: the jackpot -------------------------------------------------------------------------------------
export const nadav = {
  name: 'JACKPOT',
  dist: 110,
  zoom: 1.15,
  duration: 170,
  killAt: 64,
  start(w, l, b) {
    w.costume = { hat: 'tophat' };
    b.sfx('slots', l.x);
    b.fx.text('JACKPOT!', w.x, w.y - 100 * w.scale, { color: '#ffd23f', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    w.fpose = { pose: 'win', frame: Math.floor(t / 10) % 2 };
    l.fpose = { pose: 'crouchHit', frame: 0 };
    if (t === 40) b.sfx('jackpot', l.x);
    // a rain of coins, thicker and thicker
    if (t >= 30 && t < 116) {
      const n = 1 + Math.floor((t - 30) / 16);
      for (let i = 0; i < n; i++) {
        b.fx.spawn('coin', l.x + randRange(-46, 46), -8, { vx: randRange(-0.4, 0.4), vy: randRange(2, 4), g: 0.28, life: 160, land: 'bounce', spin: 0.3 });
      }
      if (t % 3 === 0) b.sfx('coin', l.x);
      if (t % 4 === 0) {
        const p = at(l, randRange(-6, 6), randRange(-100, -20));
        spray(b, p.x, p.y, 3, { speed: 2.2, size: 2 });
      }
    }
    if (t >= 40) {
      const k = ease(prog(t, 40, 112));
      G.sy = 1 - 0.9 * k;
      G.sx = 1 + 1.4 * k;
      G.ox = Math.sin(t * 1.9) * 0.9 * (1 - k);
      G.noWounds = k > 0.5;
    }
    if (t === 112) {
      // the big one
      d.coin = true;
      b.addShake(12);
      b.sfx('boom', l.x);
      b.sfx('gore', l.x);
      spray(b, l.x, GY - 6, 40, { angle: -Math.PI / 2, spread: 5, speed: 6 });
      chunks(b, l.x, GY - 8, 10, { speed: 5 });
      b.fx.pool(l.x, 58);
      lens(b, 5);
    }
  },
  draw(g, w, l, b, t) {
    // the slot machine up top: three reels that land on 7 7 7
    const x = l.x - 42, y = 8;
    g.save();
    inked(g, '#7a1020', (c) => c.rect(x - 6, y - 4, 96, 36), 1);
    inked(g, '#ffd23f', (c) => c.rect(x - 2, y, 88, 28), 0.8);
    for (let i = 0; i < 3; i++) {
      const lock = 14 + i * 9;
      const spinning = t < lock;
      inked(g, '#fffbe8', (c) => c.rect(x + 3 + i * 28, y + 4, 24, 20), 0.7);
      drawText(g, spinning ? pick(['7', 'BAR', '$', '7', '*']) : '7', x + 15 + i * 28, y + 7, { scale: 2.3, align: 'center', color: spinning ? '#8a8aa0' : '#e0141c' });
    }
    if (t > 42 && t % 8 < 5) bloomAt(g, x + 42, y + 14, 60, '#ffd23f', 0.55);
    g.restore();
    if (t >= 112) {
      // a giant coin lies across the victim
      const k = prog(t, 112, 118);
      const cy = lerp(-20, GY - 8, k * k);
      g.save();
      g.translate(l.x, cy);
      g.scale(1, 0.34);
      g.fillStyle = '#9a6a10';
      g.beginPath();
      g.arc(0, 0, 38, 0, 6.3);
      g.fill();
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.arc(0, -2, 34, 0, 6.3);
      g.fill();
      g.fillStyle = '#e8a91c';
      g.beginPath();
      g.arc(0, -2, 26, 0, 6.3);
      g.fill();
      g.restore();
      drawText(g, '$', l.x, cy - 8, { scale: 2.6, align: 'center', color: '#fff3a0' });
      if (k >= 1) {
        g.fillStyle = 'rgba(150,12,28,0.9)';
        g.fillRect(l.x - 38, GY - 3, 76, 4);
      }
    }
  },
};

// ---- NOA T.: the windows close in --------------------------------------------------------------------------
const WIN_W = 60, WIN_H = 104;

function drawWindow(g, x, flip, t, closed) {
  // x = the edge facing the victim; the window extends away from it
  g.save();
  g.translate(x, GY - WIN_H);
  if (flip) g.scale(-1, 1);
  inked(g, '#eef1f8', (c) => c.rect(-WIN_W, 0, WIN_W, WIN_H), 1);
  g.fillStyle = '#2f5fd0';
  g.fillRect(-WIN_W, 0, WIN_W, 10);
  drawText(g, flip ? 'FEEDBACK.EXE' : 'PLE.EXE', -WIN_W + 4, 2, { scale: 0.9, color: '#ffffff' });
  g.fillStyle = '#e03030';
  g.fillRect(-12, 2, 7, 6);
  g.fillStyle = '#9aa6c4';
  for (let i = 0; i < 4; i++) g.fillRect(-WIN_W + 6, 18 + i * 8, 28 + ((i * 17) % 18), 2.4);
  // the progress bar, stuck at 99%
  g.fillStyle = '#c8d0e4';
  g.fillRect(-WIN_W + 6, 58, WIN_W - 14, 9);
  g.fillStyle = '#40c060';
  g.fillRect(-WIN_W + 6, 58, (WIN_W - 14) * 0.99, 9);
  drawText(g, '99%', -WIN_W / 2 - 2, 70, { scale: 1.2, align: 'center', color: '#2a3050' });
  g.fillStyle = '#e8ecf6';
  g.fillRect(-WIN_W + 10, 86, 24, 11);
  drawText(g, flip ? 'SEND' : 'OK', -WIN_W + 22, 88, { scale: 0.9, align: 'center', color: '#2a3050' });
  if (closed) {
    g.fillStyle = 'rgba(160,10,26,0.9)';
    g.fillRect(-5, 0, 5, WIN_H);
  }
  g.restore();
}

export const noaPle = {
  name: 'PLE: 99%',
  dist: 200,
  zoom: 1.0,
  duration: 160,
  killAt: 70,
  start(w, l, b) {
    b.fx.text('MANDATORY!', w.x, w.y - 100 * w.scale, { color: '#5ad0ff', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    w.fpose = t < 70 ? { pose: 'raise', frame: Math.floor(t / 12) % 2 } : { pose: 'throw', frame: 1 };
    l.fpose = { pose: 'hit', frame: Math.floor(t / 8) % 2 };
    d.gap = lerp(74, 0, ease(prog(t, 30, 76))); // distance of each window's edge from the victim
    if (t === 30) b.sfx('whoosh', l.x);
    if (t >= 30 && t < 76) {
      const squeeze = Math.max(0.08, d.gap / 16);
      G.sx = Math.min(1, squeeze);
      G.sy = 1 + (1 - G.sx) * 0.12;
      if (d.gap < 20 && t % 3 === 0) {
        const p = at(l, 0, -110);
        geyser(b, p.x, p.y, 1.05);
        spray(b, l.x + (rand() < 0.5 ? -1 : 1) * 8, GY - randRange(10, 60), 4, { angle: -Math.PI / 2, spread: 3, speed: 3 });
        b.sfx('squeeze', l.x);
      }
    }
    if (t === 76) {
      G.hidden = true;
      b.addShake(12);
      b.sfx('gore', l.x);
      b.sfx('smash', l.x);
      spray(b, l.x, GY - 70, 44, { angle: -Math.PI / 2, spread: 3.2, speed: 7 });
      chunks(b, l.x, GY - 60, 12, { angle: -Math.PI / 2, spread: 3, speed: 6 });
      mist(b, l.x, GY - 60, 4, 8);
      b.fx.pool(l.x, 40);
      lens(b, 6);
      splatter(w, 6);
    }
    if (t > 76 && t < 130 && t % 6 === 0) spray(b, l.x + randRange(-4, 4), GY - randRange(4, 40), 2, { angle: -Math.PI / 2, spread: 1.4, speed: 1.4, size: 2 });
  },
  draw(g, w, l, b, t, F) {
    const gap = F.d.gap ?? 74;
    if (t < 30) return;
    const closed = gap < 1;
    drawWindow(g, l.x - gap, false, t, closed);
    drawWindow(g, l.x + gap, true, t, closed);
    if (t > 84) {
      // the error that pops up on top
      const k = Math.min(1, (t - 84) / 8);
      g.save();
      g.translate(l.x, 92);
      g.scale(k, k);
      inked(g, '#f4f6ff', (c) => c.rect(-44, -20, 88, 40), 1);
      g.fillStyle = '#d02a2a';
      g.fillRect(-44, -20, 88, 9);
      drawText(g, 'ERROR', -40, -19, { scale: 0.9, color: '#ffffff' });
      drawText(g, 'FEEDBACK SUBMITTED', 0, -6, { scale: 0.9, align: 'center', color: '#2a3050' });
      drawText(g, 'CANNOT BE UNDONE', 0, 3, { scale: 0.9, align: 'center', color: '#8a1020' });
      g.fillStyle = '#e8ecf6';
      g.fillRect(-10, 11, 20, 7);
      drawText(g, 'OK', 0, 12, { scale: 0.8, align: 'center', color: '#2a3050' });
      g.restore();
    }
  },
};
