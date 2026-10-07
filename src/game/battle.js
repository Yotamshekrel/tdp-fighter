// ---------------------------------------------------------------------------
// Battle: the fight "world". Owns both fighters, entities, particles, the
// round/match flow (intro -> fight -> KO / time over -> next round) and all
// hit resolution (hit-stop, block, chip, knockback, meter, KO).
//
// It has no rendering code and no DOM access, so it can be simulated headless
// (see scripts/simulate.mjs). Things the renderer/audio care about are pushed
// to `this.events` each frame.
// ---------------------------------------------------------------------------
import { VIEW, RULES } from '../config.js';
import { Fighter, NO_INPUT } from './fighter.js';
import { overlap } from './collision.js';
import { resolvePush } from './physics.js';
import { Fx } from '../render/effects.js';

export const START_X = [150, 330];

export class Battle {
  /**
   * @param {object} o
   * @param {object[]} o.chars        two character definitions
   * @param {object[]} o.controllers  two controllers with read(battle, me, opp) -> InputState
   * @param {object}   [o.arena]      arena definition (only used by the renderer)
   * @param {boolean}  [o.deterministic] online fights: the simulation must not depend on anything that was drawn
   */
  constructor({ chars, controllers, arena = null, deterministic = false }) {
    this.deterministic = deterministic;
    this.fighters = [new Fighter(chars[0], 0), new Fighter(chars[1], 1)];
    this.controllers = controllers;
    this.arena = arena;
    this.entities = [];
    this.fx = new Fx();
    this.events = [];
    this.frame = 0;
    this.hitstop = 0;
    this.freeze = { t: 0, owner: null, total: 0 }; // special "super freeze"
    this.shake = 0;
    this.flash = null; // { color, t, max }
    this.slowmo = 0;
    this.round = 1;
    this.phase = 'intro';
    this.phaseT = 0;
    this.timer = RULES.roundSeconds * 60;
    this.roundWinner = null; // fighter, or 'draw'
    this.matchWinner = undefined; // undefined = ongoing, null = draw, else fighter
    this.announce = null; // { text, t, kind } for banner rendering
    this.perfect = false;
    this.lastAttacker = null;
    this.stats = { specials: [0, 0], specialDamage: [0, 0], hits: [0, 0] };
    this.startRound();
  }

  opponentOf(f) {
    return this.fighters[1 - f.side];
  }

  event(type, data = {}) {
    this.events.push({ type, ...data });
  }
  /** A sound effect; x (optional) is where it happens, for stereo panning. */
  sfx(name, x) {
    this.events.push({ type: 'sfx', name, x });
  }

  startRound() {
    const [a, b] = this.fighters;
    a.resetRound(START_X[0], 1);
    b.resetRound(START_X[1], -1);
    this.entities = [];
    this.fx.clear();
    this.phase = 'intro';
    this.phaseT = 0;
    this.timer = RULES.roundSeconds * 60;
    this.roundWinner = null;
    this.freeze = { t: 0, owner: null, total: 0 };
    this.hitstop = 0;
    this.slowmo = 0;
    this.perfect = false;
  }

  /** Freeze everything except `owner` for `frames` (special wind-up). */
  superFreeze(owner, frames) {
    this.freeze = { t: frames, owner, total: frames };
    this.flash = { color: '#ffffff', t: 6, max: 6 };
  }

  addShake(n) {
    this.shake = Math.max(this.shake, n);
  }
  addFlash(color, t = 8) {
    this.flash = { color, t, max: t };
  }
  spawn(entity) {
    this.entities.push(entity);
    return entity;
  }

  /** Is the round live (players can act)? */
  get live() {
    return this.phase === 'fight';
  }

  // -------------------------------------------------------------------------
  update() {
    this.events.length = 0;
    this.frame++;
    this.fx.update();
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6);
    if (this.flash && --this.flash.t <= 0) this.flash = null;

    // Read inputs every frame (lets the CPU keep its short-term memory fresh).
    const inputs = this.fighters.map((f, i) => {
      const inp = this.controllers[i]?.read(this, f, this.opponentOf(f)) || NO_INPUT;
      return this.live ? inp : NO_INPUT;
    });

    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }
    if (this.freeze.t > 0) {
      this.freeze.t--;
      const o = this.freeze.owner;
      o.update(inputs[o.side], this);
      return;
    }
    if (this.slowmo > 0) {
      this.slowmo--;
      if (this.slowmo % 3 !== 0) return;
    }

    this.updatePhase();

    for (let i = 0; i < 2; i++) this.fighters[i].update(inputs[i], this);
    this.updateEntities();
    this.resolveNormalHits();
    resolvePush(this.fighters[0], this.fighters[1]);
    this.checkKO();
  }

  updatePhase() {
    this.phaseT++;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT === 1) {
          this.announce = { text: `ROUND ${this.round}`, t: 0, kind: 'round' };
          this.event('round', { n: this.round });
        }
        if (this.phaseT === 75) {
          this.announce = { text: 'FIGHT!', t: 0, kind: 'fight' };
          this.event('fight');
        }
        if (this.phaseT >= 110) {
          this.phase = 'fight';
          this.phaseT = 0;
          this.announce = null;
        }
        break;
      case 'fight':
        if (this.timer > 0) this.timer--;
        if (this.timer <= 0) this.endRound('time');
        break;
      case 'ko':
      case 'time': {
        // Wait for KO'd fighter to land and any special to finish, then pose.
        const busy = this.fighters.some((f) => f.state === 'special' || f.state === 'attack');
        if (this.phaseT > 70 && !busy && !this.posed) {
          this.posed = true;
          const w = this.roundWinner;
          if (w && w !== 'draw') {
            w.go('win');
            w.vx = 0;
            this.announce = {
              text: this.perfect ? 'PERFECT!' : `${w.def.name} WINS`,
              t: 0, kind: 'wins',
            };
            this.event('roundWin', { f: w });
          } else {
            this.announce = { text: 'DRAW', t: 0, kind: 'wins' };
          }
        }
        if (this.phaseT > 210) this.nextRound();
        break;
      }
      case 'matchEnd':
        break;
    }
    if (this.announce) this.announce.t++;
  }

  endRound(reason) {
    const [a, b] = this.fighters;
    this.phase = reason === 'time' ? 'time' : 'ko';
    this.phaseT = 0;
    this.posed = false;
    if (reason === 'time') {
      this.announce = { text: 'TIME OVER', t: 0, kind: 'ko' };
      const pa = a.health / RULES.maxHealth, pb = b.health / RULES.maxHealth;
      this.roundWinner = Math.abs(pa - pb) < 0.001 ? 'draw' : pa > pb ? a : b;
      this.event('timeover');
    } else {
      this.announce = { text: 'K.O.', t: 0, kind: 'ko' };
      if (a.health <= 0 && b.health <= 0) this.roundWinner = 'draw';
      else this.roundWinner = a.health <= 0 ? b : a;
      this.slowmo = 60;
      this.addShake(6);
      this.addFlash('#ffffff', 10);
      this.event('ko');
    }
    const w = this.roundWinner;
    if (w && w !== 'draw') {
      w.roundWins++;
      this.perfect = w.health >= RULES.maxHealth;
    }
  }

  nextRound() {
    const [a, b] = this.fighters;
    const need = RULES.roundsToWin;
    if (a.roundWins >= need || b.roundWins >= need || this.round >= 6) {
      this.phase = 'matchEnd';
      this.phaseT = 0;
      this.matchWinner = a.roundWins === b.roundWins ? null : a.roundWins > b.roundWins ? a : b;
      this.event('matchEnd', { winner: this.matchWinner });
      return;
    }
    this.round++;
    this.startRound();
  }

  checkKO() {
    if (this.phase !== 'fight') return;
    if (this.fighters.some((f) => f.health <= 0)) this.endRound('ko');
  }

  // -------------------------------------------------------------------------
  updateEntities() {
    const E = this.entities;
    for (const e of E) {
      if (e.dead) continue;
      e.update(this);
      if (e.dead || !e.active || !e.hit || e.hits >= e.maxHits) continue;
      if (e.t - e.lastHitT < e.hitEvery) continue;
      const target = this.opponentOf(e.owner);
      const hb = target.hurtbox();
      const box = e.box();
      if (!hb || !overlap(box, hb)) continue;
      const last = e.hits === e.maxHits - 1;
      const hit = last && e.finalHit ? { ...e.hit, ...e.finalHit } : e.hit;
      const px = Math.max(box.x, hb.x) + (Math.min(box.x + box.w, hb.x + hb.w) - Math.max(box.x, hb.x)) / 2;
      const py = Math.max(box.y, hb.y) + (Math.min(box.y + box.h, hb.y + hb.h) - Math.max(box.y, hb.y)) / 2;
      const res = this.resolveHit(e.owner, target, hit, e.x - e.vx * 3, px, py);
      if (res) {
        e.hits++;
        e.lastHitT = e.t;
        e.onHit?.(e, this, target, res);
        if (e.dieOnHit && e.hits >= e.maxHits) e.dead = true;
      }
    }
    // Projectile clashes
    for (let i = 0; i < E.length; i++) {
      const p = E[i];
      if (!p.clash || p.dead) continue;
      for (let j = i + 1; j < E.length; j++) {
        const q = E[j];
        if (!q.clash || q.dead || q.owner === p.owner) continue;
        if (overlap(p.box(), q.box())) {
          p.dead = q.dead = true;
          this.fx.burst('spark', (p.x + q.x) / 2, (p.y + q.y) / 2, 20, { colors: ['#fff', '#ffe066', '#ff7b00'], speed: 4 });
          this.sfx('clash', (p.x + q.x) / 2);
        }
      }
    }
    this.entities = E.filter((e) => !e.dead);
  }

  /** Normal attacks: gather both fighters' hits first so trades are fair. */
  resolveNormalHits() {
    const hits = [];
    for (const f of this.fighters) {
      const hb = f.activeHitbox();
      if (!hb) continue;
      const opp = this.opponentOf(f);
      const hurt = opp.hurtbox();
      if (hurt && overlap(hb, hurt)) hits.push([f, opp, hb, hurt, f.attack.def]);
    }
    for (const [f] of hits) f.attack.hit = true; // mark first: a trade may cancel the other's attack
    for (const [f, opp, hb, hurt, def] of hits) {
      const px = f.facing > 0 ? Math.min(hb.x + hb.w, hurt.x + 4) : Math.max(hb.x, hurt.x + hurt.w - 4);
      const py = Math.max(hb.y, hurt.y) + Math.min(hb.h, 10) / 2;
      this.resolveHit(f, opp, def, f.x, px, py);
    }
  }

  /**
   * Apply a hit from `attacker` to `defender`.
   * hit: { damage, guard, hitstun, blockstun, push, hitstop, knockdown, launch,
   *        special, chip, shake, sfx }
   * Returns 'hit', 'block' or null (whiffed: invulnerable).
   */
  resolveHit(attacker, defender, hit, srcX, px = defender.x, py = defender.y - 40) {
    if (defender.isInvulnerable() && !hit.ignoreInvuln) return null;
    const dir = Math.sign(defender.x - srcX) || attacker.facing;

    if (defender.canBlock(hit.guard)) {
      const chip = hit.chip ?? (hit.special ? RULES.specialChip : RULES.blockChip);
      defender.health = Math.max(0, defender.health - hit.damage * chip);
      defender.blockHit(hit, dir);
      defender.meter = Math.min(RULES.meterMax, defender.meter + RULES.meterPerBlock);
      attacker.meter = Math.min(RULES.meterMax, attacker.meter + 1);
      this.hitstop = Math.max(this.hitstop, Math.ceil((hit.hitstop ?? 6) * 0.6));
      this.fx.burst('plus', px, py, 6, { color: '#9fe8ff', speed: 2.2, life: 12, size: 3 });
      this.fx.spawn('ring', px, py, { size: 2, grow: 0.7, life: 9, color: '#9fe8ff' });
      this.event('block', { f: defender, special: !!hit.special });
      if (hit.special) this.stats.specialDamage[attacker.side] += hit.damage * chip;
      if (defender.health <= 0) defender.takeHit(hit, dir, this);
      return 'block';
    }

    const dmg = hit.damage;
    const comboing = defender.state === 'hitstun';
    defender.health = Math.max(0, defender.health - dmg);
    attacker.meter = Math.min(RULES.meterMax, attacker.meter + dmg * RULES.meterPerDamageDealt);
    defender.meter = Math.min(RULES.meterMax, defender.meter + dmg * RULES.meterPerDamageTaken);
    defender.takeHit(hit, dir, this);
    attacker.combo = comboing ? attacker.combo + 1 : 1;
    this.lastAttacker = attacker;
    this.stats.hits[attacker.side]++;
    if (hit.special) this.stats.specialDamage[attacker.side] += dmg;

    this.hitstop = Math.max(this.hitstop, hit.hitstop ?? 6);
    const big = dmg >= 9 || hit.knockdown;
    if (hit.shake || big) this.addShake(hit.shake ?? 4);
    this.fx.burst('spark', px, py, big ? 14 : 8, { colors: ['#fff', '#ffe066', '#ff9b3d'], speed: big ? 4 : 3, life: 14, size: 3 });
    this.fx.spawn('ring', px, py, { size: 3, grow: 0.9, life: 10, color: '#fff' });
    this.fx.spawn('flare', px, py, { size: big ? 15 : 10, grow: 0.5, life: big ? 11 : 8, color: big ? '#ffd27a' : '#ffffff' });
    this.event('hit', { f: defender, attacker, big, sfx: hit.sfx, special: !!hit.special });
    return 'hit';
  }
}
