// ---------------------------------------------------------------------------
// Costumes for the hi-res fighters (see puppet.js): the hats, props, scarves
// and so on that the special attacks put on a fighter (specials/*.js ->
// `costume`). Drawn as smooth vector shapes so they match the hi-res art.
//
// Hats are drawn in the HEAD PICTURE's own pixel space (after the head's
// transform has been applied), so they follow the head wherever it goes.
// Props are drawn in game pixels at the hand.
// ---------------------------------------------------------------------------

const INK = '#14101e';

function grad(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  return gr;
}

/** Fill + outline a path built by `build(g)`. */
function shape(g, fill, build, lw = 4) {
  g.beginPath();
  build(g);
  g.fillStyle = fill;
  g.fill();
  if (lw) {
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.stroke();
  }
}

const ellipse = (cx, cy, rx, ry, rot = 0) => (g) => g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);

// ---- recolouring ---------------------------------------------------------------
const isSkin = (r, g, b) => r > g && g > b && r - b > 34 && r > 105 && g > 62;

/** Recolour a layer's clothes (not skin, not outlines) towards `hex`. */
export function tintLayer(layer, hex, amount) {
  const { c, g } = layer;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const tr = parseInt(hex.slice(1, 3), 16), tg = parseInt(hex.slice(3, 5), 16), tb = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const luma = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
    if (luma < 0.12 || isSkin(r, gg, b)) continue; // outlines and hands stay
    const k = 0.45 + luma * 0.95;
    d[i] = r + (Math.min(255, tr * k) - r) * amount;
    d[i + 1] = gg + (Math.min(255, tg * k) - gg) * amount;
    d[i + 2] = b + (Math.min(255, tb * k) - b) * amount;
  }
  g.putImageData(img, 0, 0);
}

/** Navy / white stripes over whatever the torso layer holds (a French sailor top). */
export function stripeLayer(layer, T, J) {
  const { g } = layer;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
  const top = J.neck[1] + 20, bottom = J.pelvis[1] + 60;
  for (let y = top, i = 0; y < bottom; y += 34, i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.62)' : 'rgba(31,58,138,0.62)';
    g.fillRect(J.pelvis[0] - 400, y, 800, 34);
  }
  g.restore();
}

// ---- body wear -----------------------------------------------------------------
export function drawPoncho(g, T, J) {
  g.save();
  g.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
  const cols = ['#d02a2a', '#ffd23f', '#2a9a3a', '#2a6ad8', '#ffffff', '#ff7a1a'];
  const y0 = J.neck[1] + 30, y1 = J.pelvis[1] + 150;
  g.beginPath();
  g.moveTo(J.neck[0] - 60, y0);
  g.lineTo(J.neck[0] + 70, y0);
  g.lineTo(J.neck[0] + 190, y1);
  g.lineTo(J.neck[0] - 175, y1);
  g.closePath();
  g.save();
  g.clip();
  for (let y = y0, i = 0; y < y1; y += 30, i++) {
    g.fillStyle = cols[i % cols.length];
    g.fillRect(J.neck[0] - 260, y, 520, 30);
  }
  g.restore();
  g.lineWidth = 5;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}

export function drawApron(g, T, J) {
  g.save();
  g.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
  const x0 = J.pelvis[0] - 20, x1 = J.pelvis[0] + 95, y0 = J.neck[1] + 40, y1 = J.pelvis[1] + 175;
  shape(g, grad(g, x0, y0, x1, y0, [[0, '#ffffff'], [1, '#dfe3f0']]), (c) => {
    c.moveTo(x0 + 6, y0);
    c.lineTo(x1 - 6, y0);
    c.lineTo(x1 + 12, y1);
    c.lineTo(x0 - 6, y1);
    c.closePath();
  }, 5);
  g.restore();
}

export function drawScarf(g, HT, J, head, kind) {
  const a = kind === 'blue' ? '#2a6ad8' : '#a01828';
  const b = kind === 'blue' ? '#ffffff' : '#e8b923';
  g.save();
  g.transform(HT[0], HT[1], HT[2], HT[3], HT[4], HT[5]);
  const cx = J.neck[0] + 6, cy = J.neck[1] - 4;
  // hanging tail
  g.save();
  g.translate(cx - 50, cy + 10);
  g.rotate(0.12);
  for (let i = 0; i < 6; i++) shape(g, i % 2 ? b : a, (c) => c.rect(-26, i * 26, 52, 26), i === 0 ? 4 : 3);
  g.restore();
  // wrap
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, 98, 34, 0, 0, Math.PI * 2);
  g.clip();
  for (let x = cx - 110, i = 0; x < cx + 110; x += 26, i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(x, cy - 50, 26, 100);
  }
  g.restore();
  g.lineWidth = 5;
  g.strokeStyle = INK;
  g.beginPath();
  g.ellipse(cx, cy, 98, 34, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

// ---- face ------------------------------------------------------------------------
export function drawEyes(g, HT, h, cos) {
  const HH = h.chin - h.top;
  const ey = h.eye, ex = h.eyeX;
  g.save();
  g.transform(HT[0], HT[1], HT[2], HT[3], HT[4], HT[5]);
  if (cos.eyes === 'laser') {
    for (const dx of [-0.14, 0.12]) {
      const x = ex + h.w * dx;
      const gr = g.createRadialGradient(x, ey, 2, x, ey, HH * 0.22);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,60,60,0.95)');
      gr.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - HH * 0.26, ey - HH * 0.26, HH * 0.52, HH * 0.52);
    }
  }
  if (cos.baby) {
    // pacifier, just below the mouth
    const x = ex + h.w * 0.04, y = ey + (h.chin - ey) * 0.62;
    shape(g, '#5ab4ff', ellipse(x, y, HH * 0.1, HH * 0.1), 4);
    shape(g, '#ff8cc6', ellipse(x, y, HH * 0.05, HH * 0.05), 0);
  }
  g.restore();
}

// ---- hats ------------------------------------------------------------------------
export function drawHeadwear(g, HT, h, cos) {
  if (!cos.hat) return;
  const HH = h.chin - h.top;
  const W = h.w;
  const cx = h.cx, top = h.top;
  const yb = top + HH * 0.3; // where a hat sits on the forehead
  g.save();
  g.transform(HT[0], HT[1], HT[2], HT[3], HT[4], HT[5]);
  switch (cos.hat) {
    case 'sombrero': {
      const straw = grad(g, cx - W, yb, cx + W, yb, [[0, '#f6d682'], [0.55, '#e8c060'], [1, '#b98a30']]);
      shape(g, grad(g, 0, yb - HH * 0.6, 0, yb, [[0, '#f2d078'], [1, '#d0a444']]), (c) => {
        c.moveTo(cx - W * 0.4, yb + 2);
        c.bezierCurveTo(cx - W * 0.42, yb - HH * 0.62, cx + W * 0.42, yb - HH * 0.62, cx + W * 0.4, yb + 2);
        c.closePath();
      });
      shape(g, '#d02a2a', (c) => c.rect(cx - W * 0.41, yb - HH * 0.1, W * 0.82, HH * 0.11), 4);
      shape(g, straw, ellipse(cx, yb + HH * 0.02, W * 1.28, HH * 0.13), 5);
      for (let i = -5; i <= 5; i++) shape(g, '#2a9a3a', ellipse(cx + i * W * 0.22, yb + HH * 0.04, 5, 5), 0);
      break;
    }
    case 'beret': {
      g.save();
      g.translate(cx - W * 0.04, yb - HH * 0.08);
      g.rotate(-0.12);
      shape(g, grad(g, -W * 0.6, -HH * 0.2, W * 0.4, HH * 0.1, [[0, '#2c3470'], [1, '#161a36']]), ellipse(0, 0, W * 0.62, HH * 0.19));
      shape(g, '#161a36', ellipse(-W * 0.02, -HH * 0.19, 8, 10), 4);
      g.restore();
      break;
    }
    case 'chef': {
      const w = grad(g, 0, yb - HH * 0.8, 0, yb, [[0, '#ffffff'], [1, '#d6dbe8']]);
      shape(g, w, ellipse(cx - W * 0.26, yb - HH * 0.34, W * 0.27, HH * 0.24));
      shape(g, w, ellipse(cx + W * 0.28, yb - HH * 0.34, W * 0.27, HH * 0.24));
      shape(g, w, ellipse(cx, yb - HH * 0.5, W * 0.32, HH * 0.26));
      shape(g, w, (c) => c.rect(cx - W * 0.4, yb - HH * 0.16, W * 0.8, HH * 0.2), 5);
      g.strokeStyle = '#c0c6d8';
      g.lineWidth = 4;
      for (const dx of [-0.16, 0.06, 0.2]) { g.beginPath(); g.moveTo(cx + W * dx, yb - HH * 0.14); g.lineTo(cx + W * dx, yb + HH * 0.02); g.stroke(); }
      break;
    }
    case 'wizard': {
      g.save();
      g.translate(cx, yb);
      shape(g, grad(g, -W * 0.5, -HH, W * 0.5, 0, [[0, '#5a46b8'], [1, '#2a1c5a']]), (c) => {
        c.moveTo(-W * 0.42, 0);
        c.quadraticCurveTo(-W * 0.3, -HH * 0.7, -W * 0.05, -HH * 1.1);
        c.quadraticCurveTo(W * 0.38, -HH * 1.05, W * 0.52, -HH * 0.82); // the tip flops forward
        c.quadraticCurveTo(W * 0.2, -HH * 0.78, W * 0.4, 0);
        c.closePath();
      });
      shape(g, '#2a1c5a', ellipse(0, 4, W * 0.7, HH * 0.09), 5);
      for (const [sx, sy, r] of [[-0.12, -0.28, 9], [0.12, -0.52, 7], [-0.02, -0.74, 6], [0.2, -0.16, 5]]) shape(g, '#ffe066', ellipse(W * sx, HH * sy, r, r), 0);
      g.restore();
      break;
    }
    case 'headband':
    case 'pinkband': {
      const col = cos.hat === 'headband' ? '#e8202a' : '#ff69c8';
      const y = top + HH * 0.3;
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = INK;
      g.lineWidth = HH * 0.1 + 6;
      g.beginPath(); g.moveTo(cx - W * 0.46, y + 4); g.quadraticCurveTo(cx + W * 0.04, y - 10, cx + W * 0.5, y + 8); g.stroke();
      g.strokeStyle = col;
      g.lineWidth = HH * 0.1;
      g.beginPath(); g.moveTo(cx - W * 0.46, y + 4); g.quadraticCurveTo(cx + W * 0.04, y - 10, cx + W * 0.5, y + 8); g.stroke();
      // knot + flying tails behind the head
      shape(g, col, (c) => { c.moveTo(cx - W * 0.46, y + 2); c.lineTo(cx - W * 0.82, y - HH * 0.06); c.lineTo(cx - W * 0.7, y + HH * 0.04); c.lineTo(cx - W * 0.86, y + HH * 0.14); c.lineTo(cx - W * 0.46, y + HH * 0.06); c.closePath(); }, 4);
      g.restore();
      break;
    }
    case 'beanie': {
      shape(g, grad(g, 0, top - HH * 0.1, 0, yb, [[0, '#6aa0d8'], [1, '#3a6ea5']]), (c) => {
        c.moveTo(cx - W * 0.5, yb + 2);
        c.bezierCurveTo(cx - W * 0.56, top - HH * 0.18, cx + W * 0.56, top - HH * 0.18, cx + W * 0.5, yb + 2);
        c.closePath();
      });
      shape(g, '#2f5f95', (c) => c.rect(cx - W * 0.52, yb - HH * 0.08, W * 1.04, HH * 0.14), 4);
      g.strokeStyle = 'rgba(255,255,255,0.28)';
      g.lineWidth = 4;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * W * 0.14, top - HH * 0.02); g.lineTo(cx + i * W * 0.17, yb - HH * 0.1); g.stroke(); }
      shape(g, '#ffffff', ellipse(cx, top - HH * 0.1, W * 0.13, W * 0.13), 4);
      break;
    }
    case 'safari': {
      shape(g, grad(g, 0, top - HH * 0.2, 0, yb, [[0, '#dcc888'], [1, '#b59a52']]), (c) => {
        c.moveTo(cx - W * 0.44, yb);
        c.bezierCurveTo(cx - W * 0.46, top - HH * 0.22, cx + W * 0.46, top - HH * 0.22, cx + W * 0.44, yb);
        c.closePath();
      });
      shape(g, '#5a4a2a', (c) => c.rect(cx - W * 0.44, yb - HH * 0.1, W * 0.88, HH * 0.1), 3);
      shape(g, grad(g, cx - W, 0, cx + W, 0, [[0, '#d6c07c'], [1, '#a98c48']]), ellipse(cx, yb + 2, W * 0.82, HH * 0.09), 5);
      break;
    }
    case 'tophat': {
      shape(g, grad(g, cx - W * 0.4, 0, cx + W * 0.4, 0, [[0, '#2a2a34'], [0.5, '#16161c'], [1, '#0a0a0e']]), (c) => c.rect(cx - W * 0.36, yb - HH * 0.72, W * 0.72, HH * 0.74), 5);
      shape(g, '#e8b923', (c) => c.rect(cx - W * 0.36, yb - HH * 0.2, W * 0.72, HH * 0.1), 4);
      shape(g, '#16161c', ellipse(cx, yb + 2, W * 0.62, HH * 0.08), 5);
      shape(g, '#16161c', ellipse(cx, yb - HH * 0.72, W * 0.36, HH * 0.06), 4);
      break;
    }
    case 'bonnet': {
      shape(g, grad(g, 0, top - HH * 0.1, 0, yb + HH * 0.3, [[0, '#ffe4f1'], [1, '#ffc2de']]), (c) => {
        c.moveTo(cx - W * 0.56, yb + HH * 0.3);
        c.bezierCurveTo(cx - W * 0.66, top - HH * 0.14, cx + W * 0.5, top - HH * 0.16, cx + W * 0.5, yb + HH * 0.04);
        c.lineTo(cx + W * 0.5, yb + HH * 0.04);
        c.closePath();
      });
      shape(g, '#ffffff', (c) => { c.moveTo(cx - W * 0.56, yb + HH * 0.3); c.quadraticCurveTo(cx - W * 0.1, yb + HH * 0.06, cx + W * 0.5, yb + HH * 0.04); c.lineTo(cx + W * 0.5, yb + HH * 0.12); c.quadraticCurveTo(cx - W * 0.1, yb + HH * 0.16, cx - W * 0.56, yb + HH * 0.38); c.closePath(); }, 4);
      break;
    }
    case 'shades': {
      const y = h.eye, ex = h.eyeX;
      const lw = h.w * 0.2, lh = HH * 0.15;
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = INK;
      g.lineWidth = 6;
      // arm running back over the ear and the bridge
      g.beginPath(); g.moveTo(ex - h.w * 0.27, y - 2); g.lineTo(ex - h.w * 0.37, y + 1); g.stroke();
      g.beginPath(); g.moveTo(ex - h.w * 0.05, y - 1); g.lineTo(ex + h.w * 0.03, y - 1); g.stroke();
      for (const dx of [-0.15, 0.13]) {
        const cx2 = ex + h.w * dx;
        shape(g, grad(g, 0, y - lh, 0, y + lh, [[0, '#2a2a40'], [1, '#05050c']]), (c) => {
          c.moveTo(cx2 - lw / 2, y - lh * 0.6);
          c.quadraticCurveTo(cx2, y - lh * 0.9, cx2 + lw / 2, y - lh * 0.6);
          c.lineTo(cx2 + lw / 2 - 3, y + lh * 0.7);
          c.quadraticCurveTo(cx2, y + lh * 1.1, cx2 - lw / 2 + 3, y + lh * 0.7);
          c.closePath();
        }, 4);
        g.fillStyle = 'rgba(170,190,255,0.55)';
        g.beginPath(); g.ellipse(cx2 - lw * 0.18, y - lh * 0.25, lw * 0.16, lh * 0.18, -0.5, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      break;
    }
  }
  g.restore();
}

// ---- props held in the front hand (game pixels) -----------------------------------------
/**
 * @param hand  game-px position of the hand
 * @param dir   unit vector of the forearm (elbow -> hand)
 * @param sig   game px per picture px (fighter scale), used to size props
 */
export function drawProp(g, prop, hand, dir, sig, poseName = '') {
  const k = sig / 0.085; // props are sized for a typical fighter
  g.save();
  g.translate(hand[0], hand[1]);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const line = (x0, y0, x1, y1, w, col, ink = 0.5) => {
    g.strokeStyle = INK; g.lineWidth = w + ink * 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  };
  const blob = (x, y, r, col) => { g.fillStyle = INK; g.beginPath(); g.arc(x, y, r + 0.5, 0, 6.3); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
  const box = (x, y, w, h, col) => { g.fillStyle = INK; g.fillRect(x - 0.5, y - 0.5, w + 1, h + 1); g.fillStyle = col; g.fillRect(x, y, w, h); };
  switch (prop) {
    case 'wand': {
      const a = Math.atan2(dir[1], dir[0]);
      g.rotate(a);
      line(-3 * k, 0, 15 * k, 0, 1.4 * k, '#6a4018');
      blob(16.5 * k, 0, 1.8 * k, '#ffffff');
      g.fillStyle = 'rgba(255,255,200,0.4)';
      g.beginPath(); g.arc(16.5 * k, 0, 4.5 * k, 0, 6.3); g.fill();
      break;
    }
    case 'cane': {
      if (poseName === 'swing') {
        // raised and swung: the cane follows the forearm, hook at the far end
        const a = Math.atan2(dir[1], dir[0]);
        g.rotate(a);
        line(-5 * k, 0, 36 * k, 0, 1.7 * k, '#8a5a28');
        line(36 * k, 0, 38.5 * k, 4.5 * k, 1.7 * k, '#8a5a28');
        line(38.5 * k, 4.5 * k, 35 * k, 7 * k, 1.7 * k, '#8a5a28');
        break;
      }
      const x = 2 * k, floor = -hand[1]; // leaning on it: the tip rests on the ground
      line(x, 0, x, floor, 1.6 * k, '#8a5a28');
      line(x, -1.5 * k, x + 4 * k, -3.5 * k, 1.6 * k, '#8a5a28');
      line(x + 4 * k, -3.5 * k, x + 5.5 * k, 0, 1.6 * k, '#8a5a28');
      break;
    }
    case 'trophy': {
      g.translate(0, -2 * k);
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(-5.5 * k, -11 * k); g.lineTo(5.5 * k, -11 * k); g.quadraticCurveTo(5 * k, -3 * k, 1.5 * k, -2 * k); g.lineTo(1.5 * k, 1 * k); g.lineTo(4 * k, 1 * k); g.lineTo(4 * k, 3 * k); g.lineTo(-4 * k, 3 * k); g.lineTo(-4 * k, 1 * k); g.lineTo(-1.5 * k, 1 * k); g.lineTo(-1.5 * k, -2 * k); g.quadraticCurveTo(-5 * k, -3 * k, -5.5 * k, -11 * k);
      g.fill();
      g.fillStyle = grad(g, -5 * k, 0, 5 * k, 0, [[0, '#ffe680'], [0.5, '#e8b923'], [1, '#a87a10']]);
      g.beginPath();
      g.moveTo(-4.7 * k, -10.4 * k); g.lineTo(4.7 * k, -10.4 * k); g.quadraticCurveTo(4.3 * k, -3.6 * k, 1 * k, -2.6 * k); g.lineTo(1 * k, 0.6 * k); g.lineTo(3.4 * k, 0.6 * k); g.lineTo(3.4 * k, 2.4 * k); g.lineTo(-3.4 * k, 2.4 * k); g.lineTo(-3.4 * k, 0.6 * k); g.lineTo(-1 * k, 0.6 * k); g.lineTo(-1 * k, -2.6 * k); g.quadraticCurveTo(-4.3 * k, -3.6 * k, -4.7 * k, -10.4 * k);
      g.fill();
      line(-5.5 * k, -9 * k, -8 * k, -8 * k, 0.9 * k, '#e8b923'); line(5.5 * k, -9 * k, 8 * k, -8 * k, 0.9 * k, '#e8b923');
      break;
    }
    case 'baguette': {
      const a = Math.atan2(dir[1], dir[0]);
      g.rotate(a);
      g.fillStyle = INK;
      g.beginPath(); g.ellipse(7 * k, 0, 13.5 * k, 3.2 * k, 0, 0, 6.3); g.fill();
      g.fillStyle = grad(g, 0, -3 * k, 0, 3 * k, [[0, '#e8b060'], [0.6, '#c98a3c'], [1, '#9a6424']]);
      g.beginPath(); g.ellipse(7 * k, 0, 13 * k, 2.7 * k, 0, 0, 6.3); g.fill();
      g.strokeStyle = '#f2cc88'; g.lineWidth = 0.7 * k;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo((7 + i * 4.4 - 1) * k, -1.8 * k); g.lineTo((7 + i * 4.4 + 1) * k, 1.4 * k); g.stroke(); }
      break;
    }
    case 'mic': {
      line(0, 0, -1 * k, -6 * k, 1.5 * k, '#1a1a22');
      const gr = g.createRadialGradient(-1.6 * k, -9 * k, 0.5, -1 * k, -8 * k, 3.2 * k);
      gr.addColorStop(0, '#f4f4ff'); gr.addColorStop(1, '#7a7a94');
      g.fillStyle = INK; g.beginPath(); g.arc(-1 * k, -8 * k, 3.1 * k, 0, 6.3); g.fill();
      g.fillStyle = gr; g.beginPath(); g.arc(-1 * k, -8 * k, 2.6 * k, 0, 6.3); g.fill();
      break;
    }
    case 'rattle': {
      const a = Math.atan2(dir[1], dir[0]);
      g.rotate(a);
      line(0, 0, 7 * k, 0, 1.4 * k, '#ff8cc6');
      blob(10.5 * k, 0, 3.8 * k, '#ffe066');
      blob(10.5 * k, 0, 1.2 * k, '#ff5fa2');
      blob(12 * k, -1.6 * k, 0.9 * k, '#5ab4ff');
      break;
    }
    case 'bottle': {
      box(-2.2 * k, -11 * k, 4.4 * k, 10 * k, '#2b8a3a');
      box(-2.2 * k, -8 * k, 4.4 * k, 3.4 * k, '#f0b030');
      box(-1.2 * k, -15 * k, 2.4 * k, 4.4 * k, '#2b8a3a');
      box(-1.5 * k, -16 * k, 3 * k, 1.4 * k, '#c8c8d0');
      break;
    }
    case 'jar': {
      box(-4.4 * k, -12 * k, 8.8 * k, 11 * k, 'rgba(190,235,255,0.9)');
      box(-4.8 * k, -14.4 * k, 9.6 * k, 2.4 * k, '#8a5a2a');
      for (const [px, py] of [[-2, -8], [1, -6], [2, -9.5], [-1, -3.8], [1.6, -3]]) blob(px * k, py * k, 0.6 * k, '#1a1010');
      break;
    }
  }
  g.restore();
}
