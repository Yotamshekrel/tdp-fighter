// ---------------------------------------------------------------------------
// Ido's hi-res "paper doll".
//
// His sprite is cut out of a pixel-art picture (scripts/build-ido-sprite.mjs ->
// public/ido/*.png + rig.json) into head / torso / two arms / two legs. For
// every animation frame the parts are re-posed to follow the same skeleton
// (poses.js) that drives the procedural fighters, then drawn into a canvas
// VIEW.SCALE times denser than the game grid, so the picture keeps its detail.
//
// Skeleton points are in game pixels relative to the feet (+x forward, -y up).
// The picture has real body proportions, so skeleton points are scaled by K.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';

const K = 1.38; // skeleton -> puppet scale (Ido is the tall one)
const SIGMA = 0.089; // game pixels per source-picture pixel
const MIN_STRETCH = 0.55, MAX_STRETCH = 1.6; // how far a bone may be squashed / stretched
const BASE_HEAD = [1, -2];
const SH_F = [4.6, 3], SH_B = [-5.6, 3]; // skeleton shoulders relative to the chest

export async function loadPuppet(baseUrl) {
  const bust = import.meta.env?.DEV ? `?t=${Date.now()}` : ''; // dev: always pick up a rebuilt sprite
  try {
    const rig = await (await fetch(`${baseUrl}rig.json${bust}`)).json();
    const imgs = {};
    await Promise.all(
      Object.entries(rig.parts).map(
        ([name, p]) =>
          new Promise((res, rej) => {
            const im = new Image();
            im.onload = () => { imgs[name] = im; res(); };
            im.onerror = rej;
            im.src = `${baseUrl}${p.file}${bust}`;
          }),
      ),
    );
    const portrait = await new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = `${baseUrl}portrait.png${bust}`;
    });
    return { rig, imgs, portrait };
  } catch (err) {
    console.warn('Ido puppet failed to load', err);
    return null;
  }
}

// ---- 2x3 affine maps -------------------------------------------------------
const apply = (t, p) => [t[0] * p[0] + t[2] * p[1] + t[4], t[1] * p[0] + t[3] * p[1] + t[5]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];

/**
 * Map picture-space bone S->E onto game-space bone s2->e2: the bone's length is
 * stretched to fit (within limits), its thickness stays at SIGMA. flip mirrors
 * the part across the bone.
 */
function boneMap(S, E, s2, e2, flip = false) {
  const ax = E[0] - S[0], ay = E[1] - S[1];
  const L = Math.hypot(ax, ay) || 1;
  const a = [ax / L, ay / L];
  const n = [-a[1], a[0]];
  const dx = e2[0] - s2[0], dy = e2[1] - s2[1];
  const L2 = Math.hypot(dx, dy);
  const d = L2 > 1e-3 ? [dx / L2, dy / L2] : [0, 1];
  const nd = [-d[1], d[0]];
  const ratio = Math.min(MAX_STRETCH, Math.max(MIN_STRETCH, L2 / (L * SIGMA)));
  const lA = ratio * SIGMA, lP = flip ? -SIGMA : SIGMA;
  const m11 = lA * d[0] * a[0] + lP * nd[0] * n[0];
  const m12 = lA * d[0] * a[1] + lP * nd[0] * n[1];
  const m21 = lA * d[1] * a[0] + lP * nd[1] * n[0];
  const m22 = lA * d[1] * a[1] + lP * nd[1] * n[1];
  // the bone ends where it was asked to, even when the stretch was clamped
  const sx = S[0], sy = S[1];
  return [m11, m21, m12, m22, s2[0] - (m11 * sx + m12 * sy), s2[1] - (m21 * sx + m22 * sy)];
}

/** Uniformly scaled rotation about picture point `pivot`, placed at `dest`. */
function rotMap(pivot, dest, angle) {
  const c = Math.cos(angle) * SIGMA, s = Math.sin(angle) * SIGMA;
  const m11 = c, m12 = -s, m21 = s, m22 = c;
  return [m11, m21, m12, m22, dest[0] - (m11 * pivot[0] + m12 * pivot[1]), dest[1] - (m21 * pivot[0] + m22 * pivot[1])];
}

function drawPart(g, rig, imgs, name, t) {
  const p = rig.parts[name];
  const im = imgs[name];
  if (!p || !im) return;
  g.save();
  g.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
  g.drawImage(im, p.x, p.y, p.w, p.h);
  g.restore();
}

/**
 * Render one pose into a canvas `res` times denser than the game grid.
 * Returns { canvas, ax, ay, w, h, hi: true, head } (w/h/ax/ay in game pixels).
 */
export function buildPuppetFrame(puppet, pose, frameBox, res = VIEW.SCALE) {
  const { rig, imgs } = puppet;
  const J = rig.joints;
  const { W, H, AX, AY } = frameBox;
  const canvas = document.createElement('canvas');
  canvas.width = W * res;
  canvas.height = H * res;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.scale(res, res);
  g.translate(AX, AY);

  // back limbs live on their own layer so they can be shaded darker
  const back = document.createElement('canvas');
  back.width = canvas.width;
  back.height = canvas.height;
  const bg = back.getContext('2d');
  bg.imageSmoothingEnabled = true;
  bg.imageSmoothingQuality = 'high';
  bg.scale(res, res);
  bg.translate(AX, AY);

  const sk = (p) => mul(p, K);
  const hip = sk(pose.hip), chest = sk(pose.chest);

  // ---- torso: pelvis -> neck base ----
  const T = boneMap(J.pelvis, J.neckBase, hip, chest);
  const up = apply(T, [J.pelvis[0], J.pelvis[1] - 100]);
  const tAngle = Math.atan2(up[0] - hip[0], hip[1] - up[1]); // 0 = upright, + = leaning forward

  // ---- arms: bones from the puppet's shoulders, lengths from the skeleton ----
  const arm = (shoulderJ, elbowJ, handJ, skShoulder, e, h, upName, lowName, ctx) => {
    const s2 = apply(T, shoulderJ);
    const sSk = add(pose.chest, skShoulder);
    const e2 = add(s2, sk(sub(e, sSk)));
    const h2 = add(e2, sk(sub(h, e)));
    drawPart(ctx, rig, imgs, lowName, boneMap(elbowJ, handJ, e2, h2));
    drawPart(ctx, rig, imgs, upName, boneMap(shoulderJ, elbowJ, s2, e2));
  };

  // ---- legs: bones from the puppet's hips to the skeleton's knee / foot ----
  const leg = (hipJ, kneeJ, soleJ, knee, foot, thighName, shinName, flip, ctx) => {
    const h2 = apply(T, hipJ);
    const k2 = sk(knee), f2 = sk(foot);
    drawPart(ctx, rig, imgs, thighName, boneMap(hipJ, kneeJ, h2, k2, flip));
    drawPart(ctx, rig, imgs, shinName, boneMap(kneeJ, soleJ, k2, f2, flip));
  };

  // back leg (darker, behind everything)
  leg(J.hipB, J.kneeB, J.soleB, pose.bk, pose.bf, 'thighB', 'shinB', false, bg);
  shade(bg, back);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(back, 0, 0);
  g.restore();

  // front leg
  leg(J.hipF, J.kneeF, J.soleF, pose.fk, pose.ff, 'thighF', 'shinF', false, g);

  // torso, then the head on its neck
  drawPart(g, rig, imgs, 'torso', T);
  const neck = apply(T, J.neckBase);
  const ho = pose.head || BASE_HEAD;
  const headDest = add(neck, mul([ho[0] - BASE_HEAD[0], ho[1] - BASE_HEAD[1]], K));
  const tilt = Math.max(-0.5, Math.min(0.5, (ho[0] - BASE_HEAD[0]) * 0.12));
  drawPart(g, rig, imgs, 'head', rotMap(J.neckBase, headDest, tAngle + tilt));

  // back arm (a little darker, but in front of the chest so both arms read), then the front arm;
  // each sleeve is drawn again over the top of its arm
  const arm2 = document.createElement('canvas');
  arm2.width = canvas.width;
  arm2.height = canvas.height;
  const ag = arm2.getContext('2d');
  ag.imageSmoothingEnabled = true;
  ag.imageSmoothingQuality = 'high';
  ag.scale(res, res);
  ag.translate(AX, AY);
  arm(J.shoulderB, J.elbowB, J.handB, SH_B, pose.be, pose.bh, 'armB_up', 'armB_low', ag);
  drawPart(ag, rig, imgs, 'sleeveB', T);
  shade(ag, arm2, 0.16);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(arm2, 0, 0);
  g.restore();

  arm(J.shoulderF, J.elbowF, J.handF, SH_F, pose.fe, pose.fh, 'armF_up', 'armF_low', g);
  drawPart(g, rig, imgs, 'sleeveF', T);

  const hx = headDest[0], hy = headDest[1];
  return {
    canvas, ax: AX, ay: AY, w: W, h: H, hi: true, res,
    head: { x: AX + hx - 14, y: AY + hy - 30, w: 28, h: 32 },
  };
}

/** Darken everything already drawn on a layer (keeps its transparency). */
function shade(ctx, layer, amount = 0.28) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(12, 8, 20, ${amount})`;
  ctx.fillRect(0, 0, layer.width, layer.height);
  ctx.restore();
}

/** White hit-flash / icy-blue frozen copy of a hi-res frame. */
export function tintHi(src, tint) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = tint === 'white' ? '#ffffff' : 'rgba(120, 190, 255, 0.62)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
