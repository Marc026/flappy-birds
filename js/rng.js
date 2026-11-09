/**
 * rng.js — seeded random numbers. The same seed always yields the same sequence, which powers
 * the daily challenge, share links ("beat my score on the same pipes") and deterministic tests.
 */

/** mulberry32: a tiny, fast, well-distributed PRNG. Returns a function giving floats in [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0;   // force an unsigned 32-bit integer
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's challenge seed as YYYYMMDD in UTC, so every player worldwide gets the same pipes. */
export const dailySeed = (date = new Date()) =>
  date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
