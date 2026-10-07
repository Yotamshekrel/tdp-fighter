// Character select: a grid of every fighter in the middle, both players' picks
// shown full-body at the sides, and their special moves underneath.
import { VIEW } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { randInt, pick } from '../game/rng.js';
import { Tournament } from '../game/tournament.js';
import { ARENAS } from '../render/backgrounds.js';
import { drawText, wrap, textWidth } from '../render/font.js';
import { drawFighterArt, drawPortrait } from '../render/sprites.js';
import { COLORS, glass, glow, rrPath, vgrad, menuBackdrop } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';
import { hints } from './ui.js';

/** The match the host announced, as scene params (the guest builds it from the host's message). */
export function startParams(net) {
  const m = net.start;
  net.start = null;
  net.remoteRematch = false;
  return {
    chars: m.chars.map((id) => CHARACTERS.find((c) => c.id === id)),
    mode: 'online', arena: m.arena, arenaChoice: m.arenaChoice, seed: m.seed,
  };
}

const COLS = 7;
const CELL_W = 34, CELL_H = 42, PITCH_X = 38, PITCH_Y = 46;
const GRID_X = Math.round((VIEW.W - (COLS * PITCH_X - 5)) / 2);
const GRID_Y = 40;
const FIG_X = [60, VIEW.W - 60];

/** A small pulsing "NEW" pill whose top edge is at y and whose right edge (or centre) is at x. */
function newBadge(g, x, y, t, scale = 1, center = false) {
  const w = (textWidth('NEW', 1.05 * scale) + 6 * scale), h = 9 * scale;
  if (center) x += w / 2;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.18);
  g.save();
  g.shadowColor = '#ff3a3a';
  g.shadowBlur = (3 + pulse * 5) * VIEW.SCALE;
  rrPath(g, x - w, y, w, h, 3 * scale);
  g.fillStyle = vgrad(g, y, y + h, [[0, '#ff7a3a'], [1, '#e0182c']]);
  g.fill();
  g.restore();
  drawText(g, 'NEW', x - w / 2, y + 1.2 * scale, { scale: 1.05 * scale, align: 'center', color: '#ffffff', weight: 800, shadow: 'rgba(0,0,0,0.5)' });
}

export class CharSelectScene {
  constructor(game) {
    this.game = game;
    this.last = [0, 1];
  }

  enter({ mode, arena = 'random', difficulty = 'normal' }) {
    this.mode = mode;
    this.arena = arena; // 'random' or an arena id, chosen in the menu
    this.difficulty = difficulty;
    this.t = 0;
    this.cur = [...this.last];
    this.locked = [false, false];
    this.stage = mode === '2p' ? 'both' : mode === 'online' ? 'online' : 'p1'; // 'p1' -> 'cpu' for 1P / demo (a tournament only picks P1)
    this.doneT = 0;
    this.lockT = [0, 0];
    this.moveT = [0, 0]; // when each cursor last moved (for the figure swap animation)
    this.game.input.mode = mode === '2p' ? '2p' : '1p';
    this.game.audio.playMusic('menu');
    if (mode === 'online') {
      // Each player picks only their own fighter (host on the left, guest on the right).
      this.net = this.game.net;
      this.side = this.net.side;
      this.sent = '';
      this.net.start = null;
      this.syncRemote(true);
    }
  }

  /** Online: mirror what the other player is doing (the session keeps it even before this scene opens). */
  syncRemote(first = false) {
    const o = 1 - this.side, r = this.net.remote;
    if (r.cur < 0) { this.locked[o] = false; return; }
    if (this.cur[o] !== r.cur) { this.cur[o] = r.cur; this.moveT[o] = this.t; }
    if (r.locked && !this.locked[o] && !first) { this.lockT[o] = this.t; this.game.audio.play('select'); }
    this.locked[o] = r.locked;
  }

  /** Which fighters are on screen (the other online player's slot stays '?' until they pick). */
  shown(i) {
    if (this.stage === 'online') return i === this.side || this.net.remote.cur >= 0;
    return i === 0 || this.stage !== 'p1';
  }

  label(i) {
    if (this.mode === 'online') return i === this.side ? 'YOU' : 'OPP';
    if (this.mode === 'demo') return `CPU${i + 1}`;
    if (this.mode === '1p' && i === 1) return 'CPU';
    return `${i + 1}P`;
  }

  move(i, dx, dy) {
    const n = CHARACTERS.length;
    const rows = Math.ceil(n / COLS);
    let c = this.cur[i] % COLS, r = Math.floor(this.cur[i] / COLS);
    c = (c + dx + COLS) % COLS;
    r = (r + dy + rows) % rows;
    this.cur[i] = Math.min(n - 1, r * COLS + c);
    this.moveT[i] = this.t;
    this.game.audio.play('move');
  }

  lock(i, random = false) {
    if (random) { this.cur[i] = randInt(0, CHARACTERS.length - 1); this.moveT[i] = this.t; }
    this.locked[i] = true;
    this.lockT[i] = this.t;
    this.game.audio.play(random ? 'coin' : 'select');
  }

  cellAt(p) {
    for (let k = 0; k < CHARACTERS.length; k++) {
      const x = GRID_X + (k % COLS) * PITCH_X, y = GRID_Y + Math.floor(k / COLS) * PITCH_Y;
      if (p.x >= x && p.x < x + CELL_W && p.y >= y && p.y < y + CELL_H) return k;
    }
    return -1;
  }

  update() {
    this.t++;
    const { input, audio } = this.game;
    if (this.doneT) {
      if (this.stage === 'online') return this.updateOnlineDone();
      if (++this.doneT > 50) this.start();
      return;
    }
    if (this.stage === 'online') return this.updateOnline();
    // Which cursor do the controls drive right now?
    const drive = (i, m) => {
      if (this.locked[i]) {
        if (m.back) { this.locked[i] = false; audio.play('back'); }
        return;
      }
      if (m.left) this.move(i, -1, 0);
      if (m.right) this.move(i, 1, 0);
      if (m.up) this.move(i, 0, -1);
      if (m.down) this.move(i, 0, 1);
      if (m.confirm) this.lock(i);
      else if (m.random) this.lock(i, true);
      else if (m.back) return 'back';
    };
    const pointerCell = this.cellAt(input.pointer);

    if (this.stage === 'both') {
      for (let i = 0; i < 2; i++) {
        const r = drive(i, input.p[i]);
        if (r === 'back' && i === 0) { audio.play('back'); return this.backToMenu(); }
      }
      if (input.menu.back && !input.p[0].back && !input.p[1].back) { audio.play('back'); return this.backToMenu(); }
      if (pointerCell >= 0 && !this.locked[0]) {
        if (input.pointer.moved && this.cur[0] !== pointerCell) { this.cur[0] = pointerCell; this.moveT[0] = this.t; audio.play('move'); }
        if (input.pointer.clicked) { this.cur[0] = pointerCell; this.lock(0); }
      }
      if (this.locked[0] && this.locked[1]) this.doneT = 1;
      return;
    }

    // 1P / demo: pick P1 first, then the opponent, with any controller.
    const m = { ...input.menu, random: input.p[0].random || input.p[1].random };
    const i = this.stage === 'p1' ? 0 : 1;
    if (pointerCell >= 0) {
      if (input.pointer.moved && this.cur[i] !== pointerCell) { this.cur[i] = pointerCell; this.moveT[i] = this.t; audio.play('move'); }
      if (input.pointer.clicked) { this.cur[i] = pointerCell; m.confirm = true; }
    }
    if (m.back) {
      audio.play('back');
      if (this.stage === 'cpu') {
        this.stage = 'p1';
        this.locked[0] = false;
      } else return this.backToMenu();
      return;
    }
    drive(i, { ...m, back: false });
    if (this.locked[0] && this.stage === 'p1' && this.mode === 'tournament') {
      this.doneT = 1;
      return;
    }
    if (this.locked[0] && this.stage === 'p1') {
      this.stage = 'cpu';
      if (this.cur[1] === this.cur[0]) this.cur[1] = (this.cur[0] + 1) % CHARACTERS.length;
      this.moveT[1] = this.t;
    }
    if (this.locked[1]) this.doneT = 1;
  }

  updateOnline() {
    const { input, audio } = this.game;
    const me = this.side;
    this.syncRemote();
    const drive = input.p[0];
    if (this.locked[me]) {
      if (drive.back) { this.locked[me] = false; audio.play('back'); }
    } else {
      if (drive.left) this.move(me, -1, 0);
      if (drive.right) this.move(me, 1, 0);
      if (drive.up) this.move(me, 0, -1);
      if (drive.down) this.move(me, 0, 1);
      if (drive.confirm || input.menu.confirm) this.lock(me);
      else if (drive.random) this.lock(me, true);
      else if (input.menu.back) { audio.play('back'); return this.game.go('mode', { page: 'play' }); } // leaves the session
      const cell = this.cellAt(input.pointer);
      if (cell >= 0) {
        if (input.pointer.moved && this.cur[me] !== cell) { this.cur[me] = cell; this.moveT[me] = this.t; audio.play('move'); }
        if (input.pointer.clicked) { this.cur[me] = cell; this.lock(me); }
      }
    }
    const pick = `${this.cur[me]}:${this.locked[me]}`;
    if (pick !== this.sent) {
      this.sent = pick;
      this.net.sendCtl({ t: 'pick', cur: this.cur[me], locked: this.locked[me] });
    }
    if (this.locked[0] && this.locked[1] && this.net.remote.cur >= 0) this.doneT = 1;
  }

  /** Both are locked in: the host announces the match, the guest waits for that announcement. */
  updateOnlineDone() {
    this.doneT++;
    const net = this.net;
    if (net.role === 'host') {
      if (this.doneT > 50) {
        const params = {
          chars: [CHARACTERS[this.cur[0]], CHARACTERS[this.cur[1]]],
          mode: 'online',
          arenaChoice: this.arena,
          arena: this.arena === 'random' ? pick(ARENAS).id : this.arena,
          seed: (Math.random() * 0x100000000) >>> 0,
        };
        this.last = [...this.cur];
        net.sendCtl({ t: 'start', chars: params.chars.map((c) => c.id), arena: params.arena, arenaChoice: params.arenaChoice, seed: params.seed });
        this.game.go('vs', params);
      }
    } else if (net.start) {
      this.last = [...this.cur];
      this.game.go('vs', startParams(net));
    }
  }

  backToMenu() {
    this.game.go('mode', { page: this.mode === '2p' ? 'arena' : 'level', mode: this.mode });
  }

  start() {
    this.last = [...this.cur];
    if (this.mode === 'tournament') {
      const tour = new Tournament(CHARACTERS[this.cur[0]], CHARACTERS, this.difficulty);
      return this.game.go('bracket', { tournament: tour, arenaChoice: this.arena });
    }
    this.game.go('vs', {
      chars: [CHARACTERS[this.cur[0]], CHARACTERS[this.cur[1]]],
      mode: this.mode,
      difficulty: this.difficulty,
      arenaChoice: this.arena,
      arena: this.arena === 'random' ? pick(ARENAS).id : this.arena,
    });
  }

  draw(g) {
    const { W, H } = VIEW;
    const bank = this.game.bank;
    menuBackdrop(g, this.t, '#ff4a4a', '#3a8cff');
    drawText(g, 'SELECT YOUR FIGHTER', W / 2, 9, { scale: 2.3, align: 'center', color: ['#ffffff', '#cdd8ff'], outline: 'rgba(5,6,24,0.9)', glow: 'rgba(110,140,255,0.8)' });

    // ---- both fighters, full body --------------------------------------------------------
    for (let i = 0; i < 2; i++) {
      const visible = this.shown(i);
      const side = COLORS.side[i];
      const x = FIG_X[i];
      glow(g, x, 150, 120, side.glow, visible ? 0.4 : 0.12);
      // floor shadow
      g.save();
      g.translate(x, 240);
      g.scale(1, 0.14);
      const sh = g.createRadialGradient(0, 0, 0, 0, 0, 70);
      sh.addColorStop(0, 'rgba(0,0,0,0.6)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.beginPath();
      g.arc(0, 0, 70, 0, 6.3);
      g.fill();
      g.restore();
      if (!visible) {
        drawText(g, '?', x, 110, { scale: 11, align: 'center', color: [side.a, side.dark], outline: 'rgba(5,6,24,0.8)', glow: side.glow });
        continue;
      }
      const c = CHARACTERS[this.cur[i]];
      const since = this.t - this.moveT[i];
      const pop = Math.min(1, since / 8);
      const bob = Math.sin(this.t * 0.07 + i) * 1.2;
      g.save();
      g.globalAlpha = 0.35 + 0.65 * pop;
      drawFighterArt(g, bank, c.id, x + (i === 0 ? -1 : 1) * (1 - pop) * 14, 238 + bob, 180, i === 1);
      g.restore();
      if (this.locked[i] && this.t - this.lockT[i] < 10) glow(g, x, 150, 130, '#ffffff', 1 - (this.t - this.lockT[i]) / 10);
      // name plate (long names shrink to fit beside the grid)
      let nameScale = 2.4;
      while (nameScale > 1.4 && textWidth(c.name, nameScale) > 96) nameScale -= 0.1;
      drawText(g, c.name, x, 243 + (2.4 - nameScale) * 3, { scale: nameScale, align: 'center', color: this.locked[i] ? ['#ffffff', '#fff3a0', '#ffd23f'] : ['#ffffff', '#cdd8ff'], outline: 'rgba(5,6,24,0.9)', glow: this.locked[i] ? '#ffb62e' : side.glow });
      if (c.isNew) newBadge(g, x, 228, this.t, 1.3, true);
      if (this.locked[i]) drawText(g, 'READY!', x, 34, { scale: 1.9, align: 'center', color: this.t % 24 < 16 ? ['#ffffff', side.b] : '#ffffff', outline: 'rgba(5,6,24,0.9)', glow: side.glow });
    }

    // ---- the grid -----------------------------------------------------------------------------
    CHARACTERS.forEach((c, k) => {
      const x = GRID_X + (k % COLS) * PITCH_X, y = GRID_Y + Math.floor(k / COLS) * PITCH_Y;
      const taken = this.locked[0] && this.cur[0] === k || this.locked[1] && this.cur[1] === k;
      glass(g, x, y, CELL_W, CELL_H, { r: 4, shadow: false, fill: vgrad(g, y, y + CELL_H, [[0, 'rgba(48,58,120,0.9)'], [1, 'rgba(16,20,56,0.92)']]) });
      const p = bank.portrait(c.id);
      if (p) {
        g.save();
        rrPath(g, x + 1.5, y + 1.5, CELL_W - 3, CELL_H - 3, 3);
        g.clip();
        drawPortrait(g, p, x + 2, y + 2, CELL_W - 4, CELL_H - 4);
        if (taken) {
          g.fillStyle = 'rgba(255,210,63,0.28)';
          g.fillRect(x, y, CELL_W, CELL_H);
        }
        g.fillStyle = vgrad(g, y + CELL_H * 0.55, y + CELL_H, [[0, 'rgba(4,5,22,0)'], [1, 'rgba(4,5,22,0.7)']]);
        g.fillRect(x, y, CELL_W, CELL_H);
        g.restore();
      }
      let cellScale = 1.05;
      while (cellScale > 0.7 && textWidth(c.name, cellScale) > CELL_W - 2) cellScale -= 0.05; // long names shrink to fit the cell
      drawText(g, c.name, x + CELL_W / 2, y + CELL_H - 10, { scale: cellScale, align: 'center', color: '#ffffff', shadow: 'rgba(0,0,0,0.9)', weight: 800 });
      if (c.isNew) newBadge(g, x + CELL_W - 1, y + 1, this.t);
    });
    // cursors
    for (let i = 0; i < 2; i++) {
      const active = this.stage === 'both' || (this.stage === 'p1' ? i === 0 : this.stage === 'online' ? this.shown(i) : true);
      if (!active) continue;
      const k = this.cur[i];
      const x = GRID_X + (k % COLS) * PITCH_X, y = GRID_Y + Math.floor(k / COLS) * PITCH_Y;
      const side = COLORS.side[i];
      const same = this.cur[0] === this.cur[1] && this.stage !== 'p1' && this.shown(0) && this.shown(1);
      const o = same ? (i === 0 ? -1.5 : 1.5) : 0;
      const pulse = this.locked[i] ? 1 : 0.55 + 0.45 * Math.sin(this.t * 0.25);
      g.save();
      g.shadowColor = side.glow;
      g.shadowBlur = (6 + pulse * 6) * VIEW.SCALE;
      rrPath(g, x - 1 + o, y - 1 + o, CELL_W + 2, CELL_H + 2, 5);
      g.lineWidth = 1.5;
      g.strokeStyle = side.a;
      g.globalAlpha = 0.5 + 0.5 * pulse;
      g.stroke();
      g.restore();
      const tag = this.label(i);
      const tw = textWidth(tag, 1.05) + 8;
      const tx = i === 0 ? x - 1 : x + CELL_W + 1 - tw;
      rrPath(g, tx, y - 11, tw, 10, 3);
      g.fillStyle = vgrad(g, y - 11, y - 1, [[0, side.a], [1, side.b]]);
      g.fill();
      drawText(g, tag, tx + tw / 2, y - 9.4, { scale: 1.05, align: 'center', color: '#ffffff', weight: 800, shadow: 'rgba(0,0,0,0.4)' });
    }

    // ---- info cards: each shown player's special move --------------------------------------
    const px = GRID_X - 2, pw = COLS * PITCH_X - 1, py = GRID_Y + Math.ceil(CHARACTERS.length / COLS) * PITCH_Y + 2, ph = H - py - 22;
    const show = this.stage === 'p1' ? [0] : this.stage === 'online' ? [0, 1].filter((i) => this.shown(i)) : [0, 1];
    show.forEach((i) => {
      const w = show.length === 1 ? pw : pw / 2 - 2;
      const x = show.length === 1 ? px : px + i * (w + 4);
      const c = CHARACTERS[this.cur[i]];
      const side = COLORS.side[i];
      glass(g, x, py, w, ph, { accent: side.a, r: 5 });
      let ns = 1.7;
      while (ns > 1.1 && textWidth(c.special.name, ns) > w - 16) ns -= 0.1; // long move names shrink to fit the card
      drawText(g, `${c.special.name}`, x + 8, py + 6 + (1.7 - ns) * 3, { scale: ns, color: ['#fff3a0', '#ffd23f'], outline: 'rgba(5,6,24,0.8)', italic: true });
      wrap(c.special.description.toUpperCase(), show.length === 1 ? 52 : 25).slice(0, 3).forEach((ln, kk) => drawText(g, ln, x + 8, py + 22 + kk * 9.5, { scale: 1.05, color: COLORS.text }));
      drawText(g, c.bio.toUpperCase(), x + 8, py + ph - 11, { scale: 1, color: COLORS.dim, italic: true });
    });

    // ---- hints -----------------------------------------------------------------------------------
    let parts;
    if (this.mode === '2p') parts = [['F', 'PICK'], ['G', 'BACK'], ['H', 'RANDOM'], ['K', 'P2 PICK']];
    else parts = [['Z', 'PICK'], ['X', 'BACK'], ['C', 'RANDOM'], ['↑↓◀▶', 'MOVE']];
    hints(g, parts, H - 15);
    if (this.mode === 'online') {
      const waiting = this.locked[this.side] && !this.locked[1 - this.side];
      const t = this.doneT ? 'GET READY...' : waiting ? 'WAITING FOR YOUR OPPONENT TO PICK' : this.net.remote.cur < 0 ? 'WAITING FOR YOUR OPPONENT' : 'PICK YOUR FIGHTER';
      drawText(g, t, W / 2, 28, { scale: 1.3, align: 'center', color: COLORS.dim });
    } else if (this.mode !== '2p') {
      const t = this.stage === 'p1' ? (this.mode === 'demo' ? 'PICK CPU 1' : 'PICK YOUR FIGHTER') : this.mode === 'demo' ? 'PICK CPU 2' : 'PICK YOUR OPPONENT';
      drawText(g, t, W / 2, 28, { scale: 1.3, align: 'center', color: COLORS.dim });
    }
    if (this.doneT) {
      g.fillStyle = `rgba(255,255,255,${Math.max(0, 0.5 - this.doneT / 30)})`;
      g.fillRect(0, 0, W, H);
    }
    postProcess(g, this.t, { bloom: 0.2 });
  }
}
