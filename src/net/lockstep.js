// ---------------------------------------------------------------------------
// Input-delay lockstep for online fights. Both computers run the identical Battle; only the seven
// button states per frame travel between them.
//
//   - A button pressed now is applied `delay` frames later on BOTH computers, which gives the
//     network that long to deliver it. The first `delay` frames are blank on both sides.
//   - A frame only runs once both players' inputs for it are known (otherwise the fight waits).
//   - Packets are unreliable, so each one carries every input the other side has not yet confirmed
//     (`a` = "I have all of your frames up to here"). A lost packet is repaired by the next one.
//
// Pure logic (no DOM, no WebRTC): the tests drive it directly over a simulated lossy link.
// ---------------------------------------------------------------------------
const ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'defend', 'special'];
const MAX_WINDOW = 90; // never send more than this many frames in one packet

/** Seven buttons -> one small number. */
export function packInput(s) {
  let m = 0;
  for (let i = 0; i < ACTIONS.length; i++) if (s[ACTIONS[i]]) m |= 1 << i;
  return m;
}
const STATES = Array.from({ length: 1 << ACTIONS.length }, (_, m) => {
  const s = {};
  ACTIONS.forEach((a, i) => (s[a] = !!(m & (1 << i))));
  return Object.freeze(s);
});
export const unpackInput = (m) => STATES[m & 127];

/** How many frames of input delay this connection needs (one-way trip, plus a little slack). */
export function delayFor(rttMs) {
  const oneWay = (Number.isFinite(rttMs) ? rttMs : 80) / 2;
  return Math.max(3, Math.min(9, Math.ceil(oneWay / (1000 / 60)) + 2));
}

/** FNV-1a over the numbers that matter. Equal hashes on both computers = still in sync. */
export function stateHash(battle) {
  let h = 0x811c9dc5;
  const mix = (v) => {
    const n = Math.round(v * 100) | 0;
    for (let i = 0; i < 4; i++) { h ^= (n >> (i * 8)) & 255; h = Math.imul(h, 0x01000193); }
  };
  mix(battle.frame); mix(battle.round); mix(battle.timer); mix(battle.entities.length);
  for (const f of battle.fighters) { mix(f.x); mix(f.y); mix(f.vx); mix(f.vy); mix(f.health); mix(f.meter); mix(f.facing); }
  return h >>> 0;
}

export class Lockstep {
  /**
   * @param {object} o
   * @param {number} o.side     which fighter this computer's player controls (0 or 1)
   * @param {number} o.delay    input delay in frames
   * @param {number} o.match    id of this match; packets from another match are ignored
   * @param {(pkt: object) => void} o.send  puts a packet on the wire (may drop it)
   */
  constructor({ side, delay, match, send }) {
    this.side = side;
    this.delay = delay;
    this.match = match;
    this.send = send;
    this.key = 1; // the frame the Battle is about to run
    this.local = new Map();
    this.remote = new Map();
    for (let f = 1; f <= delay; f++) this.local.set(f, 0); // the opening frames are blank
    this.localLatest = delay;
    this.remoteHave = 0; // we hold every remote frame up to here
    this.peerAck = 0; // the other side holds every one of our frames up to here
    this.hashes = new Map();
    this.remoteHashes = new Map();
    this.desync = null; // frame of the first mismatch
  }

  /** Both players' inputs for the next frame are known. */
  ready() {
    return this.local.has(this.key) && this.remote.has(this.key);
  }

  /** Record this computer's buttons for the future frame (key + delay). Call once per frame that runs. */
  sample(mask) {
    this.local.set(++this.localLatest, mask);
  }

  /** The Battle ran a frame. */
  advance() {
    this.key++;
    const old = this.key - 150;
    if (old > 0) { this.local.delete(old); this.remote.delete(old); }
  }

  /** Call every tick, running or stalled: sends what the other side may be missing. */
  flush() {
    const first = Math.max(this.peerAck + 1, this.localLatest - MAX_WINDOW + 1, 1);
    const b = [];
    for (let f = first; f <= this.localLatest; f++) b.push(this.local.get(f) ?? 0);
    this.send({ m: this.match, a: this.remoteHave, f: first, b });
  }

  receive(pkt) {
    if (!pkt || pkt.m !== this.match || !Array.isArray(pkt.b)) return;
    for (let i = 0; i < pkt.b.length; i++) {
      const f = pkt.f + i;
      if (f > this.remoteHave && !this.remote.has(f)) this.remote.set(f, pkt.b[i] & 127);
    }
    while (this.remote.has(this.remoteHave + 1)) this.remoteHave++;
    if (pkt.a > this.peerAck) this.peerAck = pkt.a;
  }

  /** What the fighter on `side` is pressing in the frame being simulated. */
  inputFor(side) {
    return unpackInput((side === this.side ? this.local : this.remote).get(this.key) ?? 0);
  }

  /** A controller for Battle.controllers[side]. */
  controller(side) {
    return { read: () => this.inputFor(side) };
  }

  // ---- sync checking ---------------------------------------------------------------------------
  addHash(frame, h) {
    this.hashes.set(frame, h);
    this.compare(frame);
  }
  addRemoteHash(frame, h) {
    this.remoteHashes.set(frame, h);
    this.compare(frame);
  }
  compare(frame) {
    const a = this.hashes.get(frame), b = this.remoteHashes.get(frame);
    if (a === undefined || b === undefined) return;
    this.hashes.delete(frame);
    this.remoteHashes.delete(frame);
    if (a !== b && this.desync === null) this.desync = frame;
  }
}
