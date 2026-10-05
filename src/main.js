// ---------------------------------------------------------------------------
// TDP FIGHTER - entry point. Sets up the canvas, input, audio, sprite bank
// and the scene manager, then starts the fixed-timestep loop.
// ---------------------------------------------------------------------------
import { VIEW } from './config.js';
import { startLoop } from './game/loop.js';
import { Input } from './game/input.js';
import { AudioEngine } from './audio/audio.js';
import { SpriteBank } from './render/sprites.js';
import { LoadingScene } from './scenes/loading.js';
import { TitleScene } from './scenes/title.js';
import { ModeSelectScene } from './scenes/mode-select.js';
import { CharSelectScene } from './scenes/char-select.js';
import { VsScene } from './scenes/vs.js';
import { FightScene } from './scenes/fight.js';
import { ResultsScene } from './scenes/results.js';
import { drawText } from './render/font.js';
import { loadFonts } from './render/fonts.js';

const canvas = document.getElementById('screen');
canvas.width = VIEW.W * VIEW.SCALE;
canvas.height = VIEW.H * VIEW.SCALE;
const g = canvas.getContext('2d');
g.imageSmoothingEnabled = true;
g.imageSmoothingQuality = 'high';

// Scale the canvas to fill the window (16:9, letterboxed).
function fit() {
  const s = Math.min(window.innerWidth / VIEW.W, window.innerHeight / VIEW.H);
  canvas.style.width = `${Math.floor(VIEW.W * s)}px`;
  canvas.style.height = `${Math.floor(VIEW.H * s)}px`;
}
window.addEventListener('resize', fit);
fit();

const SETTINGS_KEY = 'tdp-settings';
function loadSettings() {
  const def = { difficulty: 'normal', stage: 'random' };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return def; }
}

const input = new Input();
input.attach(canvas);
input.createTouchControls(document.getElementById('app'));
const audio = new AudioEngine();
audio.announcer = loadSettings().announcer !== false;

const game = {
  canvas, input, audio,
  bank: new SpriteBank(),
  settings: loadSettings(),
  debug: false,
  scene: null,
  sceneName: '',
  fade: null,
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  },
  /** Switch scene with a short fade-out / fade-in. */
  go(name, params = {}) {
    if (this.fade && this.fade.phase === 'out') return;
    this.fade = { phase: 'out', t: 0, name, params };
  },
  switchNow(name, params = {}) {
    this.audio.muffle(false);
    this.sceneName = name;
    this.scene = scenes[name];
    this.scene.enter(params);
  },
};
window.__game = game; // handy for debugging in the console

const scenes = {
  loading: new LoadingScene(game),
  title: new TitleScene(game),
  mode: new ModeSelectScene(game),
  select: new CharSelectScene(game),
  vs: new VsScene(game),
  fight: new FightScene(game),
  results: new ResultsScene(game),
};

// Audio may only start after a user gesture.
const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('gamepadconnected', () => {});

// Mute button
const muteBtn = document.getElementById('mute');
const syncMute = () => (muteBtn.textContent = audio.muted ? '🔇' : '🔊');
muteBtn.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.toggleMute(); syncMute(); });
syncMute();
game.syncMute = syncMute;

window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') game.debug = !game.debug; // hitbox viewer
});

// Auto-pause the fight when the tab loses focus.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !game.noAutoPause && game.sceneName === 'fight' && game.scene.params?.mode !== 'demo') game.scene.paused = true;
});

const FADE = 10;
game.switchNow('loading');

function update() {
  input.update();
  if (input.menu.mute) { audio.toggleMute(); syncMute(); }
  const f = game.fade;
  if (f) {
    f.t++;
    if (f.phase === 'out' && f.t >= FADE) {
      game.switchNow(f.name, f.params);
      game.fade = { phase: 'in', t: 0 };
    } else if (f.phase === 'in' && f.t >= FADE) game.fade = null;
  }
  if (!game.fade || game.fade.phase === 'in') game.scene.update();
  input.endFrame();
}

function render() {
  g.setTransform(VIEW.SCALE, 0, 0, VIEW.SCALE, 0, 0); // game code draws in 480x270 units
  g.imageSmoothingEnabled = true; // pixel-art sprites switch it off while they draw (see drawFrame)
  try {
    game.scene.draw(g);
  } catch (err) {
    console.error(err);
    g.fillStyle = '#000';
    g.fillRect(0, 0, VIEW.W, 12);
    drawText(g, 'RENDER ERROR: ' + err.message, 2, 2, { color: '#f44' });
  }
  const f = game.fade;
  if (f) {
    const a = f.phase === 'out' ? f.t / FADE : 1 - f.t / FADE;
    g.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, a))})`;
    g.fillRect(0, 0, VIEW.W, VIEW.H);
  }
}

/** Debug/testing helper: advance n fixed frames synchronously, then draw. */
game.step = (n = 1) => {
  for (let i = 0; i < n; i++) update();
  render();
};

// The UI font has to be ready before the first frame is drawn (it falls back to a system font after 3 s).
const fontsReady = Promise.race([loadFonts(import.meta.env.BASE_URL ?? './'), new Promise((r) => setTimeout(r, 3000))]);
fontsReady.then(() => startLoop({ update, render }));

// Offline support: cache everything after the first load (production only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
