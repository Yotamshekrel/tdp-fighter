// ---------------------------------------------------------------------------
// Menus (one scene, a stack of pages):
//
//   MAIN      PLAY / SETTINGS
//   PLAY      1P VS CPU / 1P VS 2P / TOURNAMENT
//   ARENA     pick a stage (with preview) or RANDOM
//   LEVEL     CPU difficulty (1P vs CPU and tournament)
//   GROWNUP   grown-up mode? NO (default) / YES: blood and fatalities    -> character select
//   SETTINGS  SOUND ON/OFF / HOW TO PLAY
//   HELP      controls + rules
//
// Back (Esc / X / G) goes up one page; from MAIN it returns to the title.
// ---------------------------------------------------------------------------
import { VIEW, KEYS } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { ARENAS, getArena } from '../render/backgrounds.js';
import { drawText, wrap, textWidth } from '../render/font.js';
import { drawFighterArt, fighterArt } from '../render/sprites.js';
import { COLORS, glass, glow, rrPath, vgrad, easeOut, clamp01, menuBackdrop } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';
import { drawMenu, hitTest, heading, hints } from './ui.js';

export const DIFFS = [
  { id: 'easy', label: 'EASY', desc: 'Slow reactions, rarely blocks. Good for learning.', color: '#5dff8a' },
  { id: 'normal', label: 'NORMAL', desc: 'Blocks about half the time and punishes mistakes.', color: '#ffd23f' },
  { id: 'hard', label: 'HARD', desc: 'Fast reactions, blocks a lot, always uses the special.', color: '#ff5a4e' },
  { id: 'extreme', label: 'EXTREME', desc: 'Near-instant reflexes. Blocks almost everything, punishes every slip. Good luck.', color: '#e04dff' },
];
const TITLES = { main: 'MAIN MENU', play: 'PLAY', arena: 'SELECT ARENA', level: 'CPU DIFFICULTY', grownup: 'GROWN-UP MODE?', settings: 'SETTINGS', help: 'HOW TO PLAY' };
const SHOW_FRAMES = 260; // how long each fighter of the line-up stays in front

export class ModeSelectScene {
  constructor(game) {
    this.game = game;
    this.previews = new Map();
  }

  /** params.page lets other scenes return to a specific page (e.g. "back" from character select). */
  enter(params = {}) {
    this.t = 0;
    this.rects = [];
    this.mode = params.mode || this.mode || '1p';
    if (!params.page) this.game.grownUp = false; // grown-up mode is asked again for every new game, and starts at NO
    this.stack = params.page ? this.pathTo(params.page) : ['main'];
    this.sel = this.defaultSel(this.page);
    // a shuffled line-up of fighters for the showcase
    const ids = CHARACTERS.map((c) => c.id).filter((id) => fighterArt(this.game.bank, id));
    this.lineup = ids.sort(() => Math.random() - 0.5);
    this.game.audio.playMusic('menu');
  }

  get page() {
    return this.stack[this.stack.length - 1];
  }

  pathTo(page) {
    if (page === 'arena') return ['main', 'play', 'arena'];
    if (page === 'level') return ['main', 'play', 'arena', 'level'];
    if (page === 'grownup') return this.mode === '2p' ? ['main', 'play', 'arena', 'grownup'] : ['main', 'play', 'arena', 'level', 'grownup'];
    if (page === 'play') return ['main', 'play'];
    if (page === 'settings') return ['main', 'settings'];
    return ['main'];
  }

  /** Menu items for the current page. */
  items() {
    switch (this.page) {
      case 'main': return ['PLAY', 'SETTINGS'];
      case 'play': return ['1P VS CPU', '1P VS 2P', 'TOURNAMENT'];
      case 'arena': return ['RANDOM', ...ARENAS.map((a) => a.name.toUpperCase())];
      case 'level': return DIFFS.map((d) => d.label);
      case 'grownup': return ['NO', 'YES'];
      case 'settings': return [`SOUND: ${this.game.audio.muted ? 'OFF' : 'ON'}`, `ANNOUNCER: ${this.game.audio.announcer ? 'ON' : 'OFF'}`, 'HOW TO PLAY'];
      default: return [];
    }
  }

  defaultSel(page) {
    const s = this.game.settings;
    if (page === 'arena') return Math.max(0, ['random', ...ARENAS.map((a) => a.id)].indexOf(s.stage));
    if (page === 'level') return Math.max(0, DIFFS.findIndex((d) => d.id === s.difficulty));
    if (page === 'grownup') return this.game.grownUp ? 1 : 0;
    if (page === 'play') return this.mode === '2p' ? 1 : this.mode === 'tournament' ? 2 : 0;
    return 0;
  }

  push(page) {
    this.stack.push(page);
    this.sel = this.defaultSel(page);
    this.pageT = this.t;
    this.game.audio.play('select');
  }

  pop() {
    this.game.audio.play('back');
    if (this.stack.length <= 1) return this.game.go('title');
    const from = this.stack.pop();
    this.pageT = this.t;
    // land the cursor on the item we came from
    if (this.page === 'main') this.sel = from === 'settings' ? 1 : 0;
    else this.sel = this.defaultSel(this.page);
  }

  update() {
    this.t++;
    const { input, audio } = this.game;
    const m = input.menu;
    if (this.page === 'help') {
      if (m.confirm || m.back || m.click) this.pop();
      return;
    }
    const n = this.items().length;
    const hov = hitTest(input.pointer, this.rects);
    if (input.pointer.moved && hov >= 0 && hov !== this.sel) { this.sel = hov; audio.play('move'); }
    if (m.up) { this.sel = (this.sel + n - 1) % n; audio.play('move'); }
    if (m.down) { this.sel = (this.sel + 1) % n; audio.play('move'); }
    if (m.back) return this.pop();
    if (m.confirm || (m.click && hov >= 0)) this.choose();
  }

  choose() {
    const { settings, audio } = this.game;
    switch (this.page) {
      case 'main':
        return this.push(this.sel === 0 ? 'play' : 'settings');
      case 'play':
        this.mode = ['1p', '2p', 'tournament'][this.sel];
        return this.push('arena');
      case 'arena':
        settings.stage = this.sel === 0 ? 'random' : ARENAS[this.sel - 1].id;
        this.game.saveSettings();
        return this.push(this.mode !== '2p' ? 'level' : 'grownup');
      case 'level':
        settings.difficulty = DIFFS[this.sel].id;
        this.game.saveSettings();
        return this.push('grownup');
      case 'grownup':
        this.game.grownUp = this.sel === 1;
        return this.startSelect();
      case 'settings':
        if (this.sel === 0) {
          audio.toggleMute();
          this.game.syncMute?.();
          audio.play('move');
        } else if (this.sel === 1) {
          audio.announcer = !audio.announcer;
          settings.announcer = audio.announcer;
          this.game.saveSettings();
          audio.play('move');
          if (audio.announcer) audio.say('Fight!');
        } else this.push('help');
        return;
    }
  }

  startSelect() {
    const s = this.game.settings;
    this.game.audio.play('select');
    this.game.go('select', { mode: this.mode, arena: s.stage, difficulty: s.difficulty });
  }

  /** Rendered thumbnail of an arena (hi-res, cached). */
  preview(id) {
    let c = this.previews.get(id);
    if (c) return c;
    const S = VIEW.SCALE;
    c = document.createElement('canvas');
    c.width = VIEW.W * S;
    c.height = VIEW.H * S;
    const g = c.getContext('2d');
    g.scale(S, S);
    getArena(id).draw(g, 140, 0);
    this.previews.set(id, c);
    return c;
  }

  draw(g) {
    const { W, H } = VIEW;
    menuBackdrop(g, this.t, this.page === 'arena' ? '#ff9a3d' : this.page === 'grownup' ? '#d01428' : '#ff3d8b', this.page === 'grownup' ? '#3a1070' : '#2fb8ff');
    drawText(g, 'TDP FIGHTER', 34, 16, { scale: 1.7, color: ['#ffffff', '#ffd23f', '#ff9b2e'], outline: 'rgba(5,6,24,0.9)', glow: '#ff8a2a' });
    if (this.page === 'help') {
      this.drawHelp(g);
      postProcess(g, this.t, { bloom: 0.2 });
      return;
    }
    heading(g, TITLES[this.page], 34, 40, { scale: 3.2 });
    if (this.stack.length > 2) {
      const crumb = this.stack.slice(1).map((p) => (p === 'play' ? { '1p': '1P VS CPU', '2p': '1P VS 2P', tournament: 'TOURNAMENT' }[this.mode] : TITLES[p])).join('   ▶   ');
      drawText(g, crumb, 34, 74, { scale: 1.1, color: COLORS.dim });
    }

    if (this.page === 'arena') this.drawArenaPage(g);
    else {
      const items = this.items();
      const big = this.page === 'main' || this.page === 'play';
      const gap = big ? 33 : 26;
      this.rects = drawMenu(g, items, this.sel, 128, 96, this.t, { gap, scale: big ? 1.55 : 1.25, width: 176 });
      if (this.page === 'level') this.drawLevelCard(g, 96 + items.length * gap + 4);
      else if (this.page === 'grownup') this.drawGrownCard(g);
      else this.drawShowcase(g);
    }
    hints(g, [['↑↓', 'MOVE'], ['ENTER', 'SELECT'], ['ESC', 'BACK']], H - 15);
    postProcess(g, this.t, { bloom: 0.22 });
  }

  /** A line-up of fighters, the front one changing every few seconds. */
  drawShowcase(g) {
    const bank = this.game.bank;
    const n = this.lineup.length;
    if (!n) return;
    const idx = Math.floor(this.t / SHOW_FRAMES);
    const k = (this.t % SHOW_FRAMES) / SHOW_FRAMES;
    const enter = easeOut(clamp01(k * 6));
    const slots = [
      { id: this.lineup[(idx + 1) % n], x: 262, h: 150, a: 0.55 },
      { id: this.lineup[(idx + 2) % n], x: 436, h: 150, a: 0.55 },
      { id: this.lineup[idx % n], x: 350, h: 208, a: 1 },
    ];
    glow(g, 350, 150, 150, '#5a6cff', 0.4);
    // floor
    g.save();
    g.translate(350, 238);
    g.scale(1, 0.14);
    const sh = g.createRadialGradient(0, 0, 0, 0, 0, 120);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(0, 0, 120, 0, 6.3);
    g.fill();
    g.restore();
    for (const s of slots) {
      const front = s.a === 1;
      g.save();
      g.globalAlpha = front ? enter : 0.5 + 0.5 * enter;
      const sway = Math.sin(this.t * 0.03 + s.x) * 1.2;
      const bob = front ? Math.sin(this.t * 0.05) * 1.1 : 0;
      if (!front && 'filter' in g) g.filter = 'brightness(0.52) saturate(0.85)'; // the two behind sit in the shade
      drawFighterArt(g, bank, s.id, s.x + sway + (front ? (1 - enter) * 40 : 0), 240 + bob, s.h, false);
      g.restore();
    }
    // name plate for the front fighter
    const def = CHARACTERS.find((c) => c.id === slots[2].id);
    if (def) {
      drawText(g, def.name, 456, 36, { scale: 4, align: 'right', color: ['#ffffff', '#cdd8ff'], outline: 'rgba(5,6,24,0.85)', alpha: enter, glow: 'rgba(110,140,255,0.7)' });
      drawText(g, def.special.name, 456, 70, { scale: 1.5, align: 'right', color: '#ffd23f', shadow: 'rgba(0,0,0,0.7)', alpha: enter });
    }
  }

  drawLevelCard(g, y) {
    const d = DIFFS[this.sel];
    glass(g, 250, 92, 196, 112, { accent: d.color });
    drawText(g, d.label, 266, 104, { scale: 3.4, color: [d.color, '#ffffff'], outline: 'rgba(5,6,24,0.85)', glow: d.color });
    // intensity pips
    for (let i = 0; i < DIFFS.length; i++) {
      rrPath(g, 266 + i * 22, 140, 18, 6, 3);
      g.fillStyle = i <= this.sel ? d.color : 'rgba(255,255,255,0.12)';
      g.fill();
    }
    wrap(d.desc.toUpperCase(), 30).forEach((ln, i) => drawText(g, ln, 266, 158 + i * 13, { scale: 1.25, color: COLORS.text }));
    void y;
  }

  /** The grown-up mode question: what YES turns on, with blood running down the card. */
  drawGrownCard(g) {
    const yes = this.sel === 1;
    const accent = yes ? '#ff2a3a' : '#5dff8a';
    const x = 236, y = 84, w = 220, h = 140;
    glass(g, x, y, w, h, { accent });
    // an 18+ badge
    if (yes) {
      rrPath(g, x + w - 38, y + 9, 28, 14, 4);
      g.fillStyle = '#d4142a';
      g.fill();
      drawText(g, '18+', x + w - 24, y + 12, { scale: 1.6, align: 'center', color: '#ffffff', weight: 800 });
    }
    drawText(g, yes ? 'BRUTAL' : 'CLEAN', x + 14, y + 10, { scale: 3.4, color: yes ? ['#ffffff', '#ff7a6a', '#d4142a'] : ['#ffffff', '#a8ffc4', '#3ed67a'], outline: 'rgba(5,6,24,0.85)', glow: accent });
    const lines = yes
      ? ['MORE BLOOD IN EVERY HIT', 'FIGHTERS BLEED AND LOOK BATTERED', 'AS THEIR HEALTH RUNS OUT', 'A FATALITY ENDS EVERY MATCH,', 'DIFFERENT FOR EACH FIGHTER']
      : ['THE NORMAL GAME', 'NO BLOOD, NO FATALITIES', '', 'PICK YES FOR THE', 'GROWN-UP VERSION'];
    lines.forEach((ln, i) => drawText(g, ln, x + 14, y + 48 + i * 13, { scale: 1.25, color: yes && i < 3 ? '#ffd0d0' : COLORS.text }));
    drawText(g, yes ? 'NOT FOR KIDS!' : 'DEFAULT', x + 14, y + h - 17, { scale: 1.5, color: accent, outline: 'rgba(5,6,24,0.8)' });
    if (yes) {
      // blood running down from the top edge of the card
      g.save();
      rrPath(g, x, y, w, h, 7);
      g.clip();
      for (let i = 0; i < 9; i++) {
        const dx = x + 12 + i * 25 + ((i * 7) % 5);
        const len = 3 + ((i * 13) % 7) + 4 * (0.5 + 0.5 * Math.sin(this.t * 0.03 + i * 1.7));
        g.fillStyle = 'rgba(190, 16, 32, 0.92)';
        g.fillRect(dx, y, 2.2, len);
        g.beginPath();
        g.arc(dx + 1.1, y + len, 2, 0, 6.3);
        g.fill();
      }
      g.fillRect(x, y, w, 3);
      g.restore();
    }
  }

  drawArenaPage(g) {
    const { W } = VIEW;
    const items = this.items();
    this.rects = drawMenu(g, items, this.sel, 118, 96, this.t, { gap: 25, scale: 1.1, width: 176 });
    const id = this.sel === 0 ? ARENAS[Math.floor(this.t / 70) % ARENAS.length].id : ARENAS[this.sel - 1].id;
    const pw = 236, ph = 132.75, px = W - 30 - pw, py = 84;
    glow(g, px + pw / 2, py + ph / 2, 170, '#ff8a3d', 0.28);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 14 * VIEW.SCALE;
    rrPath(g, px, py, pw, ph, 7);
    g.fillStyle = '#000';
    g.fill();
    g.restore();
    g.save();
    rrPath(g, px, py, pw, ph, 7);
    g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.preview(id), px, py, pw, ph);
    g.fillStyle = vgrad(g, py + ph * 0.55, py + ph, [[0, 'rgba(4,5,22,0)'], [1, 'rgba(4,5,22,0.78)']]);
    g.fillRect(px, py, pw, ph);
    if (this.sel === 0) {
      g.fillStyle = 'rgba(6,8,28,0.45)';
      g.fillRect(px, py, pw, ph);
      drawText(g, '? RANDOM ?', px + pw / 2, py + ph / 2 - 9, { scale: 2.6, align: 'center', color: ['#ffffff', '#ffd23f'], outline: 'rgba(5,6,24,0.85)', glow: '#ffb62e' });
    }
    g.restore();
    rrPath(g, px + 0.4, py + 0.4, pw - 0.8, ph - 0.8, 7);
    g.lineWidth = 0.9;
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.stroke();
    const name = this.sel === 0 ? 'ANY STAGE' : getArena(id).name.toUpperCase();
    drawText(g, name, px + 10, py + ph - 17, { scale: 1.9, color: '#ffffff', outline: 'rgba(5,6,24,0.8)' });
  }

  drawHelp(g) {
    const { W, H } = VIEW;
    heading(g, 'HOW TO PLAY', 34, 40, { scale: 3.2 });
    glass(g, 30, 72, W - 60, 172);
    const k = (codes) => codes.map((c) => c.replace('Key', '').replace('Arrow', '').replace('Semicolon', ';')).join('/');
    const rows = [
      ['', '1P VS CPU', '2P: PLAYER 1', '2P: PLAYER 2'],
      ['MOVE', 'LEFT RIGHT', `${k(KEYS.p1.left)} ${k(KEYS.p1.right)}`, 'LEFT RIGHT'],
      ['JUMP', 'UP', k(KEYS.p1.up), 'UP'],
      ['CROUCH', 'DOWN', k(KEYS.p1.down), 'DOWN'],
      ['ATTACK', k(KEYS.solo.attack), k(KEYS.p1.attack), k(KEYS.p2.attack)],
      ['DEFEND', k(KEYS.solo.defend), k(KEYS.p1.defend), k(KEYS.p2.defend)],
      ['SPECIAL', k(KEYS.solo.special), k(KEYS.p1.special), k(KEYS.p2.special)],
    ];
    rows.forEach((r, i) => {
      const y = 80 + i * 12;
      const hdr = i === 0;
      if (i % 2 === 1) {
        g.fillStyle = 'rgba(255,255,255,0.04)';
        g.fillRect(36, y - 2, W - 72, 12);
      }
      drawText(g, r[0], 44, y, { scale: 1.2, color: COLORS.dim });
      for (let c = 1; c < 4; c++) drawText(g, r[c], [0, 190, 290, 390][c], y, { scale: 1.2, color: hdr ? '#ffd23f' : '#ffffff', align: 'center' });
    });
    const tips = [
      'GAMEPAD: X ATTACK, B DEFEND, Y/RB SPECIAL, A JUMP',
      'CROUCH + ATTACK = LOW KICK (BLOCK IT CROUCHING)',
      'JUMP + ATTACK = AIR KICK (BLOCK IT STANDING)',
      'DEFEND BLOCKS MOST DAMAGE, BUT YOU CAN\'T MOVE',
      'HIT AND GET HIT TO FILL THE SPECIAL METER',
      'TOURNAMENT: 8 FIGHTERS, QUARTER-FINALS TO THE FINAL',
      'BEST OF 3 ROUNDS.  ESC = PAUSE.  M = MUTE',
    ];
    tips.forEach((tp, i) => drawText(g, tp, W / 2, 168 + i * 12, { scale: 1.15, align: 'center', color: i < 1 ? '#5ad0ff' : COLORS.text }));
    drawText(g, 'PRESS ANY BUTTON', W / 2, H - 22, { scale: 1.3, align: 'center', color: this.t % 40 < 24 ? '#ffd23f' : COLORS.dim });
    void textWidth;
  }
}
