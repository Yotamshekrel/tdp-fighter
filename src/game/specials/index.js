// ---------------------------------------------------------------------------
// Special attack registry. A character's config picks one by `special.type`.
// Several characters may share a type (with different names/colours).
//
// A special is an object:
//   windup     frames of "super freeze" wind-up (everyone else is frozen)
//   duration   max frames of the active part after the wind-up
//   aiRange    [min, max] distance at which the CPU likes to use it
//   guard      optional 'low' (block crouching) / escape: 'jump' (grab) hints for the CPU
//   costume    sprite variant while active (or function (f, t) => variant)
//   anim(f,t)  -> { pose, frame }
//   start(f,b) / update(f,b,t,opp) / end(f,b,interrupted)
//   draw(ctx,f,b,t)   optional world-space overlay
// ---------------------------------------------------------------------------
import laserEyes from './laser-eyes.js';
import babyRattle from './baby-rattle.js';
import caneWhack from './cane-whack.js';
import trophyBoomerang from './trophy-boomerang.js';
import magicBolt from './magic-bolt.js';
import handFlurry from './hand-flurry.js';
import sprintDash from './sprint-dash.js';
import surfWave from './surf-wave.js';
import tequilaToss from './tequila-toss.js';
import acBlast from './ac-blast.js';
import bugSwarm from './bug-swarm.js';
import bearHug from './bear-hug.js';
import dessertBarrage from './dessert-barrage.js';
import spineChoke from './spine-choke.js';
import jackpotRain from './jackpot-rain.js';
import baguette from './baguette.js';
import giantStomp from './giant-stomp.js';
import soundBlast from './sound-blast.js';
import kaderLecture from './kader-lecture.js';

export const SPECIALS = {
  laserEyes, babyRattle, caneWhack, trophyBoomerang, magicBolt, handFlurry,
  sprintDash, surfWave, tequilaToss, acBlast, bugSwarm, bearHug,
  dessertBarrage, spineChoke, jackpotRain, baguette, giantStomp, soundBlast, kaderLecture,
};

export function getSpecial(type) {
  const s = SPECIALS[type];
  if (!s) {
    console.warn(`Unknown special type "${type}", falling back to magicBolt`);
    return SPECIALS.magicBolt;
  }
  return s;
}
