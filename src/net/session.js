// ---------------------------------------------------------------------------
// An online session: one WebRTC connection to the other player.
//
//   Session.host()      -> makes a room code; whoever types it in joins
//   Session.join(code)
//
// The room server only carries the handshake. After that two data channels go straight between the
// browsers: `ctl` (reliable: lobby, picks, rematch, ping) and `inp` (unreliable: fight inputs).
// The session outlives the scenes (menu -> character select -> fight -> results) and keeps the
// opponent's latest pick / start message so a scene that is not open yet loses nothing.
// ---------------------------------------------------------------------------
import { createRoom, joinRoom, sendSignal, pollSignals } from './signaling.js';

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const CONNECT_TIMEOUT = 30000; // ms from "someone joined" to an open channel
const WAIT_TIMEOUT = 10 * 60 * 1000; // a host waits this long for a friend
const SILENCE_LIMIT = 12000; // no message at all from the other side for this long = gone

export class Session {
  constructor(role) {
    this.role = role; // 'host' | 'guest'
    this.side = role === 'host' ? 0 : 1; // host fights on the left
    this.code = '';
    this.status = 'signaling'; // signaling | connecting | open | closed
    this.reason = ''; // why it closed
    this.rtt = NaN;
    this.remote = { cur: -1, locked: false }; // the opponent's character-select state
    this.start = null; // the host's "start the match" message, until a scene takes it
    this.remoteRematch = false;
    this.onHash = null;
    this.inputQueue = [];
    this.ls = null; // the Lockstep of the fight in progress
    this.lastSeen = 0;
    this.open = false;
    this._after = 0;
    this._chain = Promise.resolve();
    this._timers = [];
    this._pendingIce = [];
  }

  static async host() {
    const s = new Session('host');
    try {
      s.code = await createRoom();
    } catch (e) { s._close(e.message); return s; }
    s._poll();
    s._timers.push(setTimeout(() => s.status === 'signaling' && s._close('NOBODY JOINED'), WAIT_TIMEOUT));
    return s;
  }

  static async join(code) {
    const s = new Session('guest');
    s.code = code.toUpperCase();
    try {
      await joinRoom(s.code);
    } catch (e) { s._close(e.message); return s; }
    s.status = 'connecting';
    s._armConnectTimeout();
    s._poll();
    await sendSignal(s.code, 'guest', { t: 'hello' }).catch((e) => s._close(e.message));
    return s;
  }

  // ---- handshake -------------------------------------------------------------------------------
  _armConnectTimeout() {
    this._timers.push(setTimeout(() => this.status !== 'open' && this.status !== 'closed' && this._close('COULD NOT CONNECT (NETWORK BLOCKED?)'), CONNECT_TIMEOUT));
  }

  _poll() {
    const tick = async () => {
      if (this.open || this.status === 'closed') return;
      try {
        const msgs = await pollSignals(this.code, this.role, this._after);
        for (const { id, msg } of msgs) {
          this._after = Math.max(this._after, id);
          this._chain = this._chain.then(() => this._onSignal(msg)).catch((e) => { console.warn('[online] handshake error', e); this._close('HANDSHAKE FAILED'); });
        }
      } catch (e) {
        if (!this.open && this.status !== 'closed') this._close(e.message);
        return;
      }
      if (!this.open && this.status !== 'closed') this._pollTimer = setTimeout(tick, 600);
    };
    tick();
  }

  _makePeer() {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.pc = pc;
    pc.onicecandidate = (e) => e.candidate && sendSignal(this.code, this.role, { t: 'ice', c: e.candidate }).catch(() => {});
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this._close('CONNECTION FAILED (NETWORK BLOCKED?)');
      else if (pc.connectionState === 'closed' && this.open) this._close('CONNECTION LOST');
    };
    return pc;
  }

  async _onSignal(msg) {
    if (this.status === 'closed') return;
    console.debug('[online] signal', this.role, msg.t);
    if (this.role === 'host' && msg.t === 'hello' && !this.pc) {
      this.status = 'connecting';
      this._armConnectTimeout();
      const pc = this._makePeer();
      this._wire(pc.createDataChannel('ctl', { ordered: true }), 'ctl');
      this._wire(pc.createDataChannel('inp', { ordered: false, maxRetransmits: 0 }), 'inp');
      await pc.setLocalDescription(await pc.createOffer());
      await sendSignal(this.code, 'host', { t: 'offer', sdp: pc.localDescription });
    } else if (this.role === 'guest' && msg.t === 'offer' && !this.pc) {
      const pc = this._makePeer();
      pc.ondatachannel = (e) => this._wire(e.channel, e.channel.label);
      await pc.setRemoteDescription(msg.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      await sendSignal(this.code, 'guest', { t: 'answer', sdp: pc.localDescription });
      await this._flushIce();
    } else if (this.role === 'host' && msg.t === 'answer' && this.pc) {
      await this.pc.setRemoteDescription(msg.sdp);
      await this._flushIce();
    } else if (msg.t === 'ice') {
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(msg.c).catch(() => {});
      else this._pendingIce.push(msg.c);
    }
  }

  async _flushIce() {
    for (const c of this._pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
  }

  _wire(ch, name) {
    if (name === 'inp') {
      this.inp = ch;
      ch.onmessage = (e) => this._onInputPacket(e.data);
    } else {
      this.ctl = ch;
      ch.onmessage = (e) => { this.lastSeen = performance.now(); this._onCtl(JSON.parse(e.data)); };
      ch.onclose = () => this.status !== 'closed' && this._close('OPPONENT LEFT');
    }
    ch.onopen = () => {
      if (this.ctl?.readyState === 'open' && this.inp?.readyState === 'open' && !this.open) this._opened();
    };
  }

  _opened() {
    this.open = true;
    this.status = 'open';
    this.lastSeen = performance.now();
    clearTimeout(this._pollTimer);
    this._timers.forEach(clearTimeout);
    this._timers = [];
    const ping = () => this.sendCtl({ t: 'ping', ts: performance.now() });
    ping();
    this._timers.push(setInterval(() => {
      if (performance.now() - this.lastSeen > SILENCE_LIMIT) return this._close('CONNECTION LOST');
      ping();
    }, 1000));
  }

  // ---- messages --------------------------------------------------------------------------------
  _onCtl(m) {
    switch (m.t) {
      case 'ping': this.sendCtl({ t: 'pong', ts: m.ts }); break;
      case 'pong': {
        const rtt = performance.now() - m.ts;
        this.rtt = Number.isFinite(this.rtt) ? this.rtt * 0.6 + rtt * 0.4 : rtt;
        break;
      }
      case 'pick': this.remote = { cur: m.cur, locked: !!m.locked }; break;
      case 'start': this.start = m; break;
      case 'rematch': this.remoteRematch = m.on; break;
      case 'hash': this.onHash?.(m.f, m.h); break;
      case 'leave': this._close('OPPONENT LEFT'); break;
    }
  }

  sendCtl(m) {
    try {
      if (this.ctl?.readyState === 'open') this.ctl.send(JSON.stringify(m));
    } catch { /* a full or closing channel must never break the game loop */ }
  }

  sendInput(pkt) {
    // (if the wire is backed up, skip: the next packet repeats everything this one said)
    try {
      if (this.inp?.readyState === 'open' && this.inp.bufferedAmount < 8192) this.inp.send(JSON.stringify(pkt));
    } catch { /* full or closing: the next packet repeats this one */ }
  }

  _onInputPacket(data) {
    this.lastSeen = performance.now();
    let pkt;
    try { pkt = JSON.parse(data); } catch { return; }
    if (this.ls && pkt.m === this.ls.match) this.ls.receive(pkt);
    else if (this.inputQueue.length < 600) this.inputQueue.push(pkt); // the fight is not open yet (or is the next one)
  }

  /** The fight takes over incoming inputs (replaying any that arrived before it started). */
  attachLockstep(ls) {
    this.stopFlushing();
    this.ls = ls;
    ls.send = (pkt) => this.sendInput(pkt);
    const queued = this.inputQueue.splice(0);
    for (const p of queued) {
      if (p.m === ls.match) ls.receive(p);
      else if (this.inputQueue.length < 600) this.inputQueue.push(p);
    }
  }

  /**
   * After the last frame the other side may still be waiting for our final inputs, and packets can be
   * lost, so keep sending the finished fight's window for a few seconds.
   */
  flushFor(ms) {
    const ls = this.ls;
    if (!ls || this._flushTimer) return;
    const timer = setInterval(() => ls.flush(), 50);
    this._flushTimer = timer;
    setTimeout(() => { if (this._flushTimer === timer) this.stopFlushing(); }, ms);
  }
  stopFlushing() {
    clearInterval(this._flushTimer);
    this._flushTimer = null;
  }

  // ---- closing ---------------------------------------------------------------------------------
  leave() {
    if (this.status === 'closed') return;
    this.sendCtl({ t: 'leave' });
    setTimeout(() => this._close('YOU LEFT'), 50);
    this.status = 'closed'; // stop reacting right away; the channel closes a moment later
  }

  _close(reason) {
    if (this._dead) return;
    this._dead = true;
    console.info('[online] closed:', reason);
    this.status = 'closed';
    this.reason = reason;
    this.open = false;
    clearTimeout(this._pollTimer);
    this._timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    this.stopFlushing();
    try { this.ctl?.close(); this.inp?.close(); this.pc?.close(); } catch { /* already closed */ }
  }
}
