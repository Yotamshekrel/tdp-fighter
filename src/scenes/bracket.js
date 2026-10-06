// ---------------------------------------------------------------------------
// Tournament bracket: the graph of the whole tournament, left to right
//
//   QUARTER-FINALS (4 games) -> SEMI-FINALS (2 games) -> FINAL -> CHAMPION
//
// It is the hub of a tournament. States:
//   ready      your next fight is highlighted: FIGHT! / QUIT
//   reveal     the last fight's result is written in, then the other games of the
//              round are played (headless) and revealed one by one
//   over       you were knocked out; the rest of the bracket plays out
//   champion   you won the final
// ---------------------------------------------------------------------------
import { VIEW } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { ROUND_NAMES, Tournament } from '../game/tournament.js';
import { pick } from '../game/rng.js';
import { ARENAS } from '../render/backgrounds.js';
import { drawText } from '../render/font.js';
import { drawPortrait } from '../render/sprites.js';
import { COLORS, GOLD, glass, glow, rrPath, vgrad, vignette, clamp01, easeOut, menuBackdrop } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';
import { drawMenu, hitTest, hints } from './ui.js';
import { DIFFS } from './mode-select.js';

const COLX = [14, 134, 254, 374]; // left edge of each column
const SW = 96, SH = 21; // slot size
const TOP = 44, PITCH = 24; // first quarter-final slot and the spacing between them
const COUNTS = [8, 4, 2, 1];
const HEADERS = [...ROUND_NAMES, 'CHAMPION'];

const START_DELAY = 36; // frames before the first game is revealed
const PRE = 30, POST = 26; // a revealed game: lights up for PRE frames, then the winner moves on and it holds for POST

/** Vertical centre of slot s of round r (a later round sits between the two slots that feed it). */
const cyOf = (r, s) => (r === 0 ? TOP + s * PITCH + SH / 2 : (cyOf(r - 1, 2 * s) + cyOf(r - 1, 2 * s + 1)) / 2);

/** Stroke the first `p` (0..1) of a polyline. */
function strokePartial(g, pts, p) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * p;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.min(1, left / (len || 1));
    g.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
    left -= len;
  }
  g.stroke();
}

export class BracketScene {
  constructor(game) {
    this.game = game;
  }

  /** params: { tournament, arenaChoice, outcome? } where outcome is 'win' | 'lose' | 'draw' (the fight that just ended). */
  enter(params) {
    this.params = params;
    const T = (this.tour = params.tournament);
    this.t = 0;
    this.sel = 0;
    this.rects = [];
    this.appear = new Map(); // slot key -> frame it was filled (for the pop-in)
    this.queue = [];
    this.step = null;
    this.qRound = T.round;
    this.msg = '';
    this.state = 'ready';
    this.confetti = Array.from({ length: 70 }, () => ({
      x: Math.random() * VIEW.W, y: -Math.random() * VIEW.H, v: 0.5 + Math.random() * 1.1, p: Math.random() * 6.3,
      c: ['#ff4d6d', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff8cf0', '#ffffff'][Math.floor(Math.random() * 6)],
    }));
    this.game.audio.playMusic('menu');

    if (!params.outcome) {
      for (let i = 0; i < 8; i++) this.appear.set(`0:${i}`, 4 + i * 4); // the line-up pops in
    } else if (params.outcome === 'draw') {
      this.msg = 'DRAW!  REMATCH';
    } else {
      this.state = 'reveal';
      const m = T.playerMatch();
      this.fillRound(T.round, { r: T.round, m, player: true, won: params.outcome === 'win' });
    }
  }

  /** Queue the games of round r that still need a result (the player's, already played, goes first). */
  fillRound(r, playerItem = null) {
    const T = this.tour;
    const items = [];
    if (playerItem) items.push(playerItem);
    for (const m of T.pending(r)) if (!playerItem || m !== playerItem.m) items.push({ r, m });
    this.queue = items;
    this.step = null;
    this.stepT = -START_DELAY;
  }

  // -------------------------------------------------------------------------
  update() {
    this.t++;
    const { input, audio } = this.game;
    const m = input.menu;

    if (this.state === 'reveal') {
      if (this.t > 20 && (m.confirm || m.click)) return this.skip();
      this.stepT++;
      if (!this.step) {
        if (this.stepT >= 0) this.nextStep();
        return;
      }
      if (this.stepT === PRE) this.commit(this.step);
      else if (this.stepT >= PRE + POST) this.nextStep();
      return;
    }

    const items = this.items();
    const hov = hitTest(input.pointer, this.rects);
    if (input.pointer.moved && hov >= 0 && hov !== this.sel) { this.sel = hov; audio.play('move'); }
    if (m.up) { this.sel = (this.sel + items.length - 1) % items.length; audio.play('move'); }
    if (m.down) { this.sel = (this.sel + 1) % items.length; audio.play('move'); }
    if (this.t < 20) return;
    if (m.back) { audio.play('back'); return this.game.go('mode'); }
    if (m.confirm || (m.click && hov >= 0)) this.choose();
  }

  items() {
    if (this.state === 'ready') return ['FIGHT!', 'QUIT'];
    return [this.state === 'champion' ? 'PLAY AGAIN' : 'TRY AGAIN', 'NEW FIGHTER', 'MAIN MENU'];
  }

  choose() {
    const { audio } = this.game;
    const T = this.tour;
    const p = this.params;
    audio.play('select');
    if (this.state === 'ready') {
      if (this.sel === 1) return this.game.go('mode');
      const f = T.nextFight();
      return this.game.go('vs', {
        chars: f.chars, mode: 'tournament', difficulty: T.difficulty, tournament: T,
        arenaChoice: p.arenaChoice, arena: p.arenaChoice === 'random' ? pick(ARENAS).id : p.arenaChoice,
      });
    }
    if (this.sel === 0) this.game.go('bracket', { tournament: new Tournament(T.player, CHARACTERS, T.difficulty), arenaChoice: p.arenaChoice });
    else if (this.sel === 1) this.game.go('select', { mode: 'tournament', arena: p.arenaChoice, difficulty: T.difficulty });
    else this.game.go('mode');
  }

  nextStep() {
    this.step = this.queue.shift() || null;
    this.stepT = 0;
    if (this.step) this.game.audio.play('move');
    else this.finishRound();
  }

  /** Write the result of a game into the bracket (playing it first if it is a CPU-vs-CPU game). */
  commit(item) {
    const T = this.tour;
    if (item.player) T.recordPlayer(item.won);
    else T.setWinner(item.r, item.m, T.simulate(item.r, item.m));
    this.appear.set(`${item.r + 1}:${item.m}`, this.t);
    this.game.audio.play('select');
    item.done = true;
  }

  /** Everything in the round has a result: carry on to the next fight, or to the end. */
  finishRound() {
    const T = this.tour;
    if (T.done) {
      const won = T.champion.id === T.player.id;
      this.state = won ? 'champion' : 'over';
      this.sel = 0;
      if (won) this.game.audio.play('win');
    } else if (T.alive) {
      T.advance();
      this.state = 'ready';
      this.sel = 0;
    } else {
      this.fillRound(++this.qRound); // knocked out: play the rest of the bracket for the picture
      this.nextStep();
    }
  }

  /** Enter: jump to the end of the reveal. */
  skip() {
    for (let guard = 0; this.state === 'reveal' && guard < 40; guard++) {
      if (this.step && !this.step.done) this.commit(this.step);
      this.step = null;
      let next;
      while ((next = this.queue.shift())) this.commit(next);
      this.finishRound();
    }
    for (const k of this.appear.keys()) this.appear.set(k, -999);
  }

  // -------------------------------------------------------------------------
  draw(g) {
    const { W, H } = VIEW;
    const T = this.tour;
    const t = this.t;
    menuBackdrop(g, t, '#ffb62e', '#3a6cff');
    drawText(g, 'TOURNAMENT', W / 2, 6, { scale: 2.3, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
    const dm = DIFFS.find((d) => d.id === T.difficulty);
    if (dm) drawText(g, `CPU: ${dm.label}`, W - 10, 9, { scale: 1.2, align: 'right', color: dm.color, outline: 'rgba(5,6,24,0.8)' });

    // which round is "now"
    const nowRound = this.state === 'reveal' ? this.qRound : T.done ? 3 : T.round;
    for (let r = 0; r < 4; r++) {
      const on = r === nowRound;
      drawText(g, HEADERS[r], COLX[r] + SW / 2, 30, { scale: 1.1, align: 'center', color: on ? '#ffd23f' : COLORS.dim, outline: on ? 'rgba(5,6,24,0.8)' : undefined });
    }

    this.drawConnectors(g);

    // the two slots about to fight
    let hot = null, hotColor = '#ffd23f';
    if (this.state === 'ready') {
      const f = T.nextFight();
      if (f) hot = { r: f.round, m: f.match };
    } else if (this.state === 'reveal' && this.step && !this.step.done) {
      hot = { r: this.step.r, m: this.step.m };
      hotColor = '#ffffff';
    }
    for (let r = 0; r < 4; r++) for (let s = 0; s < COUNTS[r]; s++) this.drawSlot(g, r, s, hot && hot.r === r && (hot.m === s >> 1) ? hotColor : null);
    this.drawTrophy(g, T.done ? easeOut(clamp01((t - (this.appear.get('3:0') ?? -999)) / 30)) : 0);

    // status line + menu
    drawText(g, this.statusLine(), W / 2, 237, { scale: 1.25, align: 'center', color: this.state === 'over' ? '#ff7a6e' : '#ffffff', outline: 'rgba(5,6,24,0.9)', shadow: 'rgba(0,0,0,0.6)' });
    if (this.state === 'reveal') {
      this.rects = [];
      hints(g, [['ENTER', 'SKIP']], H - 15);
    } else {
      this.rects = drawMenu(g, this.items(), this.sel, COLX[3] + SW / 2, 172, t, { gap: 22, scale: 0.9, width: 100 });
      hints(g, [['↑↓', 'MOVE'], ['ENTER', 'SELECT'], ['ESC', 'QUIT']], H - 15);
    }

    if (this.state === 'champion') this.drawConfetti(g);
    vignette(g, 0.4);
    postProcess(g, t, { bloom: 0.2 });
  }

  statusLine() {
    const T = this.tour;
    if (this.state === 'reveal') return `${ROUND_NAMES[this.qRound]}:  RESULTS`;
    if (this.state === 'champion') return 'YOU ARE THE CHAMPION!';
    if (this.state === 'over') return `KNOCKED OUT IN THE ${ROUND_NAMES[T.round]}  -  ${T.champion.name} TAKES THE TITLE`;
    const f = T.nextFight();
    const line = `${T.roundLabel}:  ${f.chars[0].name}  VS  ${f.chars[1].name}`;
    return this.msg ? `${this.msg}   -   ${line}` : line;
  }

  drawConnectors(g) {
    const T = this.tour;
    g.save();
    g.lineWidth = 1;
    g.lineJoin = 'round';
    for (let r = 0; r < 3; r++) {
      for (let m = 0; m < COUNTS[r] / 2; m++) {
        const x0 = COLX[r] + SW, xj = x0 + 12, x1 = COLX[r + 1];
        const yTarget = cyOf(r + 1, m);
        for (const s of [2 * m, 2 * m + 1]) {
          const pts = [[x0, cyOf(r, s)], [xj, cyOf(r, s)], [xj, yTarget], [x1, yTarget]];
          g.strokeStyle = 'rgba(255,255,255,0.16)';
          strokePartial(g, pts, 1);
          const w = T.winnerOf(r, m);
          if (w && w === T.rounds[r][s]) {
            const p = clamp01((this.t - (this.appear.get(`${r + 1}:${m}`) ?? -999)) / 22);
            const mine = w.id === T.player.id;
            g.save();
            g.strokeStyle = mine ? COLORS.side[0].b : '#ffd23f';
            g.shadowColor = mine ? COLORS.side[0].glow : '#ffb62e';
            g.shadowBlur = 5 * VIEW.SCALE;
            strokePartial(g, pts, easeOut(p));
            g.restore();
          }
        }
      }
    }
    g.restore();
  }

  drawSlot(g, r, s, hotColor) {
    const T = this.tour;
    const bank = this.game.bank;
    const c = T.rounds[r][s];
    const big = r === 3;
    const w = SW, h = big ? 46 : SH;
    const x = COLX[r], cy = cyOf(r, s), y = cy - h / 2;
    const age = this.t - (this.appear.get(`${r}:${s}`) ?? -999);
    if (age < 0) return;
    const pop = easeOut(clamp01(age / 14));
    const mine = c && c.id === T.player.id;

    g.save();
    g.globalAlpha = pop;
    g.translate((1 - pop) * -12, 0);
    if (!c) {
      rrPath(g, x, y, w, h, 4);
      g.fillStyle = 'rgba(10,14,40,0.45)';
      g.fill();
      g.lineWidth = 0.6;
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.setLineDash([2, 2]);
      g.stroke();
      g.setLineDash([]);
      drawText(g, '?', x + w / 2, cy - 4, { scale: 1.15, align: 'center', color: 'rgba(255,255,255,0.25)' });
      g.restore();
      return;
    }

    // out of the tournament? (lost a game in this round)
    const winner = r < 3 ? T.winnerOf(r, s >> 1) : null;
    const lost = !!winner && winner !== c;
    if (lost) g.globalAlpha = pop * 0.4;

    const accent = big ? '#ffd23f' : mine ? COLORS.side[0].a : null;
    glass(g, x, y, w, h, { r: 4, shadow: false, accent: accent ?? undefined, glow: big ? '#ffb62e' : mine && !lost ? COLORS.side[0].glow : undefined,
      fill: vgrad(g, y, y + h, [[0, mine ? 'rgba(90,30,40,0.92)' : 'rgba(40,50,110,0.92)'], [1, mine ? 'rgba(40,12,24,0.94)' : 'rgba(14,18,52,0.94)']]) });
    const ph = h - 4;
    const p = bank.portrait(c.id);
    if (p) {
      g.save();
      rrPath(g, x + 2, y + 2, ph, ph, 3);
      g.clip();
      drawPortrait(g, p, x + 2, y + 2, ph, ph);
      g.restore();
    }
    const nameX = x + ph + 6;
    const sc = big ? 1.5 : 1.15;
    drawText(g, c.name, nameX, big ? cy - 12 : cy - 4, { scale: sc, color: '#ffffff', shadow: 'rgba(0,0,0,0.8)', weight: 800 });
    if (mine) drawText(g, 'YOU', x + w - 4, big ? cy + 2 : cy - 3, { scale: 0.95, align: 'right', color: COLORS.side[0].b, weight: 800, shadow: 'rgba(0,0,0,0.7)' });
    g.restore();

    if (hotColor) {
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 0.22);
      g.save();
      g.shadowColor = hotColor;
      g.shadowBlur = (4 + pulse * 6) * VIEW.SCALE;
      rrPath(g, x - 1, y - 1, w + 2, h + 2, 5);
      g.lineWidth = 1.2;
      g.strokeStyle = hotColor;
      g.globalAlpha = 0.5 + 0.5 * pulse;
      g.stroke();
      g.restore();
    }
  }

  /** A little gold cup above the champion's slot; it lights up once there is a champion. */
  drawTrophy(g, lit) {
    const cx = COLX[3] + SW / 2, top = 62;
    g.save();
    if (lit > 0) glow(g, cx, top + 22, 52, '#ffb62e', 0.6 * lit);
    g.globalAlpha = 0.28 + 0.72 * lit;
    const gold = vgrad(g, top, top + 42, [[0, '#fff3a0'], [0.5, '#ffd23f'], [1, '#c98a14']]);
    g.fillStyle = gold;
    g.strokeStyle = gold;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx - 13, top + 8, 6, Math.PI / 2, Math.PI * 1.5);
    g.stroke();
    g.beginPath();
    g.arc(cx + 13, top + 8, 6, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 13, top);
    g.lineTo(cx + 13, top);
    g.quadraticCurveTo(cx + 13, top + 22, cx, top + 26);
    g.quadraticCurveTo(cx - 13, top + 22, cx - 13, top);
    g.fill();
    g.fillRect(cx - 2.5, top + 26, 5, 9);
    rrPath(g, cx - 10, top + 35, 20, 6, 2);
    g.fill();
    g.restore();
  }

  drawConfetti(g) {
    const { H } = VIEW;
    const t = this.t;
    for (const c of this.confetti) {
      const y = (c.y + t * c.v * 1.6) % (H + 20);
      const x = c.x + Math.sin(t * 0.04 + c.p) * 8;
      g.save();
      g.translate(x, y);
      g.rotate(t * 0.08 + c.p);
      g.fillStyle = c.c;
      g.fillRect(-1.6, -0.8 * Math.abs(Math.cos(t * 0.1 + c.p)) - 0.3, 3.2, 1.6 * Math.abs(Math.cos(t * 0.1 + c.p)) + 0.6);
      g.restore();
    }
  }
}
