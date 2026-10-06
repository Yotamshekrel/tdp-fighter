// Pits CPU difficulty levels against each other (same characters, sides
// swapped half the time). Harder levels should win clearly more often.
import { Battle } from '../src/game/battle.js';
import { CpuBot } from '../src/game/cpu-bot.js';
import { CHARACTERS } from '../src/data/characters.js';
import { seed } from '../src/game/rng.js';

seed(99);
const N = Number(process.argv[2] || 60);
function duel(dA, dB) {
  let winsA = 0, draws = 0;
  for (let k = 0; k < N; k++) {
    const c1 = CHARACTERS[k % 18], c2 = CHARACTERS[(k * 7 + 3) % 18];
    const swap = k % 2 === 1;
    const bots = swap ? [new CpuBot(dB), new CpuBot(dA)] : [new CpuBot(dA), new CpuBot(dB)];
    const b = new Battle({ chars: [c1, c2], controllers: bots });
    let f = 0;
    while (b.matchWinner === undefined && f++ < 60 * 60 * 10) b.update();
    if (b.matchWinner === null || b.matchWinner === undefined) draws++;
    else if ((b.matchWinner.side === 0) !== swap) winsA++;
  }
  console.log(`${dA.padEnd(6)} vs ${dB.padEnd(6)}: ${dA} wins ${winsA}/${N} (${Math.round((winsA / N) * 100)}%), draws ${draws}`);
}
duel('extreme', 'hard');
duel('extreme', 'normal');
duel('hard', 'easy');
duel('hard', 'normal');
duel('normal', 'easy');
duel('normal', 'normal');
