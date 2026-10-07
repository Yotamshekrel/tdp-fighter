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
import { trackMatch } from '../analytics.js';
import { seed } from '../game/rng.js';
import { resetEntityIds } from '../game/entities.js';
import { Lockstep, delayFor, packInput, stateHash } from '../net/lockstep.js';

const STALL_LIMIT_MS = 10000; // online: how long to wait for the other player before giving up
const CARD_FRAMES = 6 * 60; // the controls card auto-continues after 6 s

const PAUSE_ITEMS = ['RESUME', 'RESTART', 'CHARACTER SELECT', 'MAIN MENU'];
const TOURNAMENT_PAUSE_ITEMS = ['RESUME', 'RESTART MATCH', 'QUIT TOURNAMENT'];

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
    this.online = mode === 'online';
    this.ls = null;
    this.netError = '';
    this.stallT0 = 0; // when the current wait for the other player began (ms)
    this.leavePrompt = 0; // frames left on the "press Esc again to leave" prompt
    let controllers =
      mode === '2p' ? [human(0), human(1)] :
      mode === 'demo' ? [new CpuBot(difficulty), new CpuBot(difficulty)] :
      [human(0), new CpuBot(difficulty)];
    if (this.online) {
      // Both computers run this same fight: same seed, and every frame's inputs for both fighters.
      const net = this.game.net;
      seed(params.seed);
      resetEntityIds();
      this.ls = new Lockstep({ side: net.side, delay: delayFor(net.rtt), match: params.seed, send: () => {} });
      net.attachLockstep(this.ls);
      net.onHash = (f, h) => this.ls.addRemoteHash(f, h);
      controllers = [this.ls.controller(0), this.ls.controller(1)];
    }
    this.battle = new Battle({ chars, controllers, arena, deterministic: this.online });
    // (online: only the host reports the match, so it is counted once)
    this.tracker = mode === 'demo' || (this.online && this.game.net.side === 1) ? null : trackMatch({ mode, difficulty, arena, chars });
    this.hud = new Hud();
    this.pauseItems = mode === 'tournament' ? TOURNAMENT_PAUSE_ITEMS : PAUSE_ITEMS;
    this.paused = false;
    this.sel = 0;
    this.t = 0;
    this.endT = 0;
    this.errT = 0;
    this.rects = [];
    // Every match starts with a reminder of the buttons (not in CPU demos, and only for a tournament's first fight).
    this.card = mode === 'demo' || this.online || (params.tournament && params.tournament.round > 0) ? -1 : 0;
    this.game.audio.playMusic(getArena(arena).music); // each arena has its own track
  }

  update() {
    this.t++;
    const { input, audio } = this.game;
    const m = input.menu;
    const demo = this.params.mode === 'demo';
    audio.muffle(this.paused);
    if (this.online) return this.updateOnline();

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
      const n = this.pauseItems.length;
      if (m.up) { this.sel = (this.sel + n - 1) % n; audio.play('move'); }
      if (m.down) { this.sel = (this.sel + 1) % n; audio.play('move'); }
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
    this.afterStep();
  }

  /** Everything that follows a simulated frame: sounds, HUD, and the end of the match. */
  afterStep() {
    for (const ev of this.battle.events) {
      this.hud.onEvent(ev);
      this.playEvent(ev);
    }
    if (this.battle.phase === 'intro' && this.battle.phaseT === 1) this.hud.reset();
    if (this.battle.phase === 'matchEnd' && ++this.endT > 40) {
      this.tracker?.end({ winner: this.battle.matchWinner?.side ?? -1, rounds: this.battle.round });
      this.tracker = null;
      const winner = this.battle.matchWinner?.side ?? -1;
      if (this.params.mode === 'tournament') {
        const outcome = winner < 0 ? 'draw' : winner === 0 ? 'win' : 'lose';
        this.game.go('bracket', { tournament: this.params.tournament, arenaChoice: this.params.arenaChoice, outcome });
      } else this.game.go('results', { ...this.params, winner, stats: this.battle.stats });
    }
  }

  /** Online: no pause. A frame only runs once the other player's inputs for it have arrived. */
  updateOnline() {
    const { input } = this.game;
    const ls = this.ls, net = this.game.net;
    if (this.leavePrompt > 0) this.leavePrompt--;
    if (input.menu.pause) {
      if (this.leavePrompt > 0) return this.game.endOnline('YOU LEFT THE MATCH');
      this.leavePrompt = 180;
    }
    if (this.netError) {
      if (++this.errT > 150) this.game.endOnline(this.netError);
      return;
    }
    ls.flush();
    if (!ls.ready()) {
      // (measured in real time: a throttled or busy tab must not count as fast-forwarded stalling)
      this.stallT0 ||= performance.now();
      if (performance.now() - this.stallT0 > STALL_LIMIT_MS) this.netError = 'OPPONENT NOT RESPONDING';
      return;
    }
    this.stallT0 = 0;
    ls.sample(this.leavePrompt > 0 ? 0 : packInput(input.state(0)));
    this.battle.update();
    ls.advance();
    ls.flush();
    const frame = this.battle.frame;
    if (frame % 60 === 0) {
      const h = stateHash(this.battle);
      ls.addHash(frame, h);
      net.sendCtl({ t: 'hash', f: frame, h });
    }
    if (ls.desync !== null) this.netError = 'OUT OF SYNC - MATCH ENDED';
    if (this.battle.phase === 'matchEnd') net.flushFor(3000); // the other side may still need our last inputs
    this.afterStep();
  }

  choose() {
    const { audio } = this.game;
    audio.play('select');
    const p = this.params;
    switch (this.pauseItems[this.sel]) {
      case 'RESUME': this.paused = false; break;
      case 'RESTART':
      case 'RESTART MATCH': this.enter(p); break;
      case 'CHARACTER SELECT': this.game.go('select', { mode: p.mode, arena: p.arenaChoice ?? p.arena, difficulty: p.difficulty }); break;
      default: this.game.go('mode'); // MAIN MENU / QUIT TOURNAMENT
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

  drawOnline(g) {
    const { W } = VIEW;
    const net = this.game.net;
    const ping = Number.isFinite(net?.rtt) ? `${Math.round(net.rtt)} MS` : '-- MS';
    drawText(g, `ONLINE  ${ping}${net?.route === 'relay' ? '  RELAY' : ''}`, W - 4, 3, { scale: 1, align: 'right', color: '#ffffff', alpha: 0.55 });
    const say = (text, y, color = '#ffffff') => {
      g.fillStyle = 'rgba(5,6,24,0.7)';
      g.fillRect(0, y - 4, W, 22);
      drawText(g, text, W / 2, y, { scale: 2, align: 'center', color, outline: 'rgba(5,6,24,0.9)' });
    };
    if (this.netError) return say(this.netError, 110, '#ff6a5a');
    if (this.leavePrompt > 0) return say('PRESS ESC AGAIN TO LEAVE THE MATCH', 110, '#ffd23f');
    if (this.stallT0 && performance.now() - this.stallT0 > 400) say(this.t % 60 < 40 ? 'WAITING FOR OPPONENT...' : 'WAITING FOR OPPONENT', 110);
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
    if (this.online) this.drawOnline(g);
    if (this.paused) {
      dim(g, 0.62);
      glass(g, W / 2 - 100, 62, 200, 130, { accent: '#ffd23f' });
      drawText(g, 'PAUSED', W / 2, 72, { scale: 3.6, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
      this.rects = drawMenu(g, this.pauseItems, this.sel, W / 2, 108, this.t, { gap: 21, scale: 1, width: 150 });
    }
  }
}
