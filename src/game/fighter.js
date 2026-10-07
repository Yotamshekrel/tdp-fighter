// ---------------------------------------------------------------------------
// Fighter: one character in a battle, driven by a finite state machine.
//
// States: idle, walk, jump, crouch, attack, block, hitstun, special, ko, win,
//         fatal (grown-up mode: scripted by a fatality, see game/fatalities/)
//
// Every fighter is controlled through the same InputState
//   { left, right, up, down, attack, defend, special }  (booleans, "held")
// whether it comes from a keyboard, a gamepad, touch buttons or the CPU bot.
// ---------------------------------------------------------------------------
import { PHYS, RULES, ATTACKS, VIEW, BODY } from '../config.js';
import { stepBody } from './physics.js';
import { toWorld } from './collision.js';
import { getSpecial } from './specials/index.js';

export const NO_INPUT = Object.freeze({
  left: false, right: false, up: false, down: false, attack: false, defend: false, special: false,
});

// Hurtboxes (where you can be hit), facing right, relative to the feet.
const HURT = {
  stand: { x: -12, y: -78, w: 24, h: 78 },
  crouch: { x: -13, y: -52, w: 27, h: 52 },
  air: { x: -12, y: -76, w: 24, h: 62 },
  lying: { x: -26, y: -16, w: 52, h: 16 },
};

/** States in which the fighter is on the ground and free to act. */
const NEUTRAL = new Set(['idle', 'walk', 'crouch', 'block']);

export class Fighter {
  /**
   * @param {object} def   character config entry (src/data/characters.js)
   * @param {number} side  0 = player 1 (left), 1 = player 2 (right)
   */
  constructor(def, side) {
    this.def = def;
    this.side = side;
    const s = def.stats || {};
    this.stats = { speed: s.speed ?? 1, jump: s.jump ?? 1, reach: s.reach ?? 0 };
    this.special = getSpecial(def.special.type);
    this.meter = 0;
    this.roundWins = 0;
    this.prevIn = NO_INPUT;
    this.in = NO_INPUT;
    this.resetRound(side === 0 ? 150 : 330, side === 0 ? 1 : -1);
  }

  /** Put the fighter back at a start position for a new round. Meter carries over. */
  resetRound(x, facing) {
    this.x = x;
    this.y = VIEW.GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.facing = facing;
    this.health = RULES.maxHealth;
    this.state = 'idle';
    this.t = 0; // frames spent in the current state
    this.attack = null; // { def, kind, hit }
    this.cooldown = 0;
    this.blockstun = 0;
    this.crouching = false;
    this.airAttackUsed = false;
    this.stun = null; // hitstun info { left, knockdown, phase }
    this.invuln = 0;
    this.scale = BODY.SCALE;
    this.costume = null; // sprite variant during specials (hat, prop, ...)
    this.sd = {}; // scratch data for the running special
    this.flash = 0; // white flash frames after being hit
    this.held = false; // being grabbed (position controlled by someone else)
    this.noPush = false;
    this.gravityScale = 1;
    this.friction = true;
    this.combo = 0;
    this.frozen = 0; // cosmetic "frozen" tint frames (Yair's AC)
    this.squish = 0; // cosmetic squeeze (Yaara's hug)
    this.poolDone = false; // grown-up mode: the pool of blood under a knocked-out fighter has been started
    this.wounds = []; // grown-up mode: cuts and bruises drawn on the body (battle-render.js)
    this.gore = null; // fatality: how the victim is drawn (pieces, squash, ...), see game/fatalities/kit.js
    this.fpose = null; // fatality: { pose, frame } while state === 'fatal'
    this.prevIn = NO_INPUT;
    this.in = NO_INPUT;
  }

  // ---- helpers -------------------------------------------------------------
  go(state) {
    if (this.state !== state) {
      this.state = state;
      this.t = 0;
    }
  }
  pressed(k) {
    return this.in[k] && !this.prevIn[k];
  }
  /** -1, 0 or 1 from left/right input. */
  dirX() {
    return (this.in.right ? 1 : 0) - (this.in.left ? 1 : 0);
  }
  get meterFull() {
    return this.meter >= RULES.meterMax;
  }
  isCrouchy() {
    return (
      this.state === 'crouch' ||
      (this.state === 'block' && this.crouching) ||
      (this.state === 'attack' && this.attack?.kind === 'crouch') ||
      (this.state === 'hitstun' && this.crouching && this.grounded)
    );
  }
  /** Body height used by pushboxes. */
  height() {
    return (this.isCrouchy() ? 52 : 78) * this.scale;
  }
  /** Is this fighter currently "attacking" (used by the CPU to react). */
  isAttacking() {
    return this.state === 'attack' || (this.state === 'special' && this.t >= this.special.windup);
  }
  attackPhase() {
    if (this.state !== 'attack') return null;
    const a = this.attack.def;
    if (this.t < a.startup) return 'startup';
    if (this.t < a.startup + a.active) return 'active';
    return 'recovery';
  }

  // ---- main update ---------------------------------------------------------
  /**
   * Advance one frame.
   * @param {object} input  InputState for this frame
   * @param {Battle} b      the battle (world)
   */
  update(input, b) {
    this.prevIn = this.in;
    this.in = input || NO_INPUT;
    this.t++;
    if (this.cooldown > 0) this.cooldown--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.frozen > 0) this.frozen--;
    if (this.squish > 0 && !this.held) this.squish--;
    this.friction = true;

    const opp = b.opponentOf(this);
    switch (this.state) {
      case 'idle':
      case 'walk':
      case 'crouch':
        this.neutral(b, opp);
        break;
      case 'block':
        this.updateBlock(b, opp);
        break;
      case 'jump':
        this.updateJump(b);
        break;
      case 'attack':
        this.updateAttack(b, opp);
        break;
      case 'hitstun':
        this.updateHitstun(b);
        break;
      case 'special':
        this.updateSpecial(b, opp);
        break;
      case 'ko':
        if (this.grounded && this.t > 4) this.vx *= 0.8;
        break;
      case 'win':
        this.vx = 0;
        break;
      case 'fatal':
        break; // a fatality moves us (held = true)
    }

    if (!this.held) stepBody(this);
    if (this.justLanded) b.event('land', { f: this });

    // Auto-turn toward the opponent whenever we're on the ground and free.
    if (NEUTRAL.has(this.state) && this.grounded && this.blockstun <= 0) this.faceOpponent(opp);
  }

  faceOpponent(opp) {
    const dx = opp.x - this.x;
    if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
  }

  // ---- states ----------------------------------------------------------------
  /** Grounded neutral: decide what to do from the input. */
  neutral(b, opp) {
    const i = this.in;
    if (this.pressed('special') && this.meterFull) return this.startSpecial(b);
    if (this.pressed('attack') && this.cooldown <= 0) return this.startAttack(i.down ? 'crouch' : 'stand', b);
    if (i.up) return this.startJump(b);
    if (i.defend) {
      this.go('block');
      this.crouching = i.down;
      this.vx = 0;
      return;
    }
    if (i.down) {
      this.go('crouch');
      this.vx = 0;
      return;
    }
    const d = this.dirX();
    if (d) {
      this.go('walk');
      this.friction = false;
      const fwd = d === this.facing;
      this.vx = d * (fwd ? PHYS.walkFwd : PHYS.walkBack) * this.stats.speed;
    } else {
      this.go('idle');
      if (Math.abs(this.vx) < 1) this.vx = 0;
    }
  }

  startJump(b) {
    this.go('jump');
    this.vy = -PHYS.jumpVel * this.stats.jump;
    this.vx = this.dirX() * PHYS.jumpVx * this.stats.speed;
    this.grounded = false;
    this.airAttackUsed = false;
    this.friction = false;
    b.event('jump', { f: this });
  }

  updateJump(b) {
    this.friction = false;
    if (this.pressed('attack') && !this.airAttackUsed) {
      this.airAttackUsed = true;
      return this.startAttack('air', b);
    }
    if (this.grounded && this.t > 1) {
      this.go('idle');
      this.vx = 0;
    }
  }

  startAttack(kind, b) {
    const base = ATTACKS[kind];
    // Reach stat lengthens the hitbox a little.
    const def = { ...base, box: { ...base.box, w: base.box.w + this.stats.reach } };
    this.attack = { def, kind, hit: false };
    this.go('attack');
    this.t = 0;
    if (kind !== 'air') this.vx = 0;
    this.crouching = kind === 'crouch';
    b.event('swing', { f: this, kind });
  }

  updateAttack(b, opp) {
    const a = this.attack.def;
    const kind = this.attack.kind;
    if (kind === 'air') {
      this.friction = false;
      if (this.grounded) {
        // Landing ends an air attack.
        this.go('idle');
        this.vx = 0;
        this.cooldown = a.cooldown;
        return;
      }
      if (this.t >= a.startup + a.active) {
        this.state = 'jump'; // keep falling, attack spent
        return;
      }
      return;
    }
    const total = a.startup + a.active + a.recovery;
    if (this.t >= total) {
      this.cooldown = a.cooldown;
      this.go(kind === 'crouch' && this.in.down ? 'crouch' : 'idle');
      this.neutral(b, opp);
    }
  }

  /** The active hitbox of a normal attack (world space), or null. */
  activeHitbox() {
    if (this.state !== 'attack' || this.attack.hit) return null;
    if (this.attackPhase() !== 'active') return null;
    return toWorld(this, this.attack.def.box);
  }

  updateBlock(b, opp) {
    this.vx *= 0.85;
    if (this.blockstun > 0) {
      this.blockstun--;
      this.crouching = this.in.down; // you may switch high/low while blocking
      return;
    }
    if (this.pressed('special') && this.meterFull) return this.startSpecial(b);
    if (!this.in.defend) return this.neutral(b, opp);
    this.crouching = this.in.down;
  }

  updateHitstun(b) {
    const s = this.stun;
    if (this.held) return; // grabbed: someone else moves us
    if (s.phase === 'air') {
      this.friction = false;
      if (this.grounded) {
        if (s.knockdown) {
          s.phase = 'down';
          s.left = 36;
          this.invuln = 36 + 18;
          this.vx *= 0.3;
          b.event('thud', { f: this });
        } else {
          s.phase = 'stun';
          s.left = 4;
        }
      }
      return;
    }
    s.left--;
    if (s.left > 0) return;
    if (s.phase === 'down') {
      s.phase = 'getup';
      s.left = 18;
      return;
    }
    // Recovered
    this.stun = null;
    if (s.phase === 'getup') this.invuln = Math.max(this.invuln, 6);
    this.go(this.in.down ? 'crouch' : 'idle');
    this.combo = 0;
  }

  // ---- getting hit / blocking -----------------------------------------------
  /** Can we block an attack with this guard type right now? */
  canBlock(guard) {
    if (guard === 'unblockable') return false;
    if (this.state !== 'block' || !this.grounded) return false;
    if (guard === 'low') return this.crouching;
    if (guard === 'high') return !this.crouching;
    return true;
  }

  /** Called by Battle when a hit is blocked. */
  blockHit(hit, dir) {
    this.blockstun = hit.blockstun ?? 10;
    this.vx = dir * (hit.push ?? 3) * 0.9;
    this.flash = 0;
  }

  /** Called by Battle when a hit connects (damage is already applied). */
  takeHit(hit, dir, b) {
    this.flash = 5;
    if (this.state === 'special') this.endSpecial(b, true);
    const wasCrouchy = this.isCrouchy();
    this.attack = null;
    this.blockstun = 0;
    if (this.health <= 0) return this.knockOut(dir);
    this.go('hitstun');
    this.t = 0;
    this.crouching = wasCrouchy && !hit.knockdown;
    this.stun = { left: hit.hitstun ?? 16, knockdown: !!hit.knockdown, phase: 'stun' };
    this.vx = dir * (hit.push ?? 3);
    if (hit.knockdown || hit.launch || !this.grounded) {
      this.vy = -(hit.launch ?? (hit.knockdown ? 5.5 : 3.5));
      this.grounded = false;
      this.stun.phase = 'air';
      this.stun.knockdown = !!hit.knockdown || this.stun.knockdown;
      if (hit.knockdown) this.vx = dir * Math.max(hit.push ?? 3, 3.2);
    }
  }

  knockOut(dir) {
    this.health = 0;
    this.go('ko');
    this.held = false;
    this.vy = -6.5;
    this.vx = dir * 3.6;
    this.grounded = false;
    this.invuln = 99999;
    this.scale = BODY.SCALE;
    this.costume = null;
  }

  // ---- special attack ----------------------------------------------------------
  startSpecial(b) {
    this.meter = 0;
    this.go('special');
    this.t = 0;
    this.vx = 0;
    this.sd = {};
    this.attack = null;
    this.crouching = false;
    this.costume = typeof this.special.costume === 'function' ? null : this.special.costume || null;
    b.superFreeze(this, this.special.windup);
    this.special.start?.(this, b);
    b.event('special', { f: this });
  }

  updateSpecial(b, opp) {
    const sp = this.special;
    if (typeof sp.costume === 'function') this.costume = sp.costume(this, this.t);
    sp.update?.(this, b, this.t, opp);
    if (this.state !== 'special') return; // the special may have ended itself
    if (this.t >= sp.windup + sp.duration) this.endSpecial(b);
  }

  /** Finish (or cancel) the special and return to neutral. */
  endSpecial(b, interrupted = false) {
    this.special.end?.(this, b, interrupted);
    this.costume = null;
    this.scale = BODY.SCALE;
    this.noPush = false;
    this.gravityScale = 1;
    this.sd = {};
    if (interrupted) return;
    if (this.grounded) this.go('idle');
    else {
      this.go('jump');
      this.airAttackUsed = true;
    }
  }

  /** Invulnerable right now? (special, wake-up, KO) */
  isInvulnerable() {
    return this.invuln > 0 || this.state === 'special' || this.state === 'ko' || this.state === 'fatal';
  }

  hurtbox() {
    if (this.state === 'ko' || this.state === 'fatal') return null;
    let box = HURT.stand;
    if (this.state === 'hitstun' && this.stun && (this.stun.phase === 'down' || this.stun.phase === 'getup')) box = HURT.lying;
    else if (!this.grounded) box = HURT.air;
    else if (this.isCrouchy()) box = HURT.crouch;
    return toWorld(this, box);
  }

  // ---- animation selection (read by the renderer) ------------------------------
  /** Which pose + frame to draw. Pure function of state; no rendering here. */
  anim() {
    const t = this.t;
    switch (this.state) {
      case 'idle':
        return { pose: 'idle', frame: Math.floor(t / 22) % 2 };
      case 'walk': {
        const f = Math.floor(t / 7) % 4;
        const back = this.vx * this.facing < 0;
        return { pose: 'walk', frame: back ? 3 - f : f };
      }
      case 'crouch':
        return { pose: 'crouch', frame: 0 };
      case 'jump':
        return { pose: this.vy < -1.5 ? 'jumpUp' : 'jumpDown', frame: 0 };
      case 'attack': {
        const ph = this.attackPhase();
        const kind = this.attack.kind;
        const pose = kind === 'stand' ? 'punch' : kind === 'crouch' ? 'lowKick' : 'airKick';
        if (kind === 'air') return { pose, frame: ph === 'startup' ? 0 : 1 };
        const a = this.attack.def;
        const frame = ph === 'startup' ? 0 : ph === 'active' ? 1 : this.t < a.startup + a.active + a.recovery / 2 ? 1 : 2;
        return { pose, frame };
      }
      case 'block':
        return { pose: this.crouching ? 'crouchBlock' : 'block', frame: 0 };
      case 'hitstun': {
        const s = this.stun;
        if (this.held) return { pose: 'hit', frame: 1 };
        if (s.phase === 'down') return { pose: 'lying', frame: 0 };
        if (s.phase === 'getup') return { pose: 'crouch', frame: 0 };
        if (s.phase === 'air') return { pose: 'fall', frame: 0 };
        return { pose: this.crouching ? 'crouchHit' : 'hit', frame: t < 6 ? 0 : 1 };
      }
      case 'special':
        return this.special.anim ? this.special.anim(this, t) : { pose: 'cast', frame: 0 };
      case 'ko':
        return this.grounded && t > 10 ? { pose: 'lying', frame: 0 } : { pose: 'fall', frame: 0 };
      case 'win':
        return { pose: 'win', frame: Math.floor(t / 14) % 2 };
      case 'fatal':
        return this.fpose || { pose: 'idle', frame: 0 };
    }
    return { pose: 'idle', frame: 0 };
  }
}
