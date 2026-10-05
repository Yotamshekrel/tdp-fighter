// "VS" intro screen between character select and the fight.
import { VIEW } from '../config.js';
import { getArena } from '../render/backgrounds.js';
import { drawText } from '../render/font.js';
import { drawFighterArt } from '../render/sprites.js';
import { COLORS, GOLD, glow, parallelogram, vgrad, vignette, easeOut, clamp01, easeOutBack } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';

export class VsScene {
  constructor(game) {
    this.game = game;
  }
  enter(params) {
    this.params = params;
    this.t = 0;
    this.game.audio.stopMusic();
    this.game.audio.play('vs');
    getArena(params.arena); // pre-build the stage while we wait
  }
  update() {
    this.t++;
    const m = this.game.input.menu;
    if (this.t > 170 || (this.t > 30 && (m.confirm || m.click))) this.game.go('fight', this.params);
  }
  draw(g) {
    const { W, H } = VIEW;
    const { chars, arena } = this.params;
    const bank = this.game.bank;
    const t = this.t;
    // two team-coloured halves split by a diagonal
    g.fillStyle = '#05061a';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) {
      const side = COLORS.side[i];
      g.save();
      g.beginPath();
      if (i === 0) { g.moveTo(0, 0); g.lineTo(W / 2 + 46, 0); g.lineTo(W / 2 - 46, H); g.lineTo(0, H); }
      else { g.moveTo(W / 2 + 46, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(W / 2 - 46, H); }
      g.closePath();
      g.clip();
      g.fillStyle = vgrad(g, 0, H, [[0, side.dark], [1, '#05061a']]);
      g.fillRect(0, 0, W, H);
      glow(g, i === 0 ? 90 : W - 90, 140, 200, side.glow, 0.45);
      // speed lines
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 18; k++) {
        const y = (k * 37 + i * 13) % H;
        const len = 50 + ((k * 23) % 80);
        const x = ((t * (7 + (k % 3) * 2) + k * 97) % (W + len)) - len;
        const gr = g.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(1, side.glow + '99');
        g.fillStyle = gr;
        g.save();
        g.translate(i === 0 ? x : W - x - len, y);
        g.scale(i === 0 ? 1 : -1, 1);
        g.translate(i === 0 ? 0 : -len, 0);
        g.fillRect(0, 0, len, 0.9);
        g.restore();
      }
      g.restore();
    }
    // diagonal seam
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1.2;
    g.shadowColor = '#ffffff';
    g.shadowBlur = 12 * VIEW.SCALE;
    g.beginPath();
    g.moveTo(W / 2 + 46, 0);
    g.lineTo(W / 2 - 46, H);
    g.stroke();
    g.restore();

    // the fighters, full body, sliding in
    const slide = easeOut(clamp01(t / 20));
    for (let i = 0; i < 2; i++) {
      const c = chars[i];
      const side = COLORS.side[i];
      const bob = Math.sin(t * 0.06 + i * 2) * 1.5;
      const x = i === 0 ? -90 + 200 * slide : W + 90 - 200 * slide;
      // floor shadow
      g.save();
      g.translate(x, 246);
      g.scale(1, 0.13);
      const sh = g.createRadialGradient(0, 0, 0, 0, 0, 90);
      sh.addColorStop(0, 'rgba(0,0,0,0.65)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.beginPath();
      g.arc(0, 0, 90, 0, 6.3);
      g.fill();
      g.restore();
      drawFighterArt(g, bank, c.id, x, 248 + bob, 214, i === 1);
      // name plates
      const nx = i === 0 ? 14 : W - 14;
      const al = i === 0 ? 'left' : 'right';
      const ny = i === 0 ? 12 : 214;
      const slideN = easeOut(clamp01((t - 8) / 14));
      g.save();
      g.globalAlpha = slideN;
      g.translate((i === 0 ? -1 : 1) * (1 - slideN) * 80, 0);
      drawText(g, c.name, nx, ny, { scale: 5.2, align: al, color: GOLD, outline: 'rgba(5,6,24,0.92)', glow: side.glow });
      drawText(g, c.special.name, nx + (i === 0 ? 3 : -3), ny + 41, { scale: 1.7, align: al, color: ['#ffffff', side.b], outline: 'rgba(5,6,24,0.9)' });
      g.restore();
    }

    // VS
    if (t > 14) {
      const k = clamp01((t - 14) / 12);
      const s = 7.5 * (1 + (1 - easeOutBack(k)) * 1.2);
      const shake = t < 30 ? (t % 2 ? 1.5 : -1.5) : 0;
      glow(g, W / 2, H / 2 - 6, 90, '#ffd23f', 0.5 * k);
      drawText(g, 'VS', W / 2 + shake, H / 2 - 6 - (7 * s) / 2, { scale: s, align: 'center', color: ['#ffffff', '#fff3a0', '#ffd23f', '#ff4d2e'], outline: '#1a0608', glow: '#ff8a2a', alpha: k });
    }
    // stage banner
    const sk = easeOut(clamp01((t - 22) / 14));
    g.save();
    g.globalAlpha = sk;
    parallelogram(g, W / 2 - 100, H - 34, 200, 18, 10);
    g.fillStyle = 'rgba(5,6,24,0.8)';
    g.fill();
    g.lineWidth = 0.7;
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.stroke();
    drawText(g, `STAGE:  ${getArena(arena).name.toUpperCase()}`, W / 2, H - 31, { scale: 1.45, align: 'center', color: '#ffffff', italic: true });
    g.restore();
    vignette(g, 0.5);
    if (t < 6) {
      g.fillStyle = `rgba(255,255,255,${0.9 - t / 8})`;
      g.fillRect(0, 0, W, H);
    }
    postProcess(g, t, { bloom: 0.25 });
  }
}
