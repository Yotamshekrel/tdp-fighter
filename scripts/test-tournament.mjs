// Headless test of the tournament bracket: plays whole tournaments with a CPU
// standing in for the player and checks the bracket logic (8 distinct fighters,
// 4 + 2 + 1 games, winners advance, elimination, champion).
//
//   node scripts/test-tournament.mjs [tournaments]
import { Battle } from '../src/game/battle.js';
import { CpuBot } from '../src/game/cpu-bot.js';
import { CHARACTERS } from '../src/data/characters.js';
import { Tournament } from '../src/game/tournament.js';
import { seed } from '../src/game/rng.js';

seed(7);
const N = Number(process.argv[2] || 30);
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  !! ' + msg); } };

function playerFight(T) {
  const f = T.nextFight();
  const b = new Battle({ chars: f.chars, controllers: [new CpuBot(T.difficulty), new CpuBot(T.difficulty)] });
  for (let i = 0; i < 60 * 60 * 10 && b.matchWinner === undefined; i++) b.update();
  return b.matchWinner ? b.matchWinner.side === 0 : null; // null = draw
}

const stats = { champion: 0, out: [0, 0, 0] };
let games = 0;
for (let k = 0; k < N; k++) {
  const player = CHARACTERS[k % CHARACTERS.length];
  const T = new Tournament(player, CHARACTERS, ['easy', 'normal', 'hard', 'extreme'][k % 4]);
  const ids = T.rounds[0].map((c) => c.id);
  check(ids.length === 8 && new Set(ids).size === 8, `entrants not 8 distinct fighters: ${ids}`);
  check(ids.includes(player.id), 'player missing from bracket');

  for (let r = 0; r < 3; r++) {
    check(T.round === (T.alive ? r : T.round), `round pointer ${T.round} != ${r}`);
    if (T.alive) {
      const won = playerFight(T);
      if (won === null) { r--; continue; } // draw -> rematch
      T.recordPlayer(won);
      games++;
    }
    for (const m of T.pending(r)) { T.setWinner(r, m, T.simulate(r, m)); games++; }
    for (let m = 0; m < T.matchCount(r); m++) {
      const w = T.winnerOf(r, m);
      check(!!w && T.entrants(r, m).includes(w), `round ${r} match ${m} winner is not one of its entrants`);
    }
    check(T.rounds[r + 1].every(Boolean), `round ${r + 1} not filled`);
    if (T.alive) T.advance();
  }
  check(T.done && T.rounds[2].includes(T.champion), 'champion is not a finalist');
  if (T.alive) stats.champion++; else stats.out[T.round]++;
}
check(games === N * 7, `expected ${N * 7} games, played ${games}`);
console.log(`${N} tournaments, ${games} games: player champion ${stats.champion}x, knocked out in QF/SF/F ${stats.out.join('/')}`);
console.log(failures ? `FAILED (${failures})` : 'OK');
process.exit(failures ? 1 : 0);
