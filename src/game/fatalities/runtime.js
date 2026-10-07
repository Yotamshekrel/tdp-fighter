// ---------------------------------------------------------------------------
// Runs a fatality (grown-up mode): "FINISH HIM!", the winner walks up to the dazed loser, the fighter's own
// finishing move plays out, the winner takes a bow, and then the match ends.
//
// A fatality is an object (see index.js and the files next to it):
//   name      shown nowhere yet, handy for the sprite tool
//   dist      how far apart the two stand when it starts
//   zoom      camera zoom while it plays (default 1.35)
//   duration  frames of script (t = 0 is the moment the winner is in place)
//   killAt    frame on which the FATALITY banner hits (default: whenever the script calls fatalityBanner itself)
//   start(w, l, b, F)         once, at t = 0
//   update(w, l, b, t, F)     every frame, t = 0..duration
//   drawBack / draw(g, w, l, b, t, F)   world-space props behind / in front of the fighters
// F is the live state: { def, w, l, s, t, banner, d } where `d` is scratch space for the script.
// ---------------------------------------------------------------------------
import { VIEW, BODY } from '../../config.js';
import { FATALITIES, FALLBACK } from './index.js';
import { GY, ease, lerp, clamp, stepPieces, fatalityBanner } from './kit.js';

const PRELUDE = 84; // frames of "FINISH HIM!"
const AFTER = 150; // frames after the script, before the match ends

export function startFatality(b, w, l) {
  const def = FATALITIES[w.def.id] || FALLBACK;
  const s = Math.sign(w.x - l.x) || -l.facing || 1; // which side of the victim the winner is on
  const half = def.dist / 2;
  const mid = clamp((w.x + l.x) / 2, VIEW.LEFT + half + 14, VIEW.RIGHT - half - 14);
  b.fatal = {
    def, w, l, s, t: -PRELUDE, banner: false, d: {},
    from: [w.x, l.x], to: [mid + s * half, mid - s * half],
  };
  b.entities = [];
  b.hitstop = 0;
  b.freeze = { t: 0, owner: null, total: 0 };
  b.slowmo = 0;
  b.posed = true;
  for (const f of [w, l]) {
    f.go('fatal');
    f.held = true;
    f.noPush = true;
    f.vx = f.vy = 0;
    f.y = GY;
    f.grounded = true;
    f.attack = null;
    f.stun = null;
    f.gore = null;
    f.costume = null;
    f.scale = BODY.SCALE;
  }
  w.facing = -s;
  l.facing = s;
  l.fpose = { pose: 'hit', frame: 1 };
  w.fpose = { pose: 'run', frame: 0 };
  b.announce = { text: 'FINISH HIM!', t: 0, kind: 'finish' };
  b.event('finishHim');
  b.phase = 'fatality';
  b.phaseT = 0;
}

export function updateFatality(b) {
  const F = b.fatal;
  if (!F) return;
  const { def, w, l } = F;
  F.t++;

  if (F.t <= 0) {
    // the winner walks up, the loser staggers to their feet
    const u = (PRELUDE + F.t) / PRELUDE;
    const e = ease(Math.min(1, u / 0.72));
    w.x = lerp(F.from[0], F.to[0], e);
    l.x = lerp(F.from[1], F.to[1], e);
    w.fpose = u < 0.72 ? { pose: 'walk', frame: Math.floor(F.t / 6) % 4 } : { pose: 'idle', frame: Math.floor(F.t / 22) % 2 };
    l.fpose = { pose: u < 0.2 ? 'fall' : 'hit', frame: Math.floor(F.t / 16) % 2 };
    if (F.t === 0) {
      b.announce = null;
      def.start?.(w, l, b, F);
    }
    return;
  }

  def.update?.(w, l, b, F.t, F);
  stepPieces(l, b);
  if (def.killAt !== undefined && F.t === def.killAt) fatalityBanner(b, F);

  if (F.t === def.duration) {
    def.end?.(w, l, b, F);
    w.fpose = { pose: 'win', frame: 0 };
  }
  if (F.t > def.duration) {
    w.fpose = { pose: 'win', frame: Math.floor((F.t - def.duration) / 14) % 2 };
    if (F.t === def.duration + 36) {
      b.announce = { text: `${w.def.name} WINS`, t: 0, kind: 'wins' };
      b.event('roundWin', { f: w });
    }
  }
  if (F.t >= def.duration + AFTER) {
    b.fatal = null;
    b.lens = null;
    b.nextRound();
  }
}
