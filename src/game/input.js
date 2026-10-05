// ---------------------------------------------------------------------------
// Input: keyboard, gamepads (Gamepad API), on-screen touch buttons and mouse.
// Everything is boiled down to the same per-player InputState:
//   { left, right, up, down, attack, defend, special }
// plus edge-triggered menu actions.
// Bindings live in src/config.js (KEYS / PAD).
// ---------------------------------------------------------------------------
import { KEYS, PAD, VIEW } from '../config.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'defend', 'special'];
const GAME_CODES = new Set([
  ...Object.values(KEYS.solo).flat(), ...Object.values(KEYS.p1).flat(), ...Object.values(KEYS.p2).flat(),
  ...KEYS.confirm, ...KEYS.back, ...KEYS.pause, ...KEYS.mute, 'Tab',
]);

export class Input {
  constructor() {
    this.down = new Set(); // keys currently held
    this.hit = new Set(); // keys pressed since the last update (catches quick taps)
    this.touch = Object.fromEntries([...ACTIONS, 'pause'].map((a) => [a, false]));
    this.pointer = { x: -1, y: -1, moved: false, clicked: false, active: false };
    this.mode = '1p'; // '1p' | '2p': picks player 1's key layout and gamepad assignment
    this.prev = [blank(), blank()];
    this.now = [blank(), blank()];
    this.prevSys = {};
    this.prevExtra = blank();
    this.menu = {}; // edge-triggered "any player" menu actions
    this.p = [{}, {}]; // edge-triggered per-player menu actions
    this.anyKey = false;
    this.padNames = [];
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (GAME_CODES.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.hit.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    // Mouse / tap on the canvas, converted to game pixels.
    const toGame = (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * VIEW.W;
      this.pointer.y = ((e.clientY - r.top) / r.height) * VIEW.H;
    };
    canvas.addEventListener('pointermove', (e) => {
      toGame(e);
      this.pointer.moved = true;
      this.pointer.active = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      toGame(e);
      this.pointer.clicked = true;
      this.pointer.active = true;
    });
  }

  /** Build the on-screen touch controls (only shown on touch devices). */
  createTouchControls(root) {
    const el = document.createElement('div');
    el.id = 'touch';
    el.innerHTML = `
      <div class="pad">
        <button data-k="up" class="t-up">▲</button>
        <button data-k="left" class="t-left">◀</button>
        <button data-k="right" class="t-right">▶</button>
        <button data-k="down" class="t-down">▼</button>
      </div>
      <div class="btns">
        <button data-k="special" class="t-spc">SPC</button>
        <button data-k="defend" class="t-def">DEF</button>
        <button data-k="attack" class="t-atk">ATK</button>
      </div>
      <button data-k="pause" class="t-pause">II</button>`;
    root.appendChild(el);
    for (const b of el.querySelectorAll('button')) {
      const k = b.dataset.k;
      const on = (e) => { e.preventDefault(); this.touch[k] = true; b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); this.touch[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    const show = () => document.body.classList.add('touch-mode');
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) show();
    window.addEventListener('touchstart', show, { once: true, passive: true });
  }

  key(codes) {
    return codes.some((c) => this.down.has(c) || this.hit.has(c));
  }

  /** Which gamepad (index into navigator.getGamepads) drives player i? */
  padFor(i, pads) {
    const live = pads.filter(Boolean);
    if (this.mode === '2p' && live.length === 1) return i === 1 ? live[0] : null; // keyboard + pad
    return live[i] || null;
  }

  /** Poll everything; call once per fixed update. */
  update() {
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    this.padNames = pads.filter(Boolean).map((p) => p.id);
    const sys = {
      confirm: this.key(KEYS.confirm), back: this.key(KEYS.back), pause: this.key(KEYS.pause) || this.touch.pause,
      mute: this.key(KEYS.mute),
    };
    for (let i = 0; i < 2; i++) {
      this.prev[i] = this.now[i];
      // In 1P mode player 1 uses the single-player layout (arrows + Z/X/C).
      const k = i === 0 ? (this.mode === '2p' ? KEYS.p1 : KEYS.solo) : KEYS.p2;
      const s = blank();
      for (const a of ACTIONS) s[a] = this.key(k[a]);
      const pad = this.padFor(i, pads);
      if (pad) {
        const btn = (list) => list.some((n) => pad.buttons[n]?.pressed);
        const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
        s.left ||= ax < -PAD.deadzone || btn(PAD.left);
        s.right ||= ax > PAD.deadzone || btn(PAD.right);
        s.up ||= ay < -PAD.deadzone * 1.3 || btn(PAD.jump);
        s.down ||= ay > PAD.deadzone * 1.3 || btn(PAD.down);
        s.attack ||= btn(PAD.attack);
        s.defend ||= btn(PAD.defend);
        s.special ||= btn(PAD.special);
        s.confirm = btn(PAD.confirm);
        s.back = btn(PAD.back);
        s.pause = btn(PAD.pause);
      }
      if (i === 0) for (const a of ACTIONS) s[a] ||= this.touch[a];
      this.now[i] = s;
    }
    // Edge-triggered menu actions
    const edge = (i, a) => this.now[i][a] && !this.prev[i][a];
    for (let i = 0; i < 2; i++) {
      this.p[i] = {
        up: edge(i, 'up'), down: edge(i, 'down'), left: edge(i, 'left'), right: edge(i, 'right'),
        confirm: edge(i, 'attack') || edge(i, 'confirm'),
        back: edge(i, 'defend') || edge(i, 'back'),
        random: edge(i, 'special'),
        pause: edge(i, 'pause'),
      };
    }
    // The keyboard layout player 1 is NOT using right now still drives menus.
    const other = this.mode === '2p' ? KEYS.solo : KEYS.p1;
    const ex = blank();
    for (const a of ACTIONS) ex[a] = this.key(other[a]);
    const prevEx = this.prevExtra;
    const exEdge = (a) => ex[a] && !prevEx[a];
    this.prevExtra = ex;
    const sysEdge = (a) => sys[a] && !this.prevSys[a];
    const any = (a) => this.p[0][a] || this.p[1][a] ||
      ({ confirm: exEdge('attack'), back: exEdge('defend'), random: exEdge('special') }[a] ?? exEdge(a));
    this.menu = {
      up: any('up'), down: any('down'), left: any('left'), right: any('right'),
      confirm: any('confirm') || sysEdge('confirm'),
      back: any('back') || sysEdge('back'),
      pause: sysEdge('pause') || any('pause'),
      mute: sysEdge('mute'),
      click: this.pointer.clicked,
    };
    this.anyKey = this.hit.size > 0 || this.menu.confirm || this.menu.click || ACTIONS.some((a) => edge(0, a) || edge(1, a));
    this.prevSys = sys;
    this.hit.clear();
  }

  /** End-of-frame cleanup for pointer edges. */
  endFrame() {
    this.pointer.clicked = false;
    this.pointer.moved = false;
  }

  /** InputState (held buttons) for player i. */
  state(i) {
    const s = this.now[i];
    return { left: s.left, right: s.right, up: s.up, down: s.down, attack: s.attack, defend: s.defend, special: s.special };
  }
}

function blank() {
  return { left: false, right: false, up: false, down: false, attack: false, defend: false, special: false, confirm: false, back: false, pause: false };
}

/** A controller that reads a human player's InputState from the Input. */
export class HumanController {
  constructor(input, index) {
    this.input = input;
    this.index = index;
  }
  read() {
    return this.input.state(this.index);
  }
}
