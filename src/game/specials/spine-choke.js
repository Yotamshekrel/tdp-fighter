// MOR — rips his own spine out, runs in and chokes the other fighter with it, then yanks them
// away. It's a grab: can't be blocked, but you can jump it.
import { spHit, SD, SC, aheadDist, handPos } from './helpers.js';
import { INK } from '../../render/fx-kit.js';
import { rand } from '../rng.js';

const CHOKES = 3;
const CHOKE_DMG = SD * 0.27;
const YANK_DMG = SD - CHOKE_DMG * CHOKES;
const EVERY = 16;
const BONE = '#f1e6c8';
const BONE_SHADE = '#b9a782';
const BLOOD = '#c4142a';

/** A string of vertebrae along a sagging curve from a to b; `k` (0..1) is how much of it is out. */
function drawSpine(ctx, a, b, sag, k = 1) {
  const n = 13;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
  const at = (u) => {
    const v = 1 - u;
    return { x: v * v * a.x + 2 * v * u * mx + u * u * b.x, y: v * v * a.y + 2 * v * u * my + u * u * b.y };
  };
  ctx.save();
  ctx.lineCap = 'round';
  // the cord
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = at((i / n) * k);
    ctx[i ? 'lineTo' : 'moveTo'](p.x, p.y);
  }
  ctx.stroke();
  // vertebrae, a little smaller toward the tail
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * k;
    const p = at(u), q = at(Math.min(1, u + 0.02));
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    const r = (1.9 - (i / n) * 0.7) * SC;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.fillStyle = INK;
    ctx.fillRect(-0.5 * SC, -r * 1.7 - 0.5, 1.5 * SC, r * 3.4 + 1); // processes
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95 + 0.6, r * 1.15 + 0.6, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = BONE_SHADE;
    ctx.fillRect(-0.3 * SC, -r * 1.55, 1.1 * SC, r * 3.1);
    ctx.fillStyle = BONE;
    ctx.beginPath();
    ctx.ellipse(0, -0.2, r * 0.95, r * 1.15, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }
  // the bloody root end
  ctx.fillStyle = BLOOD;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 1.6 * SC, 0, 6.3);
  ctx.fill();
  ctx.restore();
}

/** A tight loop of spine around the victim's neck. */
function drawNooseAround(ctx, x, y, squeeze) {
  ctx.save();
  ctx.lineCap = 'round';
  const rx = 6.5 * SC, ry = 2.4 * SC * (1 - squeeze * 0.25);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
  ctx.stroke();
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 1.9;
  ctx.setLineDash([2.2, 1.3]);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
  ctx.stroke();
  ctx.restore();
}

export default {
  windup: 36,
  duration: 130,
  aiRange: [0, 210],
  escape: 'jump', // hint for the CPU: grabs can't be blocked, jump away
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: 'charge', frame: Math.floor(t / 6) % 2 };
    if (s.phase === 'run') return { pose: 'run', frame: Math.floor(t / 4) % 2 };
    if (s.phase === 'choke') return { pose: 'hug', frame: Math.floor((t - s.at) / 6) % 2 };
    if (s.phase === 'yank') return { pose: 'throw', frame: 1 };
    return { pose: 'charge', frame: 0 };
  },

  start(f, b) {
    b.fx.text('SPINE OUT!', f.x, f.y - 98 * f.scale, { color: '#f1e6c8', scale: 2, life: 40 });
    b.sfx('charge', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) {
      if (t % 5 === 0) b.fx.spawn('spark', f.x - f.facing * 6 * f.scale, f.y - 46 * f.scale, { vx: -f.facing * (0.5 + rand()), vy: -0.6 - rand(), life: 18, size: 2, color: BLOOD });
      if (t === 12) b.sfx('grab', f.x);
      return;
    }
    if (t === this.windup) s.phase = 'run';
    if (s.phase === 'run') {
      f.vx = f.facing * 6.5;
      f.friction = false;
      const d = aheadDist(f, opp);
      const grabbable = opp.grounded && !opp.isInvulnerable() && opp.state !== 'ko';
      if (d > -4 && d < 30 * f.scale && grabbable) {
        // GOT YOU!
        s.phase = 'choke';
        s.at = t;
        s.n = 0;
        f.vx = 0;
        opp.go('hitstun');
        opp.stun = { left: 999, knockdown: false, phase: 'stun' };
        opp.attack = null;
        opp.held = true;
        opp.vx = opp.vy = 0;
        opp.facing = -f.facing;
        b.sfx('grab', f.x);
      } else if (t > this.windup + 30) {
        s.phase = 'whiff';
        s.at = t;
        b.fx.text('...', f.x, f.y - 92 * f.scale, { bubble: true, life: 30 });
      }
      return;
    }
    if (s.phase === 'choke') {
      f.vx = 0;
      opp.x = f.x + f.facing * 17 * f.scale;
      opp.y = f.y;
      const k = t - s.at;
      if (k % EVERY === EVERY - 1 && s.n < CHOKES) {
        s.n++;
        opp.squish = 10;
        b.resolveHit(f, opp, spHit({ damage: CHOKE_DMG, guard: 'unblockable', hitstun: 999, push: 0, hitstop: 5, sfx: 'squeeze' }), f.x, opp.x, opp.y - 50 * opp.scale);
        opp.held = opp.state !== 'ko';
        b.fx.text(s.n === CHOKES ? 'CHOKE!!' : 'CHOKE!', (f.x + opp.x) / 2, f.y - 100 * f.scale, { color: '#f1e6c8', life: 20 });
        b.fx.burst('spark', opp.x, opp.y - 56 * opp.scale, 5, { color: BLOOD, speed: 2, vy: -1, life: 22 });
        b.sfx('squeeze', f.x);
      }
      if (opp.state === 'ko') {
        s.phase = 'done';
        s.at = t;
        return;
      }
      if (s.n >= CHOKES && k > EVERY * CHOKES + 6) {
        s.phase = 'yank';
        s.at = t;
        opp.held = false;
        b.resolveHit(f, opp, spHit({ damage: YANK_DMG, guard: 'unblockable', knockdown: true, push: 5, launch: 6, hitstop: 10, shake: 5, sfx: 'smash' }), f.x, opp.x, opp.y - 50 * opp.scale);
        b.fx.text('SPINE-CHILLING!', f.x, f.y - 96 * f.scale, { bubble: true, life: 36 });
      }
      return;
    }
    if ((s.phase === 'yank' || s.phase === 'whiff' || s.phase === 'done') && t - s.at > 18) f.endSpecial(b);
  },

  end(f, b) {
    const opp = b?.opponentOf(f);
    if (opp && opp.held) {
      opp.held = false;
      if (opp.state === 'hitstun' && opp.stun) opp.stun.left = 10;
    }
  },

  draw(ctx, f, b, t) {
    const s = f.sd;
    const hand = handPos(f);
    if (t < this.windup) {
      // being pulled out of his back
      const k = Math.min(1, t / (this.windup * 0.75));
      const root = { x: f.x - f.facing * 5 * f.scale, y: f.y - 40 * f.scale };
      const tip = { x: root.x + (hand.x - root.x) * k, y: root.y + (hand.y - root.y) * k - Math.sin(k * 3.14) * 6 * SC };
      drawSpine(ctx, root, tip, 6 * SC * (1 - k * 0.5), Math.max(0.15, k));
      return;
    }
    const opp = b.opponentOf(f);
    if (s.phase === 'choke' && opp) {
      const neck = { x: opp.x, y: opp.y - 58 * opp.scale };
      const squeeze = Math.sin((t - s.at) * 0.5) * 0.5 + 0.5;
      drawSpine(ctx, hand, neck, 2 * SC, 1);
      drawNooseAround(ctx, neck.x, neck.y, squeeze);
      return;
    }
    // held low and trailing behind while running; drooping afterwards
    const tail = { x: hand.x - f.facing * 24 * SC, y: hand.y + (s.phase === 'run' ? -2 : 12) * SC };
    drawSpine(ctx, hand, tail, s.phase === 'run' ? 0 : 7 * SC, 1);
  },
};
