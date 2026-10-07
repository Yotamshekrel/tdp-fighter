// Match results: the winner celebrates, with a win quote. Rematch or leave.
import { VIEW } from '../config.js';
import { drawText, wrap } from '../render/font.js';
import { speechBubble } from '../render/effects.js';
import { drawMenu, hitTest, GOLD } from './ui.js';
import { drawFrame, drawFighterArt } from '../render/sprites.js';
import { COLORS, glass, glow, menuBackdrop, vignette, easeOut, clamp01 } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';

const ITEMS = ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'];

export class ResultsScene {
  constructor(game) {
    this.game = game;
  }
  enter(params) {
    this.params = params;
    this.t = 0;
    this.sel = 0;
    this.rects = [];
    this.confetti = Array.from({ length: 70 }, () => ({
      x: Math.random() * VIEW.W, y: -Math.random() * VIEW.H, v: 0.5 + Math.random() * 1.1, p: Math.random() * 6.3,
      c: ['#ff4d6d', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff8cf0', '#ffffff'][Math.floor(Math.random() * 6)],
    }));
    this.game.audio.playMusic('menu');
    this.game.audio.play('win');
  }
  update() {
    this.t++;
    const { input, audio } = this.game;
    const m = input.menu;
    const hov = hitTest(input.pointer, this.rects);
    if (input.pointer.moved && hov >= 0) this.sel = hov;
    if (m.up) { this.sel = (this.sel + ITEMS.length - 1) % ITEMS.length; audio.play('move'); }
    if (m.down) { this.sel = (this.sel + 1) % ITEMS.length; audio.play('move'); }
    if (this.t < 30) return;
    if (m.confirm || (m.click && hov >= 0)) {
      audio.play('select');
      const p = this.params;
      if (this.sel === 0) this.game.go('vs', { chars: p.chars, mode: p.mode, difficulty: p.difficulty, arena: p.arena, arenaChoice: p.arenaChoice });
      else if (this.sel === 1) this.game.go('select', { mode: p.mode, arena: p.arenaChoice ?? p.arena, difficulty: p.difficulty });
      else this.game.go('mode');
    }
    if (m.back) this.game.go('mode');
  }
  draw(g) {
    const { W, H } = VIEW;
    const bank = this.game.bank;
    const { chars, winner, mode } = this.params;
    const t = this.t;
    const wi = winner < 0 ? 0 : winner;
    const side = COLORS.side[wi];
    menuBackdrop(g, t, side.glow, '#3a6cff');
    if (winner < 0) {
      drawText(g, 'DRAW GAME', W / 2, 60, { scale: 6, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
    } else {
      const w = chars[winner], l = chars[1 - winner];
      // spotlight + winner, big and uncropped
      glow(g, 118, 130, 170, side.glow, 0.55);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const sp = g.createLinearGradient(118, 0, 118, H);
      sp.addColorStop(0, 'rgba(255,255,255,0.22)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sp;
      g.beginPath();
      g.moveTo(104, 0);
      g.lineTo(132, 0);
      g.lineTo(204, H);
      g.lineTo(32, H);
      g.fill();
      g.restore();
      g.save();
      g.translate(118, 246);
      g.scale(1, 0.14);
      const sh = g.createRadialGradient(0, 0, 0, 0, 0, 100);
      sh.addColorStop(0, 'rgba(0,0,0,0.65)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.beginPath();
      g.arc(0, 0, 100, 0, 6.3);
      g.fill();
      g.restore();
      const rise = easeOut(clamp01(t / 20));
      drawFighterArt(g, bank, w.id, 118, 248 + (1 - rise) * 30 + Math.sin(t * 0.06) * 1.2, 220);
      // the loser, flat on the floor beside them
      const lf = bank.frame(l.id, 'lying', 0);
      g.save();
      g.globalAlpha = 0.9;
      g.translate(236, 244);
      g.scale(-0.8, 0.8);
      drawFrame(g, lf);
      g.restore();
      // confetti
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
      // text card
      glass(g, 262, 22, 196, 112, { accent: side.a });
      const who = mode === '1p' ? (winner === 0 ? 'YOU WIN!' : 'YOU LOSE...') : `${w.name} WINS!`;
      drawText(g, who, 360, 32, { scale: 3.4, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
      drawText(g, w.name, 360, 66, { scale: 2, align: 'center', color: ['#ffffff', side.b], outline: 'rgba(5,6,24,0.8)' });
      wrap(`"${w.quote}"`.toUpperCase(), 30).forEach((ln, i) => drawText(g, ln, 360, 88 + i * 12, { scale: 1.3, align: 'center', color: '#ffe9a0', italic: true }));
      if (t > 20 && t % 120 < 90) speechBubble(g, 'WOOHOO!', 150, 54);
    }
    this.rects = drawMenu(g, ITEMS, this.sel, 360, 150, t, { gap: 26, scale: 1.1, width: 170 });
    vignette(g, 0.4);
    postProcess(g, t, { bloom: 0.22 });
  }
}
