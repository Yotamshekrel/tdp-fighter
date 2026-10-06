// ---------------------------------------------------------------------------
// Tournament: an 8-fighter single-elimination bracket.
//
//   quarter-finals (4 games) -> semi-finals (2 games) -> final (1 game)
//
// `rounds[r]` lists who is in round r (null = not decided yet):
//   rounds[0] the 8 entrants   rounds[1] the 4 quarter-final winners
//   rounds[2] the 2 finalists  rounds[3] the champion
// Match m of round r is between rounds[r][2m] and rounds[r][2m + 1]; its winner
// is written to rounds[r + 1][m]. The player always fights on the left (side 0).
//
// Pure logic (no DOM, no rendering) so it can be simulated headless.
// ---------------------------------------------------------------------------
import { Battle } from './battle.js';
import { CpuBot } from './cpu-bot.js';
import { rand } from './rng.js';

export const ROUND_NAMES = ['QUARTER-FINALS', 'SEMI-FINALS', 'FINAL'];
export const ROUND_LABELS = ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL']; // singular, for one match
export const MAX_FRAMES = 60 * 60 * 10; // safety net for a CPU-vs-CPU match

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Tournament {
  /**
   * @param {object}   player      the fighter the player picked
   * @param {object[]} roster      every character (the 7 opponents are drawn from it)
   * @param {string}   difficulty  CPU level, for the player's fights and the CPU-vs-CPU games
   */
  constructor(player, roster, difficulty = 'normal') {
    this.player = player;
    this.difficulty = difficulty;
    const others = shuffle(roster.filter((c) => c.id !== player.id)).slice(0, 7);
    this.rounds = [shuffle([player, ...others]), [null, null, null, null], [null, null], [null]];
    this.round = 0; // the round the player is in (or was knocked out in)
    this.alive = true;
  }

  get done() {
    return this.rounds[3][0] !== null;
  }
  get champion() {
    return this.rounds[3][0];
  }
  get roundName() {
    return ROUND_NAMES[Math.min(this.round, 2)];
  }
  get roundLabel() {
    return ROUND_LABELS[Math.min(this.round, 2)];
  }

  entrants(r, m) {
    return [this.rounds[r][2 * m], this.rounds[r][2 * m + 1]];
  }
  winnerOf(r, m) {
    return this.rounds[r + 1][m];
  }
  decided(r, m) {
    return this.winnerOf(r, m) !== null;
  }
  matchCount(r) {
    return this.rounds[r].length / 2;
  }

  /** Which match of round r has the player in it (or -1). */
  playerMatch(r = this.round) {
    for (let m = 0; m < this.matchCount(r); m++) if (this.entrants(r, m).some((c) => c?.id === this.player.id)) return m;
    return -1;
  }

  /** The player's next fight: { round, match, chars: [player, opponent] }, or null if they are out / it is over. */
  nextFight() {
    if (!this.alive || this.done) return null;
    const m = this.playerMatch();
    if (m < 0) return null;
    const [a, b] = this.entrants(this.round, m);
    return { round: this.round, match: m, chars: a.id === this.player.id ? [a, b] : [b, a] };
  }

  /** Record who won match m of round r. */
  setWinner(r, m, char) {
    this.rounds[r + 1][m] = char;
  }

  /** The player's fight is over: `won` or lost. Returns nothing; the other games are played by `simulate`. */
  recordPlayer(won) {
    const m = this.playerMatch();
    const [a, b] = this.entrants(this.round, m);
    const me = a.id === this.player.id ? a : b;
    const opp = me === a ? b : a;
    this.setWinner(this.round, m, won ? me : opp);
    if (!won) this.alive = false;
  }

  /** Play one CPU-vs-CPU game headless and return the winner (a draw is settled by a coin toss). */
  simulate(r, m) {
    const [a, b] = this.entrants(r, m);
    const battle = new Battle({ chars: [a, b], controllers: [new CpuBot(this.difficulty), new CpuBot(this.difficulty)] });
    let frames = 0;
    while (battle.matchWinner === undefined && frames++ < MAX_FRAMES) battle.update();
    const w = battle.matchWinner;
    return w ? w.def : rand() < 0.5 ? a : b;
  }

  /** Games of round r that still need a winner. */
  pending(r) {
    const out = [];
    for (let m = 0; m < this.matchCount(r); m++) if (!this.decided(r, m) && this.entrants(r, m).every(Boolean)) out.push(m);
    return out;
  }

  /** The player has finished round `this.round`: move on to the next one (if they are still in). */
  advance() {
    if (this.alive && this.round < 2) this.round++;
  }
}
