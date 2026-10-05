// Loading screen: loads every fighter's art.
import { VIEW } from '../config.js';
import { drawText } from '../render/font.js';
import { CHARACTERS } from '../data/characters.js';
import { menuBackdrop, rrPath, vgrad, glow } from '../render/ui-kit.js';

export class LoadingScene {
  constructor(game) {
    this.game = game;
  }
  enter() {
    this.t = 0;
    this.progress = 0;
    this.shown = 0;
    this.current = '';
    this.done = false;
    this.game.bank.load(CHARACTERS, (p, def) => {
      this.progress = p;
      this.current = def.name;
    }).then(() => {
      this.done = true;
    });
  }
  update() {
    this.t++;
    this.shown += (this.progress - this.shown) * 0.2;
    if (this.done && this.shown > 0.985 && this.t > 24) this.game.go('title');
  }
  draw(g) {
    const { W, H } = VIEW;
    menuBackdrop(g, this.t);
    drawText(g, 'TDP', W / 2, 74, { scale: 6, align: 'center', color: ['#ffffff', '#ffd23f', '#ff7a1a'], outline: '#1a0608', glow: '#ff8a2a' });
    drawText(g, 'FIGHTER', W / 2, 122, { scale: 3.4, align: 'center', color: ['#ffd0e4', '#ff4f8b', '#d01c60'], outline: '#1a0414', glow: '#ff3b8a' });
    const bw = 200, bx = W / 2 - bw / 2, by = 176;
    rrPath(g, bx - 1.5, by - 1.5, bw + 3, 9, 4.5);
    g.fillStyle = 'rgba(8,10,30,0.85)';
    g.fill();
    g.lineWidth = 0.6;
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.stroke();
    if (this.shown > 0.01) {
      rrPath(g, bx, by, bw * this.shown, 6, 3);
      g.fillStyle = vgrad(g, by, by + 6, [[0, '#9fe8ff'], [1, '#3a7bff']]);
      g.fill();
      glow(g, bx + bw * this.shown, by + 3, 14, '#5ac8ff', 0.7);
    }
    drawText(g, this.current ? `LOADING ${this.current}` : 'LOADING', W / 2, by + 14, { scale: 1.2, align: 'center', color: '#8b93c4' });
  }
}
