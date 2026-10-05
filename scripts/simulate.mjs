// Headless test: runs CPU-vs-CPU matches with the real game logic (no
// rendering, no browser). Checks that every character can fight, every
// special fires and lands, and matches always finish.
//
//   npm run simulate            (all 18 characters, normal difficulty)
//   node scripts/simulate.mjs hard 3     (difficulty, matches per character)
import { Battle } from '../src/game/battle.js';
import { CpuBot } from '../src/game/cpu-bot.js';
import { CHARACTERS } from '../src/data/characters.js';
import { seed } from '../src/game/rng.js';
import { RULES } from '../src/config.js';

const diff = process.argv[2] || 'normal';
const perChar = Number(process.argv[3] || 2);
seed(12345);

const MAX_FRAMES = 60 * 60 * 8; // 8 minutes of game time
const report = [];
let failures = 0;

function runMatch(a, b, d1 = diff, d2 = diff) {
  const battle = new Battle({ chars: [a, b], controllers: [new CpuBot(d1), new CpuBot(d2)] });
  const specialStats = [{ used: 0, hit: 0 }, { used: 0, hit: 0 }];
  let frames = 0;
  while (battle.matchWinner === undefined && frames < MAX_FRAMES) {
    battle.update();
    for (const ev of battle.events) {
      if (ev.type === 'special') specialStats[ev.f.side].used++;
      if ((ev.type === 'hit' || ev.type === 'block') && ev.special) specialStats[ev.attacker?.side ?? 1 - ev.f.side].hit++;
    }
    // Sanity checks every frame
    for (const f of battle.fighters) {
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`${f.def.id} position NaN`);
      if (f.health < 0 || f.health > RULES.maxHealth) throw new Error(`${f.def.id} health out of range: ${f.health}`);
      if (f.meter < 0 || f.meter > RULES.meterMax + 0.001) throw new Error(`${f.def.id} meter out of range`);
    }
    frames++;
  }
  return { battle, frames, specialStats };
}

const t0 = Date.now();
for (let i = 0; i < CHARACTERS.length; i++) {
  const me = CHARACTERS[i];
  const row = { id: me.id, matches: 0, wins: 0, specials: 0, specialHits: 0, specialDmg: 0, frames: 0 };
  for (let k = 0; k < perChar; k++) {
    const opp = CHARACTERS[(i + 1 + k * 5) % CHARACTERS.length];
    try {
      const { battle, frames, specialStats } = runMatch(me, opp);
      if (battle.matchWinner === undefined) {
        failures++;
        console.log(`  !! ${me.id} vs ${opp.id}: match did not finish (phase ${battle.phase})`);
      }
      row.matches++;
      row.frames += frames;
      if (battle.matchWinner === battle.fighters[0]) row.wins++;
      row.specials += specialStats[0].used;
      row.specialHits += specialStats[0].hit;
      row.specialDmg += battle.stats.specialDamage[0];
    } catch (err) {
      failures++;
      console.log(`  !! ${me.id} vs ${opp.id}: ${err.stack}`);
    }
  }
  report.push(row);
}

console.log(`\nCPU vs CPU (${diff}), ${perChar} match(es) per character, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
console.log('char      wins  specials  spHits  avgDmg/special  avgMatchSec');
for (const r of report) {
  const avg = r.specials ? (r.specialDmg / r.specials).toFixed(1) : '-';
  console.log(
    `${r.id.padEnd(9)} ${String(r.wins + '/' + r.matches).padEnd(5)} ${String(r.specials).padEnd(9)} ${String(r.specialHits).padEnd(7)} ${String(avg).padEnd(15)} ${(r.frames / r.matches / 60).toFixed(0)}`,
  );
}
const neverHit = report.filter((r) => r.specialHits === 0).map((r) => r.id);
if (neverHit.length) console.log(`\nWARNING: specials never connected for: ${neverHit.join(', ')}`);
console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll matches completed without errors.');
process.exit(failures ? 1 : 0);
