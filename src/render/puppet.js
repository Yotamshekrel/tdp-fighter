// ---------------------------------------------------------------------------
// Hi-res "paper dolls" for the fighters drawn from pictures.
//
// Every picture in assets/new_photos/ is cut (scripts/build-fighters.mjs ->
// public/fighters/<id>/atlas.png + rig.json) into head / torso / two arms /
// two legs. For every animation frame the parts are re-posed to follow the
// same skeleton (poses.js) that drives the procedural fighters, then drawn into
// a canvas VIEW.SCALE times denser than the game grid, so the art keeps its
// detail. Limb pieces overlap at the joints, so bends never open a gap.
//
// Skeleton points are in game pixels relative to the feet (+x forward, -y up).
// The pictures have real body proportions (long legs, short torso), the
// skeleton has cartoon ones, so each region has its own scale:
//   Kl / Klx   legs (vertical / horizontal)      Kt   torso and head offsets
//   Ka         arms
// scripts/build-fighters.mjs measures them from each picture.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';
import { drawHeadwear, drawProp, drawScarf, drawPoncho, drawApron, drawEyes, tintLayer, stripeLayer } from './costumes.js';

const MIN_STRETCH = 0.6, MAX_STRETCH = 1.4; // how far a bone may be squashed / stretched
// Poses whose arms stay near their drawn, relaxed position (a gentle bend instead of the skeleton's raised fists)
const RELAXED = new Set(['idle', 'walk', 'run', 'crouch', 'hobble', 'charge']);
const BASE_HEAD = [1, -2];
const SH_F = [4.6, 3], SH_B = [-5.6, 3]; // skeleton shoulders relative to the chest
const BACK_ARM_SHADE = 0.07, BACK_LEG_SHADE = 0.12; // depth cue only: the idle pose stays true to the art

const loadImage = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

/** Loads one fighter's rig + atlas. Returns null when the fighter has no hi-res art. */
export async function loadPuppet(baseUrl) {
  const bust = import.meta.env?.DEV ? `?t=${Date.now()}` : ''; // dev: always pick up a rebuilt sprite
  try {
    const r = await fetch(`${baseUrl}rig.json${bust}`);
    if (!r.ok) return null;
    const rig = await r.json();
    const [atlas, portrait, full] = await Promise.all([
      loadImage(`${baseUrl}atlas.png${bust}`),
      loadImage(`${baseUrl}portrait.png${bust}`),
      loadImage(`${baseUrl}full.webp${bust}`),
    ]);
    if (!atlas) return null;
    return { rig, atlas, portrait, full, aged: null };
  } catch (err) {
    console.warn('puppet failed to load', baseUrl, err);
    return null;
  }
}

// ---- 2x3 affine maps -------------------------------------------------------
const apply = (t, p) => [t[0] * p[0] + t[2] * p[1] + t[4], t[1] * p[0] + t[3] * p[1] + t[5]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)]; // + = clockwise on screen

/**
 * Map picture-space bone S->E onto game-space bone s2->e2: the bone's length is
 * stretched to fit (within limits), its thickness stays at `sig`. flip mirrors
 * the part across the bone.
 */
function boneMap(S, E, s2, e2, sig, flip = false) {
  const ax = E[0] - S[0], ay = E[1] - S[1];
  const L = Math.hypot(ax, ay) || 1;
  const a = [ax / L, ay / L];
  const n = [-a[1], a[0]];
  const dx = e2[0] - s2[0], dy = e2[1] - s2[1];
  const L2 = Math.hypot(dx, dy);
  const d = L2 > 1e-3 ? [dx / L2, dy / L2] : [0, 1];
  const nd = [-d[1], d[0]];
  const ratio = Math.min(MAX_STRETCH, Math.max(MIN_STRETCH, L2 / (L * sig)));
  const lA = ratio * sig, lP = flip ? -sig : sig;
  const m11 = lA * d[0] * a[0] + lP * nd[0] * n[0];
  const m12 = lA * d[0] * a[1] + lP * nd[0] * n[1];
  const m21 = lA * d[1] * a[0] + lP * nd[1] * n[0];
  const m22 = lA * d[1] * a[1] + lP * nd[1] * n[1];
  // the bone starts where it was asked to, even when the stretch was clamped
  return [m11, m21, m12, m22, s2[0] - (m11 * S[0] + m12 * S[1]), s2[1] - (m21 * S[0] + m22 * S[1])];
}

/** Uniformly scaled rotation about picture point `pivot`, placed at `dest`. */
function rotMap(pivot, dest, angle, sig) {
  const c = Math.cos(angle) * sig, s = Math.sin(angle) * sig;
  return [c, s, -s, c, dest[0] - (c * pivot[0] - s * pivot[1]), dest[1] - (s * pivot[0] + c * pivot[1])];
}

function newLayer(canvas, res, AX, AY) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.scale(res, res);
  g.translate(AX, AY);
  return { c, g };
}

function drawPart(g, puppet, name, t, src) {
  const p = puppet.rig.parts[name];
  if (!p) return;
  g.save();
  g.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
  g.drawImage(src || puppet.atlas, p.ax, p.ay, p.aw, p.ah, p.x, p.y, p.w, p.h);
  g.restore();
}

/** The head with white hair and a white beard (for the "old man" costume), built once. */
function agedAtlas(puppet) {
  if (puppet.aged) return puppet.aged;
  const { atlas, rig } = puppet;
  const c = document.createElement('canvas');
  c.width = atlas.width;
  c.height = atlas.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(atlas, 0, 0);
  const p = rig.parts.head;
  const img = g.getImageData(p.ax, p.ay, p.aw, p.ah);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const luma = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (luma > 28 && luma < 105) { // hair, brows and beard are dark; outlines are near-black
      const v = 190 + (luma - 28) * 0.6;
      d[i] = v; d[i + 1] = v; d[i + 2] = Math.min(255, v + 6);
    }
  }
  g.putImageData(img, p.ax, p.ay);
  puppet.aged = c;
  return c;
}

/**
 * Render one pose into a canvas `res` times denser than the game grid.
 * Returns { canvas, ax, ay, w, h, hi: true, res, head } (w/h/ax/ay in game pixels).
 * `cos` is the special's costume (hats, props, a baby body, tints...).
 */
export function buildPuppetFrame(puppet, pose, frameBox, res = VIEW.SCALE, cos = {}, poseName = '', frameIdx = 0) {
  const { rig } = puppet;
  const J = rig.joints;
  const { W, H, AX, AY } = frameBox;
  const SIG = rig.sigma;
  const baby = !!cos.baby;
  const bs = baby ? 0.55 : 1; // body scale (a baby is a tiny body with a big head)
  const sig = SIG * bs;
  const { Kl, Klx, Kt, Ka } = rig;

  const size = { width: W * res, height: H * res };
  const main = newLayer(size, res, AX, AY);
  const canvas = main.c;
  const g = main.g;

  // skeleton -> puppet positions
  const legPt = (p) => [p[0] * Klx * bs, p[1] * Kl * bs];
  const hip = legPt(pose.hip);
  const chest = add(hip, mul(sub(pose.chest, pose.hip), Kt * bs));

  // ---- torso: pelvis -> neck ----
  const T = boneMap(J.pelvis, J.neck, hip, chest, sig);
  const up = apply(T, [J.pelvis[0], J.pelvis[1] - 100]);
  const tAngle = Math.atan2(up[0] - hip[0], hip[1] - up[1]); // 0 = upright, + = leaning forward

  // ---- legs: bones from the puppet's hips to the skeleton's knee / foot ----
  const leg = (hipJ, kneeJ, soleJ, knee, foot, thighName, shinName, ctx) => {
    const h2 = apply(T, hipJ);
    const k2 = legPt(knee), f2 = legPt(foot);
    drawPart(ctx.g, puppet, thighName, boneMap(hipJ, kneeJ, h2, k2, sig));
    drawPart(ctx.g, puppet, shinName, boneMap(kneeJ, soleJ, k2, f2, sig));
  };
  const backLeg = newLayer(canvas, res, AX, AY);
  leg(J.hipB, J.kneeB, J.soleB, pose.bk, pose.bf, 'thighB', 'shinB', backLeg);
  shade(backLeg, BACK_LEG_SHADE);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(backLeg.c, 0, 0);
  g.restore();
  leg(J.hipF, J.kneeF, J.soleF, pose.fk, pose.ff, 'thighF', 'shinF', main);

  // ---- torso (and what it wears) ----
  const body = newLayer(canvas, res, AX, AY);
  drawPart(body.g, puppet, 'torso', T);
  if (cos.stripes) stripeLayer(body, T, J, sig);
  if (cos.poncho) drawPoncho(body.g, T, J);
  if (cos.shirt) tintLayer(body, cos.shirt, 0.55);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(body.c, 0, 0);
  g.restore();
  if (cos.apron) drawApron(g, T, J);

  // ---- head on its neck ----
  const neck = apply(T, J.neck);
  const ho = pose.head || BASE_HEAD;
  const headDest = add(neck, mul([ho[0] - BASE_HEAD[0], ho[1] - BASE_HEAD[1]], Kt));
  const tilt = Math.max(-0.5, Math.min(0.5, (ho[0] - BASE_HEAD[0]) * 0.12));
  const headSig = baby ? SIG * 0.92 : SIG;
  const HT = rotMap(J.neck, headDest, tAngle + tilt, headSig);
  if (cos.scarf) drawScarf(g, HT, J, rig.head, cos.scarf);
  drawPart(g, puppet, 'head', HT, cos.old ? agedAtlas(puppet) : null);
  const headLocal = { ...rig.head, J };
  drawEyes(g, HT, headLocal, cos);
  drawHeadwear(g, HT, headLocal, cos);

  // ---- arms: bones from the puppet's shoulders ----
  // relaxed poses keep the drawn arm and just bend it; every other pose reaches for the skeleton's joints
  const relaxed = RELAXED.has(poseName);
  const walkSwing = poseName === 'walk' ? [-1, 0, 1, 0][frameIdx % 4] * 0.32 : poseName === 'run' ? (frameIdx % 2 ? 0.8 : -0.8) : 0;
  const relaxedArm = (shoulderJ, elbowJ, handJ, upper, fore) => {
    const s2 = apply(T, shoulderJ), e0 = apply(T, elbowJ), h0 = apply(T, handJ);
    const e2 = add(s2, rot(sub(e0, s2), upper));
    const h2 = add(e2, rot(sub(h0, e0), upper + fore));
    return { e2, h2 };
  };
  const arm = (shoulderJ, elbowJ, handJ, skShoulder, e, h, upName, lowName, ctx, rel) => {
    const s2 = apply(T, shoulderJ);
    let e2, h2;
    if (rel) ({ e2, h2 } = rel);
    else {
      // The skeleton says which way each bone points; the drawn arm keeps its own length
      // (within a little give), so sleeves are never stretched thin.
      const sSk = add(pose.chest, skShoulder);
      const lenU = Math.hypot(elbowJ[0] - shoulderJ[0], elbowJ[1] - shoulderJ[1]) * sig;
      const lenL = Math.hypot(handJ[0] - elbowJ[0], handJ[1] - elbowJ[1]) * sig;
      const su = Math.hypot(e[0] - sSk[0], e[1] - sSk[1]) || 1;
      const sl = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1;
      const give = Math.max(0.94, Math.min(1.14, ((su + sl) * Ka * bs) / (lenU + lenL)));
      e2 = add(s2, mul(sub(e, sSk), (lenU * give) / su));
      h2 = add(e2, mul(sub(h, e), (lenL * give) / sl));
    }
    const tl = boneMap(elbowJ, handJ, e2, h2, sig);
    drawPart(ctx.g, puppet, lowName, tl);
    drawPart(ctx.g, puppet, upName, boneMap(shoulderJ, elbowJ, s2, e2, sig));
    return { s2, e2, h2, tl };
  };

  // back arm: a touch darker so the two arms read apart, then the front arm
  const backArm = newLayer(canvas, res, AX, AY);
  arm(J.shoulderB, J.elbowB, J.handB, SH_B, pose.be, pose.bh, 'armB_up', 'armB_low', backArm,
    relaxed ? relaxedArm(J.shoulderB, J.elbowB, J.handB, 0.1 + walkSwing, -0.42) : null);
  if (cos.shirt) tintLayer(backArm, cos.shirt, 0.5, true);
  shade(backArm, BACK_ARM_SHADE);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(backArm.c, 0, 0);
  g.restore();

  const frontArm = newLayer(canvas, res, AX, AY);
  const fa = arm(J.shoulderF, J.elbowF, J.handF, SH_F, pose.fe, pose.fh, 'armF_up', 'armF_low', frontArm,
    relaxed ? relaxedArm(J.shoulderF, J.elbowF, J.handF, -0.08 - walkSwing, -0.5) : null);
  if (cos.shirt) tintLayer(frontArm, cos.shirt, 0.5, true);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(frontArm.c, 0, 0);
  g.restore();
  if (cos.prop) drawProp(g, cos.prop, fa.h2, norm(sub(fa.h2, fa.e2)), SIG * bs, poseName);

  // where things are on the body (game px, relative to the feet, facing right), so the game's
  // beams, projectiles and wands can start from the real hand / eyes / mouth
  const hd = rig.head;
  const vis = {
    hand: fa.h2,
    eye: apply(HT, [hd.eyeX, hd.eye]),
    mouth: apply(HT, [hd.eyeX + hd.w * 0.04, hd.eye + (hd.chin - hd.eye) * 0.55]),
    forearm: norm(sub(fa.h2, fa.e2)),
  };
  const hx = headDest[0], hy = headDest[1];
  return {
    canvas, ax: AX, ay: AY, w: W, h: H, hi: true, res, vis,
    head: { x: AX + hx - 14, y: AY + hy - 30, w: 28, h: 32 },
  };
}

const norm = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

/** Darken everything already drawn on a layer (keeps its transparency). */
function shade(layer, amount) {
  const { c, g } = layer;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(12, 8, 20, ${amount})`;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();
}

/** White hit-flash / icy-blue frozen copy of a hi-res frame. */
export function tintHi(src, tint) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  // (grown-up mode: a battered fighter gets a grey, sickly wash; `hurtN` = N quarters of the way to half dead)
  g.fillStyle = tint === 'white' ? '#ffffff' : tint.startsWith('hurt') ? `rgba(120, 112, 130, ${(Number(tint.slice(4)) * 0.1).toFixed(2)})` : 'rgba(120, 190, 255, 0.62)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
