// Draws a Battle: arena, shadows, fighters, entities, particles, HUD, banners.
import { VIEW, RULES } from '../config.js';
import { getArena, drawArena } from './backgrounds.js';
import { drawWounds, drawGored, drawLens, leanOf } from './wounds.js';
import { drawAnnounce, drawCutIn } from './hud.js';
import { drawFrame } from './sprites.js';
import { postProcess } from './post.js';

const { W, H, GROUND_Y } = VIEW;

export function drawFighter(g, f, bank, battle, reflect = 0) {
  const { pose, frame } = f.anim();
  const flashTint = f.flash > 0 && f.flash % 2 ? 'white' : f.frozen > 0 ? 'ice' : null;
  // grown-up mode: the more hurt, the paler (a cached copy of the frame: filtering on every draw is too slow)
  const hp = Math.max(0, f.health) / RULES.maxHealth;
  const hurtLevel = battle.gore ? Math.round(Math.max(0, (0.55 - hp) / 0.55) * 4) : 0;
  const tint = flashTint || (hurtLevel > 0 ? `hurt${hurtLevel}` : null);
  const giant = f.scale > 1.9; // a giant fighter gets frames twice as dense so it stays sharp
  const spr = bank.frame(f.def.id, pose, frame, f.costume, tint, giant);
  let sx = f.scale, sy = f.scale;
  if (f.squish > 0) {
    sx *= 0.8;
    sy *= 1.06;
  }
  // Victim shudders during hit-stop
  const jitter = battle.hitstop > 0 && f.state === 'hitstun' ? (battle.frame % 2 ? 1 : -1) : 0;
  const x = f.x + jitter;
  // remember where the hand, eyes and mouth are on screen, so special attacks can start from them
  const V = spr.vis;
  f.vis = V && !flashTint
    ? {
      hand: { x: f.x + f.facing * sx * V.hand[0], y: f.y + sy * V.hand[1] },
      eye: { x: f.x + f.facing * sx * V.eye[0], y: f.y + sy * V.eye[1] },
      mouth: { x: f.x + f.facing * sx * V.mouth[0], y: f.y + sy * V.mouth[1] },
      dir: { x: f.facing * V.forearm[0], y: V.forearm[1] },
    }
    : f.vis;
  if (reflect > 0 && spr.hi) {
    // a faint mirror image on the floor, fading with the height of the fighter above the ground
    const lift = Math.max(0, GROUND_Y - f.y);
    g.save();
    g.beginPath();
    g.rect(x - 90, GROUND_Y + 1, 180, 40);
    g.clip();
    g.globalAlpha = reflect * Math.max(0.2, 1 - lift / 90);
    g.translate(x, GROUND_Y + 2 + lift * 0.9);
    g.scale(f.facing * sx, -sy * 0.8);
    drawFrame(g, spr);
    g.restore();
  }
  if (!battle.gore) {
    g.save();
    g.translate(x, f.y);
    g.scale(f.facing * sx, sy);
    drawFrame(g, spr);
    g.restore();
    return;
  }
  // grown-up mode: slumped, and the wounds show
  if (f.gore) return drawGored(g, f, spr, V, hp, battle.frame);
  g.save();
  g.translate(x, f.y);
  g.scale(f.facing * sx, sy);
  const lean = leanOf(f, hp, battle.frame);
  if (lean) g.rotate(lean);
  drawFrame(g, spr);
  drawWounds(g, f, V, hp, battle.frame);
  g.restore();
}

function drawEntity(g, e, battle) {
  if (e.vscale === 1) return e.draw(g, e, battle);
  g.save();
  g.translate(e.x, e.y);
  g.scale(e.vscale, e.vscale);
  g.translate(-e.x, -e.y);
  e.draw(g, e, battle);
  g.restore();
}

function drawShadow(g, f) {
  const h = Math.max(0, GROUND_Y - f.y);
  const r = Math.max(9, (21 - h * 0.1) * f.scale);
  const a = Math.max(0.1, 0.5 - h * 0.003);
  g.save();
  g.translate(f.x, GROUND_Y + 1);
  g.scale(1, 0.2);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
  gr.addColorStop(0, `rgba(0, 0, 0, ${a})`);
  gr.addColorStop(0.6, `rgba(0, 0, 0, ${a * 0.55})`);
  gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * The camera follows the fighters and zooms in a little when they are close.
 * Smoothed over time; the state lives on the battle.
 */
function updateCamera(battle) {
  const [a, b] = battle.fighters;
  const cam = (battle.cam ||= { z: 1, x: 0, init: false });
  const dist = Math.abs(a.x - b.x);
  const close = Math.max(0, Math.min(1, (300 - dist) / 190));
  let zt = 1 + 0.15 * close * close * (3 - 2 * close);
  // never zoom so far that a jumping or giant fighter's head leaves the screen
  const topY = Math.min(a.y - 96 * a.scale, b.y - 96 * b.scale);
  zt = Math.min(zt, H / Math.max(H * 0.55, H - Math.max(0, topY - 14)));
  if (battle.fatal) zt = Math.min(Math.max(zt, battle.fatal.def.zoom ?? 1.35), H / Math.max(H * 0.55, H - Math.max(0, topY - 14)));
  zt = Math.max(1, zt);
  const k = cam.init ? 0.09 : 1;
  cam.z += (zt - cam.z) * k;
  const mid = (a.x + b.x) / 2;
  const xt = Math.max(0, Math.min(W - W / cam.z, mid - W / (2 * cam.z)));
  cam.x += (xt - cam.x) * k;
  cam.init = true;
  return cam;
}

/** opts.hud = false draws just the arena and fighters (title backdrop). */
export function drawBattle(g, battle, bank, hud, frame, debug = false, opts = {}) {
  const arena = getArena(battle.arena);
  const [a, b] = battle.fighters;
  const freeze = battle.freeze.t > 0;
  const cam = updateCamera(battle);
  const reflect = arena.reflect;

  g.save();
  if (battle.shake > 0) g.translate((Math.random() - 0.5) * battle.shake * 2, (Math.random() - 0.5) * battle.shake * 2);
  // world space: zoom about the bottom of the screen, following the fighters
  g.translate(0, H);
  g.scale(cam.z, cam.z);
  g.translate(-cam.x, -H);
  drawArena(g, arena, frame, cam.x, freeze ? 0.45 : battle.fatal ? 0.28 : 0);
  if (battle.gore) battle.fx.drawStains(g);
  const FT = battle.fatal && battle.fatal.t >= 0 ? battle.fatal : null;
  if (FT?.def.drawBack) FT.def.drawBack(g, FT.w, FT.l, battle, FT.t, FT);

  for (const f of battle.fighters) drawShadow(g, f);
  for (const e of battle.entities) if (e.layer === 0 && e.draw) drawEntity(g, e, battle);

  // Draw the most recent attacker on top
  const order = battle.lastAttacker === a ? [b, a] : [a, b];
  for (const f of order) {
    drawFighter(g, f, bank, battle, reflect);
    if (f.state === 'special' && f.special.draw) f.special.draw(g, f, battle, f.t);
  }
  for (const e of battle.entities) if (e.layer !== 0 && e.draw) drawEntity(g, e, battle);
  if (FT?.def.draw) FT.def.draw(g, FT.w, FT.l, battle, FT.t, FT);
  battle.fx.draw(g);

  if (debug) drawDebug(g, battle);
  g.restore();

  if (opts.hud !== false) {
    hud.draw(g, battle, bank, frame);
    if (freeze) drawCutIn(g, battle.freeze.owner, bank, battle.freeze.t, battle.freeze.total);
    drawAnnounce(g, battle.announce, frame);
  }

  if (battle.gore) drawLens(g, battle);
  if (battle.fatal) {
    // a dark red frame around the picture while the finishing move plays
    const gr = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
    gr.addColorStop(0, 'rgba(70,0,8,0)');
    gr.addColorStop(1, 'rgba(70,0,8,0.5)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  if (battle.flash) {
    g.fillStyle = withAlpha(battle.flash.color, (battle.flash.t / battle.flash.max) * 0.7);
    g.fillRect(0, 0, W, H);
  }
  postProcess(g, frame);
}

const withAlpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Hitbox viewer (toggle with the ` key). */
function drawDebug(g, battle) {
  const box = (bx, col) => {
    if (!bx) return;
    g.strokeStyle = col;
    g.lineWidth = 0.5;
    g.strokeRect(Math.round(bx.x) + 0.5, Math.round(bx.y) + 0.5, Math.round(bx.w), Math.round(bx.h));
  };
  for (const f of battle.fighters) {
    box(f.hurtbox(), '#3ec1ff');
    box(f.activeHitbox(), '#ff3030');
    g.fillStyle = '#ffffff';
    g.fillRect(f.x - 0.5, f.y - 2, 1, 4);
  }
  for (const e of battle.entities) if (e.hit && e.active) box(e.box(), '#ff9b2e');
}
