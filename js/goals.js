/**
 * goals.js — goal tracking. Goals are declared as data in config.js; this module evaluates them
 * against the saved stats and records which ones the player has completed.
 */
import { GOALS } from './config.js';

/** Every goal with live progress: { ...goal, value, done }. */
export function progress(data) {
  return GOALS.map(g => ({ ...g, value: data[g.stat], done: data[g.stat] >= g.target }));
}

/**
 * Mark newly reached goals as completed (mutates `data.done`).
 * @returns the goals completed just now, so the UI can announce them.
 */
export function claim(data) {
  const fresh = progress(data).filter(g => g.done && !data.done.includes(g.id));
  data.done.push(...fresh.map(g => g.id));
  return fresh;
}
