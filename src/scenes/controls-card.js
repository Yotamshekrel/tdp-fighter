// "Get ready" card shown before every match: reminds players of their buttons.
// Labels come from KEYS in config.js, so rebinding keys updates this card.
import { VIEW, KEYS } from '../config.js';
import { drawText, textWidth } from '../render/font.js';
import { COLORS, glass, rrPath, vgrad, GOLD } from '../render/ui-kit.js';
import { dim } from './ui.js';

const LABEL = { ArrowLeft: '◀', ArrowRight: '▶', ArrowUp: '▲', ArrowDown: '▼', Semicolon: ';', Space: 'SPACE', Enter: 'ENTER' };
const keyName = (codes) => LABEL[codes[0]] || codes[0].replace('Key', '').replace('Digit', '');

/** A little keyboard key with a label. Returns its width. */
function keycap(g, label, x, y) {
  const w = Math.max(15, textWidth(label, 1.2) + 9);
  rrPath(g, x, y + 1.8, w, 12.5, 3);
  g.fillStyle = '#8f98c8';
  g.fill();
  rrPath(g, x, y, w, 12.5, 3);
  g.fillStyle = vgrad(g, y, y + 12.5, [[0, '#ffffff'], [1, '#d8def5']]);
  g.fill();
  drawText(g, label, x + w / 2, y + 2.6, { scale: 1.2, align: 'center', color: '#141830', weight: 800, italic: false });
  return w;
}

/** Key caps followed by a caption, e.g. [◀][▶] MOVE */
function binding(g, labels, caption, x, y, color = '#ffffff') {
  let cx = x;
  for (const l of labels) cx += keycap(g, l, cx, y) + 2.5;
  drawText(g, caption, cx + 3, y + 3, { scale: 1.3, color, shadow: 'rgba(0,0,0,0.6)' });
  return cx + 3 + textWidth(caption, 1.3);
}

/** Draw the card. layout = KEYS.solo for 1P, [KEYS.p1, KEYS.p2] for 2P. */
export function drawControlsCard(g, { mode, chars, t, total }) {
  const { W, H } = VIEW;
  dim(g, 0.7);
  glass(g, 28, 30, W - 56, 210, { accent: '#ffd23f' });
  drawText(g, 'GET READY!', W / 2, 38, { scale: 3.8, align: 'center', color: GOLD, outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
  drawText(g, 'YOUR CONTROLS', W / 2, 70, { scale: 1.3, align: 'center', color: COLORS.dim });

  if (mode === '2p') {
    [KEYS.p1, KEYS.p2].forEach((k, i) => {
      const x = i === 0 ? 50 : 258;
      drawText(g, `PLAYER ${i + 1}: ${chars[i].name}`, x, 86, { scale: 1.6, color: COLORS.side[i].a, outline: 'rgba(5,6,24,0.8)', italic: true });
      binding(g, [keyName(k.left), keyName(k.right)], 'MOVE', x, 104);
      binding(g, [keyName(k.up)], 'JUMP', x, 122);
      binding(g, [keyName(k.down)], 'CROUCH', x + 86, 122);
      binding(g, [keyName(k.attack)], 'ATTACK', x, 140, '#ffd23f');
      binding(g, [keyName(k.defend)], 'DEFEND', x, 158, '#5ad0ff');
      binding(g, [keyName(k.special)], `SPECIAL: ${chars[i].special.name}`, x, 176, '#ff8cf0');
    });
  } else {
    const k = KEYS.solo;
    const c = chars[0];
    binding(g, [keyName(k.left), keyName(k.right)], 'MOVE', 64, 88);
    binding(g, [keyName(k.up)], 'JUMP', 196, 88);
    binding(g, [keyName(k.down)], 'CROUCH', 292, 88);
    binding(g, [keyName(k.attack)], 'ATTACK', 64, 112, '#ffd23f');
    binding(g, [keyName(k.defend)], 'DEFEND', 196, 112, '#5ad0ff');
    binding(g, [keyName(k.special)], 'SPECIAL', 292, 112, '#ff8cf0');
    const a = keyName(k.attack);
    drawText(g, `${keyName(k.down)} + ${a} = LOW KICK      ${keyName(k.up)} + ${a} = AIR KICK`, W / 2, 138, { scale: 1.3, align: 'center', color: COLORS.text });
    drawText(g, `${keyName(k.down)} + ${keyName(k.defend)} = BLOCK LOW`, W / 2, 151, { scale: 1.3, align: 'center', color: COLORS.text });
    drawText(g, `FULL METER + ${keyName(k.special)} = ${c.special.name}!`, W / 2, 167, { scale: 1.5, align: 'center', color: '#ff8cf0', italic: true });
  }
  const extra = [];
  if (navigator.getGamepads && Array.from(navigator.getGamepads()).some(Boolean)) extra.push('GAMEPAD: A JUMP  X ATTACK  B DEFEND  Y SPECIAL');
  if (document.body.classList.contains('touch-mode')) extra.push('TOUCH: USE THE ON-SCREEN BUTTONS');
  extra.push('ESC = PAUSE    M = MUTE');
  extra.forEach((s, i) => drawText(g, s, W / 2, 190 + i * 10 - (extra.length - 1) * 10, { scale: 1.1, align: 'center', color: COLORS.dim }));

  const go = mode === '2p' ? `PRESS ${keyName(KEYS.p1.attack)} OR ${keyName(KEYS.p2.attack)} TO FIGHT!` : `PRESS ${keyName(KEYS.solo.attack)} TO FIGHT!`;
  if (t % 44 < 32) drawText(g, go, W / 2, 205, { scale: 2.3, align: 'center', color: ['#ffffff', '#ffd23f'], outline: 'rgba(5,6,24,0.9)', glow: '#ffb62e' });
  // auto-start countdown bar
  const w = (W - 80) * Math.max(0, 1 - t / total);
  rrPath(g, 40, 230, W - 80, 2.4, 1.2);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fill();
  rrPath(g, 40, 230, Math.max(0.1, w), 2.4, 1.2);
  g.fillStyle = '#ffd23f';
  g.fill();
  void H;
}
