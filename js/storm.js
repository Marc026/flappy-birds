/**
 * storm.js — timing for the storm chapter's lightning. Pure functions of the animation clock, so the
 * renderer (flashes), the main loop (thunder) and the tests all agree on exactly when strikes happen.
 */

export const PERIOD = 260;   // clock ticks between lightning strikes (about 4 seconds)
const DURATION = 16;         // how long one strike's flashing lasts

/** The strike in progress at clock `s`: { k: strike number, t: ticks since it began }, or null between strikes. */
export function lightning(s) {
  const k = Math.floor(s / PERIOD);
  const t = s - k * PERIOD;
  return t < DURATION ? { k, t } : null;
}

/** Sky brightness (0..1) `t` ticks into a strike: a hard flash, a dark beat, a flicker, then a fade. */
export function glow(t) {
  if (t < 4) return 1;
  if (t < 7) return 0.15;
  if (t < 11) return 0.6;
  return Math.max(0, 0.6 * (1 - (t - 11) / 5));
}
