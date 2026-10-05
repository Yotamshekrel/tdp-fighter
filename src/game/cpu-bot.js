// ---------------------------------------------------------------------------
// CPU opponent: a classic scripted arcade bot. NOT machine learning, no
// network: just a little finite state machine + weighted dice rolls.
//
// It produces exactly the same InputState a keyboard would
//   { left, right, up, down, attack, defend, special }
// so a CPU-controlled fighter obeys the same rules as a human one.
//
// Layers, every frame:
//   1. Perception  - remember the opponent's state; react to what it saw
//                    `reaction` frames ago (that's the "human" delay).
//   2. Reflexes    - block incoming attacks/projectiles, punish whiffs,
//                    anti-air jump-ins (each a dice roll vs difficulty).
//   3. Decisions   - every `tick` frames pick a plan from a weighted table
//                    based on distance (close / mid / far) and opponent state.
//   4. Output      - turn the current plan into held buttons / taps.
// ---------------------------------------------------------------------------
import { CPU_DIFFICULTY } from '../config.js';
import { rand, randInt, weighted } from './rng.js';

const CLOSE = 52;
const MID = 140;

export class CpuBot {
  constructor(difficulty = 'normal') {
    this.setDifficulty(difficulty);
    this.memory = [];
    this.tick = 0;
    this.plan = 'wait';
    this.planLeft = 0;
    this.taps = { attack: 0, special: 0, up: 0 };
    this.blockUntil = 0;
    this.blockLow = false;
    this.rolled = new Set(); // threat ids we already rolled dice for
    this.blocking = new Set(); // threat ids we decided to block
    this.lastFrame = -1;
  }

  setDifficulty(d) {
    this.difficulty = CPU_DIFFICULTY[d] ? d : 'normal';
    this.cfg = CPU_DIFFICULTY[this.difficulty];
  }

  /** Called by the Battle once per frame. */
  read(b, me, opp) {
    const cfg = this.cfg;
    const frame = b.frame;
    if (frame === this.lastFrame) return this.out;
    this.lastFrame = frame;

    // ---- 1. perception ----------------------------------------------------
    this.memory.push(this.snapshot(b, me, opp));
    if (this.memory.length > 64) this.memory.shift();
    const seen = this.memory[Math.max(0, this.memory.length - 1 - cfg.reaction)];
    const dist = Math.abs(opp.x - me.x);
    const toward = opp.x > me.x ? 'right' : 'left';
    const away = toward === 'right' ? 'left' : 'right';
    const out = { left: false, right: false, up: false, down: false, attack: false, defend: false, special: false };

    // Can't do anything useful while stunned or mid-special; keep memory fresh.
    const busy = me.state === 'hitstun' || me.state === 'special' || me.state === 'ko' || me.state === 'win';
    if (busy || !b.live) {
      this.out = out;
      return out;
    }

    // ---- 2. reflexes ----------------------------------------------------------
    // 2a. Incoming threats: an attack the bot has "seen", or a projectile.
    const threat = this.findThreat(b, me, opp, seen);
    if (threat && !this.rolled.has(threat.id)) {
      this.rolled.add(threat.id);
      if (this.rolled.size > 200) { this.rolled.clear(); this.blocking.clear(); }
      if (rand() < cfg.blockChance) {
        this.blocking.add(threat.id);
        this.blockUntil = frame + threat.hold;
        this.blockLow = threat.low;
      }
    } else if (threat && this.blocking.has(threat.id)) {
      // Decided to block this one: keep guarding (at the right height) while it lasts.
      this.blockUntil = Math.max(this.blockUntil, frame + 6);
      this.blockLow = threat.low;
    }
    // 2a'. Grab specials can't be blocked: jump out (same dice as blocking).
    if (seen.special && opp.special.escape === 'jump' && seen.dist < 240 && !this.rolled.has('j' + (b.frame - opp.t))) {
      this.rolled.add('j' + (b.frame - opp.t));
      if (rand() < cfg.blockChance && me.grounded) {
        this.blockUntil = 0;
        this.setPlan('escape', 12);
      }
    }
    // 2b. Punish a whiffed attack that is now recovering.
    if (seen.recovering && seen.dist < CLOSE + 8 && !this.rolled.has('p' + seen.attackId)) {
      this.rolled.add('p' + seen.attackId);
      if (rand() < cfg.punishChance) {
        this.blockUntil = 0;
        this.setPlan(me.meterFull && rand() < cfg.specialChance && this.inSpecialRange(me, dist) ? 'special' : 'attack', 4);
      }
    }
    // 2c. Anti-air: opponent jumping in at us.
    if (seen.airborne && seen.closing && seen.dist < 110 && !this.rolled.has('aa' + seen.jumpId)) {
      this.rolled.add('aa' + seen.jumpId);
      if (rand() < cfg.antiAir) {
        if (rand() < 0.5) {
          this.blockUntil = frame + 22;
          this.blockLow = false;
        } else this.setPlan('retreat', 14);
      }
    }

    if (this.blockUntil > frame && me.grounded) {
      out.defend = true;
      out.down = this.blockLow;
      this.out = out;
      this.stepTaps(out);
      return out;
    }

    // ---- 3. decisions -------------------------------------------------------
    if (--this.tick <= 0) {
      this.tick = randInt(cfg.tick[0], cfg.tick[1]);
      this.decide(b, me, opp, seen, dist);
    }

    // ---- 4. plan -> buttons ---------------------------------------------------
    this.planLeft--;
    switch (this.plan) {
      case 'approach':
        out[toward] = true;
        if (dist < CLOSE - 10) this.plan = 'wait';
        break;
      case 'retreat':
        out[away] = true;
        break;
      case 'escape':
        out.up = this.planLeft > 6;
        out[away] = true;
        break;
      case 'jumpIn':
        if (me.grounded && this.planLeft > 8) {
          out.up = true;
          out[toward] = true;
        }
        if (!me.grounded && dist < 56 && !me.airAttackUsed) this.tap('attack');
        break;
      case 'attack':
        if (dist > CLOSE + 4) out[toward] = true;
        else this.tap('attack');
        this.plan = dist > CLOSE + 4 ? 'attack' : 'wait';
        break;
      case 'crouchAttack':
        out.down = true;
        if (dist > CLOSE + 6) {
          out.down = false;
          out[toward] = true;
        } else {
          this.tap('attack');
          this.plan = 'crouchHold';
          this.planLeft = 10;
        }
        break;
      case 'crouchHold':
        out.down = true;
        break;
      case 'block':
        out.defend = true;
        out.down = opp.isCrouchy();
        break;
      case 'special':
        this.tap('special');
        this.plan = 'wait';
        break;
      case 'wait':
      default:
        break;
    }
    if (this.planLeft <= 0 && this.plan !== 'wait' && this.plan !== 'attack') this.plan = 'wait';

    this.stepTaps(out);
    this.out = out;
    return out;
  }

  setPlan(plan, frames) {
    this.plan = plan;
    this.planLeft = frames;
  }

  /** Press a button for 2 frames (after a 1-frame release so it registers). */
  tap(k) {
    if (this.taps[k] <= 0) this.taps[k] = 3;
  }
  stepTaps(out) {
    for (const k in this.taps) {
      if (this.taps[k] > 0) {
        out[k] = this.taps[k] <= 2;
        this.taps[k]--;
      }
    }
  }

  inSpecialRange(me, dist) {
    const r = me.special.aiRange || [0, 999];
    return dist >= r[0] && dist <= r[1];
  }

  /** Weighted-random plan selection: the heart of the bot. */
  decide(b, me, opp, seen, dist) {
    const cfg = this.cfg;
    const rate = cfg.attackRate;

    if (me.meterFull && this.inSpecialRange(me, dist) && rand() < cfg.specialChance * 0.6) {
      return this.setPlan('special', 4);
    }
    if (rand() < cfg.sloppiness) {
      return this.setPlan(weighted({ approach: 1, retreat: 1, jumpIn: 1, wait: 1, attack: 1 }), randInt(10, 30));
    }

    let w;
    if (dist <= CLOSE) {
      w = { attack: 50 * rate, block: 25, crouchAttack: 15 * rate, retreat: 10 };
      if (seen.blocking) { w.crouchAttack += 25 * rate; w.attack -= 15; } // try to open them up low
      if (seen.inHitstun) w.attack += 40;
      if (seen.crouching) w.crouchAttack += 10;
    } else if (dist <= MID) {
      w = { approach: 45, jumpIn: 15 * rate, block: 15, retreat: 10, wait: 15 };
      if (seen.attacking) { w.block += 20; w.approach -= 20; }
      if (seen.recovering) { w.approach += 30; }
    } else {
      w = { approach: 60, jumpIn: 20 * rate, wait: 15, retreat: 5 };
    }
    // Low health? play a bit safer.
    if (me.health < 30) { w.block = (w.block || 0) + 10; w.retreat = (w.retreat || 0) + 5; }
    const plan = weighted(w);
    const frames = { approach: randInt(12, 30), retreat: randInt(8, 20), jumpIn: 26, attack: 6, crouchAttack: 8, block: randInt(14, 26), wait: randInt(6, 16) }[plan];
    this.setPlan(plan, frames);
  }

  /** What the bot can observe about the opponent this frame. */
  snapshot(b, me, opp) {
    const dist = Math.abs(opp.x - me.x);
    const phase = opp.attackPhase();
    return {
      dist,
      attacking: opp.isAttacking() && phase !== 'recovery',
      recovering: phase === 'recovery',
      attackId: opp.state === 'attack' ? b.frame - opp.t : -1,
      attackKind: opp.attack?.kind,
      special: opp.state === 'special',
      airborne: !opp.grounded,
      closing: Math.sign(opp.vx) === Math.sign(me.x - opp.x),
      jumpId: opp.state === 'jump' || opp.state === 'attack' ? b.frame - opp.t : -1,
      inHitstun: opp.state === 'hitstun',
      blocking: opp.state === 'block',
      crouching: opp.isCrouchy(),
    };
  }

  /** Something about to hit us? Returns { id, low, hold } or null. */
  findThreat(b, me, opp, seen) {
    if (seen.attacking && seen.dist < 76 && seen.attackId >= 0) {
      return { id: 'a' + seen.attackId, low: seen.attackKind === 'crouch', hold: 20 };
    }
    if (seen.special && seen.dist < 220 && opp.special.escape !== 'jump') {
      return { id: 's' + (b.frame - opp.t - this.cfg.reaction), low: opp.special.guard === 'low', hold: 30 };
    }
    for (const e of b.entities) {
      if (e.owner !== opp || !e.hit || !e.active || e.hits >= e.maxHits) continue;
      if (e.t < this.cfg.reaction) continue; // hasn't "noticed" it yet
      const dx = me.x - e.x;
      const coming = e.vx === 0 || Math.sign(e.vx) === Math.sign(dx);
      if (coming && Math.abs(dx) < 120 + Math.abs(e.w) / 2) {
        return { id: 'e' + e.id, low: e.hit.guard === 'low', hold: 24 };
      }
    }
    return null;
  }
}
