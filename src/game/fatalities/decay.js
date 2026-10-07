// Fatalities that take their time: Ofir (50 years in a second), Hadar (tequila and a match), Yovel (the bugs
// eat everything), Mor (the spine) and Eshel (talking with the hands). See runtime.js for the shape of a fatality.
import { BODY } from '../../config.js';
import { handPos } from '../specials/helpers.js';
import { drawSpine } from '../specials/spine-choke.js';
import { bloomAt, inked, INK } from '../../render/fx-kit.js';
import { GY, NECK, at, ease, lerp, prog, goreOf, grid, decap, free, topple, pin, pieceAt, spray, chunks, geyser, lens, splatter, cutFx, rand, randRange, pick } from './kit.js';

const SC = BODY.SCALE;

// ---- OFIR: back in my day ---------------------------------------------------------------------------------------
export const ofir = {
  name: 'BACK IN MY DAY',
  dist: 62,
  zoom: 1.3,
  duration: 160,
  killAt: 98,
  start(w, l, b) {
    w.costume = { old: true, prop: 'cane' };
    b.sfx('grow', w.x);
    b.fx.text('BACK IN MY DAY...', w.x, w.y - 100 * w.scale, { color: '#d8d0c0', life: 48 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    const fw = w.facing;
    w.fpose = t < 92 ? { pose: 'idle', frame: Math.floor(t / 22) % 2 } : t < 106 ? { pose: 'swing', frame: t < 98 ? 0 : 1 } : { pose: 'win', frame: 0 };
    if (!d.cut) {
      // fifty years go by: grey, bent, shrunken and shaky
      l.fpose = { pose: 'hit', frame: Math.floor(t / 20) % 2 };
      const k = ease(prog(t, 8, 84));
      G.filter = `grayscale(${k}) sepia(${0.35 * k}) brightness(${1 - 0.22 * k}) contrast(${1 + 0.15 * k})`;
      G.sy = 1 - 0.14 * k;
      G.rot = 0.2 * k;
      G.ox = Math.sin(t * 0.9) * 0.7 * k;
      if (t % 4 === 0 && k > 0.1) b.fx.spawn('ash', l.x + randRange(-8, 8), GY - randRange(20, 90), { vx: randRange(-0.3, 0.3), vy: 0.35, life: 40, color: '#b8b0a0' });
      if (t === 44) b.fx.text('50 YEARS LATER', l.x, GY - 110 * SC, { color: '#d8d0c0', life: 40 });
    }
    if (t === 98) {
      // WHACK: the cane takes the head off and the rest turns to dust
      d.cut = true;
      const ps = grid(l, 2, 5, -16, 16, -112, 6);
      d.ps = ps;
      ps.forEach((p, i) => {
        if (i < 2) free(p, { vx: fw * randRange(3, 5), vy: -randRange(5, 8), vr: fw * randRange(0.15, 0.3), g: 0.38 });
      });
      cutFx(b, l, NECK, 24, { angle: fw > 0 ? -0.5 : Math.PI + 0.5, shake: 8 });
      b.sfx('whack', l.x);
      b.sfx('crack', l.x);
      lens(b, 3);
    }
    if (d.ps && t > 98) {
      d.ps.forEach((p, i) => {
        if (i >= 2 && !p.free && t >= 102 + Math.floor(i / 2) * 3) {
          free(p, { vx: randRange(-1.4, 1.4), vy: -randRange(0, 2), vr: randRange(-0.12, 0.12), g: 0.34 });
          const c = pieceAt(l, p);
          b.fx.burst('smoke', c.x, c.y, 2, { color: '#b8b0a0', speed: 1, size: 5, grow: 0.2, life: 26 });
          b.fx.burst('bone', c.x, c.y, 1, { speed: 2, g: 0.3, life: 120, size: 2.4, spin: 0.25, color: '#f1e6c8', land: 'bounce' });
        }
      });
    }
  },
};

// ---- HADAR: tequila and a match ---------------------------------------------------------------------------------
export const hadar = {
  name: 'TEQUILA TIME',
  dist: 96,
  zoom: 1.25,
  duration: 190,
  killAt: 62,
  start(w, l, b) {
    w.costume = { hat: 'sombrero', poncho: true, prop: 'bottle' };
    b.sfx('maracas', w.x);
    b.fx.text('TEQUILA TIME!', w.x, w.y - 100 * w.scale, { color: '#ffd23f', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    const fw = w.facing;
    w.fpose = t < 14 ? { pose: 'raise', frame: 0 } : t < 34 ? { pose: 'throw', frame: t < 18 ? 0 : 1 } : t < 56 ? { pose: 'cast', frame: 1 } : { pose: 'win', frame: Math.floor(t / 12) % 2 };
    if (t === 16) {
      const h = handPos(w);
      d.bottle = { x: h.x, y: h.y, T: 14 };
      d.bottle.vx = (l.x - h.x) / 14;
      d.bottle.vy = (GY - 70 * SC - h.y - 0.5 * 0.25 * 196) / 14;
      w.costume = { hat: 'sombrero', poncho: true, prop: null };
      b.sfx('throw', w.x);
    }
    if (d.bottle) {
      const bt = d.bottle;
      bt.vy += 0.25;
      bt.x += bt.vx;
      bt.y += bt.vy;
      if (--bt.T <= 0) {
        // the bottle breaks over the victim: soaked in tequila
        d.bottle = null;
        d.wet = true;
        b.sfx('splash', l.x);
        b.sfx('clang', l.x);
        b.fx.burst('drop', bt.x, bt.y, 18, { color: '#e8d070', speed: 3, g: 0.2, life: 34 });
        b.fx.burst('shard', bt.x, bt.y, 8, { colors: ['#9fe8a0', '#ffffff'], speed: 4, g: 0.25, life: 36, size: 2 });
        spray(b, bt.x, bt.y, 6, { speed: 2.5 });
      }
    }
    if (t === 44) { d.match = { x: handPos(w).x, y: handPos(w).y - 4 }; b.sfx('zap', w.x); }
    if (t > 44 && t < 62 && d.match) {
      const k = (t - 44) / 18;
      const h = handPos(w);
      d.match.x = lerp(h.x, l.x, k * k);
      d.match.y = lerp(h.y - 4, GY - 56 * SC, k) - Math.sin(k * 3.14) * 10;
    }
    if (t === 62) {
      d.match = null;
      d.burn = t;
      b.sfx('flames', l.x);
      b.addShake(5);
    }
    if (d.burn) {
      const k = prog(t, d.burn, d.burn + 90);
      const panic = t < d.burn + 84;
      if (panic) {
        l.fpose = { pose: t % 8 < 4 ? 'fall' : 'hit', frame: 0 };
        G.ox = Math.sin(t * 0.9) * 3 * (1 - k * 0.3);
        G.rot = Math.sin(t * 0.6) * 0.1;
        if (t % 14 === 0) b.sfx('flames', l.x);
      }
      G.filter = `brightness(${1 - 0.82 * k}) sepia(${0.4 + 0.6 * k}) saturate(${1.4 - 0.9 * k}) contrast(1.15)`;
      G.noWounds = k > 0.6;
      if (t < d.burn + 112) {
        for (let i = 0; i < 3; i++) {
          const p = at(l, randRange(-8, 8), randRange(-112, -6));
          b.fx.spawn('fire', p.x + G.ox, p.y, { vx: randRange(-0.3, 0.3), vy: -randRange(0.8, 1.9), life: 22, size: randRange(5, 9) });
        }
        if (t % 2 === 0) { const p = at(l, randRange(-8, 8), randRange(-100, -20)); b.fx.spawn('ember', p.x, p.y, { vx: randRange(-0.8, 0.8), vy: -randRange(0.5, 2), life: 34, color: '#ffb02e' }); }
        if (t % 3 === 0) { const p = at(l, 0, -100); b.fx.spawn('smoke', p.x, p.y, { color: '#3a3430', vy: -0.8, vx: randRange(-0.3, 0.3), size: 6, grow: 0.12, life: 36 }); }
      }
      if (t === d.burn + 84) {
        // the charred body falls apart
        const ps = grid(l, 3, 5, -20, 20);
        ps.forEach((p, i) => free(p, { vx: ((i % 3) - 1) * randRange(0.4, 1.6), vy: -randRange(0, 2.4), vr: randRange(-0.14, 0.14), g: 0.34 }));
        l.fpose = { pose: 'fall', frame: 0 };
        b.sfx('gore', l.x);
        b.addShake(8);
        chunks(b, l.x, GY - 40, 14, { speed: 4, colors: ['#2a2420', '#3a1a14', '#5a2018'] });
        b.fx.burst('ash', l.x, GY - 50, 40, { color: '#6a6460', speed: 2.4, life: 60, g: 0.04 });
        spray(b, l.x, GY - 40, 14, { speed: 4 });
        lens(b, 2);
      }
      if (t > d.burn + 84 && t < d.burn + 120 && t % 2 === 0) {
        const p = at(l, randRange(-30, 30), -randRange(0, 10));
        b.fx.spawn('fire', p.x, p.y, { vy: -1.2, life: 20, size: randRange(4, 7) });
      }
    }
  },
  draw(g, w, l, b, t, F) {
    const d = F.d;
    if (d.bottle) {
      g.save();
      g.translate(d.bottle.x, d.bottle.y);
      g.rotate(t * 0.6);
      inked(g, '#7ad38a', (c) => { c.rect(-2.4, -2, 4.8, 8); c.rect(-1.1, -6, 2.2, 4); }, 0.8);
      g.fillStyle = '#e8d070';
      g.fillRect(-2, 1, 4, 3);
      g.restore();
    }
    if (d.match) {
      bloomAt(g, d.match.x, d.match.y, 9, '#ffb02e', 0.9);
      g.fillStyle = '#fff0a0';
      g.beginPath();
      g.arc(d.match.x, d.match.y, 1.6, 0, 6.3);
      g.fill();
    }
    if (d.burn && t < d.burn + 112) bloomAt(g, l.x, GY - 60, 60, '#ff7a2a', 0.45);
  },
};

// ---- YOVEL: eaten alive by bugs ------------------------------------------------------------------------------
const NB = 90;

function drawSkeleton(g, x, y, sc, collapse) {
  // a standing skeleton, feet at (x, y); `collapse` 0..1 folds it down into a heap
  g.save();
  g.translate(x, y);
  g.scale(sc, sc * (1 - 0.8 * collapse));
  g.strokeStyle = INK;
  g.fillStyle = '#f1e6c8';
  g.lineCap = 'round';
  const bone = (x0, y0, x1, y1, w = 2.2) => {
    g.lineWidth = w + 1.6;
    g.strokeStyle = INK;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineWidth = w;
    g.strokeStyle = '#f1e6c8';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  bone(0, -48, 0, -26, 2.4); // spine
  for (let i = 0; i < 4; i++) {
    const yy = -46 + i * 4.6, r = 9 - Math.abs(i - 1) * 1.1;
    bone(-1, yy, -r, yy + 2.2, 1.5);
    bone(1, yy, r, yy + 2.2, 1.5);
  }
  bone(-6, -26, 6, -26, 3); // pelvis
  bone(-4, -26, -5, -12, 2.4); bone(-5, -12, -6, 0, 2.2);
  bone(4, -26, 5, -12, 2.4); bone(5, -12, 6, 0, 2.2);
  bone(-8, -46, -12, -32, 2); bone(-12, -32, -9, -22, 1.8);
  bone(8, -46, 12, -32, 2); bone(12, -32, 9, -22, 1.8);
  g.lineWidth = 1;
  g.strokeStyle = INK;
  g.beginPath();
  g.ellipse(0, -58, 8, 9, 0, 0, 6.3);
  g.fillStyle = '#f1e6c8';
  g.fill();
  g.stroke();
  g.fillStyle = '#14101e';
  g.beginPath(); g.ellipse(-3, -59, 2.4, 3, 0, 0, 6.3); g.ellipse(3, -59, 2.4, 3, 0, 0, 6.3); g.fill();
  g.fillRect(-0.8, -55, 1.6, 2.6);
  g.fillRect(-4, -52.6, 8, 1.6);
  g.restore();
}

export const yovel = {
  name: 'BUG PARTY',
  dist: 110,
  zoom: 1.3,
  duration: 190,
  killAt: 72,
  start(w, l, b) {
    w.costume = { hat: 'safari', prop: 'jar' };
    b.sfx('bugs', w.x);
    b.fx.text('BUG PARTY!', w.x, w.y - 100 * w.scale, { color: '#9bff6a', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const G = goreOf(l);
    w.fpose = t < 10 ? { pose: 'raise', frame: 0 } : { pose: 'cast', frame: 1 };
    if (t === 10) { w.costume = { hat: 'safari', prop: null }; b.sfx('bugs', w.x); }
    if (t % 6 === 0 && t > 12 && t < 150) b.sfx('bugs', l.x);
    l.fpose = { pose: t < 140 ? 'hit' : 'fall', frame: Math.floor(t / 5) % 2 };
    d.nb = Math.floor(NB * prog(t, 12, 56));
    if (t >= 52) {
      // the flesh goes first at the top, working its way down
      const k = ease(prog(t, 52, 150));
      d.eaten = lerp(-135, 2, k);
      G.clip = [-80, d.eaten, 80, 40];
      G.ox = Math.sin(t * 1.6) * 1.4 * (1 - k);
      G.noWounds = true;
      if (t % 3 === 0 && k < 1) {
        const p = at(l, randRange(-8, 8), d.eaten);
        spray(b, p.x, p.y, 3, { speed: 2, size: 2 });
        if (rand() < 0.4) chunks(b, p.x, p.y, 1, { speed: 1.6, bones: 0, size: 2 });
      }
      if (t === 52) { b.sfx('squeeze', l.x); b.addShake(3); }
      if (t % 10 === 0 && k < 1) b.sfx('gore', l.x);
    }
    if (t === 150) {
      G.hidden = true;
      d.bare = true;
      b.fx.pool(l.x, 40);
      lens(b, 3);
      b.sfx('gore', l.x);
      splatter(w, 2);
    }
    d.collapse = prog(t, 168, 186);
  },
  drawBack(g, w, l, b, t, F) {
    if (F.d.eaten === undefined) return;
    // the skeleton shows through where the flesh has gone
    drawSkeleton(g, l.x, GY, SC * 1.1, F.d.collapse ?? 0);
  },
  draw(g, w, l, b, t, F) {
    const d = F.d;
    if (!d.nb) return;
    // the swarm: crawling all over the victim, then drifting off
    const leave = prog(t, 154, 190);
    for (let i = 0; i < d.nb; i++) {
      const a = i * 2.399 + t * (0.05 + (i % 5) * 0.012);
      const h = ((i * 37) % 100) / 100;
      const bodyTop = d.eaten !== undefined ? d.eaten : -110;
      const ly = lerp(Math.max(bodyTop, -112), -2, h);
      const px = l.x + Math.cos(a) * (9 + (i % 4) * 3) * (1 + leave * 6);
      const py = GY + ly * SC * 0.98 + Math.sin(a * 1.7) * 4 - leave * 40 * h;
      g.save();
      g.globalAlpha = 1 - leave * 0.9;
      g.translate(px, py);
      g.rotate(a * 3);
      g.fillStyle = i % 3 ? '#14101e' : '#3a2a14';
      g.beginPath();
      g.ellipse(0, 0, 1.9, 1.1, 0, 0, 6.3);
      g.fill();
      g.strokeStyle = '#14101e';
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(-0.6, -1.9); g.lineTo(0.6, 1.9);
      g.moveTo(0.6, -1.9); g.lineTo(-0.6, 1.9);
      g.stroke();
      g.restore();
    }
  },
};

// ---- MOR: the spine --------------------------------------------------------------------------------------------
export const mor = {
  name: 'SPINE OUT',
  dist: 36,
  zoom: 1.5,
  duration: 150,
  killAt: 58,
  start(w, l, b) {
    b.sfx('charge', w.x);
    b.fx.text('SPINE OUT!', w.x, w.y - 100 * w.scale, { color: '#f1e6c8', life: 44 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    l.fpose = { pose: 'hit', frame: 1 };
    if (t < 22) {
      w.fpose = { pose: 'charge', frame: Math.floor(t / 6) % 2 };
      return;
    }
    if (t < 58) {
      w.fpose = { pose: 'throw', frame: 0 };
      if (t === 22) b.sfx('grab', w.x);
      // she is at the victim's head: shaking it as she pulls
      if (t % 5 === 0) { const p = at(l, 0, -70); spray(b, p.x, p.y, 3, { speed: 2.4, size: 2 }); b.sfx('squeeze', l.x); }
      return;
    }
    if (t === 58) {
      const { head, body } = decap(l);
      d.head = head;
      d.body = body;
      head.hold = true;
      body.hold = true;
      d.lift = 0;
      cutFx(b, l, NECK, 30, { shake: 10 });
      b.sfx('crack', l.x);
      lens(b, 4);
      splatter(w, 7);
    }
    if (t >= 58) {
      // she hoists the head, spine and all, and the rest of him folds up
      const h = handPos(w);
      w.fpose = { pose: 'raise', frame: Math.floor(t / 14) % 2 };
      d.lift = Math.min(1, d.lift + 0.06);
      d.hand = { x: h.x, y: h.y - 6 };
      pin(l, d.head, d.hand.x, d.hand.y - 14);
      d.head.rot = Math.sin(t * 0.12) * 0.08;
      if (t === 66) topple(l, d.body, fw);
      if (t % 5 === 0 && t < 130) b.fx.spawn('blood', d.hand.x, d.hand.y + 14, { vx: randRange(-0.2, 0.2), vy: 0.4, g: 0.2, life: 50, size: 2.2, color: '#c4142a', land: 'stain' });
    }
  },
  draw(g, w, l, b, t, F) {
    const d = F.d;
    if (!d.hand) return;
    const a = { x: d.hand.x, y: d.hand.y - 4 };
    const bend = Math.sin(t * 0.1) * 3;
    drawSpine(g, a, { x: a.x - w.facing * 3 + bend, y: a.y + 40 * SC * 0.8 }, 4 * SC, 1);
  },
};

// ---- ESHEL: talk to the hands ----------------------------------------------------------------------------------
export const eshel = {
  name: 'TALK TO THE HANDS',
  dist: 76,
  zoom: 1.35,
  duration: 170,
  killAt: 72,
  start(w, l, b) {
    b.sfx('maracas', w.x);
    b.fx.text('TALK TO THE HANDS!', w.x, w.y - 100 * w.scale, { color: '#ffd23f', life: 46 });
  },
  update(w, l, b, t, F) {
    const d = F.d;
    const fw = w.facing;
    w.fpose = { pose: 'flurry', frame: Math.floor(t / 3) % 2 };
    l.fpose = { pose: 'hit', frame: Math.floor(t / 3) % 2 };
    if (t === 8) {
      const { head, body } = decap(l);
      d.head = head;
      d.body = body;
      head.hold = true;
      body.hold = true;
      d.head.base = { x: head.x, y: head.y };
    }
    // hands from everywhere slap the head, faster and faster
    if (t >= 6 && t < 72) {
      const n = 1 + Math.floor((t - 6) / 14);
      for (let i = 0; i < n; i++) {
        const p = at(l, randRange(-6, 8), randRange(-90, -58));
        const a = randRange(0, 6.28);
        b.fx.spawn('hand', p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 18, { vx: -Math.cos(a) * 3.4, vy: -Math.sin(a) * 2.2, life: 9, color: pick(['#f2c9a0', '#e0a878', '#c98b5c', '#f6d8b8']), flip: rand() < 0.5 });
      }
      if (t % 3 === 0) {
        b.sfx('slap', l.x);
        const p = at(l, 2, -66);
        spray(b, p.x, p.y, 3, { speed: 2.8, size: 2 });
      }
      if (t % 12 === 0) b.addShake(2);
    }
    if (d.head && !d.head.free) {
      // the head spins on the neck, screwing itself loose
      const k = prog(t, 8, 72);
      d.head.vr = 0.04 + k * k * 0.75;
      d.head.rot += d.head.vr * fw;
      d.head.y = d.head.base.y - 12 * ease(k);
      d.head.x = d.head.base.x + Math.sin(t * 1.9) * 1.2;
      if (t % 4 === 0 && k > 0.2) { const p = at(l, 0, NECK); spray(b, p.x, p.y, 2, { angle: -Math.PI / 2, spread: 2.4, speed: 2.4, size: 2 }); }
    }
    if (t === 72) {
      d.head.hold = false;
      free(d.head, { vx: fw * 2.6, vy: -10, vr: d.head.vr * fw, g: 0.38 });
      topple(l, d.body, -fw);
      cutFx(b, l, NECK, 34, { shake: 9 });
      b.sfx('smash', l.x);
      lens(b, 4);
      splatter(w, 5);
    }
    if (d.body && t > 72 && t < 100 && !d.body.rested && t % 2 === 0) {
      const p = at(l, 0, NECK);
      geyser(b, p.x, p.y + 2, 0.9);
    }
  },
};

