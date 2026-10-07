// Online play test: two simulated computers run the same fight through the real Lockstep over a
// lossy, laggy, jittery link, with different input delays. They must stay frame-for-frame identical
// to each other AND to a single reference fight fed the same inputs, for every fighter's special.
//
//   node scripts/test-lockstep.mjs            (all fighters, a couple of matches each)
//   node scripts/test-lockstep.mjs 1          (matches per fighter)
import { Battle } from '../src/game/battle.js';
import { CHARACTERS } from '../src/data/characters.js';
import { seed, getState, setState } from '../src/game/rng.js';
import { resetEntityIds } from '../src/game/entities.js';
import { Lockstep, packInput, stateHash } from '../src/net/lockstep.js';

const perChar = Number(process.argv[2] || 2);
const MAX_FRAMES = 60 * 60 * 12;

// Deterministic scripted "player": holds a few buttons, changes its mind every few frames.
function script(playerSeed, n) {
  let s = playerSeed >>> 0;
  const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const out = [];
  let held = 0;
  for (let i = 0; i < n; i++) {
    if (i % 6 === 0) {
      held = 0;
      if (next() < 0.55) held |= next() < 0.5 ? 1 : 2; // left / right
      if (next() < 0.12) held |= 4; // up
      if (next() < 0.1) held |= 8; // down
      if (next() < 0.4) held |= 16; // attack
      if (next() < 0.2) held |= 32; // defend
      if (next() < 0.25) held |= 64; // special
    }
    out.push(held);
  }
  return out;
}

/** Each simulated computer keeps its own random-number state (they are separate processes in real life). */
class Peer {
  constructor(side, delay, matchSeed, chars, wire) {
    this.side = side;
    this.rng = matchSeed;
    this.inputs = script(1000 + side * 77 + matchSeed, MAX_FRAMES);
    this.used = 0;
    this.hashes = [];
    this.specials = 0;
    this.ls = new Lockstep({ side, delay, match: matchSeed, send: wire });
    const keep = getState();
    seed(matchSeed);
    resetEntityIds();
    this.battle = new Battle({ chars, controllers: [this.ls.controller(0), this.ls.controller(1)], deterministic: true });
    this.rng = getState();
    setState(keep);
  }
  /** One 60 Hz tick of this computer. Returns true if the Battle advanced. */
  tick() {
    this.ls.flush();
    if (!this.ls.ready()) return false;
    this.ls.sample(this.inputs[this.used++]);
    const keep = getState();
    setState(this.rng);
    this.battle.update();
    this.specials += this.battle.events.filter((e) => e.type === 'special').length;
    this.rng = getState();
    setState(keep);
    this.ls.advance();
    this.hashes[this.battle.frame] = stateHash(this.battle);
    return true;
  }
}

function runLockstep(chars, matchSeed, link) {
  const queue = []; // { due, to, pkt }
  let now = 0;
  const lcg = (() => { let s = matchSeed ^ 0xabcdef; return () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296); })();
  const wire = (from) => (pkt) => {
    if (lcg() < link.loss) return;
    queue.push({ due: now + link.base + Math.floor(lcg() * link.jitter), to: 1 - from, pkt: JSON.parse(JSON.stringify(pkt)) });
  };
  const peers = [new Peer(0, link.delays[0], matchSeed, chars, wire(0)), new Peer(1, link.delays[1], matchSeed, chars, wire(1))];
  let stalledTicks = 0;
  while ((peers[0].battle.matchWinner === undefined || peers[1].battle.matchWinner === undefined) && now < MAX_FRAMES * 6) {
    now++;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].due <= now) {
        const [q] = queue.splice(i, 1);
        peers[q.to].ls.receive(q.pkt);
      }
    }
    // the two computers' clocks are slightly different, so which one ticks first varies
    const order = now % 3 === 0 ? [1, 0] : [0, 1];
    let moved = false;
    for (const i of order) moved = peers[i].tick() || moved;
    stalledTicks = moved ? 0 : stalledTicks + 1;
    if (stalledTicks > 600) throw new Error('both sides stalled (deadlock)');
  }
  return { peers, ticks: now };
}

/** One computer fed the same inputs directly (no network): what the fight should look like. */
function runReference(chars, matchSeed, delays) {
  const scripts = [0, 1].map((side) => script(1000 + side * 77 + matchSeed, MAX_FRAMES));
  let key = 1;
  const read = (side) => ({ read: () => {
    const n = key - delays[side] - 1; // scripted step n lands `delay` frames later
    const m = n < 0 ? 0 : scripts[side][n];
    return Object.fromEntries(['left', 'right', 'up', 'down', 'attack', 'defend', 'special'].map((a, i) => [a, !!(m & (1 << i))]));
  } });
  const keep = getState();
  seed(matchSeed);
  resetEntityIds();
  const battle = new Battle({ chars, controllers: [read(0), read(1)], deterministic: true });
  const hashes = [];
  while (battle.matchWinner === undefined && key <= MAX_FRAMES) {
    battle.update();
    hashes[battle.frame] = stateHash(battle);
    key++;
  }
  setState(keep);
  return { battle, hashes };
}

const LINKS = [
  { name: 'clean', delays: [3, 3], base: 1, jitter: 1, loss: 0 },
  { name: 'lossy+jitter', delays: [3, 5], base: 3, jitter: 6, loss: 0.25 },
  { name: 'bad', delays: [4, 7], base: 6, jitter: 10, loss: 0.4 },
];

let failures = 0;
const t0 = Date.now();
for (let i = 0; i < CHARACTERS.length; i++) {
  for (let k = 0; k < perChar; k++) {
    const chars = [CHARACTERS[i], CHARACTERS[(i + 1 + k * 4) % CHARACTERS.length]];
    const matchSeed = 7000 + i * 31 + k;
    const link = LINKS[(i + k) % LINKS.length];
    const label = `${chars[0].id} vs ${chars[1].id} [${link.name}]`;
    try {
      const { peers, ticks } = runLockstep(chars, matchSeed, link);
      const [a, b] = peers;
      const ref = runReference(chars, matchSeed, link.delays);
      const frames = Math.min(a.battle.frame, b.battle.frame);
      let bad = -1;
      for (let f = 1; f <= frames; f++) if (a.hashes[f] !== b.hashes[f]) { bad = f; break; }
      if (bad < 0) for (let f = 1; f <= frames; f++) if (a.hashes[f] !== ref.hashes[f]) { bad = -f; break; }
      if (bad !== -1 && bad !== 0) throw new Error(bad > 0 ? `peers diverged at frame ${bad}` : `peer differs from reference at frame ${-bad}`);
      if (a.battle.matchWinner === undefined) throw new Error('match did not finish');
      const specials = a.specials;
      console.log(`ok  ${label}  ${frames} frames, ${ticks} ticks, specials ${specials}`);
    } catch (err) {
      failures++;
      console.log(`!!  ${label}: ${err.message}`);
    }
  }
}
console.log(`\n${failures ? `${failures} FAILED` : 'all in sync'} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
