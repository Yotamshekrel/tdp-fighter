// ---------------------------------------------------------------------------
// Entities: anything that isn't a fighter but can hit one — projectiles,
// beams, waves, bug swarms, falling air conditioners...
// Specials create them; the Battle updates them and checks their hitboxes.
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';

let seq = 0;
/** Entity ids restart for every online match, so both computers number them the same way. */
export const resetEntityIds = () => { seq = 0; };

export class Entity {
  constructor(o = {}) {
    this.id = ++seq;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.w = 12; // hitbox size (centred on x, y)
    this.h = 12;
    this.life = 90; // frames until it disappears
    this.t = 0;
    this.owner = null; // Fighter who created it
    this.hit = null; // hit definition (see Battle.resolveHit); null = cosmetic
    this.finalHit = null; // overrides merged into the last hit (e.g. knockdown)
    this.maxHits = 1;
    this.hitEvery = 10; // min frames between hits for multi-hit entities
    this.hits = 0;
    this.lastHitT = -999;
    this.dieOnHit = true; // disappear after the last hit
    this.active = true; // hitbox enabled
    this.layer = 1; // 0 = behind fighters, 1 = in front
    this.clash = false; // projectiles with clash cancel each other out
    this.bounce = 0; // >0: bounce off the ground with this restitution
    this.wallDie = true; // disappear when fully off-screen
    this.dead = false;
    this.angle = 0;
    this.spin = 0;
    // Hooks
    this.onUpdate = null; // (e, battle) => void
    this.onHit = null; // (e, battle, target, result) => void
    this.onGround = null; // (e, battle) => void
    this.draw = null; // (ctx, e, battle) => void
    this.vscale = 1; // draw scale about (x, y), for objects that are drawn centred on themselves
    Object.assign(this, o);
  }

  box() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update(b) {
    this.t++;
    this.onUpdate?.(this, b);
    if (this.dead) return;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.spin;
    const floor = VIEW.GROUND_Y - this.h / 2;
    if (this.gravity > 0 && this.y > floor) {
      this.y = floor;
      if (this.bounce > 0 && Math.abs(this.vy) > 1.2) {
        this.vy = -this.vy * this.bounce;
        b.event('bounce', { e: this });
      } else {
        this.vy = 0;
      }
      this.onGround?.(this, b);
    }
    if (--this.life <= 0) this.dead = true;
    if (this.wallDie && (this.x < -80 || this.x > VIEW.W + 80)) this.dead = true;
  }
}
