// Deterministic special-attack test: each character fires their special at a
// dummy (standing still, or holding block) from several distances, and we
// measure the damage dealt. Balanced specials should land ~22 vs idle and
// ~5.5 (chip) vs block from most ranges.
import { Battle } from '../src/game/battle.js';
import { CHARACTERS } from '../src/data/characters.js';
import { seed } from '../src/game/rng.js';
import { RULES } from '../src/config.js';

const NONE = { left: false, right: false, up: false, down: false, attack: false, defend: false, special: false };
const DISTS = [40, 120, 220, 320];
let problems = 0;

function trial(ch, dist, dummy) {
  seed(7);
  let pressed = false;
  const caster = { read: (b, f) => {
    if (!b.live) return NONE;
    if (!pressed) { pressed = true; return { ...NONE, special: true }; }
    return NONE;
  } };
  const target = { read: () => (dummy === 'block' ? { ...NONE, defend: true } : dummy === 'crouchblock' ? { ...NONE, defend: true, down: true } : NONE) };
  const b = new Battle({ chars: [ch, CHARACTERS[0]], controllers: [caster, target] });
  // skip intro
  while (!b.live) b.update();
  const [a, d] = b.fighters;
  a.x = 240 - dist / 2; d.x = 240 + dist / 2;
  a.meter = RULES.meterMax;
  let started = false, t = 0;
  while (t < 600) {
    b.update();
    if (a.state === 'special') started = true;
    if (started && a.state !== 'special' && b.entities.length === 0 && d.state !== 'hitstun') break;
    t++;
  }
  return { dmg: RULES.maxHealth - d.health, started, frames: t };
}

console.log('char      special          ' + DISTS.map((d) => `idle@${d}`.padEnd(9)).join('') + DISTS.map((d) => `blk@${d}`.padEnd(8)).join('') + 'lowblk@120');
for (const ch of CHARACTERS) {
  const idle = DISTS.map((d) => trial(ch, d, 'idle'));
  const blk = DISTS.map((d) => trial(ch, d, 'block'));
  const low = trial(ch, 120, 'crouchblock');
  if (!idle[0].started) { console.log(`${ch.id}: special never started!`); problems++; }
  console.log(
    `${ch.id.padEnd(9)} ${ch.special.type.padEnd(16)} ` +
    idle.map((r) => r.dmg.toFixed(1).padEnd(9)).join('') +
    blk.map((r) => r.dmg.toFixed(1).padEnd(8)).join('') + low.dmg.toFixed(1),
  );
}
process.exit(problems ? 1 : 0);
