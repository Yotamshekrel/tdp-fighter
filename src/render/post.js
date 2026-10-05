// ---------------------------------------------------------------------------
// Finishing touches over the whole picture: a soft bloom on the bright parts
// and a gentle vignette. Skipped quietly where the canvas has no filter support.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';

const { W, H } = VIEW;
let small = null, sctx = null, blur = null, bctx = null;
let supported = null;

function init(g) {
  if (supported !== null) return;
  supported = 'filter' in g;
  if (!supported) return;
  small = document.createElement('canvas');
  small.width = W / 2;
  small.height = H / 2;
  sctx = small.getContext('2d');
  blur = document.createElement('canvas');
  blur.width = W / 2;
  blur.height = H / 2;
  bctx = blur.getContext('2d');
}

export const POST = { bloom: 0.32, vignette: 0.42 };

/** Run after a scene has drawn its frame (the canvas transform is VIEW.SCALE). */
export function postProcess(g, t = 0, o = {}) {
  init(g);
  const bloomAmt = o.bloom ?? POST.bloom;
  if (supported && bloomAmt > 0) {
    // bright pass: downscale, blur, add back on top
    const src = g.canvas;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'copy';
    sctx.filter = 'brightness(1.15) contrast(1.35) saturate(1.15)';
    sctx.drawImage(src, 0, 0, small.width, small.height);
    sctx.filter = 'none';
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'copy';
    bctx.filter = 'blur(3.5px)';
    bctx.drawImage(small, 0, 0);
    bctx.filter = 'none';
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = bloomAmt;
    g.drawImage(blur, 0, 0, W, H);
    g.restore();
  }
  const v = o.vignette ?? POST.vignette;
  if (v > 0) {
    const gr = g.createRadialGradient(W / 2, H * 0.52, H * 0.5, W / 2, H * 0.52, H * 1.0);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(3, 4, 16, ${v})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
}
