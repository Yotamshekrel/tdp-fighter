// ---------------------------------------------------------------------------
// Photo -> pixel-art head. Plain deterministic canvas image processing:
//
//   1. crop the face (box from characters.js, or a simple skin-tone detector)
//   2. remove the studio background (flood fill from the crop's edges)
//   3. cut a head-shaped mask (superellipse) so shoulders don't show
//   4. box-downsample to HEAD.W x HEAD.H (26x30)
//   5. boost contrast / saturation a little (pixel art likes punchy colours)
//   6. median-cut quantise to a 16-colour palette
//
// Output is a small image object { w, h, data: Uint32Array (RGBA, 0 = clear) }.
// No ML anywhere: just arithmetic on pixels.
// ---------------------------------------------------------------------------
import { HEAD } from '../config.js';

const SS = 4; // supersampling factor for the crop work buffer

export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ---- RGBA helpers (little-endian ImageData order) ----------------------------
export const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const R = (c) => c & 255;
export const Gc = (c) => (c >>> 8) & 255;
export const B = (c) => (c >>> 16) & 255;
export const A = (c) => c >>> 24;

/**
 * Build a pixel head from a loaded image.
 * @returns {{w, h, data: Uint32Array, skin: string, palette: number[]}}
 */
export function buildHead(img, face) {
  const W = HEAD.W, H = HEAD.H;
  const box = face ? faceBox(img, face) : autoFaceBox(img);

  // 1. Crop into a supersampled work canvas.
  const cw = W * SS, ch = H * SS;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#000';
  g.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, cw, ch);
  const src = g.getImageData(0, 0, cw, ch).data;

  // 2 + 3. Masks: background flood fill + head shape.
  const keep = new Uint8Array(cw * ch);
  const bg = floodBackground(src, cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      keep[i] = !bg[i] && inHeadShape(x + 0.5, y + 0.5, cw, ch) ? 1 : 0;
    }
  }

  // 4. Box downsample (average only kept pixels).
  const out = new Uint32Array(W * H);
  const rgb = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, gg = 0, b = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = (y * SS + sy) * cw + (x * SS + sx);
          if (!keep[i]) continue;
          r += src[i * 4];
          gg += src[i * 4 + 1];
          b += src[i * 4 + 2];
          n++;
        }
      }
      if (n >= (SS * SS) / 2) {
        // 5. enhance
        const [er, eg, eb] = enhance(r / n, gg / n, b / n);
        out[y * W + x] = pack(er, eg, eb);
        rgb.push([er, eg, eb, y * W + x]);
      }
    }
  }
  cleanMask(out, W, H);

  // 6. Quantise.
  const live = rgb.filter((p) => out[p[3]] !== 0);
  const palette = medianCut(live.map((p) => p.slice(0, 3)), HEAD.COLORS);
  for (const p of live) {
    const q = nearest(palette, p[0], p[1], p[2]);
    out[p[3]] = pack(q[0], q[1], q[2]);
  }

  return { w: W, h: H, data: out, skin: skinTone(out, W, H), palette };
}

/** A friendly generic head for missing photos. */
export function silhouetteHead() {
  const W = HEAD.W, H = HEAD.H;
  const out = new Uint32Array(W * H);
  const skin = pack(150, 140, 160), dark = pack(70, 64, 86), hair = pack(40, 36, 52), eye = pack(20, 16, 30);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inHeadShape(x + 0.5, y + 0.5, W, H)) continue;
      let c = skin;
      if (y < 9 || (y < 14 && (x < 5 || x > W - 6))) c = hair;
      else if (x > W * 0.62) c = dark;
      out[y * W + x] = c;
    }
  }
  // eyes + a little "?"
  out[14 * W + 9] = out[14 * W + 16] = eye;
  out[15 * W + 9] = out[15 * W + 16] = eye;
  for (const [x, y] of [[12, 20], [13, 20], [14, 21], [13, 22], [13, 24]]) out[y * W + x] = eye;
  return { w: W, h: H, data: out, skin: '#968ca0', palette: [] };
}

/**
 * "Old" variant of a head (for Ofir's special): hair and beard go grey,
 * but the eyes stay dark.
 */
export function agedHead(head) {
  const { w, h } = head;
  const data = new Uint32Array(head.data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x];
      if (!c) continue;
      const r = R(c), g = Gc(c), b = B(c);
      const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      const eyeBand = y > h * 0.4 && y < h * 0.52 && x > w * 0.18 && x < w * 0.82;
      if (l < 0.42 && !eyeBand) {
        const v = 150 + l * 200;
        data[y * w + x] = pack(v, v, v + 8);
      } else if (!eyeBand) {
        // slightly paler, more wrinkly-looking skin
        data[y * w + x] = pack(r * 0.9 + 20, g * 0.9 + 18, b * 0.9 + 16);
      }
    }
  }
  return { ...head, data };
}

// ---- crop boxes ------------------------------------------------------------
function faceBox(img, f) {
  const h = f.h * img.height;
  const w = (h * HEAD.W) / HEAD.H;
  return { x: f.x * img.width - w / 2, y: f.y * img.height - h / 2, w, h };
}

/**
 * Fallback when no crop is configured: find skin-coloured pixels (classic
 * YCbCr thresholds), take the biggest blob in the upper part of the photo and
 * build a head box around it (extended upwards for hair).
 */
export function autoFaceBox(img) {
  const S = 96;
  const sw = S, sh = Math.round((S * img.height) / img.width);
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh).data;
  const skin = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    const cb = 128 - 0.168736 * r - 0.331264 * gg + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * gg - 0.081312 * b;
    const y = Math.floor(i / sw);
    skin[i] = cb > 77 && cb < 127 && cr > 136 && cr < 173 && y < sh * 0.7 ? 1 : 0;
  }
  // Largest 4-connected component
  const label = new Int32Array(sw * sh).fill(-1);
  let best = null;
  for (let i = 0; i < sw * sh; i++) {
    if (!skin[i] || label[i] >= 0) continue;
    const stack = [i];
    label[i] = i;
    let n = 0, x0 = sw, y0 = sh, x1 = 0, y1 = 0;
    while (stack.length) {
      const j = stack.pop();
      const x = j % sw, y = (j / sw) | 0;
      n++;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const k of [j - 1, j + 1, j - sw, j + sw]) {
        if (k < 0 || k >= sw * sh || !skin[k] || label[k] >= 0) continue;
        if ((k === j - 1 && x === 0) || (k === j + 1 && x === sw - 1)) continue;
        label[k] = i;
        stack.push(k);
      }
    }
    // Prefer big blobs that are high up in the frame.
    const score = n * (1.4 - y0 / sh);
    if (!best || score > best.score) best = { score, x0, y0, x1, y1 };
  }
  const sx = img.width / sw;
  if (!best) return faceBox(img, { x: 0.5, y: 0.25, h: 0.35 });
  const fw = (best.x1 - best.x0 + 1) * sx;
  const fh = Math.min((best.y1 - best.y0 + 1) * sx, fw * 1.4); // skin blob may include neck
  const cx = ((best.x0 + best.x1 + 1) / 2) * sx;
  const top = best.y0 * sx - fh * 0.35; // room for hair
  const h = fh * 1.35;
  const w = (h * HEAD.W) / HEAD.H;
  return { x: cx - w / 2, y: top, w, h };
}

// ---- masks -------------------------------------------------------------------
/** Superellipse head silhouette: roomy at the top (hair), rounder at the chin. */
function inHeadShape(x, y, w, h) {
  const ny = (y / h) * 2 - 1;
  const nx = ((x / w) * 2 - 1) * (ny > 0 ? 1 + ny * 0.12 : 1); // narrower toward the chin
  const p = ny < 0 ? 3.2 : 2.1;
  return Math.pow(Math.abs(nx), p) + Math.pow(Math.abs(ny), p) <= 1;
}

/** Flood-fill background from the top/side edges using colour similarity. */
function floodBackground(src, w, h) {
  // Estimate background: median of top-row + upper side columns.
  const samples = [];
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    samples.push([src[i], src[i + 1], src[i + 2]]);
  };
  for (let x = 0; x < w; x += 2) add(x, 0);
  for (let y = 0; y < h * 0.5; y += 2) { add(0, y); add(w - 1, y); }
  const med = [0, 1, 2].map((k) => {
    const v = samples.map((s) => s[k]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const bg = new Uint8Array(w * h);
  // Compare in YCbCr, weighting colour (Cb/Cr) more than brightness: studio
  // backdrops have soft shadows (darker, same hue), skin is a different hue.
  const ycc = (r, g, b) => [
    0.299 * r + 0.587 * g + 0.114 * b,
    128 - 0.1687 * r - 0.3313 * g + 0.5 * b,
    128 + 0.5 * r - 0.4187 * g - 0.0813 * b,
  ];
  const ref = ycc(med[0], med[1], med[2]);
  const T = 32;
  const near = (i) => {
    const c = ycc(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    const dy = (c[0] - ref[0]) * 0.5, db = (c[1] - ref[1]) * 1.5, dr = (c[2] - ref[2]) * 1.5;
    return Math.sqrt(dy * dy + db * db + dr * dr) < T;
  };
  const stack = [];
  const seed = (x, y) => {
    const i = y * w + x;
    if (!bg[i] && near(i)) { bg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) seed(x, 0);
  for (let y = 0; y < h * 0.8; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  return bg;
}

/** Remove lonely pixels and fill pinholes so the silhouette is clean. */
function cleanMask(out, w, h) {
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && out[y * w + x] !== 0;
  const copy = new Uint32Array(out);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = (on(x - 1, y) ? 1 : 0) + (on(x + 1, y) ? 1 : 0) + (on(x, y - 1) ? 1 : 0) + (on(x, y + 1) ? 1 : 0);
      const i = y * w + x;
      if (copy[i] && n <= 1) out[i] = 0;
      if (!copy[i] && n >= 3) {
        // fill a pinhole with a neighbour colour
        out[i] = copy[i - 1] || copy[i + 1] || copy[i - w] || copy[i + w] || 0;
      }
    }
  }
}

// ---- colour ----------------------------------------------------------------------
function enhance(r, g, b) {
  // contrast around mid grey, then saturation around luminance
  const C = 1.12, S = 1.18;
  r = (r - 128) * C + 128;
  g = (g - 128) * C + 128;
  b = (b - 128) * C + 128;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  r = l + (r - l) * S;
  g = l + (g - l) * S;
  b = l + (b - l) * S;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return [cl(r), cl(g), cl(b)];
}

/** Classic median-cut palette quantisation. */
export function medianCut(pixels, n) {
  if (!pixels.length) return [[128, 128, 128]];
  let boxes = [pixels];
  while (boxes.length < n) {
    let bi = -1, bestRange = -1, bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const p of box) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; }
        const range = (hi - lo) * Math.sqrt(box.length);
        if (range > bestRange) { bestRange = range; bi = i; bestCh = ch; }
      }
    });
    if (bi < 0 || bestRange <= 0) break;
    const box = boxes[bi].slice().sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map((box) => {
    const s = [0, 0, 0];
    for (const p of box) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return s.map((v) => Math.round(v / box.length));
  });
}

function nearest(pal, r, g, b) {
  let best = pal[0], bd = Infinity;
  for (const p of pal) {
    const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Average colour of the cheeks/nose area = skin tone for hands and neck. */
function skinTone(data, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(h * 0.5); y < h * 0.7; y++) {
    for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) {
      const c = data[y * w + x];
      if (!c) continue;
      const l = 0.3 * R(c) + 0.59 * Gc(c) + 0.11 * B(c);
      if (l < 70 || l > 235) continue; // skip beard / teeth
      r += R(c); g += Gc(c); b += B(c); n++;
    }
  }
  if (!n) return '#e0a878';
  const hx = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/** Draw a head image onto a canvas (for portraits / HUD). */
export function headToCanvas(head) {
  const c = document.createElement('canvas');
  c.width = head.w;
  c.height = head.h;
  const g = c.getContext('2d');
  const id = g.createImageData(head.w, head.h);
  new Uint32Array(id.data.buffer).set(head.data);
  g.putImageData(id, 0, 0);
  return c;
}
