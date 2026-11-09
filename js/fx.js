/**
 * fx.js — cheap visual effects. Guardrails: a FIXED-SIZE particle pool (nothing is allocated
 * per frame), only rect drawing (see renderer.js), and every effect is off under prefers-reduced-motion.
 */

const MAX = 24;   // hard cap on live particles

/** True when the OS asks for reduced motion: shake, flash, particles and weather are skipped. */
export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reusable particle slots; `on` marks a live one. */
export const pool = Array.from({ length: MAX }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, r: 0, c: '#fff' }));

/** Decaying effect intensities (1 = full): screen shake, white flash, score pop. */
export const state = { shake: 0, flash: 0, pop: 0 };

/** Spawn up to `n` particles at (x, y); extras are silently dropped when the pool is full. */
export function emit(x, y, n, color, spread = 2) {
  if (reduced) return;
  for (const p of pool) {
    if (n <= 0) break;
    if (p.on) continue;
    p.on = true;
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * spread * 2;
    p.vy = (Math.random() - 0.5) * spread * 2;
    p.life = 18 + Math.random() * 12;   // ticks to live
    p.r = 2 + Math.random() * 2;        // square size
    p.c = color;
    n -= 1;
  }
}

/** Advance every effect one tick (called from the fixed-timestep loop). */
export function step() {
  state.shake *= 0.85;
  state.flash *= 0.85;
  state.pop *= 0.8;
  for (const p of pool) {
    if (!p.on) continue;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;                // light gravity
    if (--p.life <= 0) p.on = false;
  }
}

/** Crash feedback: strong shake plus a white flash. */
export function hit() {
  if (!reduced) { state.shake = 10; state.flash = 1; }
}

/** Soft flash, e.g. when you pass your personal best. */
export function flash(v = 0.6) {
  if (!reduced) state.flash = Math.max(state.flash, v);
}

/** Score pop: the HUD number briefly scales up. */
export function pop() {
  if (!reduced) state.pop = 1;
}
