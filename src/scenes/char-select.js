// Character select: a grid of every fighter in the middle, both players' picks
// shown full-body at the sides, and their special moves underneath.
import { VIEW, KEYS } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { randInt, pick } from '../game/rng.js';
import { Tournament } from '../game/tournament.js';
import { ARENAS } from '../render/backgrounds.js';
import { drawText, wrap, textWidth, fitScale } from '../render/font.js';
import { drawFighterArt, drawPortrait } from '../render/sprites.js';
import { COLORS, glass, glow, rrPath, vgrad, menuBackdrop } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';
import { hints, keyLabel } from './ui.js';

// Two groups: the TDPST, then the mentors and the rest (drawn as a centred row under a divider).
const MENTORS = ['nethanel', 'rashida', 'noa-ple', 'danny', 'tal'];
const COLS = 9;
const CELL_W = 28, CELL_H = 36, PITCH_X = 31, PITCH_Y = 40;
const GRID_W = COLS * PITCH_X - (PITCH_X - CELL_W);
const GRID_X = Math.round((VIEW.W - GRID_W) / 2);
const GRID_Y = 50;
const GROUP_GAP = 17; // extra space between the groups (room for the second one's label)
const GROUPS = [
  { label: 'THE TDPST', idx: CHARACTERS.map((c, k) => k).filter((k) => !MENTORS.includes(CHARACTERS[k].id)) },
  { label: 'MENTORS & MORE', idx: CHARACTERS.map((c, k) => k).filter((k) => MENTORS.includes(CHARACTERS[k].id)) },
];
// ROWS[r] = character indices on screen row r; SLOT[k] = where character k's cell is.
const ROWS = [];
const SLOT = [];
const LABELS = []; // [text, y]
let rowY = GRID_Y;
GROUPS.forEach((gr, gi) => {
  if (!gr.idx.length) return;
  if (gi > 0) rowY += GROUP_GAP;
  LABELS.push([gr.label, rowY - 18]);
  for (let i = 0; i < gr.idx.length; i += COLS) {
    const row = gr.idx.slice(i, i + COLS);
    const x0 = GRID_X + (GRID_W - (row.length * PITCH_X - (PITCH_X - CELL_W))) / 2;
    row.forEach((k, c) => { SLOT[k] = { x: Math.round(x0 + c * PITCH_X), y: rowY, row: ROWS.length }; });
    ROWS.push(row);
    rowY += PITCH_Y;
  }
});
const GRID_BOTTOM = rowY - PITCH_Y + CELL_H;
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
    this.stage = mode === '2p' ? 'both' : 'p1'; // 'p1' -> 'cpu' for 1P (a tournament only picks P1)
    this.doneT = 0;
    this.lockT = [0, 0];
    this.moveT = [0, 0]; // when each cursor last moved (for the figure swap animation)
    this.game.input.mode = mode === '2p' ? '2p' : '1p';
    this.game.audio.playMusic('menu');
  }

  label(i) {
    if (this.mode === '1p' && i === 1) return 'CPU';
    return `${i + 1}P`;
  }

  move(i, dx, dy) {
    const cur = this.cur[i];
    let r = SLOT[cur].row, c = ROWS[r].indexOf(cur);
    if (dx) c = (c + dx + ROWS[r].length) % ROWS[r].length;
    if (dy) {
      // up/down lands on the cell closest (sideways) to where the cursor was, so the groups line up
      const cx = SLOT[cur].x;
      r = (r + dy + ROWS.length) % ROWS.length;
      c = ROWS[r].reduce((best, k, j) => (Math.abs(SLOT[k].x - cx) < Math.abs(SLOT[ROWS[r][best]].x - cx) ? j : best), 0);
    }
    this.cur[i] = ROWS[r][c];
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
      const { x, y } = SLOT[k];
      if (p.x >= x && p.x < x + CELL_W && p.y >= y && p.y < y + CELL_H) return k;
    }
    return -1;
  }

  update() {
    this.t++;
    const { input, audio } = this.game;
    if (this.doneT) {
      if (++this.doneT > 50) this.start();
      return;
    }
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

    // 1P: pick P1 first, then the opponent, with any controller.
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

  backToMenu() {
    this.game.go('mode', { page: 'grownup', mode: this.mode });
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
    // the title says what to do right now
    const title = this.mode === '2p' ? 'SELECT YOUR FIGHTERS' : this.stage === 'p1' ? 'SELECT YOUR FIGHTER' : 'SELECT YOUR OPPONENT';
    drawText(g, title, W / 2, 9, { scale: 2.3, align: 'center', color: ['#ffffff', '#cdd8ff'], outline: 'rgba(5,6,24,0.9)', glow: 'rgba(110,140,255,0.8)' });

    // ---- both fighters, full body --------------------------------------------------------
    for (let i = 0; i < 2; i++) {
      const visible = i === 0 || this.stage !== 'p1';
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
      const nameScale = fitScale(c.name, 96, 2.4, 1.4);
      drawText(g, c.name, x, 243 + (2.4 - nameScale) * 3, { scale: nameScale, align: 'center', color: this.locked[i] ? ['#ffffff', '#fff3a0', '#ffd23f'] : ['#ffffff', '#cdd8ff'], outline: 'rgba(5,6,24,0.9)', glow: this.locked[i] ? '#ffb62e' : side.glow });
      if (c.isNew) newBadge(g, x, 228, this.t, 1.3, true);
      if (this.locked[i]) drawText(g, 'READY!', x, 34, { scale: 1.9, align: 'center', color: this.t % 24 < 16 ? ['#ffffff', side.b] : '#ffffff', outline: 'rgba(5,6,24,0.9)', glow: side.glow });
    }

    // ---- the grid -----------------------------------------------------------------------------
    for (const [label, ly] of LABELS) {
      drawText(g, label, GRID_X, ly, { scale: 1.05, color: COLORS.dim, weight: 800 });
      g.fillStyle = 'rgba(160,175,255,0.25)';
      g.fillRect(GRID_X + textWidth(label, 1.05) + 5, ly + 3, GRID_W - textWidth(label, 1.05) - 5, 1);
    }
    CHARACTERS.forEach((c, k) => {
      const { x, y } = SLOT[k];
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
      const cellScale = fitScale(c.name, CELL_W - 3, 1.05, 0.7, { weight: 800 }); // long names shrink to fit the cell
      drawText(g, c.name, x + CELL_W / 2, y + CELL_H - 10, { scale: cellScale, align: 'center', color: '#ffffff', shadow: 'rgba(0,0,0,0.9)', weight: 800 });
      if (c.isNew) newBadge(g, x + CELL_W - 1, y + 1, this.t, 0.72); // small, in the corner, so the face stays visible
    });
    // cursors
    for (let i = 0; i < 2; i++) {
      const active = this.stage === 'both' || (this.stage === 'p1' ? i === 0 : true);
      if (!active) continue;
      const { x, y } = SLOT[this.cur[i]];
      const side = COLORS.side[i];
      const same = this.cur[0] === this.cur[1] && this.stage !== 'p1';
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
      const tw = textWidth(tag, 1.05, { weight: 800 }) + 8;
      // on the same cell the two tags meet in the middle instead of overlapping
      const tx = same ? (i === 0 ? x + CELL_W / 2 - tw - 0.5 : x + CELL_W / 2 + 0.5) : i === 0 ? x - 1 : x + CELL_W + 1 - tw;
      rrPath(g, tx, y - 11, tw, 10, 3);
      g.fillStyle = vgrad(g, y - 11, y - 1, [[0, side.a], [1, side.b]]);
      g.fill();
      drawText(g, tag, tx + tw / 2, y - 9.4, { scale: 1.05, align: 'center', color: '#ffffff', weight: 800, shadow: 'rgba(0,0,0,0.4)' });
    }

    // ---- info cards: each shown player's special move --------------------------------------
    const px = GRID_X - 2, pw = GRID_W + 2, py = GRID_BOTTOM + 2, ph = H - py - 19;
    const show = this.stage === 'p1' ? [0] : [0, 1];
    show.forEach((i) => {
      const w = show.length === 1 ? pw : pw / 2 - 2;
      const x = show.length === 1 ? px : px + i * (w + 4);
      const c = CHARACTERS[this.cur[i]];
      const side = COLORS.side[i];
      glass(g, x, py, w, ph, { accent: side.a, r: 5 });
      const tw = w - 16;
      const ns = fitScale(c.special.name, tw, 1.6, 1.1, { italic: true }); // long move names shrink to fit the card
      drawText(g, c.special.name, x + 8, py + 5 + (1.6 - ns) * 3.5, { scale: ns, color: ['#fff3a0', '#ffd23f'], outline: 'rgba(5,6,24,0.8)', italic: true });
      // the whole description, as big as fits between the move's name and the bio line
      const bs = fitScale(c.bio, tw, 1, 0.6, { italic: true });
      const bioY = py + ph - 4 - 7 * bs, top = py + 19, room = bioY - 3 - top;
      let ds = 1.05, lines = wrap(c.special.description.toUpperCase(), tw, ds);
      while (lines.length * ds * 9 > room && ds > 0.75) lines = wrap(c.special.description.toUpperCase(), tw, (ds = Math.round((ds - 0.05) * 100) / 100));
      lines.forEach((ln, kk) => drawText(g, ln, x + 8, top + kk * ds * 9, { scale: ds, color: COLORS.text }));
      drawText(g, c.bio, x + 8, bioY, { scale: bs, color: COLORS.dim, italic: true });
    });

    // ---- hints -----------------------------------------------------------------------------------
    // both players' keys in 2P (P1 / P2), the single-player keys otherwise
    if (this.mode === '2p') {
      const key = (a) => `${keyLabel(KEYS.p1[a])} / ${keyLabel(KEYS.p2[a])}`;
      hints(g, [[key('attack'), 'PICK'], [key('defend'), 'BACK'], [key('special'), 'RANDOM']], H - 15);
    } else {
      const key = (a) => keyLabel(KEYS.solo[a]);
      hints(g, [[key('attack'), 'PICK'], [key('defend'), 'BACK'], [key('special'), 'RANDOM'], ['↑↓◀▶', 'MOVE']], H - 15);
    }
    if (this.doneT) {
      g.fillStyle = `rgba(255,255,255,${Math.max(0, 0.5 - this.doneT / 30)})`;
      g.fillRect(0, 0, W, H);
    }
    postProcess(g, this.t, { bloom: 0.2 });
  }
}
