// Title screen with a CPU-vs-CPU attract-mode demo fight running behind it.
import { VIEW } from '../config.js';
import { CHARACTERS } from '../data/characters.js';
import { Battle } from '../game/battle.js';
import { CpuBot } from '../game/cpu-bot.js';
import { pick, randInt } from '../game/rng.js';
import { ARENAS } from '../render/backgrounds.js';
import { drawBattle } from '../render/battle-render.js';
import { Hud } from '../render/hud.js';
import { drawText, textWidth } from '../render/font.js';
import { glow, vgrad, vignette } from '../render/ui-kit.js';
import { postProcess } from '../render/post.js';
import { hints } from './ui.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.hud = new Hud();
  }

  enter() {
    this.t = 0;
    this.newDemo();
    this.game.audio.playMusic('menu');
  }

  newDemo() {
    const i = randInt(0, CHARACTERS.length - 1);
    let j = randInt(0, CHARACTERS.length - 2);
    if (j >= i) j++;
    this.demo = new Battle({
      chars: [CHARACTERS[i], CHARACTERS[j]],
      controllers: [new CpuBot('hard'), new CpuBot('hard')],
      arena: pick(ARENAS).id,
    });
    this.hud.reset();
  }

  update() {
    this.t++;
    this.demo.update();
    if (this.demo.phase === 'matchEnd' && this.demo.phaseT++ > 90) this.newDemo();
    const inp = this.game.input;
    if (this.t > 20 && (inp.anyKey || inp.menu.confirm)) {
      this.game.audio.unlock();
      this.game.audio.play('select');
      this.game.go('mode');
    }
  }

  draw(g) {
    const { W, H } = VIEW;
    drawBattle(g, this.demo, this.game.bank, this.hud, this.t, false, { hud: false });
    // dim the fight and pool the light behind the logo
    g.fillStyle = vgrad(g, 0, H, [[0, 'rgba(4,5,22,0.8)'], [0.42, 'rgba(4,5,22,0.55)'], [0.7, 'rgba(4,5,22,0.12)'], [1, 'rgba(4,5,22,0.6)']]);
    g.fillRect(0, 0, W, H);
    glow(g, W / 2, 70, 190, '#6a4aff', 0.4);
    vignette(g, 0.5);

    const bob = Math.sin(this.t * 0.04) * 1.6;
    const cx = W / 2;
    // TDP: an extruded, gold gradient logo
    const tdp = (y, extra = {}) => drawText(g, 'TDP', cx, y, { scale: 9.2, align: 'center', ...extra });
    const y0 = 8 + bob;
    for (let d = 8; d >= 1; d--) tdp(y0 + d * 0.65, { color: '#5a0f1c', italic: true });
    tdp(y0, { color: ['#ffffff', '#fff3a0', '#ffd23f', '#ff9b2e', '#ff4d2e'], outline: '#1a0608', glow: '#ff8a2a', italic: true });
    // FIGHTER: neon
    const fy = 78 + bob;
    drawText(g, 'FIGHTER', cx + 1, fy + 2, { scale: 5.4, align: 'center', color: '#3a0a30', italic: true });
    drawText(g, 'FIGHTER', cx, fy, { scale: 5.4, align: 'center', color: ['#ffd0e4', '#ff4f8b', '#d01c60'], outline: '#1a0414', glow: '#ff3b8a', italic: true });
    // a bright glint sweeping over the logo
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gx = ((this.t * 2.2) % (W + 240)) - 120;
    const gl = g.createLinearGradient(gx, 0, gx + 40, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(gx + 20, 8);
    g.lineTo(gx + 60, 8);
    g.lineTo(gx + 40, 124);
    g.lineTo(gx, 124);
    g.fill();
    g.restore();

    const rule = g.createLinearGradient(cx - 130, 0, cx + 130, 0);
    rule.addColorStop(0, 'rgba(255,210,63,0)');
    rule.addColorStop(0.5, 'rgba(255,210,63,1)');
    rule.addColorStop(1, 'rgba(255,210,63,0)');
    g.fillStyle = rule;
    g.fillRect(cx - 130, 128, 260, 1.2);
    drawText(g, '20 FRIENDS. 1 CHAMPION.', cx, 133, { scale: 1.5, align: 'center', color: '#ffffff', shadow: 'rgba(0,0,0,0.7)', italic: true });
    if (this.t % 56 < 38) drawText(g, 'PRESS START', cx, 154, { scale: 2.4, align: 'center', color: ['#ffffff', '#fff3a0', '#ffd23f'], outline: '#150a04', glow: '#ffb62e' });
    hints(g, [['ENTER', 'START'], ['CLICK', 'START'], ['M', 'MUTE']], H - 15);
    const demo = this.demo.fighters.map((f) => f.def.name).join('  VS  ');
    drawText(g, `DEMO: ${demo}`, W - 8, H - 12, { scale: 0.95, align: 'right', color: 'rgba(160,170,220,0.7)' });
    void textWidth;
    postProcess(g, this.t);
  }
}
