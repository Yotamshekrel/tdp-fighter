// ---------------------------------------------------------------------------
// Joint positions for every hi-res fighter.
//
// All the pictures in assets/new_photos/ show the same relaxed pose (facing
// right, arms down), so every rig starts from the same proportions: TEMPLATE.
// Coordinates are NORMALISED: the figure is scaled to a height of 1000 and
//   x = offset from the torso's centre line,  y = distance from the top of the head.
// scripts/build-fighters.mjs converts them back to pixels of each picture.
//
//   neck       pivot of the head;  the head piece is everything above `chin + HEAD_CUT_BELOW_CHIN`
//   pelvis     pivot of the torso; the torso ends at `hipCut`, the legs begin there
//   F = front (the character's right, on the viewer's right), B = back
//
// OVERRIDES moves individual joints for a character whose picture differs.
// ---------------------------------------------------------------------------

export const TEMPLATE = {
  neck: [4, 235],
  shoulderB: [-135, 265], shoulderF: [115, 250],
  elbowB: [-185, 406], elbowF: [155, 406],
  handB: [-175, 545], handF: [170, 540],
  pelvis: [8, 480],
  hipB: [-42, 515], hipF: [66, 515],
  kneeB: [-72, 705], kneeF: [78, 705],
  soleB: [-100, 985], soleF: [115, 950],
};

/** Where the head piece ends, below the chin (normalised px). */
export const HEAD_CUT_BELOW_CHIN = 16;
/** The torso piece ends this far below the pelvis pivot (normalised px). */
export const HIP_CUT_BELOW_PELVIS = 32;
/** The thigh piece ends this far above the knee joint (normalised px); the shin starts there. */
export const KNEE_CUT_ABOVE_KNEE = 52;

/**
 * chin   y of the bottom of the chin / beard (head and neck are cut just below)
 * hipCut optional absolute override of the torso / leg split (long jackets)
 * joints optional per-joint overrides
 */
export const RIGS = {
  ayoub: { chin: 205 },
  ben: { chin: 195 },
  danny: { chin: 180 },
  dvir: { chin: 195 },
  eshel: { chin: 190 },
  gal: { chin: 150, joints: { elbowB: [-175, 406] } },
  hadar: { chin: 150, hipCut: 545, joints: { shoulderB: [-125, 255], elbowB: [-160, 406], handB: [-170, 545] } },
  ido: { chin: 200 },
  maya: { chin: 150, joints: { shoulderB: [-120, 265], elbowB: [-148, 406], handB: [-160, 545] } },
  mor: { chin: 190 },
  nadav: { chin: 185 },
  nethanel: { chin: 170 },
  noa: { chin: 150 },
  'noa-ple': { chin: 185 },
  ofek: { chin: 185 },
  ofir: { chin: 200 },
  rashida: { chin: 175 },
  shay: { chin: 145 },
  yaara: { chin: 150, joints: { elbowB: [-165, 406] } },
  yair: { chin: 185 },
  yotam: { chin: 190 },
  yovel: { chin: 195 },
};
