// Online lobby: host a game (get a 4-letter room code) or join a friend's with their code.
// Once the connection is open, the host goes on to pick the arena and the guest to character select.
import { VIEW } from '../config.js';
import { drawText } from '../render/font.js';
import { COLORS, glass, menuBackdrop } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';
import { Session } from '../net/session.js';
import { drawMenu, hitTest, heading, hints, GOLD } from './ui.js';

const MENU = ['HOST A GAME', 'JOIN A GAME', 'BACK'];

export class LobbyScene {
  constructor(game) {
    this.game = game;
    this.state = 'menu'; // menu | host | enter | connecting | error
    // Typed text (the room code) is read straight from the keyboard: the game's own key bindings
    // would otherwise turn X into "back", M into "mute" and so on.
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('paste', (e) => {
      if (game.scene === this && this.state === 'enter') this.typeCode(e.clipboardData?.getData('text') || '');
    });
  }

  enter() {
    this.t = 0;
    this.sel = 0;
    this.rects = [];
    this.state = 'menu';
    this.code = '';
    this.error = '';
    this.session = null;
    this.game.dropNet();
    this.game.audio.playMusic('menu');
  }

  typeCode(text) {
    this.code = (this.code + text.toUpperCase().replace(/[^A-Z]/g, '')).slice(0, 4);
  }

  onKey(e) {
    if (this.game.scene !== this || e.metaKey || e.ctrlKey) return;
    // Waiting for a friend / connecting: only Esc cancels (the letters of a code are also game buttons).
    if (e.code === 'Escape' && (this.state === 'host' || this.state === 'connecting')) return this.back();
    if (this.state !== 'enter') return;
    if (/^Key[A-Z]$/.test(e.code)) this.typeCode(e.code.slice(3));
    else if (e.code === 'Backspace') this.code = this.code.slice(0, -1);
    else if (e.code === 'Enter' && this.code.length === 4) this.connect();
    else if (e.code === 'Escape') this.back();
  }

  async host() {
    this.state = 'host';
    this.code = '';
    this.game.audio.play('select');
    const s = await Session.host();
    if (this.state !== 'host') return s.leave(); // cancelled while the room was being made
    this.session = s;
    this.code = s.code;
  }

  async connect() {
    this.state = 'connecting';
    this.game.audio.play('select');
    this.session = null;
    const s = await Session.join(this.code);
    if (this.state !== 'connecting') return s.leave();
    this.session = s;
  }

  /** Reset to the first menu (leaving any half-made connection). */
  back() {
    this.session?.leave();
    this.session = null;
    this.state = 'menu';
    this.error = '';
    this.game.audio.play('back');
  }

  fail(reason) {
    this.session?.leave();
    this.session = null;
    this.error = reason;
    this.errorT = this.t;
    this.state = 'error';
    this.game.audio.play('back');
  }

  update() {
    this.t++;
    const { input, audio } = this.game;
    const m = input.menu;
    const s = this.session;
    this.game.textEntry = this.state === 'enter';

    if (s) {
      if (s.status === 'closed' && this.state !== 'error') return this.fail(s.reason || 'DISCONNECTED');
      if (s.status === 'open') {
        this.game.net = s;
        audio.play('select');
        // The host picks the arena; the guest goes straight to character select.
        if (s.role === 'host') return this.game.go('mode', { page: 'arena', mode: 'online' });
        return this.game.go('select', { mode: 'online', arena: 'random' });
      }
    }

    if (this.state === 'menu') {
      const hov = hitTest(input.pointer, this.rects);
      if (input.pointer.moved && hov >= 0 && hov !== this.sel) { this.sel = hov; audio.play('move'); }
      if (m.up) { this.sel = (this.sel + MENU.length - 1) % MENU.length; audio.play('move'); }
      if (m.down) { this.sel = (this.sel + 1) % MENU.length; audio.play('move'); }
      if (m.back) { audio.play('back'); return this.game.go('mode', { page: 'play' }); }
      if (m.confirm || (m.click && hov >= 0)) {
        if (this.sel === 0) this.host();
        else if (this.sel === 1) { this.state = 'enter'; this.code = ''; audio.play('select'); }
        else { audio.play('back'); this.game.go('mode', { page: 'play' }); }
      }
    } else if (this.state === 'error' && this.t - this.errorT > 30) {
      if (m.confirm || m.back || m.click) { this.state = 'menu'; audio.play('select'); }
    }
  }

  draw(g) {
    const { W, H } = VIEW;
    menuBackdrop(g, this.t, '#3dffb0', '#2f7bff');
    drawText(g, 'TDP FIGHTER', 34, 16, { scale: 1.7, color: ['#ffffff', '#ffd23f', '#ff9b2e'], outline: 'rgba(5,6,24,0.9)', glow: '#ff8a2a' });
    heading(g, 'ONLINE', 34, 40, { scale: 3.2 });

    if (this.state === 'menu') {
      this.rects = drawMenu(g, MENU, this.sel, W / 2, 100, this.t, { gap: 30, scale: 1.4, width: 190 });
      drawText(g, 'PLAY A FRIEND ON ANOTHER COMPUTER', W / 2, 78, { scale: 1.2, align: 'center', color: COLORS.dim });
      hints(g, [['↑↓', 'MOVE'], ['ENTER', 'SELECT'], ['ESC', 'BACK']], H - 15);
    } else {
      glass(g, 60, 78, W - 120, 120, { accent: COLORS.side[0].a });
      const mid = W / 2;
      if (this.state === 'host') {
        drawText(g, 'YOUR ROOM CODE', mid, 90, { scale: 1.6, align: 'center', color: COLORS.dim });
        this.drawCode(g, this.code || '....', 108);
        const dots = '.'.repeat(1 + ((this.t / 20) | 0) % 3);
        drawText(g, this.code ? `TELL YOUR FRIEND, THEN WAIT${dots}` : `MAKING A ROOM${dots}`, mid, 160, { scale: 1.5, align: 'center', color: '#ffffff' });
        drawText(g, 'THEY CHOOSE  JOIN A GAME  AND TYPE IT IN', mid, 178, { scale: 1.1, align: 'center', color: COLORS.dim });
        hints(g, [['ESC', 'CANCEL']], H - 15);
      } else if (this.state === 'enter') {
        drawText(g, 'TYPE THE ROOM CODE', mid, 90, { scale: 1.6, align: 'center', color: COLORS.dim });
        this.drawCode(g, this.code.padEnd(4, '_').replace(/ /g, '_'), 108, this.t % 40 < 24 ? this.code.length : -1);
        drawText(g, this.code.length === 4 ? 'PRESS ENTER TO JOIN' : 'FOUR LETTERS FROM YOUR FRIEND', mid, 164, { scale: 1.5, align: 'center', color: '#ffffff' });
        hints(g, [['A-Z', 'TYPE'], ['⌫', 'DELETE'], ['ENTER', 'JOIN'], ['ESC', 'BACK']], H - 15);
      } else if (this.state === 'connecting') {
        const dots = '.'.repeat(1 + ((this.t / 20) | 0) % 3);
        drawText(g, `CONNECTING${dots}`, mid, 120, { scale: 2.4, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)' });
        drawText(g, `ROOM ${this.code}`, mid, 156, { scale: 1.5, align: 'center', color: COLORS.dim });
        hints(g, [['ESC', 'CANCEL']], H - 15);
      } else if (this.state === 'error') {
        drawText(g, 'COULD NOT CONNECT', mid, 98, { scale: 2.2, align: 'center', color: '#ff6a5a', outline: 'rgba(5,6,24,0.9)' });
        drawText(g, this.error, mid, 140, { scale: 1.5, align: 'center', color: '#ffffff' });
        hints(g, [['ENTER', 'OK']], H - 15);
      }
    }
    postProcess(g, this.t, { bloom: 0.2 });
  }

  /** The code as big letter tiles. `caret` = index of the tile to underline (or -1). */
  drawCode(g, text, y, caret = -1) {
    const tile = 34, gap = 8, total = 4 * tile + 3 * gap;
    const x0 = VIEW.W / 2 - total / 2;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (tile + gap);
      glass(g, x, y, tile, 40, { r: 5, accent: i === caret ? '#ffd23f' : 'rgba(255,255,255,0.3)' });
      const ch = text[i] || '';
      if (ch && ch !== '_') drawText(g, ch, x + tile / 2, y + 7, { scale: 4.2, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
    }
  }
}
