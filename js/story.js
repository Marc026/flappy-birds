/**
 * story.js — the story engine: a small state machine over the scene graph in story-data.js.
 * Pure logic (no DOM, canvas or timers), so every path through the story can be unit-tested in Node.
 */
import { NODES, ENDINGS, CAST, START_TIME, BEDTIME } from './story-data.js';

export { CAST, ENDINGS };

/** A fresh story: minutes left until bedtime, hearts earned, choice flags, and the node we are on. */
export function newStory() {
  return { node: 'intro', time: START_TIME, love: 0, flags: {} };
}

/** The current node (cutscene, flight segment or finale). */
export const node = s => NODES[s.node];

/** Apply an effects object { time, love, flag } to the state; every field is optional. */
export function apply(s, fx = {}) {
  s.time += fx.time ?? 0;
  s.love = Math.max(0, s.love + (fx.love ?? 0));
  if (fx.flag) s.flags[fx.flag] = true;
}

/** Follow a cutscene's `next` link. */
export function next(s) {
  s.node = node(s).next;
}

/** Resolve a decision: apply the chosen option's effects, then move to the node it leads to. */
export function choose(s, index) {
  const option = node(s).options[index];
  apply(s, option.fx);
  s.node = option.next;
}

/** Wall-clock text such as "7:50 PM": bedtime minus the minutes left (goes past 8:30 when late). */
export function clock(s) {
  const m = BEDTIME - s.time;                 // minutes after midnight
  const h24 = Math.floor(m / 60);
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m % 60).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

/** Which ending the player earned: on time or late, how many hearts, and whether they helped the chick. */
export function endingId(s) {
  if (s.time <= 0) return s.flags.helped ? 'late_helped' : 'late';
  return s.time >= 6 && s.love >= 3 ? 'tucked' : 'justintime';
}

/** The ending as a playable cutscene: { id, title, bg, art, lines }. */
export function ending(s) {
  const id = endingId(s);
  const e = ENDINGS[id];
  return { id, title: e.title, bg: e.bg, art: e.art, lines: e.lines(s) };
}
