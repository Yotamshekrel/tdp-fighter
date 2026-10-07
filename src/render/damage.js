// ---------------------------------------------------------------------------
// Grown-up mode: a battered fighter. The wounds are painted INTO a copy of the sprite frame, attached to the
// joints of that frame's pose (torso, head, arms, legs, see `parts` in puppet.js), and clipped to the silhouette
// ('source-atop'). So they move with the body: they follow a jump, a crouch, a hit, a fall.
//
// A frame is built once per (fighter, pose, frame, costume, level) and cached by the sprite bank, so this costs
// nothing while playing. level 1..4 = how hurt (more and bigger wounds, a greyer skin).
// Every fighter gets their own layout of cuts, from a seed made out of their id.
// ---------------------------------------------------------------------------

/** Small seeded generator: the same fighter always gets the same wounds in the same places. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str) => [...str].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

// ---- the ingredients ----------------------------------------------------------------------------------------

/** Blood soaking into cloth or skin: soft-edged lobes, a darker wet core, specks around it and a faint shine. */
function soak(g, x, y, r, rnd, a = 1) {
  for (let i = 0; i < 6; i++) {
    const ang = rnd() * 6.28, d = r * (0.2 + rnd() * 0.5);
    const cx = x + Math.cos(ang) * d, cy = y + Math.sin(ang) * d * 0.9 + r * 0.1, rad = r * (0.42 + rnd() * 0.34);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, `rgba(96, 5, 16, ${0.8 * a})`);
    gr.addColorStop(0.6, `rgba(124, 9, 22, ${0.58 * a})`);
    gr.addColorStop(1, 'rgba(124, 9, 22, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, rad, 0, 6.3);
    g.fill();
  }
  // spatter
  g.fillStyle = `rgba(130, 10, 24, ${0.8 * a})`;
  for (let i = 0; i < 6; i++) {
    const ang = rnd() * 6.28, d = r * (0.9 + rnd() * 0.9);
    g.beginPath();
    g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 0.18 + rnd() * 0.4, 0, 6.3);
    g.fill();
  }
  g.fillStyle = `rgba(255, 140, 150, ${0.14 * a})`;
  g.beginPath();
  g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.22, r * 0.11, -0.6, 0, 6.3);
  g.fill();
}

/** A streak of blood running down (always downwards on screen): fades in from the wound, ends in a bead. */
function drip(g, x, y, len, w, a = 1) {
  const gr = g.createLinearGradient(0, y, 0, y + len);
  gr.addColorStop(0, `rgba(110, 6, 18, 0)`);
  gr.addColorStop(0.2, `rgba(118, 7, 20, ${0.85 * a})`);
  gr.addColorStop(1, `rgba(96, 4, 15, ${0.92 * a})`);
  g.lineCap = 'round';
  g.strokeStyle = gr;
  g.lineWidth = w * 0.9;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w * 0.15, y + len);
  g.stroke();
  const bx = x + w * 0.15, by = y + len + w * 0.15;
  const bg = g.createRadialGradient(bx - w * 0.2, by - w * 0.2, 0, bx, by, w * 0.8);
  bg.addColorStop(0, `rgba(200, 40, 55, ${a})`);
  bg.addColorStop(1, `rgba(100, 4, 16, ${a})`);
  g.fillStyle = bg;
  g.beginPath();
  g.arc(bx, by, w * 0.7, 0, 6.3);
  g.fill();
  g.fillStyle = `rgba(255, 200, 205, ${0.4 * a})`;
  g.fillRect(x - w * 0.3, y + len * 0.25, w * 0.18, len * 0.55);
}

/** An open cut: dark torn edge, red inside, a bright wet line, blood welling out and a few specks. */
function gash(g, a, b, rnd, w = 1, ooze = 2.4) {
  const mid = lerp(a, b, 0.5);
  const n = norm([-(b[1] - a[1]), b[0] - a[0]]);
  const bow = (rnd() - 0.5) * w * 3;
  const c = [mid[0] + n[0] * bow, mid[1] + n[1] * bow];
  soak(g, mid[0], mid[1] + 0.6, ooze * w, rnd, 0.8);
  g.lineCap = 'round';
  for (const [col, lw] of [['rgba(54, 3, 9, 0.9)', 1.7], ['rgba(112, 8, 20, 0.95)', 1.0], ['rgba(196, 40, 52, 0.55)', 0.32]]) {
    g.strokeStyle = col;
    g.lineWidth = lw * w;
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    g.stroke();
  }
  g.fillStyle = 'rgba(150, 12, 26, 0.9)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(mid[0] + (rnd() - 0.5) * 7 * w, mid[1] + (rnd() - 0.4) * 6 * w, (0.25 + rnd() * 0.35) * w, 0, 6.3);
    g.fill();
  }
}

/** A bruise: purple in the middle, yellowing at the edge. */
function bruise(g, x, y, rx, ry, rot, a = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(70, 28, 100, ${0.6 * a})`);
  gr.addColorStop(0.65, `rgba(96, 40, 110, ${0.4 * a})`);
  gr.addColorStop(0.9, `rgba(150, 140, 50, ${0.2 * a})`);
  gr.addColorStop(1, 'rgba(150, 140, 50, 0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, rx, 0, 6.3);
  g.fill();
  g.restore();
}

// ---- where things go ----------------------------------------------------------------------------------------

/** Point on the torso: u 0 (hips) .. 1 (shoulders), v -1 (back) .. 1 (front). */
function onTorso(P, u, v) {
  const ax = P.chest[0] - P.hip[0], ay = P.chest[1] - P.hip[1];
  const n = norm([-ay, ax]);
  const p = lerp(P.hip, P.chest, u);
  return [p[0] + n[0] * v * 6.5, p[1] + n[1] * v * 6.5];
}

/** The painting itself. Level 1..4 decides how many of the wounds exist and how big they are. */
function paint(g, P, level, id) {
  // each wound has its own random stream, so it looks the same whatever the level (and the pose)
  const R = (k) => rng(hash(id + k));
  const L = level, big = 0.75 + 0.12 * L;
  const eye = P.eye, mouth = P.mouth;
  const dn = norm([mouth[0] - eye[0], mouth[1] - eye[1]]); // down the face
  const fwd = [dn[1], -dn[0]]; // towards where the fighter looks
  const fs = Math.max(0.7, Math.hypot(mouth[0] - eye[0], mouth[1] - eye[1]) / 6);
  const at = (o, d, f) => [o[0] + dn[0] * d * fs + fwd[0] * f * fs, o[1] + dn[1] * d * fs + fwd[1] * f * fs];

  // -- the body, worst last so it sits on top --
  const tA = onTorso(P, 0.5, 0.15), tB = onTorso(P, 0.32, -0.25), tC = onTorso(P, 0.7, 0.3);
  if (L >= 1) {
    soak(g, tA[0], tA[1], 5.2 * big, R('1'));
    drip(g, tA[0] + 1, tA[1] + 3 * big, 4 + 2 * L + R('2')() * 3, 0.9);
  }
  if (L >= 2) {
    gash(g, onTorso(P, 0.58, 0.5), onTorso(P, 0.4, 0.05), R('3'), 1.05);
    soak(g, tB[0], tB[1], 4.6 * big, R('4'));
    drip(g, tB[0], tB[1] + 3, 5 + R('5')() * 4, 0.85);
  }
  if (L >= 3) {
    gash(g, onTorso(P, 0.78, 0.15), onTorso(P, 0.64, 0.55), R('6'), 1);
    soak(g, tC[0], tC[1], 4.2 * big, R('7'));
    soak(g, onTorso(P, 0.18, 0.0)[0], onTorso(P, 0.18, 0.0)[1], 5.5 * big, R('8'), 0.9);
    drip(g, onTorso(P, 0.1, 0.4)[0], onTorso(P, 0.1, 0.4)[1], 7 + R('9')() * 4, 0.9);
  }
  if (L >= 4) {
    const w = onTorso(P, 0.45, 0);
    soak(g, w[0], w[1], 8.5, R('10'));
    for (let i = 0; i < 3; i++) drip(g, onTorso(P, 0.25 + i * 0.12, -0.5 + i * 0.5)[0], onTorso(P, 0.25 + i * 0.12, -0.5 + i * 0.5)[1], 6 + R('11')() * 6, 0.8);
  }

  // -- the front arm --
  const A = P.armF;
  if (L >= 1) {
    const w = lerp(A.e, A.h, 0.5);
    gash(g, [w[0] - 1.8, w[1] - 0.8], [w[0] + 1.6, w[1] + 1.2], R('12'), 0.85, 2.1);
    drip(g, w[0], w[1] + 1.6, 4 + 2 * L, 0.7);
  }
  if (L >= 2) {
    const u = lerp(A.s, A.e, 0.55);
    soak(g, u[0], u[1], 3.4 * big, R('13'));
    bruise(g, A.e[0], A.e[1], 3, 2.2, 0.5, 1);
  }
  if (L >= 3) {
    const f = lerp(A.e, A.h, 0.22);
    soak(g, f[0], f[1], 3 * big, R('14'));
    drip(g, A.h[0] - 0.5, A.h[1] - 1.2, 5 + R('15')() * 3, 0.7); // running off the knuckles
  }
  // the back arm shows a little too
  if (L >= 2) {
    const B = P.armB, w = lerp(B.e, B.h, 0.45);
    soak(g, w[0], w[1], 2.6 * big, R('16'), 0.9);
    drip(g, w[0], w[1] + 1.4, 4 + R('17')() * 3, 0.6);
  }

  // -- the legs --
  const F = P.legF;
  if (L >= 1) {
    const k = lerp(F.k, F.f, 0.35);
    gash(g, [k[0] - 1.6, k[1] - 1.5], [k[0] + 1.8, k[1] + 0.9], R('18'), 0.85, 2);
    drip(g, k[0], k[1] + 1.5, 4 + R('19')() * 3, 0.65);
  }
  if (L >= 2) {
    const t = lerp(F.h, F.k, 0.55);
    soak(g, t[0], t[1], 3.8 * big, R('20'));
    bruise(g, F.k[0] + 0.5, F.k[1], 3, 2.4, 0.2, 1);
  }
  if (L >= 3) {
    const t = lerp(F.h, F.k, 0.25);
    gash(g, [t[0] - 2, t[1] - 1], [t[0] + 2, t[1] + 1.4], R('21'), 0.9);
    const s = lerp(F.k, F.f, 0.7);
    soak(g, s[0], s[1], 2.8 * big, R('22'));
    drip(g, s[0], s[1] + 1, 5, 0.65);
  }
  if (L >= 4) {
    const t = lerp(P.legB.h, P.legB.k, 0.6);
    soak(g, t[0], t[1], 3.6, R('23'));
    drip(g, t[0], t[1] + 2, 8, 0.7);
  }

  // -- the face --
  if (L >= 1) {
    // a bleeding nose and a split lip, with a thread down the chin
    const nose = at(eye, 3.2, 1.4);
    drip(g, nose[0], nose[1], (mouth[1] - nose[1]) + 2.5 + L * 1.6, 0.85 * fs);
    const lip = at(mouth, 0, 1.2);
    g.fillStyle = 'rgba(150, 12, 26, 0.9)';
    g.beginPath();
    g.ellipse(lip[0], lip[1], 1.5 * fs, 0.8 * fs, 0, 0, 6.3);
    g.fill();
    const chin = at(mouth, 1.4, 1);
    drip(g, chin[0], chin[1], 2 + L * 1.2, 0.7 * fs);
    const ch = at(eye, 4.8, 3.6);
    bruise(g, ch[0], ch[1], 3.4 * fs, 2.6 * fs, 0.3, 0.9);
  }
  if (L >= 2) {
    const e = at(eye, 0.3, 1.1);
    bruise(g, e[0], e[1], 3.9 * fs, 3 * fs, 0, 1);
    const b0 = at(eye, -3.2, -1.2), b1 = at(eye, -3.8, 3.8);
    gash(g, b0, b1, R('24'), 0.6 * fs, 1.4 * fs);
    drip(g, (b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2 + 0.6, 7 * fs, 0.7 * fs); // runs down over the eye
  }
  if (L >= 3) {
    const f = at(eye, -4.4, 0.6);
    const gr = g.createLinearGradient(f[0], f[1], f[0] + dn[0] * 13 * fs, f[1] + dn[1] * 13 * fs);
    gr.addColorStop(0, 'rgba(140, 8, 22, 0.55)');
    gr.addColorStop(1, 'rgba(140, 8, 22, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(f[0] + dn[0] * 5 * fs, f[1] + dn[1] * 5 * fs, 6.5 * fs, 9 * fs, Math.atan2(dn[1], dn[0]) - 1.57, 0, 6.3);
    g.fill();
    const c2 = at(eye, 5, -0.8);
    gash(g, c2, at(eye, 4.4, 2.6), R('25'), 0.55 * fs, 1.2 * fs);
  }
  if (L >= 4) {
    const f = at(eye, -2, 0.6);
    soak(g, f[0], f[1], 6 * fs, R('26'), 0.5);
    const ear = at(eye, 1.2, -4.4);
    drip(g, ear[0], ear[1], 8 * fs, 0.8 * fs);
  }
}

/**
 * A copy of a hi-res frame, greyed by `level` and with the wounds painted on.
 * (Frames without joints, such as the old pixel bodies, just get the grey.)
 */
export function damagedFrame(base, level, id) {
  const src = base.canvas;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(118, 110, 128, ${(level * 0.075).toFixed(3)})`;
  g.fillRect(0, 0, c.width, c.height);
  if (base.parts) {
    g.setTransform(base.res, 0, 0, base.res, base.ax * base.res, base.ay * base.res);
    paint(g, base.parts, level, id);
  }
  return c;
}
