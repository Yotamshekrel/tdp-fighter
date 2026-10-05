// ---------------------------------------------------------------------------
// Pixel-art face builder: draws a hand-made-style pixel portrait (not a
// downscaled photo) from a short description of the person in
// characters.js -> `look`:
//
//   hair        'short' | 'fade' | 'quiff' | 'sidepart' | 'curly' | 'messy' | 'wavy'
//               | 'longStraight' | 'longWavy' | 'longCurly'
//   hairColor   main hair colour; hairColor2 = lighter ends (ombre), optional
//   skin        optional; by default it is sampled from the photo's cheeks
//   eyes        iris colour        brows   1 (thin) | 2 (thick)
//   beard       null | 'stubble' | 'short' | 'full'     beardColor
//   mouth       'grin' (teeth) | 'smile' (closed)        lips (colour)
//   glasses     frame colour       earring  'left' | 'right' | 'both'
//   jaw         lower-face width multiplier (0.9 narrow .. 1.1 wide)
//   female      lashes, lip colour, blush
//
// Output: { w, h, data: Uint32Array (RGBA, 0 = transparent), skin }
// ---------------------------------------------------------------------------
import { HEAD } from '../config.js';
import { pack } from './photo-pipeline.js';
import { hexToRgb, shade, mix } from './pixel.js';

const c32 = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return pack(r, g, b);
};

export function buildFace(look, skinHex) {
  const W = HEAD.W, H = HEAD.H; // 28 x 32
  const data = new Uint32Array(W * H);
  const CX = W / 2; // 14: symmetry line between columns 13 and 14
  const set = (x, y, hex) => {
    if (x >= 0 && y >= 0 && x < W && y < H) data[y * W + x] = c32(hex);
  };
  const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? data[y * W + x] : 0);
  /** Set the pixel and its mirror across the face's centre line. */
  const sym = (x, y, hex) => {
    set(x, y, hex);
    set(W - 1 - x, y, hex);
  };

  const L = { jaw: 1, brows: 2, mouth: 'grin', ...look };
  const skin = L.skin || skinHex || '#d8a888';
  const skinHi = shade(skin, 0.12), skinLo = shade(skin, -0.16), skinLo2 = shade(skin, -0.3);
  const hair = L.hairColor || '#2a1d16';
  const hairHi = shade(hair, 0.22), hairLo = shade(hair, -0.35);
  const hair2 = L.hairColor2 || null;
  const beardC = L.beardColor || shade(hair, 0.05);
  const browC = L.browColor || (L.female ? shade(hair, -0.1) : shade(hair, -0.2));
  const isLong = /^long/.test(L.hair);

  // ---- face shape: half-width per row (y = 5 .. 30) --------------------------
  const halfW = (y) => {
    const top = [0, 0, 0, 0, 0, 7, 8.6, 9.6, 10.2, 10.6, 10.8];
    let w = y < top.length ? top[y] : 10.8;
    if (y >= 19) {
      const lower = { 19: 10.6, 20: 10.3, 21: 9.9, 22: 9.4, 23: 8.9, 24: 8.3, 25: 7.6, 26: 6.8, 27: 5.9, 28: 4.8, 29: 3.6, 30: 2.2 };
      w = (lower[y] ?? 0) * (y >= 21 ? L.jaw : 1);
    }
    return y > 30 ? 0 : w;
  };
  const inFace = (x, y) => Math.abs(x + 0.5 - CX) <= halfW(y);

  // ---- 1. long hair behind the face (curtains reaching the bottom) ------------
  const hairShape = (x, y) => {
    const dx = x + 0.5 - CX, dy = y + 0.5 - 13;
    if (L.hair === 'longCurly') {
      const wob = Math.sin(y * 1.3) * 0.8 + Math.cos(x * 1.7) * 0.5;
      return (Math.abs(dx) / (14 + wob)) ** 2.4 + (Math.abs(dy) / (y < 13 ? 13 : 20)) ** 2.4 <= 1;
    }
    const wave = L.hair === 'longWavy' ? Math.sin(y * 0.9) * 0.9 : 0;
    if (y >= 13) return Math.abs(dx) <= 12.6 + wave && y <= 31;
    return dx * dx / (12.6 * 12.6) + dy * dy / (12.6 * 12.6) <= 1;
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** Hair colour at (x, y): ordered-dithered ombre toward hairColor2. */
  const hairAt = (x, y) => {
    if (!hair2 || y < 16) return hair;
    const f = Math.min(1, (y - 16) / 12);
    return f * 16 > BAYER[(y % 4) * 4 + (x % 4)] ? hair2 : hair;
  };
  if (isLong) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!hairShape(x, y)) continue;
      if (y >= 29 && (x + (y === 31 ? 1 : 0)) % 3 === 0) continue; // ragged ends
      const c = hairAt(x, y);
      set(x, y, Math.abs(x + 0.5 - CX) > 10.5 ? shade(c, -0.2) : c);
    }
  }

  // ---- 2. ears ------------------------------------------------------------------
  if (!isLong) {
    for (let y = 15; y <= 20; y++) {
      const ex = Math.floor(CX - halfW(y)) - 1;
      if (y > 15 && y < 20) sym(ex - (y === 17 || y === 18 ? 1 : 0), y, skin);
      sym(ex, y, y === 15 || y === 20 ? skinLo : skin);
      if (y > 15 && y < 19) sym(ex + 1, y, skinLo); // inner ear shadow
    }
  }

  // ---- 3. face skin with soft shading -------------------------------------------
  for (let y = 5; y <= 30; y++) {
    for (let x = 0; x < W; x++) {
      if (!inFace(x, y)) continue;
      const dx = x + 0.5 - CX;
      let c = skin;
      if (dx > halfW(y) * 0.62) c = skinLo; // side in shadow
      if (y >= 29) c = skinLo; // under the chin
      if (y >= 9 && y <= 11 && Math.abs(dx) < 3) c = skinHi; // forehead highlight
      if (y === 19 && dx > -8 && dx < -5) c = skinHi; // cheek highlight
      set(x, y, c);
    }
  }

  // ---- 4. hair on top -------------------------------------------------------------
  drawHair(L, { set, get, sym, W, H, CX, halfW, hair, hairHi, hairLo, hair2, skin, skinLo, hairAt });

  // ---- 5. beard (under the mouth so teeth stay visible) ----------------------------
  if (L.beard) {
    const full = L.beard === 'full', stub = L.beard === 'stubble';
    const top = full ? 18 : 20;
    for (let y = 15; y <= 31; y++) {
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x + 0.5 - CX);
        const hw = halfW(y);
        let inB = false;
        if (inFace(x, y)) {
          if (y >= top && dx >= hw - (full ? 5.5 : 3.2)) inB = true; // jaw + sideburns
          if (y >= 26) inB = true; // chin
          if (y >= 22 && y <= 23 && dx <= 4.5) inB = true; // moustache
          if (y >= 24 && y <= 27 && dx <= 5.5 && dx >= 4) inB = true; // mouth corners
          if (y < top && dx >= hw - 1.2 && !isLong) inB = !stub; // sideburn up to hairline
        } else if (full && y >= 22 && dx <= halfW(Math.min(30, y)) + 1.2 && y <= 31 && (inFace(x, Math.min(30, y - 1)) || y > 29) && dx < 9 - (y - 22) * 0.7) {
          inB = true; // beard volume past the jawline
        }
        if (!inB) continue;
        if (stub) {
          if ((x + y) % 2 === 0) set(x, y, mix(skin, beardC, 0.6));
          else set(x, y, mix(skin, beardC, 0.25));
        } else {
          const tex = (x * 7 + y * 3) % 5 === 0 ? shade(beardC, 0.18) : (x + y) % 3 === 0 ? shade(beardC, -0.15) : beardC;
          set(x, y, tex);
        }
      }
    }
  }

  // ---- 6. eyebrows, eyes, nose, mouth ---------------------------------------------
  const EY = 16; // eye row
  // brows: 5 px, outer end dips one row
  for (let i = 0; i < 5; i++) {
    const x = 6 + i;
    const y = EY - 3 + (i === 0 ? 1 : 0);
    sym(x, y, browC);
    if (L.brows >= 2 && i > 0) sym(x, y - 1, browC);
  }
  // eyes: 4 px wide, upper lid / lashes + white + iris
  const lid = L.female ? shade(hair, -0.3) : skinLo2;
  const iris = L.eyes || '#3a2416';
  for (let i = 0; i < 4; i++) sym(7 + i, EY - 1, lid);
  if (L.female) sym(6, EY - 1, lid); // flick of eyeliner
  sym(7, EY, '#f4f0ec');
  sym(8, EY, iris);
  sym(9, EY, shade(iris, -0.45)); // pupil
  sym(10, EY, '#f4f0ec');
  sym(8, EY + 1, skinLo); // smiling lower lid
  sym(9, EY + 1, skinLo);
  // nose: shadow down the right side, nostrils, tip highlight
  for (let y = EY + 1; y <= EY + 5; y++) set(15, y, skinLo);
  set(12, EY + 5, skinLo2);
  set(15, EY + 5, skinLo2);
  set(13, EY + 4, skinHi);
  set(14, EY + 5, skinLo);
  // mouth
  const MY = 24;
  const lipC = L.lips || (L.female ? '#c8706c' : shade(skin, -0.35));
  const dark = '#3a1414';
  if (L.mouth === 'grin') {
    sym(9, MY - 1, dark); // upturned corners
    for (let x = 10; x <= 13; x++) sym(x, MY, x === 10 ? dark : L.female ? lipC : dark);
    for (let x = 10; x <= 13; x++) sym(x, MY + 1, x === 10 ? dark : '#fbf8f0'); // teeth
    for (let x = 11; x <= 13; x++) sym(x, MY + 2, L.female ? lipC : shade(lipC, 0.1));
  } else {
    sym(9, MY, lipC);
    for (let x = 10; x <= 13; x++) sym(x, MY + 1, shade(lipC, -0.15));
    for (let x = 11; x <= 13; x++) sym(x, MY + 2, L.female ? lipC : skinLo);
  }
  // blush
  if (L.female) {
    sym(5, EY + 4, mix(skin, '#ff8080', 0.35));
    sym(6, EY + 4, mix(skin, '#ff8080', 0.25));
  }

  // ---- 7. accessories --------------------------------------------------------------
  if (L.glasses) {
    const g = L.glasses;
    for (const x0 of [5, 16]) {
      for (let x = x0; x <= x0 + 6; x++) { set(x, EY - 2, g); set(x, EY + 2, g); }
      for (let y = EY - 1; y <= EY + 1; y++) { set(x0, y, g); set(x0 + 6, y, g); }
    }
    set(12, EY - 1, g); set(13, EY - 1, g); set(14, EY - 1, g); set(15, EY - 1, g);
    set(4, EY - 1, g); set(23, EY - 1, g);
  }
  if (L.earring) {
    const col = L.earringColor || '#e8c860';
    const ey = 21;
    const lx = Math.floor(CX - halfW(20)) - 1;
    if (L.earring === 'left' || L.earring === 'both') { set(lx, ey, col); set(lx, ey + 1, shade(col, -0.3)); }
    if (L.earring === 'right' || L.earring === 'both') { set(W - 1 - lx, ey, col); set(W - 1 - lx, ey + 1, shade(col, -0.3)); }
  }

  return { w: W, h: H, data, skin };
}

// ---------------------------------------------------------------------------
function drawHair(L, P) {
  const { set, get, W, CX, halfW, hair, hairHi, hairLo, hair2 } = P;
  const style = L.hair || 'short';
  const tex = (x, y, base) => {
    // a clean shine arc on the upper-left + darker far side
    const dx = x + 0.5 - CX;
    const r = Math.hypot(x + 0.5 - (CX - 4), y + 0.5 - 5.5);
    if (r > 3.2 && r < 4.6 && y < 6 && dx < 1) return hairHi;
    if (dx > 8.5) return hairLo;
    return base;
  };
  const noise = (x, y, m) => ((x * 73 + y * 151 + x * y * 7) % m) === 0;

  // Skull cap shape per style (returns true if (x, y) is hair)
  const R = 12.4;
  const cy = 13;
  const capTop = (x, y) => {
    const dx = x + 0.5 - CX, dy = y + 0.5 - cy;
    let rx = R, ry = R;
    if (style === 'quiff') { ry = 13.6; if (Math.abs(dx) < 8) ry += 0.8; }
    if (style === 'curly') {
      const a = Math.atan2(dy, dx);
      rx = ry = R + 0.6 + Math.sin(a * 9) * 0.9;
    }
    if (style === 'messy') {
      const a = Math.atan2(dy, dx);
      rx = ry = R + 0.3 + Math.max(0, Math.sin(a * 11)) * 1.6;
    }
    if (style === 'wavy') { const a = Math.atan2(dy, dx); rx = ry = R + 0.5 + Math.sin(a * 7) * 0.7; }
    if (style === 'fade') ry = 12.2;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  };
  // Hairline: hair covers rows above this (per column)
  const hairline = (x) => {
    const dx = x + 0.5 - CX;
    const adx = Math.abs(dx);
    let h = 7;
    if (style === 'quiff' || style === 'messy' || style === 'curly' || style === 'wavy') h = 7;
    if (adx > 5) h += 1; // temples
    if (style === 'sidepart' && dx > -2 && dx < 7) h = 8; // fringe swept over
    if (style === 'wavy' && dx > -6 && dx < 2) h = 8;
    if (adx >= 9.6) h = style === 'fade' ? 12 : 15; // sideburns
    return h;
  };

  const long = /^long/.test(style);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      if (long) {
        // Top of head + curtains framing the face
        const inside = Math.abs(dx) <= halfW(y);
        const part = style === 'longWavy' ? -3 : 0; // side part for wavy
        const hl = 6 + Math.abs(dx - part) * 0.35; // hairline sloping down from the part
        const curtain = Math.abs(dx) >= halfW(y) - 1.6 - (y > 9 && y < 20 ? 0 : 0);
        if (!get(x, y) && !inside) continue; // outside: already painted behind (or empty)
        if (inside && y >= hl && !curtain) continue; // face shows
        if (inside && y > 24) continue;
        let c = P.hairAt(x, y);
        const r = Math.hypot(x + 0.5 - (CX - 5), y + 0.5 - 5);
        if (Math.abs(dx - part) < 0.6 && y < 6) c = P.skinLo; // parting
        else if (r > 3.4 && r < 4.6 && y < 6 && dx < part) c = hairHi; // shine
        else if (style === 'longCurly' && noise(x, y, 5)) c = shade(c, 0.2);
        else if (dx > 9) c = shade(c, -0.25);
        set(x, y, c);
        continue;
      }
      if (!capTop(x, y)) continue;
      if (y >= hairline(x)) continue;
      let c = tex(x, y, hair);
      if (style === 'fade' && Math.abs(dx) > 9) c = (x + y) % 2 ? hair : P.skinLo; // faded sides
      if (style === 'curly' && noise(x, y, 5)) c = hairHi;
      if (style === 'curly' && noise(x + 2, y + 1, 4)) c = hairLo;
      if (style === 'wavy' && noise(x, y, 6)) c = hairHi;
      if (style === 'messy' && noise(x, y, 4)) c = hairHi;
      if (style === 'sidepart' && x === 9 && y < 5) c = hairLo; // part line
      set(x, y, c);
    }
  }
  // Shadow line under the hairline (hair casting onto the forehead)
  for (let x = 0; x < W; x++) {
    for (let y = 5; y < 18; y++) {
      const here = get(x, y), above = get(x, y - 1);
      if (here && above && P.skinLo && isSkinBelowHair(here, above, hair, hair2)) {
        set(x, y, P.skinLo);
        break;
      }
    }
  }
}

/** True when `here` is skin and `above` is hair (used for the hairline shadow). */
function isSkinBelowHair(here, above, hair, hair2) {
  const hc = [hair, hair2].filter(Boolean).map(c32);
  const near = (a, b) => Math.abs((a & 255) - (b & 255)) + Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255)) + Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255)) < 60;
  return !hc.some((h) => near(here, h)) && hc.some((h) => near(above, h));
}

/**
 * Sample the skin tone from the photo's cheeks (inside the face crop box).
 * Returns a hex colour or null.
 */
export function sampleSkin(img, face) {
  if (!img || !face) return null;
  const c = document.createElement('canvas');
  const S = 64;
  c.width = S;
  c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  const h = face.h * img.height;
  const w = h * 0.86;
  g.drawImage(img, face.x * img.width - w / 2, face.y * img.height - h / 2, w, h, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data;
  const px = [];
  for (const [x0, x1] of [[0.24, 0.36], [0.64, 0.76]]) {
    for (let y = Math.floor(S * 0.55); y < S * 0.66; y++) {
      for (let x = Math.floor(S * x0); x < S * x1; x++) {
        const i = (y * S + x) * 4;
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        const cr = 128 + 0.5 * r - 0.4187 * gg - 0.0813 * b;
        if (cr > 135 && r > 80) px.push([r, gg, b]);
      }
    }
  }
  if (px.length < 8) return null;
  const med = [0, 1, 2].map((k) => px.map((p) => p[k]).sort((a, b) => a - b)[px.length >> 1]);
  const hx = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hx(med[0])}${hx(med[1])}${hx(med[2])}`;
}
