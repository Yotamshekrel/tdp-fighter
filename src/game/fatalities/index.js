// ---------------------------------------------------------------------------
// The fatalities (grown-up mode), one per fighter, each tied to that fighter's special. Keyed by character id.
// To give a new fighter one: write it with the toolkit in kit.js (see the other files here for examples)
// and add it below. A fighter without one gets the plain FALLBACK burst, so the game never breaks.
// ---------------------------------------------------------------------------
import { yotam, ofek, noa, ben, nethanel } from './blades.js';
import { gal, ido, yair, nadav, noaPle, danny } from './crush.js';
import { ayoub, maya, shay, rashida, dvir, yaara, tal } from './burst.js';
import { ofir, hadar, yovel, mor, eshel } from './decay.js';
import { grid, free, spray, chunks, lens, randRange } from './kit.js';

export const FATALITIES = {
  yotam, gal, ofir, ofek, ayoub, eshel, ben, dvir, hadar, yair, yovel, yaara, maya, mor, nadav, noa, ido, shay, nethanel,
  rashida, 'noa-ple': noaPle, danny, tal,
};

/** For a fighter without a finisher of their own: they simply burst. */
export const FALLBACK = {
  name: 'BURST',
  dist: 80,
  zoom: 1.3,
  duration: 90,
  killAt: 20,
  update(w, l, b, t) {
    w.fpose = { pose: 'cast', frame: t > 16 ? 1 : 0 };
    l.fpose = { pose: 'hit', frame: 1 };
    if (t === 20) {
      grid(l, 3, 5, -22, 22).forEach((p) => free(p, { vx: randRange(-5, 5), vy: -randRange(2, 8), vr: randRange(-0.3, 0.3), g: 0.36 }));
      spray(b, l.x, l.y - 50, 40, { speed: 6 });
      chunks(b, l.x, l.y - 50, 14, { speed: 6 });
      b.sfx('gore', l.x);
      b.addShake(10);
      lens(b, 4);
    }
  },
};
