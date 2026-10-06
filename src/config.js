// ---------------------------------------------------------------------------
// Global tunables. Everything you might want to tweak lives here:
// resolution, physics, combat numbers, key bindings, CPU difficulty.
// ---------------------------------------------------------------------------

/** Internal (pre-upscale) resolution. The canvas is scaled up with crisp pixels. */
export const VIEW = {
  W: 480,
  H: 270,
  SCALE: 4, // backing-store pixels per game pixel (hi-res sprites such as Ido's draw at this density)
  GROUND_Y: 236, // screen y of the floor (fighters' feet)
  LEFT: 22, // arena wall (left), fighter centre can't go past this
  RIGHT: 458, // arena wall (right)
};

/** How big fighters are on screen (and in the game: hitboxes, pushboxes and special origins all follow it). */
export const BODY = { SCALE: 1.22 };

export const FPS = 60;

/** Physics, in pixels per frame (at 60 FPS). Positive y is DOWN (screen space). */
export const PHYS = {
  gravity: 0.55,
  jumpVel: 9.6, // initial upward speed of a jump
  jumpVx: 2.6, // horizontal speed of a forward/back jump
  walkFwd: 2.0,
  walkBack: 1.65,
  groundFriction: 0.8, // knockback velocity multiplier per frame on the ground
  pushWidth: 20, // pushbox width (fighters can't overlap)
};

/** Match rules and combat economy. */
export const RULES = {
  maxHealth: 100,
  roundSeconds: 99,
  roundsToWin: 2, // best of 3
  meterMax: 100,
  meterPerDamageDealt: 1.6,
  meterPerDamageTaken: 1.2,
  meterPerBlock: 3,
  blockChip: 0.15, // blocked normal attacks deal 15% damage
  specialChip: 0.25, // blocked specials deal 25%
  specialDamage: 22, // every special is balanced around this total
};

/**
 * Normal attacks (same for everyone; stats only tweak reach a little).
 * Frame data: startup -> active -> recovery. Boxes are relative to the
 * fighter's feet, facing right (x forward, y negative = up).
 * guard: 'mid' (any block), 'low' (crouch block only), 'high' (standing block only)
 */
export const ATTACKS = {
  stand: {
    startup: 5, active: 3, recovery: 12, cooldown: 6,
    damage: 7, guard: 'mid', hitstun: 16, blockstun: 11, push: 4.2, hitstop: 7,
    box: { x: 6, y: -58, w: 26, h: 16 }, sfx: 'punch',
  },
  crouch: {
    startup: 6, active: 3, recovery: 14, cooldown: 6,
    damage: 6, guard: 'low', hitstun: 15, blockstun: 10, push: 3.6, hitstop: 6,
    box: { x: 6, y: -14, w: 30, h: 14 }, sfx: 'kick',
  },
  air: {
    startup: 4, active: 14, recovery: 0, cooldown: 4,
    damage: 8, guard: 'high', hitstun: 17, blockstun: 10, push: 3.2, hitstop: 7,
    box: { x: 2, y: -30, w: 26, h: 28 }, sfx: 'kick',
  },
};

/**
 * Keyboard bindings (KeyboardEvent.code). Change them here and only here.
 * Each action can have several keys.
 */
export const KEYS = {
  // Single-player (1P vs CPU): arrows to move, Z / X / C to attack / defend / special.
  solo: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    attack: ['KeyZ'], defend: ['KeyX'], special: ['KeyC'],
  },
  // Two players on one keyboard:
  p1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    attack: ['KeyF'], defend: ['KeyG'], special: ['KeyH'],
  },
  p2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    attack: ['KeyK'], defend: ['KeyL'], special: ['Semicolon'],
  },
  // Menu / system keys (work for anyone)
  confirm: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
};

/** Standard-mapping gamepad buttons (Xbox layout names in comments). */
export const PAD = {
  attack: [2], // X
  defend: [1, 4], // B, LB
  special: [3, 5, 7], // Y, RB, RT
  jump: [0, 12], // A, d-pad up
  down: [13],
  left: [14],
  right: [15],
  confirm: [0, 9], // A, Start
  back: [1, 8], // B, Back
  pause: [9], // Start
  deadzone: 0.45,
};

/**
 * CPU difficulty. The bot logic is identical at every level; only these
 * numbers change. See src/game/cpu-bot.js.
 *  reaction      frames of delay before the bot "sees" what you do
 *  tick          [min,max] frames between decisions
 *  blockChance   chance to block an incoming attack it noticed
 *  attackRate    multiplier on attack weights in the decision tables
 *  punishChance  chance to counter-attack after your whiffed attack
 *  specialChance chance per decision to fire a full meter (when in range)
 *  antiAir       chance to react to a jump-in
 *  sloppiness    chance to make a random dumb move
 */
export const CPU_DIFFICULTY = {
  easy: {
    reaction: 26, tick: [18, 30], blockChance: 0.18, attackRate: 0.55,
    punishChance: 0.12, specialChance: 0.25, antiAir: 0.1, sloppiness: 0.3,
  },
  normal: {
    reaction: 15, tick: [10, 20], blockChance: 0.5, attackRate: 1.0,
    punishChance: 0.45, specialChance: 0.6, antiAir: 0.35, sloppiness: 0.1,
  },
  hard: {
    reaction: 7, tick: [7, 13], blockChance: 0.82, attackRate: 1.3,
    punishChance: 0.85, specialChance: 0.95, antiAir: 0.65, sloppiness: 0.02,
  },
  // Harder than hard: reacts a few frames after you commit, blocks and punishes almost everything,
  // jumps out of grabs, never wastes a move and fires the special the moment it can land.
  extreme: {
    reaction: 4, tick: [3, 7], blockChance: 0.9, attackRate: 1.8,
    punishChance: 1.0, specialChance: 1.0, antiAir: 0.85, sloppiness: 0,
  },
};

/** Pixel-art head size produced by the photo pipeline. */
export const HEAD = { W: 28, H: 32, COLORS: 16 };
