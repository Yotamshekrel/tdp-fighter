// The fight scene: runs a Battle, plays sounds for its events, pause menu.
import { VIEW } from '../config.js';
import { Battle } from '../game/battle.js';
import { CpuBot } from '../game/cpu-bot.js';
import { HumanController } from '../game/input.js';
import { drawBattle } from '../render/battle-render.js';
import { getArena } from '../render/backgrounds.js';
import { Hud } from '../render/hud.js';
import { drawText } from '../render/font.js';
import { dim, drawMenu, hitTest, GOLD } from './ui.js';
import { glass } from '../render/ui-kit.js';
import { drawControlsCard } from './controls-card.js';

const CARD_FRAMES = 6 * 60; // the controls card auto-continues after 6 s

const PAUSE_ITEMS = ['RESUME', 'RESTART', 'CHARACTER SELECT', 'MAIN MENU'];

export class FightScene {
  constructor(game) {
    this.game = game;
    this.hud = new Hud();
  }

  enter(params) {
    this.params = params;
    const { chars, mode, difficulty, arena } = params;
    const input = this.game.input;
    input.mode = mode === '2p' ? '2p' : '1p';
    const human = (i) => new HumanController(input, i);
    const controllers =
      mode === '2p' ? [human(0), human(1)] :
      mode === 'demo' ? [new CpuBot(difficulty), new CpuBot(difficulty)] :
      [human(0), new CpuBot(difficulty)];
    this.battle = new Battle({ chars, controllers, arena });
    this.hud = new Hud();
    this.paused = false;
    this.sel = 0;
    this.t = 0;
    this.endT = 0;
    this.rects = [];
    // Every match starts with a reminder of the buttons (not in CPU demos).
    this.card = mode === 'demo' ? -1 : 0;
    this.game.audio.playMusic(getArena(arena).music); // each arena has its own track
  }

  update() {
    this.t++;
    const { input, audio } = this.game;
    const m = input.menu;
    const demo = this.params.mode === 'demo';
    audio.muffle(this.paused);

    if (this.card >= 0) {
      this.card++;
      const go = m.confirm || m.click || input.p[0].confirm || input.p[1].confirm;
      if ((this.card > 20 && go) || this.card > CARD_FRAMES) {
        this.card = -1;
        audio.play('select');
      }
      return;
    }
    if (this.paused) {
      const hov = hitTest(input.pointer, this.rects);
      if (input.pointer.moved && hov >= 0) this.sel = hov;
      if (m.up) { this.sel = (this.sel + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; audio.play('move'); }
      if (m.down) { this.sel = (this.sel + 1) % PAUSE_ITEMS.length; audio.play('move'); }
      if (m.pause || (m.back && !m.pause)) { this.paused = false; audio.play('pause'); return; }
      if (m.confirm || (m.click && hov >= 0)) this.choose();
      return;
    }
    if (m.pause || (demo && (m.confirm || m.click))) {
      if (demo) return this.game.go('mode');
      this.paused = true;
      this.sel = 0;
      audio.play('pause');
      return;
    }

    this.battle.update();
    for (const ev of this.battle.events) {
      this.hud.onEvent(ev);
      this.playEvent(ev);
    }
    if (this.battle.phase === 'intro' && this.battle.phaseT === 1) this.hud.reset();
    if (this.battle.phase === 'matchEnd' && ++this.endT > 40) {
      this.game.go('results', { ...this.params, winner: this.battle.matchWinner?.side ?? -1, stats: this.battle.stats });
    }
  }

  choose() {
    const { audio } = this.game;
    audio.play('select');
    const p = this.params;
    switch (this.sel) {
      case 0: this.paused = false; break;
      case 1: this.enter(p); break;
      case 2: this.game.go('select', { mode: p.mode, arena: p.arenaChoice ?? p.arena, difficulty: p.difficulty }); break;
      case 3: this.game.go('mode'); break;
    }
  }

  /** Map battle events to sound effects (placed in the stereo field by where they happen). */
  playEvent(ev) {
    const a = this.game.audio;
    const x = ev.f?.x;
    switch (ev.type) {
      case 'hit':
        a.play(ev.sfx || (ev.big ? 'smash' : 'punch'), { x });
        if (ev.big && ev.sfx) a.play('smash', { x });
        break;
      case 'block': a.play('block', { x }); break;
      case 'swing': a.play('swing', { x }); break;
      case 'jump': a.play('jump', { x }); break;
      case 'land': a.play('land', { x }); break;
      case 'thud': a.play('thud', { x }); break;
      case 'special': a.play('special', { x }); a.duck(0.3, 0.55, 0.5); break;
      case 'sfx': a.play(ev.name, { x: ev.x }); break;
      case 'bounce': a.play('bounce'); break;
      case 'round':
        a.play('round');
        a.say(ev.n >= 3 ? 'Final round' : `Round ${['', 'one', 'two'][ev.n] ?? ev.n}`);
        break;
      case 'fight': a.play('fight'); a.say('Fight!', { rate: 1.05, pitch: 0.5 }); break;
      case 'ko': a.play('ko'); a.duck(0.2, 1.3, 0.6); a.say('K. O.', { rate: 0.8, pitch: 0.45 }); break;
      case 'timeover': a.play('back'); a.say('Time over'); break;
      case 'roundWin': a.play('win'); break;
      case 'matchEnd':
        if (ev.winner) setTimeout(() => a.say(`${ev.winner.def.name} wins!`, { rate: 0.9 }), 900);
        break;
    }
  }

  draw(g) {
    const { W } = VIEW;
    drawBattle(g, this.battle, this.game.bank, this.hud, this.t, this.game.debug);
    if (this.card >= 0) {
      drawControlsCard(g, { mode: this.params.mode, chars: this.params.chars, t: this.card, total: CARD_FRAMES });
      return;
    }
    if (this.params.mode === 'demo' && this.t % 60 < 40) {
      drawText(g, 'DEMO - PRESS ANY BUTTON TO EXIT', W / 2, 44, { scale: 1.3, align: 'center', color: '#ffffff', outline: 'rgba(5,6,24,0.9)' });
    }
    if (this.paused) {
      dim(g, 0.62);
      glass(g, W / 2 - 100, 62, 200, 130, { accent: '#ffd23f' });
      drawText(g, 'PAUSED', W / 2, 72, { scale: 3.6, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
      this.rects = drawMenu(g, PAUSE_ITEMS, this.sel, W / 2, 108, this.t, { gap: 21, scale: 1, width: 150 });
    }
  }
}
