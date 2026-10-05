// IDO — big and strong. Grows into a GIANT, leaps over and stomps you flat.
import { spHit, SD, meleeHit, VIEW } from './helpers.js';
import { PHYS, BODY } from '../../config.js';

const BIG = 1.65; // relative to the normal fighter size
const LEAP_T = 34;

export default {
  windup: 30,
  duration: 120,
  aiRange: [0, 999],
  costume: null,
  anim(f, t) {
    const s = f.sd;
    if (t < this.windup) return { pose: 'win', frame: Math.floor(t / 8) % 2 };
    if (s.phase === 'leap') return { pose: 'stompAir', frame: 0 };
    if (s.phase === 'land') return { pose: 'crouch', frame: 0 };
    return { pose: 'idle', frame: 0 };
  },

  start(f, b) {
    b.fx.text('FEE FI FO FUM!', f.x, f.y - 100 * f.scale, { color: '#ffb36b', life: 44 });
    b.sfx('grow', f.x);
  },

  update(f, b, t, opp) {
    const s = f.sd;
    if (t < this.windup) {
      f.scale = BODY.SCALE * (1 + (BIG - 1) * Math.min(1, t / (this.windup - 6)));
      if (t % 8 === 0) b.addShake(2);
      return;
    }
    if (t === this.windup) {
      s.phase = 'leap';
      f.noPush = true;
      const g = PHYS.gravity;
      const tx = Math.max(VIEW.LEFT + 30, Math.min(VIEW.RIGHT - 30, opp.x));
      f.vx = (tx - f.x) / LEAP_T;
      f.vy = -(g * LEAP_T) / 2;
      f.grounded = false;
      b.sfx('jump', f.x);
    }
    if (s.phase === 'leap') {
      f.friction = false;
      if (f.grounded && t > this.windup + 2) {
        s.phase = 'land';
        s.at = t;
        f.vx = 0;
        b.addShake(9);
        b.sfx('boom', f.x);
        b.fx.burst('dust', f.x, VIEW.GROUND_Y - 4, 22, { color: '#d8c8a8', size: 6, speed: 4, life: 28, angle: -Math.PI / 2, spread: 3 });
        b.fx.spawn('ring', f.x, VIEW.GROUND_Y - 2, { size: 6, grow: 3, life: 14, color: '#ffffff' });
        meleeHit(f, b, { x: -24, y: -44, w: 48, h: 44 }, spHit({
          damage: SD, knockdown: true, push: 6, launch: 7, hitstop: 14, shake: 10, sfx: 'boom',
        }));
      }
      return;
    }
    if (s.phase === 'land') {
      const k = t - s.at;
      if (k > 16) f.scale = Math.max(BODY.SCALE, f.scale - 0.06);
      if (k === 17) b.sfx('shrink', f.x);
      if (f.scale <= BODY.SCALE && k > 20) f.endSpecial(b);
    }
  },
};
