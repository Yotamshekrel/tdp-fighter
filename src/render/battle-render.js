// Draws a Battle: arena, shadows, fighters, entities, particles, HUD, banners.
import { VIEW } from '../config.js';
import { getArena, drawArena } from './backgrounds.js';
import { drawAnnounce, drawCutIn } from './hud.js';
import { drawFrame } from './sprites.js';
import { postProcess } from './post.js';
import { getState, setState } from '../game/rng.js';

const { W, H, GROUND_Y } = VIEW;

export function drawFighter(g, f, bank, battle, reflect = 0) {
  const { pose, frame } = f.anim();
  const tint = f.flash > 0 && f.flash % 2 ? 'white' : f.frozen > 0 ? 'ice' : null;
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
  // (online fights skip this: it depends on what has been drawn so far, which differs per computer)
  f.vis = V && !tint && !battle.deterministic
    ? {
      hand: { x: f.x + f.facing * sx * V.hand[0], y: f.y + sy * V.hand[1] },
      eye: { x: f.x + f.facing * sx * V.eye[0], y: f.y + sy * V.eye[1] },
      mouth: { x: f.x + f.facing * sx * V.mouth[0], y: f.y + sy * V.mouth[1] },
      dir: { x: f.facing * V.forearm[0], y: V.forearm[1] },
    }
    : battle.deterministic ? undefined : f.vis;
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
  g.save();
  g.translate(x, f.y);
  g.scale(f.facing * sx, sy);
  drawFrame(g, spr);
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
  zt = Math.max(1, zt);
  const k = cam.init ? 0.09 : 1;
  cam.z += (zt - cam.z) * k;
  const mid = (a.x + b.x) / 2;
  const xt = Math.max(0, Math.min(W - W / cam.z, mid - W / (2 * cam.z)));
  cam.x += (xt - cam.x) * k;
  cam.init = true;
  return cam;
}

// Drawing may call rand() for sparkle and flicker. It gets its own stream so that it can never change
// the random numbers the simulation sees (two computers draw at different times, but must stay in step).
let renderRng = 0x51ed270b;

/** opts.hud = false draws just the arena and fighters (title backdrop). */
export function drawBattle(g, battle, bank, hud, frame, debug = false, opts = {}) {
  const simRng = getState();
  setState(renderRng);
  try {
    drawBattleInner(g, battle, bank, hud, frame, debug, opts);
  } finally {
    renderRng = getState();
    setState(simRng);
  }
}

function drawBattleInner(g, battle, bank, hud, frame, debug, opts) {
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
  drawArena(g, arena, frame, cam.x, freeze ? 0.45 : 0);

  for (const f of battle.fighters) drawShadow(g, f);
  for (const e of battle.entities) if (e.layer === 0 && e.draw) drawEntity(g, e, battle);

  // Draw the most recent attacker on top
  const order = battle.lastAttacker === a ? [b, a] : [a, b];
  for (const f of order) {
    drawFighter(g, f, bank, battle, reflect);
    if (f.state === 'special' && f.special.draw) f.special.draw(g, f, battle, f.t);
  }
  for (const e of battle.entities) if (e.layer !== 0 && e.draw) drawEntity(g, e, battle);
  battle.fx.draw(g);

  if (debug) drawDebug(g, battle);
  g.restore();

  if (opts.hud !== false) {
    hud.draw(g, battle, bank, frame);
    if (freeze) drawCutIn(g, battle.freeze.owner, bank, battle.freeze.t, battle.freeze.total);
    drawAnnounce(g, battle.announce, frame);
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
