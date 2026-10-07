// ---------------------------------------------------------------------------
// Sprite builder: per-character pixel bodies + pixel-art heads.
//
// Bodies are drawn procedurally from the pose skeletons in poses.js, but
// every fighter has their own build (torso shape, shoulders, limb thickness),
// height, outfit (tee / tank / sweater / quarter-zip / overshirt / blazer /
// blouse / dress...), trousers / shorts / jeans, shoes and extras (watch,
// chain, socks, long hair down the back) from characters.js -> body.
// Parts are shaded "capsules" stamped outline-first so they get contour
// lines, then a silhouette outline pass. Heads come from face-builder.js.
// Costumes for the specials (hats, props, patterns) are drawn into the same
// pixel buffer, so everything shares the same outline treatment.
//
// Frames are generated lazily and cached per (character, pose, frame,
// costume, tint).
// ---------------------------------------------------------------------------
import { HEAD, VIEW } from '../config.js';
import { getPose } from './poses.js';
import { pack, R, Gc, B as Bch, loadImage, buildHead, silhouetteHead, agedHead, headToCanvas } from './photo-pipeline.js';
import { buildFace, sampleSkin } from './face-builder.js';
import { hexToRgb, shade, mix } from './pixel.js';
import { loadPuppet, buildPuppetFrame, tintHi } from './puppet.js';
import { damagedFrame } from './damage.js';

export const FRAME = { W: 112, H: 136, AX: 56, AY: 122 };

/** Draw a sprite frame anchored at the current origin (works for pixel and hi-res frames). */
export function drawFrame(g, fr) {
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = !!fr.hi; // hi-res art is smooth, the old pixel bodies stay crisp
  if (fr.hi) g.drawImage(fr.canvas, -fr.ax, -fr.ay, fr.w, fr.h);
  else g.drawImage(fr.canvas, -fr.ax, -fr.ay);
  g.imageSmoothingEnabled = smooth;
}

/** Draw a portrait (hi-res or pixel) at x, y, w, h on the game grid; flip mirrors it. */
export function drawPortrait(g, p, x, y, w, h, flip = false) {
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = p.lw !== undefined;
  g.save();
  if (flip) {
    g.translate(x + w, y);
    g.scale(-1, 1);
    g.drawImage(p, 0, 0, w, h);
  } else g.drawImage(p, x, y, w, h);
  g.restore();
  g.imageSmoothingEnabled = smooth;
}

/** A fighter's full-body picture (hi-res fighters) with where its feet are: { img, k, padFrac, aspect }, or null. */
export function fighterArt(bank, id) {
  const ch = bank.chars.get(id);
  const f = ch?.puppet?.full;
  const info = ch?.puppet?.rig.full;
  if (!f || !info) return null;
  return { img: f, k: (info.h0 + info.pad * 2) / info.h0, padFrac: info.pad / (info.h0 + info.pad * 2), aspect: f.width / f.height };
}

/**
 * Draw a fighter's whole picture, uncropped, standing with its feet at (cx, footY) and `h` game px tall.
 * Fighters without hi-res art get their pixel body (2x) instead.
 */
export function drawFighterArt(g, bank, id, cx, footY, h, flip = false, tint = null) {
  const art = fighterArt(bank, id);
  g.save();
  if (art) {
    const ih = h * art.k, iw = ih * art.aspect;
    g.translate(cx, footY);
    if (flip) g.scale(-1, 1);
    g.imageSmoothingEnabled = true;
    g.drawImage(art.img, -iw / 2, -ih * (1 - art.padFrac), iw, ih);
  } else {
    const fr = bank.frame(id, 'idle', 0, null, tint, true);
    const s = h / 84;
    g.translate(cx, footY);
    g.scale(flip ? -s : s, s);
    drawFrame(g, fr);
  }
  g.restore();
}

/** Size of a portrait on the game grid (hi-res portraits carry lw/lh). */
export const portraitSize = (p) => [p.lw ?? p.width, p.lh ?? p.height];

/** 28x32 pixel head built from a portrait picture: only used for skin tone and as a fallback. */
function puppetHead(img, skin = '#deaa87') {
  const c = document.createElement('canvas');
  c.width = HEAD.W;
  c.height = HEAD.H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, HEAD.W, HEAD.H);
  const d = g.getImageData(0, 0, HEAD.W, HEAD.H).data;
  const data = new Uint32Array(d.buffer.slice(0));
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return { w: HEAD.W, h: HEAD.H, data, skin, palette: [] };
}
const OUTLINE = pack(20, 16, 30);
const WHITE = pack(255, 255, 255);
const LIGHT = [0.6, -0.8]; // light comes from upper-front

const c32 = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return pack(r, g, b);
};
/** Three-tone material from a base colour. */
const mat = (hex, dim = 0) => ({
  hi: c32(shade(hex, dim < 0 ? 0.12 + dim * 0.4 : 0.22)),
  mid: c32(dim < 0 ? shade(hex, dim) : hex),
  lo: c32(shade(hex, dim - 0.28)),
});

class Buf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }
  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c);
  }
  /** Paint a little pixel map; palette maps chars -> packed colours. */
  map(rows, pal, x, y) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (pal[row[i]]) this.set(x + i, y + j, pal[row[i]]);
    });
  }
}

/**
 * Stamp a tapered capsule from a to b. color(s, x, y) picks the colour; s is
 * the lighting term in [-1, 1]. caps=false gives flat ends (torso).
 */
function capsule(buf, ax, ay, bx, by, ra, rb, color, caps = true, ext = 0) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-6;
  const len = Math.sqrt(len2);
  const r = Math.max(ra, rb);
  const x0 = Math.floor(Math.min(ax, bx) - r - 2), x1 = Math.ceil(Math.max(ax, bx) + r + 2);
  const y0 = Math.floor(Math.min(ay, by) - r - 2), y1 = Math.ceil(Math.max(ay, by) + r + 2);
  const e = ext / len;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5 - ax, qy = y + 0.5 - ay;
      const t = (qx * dx + qy * dy) / len2;
      if (!caps && (t < -e || t > 1 + e)) continue;
      const tc = Math.max(0, Math.min(1, t));
      const rr = ra + (rb - ra) * tc;
      const ox = x + 0.5 - (ax + dx * tc), oy = y + 0.5 - (ay + dy * tc);
      const d2 = ox * ox + oy * oy;
      if (d2 > rr * rr) continue;
      const s = rr > 0 ? (ox * LIGHT[0] + oy * LIGHT[1]) / rr : 0;
      buf.set(x, y, typeof color === 'function' ? color(s, x, y, tc) : color);
    }
  }
}
const toneFn = (m) => (s) => (s > 0.42 ? m.hi : s < -0.38 ? m.lo : m.mid);

/** Draw one part outline-first (gives internal contour lines). */
function part(buf, a, b, ra, rb, m, caps = true) {
  capsule(buf, a[0], a[1], b[0], b[1], ra + 1, rb + 1, OUTLINE, caps, 1);
  capsule(buf, a[0], a[1], b[0], b[1], ra, rb, typeof m === 'function' ? m : toneFn(m), caps);
}

// ---------------------------------------------------------------------------
/**
 * Body builds: torso radii (hip / waist / chest), shoulder spread, limb
 * thickness. Each character picks one in characters.js -> body.build, plus a
 * height multiplier, outfit, shoes and extras, so every fighter has their own
 * silhouette.
 */
export const BUILDS = {
  slim: { hip: 6.0, waist: 5.6, chest: 7.6, sh: 0, arm: [2.6, 2.2], fore: 2.1, leg: [3.3, 2.8], hand: 2.4 },
  athletic: { hip: 6.6, waist: 6.2, chest: 8.9, sh: 0.5, arm: [3.0, 2.6], fore: 2.4, leg: [3.7, 3.1], hand: 2.6 },
  muscular: { hip: 7.0, waist: 6.8, chest: 10.6, sh: 1.6, arm: [3.9, 3.2], fore: 2.9, leg: [4.1, 3.4], hand: 2.9 },
  stocky: { hip: 8.6, waist: 8.8, chest: 9.6, sh: 1, arm: [3.4, 3.0], fore: 2.7, leg: [4.1, 3.5], hand: 2.7 },
  petite: { hip: 7.0, waist: 5.2, chest: 6.9, sh: -0.6, arm: [2.4, 2.1], fore: 1.9, leg: [3.4, 2.6], hand: 2.2 },
  curvy: { hip: 8.0, waist: 6.0, chest: 7.9, sh: 0, arm: [2.6, 2.3], fore: 2.1, leg: [3.9, 2.9], hand: 2.3 },
};
const SLEEVES = {
  tee: 'short', tank: 'none', dress: 'short', longsleeve: 'long', sweater: 'long', quarterzip: 'long',
  hoodie: 'long', overshirt: 'long', blazer: 'long', blouse: 'long',
};

export class SpriteBank {
  constructor() {
    this.chars = new Map();
  }

  /**
   * Build every character's pixel head. Characters with a `look` get a
   * hand-built pixel portrait (skin tone sampled from their photo); others
   * fall back to the pixelated-photo pipeline, or a silhouette if no photo.
   */
  async load(defs, onProgress = () => {}) {
    let i = 0;
    const base = import.meta.env?.BASE_URL ?? '/';
    for (const def of defs) {
      let head;
      // fighters with hi-res art (public/fighters/<id>/, see puppet.js) are posed from cut-out parts
      const puppet = await loadPuppet(`${base}fighters/${def.id}/`);
      if (puppet?.portrait) {
        this.add(def, puppetHead(puppet.portrait, def.look?.skin), false, puppet);
        onProgress(++i / defs.length, def);
        continue;
      }
      // only fighters without a face description fall back to a photo (none of the roster does)
      const img = def.look?.skin ? null : await loadImage(`${base}photos/${def.id}.jpg`);
      try {
        if (def.look) head = buildFace(def.look, def.look.skin || sampleSkin(img, def.face));
        else head = img ? buildHead(img, def.face) : silhouetteHead();
      } catch (err) {
        console.warn(`Head build failed for ${def.id}`, err);
        head = silhouetteHead();
      }
      this.add(def, head, !img && !def.look);
      onProgress(++i / defs.length, def);
    }
  }

  add(def, head, missing = false, puppet = null) {
    def.skinColor = head.skin;
    let portrait = headToCanvas(head);
    if (puppet?.portrait) {
      // hi-res portrait; lw/lh = its size on the game grid
      portrait = document.createElement('canvas');
      portrait.width = puppet.portrait.width;
      portrait.height = puppet.portrait.height;
      portrait.getContext('2d').drawImage(puppet.portrait, 0, 0);
      portrait.lw = head.w;
      portrait.lh = head.h;
    }
    this.chars.set(def.id, {
      def, head, missing, puppet,
      headOld: agedHead(head),
      portrait,
      frames: new Map(),
    });
  }

  portrait(id) {
    return this.chars.get(id)?.portrait;
  }

  /**
   * Get (building if needed) a sprite frame. `big` asks hi-res fighters for a
   * frame twice as dense (for menu scenes that draw the sprite at 2x).
   */
  frame(id, pose, idx, costume = null, tint = null, big = false) {
    const ch = this.chars.get(id);
    const key = `${pose}|${idx}|${costume ? JSON.stringify(costume) : ''}|${tint || ''}|${ch.puppet && big ? 'big' : ''}`;
    let fr = ch.frames.get(key);
    if (fr) return fr;
    if (tint) {
      const base = this.frame(id, pose, idx, costume, null, big);
      // (grown-up mode: `hurtN` is a battered fighter, N = 1..4 how badly: wounds painted on the frame, see damage.js)
      const hurt = tint.startsWith('hurt') ? Number(tint.slice(4)) : 0;
      fr = { ...base, canvas: hurt && base.hi ? damagedFrame(base, hurt, id) : base.hi ? tintHi(base.canvas, tint) : tintCanvas(base.canvas, tint) };
    } else if (ch.puppet) {
      fr = buildPuppetFrame(ch.puppet, getPose(pose, idx), FRAME, VIEW.SCALE * (big ? 2 : 1), costume || {}, pose, idx);
    } else {
      fr = buildFrame(ch, getPose(pose, idx), costume || {});
    }
    ch.frames.set(key, fr);
    return fr;
  }
}

// ---------------------------------------------------------------------------
/** Render one pose of one character (with costume) into a canvas. */
function buildFrame(ch, pose, cos) {
  const { def } = ch;
  const buf = new Buf(FRAME.W, FRAME.H);
  const col = def.colors || {};
  const body = def.body || {};
  const look = def.look || {};
  const baby = !!cos.baby;
  const B = BUILDS[baby ? 'petite' : body.build] || BUILDS.athletic;
  const top = baby ? 'tee' : body.top || 'tee';
  const bottom = baby ? 'shorts' : body.bottom || 'jeans';
  const shoesKind = baby ? 'barefoot' : body.shoes || 'sneakers';
  const extras = baby ? [] : body.extras || [];
  const sleeves = SLEEVES[top] || 'short';
  const dress = top === 'dress';

  const skinHex = def.skinColor || '#e0a878';
  let shirtHex = cos.shirt || col.shirt || '#c03030';
  let pantsHex = col.pants || '#2b3a5c';
  const shoesHex = col.shoes || '#202020';
  const trimHex = cos.shirt2 || col.shirt2 || shade(shirtHex, 0.4);
  if (baby) {
    shirtHex = '#ffd6ea';
    pantsHex = '#ffffff';
  }
  const S = baby ? 0.55 : 1; // body scale (baby = tiny body, same big head)
  const HGT = baby ? 1 : body.height || 1; // per-character height
  const T = baby ? 0.8 : 1;

  const shirt = mat(shirtHex), shirtB = mat(shirtHex, -0.22);
  const trim = mat(trimHex), trimB = mat(trimHex, -0.22);
  const pants = mat(pantsHex), pantsB = mat(pantsHex, -0.22);
  const skin = mat(skinHex), skinB = mat(skinHex, -0.18);
  const shoes = mat(shoesHex), shoesB = mat(shoesHex, -0.2);

  // Pose coords -> buffer coords (baby scaling + per-character height)
  const J = (p) => [FRAME.AX + p[0] * S, FRAME.AY + p[1] * S * HGT];
  const hip = J(pose.hip), chest = J(pose.chest);
  const fs = [chest[0] + (3 + B.sh) * S, chest[1] + 3 * S], bs = [chest[0] - (4 + B.sh) * S, chest[1] + 3 * S];
  const fhip = [hip[0] + 2 * S, hip[1]], bhip = [hip[0] - 2 * S, hip[1]];
  const lying = pose.headRot !== 0;
  const ho = pose.head || [1, -2];
  const chin = [chest[0] + ho[0], chest[1] + ho[1]];

  // ---- long hair falling down the back (behind everything) ----------------
  const hairLen = body.hairLen || (/^long/.test(look.hair) ? 22 : 0);
  if (hairLen && !lying && !baby) {
    const hc = look.hairColor || '#2a1d16';
    const hc2 = look.hairColor2 || hc;
    const curly = look.hair === 'longCurly', wavy = look.hair === 'longWavy';
    const a = [chin[0] - 4, chin[1] - 14], b = [chin[0] - 7, chin[1] - 12 + hairLen];
    capsule(buf, a[0], a[1], b[0], b[1], 11, 7, OUTLINE);
    capsule(buf, a[0], a[1], b[0], b[1], 10, 6, (sh, x, y, t) => {
      const wig = curly ? (x * 3 + y * 5) % 7 === 0 : wavy ? (x + y * 2) % 6 === 0 : x % 4 === 0;
      const base = mix(hc, hc2, Math.max(0, t - 0.3) / 0.7);
      return c32(wig ? shade(base, 0.18) : sh < -0.3 ? shade(base, -0.25) : base);
    });
  }

  // ---- back arm -------------------------------------------------------------
  const be = J(pose.be), bh = J(pose.bh);
  drawArm(buf, bs, be, bh, { B, T, sleeves, shirt: shirtB, trim: trimB, skin: skinB, top, back: true, extras: [] });

  // ---- back leg -------------------------------------------------------------
  const bk = J(pose.bk), bf = J(pose.bf);
  drawLeg(buf, bhip, bk, bf, { B, T, bottom, dress, pants: pantsB, skin: skinB, shoes: shoesB, shoesKind, socks: extras.includes('socks') ? mat(col.socks || '#ffffff', -0.2) : null, baby });

  // ---- torso ---------------------------------------------------------------
  drawTorso(buf, hip, chest, { B, T, top, cos, shirt, trim, pants, skin, dress, baby });
  if (cos.poncho) drawPoncho(buf, chest, hip);
  if (cos.apron) part(buf, [chest[0] + 2, chest[1] + 4], [hip[0] + 2, hip[1] + 8], 4.5, 5.5, mat('#ffffff'), false);

  // ---- front leg + skirt ---------------------------------------------------------
  const fk = J(pose.fk), ff = J(pose.ff);
  drawLeg(buf, fhip, fk, ff, { B, T, bottom, dress, pants, skin, shoes, shoesKind, socks: extras.includes('socks') ? mat(col.socks || '#ffffff') : null, baby });
  if (dress) {
    // long dress: from the hips to mid-shin
    const knees = [(fk[0] + bk[0]) / 2, (fk[1] + bk[1]) / 2];
    const feet = [(ff[0] + bf[0]) / 2, (ff[1] + bf[1]) / 2];
    const hem = [knees[0] + (feet[0] - knees[0]) * 0.55, knees[1] + (feet[1] - knees[1]) * 0.55];
    part(buf, [hip[0], hip[1] - 4], hem, B.hip + 0.5, B.hip + 3.5, (sh, x, y, t) => toneFn(t > 0.92 ? trim : shirt)(sh), false);
  }

  // ---- neck, necklace, head --------------------------------------------------------
  const headImg = cos.old ? ch.headOld : ch.head;
  let hx, hy, hw, hh, hd;
  if (lying) {
    hd = rotateCCW(headImg);
    hw = hd.w;
    hh = hd.h;
    hx = Math.round(chest[0] - hw - 1);
    hy = Math.round(chest[1] - hh / 2 - 1);
    part(buf, chest, [chest[0] - 3, chest[1]], 2, 2, skin);
  } else {
    hd = headImg;
    hw = hd.w;
    hh = hd.h;
    hx = Math.round(chin[0] - hw / 2);
    hy = Math.round(chin[1] - hh);
    const neckR = B.chest > 9.5 ? 2.8 : B.chest < 7.5 ? 1.9 : 2.3;
    part(buf, [chest[0] + 1, chest[1] + 1], [chin[0], chin[1] - 2], neckR, neckR, skin);
    if (top === 'hoodie') part(buf, [chest[0] - 4, chest[1] - 1], [chest[0] - 2, chest[1] + 1], 3.5, 3, shirtB);
    if (extras.includes('necklace') || extras.includes('chain')) {
      const gold = c32(extras.includes('chain') ? '#d8d8e0' : '#e8c860');
      for (let k = -2; k <= 3; k++) buf.set(chest[0] + 1 + k, chest[1] + 2 + (Math.abs(k - 0.5) < 2 ? 1 : 0), gold);
    }
  }
  if (cos.scarf) drawScarf(buf, chest, cos.scarf);
  blitHead(buf, hd, hx, hy);
  if (!lying) drawHeadwear(buf, cos, hx, hy, hw, hh);

  // ---- front arm (+ prop) ------------------------------------------------------
  const fe = J(pose.fe), fh = J(pose.fh);
  drawArm(buf, fs, fe, fh, { B, T, sleeves, shirt, trim, skin, top, extras, cos });

  outlinePass(buf);
  return { canvas: toCanvas(buf), ax: FRAME.AX, ay: FRAME.AY, head: { x: hx, y: hy, w: hw, h: hh } };
}

/** Torso in two tapered pieces (hips -> waist -> chest) with outfit details. */
function drawTorso(buf, hip, chest, o) {
  const { B, T, top, cos, shirt, trim, pants, skin, dress } = o;
  const waist = [hip[0] + (chest[0] - hip[0]) * 0.42, hip[1] + (chest[1] - hip[1]) * 0.42];
  const ax = chest[0] - hip[0], ay = chest[1] - hip[1];
  const len2 = ax * ax + ay * ay || 1;
  const len = Math.sqrt(len2);
  // Signed offset toward the front (+x when upright, facing right)
  const nx = -ay / len, ny = ax / len;
  const front = nx < 0 ? -1 : 1;
  const color = (sh, x, y) => {
    const px = x + 0.5 - hip[0], py = y + 0.5 - hip[1];
    const t = (px * ax + py * ay) / len2; // 0 = hips, 1 = shoulders
    const off = (px * nx + py * ny) * front; // + = front of the body
    let m = shirt;
    if (cos.stripes) m = Math.floor((y - chest[1]) / 2) % 2 ? mat('#ffffff') : mat('#1f3a8a');
    if (!dress && t < 0.13) return toneFn(pants)(sh); // waistband
    switch (top) {
      case 'tee':
        if (t > 0.9 && Math.abs(off - 1) < 3) m = trim; // crew collar
        break;
      case 'tank':
        if (t > 0.86 && Math.abs(off - 1) < 4.5) m = skin; // scoop neck
        else if (t > 0.86) m = trim;
        break;
      case 'sweater':
        if (t < 0.22) m = mat(shirtHexOf(shirt), -0.15); // ribbed hem
        if (t > 0.9 && Math.abs(off - 1) < 3.5) m = mat(shirtHexOf(shirt), -0.12);
        break;
      case 'quarterzip':
        if (t < 0.21) m = mat(shirtHexOf(shirt), -0.15);
        if (t > 0.6 && Math.abs(off - 2.5) < 0.6) m = mat('#8a8a94'); // zipper
        if (t > 0.9) m = mat(shirtHexOf(shirt), 0.0); // collar stand
        if (t > 0.94 && Math.abs(off - 2.5) < 2) m = trim; // tee peeking out
        break;
      case 'hoodie':
        if (t > 0.62 && t < 0.82 && (Math.abs(off - 1) < 0.5 || Math.abs(off - 3.5) < 0.5)) m = trim; // strings
        if (t < 0.2) m = mat(shirtHexOf(shirt), -0.15);
        break;
      case 'overshirt':
        if (t > 0.13 && off > 0.5 && off < 4.5) m = trim; // open shirt, tee underneath
        if (t > 0.86 && off > 3.5 && off < 6) m = mat(shirtHexOf(shirt), 0.15); // collar point
        if (t > 0.2 && Math.abs(off - 5) < 0.5 && Math.floor(t * 20) % 4 === 0) m = mat('#d8c8a8'); // buttons
        break;
      case 'blazer':
        if (t > 0.3 && off > 0 && off < 4.5 - (1 - t) * 3) m = trim; // white top under a V
        if (t > 0.45 && Math.abs(off - (4.5 - (1 - t) * 3)) < 0.8) m = mat(shirtHexOf(shirt), 0.25); // lapel edge
        break;
      case 'blouse':
        if (t > 0.78 && off > -1 && off < (t - 0.78) * 20) m = skin; // open V neck
        break;
      case 'dress':
        if (t > 0.88 && Math.abs(off - 1) < 3.5) m = skin;
        if (t > 0.1 && t < 0.18) m = trim; // belt
        break;
    }
    return toneFn(m)(sh);
  };
  const r = (k) => k * T;
  // outlines of both pieces first, then fills, so there's no seam at the waist
  capsule(buf, hip[0], hip[1], waist[0], waist[1], r(B.hip) + 1, r(B.waist) + 1, OUTLINE, false, 1);
  capsule(buf, waist[0], waist[1], chest[0], chest[1], r(B.waist) + 1, r(B.chest) + 1, OUTLINE, false, 1);
  capsule(buf, hip[0], hip[1], waist[0], waist[1], r(B.hip), r(B.waist), color, false, 0.6);
  capsule(buf, waist[0], waist[1], chest[0], chest[1], r(B.waist), r(B.chest), color, false);
}
const shirtHexOf = (m) => {
  const c = m.mid;
  const h = (v) => v.toString(16).padStart(2, '0');
  return `#${h(R(c))}${h(Gc(c))}${h(Bch(c))}`;
};

/** Arm with sleeve length per outfit, cuffs, watch and props. */
function drawArm(buf, sh, el, hand, o) {
  const { B, T, sleeves, shirt, trim, skin, top, extras = [], cos = {}, back } = o;
  const upper = [B.arm[0] * T, B.arm[1] * T], fore = B.fore * T;
  const loose = top === 'blouse' ? 0.5 : 0;
  if (sleeves === 'none') {
    part(buf, sh, el, upper[0] - 0.3, upper[1] - 0.3, skin);
  } else if (sleeves === 'short') {
    part(buf, sh, el, upper[0] - 0.3, upper[1] - 0.3, skin);
    const mid = [sh[0] + (el[0] - sh[0]) * 0.58, sh[1] + (el[1] - sh[1]) * 0.58];
    part(buf, sh, mid, upper[0] + 0.4, upper[1] + 0.5, shirt);
  } else {
    part(buf, sh, el, upper[0] + loose, upper[1] + loose, shirt);
  }
  if (cos.captain && !back) {
    const m = [(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2];
    buf.disc(m[0], m[1], 2.6, c32('#ffd23f'));
    buf.set(m[0], m[1], c32('#d71920'));
  }
  if (sleeves === 'long') {
    part(buf, el, hand, fore + loose, fore + loose, shirt);
    const cuff = [el[0] + (hand[0] - el[0]) * 0.8, el[1] + (hand[1] - el[1]) * 0.8];
    const cm = top === 'blazer' || top === 'overshirt' ? trim : mat(shirtHexOf(shirt), -0.15);
    capsule(buf, cuff[0], cuff[1], hand[0], hand[1], fore + loose, fore + loose, toneFn(cm));
  } else {
    part(buf, el, hand, fore, fore * 0.9, skin);
  }
  if (extras.includes('watch')) {
    const w = [el[0] + (hand[0] - el[0]) * 0.78, el[1] + (hand[1] - el[1]) * 0.78];
    capsule(buf, w[0], w[1], w[0] + (hand[0] - el[0]) * 0.1, w[1] + (hand[1] - el[1]) * 0.1, fore + 0.4, fore + 0.4, c32('#c8c8d0'));
  }
  if (!back && cos.prop) drawProp(buf, cos.prop, el, hand);
  part(buf, hand, hand, B.hand * T, B.hand * T, skin);
  if (!back && (cos.prop === 'mic' || cos.prop === 'wand')) drawProp(buf, cos.prop + 'Top', el, hand);
}

/** Leg with trousers / shorts / bare legs, socks and different shoes. */
function drawLeg(buf, hip, knee, foot, o) {
  const { B, T, bottom, dress, pants, skin, shoes, shoesKind, socks, baby } = o;
  const thigh = [B.leg[0] * T, (B.leg[0] - 0.4) * T], shin = [(B.leg[0] - 0.4) * T, B.leg[1] * T];
  if (dress) {
    part(buf, knee, foot, shin[0] - 0.4, shin[1] - 0.3, skin);
  } else if (bottom === 'shorts') {
    part(buf, knee, foot, shin[0] - 0.4, shin[1] - 0.3, skin);
    const hem = [knee[0] + (foot[0] - knee[0]) * 0.08, knee[1] + (foot[1] - knee[1]) * 0.08];
    part(buf, hip, hem, thigh[0] + 0.5, thigh[1] + 0.6, pants);
  } else {
    part(buf, hip, knee, thigh[0], thigh[1], pants);
    part(buf, knee, foot, shin[0], shin[1], pants);
    if (bottom === 'jeans') {
      // rolled hem in a lighter denim
      const h0 = [knee[0] + (foot[0] - knee[0]) * 0.85, knee[1] + (foot[1] - knee[1]) * 0.85];
      capsule(buf, h0[0], h0[1], foot[0], foot[1] - 1, shin[1], shin[1], pants.hi);
    }
    if (bottom === 'joggers') capsule(buf, foot[0], foot[1] - 4, foot[0], foot[1] - 2, shin[1] + 0.3, shin[1] + 0.3, pants.lo);
  }
  if (socks && !dress) {
    const s0 = [knee[0] + (foot[0] - knee[0]) * 0.55, knee[1] + (foot[1] - knee[1]) * 0.55];
    capsule(buf, s0[0], s0[1], foot[0], foot[1] - 1, shin[1] + 0.2, shin[1] + 0.2, toneFn(socks));
  }
  if (baby) {
    part(buf, foot, foot, 2.4, 2.4, skin);
    return;
  }
  const f = foot;
  switch (shoesKind) {
    case 'boots':
      capsule(buf, f[0], f[1] - 7, f[0], f[1] - 2, shin[1] + 0.6, shin[1] + 0.6, toneFn(shoes));
      part(buf, [f[0] - 2, f[1] - 1.5], [f[0] + 4, f[1] - 1.5], 2.3, 2.3, shoes);
      break;
    case 'heels':
      part(buf, [f[0] - 1, f[1] - 2], [f[0] + 4, f[1] - 1], 1.6, 1.3, shoes);
      buf.rect(Math.round(f[0] - 2), Math.round(f[1] - 1), 1, 2, c32('#14101e'));
      break;
    case 'flats':
      part(buf, [f[0] - 2, f[1] - 1.2], [f[0] + 4, f[1] - 1.2], 1.7, 1.7, shoes);
      break;
    case 'barefoot':
      part(buf, [f[0] - 1, f[1] - 1.5], [f[0] + 3, f[1] - 1], 1.8, 1.6, skin);
      buf.set(f[0] + 1, f[1] - 3, c32('#8a5a2a')); // flip-flop strap
      break;
    default: // sneakers with a white sole
      part(buf, [f[0] - 2, f[1] - 1.8], [f[0] + 4, f[1] - 1.8], 2.2, 2.2, shoes);
      for (let x = Math.round(f[0] - 3); x <= Math.round(f[0] + 5); x++) {
        if (buf.get(x, Math.round(f[1]) - 1) && buf.get(x, Math.round(f[1]) - 1) !== OUTLINE) buf.set(x, Math.round(f[1]) - 1, WHITE);
      }
  }
}

function blitHead(buf, hd, hx, hy) {
  const { w, h, data } = hd;
  // outline ring
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const inside = x >= 0 && y >= 0 && x < w && y < h && data[y * w + x];
      if (inside) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && data[yy * w + xx];
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) buf.set(hx + x, hy + y, OUTLINE);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x]) buf.set(hx + x, hy + y, data[y * w + x]);
}

function rotateCCW(hd) {
  const { w, h, data } = hd;
  const out = new Uint32Array(w * h);
  // (x, y) -> (y, w-1-x); new width = h, new height = w
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[(w - 1 - x) * h + y] = data[y * w + x];
  return { w: h, h: w, data: out };
}

/** Any transparent pixel touching a non-outline pixel becomes outline. */
function outlinePass(buf) {
  const { w, h, d } = buf;
  const add = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[y * w + x]) continue;
      const n = (xx, yy) => {
        const c = buf.get(xx, yy);
        return c && c !== OUTLINE;
      };
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) add.push(y * w + x);
    }
  }
  for (const i of add) d[i] = OUTLINE;
}

function toCanvas(buf) {
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const g = c.getContext('2d');
  const id = g.createImageData(buf.w, buf.h);
  new Uint32Array(id.data.buffer).set(buf.d);
  g.putImageData(id, 0, 0);
  return c;
}

/** White hit-flash / icy-blue frozen variants of a sprite. */
function tintCanvas(src, tint) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  const d = new Uint32Array(id.data.buffer);
  for (let i = 0; i < d.length; i++) {
    const p = d[i];
    if (!p || p === OUTLINE) continue;
    if (tint.startsWith('hurt')) {
      const k = Number(tint.slice(4)) / 4, grey = (R(p) + Gc(p) + Bch(p)) / 3;
      d[i] = pack((R(p) + (grey - R(p)) * k * 0.55) * (1 - k * 0.2), (Gc(p) + (grey - Gc(p)) * k * 0.55) * (1 - k * 0.2), (Bch(p) + (grey - Bch(p)) * k * 0.55) * (1 - k * 0.2));
    } else if (tint === 'white') d[i] = WHITE;
    else if (tint === 'ice') d[i] = pack(R(p) * 0.45 + 120, Gc(p) * 0.45 + 160, Bch(p) * 0.4 + 170);
  }
  g.putImageData(id, 0, 0);
  return c;
}

// ---- costumes ----------------------------------------------------------------------
const K = (hex) => c32(hex);

function drawHeadwear(buf, cos, hx, hy, W, H) {
  const cx = hx + W / 2;
  const top = hy;
  const eyeY = hy + Math.round(H * 0.5); // matches face-builder's eye row
  if (cos.eyes === 'laser') {
    for (const ex of [hx + Math.round(W * 0.32), hx + Math.round(W * 0.68)]) {
      buf.rect(ex - 1, eyeY - 1, 3, 2, K('#ff2020'));
      buf.set(ex, eyeY - 1, K('#ffffff'));
    }
  }
  if (cos.baby) {
    // pacifier
    const my = hy + Math.round(H * 0.74);
    buf.disc(cx, my, 3, K('#5ab4ff'));
    buf.disc(cx, my, 1.5, K('#ff8cc6'));
  }
  switch (cos.hat) {
    case 'sombrero': {
      const straw = mat('#e8c060');
      for (let y = 0; y < 11; y++) for (let x = -8; x <= 8; x++) buf.set(cx + x, top - 8 + y, y > 7 ? K('#d02a2a') : x > 4 ? straw.lo : straw.mid);
      for (let x = -9; x <= 9; x++) buf.set(cx + x, top - 9, straw.hi);
      for (let r = 0; r < 4; r++) {
        const half = 23 - r * 2;
        for (let x = -half; x <= half; x++) buf.set(cx + x, top + 2 + r, r === 0 ? straw.hi : r === 3 ? straw.lo : straw.mid);
      }
      for (let x = -20; x <= 20; x += 4) buf.set(cx + x, top + 3, K('#2a9a3a'));
      break;
    }
    case 'beret':
      for (let y = -4; y <= 3; y++) for (let x = -14; x <= 12; x++) if ((x + 1) ** 2 / 182 + (y ** 2) / 14 <= 1) buf.set(cx - 2 + x, top + 2 + y, y < -1 ? K('#2a3060') : K('#1b1f3a'));
      buf.rect(cx - 1, top - 4, 2, 2, K('#1b1f3a'));
      break;
    case 'chef': {
      const w = K('#ffffff'), g = K('#d8dce8');
      buf.rect(cx - 11, top - 2, 22, 6, w);
      buf.rect(cx - 11, top + 2, 22, 1, g);
      buf.disc(cx - 6, top - 7, 6.5, w);
      buf.disc(cx + 6, top - 7, 6.5, w);
      buf.disc(cx, top - 11, 7, w);
      buf.rect(cx - 2, top - 5, 1, 4, g);
      buf.rect(cx + 4, top - 6, 1, 4, g);
      break;
    }
    case 'wizard': {
      const hat = K('#3a2a7a'), hatD = K('#2a1c5a');
      for (let r = 0; r < 24; r++) {
        const half = Math.round(12 * (1 - r / 24));
        const shift = Math.round((r / 24) ** 2 * -8);
        for (let x = -half; x <= half; x++) buf.set(cx + x + shift, top + 3 - r, x < -half / 3 ? hatD : hat);
      }
      for (let x = -17; x <= 17; x++) buf.set(cx + x, top + 3, hatD);
      for (let x = -15; x <= 15; x++) buf.set(cx + x, top + 4, hatD);
      for (const [sx, sy] of [[-4, -4], [3, -9], [-2, -14], [5, 0]]) buf.set(cx + sx, top + sy, K('#ffe066'));
      break;
    }
    case 'headband':
    case 'pinkband': {
      const c = cos.hat === 'headband' ? K('#e8202a') : K('#ff69c8');
      const y0 = top + 6;
      for (let y = y0; y < y0 + 3; y++) for (let x = hx - 1; x <= hx + W; x++) if (buf.get(x, y) && buf.get(x, y) !== 0) buf.set(x, y, c);
      buf.rect(hx - 4, y0 + 1, 3, 2, c);
      buf.rect(hx - 6, y0 + 3, 3, 2, c);
      break;
    }
    case 'beanie': {
      const a = K('#3a6ea5'), b = K('#5a8ec5');
      for (let y = top - 2; y < top + 8; y++) for (let x = hx - 1; x <= hx + W; x++) {
        const dy = y - top;
        const inHead = buf.get(x, Math.max(y, top + 1)) || dy < 2;
        if (inHead && Math.abs(x + 0.5 - cx) < 12 - Math.max(0, 2 - dy) * 2) buf.set(x, y, dy > 5 ? b : x % 2 ? a : b);
      }
      buf.disc(cx, top - 4, 3.2, K('#ffffff'));
      break;
    }
    case 'safari': {
      const k = mat('#c8b070');
      for (let y = -9; y <= 0; y++) for (let x = -12; x <= 12; x++) if ((x * x) / 144 + (y * y) / 81 <= 1) buf.set(cx + x, top + 4 + y, x > 6 ? k.lo : y < -6 ? k.hi : k.mid);
      for (let x = -17; x <= 17; x++) { buf.set(cx + x, top + 5, k.lo); buf.set(cx + x, top + 4, k.mid); }
      buf.rect(cx - 12, top + 2, 25, 2, K('#5a4a2a'));
      break;
    }
    case 'tophat': {
      const blk = K('#141418');
      buf.rect(cx - 9, top - 14, 18, 16, blk);
      buf.rect(cx - 9, top - 3, 18, 3, K('#e8b923'));
      buf.rect(cx - 15, top + 2, 30, 2, blk);
      buf.rect(cx + 5, top - 13, 2, 9, K('#3a3a48'));
      break;
    }
    case 'bonnet': {
      const p = K('#ffd6ea'), f = K('#ffffff');
      for (let y = top - 2; y < top + 11; y++) for (let x = hx - 2; x <= hx + W + 1; x++) {
        const nx = (x + 0.5 - cx) / (W / 2 + 2), ny = (y + 0.5 - (top + 10)) / 12;
        if (nx * nx + ny * ny <= 1 && y < top + 10) buf.set(x, y, y >= top + 8 ? f : p);
      }
      break;
    }
    case 'shades': {
      const k = K('#0a0a10'), g = K('#3a3a5a');
      buf.rect(hx + 3, eyeY - 2, W - 6, 2, k);
      buf.rect(hx + 4, eyeY - 1, 8, 4, k);
      buf.rect(hx + W - 12, eyeY - 1, 8, 4, k);
      buf.set(hx + 5, eyeY, g);
      buf.set(hx + W - 11, eyeY, g);
      break;
    }
  }
}

function drawScarf(buf, chest, kind) {
  const a = kind === 'blue' ? K('#2a6ad8') : K('#a01828');
  const b = kind === 'blue' ? K('#ffffff') : K('#e8b923');
  const y = Math.round(chest[1] - 1);
  for (let x = -7; x <= 7; x++) for (let j = 0; j < 3; j++) buf.set(chest[0] + x, y + j, (x + 20) % 4 < 2 ? a : b);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 3; i++) buf.set(chest[0] - 6 + i - Math.floor(j / 4), y + 3 + j, j % 4 < 2 ? a : b);
}

function drawPoncho(buf, chest, hip) {
  const stripes = ['#d02a2a', '#ffd23f', '#2a9a3a', '#2a6ad8', '#ffffff', '#ff7a1a'].map(K);
  capsule(buf, chest[0], chest[1] - 1, hip[0], hip[1] + 5, 10, 13, OUTLINE, false, 1);
  capsule(buf, chest[0], chest[1] - 1, hip[0], hip[1] + 5, 9, 12, (s, x, y) => stripes[Math.floor((y - chest[1]) / 2 + 60) % stripes.length], false);
}

const TROPHY = ['#.#####.#', '#.#yyy#.#', '.##yyy##.', '..#yyy#..', '...###...', '....#....', '...###...', '..#####..'];

function drawProp(buf, prop, fe, fh) {
  let dx = fh[0] - fe[0], dy = fh[1] - fe[1];
  const l = Math.hypot(dx, dy) || 1;
  dx /= l;
  dy /= l;
  const [x, y] = fh;
  switch (prop) {
    case 'wand':
      capsule(buf, x, y, x + dx * 11, y + dy * 11, 1, 0.8, K('#5a3410'));
      break;
    case 'wandTop':
      buf.disc(x + dx * 12, y + dy * 12, 1.2, K('#ffffff'));
      break;
    case 'cane':
      capsule(buf, x + 2, y, x + 2, FRAME.AY - 0.5, 1.2, 1.2, K('#7a4a20'));
      capsule(buf, x + 2, y - 2, x + 5, y - 3, 1.2, 1.2, K('#7a4a20'));
      capsule(buf, x + 5, y - 3, x + 6, y, 1.2, 1.2, K('#7a4a20'));
      break;
    case 'trophy':
      buf.map(TROPHY, { '#': K('#b8860b'), y: K('#ffd84a') }, Math.round(x - 4.5), Math.round(y - 10));
      break;
    case 'baguette':
      capsule(buf, x - dx * 5, y - dy * 5, x + dx * 18, y + dy * 18, 2, 1.8, (s, px, py) => ((px + py) % 5 === 0 ? K('#f0c070') : s < -0.3 ? K('#a06a28') : K('#c98a3c')));
      break;
    case 'mic':
      capsule(buf, x, y, x - 1, y - 6, 1, 1, K('#1a1a22'));
      break;
    case 'micTop':
      buf.disc(x - 1, y - 7, 2.4, K('#9a9aae'));
      buf.set(x - 2, y - 8, K('#e0e0f0'));
      break;
    case 'rattle':
      capsule(buf, x, y, x + dx * 6, y + dy * 6, 1, 1, K('#ff8cc6'));
      buf.disc(x + dx * 10, y + dy * 10, 3.6, K('#ffe066'));
      buf.set(x + dx * 10, y + dy * 10, K('#ff5fa2'));
      buf.set(x + dx * 10 + 2, y + dy * 10 - 1, K('#5ab4ff'));
      break;
    case 'bottle':
      buf.rect(Math.round(x - 2), Math.round(y - 10), 5, 9, K('#2b6e2b'));
      buf.rect(Math.round(x - 2), Math.round(y - 7), 5, 3, K('#e0a020'));
      buf.rect(Math.round(x - 1), Math.round(y - 13), 3, 3, K('#2b6e2b'));
      break;
    case 'jar':
      buf.rect(Math.round(x - 4), Math.round(y - 11), 9, 10, K('#bfe9ff'));
      buf.rect(Math.round(x - 4), Math.round(y - 13), 9, 2, K('#7a4a20'));
      for (const [px, py] of [[-2, -8], [1, -6], [2, -9], [-1, -4]]) buf.set(Math.round(x + px), Math.round(y + py), K('#1a1010'));
      break;
  }
}

export { HEAD };
