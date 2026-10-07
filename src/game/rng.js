// Small seeded PRNG (mulberry32) so CPU fights / tests can be reproduced.
let state = (Date.now() ^ 0x9e3779b9) >>> 0;

export function seed(n) {
  state = n >>> 0;
}

export const getState = () => state;
export const setState = (n) => { state = n >>> 0; };

/** Random float in [0, 1). */
export function rand() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randRange = (a, b) => a + rand() * (b - a);
export const randInt = (a, b) => Math.floor(randRange(a, b + 1));
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/** Weighted choice: weights = { option: weight, ... } */
export function weighted(weights) {
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k]);
  let r = rand() * total;
  for (const k in weights) {
    r -= Math.max(0, weights[k]);
    if (r < 0) return k;
  }
  return Object.keys(weights)[0];
}
