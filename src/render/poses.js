// ---------------------------------------------------------------------------
// Hand-authored pose skeletons for the shared pixel-art body template.
//
// Coordinates are pixels relative to the fighter's feet (0,0), facing right
// (+x = forward, -y = up). Each pose is a list of frames; each frame gives:
//   hip, chest (shoulder line), head (offset of chin from chest), headRot
//   fe/fh = front elbow/hand, be/bh = back elbow/hand
//   fk/ff = front knee/foot, bk/bf = back knee/foot
// The sprite builder (sprites.js) draws limbs between these joints.
// ---------------------------------------------------------------------------

const BASE = {
  hip: [0, -26], chest: [1, -48], head: [1, -2], headRot: 0,
  fe: [9, -38], fh: [14, -46], be: [3, -37], bh: [9, -43],
  fk: [6, -13], ff: [8, 0], bk: [-5, -13], bf: [-8, 0],
};

/** New frame = BASE (or another frame) + overrides. */
const P = (o, base = BASE) => ({ ...base, ...o });

/** Shift the upper body (everything above the knees) by dy. */
function bob(f, dy) {
  const s = (p) => [p[0], p[1] + dy];
  return { ...f, hip: s(f.hip), chest: s(f.chest), fe: s(f.fe), fh: s(f.fh), be: s(f.be), bh: s(f.bh), fk: s(f.fk), bk: s(f.bk) };
}

const LUNGE = { hip: [1, -26], fk: [9, -13], ff: [12, 0], bk: [-5, -12], bf: [-10, 0] };
const CROUCH = P({
  hip: [-1, -14], chest: [3, -34], fk: [9, -12], ff: [8, 0], bk: [-4, -5], bf: [-12, 0],
  fe: [10, -26], fh: [15, -32], be: [5, -24], bh: [11, -29],
});

export const POSES = {
  idle: [BASE, bob(BASE, 1)],

  walk: [
    P({ fk: [7, -13], ff: [11, 0], bk: [-5, -13], bf: [-9, 0] }),
    bob(P({ fk: [6, -14], ff: [3, -3], bk: [-1, -13], bf: [-2, 1] }), -1),
    P({ fk: [-3, -13], ff: [-7, 0], bk: [5, -13], bf: [9, 0] }),
    bob(P({ fk: [0, -13], ff: [-1, 1], bk: [4, -14], bf: [3, -3] }), -1),
  ],

  jumpUp: [P({
    hip: [0, -30], chest: [1, -52], fk: [8, -24], ff: [4, -14], bk: [-2, -20], bf: [-8, -12],
    fe: [8, -44], fh: [12, -52], be: [2, -42], bh: [7, -50],
  })],
  jumpDown: [P({
    hip: [0, -28], chest: [1, -50], fk: [5, -16], ff: [6, -4], bk: [-4, -16], bf: [-7, -5],
    fe: [9, -44], fh: [13, -50], be: [-6, -46], bh: [-10, -52],
  })],

  crouch: [CROUCH],

  punch: [
    P({ chest: [0, -48], fe: [5, -38], fh: [8, -45], be: [6, -38], bh: [12, -44] }),
    P({ ...LUNGE, chest: [4, -47], fe: [14, -46], fh: [26, -48], be: [1, -38], bh: [5, -42] }),
    P({ ...LUNGE, chest: [3, -47], fe: [12, -43], fh: [20, -46], be: [1, -38], bh: [5, -42] }),
  ],

  lowKick: [
    P({ fk: [10, -10], ff: [6, -2] }, CROUCH),
    P({ hip: [-2, -14], chest: [0, -34], fk: [12, -8], ff: [26, -3], bk: [-6, -5], bf: [-14, 0], fe: [6, -26], fh: [10, -30], be: [-4, -26], bh: [-8, -22] }, CROUCH),
    P({ hip: [-2, -14], chest: [1, -34], fk: [10, -9], ff: [20, -3], bk: [-6, -5], bf: [-14, 0], fe: [6, -26], fh: [10, -30], be: [-4, -26], bh: [-8, -22] }, CROUCH),
  ],

  airKick: [
    P({ hip: [0, -30], chest: [1, -52], fk: [8, -24], ff: [4, -14], bk: [-2, -20], bf: [-8, -12], fe: [8, -44], fh: [12, -52], be: [2, -42], bh: [7, -50] }),
    P({ hip: [0, -30], chest: [-2, -52], fk: [11, -26], ff: [24, -20], bk: [-3, -20], bf: [-6, -12], fe: [4, -44], fh: [8, -50], be: [-6, -44], bh: [-11, -48] }),
  ],

  block: [P({ chest: [0, -48], fe: [10, -40], fh: [13, -50], be: [6, -40], bh: [15, -45] })],
  crouchBlock: [P({ chest: [2, -34], fe: [9, -24], fh: [9, -38], be: [5, -24], bh: [11, -34] }, CROUCH)],

  hit: [
    P({ hip: [-1, -26], chest: [-4, -47], head: [-2, -2], fe: [2, -40], fh: [7, -35], be: [-9, -42], bh: [-12, -49], fk: [5, -13], ff: [7, 0], bk: [-6, -12], bf: [-10, 0] }),
    P({ hip: [-1, -26], chest: [-3, -47], head: [-1, -2], fe: [3, -39], fh: [8, -34], be: [-8, -41], bh: [-12, -46], fk: [5, -13], ff: [7, 0], bk: [-6, -12], bf: [-10, 0] }),
  ],
  crouchHit: [P({ chest: [-1, -33], head: [-2, -2], fe: [5, -24], fh: [9, -20], be: [-5, -26], bh: [-9, -32] }, CROUCH)],

  fall: [P({
    hip: [0, -30], chest: [-13, -45], head: [-4, -2], fk: [10, -36], ff: [18, -30], bk: [8, -26], bf: [15, -20],
    fe: [-14, -54], fh: [-10, -62], be: [-20, -50], bh: [-26, -56],
  })],

  lying: [P({
    hip: [6, -6], chest: [-15, -7], headRot: -1, fk: [16, -9], ff: [28, -3], bk: [16, -6], bf: [28, -2],
    fe: [-10, -3], fh: [-3, -2], be: [-13, -11], bh: [-6, -15],
  })],

  win: [
    P({ fe: [12, -53], fh: [17, -63], be: [-6, -40], bh: [-3, -33], fk: [5, -13], ff: [7, 0] }),
    bob(P({ fe: [13, -55], fh: [18, -66], be: [-6, -40], bh: [-3, -33], fk: [5, -13], ff: [7, 0] }), -1),
  ],

  // ---- special-attack poses ----
  charge: [
    P({ hip: [-1, -22], chest: [3, -44], fe: [-2, -36], fh: [-6, -30], be: [-6, -36], bh: [-10, -31], fk: [8, -11], ff: [10, 0], bk: [-6, -10], bf: [-10, 0] }),
    P({ hip: [-1, -22], chest: [4, -45], fe: [-2, -37], fh: [-6, -31], be: [-6, -37], bh: [-10, -32], fk: [8, -11], ff: [10, 0], bk: [-6, -10], bf: [-10, 0] }),
  ],
  cast: [
    P({ fe: [-2, -38], fh: [-6, -32], be: [-6, -38], bh: [-10, -33] }),
    P({ ...LUNGE, chest: [3, -47], fe: [12, -44], fh: [22, -45], be: [10, -42], bh: [20, -41] }),
  ],
  throw: [
    P({ chest: [-1, -48], fe: [-6, -50], fh: [-16, -55], be: [8, -42], bh: [14, -46] }),
    P({ ...LUNGE, chest: [4, -47], fe: [11, -52], fh: [21, -56], be: [-5, -40], bh: [-8, -34] }),
  ],
  raise: [
    P({ fe: [12, -54], fh: [17, -65], be: [-4, -40], bh: [-1, -33] }),
    P({ fe: [13, -52], fh: [19, -61], be: [-4, -40], bh: [-1, -33] }),
  ],
  swing: [
    P({ chest: [-1, -48], fe: [-6, -51], fh: [-16, -57], be: [-8, -50], bh: [-17, -54] }),
    P({ ...LUNGE, chest: [4, -46], fe: [13, -46], fh: [22, -38], be: [10, -44], bh: [18, -38] }),
  ],
  run: [
    P({ hip: [0, -27], chest: [5, -48], fk: [10, -18], ff: [14, -8], bk: [-6, -14], bf: [-14, -6], fe: [0, -38], fh: [6, -32], be: [10, -42], bh: [14, -48] }),
    P({ hip: [0, -27], chest: [5, -48], fk: [4, -14], ff: [-4, -6], bk: [8, -18], bf: [14, -10], fe: [10, -42], fh: [14, -48], be: [0, -38], bh: [6, -32] }),
  ],
  hobble: [
    P({ hip: [-2, -24], chest: [4, -42], head: [3, -1], fe: [10, -34], fh: [14, -30], be: [-6, -36], bh: [-4, -29], fk: [4, -12], ff: [6, 0], bk: [-6, -12], bf: [-8, 0] }),
    P({ hip: [-2, -23], chest: [4, -41], head: [3, -1], fe: [10, -33], fh: [14, -29], be: [-6, -35], bh: [-4, -28], fk: [6, -12], ff: [9, 0], bk: [-5, -12], bf: [-6, 0] }),
  ],
  surf: [
    P({ hip: [0, -22], chest: [1, -42], fk: [8, -11], ff: [10, 0], bk: [-8, -11], bf: [-10, 0], fe: [10, -46], fh: [18, -50], be: [-8, -44], bh: [-16, -48] }),
    P({ hip: [0, -22], chest: [1, -42], fk: [8, -11], ff: [10, 0], bk: [-8, -11], bf: [-10, 0], fe: [10, -44], fh: [18, -46], be: [-8, -46], bh: [-16, -52] }),
  ],
  hugOpen: [P({ fe: [10, -50], fh: [18, -58], be: [-6, -52], bh: [-9, -62] })],
  hug: [
    P({ ...LUNGE, chest: [3, -47], fe: [12, -44], fh: [18, -40], be: [10, -46], bh: [16, -44] }),
    bob(P({ ...LUNGE, chest: [3, -47], fe: [11, -43], fh: [16, -40], be: [9, -45], bh: [15, -43] }), 1),
  ],
  kick: [
    P({ fk: [10, -26], ff: [6, -16], fe: [4, -40], fh: [8, -46], be: [-8, -42], bh: [-12, -48] }),
    P({ chest: [-2, -48], fk: [12, -30], ff: [24, -36], fe: [2, -40], fh: [6, -46], be: [-9, -42], bh: [-13, -48], bk: [-4, -13], bf: [-6, 0] }),
  ],
  sing: [
    P({ fe: [8, -40], fh: [9, -53], be: [-6, -48], bh: [-10, -58] }),
    bob(P({ fe: [8, -40], fh: [9, -53], be: [-7, -46], bh: [-13, -53] }), 1),
  ],
  flurry: [
    P({ ...LUNGE, chest: [3, -47], fe: [14, -50], fh: [24, -54], be: [10, -40], bh: [19, -38] }),
    P({ ...LUNGE, chest: [3, -47], fe: [12, -40], fh: [22, -38], be: [12, -50], bh: [22, -56] }),
  ],
  stompAir: [P({
    hip: [0, -28], chest: [0, -50], fk: [6, -16], ff: [8, -2], bk: [-6, -24], bf: [-12, -18],
    fe: [13, -55], fh: [19, -64], be: [-9, -54], bh: [-17, -60],
  })],
};

/** Get a pose frame safely (falls back to idle). */
export function getPose(name, frame = 0) {
  const p = POSES[name] || POSES.idle;
  return p[Math.min(frame, p.length - 1)] || p[0];
}
