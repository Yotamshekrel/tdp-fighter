// ---------------------------------------------------------------------------
// Grown-up mode, the everyday part: blood when a fighter is hit, wounds that stay on the body, drips from
// whoever is hurt, a pool under whoever is down. (The finishing move is in game/fatalities/.)
// How the wounds look on the sprite is in render/damage.js (painted into the sprite frame, so they follow the pose).
// ---------------------------------------------------------------------------
import { RULES } from '../config.js';
import { rand, randRange, randInt, pick } from './rng.js';
import { spray, mist, at, BLOODS } from './fatalities/kit.js';

/** A hit connected: blood flies away from the attacker. (The cuts and bruises themselves come from health, see render/damage.js.) */
export function goreHit(b, attacker, defender, dmg, hit, dir, px, py) {
  const n = Math.round(5 + dmg * 1.3 + (hit.knockdown ? 5 : 0) + (hit.special ? 3 : 0));
  spray(b, px, py, n, { angle: dir > 0 ? -0.3 : Math.PI + 0.3, spread: 2.3, speed: 2.4 + dmg * 0.13, size: 2.2 });
  if (dmg >= 8) mist(b, px, py, 2);
}

/** A fighter has just been knocked out: a last big burst. */
export function goreKO(b, f) {
  const c = at(f, 0, -40);
  spray(b, c.x, c.y, 26, { speed: 5.2, size: 2.8, angle: -Math.PI / 2, spread: 4.5 });
  mist(b, c.x, c.y, 4, 8);
}

/** Every frame: drips from the wounded, and a pool spreading under the fighter who is down. */
export function goreTick(b) {
  for (const f of b.fighters) {
    if (f.state === 'ko' && f.grounded && !f.poolDone) {
      f.poolDone = true;
      b.fx.pool(f.x, 24 + rand() * 10);
    }
    if (!b.live || f.state === 'ko') continue;
    const sev = 1 - f.health / RULES.maxHealth;
    if (sev < 0.3) continue;
    if (b.frame % Math.max(5, Math.round(26 - sev * 20)) !== 0) continue;
    // from the nose, the arm or the chest: wherever the sprite is wounded, wherever the fighter is right now
    const V = f.vis;
    const k = randInt(0, 2);
    const p = V
      ? k === 0 ? { x: V.mouth.x, y: V.mouth.y + 3 } : k === 1 ? { x: V.hand.x, y: V.hand.y + 2 } : { x: (V.mouth.x + f.x) / 2, y: V.mouth.y + 20 * f.scale }
      : at(f, 0, -36);
    b.fx.spawn('blood', p.x, p.y, { vx: randRange(-0.3, 0.3), vy: 0, g: 0.22, life: 50, size: 2, color: pick(BLOODS), land: 'stain' });
  }
}
