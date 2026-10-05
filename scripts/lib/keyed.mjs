// ---------------------------------------------------------------------------
// Cuts a character out of its flat magenta backdrop.
//
// The source art is pixel art on a magenta background (saved as JPEG, so the
// edge pixels carry some colour spill). We flood the background in from the
// image border, keep the largest remaining blob (the character), close pin
// holes, and remove the magenta spill from the outline pixels.
// ---------------------------------------------------------------------------
import sharp from 'sharp';

/** How magenta a pixel is: high when red and blue are both far above green. */
const magentaness = (r, g, b) => Math.min(r, b) - g;

export async function loadKeyed(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0, j = 0; i < W * H; i++, j += 3) {
    px[i * 4] = data[j];
    px[i * 4 + 1] = data[j + 1];
    px[i * 4 + 2] = data[j + 2];
    px[i * 4 + 3] = 255;
  }
  const m = new Int16Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = magentaness(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);

  // background = strongly magenta pixels anywhere (this also catches the pockets of
  // backdrop enclosed between an arm and the body) plus fainter magenta reachable
  // from the image border
  const bg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (m[i] > 150) bg[i] = 1;
  const stack = [];
  const push = (p) => { if (!bg[p] && m[p] > 60) { bg[p] = 1; stack.push(p); } };
  for (let i = 0; i < W * H; i++) if (bg[i]) stack.push(i);
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    if (x > 0) push(p - 1);
    if (x < W - 1) push(p + 1);
    if (p >= W) push(p - W);
    if (p < W * (H - 1)) push(p + W);
  }

  // largest foreground blob
  const lab = new Int32Array(W * H);
  let best = 0, bestN = 0, n = 0;
  for (let s = 0; s < W * H; s++) {
    if (bg[s] || lab[s]) continue;
    n++;
    let cnt = 0;
    const st = [s];
    lab[s] = n;
    while (st.length) {
      const p = st.pop();
      cnt++;
      const x = p % W;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < W * (H - 1) ? p + W : -1];
      for (const q of nb) if (q >= 0 && !bg[q] && !lab[q]) { lab[q] = n; st.push(q); }
    }
    if (cnt > bestN) { bestN = cnt; best = n; }
  }
  const alpha = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = lab[p] === best ? 1 : 0;

  // distance (in px, capped) from the nearest background pixel, to find the spill zone
  const dist = new Uint8Array(W * H).fill(255);
  let q = [];
  for (let p = 0; p < W * H; p++) if (!alpha[p]) { dist[p] = 0; q.push(p); }
  for (let d = 1; d <= 3; d++) {
    const next = [];
    for (const p of q) {
      const x = p % W;
      for (const r of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p >= W ? p - W : -1, p < W * (H - 1) ? p + W : -1]) {
        if (r >= 0 && dist[r] === 255) { dist[r] = d; next.push(r); }
      }
    }
    q = next;
  }
  // despill: pull red and blue back towards green on the rim
  for (let p = 0; p < W * H; p++) {
    if (!alpha[p] || dist[p] > 3) continue;
    const k = Math.max(0, m[p] - 8);
    if (!k) continue;
    px[p * 4] = Math.max(0, px[p * 4] - k);
    px[p * 4 + 2] = Math.max(0, px[p * 4 + 2] - k);
  }
  for (let p = 0; p < W * H; p++) px[p * 4 + 3] = alpha[p] ? 255 : 0;
  return { px, alpha, W, H };
}

/** Tight bounding box of the opaque pixels. */
export function bounds(alpha, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
