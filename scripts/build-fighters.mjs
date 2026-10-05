// ---------------------------------------------------------------------------
// Builds the hi-res "paper dolls" for every fighter from the pictures in
// assets/new_photos/<Name>.png.
//
//   1. cut the character out of the magenta backdrop          (lib/keyed.mjs)
//   2. work out which body part each pixel belongs to: a flood fill that starts
//      on the bones and stops at the dark outlines, so the cuts between arm and
//      body follow the drawn outline instead of a straight line
//   3. slice every limb at its elbow / knee, add small overlaps at the joints
//      and paint in whatever a limb was hiding (the body behind an arm)
//   4. write public/fighters/<id>/atlas.png + rig.json (+ portrait, full body)
//
// At runtime src/render/puppet.js re-poses the parts with the skeleton poses
// in poses.js. Nothing is ever cropped away: every pixel of the picture lands
// in exactly one part (plus overlaps), and the whole figure is also saved
// uncut as full.png for the menus.
//
//   node scripts/build-fighters.mjs              build every fighter
//   node scripts/build-fighters.mjs ido maya     only these
//   FIGHTER_DEBUG=/some/dir node scripts/build-fighters.mjs ido   also write overlays
// ---------------------------------------------------------------------------
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadKeyed, bounds } from './lib/keyed.mjs';
import { TEMPLATE, RIGS, HEAD_CUT_BELOW_CHIN, HIP_CUT_BELOW_PELVIS, KNEE_CUT_ABOVE_KNEE } from './fighter-rigs.mjs';
import { CHARACTERS } from '../src/data/characters.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/new_photos');
const OUT = join(ROOT, 'public/fighters');
const DEBUG = process.env.FIGHTER_DEBUG || '';
const PART_RES = 0.5; // parts are saved at half the size of the source picture
const FULL_H = 760; // height of the uncut full-body picture used by the menus
const BASE_HEIGHT = 80; // on-screen height (game px) of a fighter whose body.height is 1
const OUTLINE = [20, 16, 30];

// skeleton proportions (poses.js): hip height, torso length, arm length, foot spread
const SK = { leg: 26, torso: 22, arm: 17.2, spread: 16 };

const HEAD = 1, TORSO = 2, ARM_F = 3, ARM_B = 4, LEG_F = 5, LEG_B = 6;
const PARTS = ['head', 'torso', 'armF_up', 'armF_low', 'armB_up', 'armB_low', 'thighF', 'shinF', 'thighB', 'shinB'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };

function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1);
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/** Binary min-heap of (key, value) pairs. */
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const { k, v } = this;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const { k, v } = this;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

/** A pixel layer: RGBA bytes with its own alpha. */
class Layer {
  constructor(W, H) { this.W = W; this.H = H; this.d = new Uint8ClampedArray(W * H * 4); }
  has(p) { return this.d[p * 4 + 3] > 0; }
  copy(px, p) { const i = p * 4; this.d[i] = px[i]; this.d[i + 1] = px[i + 1]; this.d[i + 2] = px[i + 2]; this.d[i + 3] = 255; }
}

// ---------------------------------------------------------------------------
function rigFor(id, box, img) {
  const def = RIGS[id] || { chin: 190 };
  const u = box.h / 1000; // pixels per normalised unit
  const J = {};
  const joints = { ...TEMPLATE, ...(def.joints || {}) };
  for (const [k, [nx, ny]] of Object.entries(joints)) J[k] = [box.cx + nx * u, box.y0 + ny * u];
  // the arm joints must sit inside the silhouette: the back arm is the outermost thing on the left, the front arm on the right
  const { alpha, W } = img;
  const edge = (y, dir) => {
    let sum = 0, n = 0;
    for (let yy = Math.round(y) - 6; yy <= Math.round(y) + 6; yy++) {
      for (let x = dir < 0 ? 0 : W - 1; x >= 0 && x < W; x -= dir) if (alpha[yy * W + x]) { sum += x; n++; break; }
    }
    return n ? sum / n : box.cx;
  };
  const ARM_HALF = 24 * u;
  for (const k of ['shoulderB', 'elbowB', 'handB']) J[k][0] = Math.max(J[k][0], edge(J[k][1], -1) + ARM_HALF);
  for (const k of ['shoulderF', 'elbowF', 'handF']) J[k][0] = Math.min(J[k][0], edge(J[k][1], 1) - ARM_HALF);
  const headCut = box.y0 + (def.chin + HEAD_CUT_BELOW_CHIN) * u;
  const hipCut = def.hipCut ? box.y0 + def.hipCut * u : J.pelvis[1] + HIP_CUT_BELOW_PELVIS * u;
  return { J, headCut, hipCut, u, chin: box.y0 + def.chin * u, edge };
}

/** Which body part does every opaque pixel belong to? */
function segment(img, box, R) {
  const { px, alpha, W, H } = img;
  const { J, headCut, hipCut, u } = R;
  const x0 = Math.max(0, box.x0 - 2), x1 = Math.min(W - 1, box.x1 + 2);
  const y0 = Math.max(0, box.y0 - 2), y1 = Math.min(H - 1, box.y1 + 2);
  const lab = new Uint8Array(W * H);
  const cost = new Float32Array(W * H);
  const dist = new Float32Array(W * H).fill(Infinity);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (!alpha[p]) continue;
      const luma = 0.3 * px[p * 4] + 0.59 * px[p * 4 + 1] + 0.11 * px[p * 4 + 2];
      cost[p] = 1 + 40 * clamp((26 - luma) / 14, 0, 1); // the near-black outlines are expensive to cross (dark clothing is not)
    }
  }

  // arm corridors: an arm may only claim pixels near its own bones
  const armBones = {
    [ARM_F]: [[J.shoulderF, J.elbowF], [J.elbowF, J.handF]],
    [ARM_B]: [[J.shoulderB, J.elbowB], [J.elbowB, J.handB]],
  };
  const corridor = { [ARM_F]: new Uint8Array(W * H), [ARM_B]: new Uint8Array(W * H) };
  const legBones = {
    [LEG_F]: [[J.hipF, J.kneeF], [J.kneeF, J.soleF]],
    [LEG_B]: [[J.hipB, J.kneeB], [J.kneeB, J.soleB]],
  };

  const heap = new Heap();
  const seed = (p, L) => { if (lab[p]) return; lab[p] = L; dist[p] = 0; heap.push(0, p); };
  const spineX = (y) => {
    const t = clamp((y - J.neck[1]) / (J.pelvis[1] - J.neck[1]), 0, 1);
    return J.neck[0] + (J.pelvis[0] - J.neck[0]) * t;
  };

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (!alpha[p]) continue;
      if (y < headCut) { lab[p] = HEAD; continue; }
      for (const L of [ARM_F, ARM_B]) {
        let d = 1e9;
        for (const [a, b] of armBones[L]) d = Math.min(d, distToSeg(x, y, a, b));
        if (d <= 58 * u) corridor[L][p] = 1;
      }
    }
  }
  // seeds: torso core, arm bones, leg bones
  for (let y = Math.ceil(headCut + 20 * u); y < hipCut - 10 * u; y++) {
    const sx = spineX(y);
    const half = 0.24 * (R.edge(y, 1) - R.edge(y, -1)); // the core of the body: a quarter of the silhouette width each side
    for (let x = Math.floor(sx - half); x <= sx + half; x++) {
      const p = y * W + x;
      if (alpha[p]) seed(p, TORSO);
    }
  }
  for (const L of [ARM_F, ARM_B]) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (!alpha[p] || lab[p] || y < headCut) continue;
      let d = 1e9;
      for (const [a, b] of armBones[L]) d = Math.min(d, distToSeg(x, y, a, b));
      if (d <= 10 * u) seed(p, L);
    }
  }
  for (const L of [LEG_F, LEG_B]) {
    for (let y = Math.ceil(hipCut + 4 * u); y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x;
      if (!alpha[p] || lab[p]) continue;
      let d = 1e9;
      for (const [a, b] of legBones[L]) d = Math.min(d, distToSeg(x, y, a, b));
      if (d <= 14 * u) seed(p, L);
    }
  }

  const allowed = (L, x, y, p) => {
    if (L === TORSO) return y < hipCut;
    if (L === ARM_F || L === ARM_B) return y >= headCut && corridor[L][p] === 1;
    return y >= hipCut; // legs
  };
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [-1, 1, 1.414], [1, -1, 1.414], [-1, -1, 1.414]];
  while (heap.size) {
    const p = heap.pop();
    const L = lab[p];
    const d0 = dist[p];
    const x = p % W, y = (p / W) | 0;
    for (const [dx, dy, w] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const q = ny * W + nx;
      if (!alpha[q] || ny < headCut) continue;
      const nd = d0 + cost[q] * w;
      if (nd >= dist[q] || !allowed(L, nx, ny, q)) continue;
      dist[q] = nd;
      lab[q] = L;
      heap.push(nd, q);
    }
  }

  // anything the flood never reached (islands) goes by simple rules
  const dflt = (x, y) => (y < hipCut ? TORSO : x < J.pelvis[0] ? LEG_B : LEG_F);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = y * W + x;
    if (alpha[p] && !lab[p]) lab[p] = dflt(x, y);
  }
  // each limb is one connected blob; stray bits go back to the body
  for (const L of [ARM_F, ARM_B, LEG_F, LEG_B]) {
    const seen = new Uint8Array(W * H);
    let best = [];
    const comps = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const s0 = y * W + x;
      if (lab[s0] !== L || seen[s0]) continue;
      const comp = [];
      const st = [s0];
      seen[s0] = 1;
      while (st.length) {
        const q = st.pop();
        comp.push(q);
        const qx = q % W;
        for (const n of [qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1, q >= W ? q - W : -1, q < W * (H - 1) ? q + W : -1]) {
          if (n >= 0 && lab[n] === L && !seen[n]) { seen[n] = 1; st.push(n); }
        }
      }
      comps.push(comp);
      if (comp.length > best.length) best = comp;
    }
    for (const comp of comps) if (comp !== best) for (const q of comp) lab[q] = dflt(q % W, (q / W) | 0);
  }
  return lab;
}

/** Paint `holes` (pixel indices) of a layer with the colour of the nearest pixel that the layer already has. */
function fillHoles(layer, holes, maxSteps = 90) {
  const { W, H } = layer;
  const hole = new Set(holes);
  let frontier = [];
  const src = new Map();
  for (const p of hole) {
    const x = p % W;
    for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < W * (H - 1) ? p + W : -1]) {
      if (n >= 0 && layer.has(n) && !hole.has(n)) { src.set(p, n); frontier.push(p); break; }
    }
  }
  const done = new Set(frontier);
  const order = [];
  for (let s = 0; s < maxSteps && frontier.length; s++) {
    const next = [];
    for (const p of frontier) {
      order.push(p);
      const x = p % W;
      for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < W * (H - 1) ? p + W : -1]) {
        if (n >= 0 && hole.has(n) && !done.has(n)) { done.add(n); src.set(n, src.get(p)); next.push(n); }
      }
    }
    frontier = next;
  }
  for (const p of order) {
    const s = src.get(p);
    const i = p * 4, j = s * 4;
    layer.d[i] = layer.d[j]; layer.d[i + 1] = layer.d[j + 1]; layer.d[i + 2] = layer.d[j + 2]; layer.d[i + 3] = 255;
  }
}

// ---------------------------------------------------------------------------
async function buildOne(file) {
  const name = file.replace(/\.png$/i, '');
  const id = name.toLowerCase();
  const def = CHARACTERS.find((c) => c.id === id);
  if (!def) { console.warn(`  ${name}: not in the roster, skipped`); return null; }

  const img = await loadKeyed(join(SRC, file));
  const { px, alpha, W, H } = img;
  const b = bounds(alpha, W, H);
  let sx = 0, cnt = 0;
  for (let y = b.y0 + Math.round(0.25 * b.h); y < b.y0 + Math.round(0.45 * b.h); y++) for (let x = 0; x < W; x++) if (alpha[y * W + x]) { sx += x; cnt++; }
  const box = { ...b, cx: sx / cnt };
  const R = rigFor(id, box, img);
  const { J, headCut, hipCut, u } = R;

  const lab = segment(img, box, R);

  // ---- layers ----------------------------------------------------------------------
  const L = Object.fromEntries(PARTS.map((n) => [n, new Layer(W, H)]));
  const armDirF = norm(sub(J.elbowF, J.shoulderF)), armDirB = norm(sub(J.elbowB, J.shoulderB));
  const legDirF = norm(sub(J.kneeF, J.hipF)), legDirB = norm(sub(J.kneeB, J.hipB));
  const kneePlaneF = [J.kneeF[0] - legDirF[0] * KNEE_CUT_ABOVE_KNEE * u, J.kneeF[1] - legDirF[1] * KNEE_CUT_ABOVE_KNEE * u];
  const kneePlaneB = [J.kneeB[0] - legDirB[0] * KNEE_CUT_ABOVE_KNEE * u, J.kneeB[1] - legDirB[1] * KNEE_CUT_ABOVE_KNEE * u];
  const OV_ELBOW = 26 * u, OV_KNEE = 44 * u, OV_HIP = 34 * u, OV_NECK = 34 * u, SHOULDER_DISC = 40 * u;

  const owner = new Uint8Array(W * H);
  const y0 = Math.max(0, b.y0 - 2), y1 = Math.min(H - 1, b.y1 + 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!alpha[p]) continue;
      const lb = lab[p];
      let part;
      if (lb === HEAD) part = 'head';
      else if (lb === TORSO) part = 'torso';
      else if (lb === ARM_F || lb === ARM_B) {
        const f = lb === ARM_F;
        const t = dot(sub([x, y], f ? J.elbowF : J.elbowB), f ? armDirF : armDirB);
        part = (f ? 'armF_' : 'armB_') + (t < 0 ? 'up' : 'low');
        if (t >= 0 && t < OV_ELBOW) L[(f ? 'armF_' : 'armB_') + 'up'].copy(px, p); // upper arm reaches a little past the elbow
      } else {
        const f = lb === LEG_F;
        const t = dot(sub([x, y], f ? kneePlaneF : kneePlaneB), f ? legDirF : legDirB);
        part = t >= 0 ? (f ? 'shinF' : 'shinB') : f ? 'thighF' : 'thighB';
        if (t >= 0 && t < OV_KNEE) L[f ? 'thighF' : 'thighB'].copy(px, p); // thigh runs under the knee pad
      }
      L[part].copy(px, p);
      owner[p] = PARTS.indexOf(part) + 1;

      // overlaps: torso <-> head, torso -> thighs, torso -> shoulders
      if (lb === HEAD && y >= headCut - OV_NECK) L.torso.copy(px, p);
      if (lb === TORSO) {
        if (y >= hipCut - OV_HIP) L[x < J.pelvis[0] ? 'thighB' : 'thighF'].copy(px, p);
        if (Math.hypot(x - J.shoulderF[0], y - J.shoulderF[1]) < SHOULDER_DISC) L.armF_up.copy(px, p);
        if (Math.hypot(x - J.shoulderB[0], y - J.shoulderB[1]) < SHOULDER_DISC) L.armB_up.copy(px, p);
      }
    }
  }

  // ---- paint in what the arms were hiding ------------------------------------------------
  // body behind the arms: arm pixels that sit between the torso's left and right edge on a row
  const torsoHoles = [];
  for (let y = Math.ceil(headCut); y < hipCut; y++) {
    let lo = W, hi = -1;
    for (let x = 0; x < W; x++) if (lab[y * W + x] === TORSO) { if (x < lo) lo = x; if (x > hi) hi = x; }
    if (hi < 0) continue;
    for (let x = lo; x <= hi; x++) {
      const p = y * W + x;
      if (lab[p] === ARM_F || lab[p] === ARM_B) torsoHoles.push(p);
    }
  }
  fillHoles(L.torso, torsoHoles);
  // legs behind the hands: arm pixels that sit inside a leg's left / right edge on a row
  const legHoles = { thighF: [], shinF: [], thighB: [], shinB: [] };
  for (let y = Math.ceil(hipCut); y <= y1; y++) {
    const span = {};
    for (const lg of [LEG_F, LEG_B]) {
      let lo = W, hi = -1;
      for (let x = 0; x < W; x++) if (lab[y * W + x] === lg) { if (x < lo) lo = x; if (x > hi) hi = x; }
      span[lg] = [lo, hi];
    }
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (lab[p] !== ARM_F && lab[p] !== ARM_B) continue;
      for (const lg of [LEG_F, LEG_B]) {
        if (x < span[lg][0] || x > span[lg][1]) continue;
        const f = lg === LEG_F;
        const t = dot(sub([x, y], f ? kneePlaneF : kneePlaneB), f ? legDirF : legDirB);
        legHoles[(t >= 0 ? 'shin' : 'thigh') + (f ? 'F' : 'B')].push(p);
        break;
      }
    }
  }
  for (const [nm, holes] of Object.entries(legHoles)) if (holes.length) fillHoles(L[nm], holes);

  // ---- scale / skeleton fit -----------------------------------------------------------------
  const sigma = (BASE_HEIGHT * (def.body?.height || 1)) / box.h; // game px per source px
  const mean = (a, b) => (a + b) / 2;
  const armLen = (s, e, h) => Math.hypot(e[0] - s[0], e[1] - s[1]) + Math.hypot(h[0] - e[0], h[1] - e[1]);
  const fit = {
    Kl: ((mean(J.soleB[1], J.soleF[1]) - J.pelvis[1]) * sigma) / SK.leg,
    Kt: ((J.pelvis[1] - J.neck[1]) * sigma) / SK.torso,
    Ka: (mean(armLen(J.shoulderB, J.elbowB, J.handB), armLen(J.shoulderF, J.elbowF, J.handF)) * sigma) / SK.arm,
    Klx: ((J.soleF[0] - J.soleB[0]) * sigma) / SK.spread,
  };

  // ---- write parts into one atlas ----------------------------------------------------------------
  const dir = join(OUT, id);
  mkdirSync(dir, { recursive: true });
  const cut = [];
  for (const n of PARTS) {
    const lay = L[n];
    let [bx0, by0, bx1, by1] = [W, H, -1, -1];
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (lay.d[(y * W + x) * 4 + 3]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (bx1 < 0) { console.warn(`  ${name}: empty part ${n}`); continue; }
    const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
    const aw = Math.max(1, Math.round(w * PART_RES)), ah = Math.max(1, Math.round(h * PART_RES));
    const buf = await sharp(Buffer.from(lay.d.buffer), { raw: { width: W, height: H, channels: 4 } })
      .extract({ left: bx0, top: by0, width: w, height: h })
      .resize(aw, ah, { kernel: 'lanczos3' })
      .png().toBuffer();
    cut.push({ n, x: bx0, y: by0, w, h, aw, ah, buf });
  }
  // shelf packing, 3px gutters so smoothing never bleeds a neighbour in
  const GUT = 3, AW = 1024;
  let cx = GUT, cy = GUT, rowH = 0;
  const parts = {};
  const placed = [];
  for (const c of [...cut].sort((a, b2) => b2.ah - a.ah)) {
    if (cx + c.aw + GUT > AW) { cx = GUT; cy += rowH + GUT; rowH = 0; }
    parts[c.n] = { x: c.x, y: c.y, w: c.w, h: c.h, ax: cx, ay: cy, aw: c.aw, ah: c.ah };
    placed.push({ input: c.buf, left: cx, top: cy });
    cx += c.aw + GUT;
    rowH = Math.max(rowH, c.ah);
  }
  const AH = cy + rowH + GUT;
  await sharp({ create: { width: AW, height: AH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(placed).png({ compressionLevel: 9 }).toFile(join(dir, 'atlas.png'));

  // ---- head info, portrait, full body ----------------------------------------------------------------
  let hx0 = W, hx1 = -1;
  for (let y = y0; y < headCut; y++) for (let x = 0; x < W; x++) if (lab[y * W + x] === HEAD) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  const headTop = b.y0, chin = R.chin;
  // eyes: the whites of the eyes (near-white, unsaturated pixels) in the upper face. Teeth are white too, so
  // only the topmost band of white counts.
  const hh = chin - headTop;
  const whites = [];
  for (let y = Math.floor(headTop + hh * 0.3); y < headTop + hh * 0.72; y++) {
    for (let x = hx0; x <= hx1; x++) {
      const p = y * W + x;
      if (lab[p] !== HEAD) continue;
      const r = px[p * 4], gg = px[p * 4 + 1], bb = px[p * 4 + 2];
      if (Math.min(r, gg, bb) > 185 && Math.max(r, gg, bb) - Math.min(r, gg, bb) < 45) whites.push([x, y]);
    }
  }
  whites.sort((a, b2) => a[1] - b2[1]);
  const y0w = whites.length > 12 ? whites[Math.min(3, whites.length - 1)][1] : -1;
  const band = whites.filter(([, y]) => y0w >= 0 && y <= y0w + hh * 0.09);
  const eyeFound = band.length >= 10;
  const bandY = band.reduce((a, [, y]) => a + y, 0) / (band.length || 1);
  const bandX = band.reduce((a, [x]) => a + x, 0) / (band.length || 1);
  const head = {
    cx: (hx0 + hx1) / 2, top: headTop, chin,
    eye: eyeFound ? bandY : headTop + hh * 0.56,
    eyeX: eyeFound ? bandX : (hx0 + hx1) / 2 + (hx1 - hx0) * 0.2,
    eyesFound: eyeFound,
    w: hx1 - hx0 + 1, x0: hx0, x1: hx1,
  };

  // portrait: head and the top of the shoulders, 28:32 like the old pixel portraits
  const ph = (chin - headTop) * 1.28, pw = (ph * 28) / 32;
  const pLeft = Math.round(head.cx - pw / 2 + 0.03 * pw), pTop = Math.round(headTop - ph * 0.04);
  const full = Buffer.from(px.buffer);
  const ext = { top: 60, bottom: 60, left: 60, right: 60 };
  await sharp(await sharp(full, { raw: { width: W, height: H, channels: 4 } }).extend({ ...ext, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
    .extract({ left: pLeft + 60, top: pTop + 60, width: Math.round(pw), height: Math.round(ph) })
    .resize(112, 128, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 }).toFile(join(dir, 'portrait.png'));

  // the whole figure, uncut, with a little air around it
  const pad = 10;
  const fullH = Math.round(FULL_H);
  const fw = Math.round(((b.w + pad * 2) * fullH) / (b.h + pad * 2));
  await sharp(await sharp(full, { raw: { width: W, height: H, channels: 4 } }).extend({ ...ext, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
    .extract({ left: b.x0 - pad + 60, top: b.y0 - pad + 60, width: b.w + pad * 2, height: b.h + pad * 2 })
    .resize(fw, fullH, { kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100 }).toFile(join(dir, 'full.webp'));

  const rigJson = {
    res: PART_RES, sigma, ...fit,
    figure: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 },
    full: { w: fw, h: fullH, pad, scale: fullH / (b.h + pad * 2), x0: b.x0, y0: b.y0, w0: b.w, h0: b.h },
    joints: Object.fromEntries(Object.entries(J).map(([k, v]) => [k, [Math.round(v[0]), Math.round(v[1])]])),
    cuts: { head: Math.round(headCut), hip: Math.round(hipCut) },
    head,
    atlas: { w: AW, h: AH },
    parts,
  };
  writeFileSync(join(dir, 'rig.json'), JSON.stringify(rigJson));

  if (DEBUG) await debugImages(name, img, box, lab, owner, J, R);
  console.log(`  ${name.padEnd(6)} sigma ${sigma.toFixed(4)}  Kl ${fit.Kl.toFixed(2)} Kt ${fit.Kt.toFixed(2)} Ka ${fit.Ka.toFixed(2)} Klx ${fit.Klx.toFixed(2)}  ${cut.length} parts`);
  return { id };
}

async function debugImages(name, img, box, lab, owner, J, R) {
  const { px, alpha, W, H } = img;
  mkdirSync(DEBUG, { recursive: true });
  const pal = { [HEAD]: [255, 220, 60], [TORSO]: [80, 160, 255], [ARM_F]: [255, 80, 80], [ARM_B]: [80, 255, 120], [LEG_F]: [255, 120, 255], [LEG_B]: [60, 255, 255] };
  const dbg = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const k = p * 4;
    dbg[k + 3] = 255;
    if (!alpha[p]) { dbg[k] = 88; dbg[k + 1] = 200; dbg[k + 2] = 120; continue; }
    const c = pal[lab[p]] || [0, 0, 0];
    for (let ch = 0; ch < 3; ch++) dbg[k + ch] = Math.round(px[k + ch] * 0.5 + c[ch] * 0.5);
  }
  const pad = 20;
  await sharp(dbg, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: Math.max(0, box.x0 - pad), top: Math.max(0, box.y0 - pad), width: Math.min(W, box.w + pad * 2), height: Math.min(H - box.y0 + pad, box.h + pad * 2) })
    .png().toFile(join(DEBUG, `${name}_seg.png`));
}

// ---------------------------------------------------------------------------
async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const files = readdirSync(SRC).filter((f) => /\.png$/i.test(f)).filter((f) => !only.length || only.includes(f.replace(/\.png$/i, '').toLowerCase()));
  mkdirSync(OUT, { recursive: true });
  const built = [];
  for (const f of files) {
    const r = await buildOne(f);
    if (r) built.push(r.id);
  }
  console.log(`built ${built.length} fighters -> public/fighters/`);
}
main();
