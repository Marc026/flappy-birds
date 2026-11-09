/**
 * daily.js — the three daily goals. Targets come from the date seed, so every player gets the same
 * goals each day; progress lives in data.today and rolls over automatically when the date changes.
 */
import { makeRng, dailySeed } from './rng.js';

/** Coins paid for each daily goal the first time it is completed. */
export const REWARD = 5;

/** Today's three goals (deterministic for a given date seed). `stat` names the counter in data.today. */
export function goalsFor(seed = dailySeed()) {
  const r = makeRng(seed);
  const score = 8 + Math.floor(r() * 8);   // 8-15 points in one run
  const coins = 5 + Math.floor(r() * 6);   // 5-10 coins in total today
  const runs = 3 + Math.floor(r() * 3);    // 3-5 runs today
  return [
    { id: 'score', stat: 'best', target: score, text: `Score ${score} in one run` },
    { id: 'coins', stat: 'coins', target: coins, text: `Collect ${coins} coins today` },
    { id: 'runs', stat: 'runs', target: runs, text: `Play ${runs} runs today` },
  ];
}

/** Today's goals with live progress ({ ...goal, value, done }); stale data from another day counts as zero. */
export function progress(data, seed = dailySeed()) {
  const t = data.today.date === seed ? data.today : { best: 0, coins: 0, runs: 0 };
  return goalsFor(seed).map(g => ({ ...g, value: t[g.stat], done: t[g.stat] >= g.target }));
}

/**
 * Add a finished run to today's totals and pay REWARD coins per newly completed goal (mutates `data`).
 * @param run { score, coins } of the finished run
 * @returns the daily goals completed just now, so the UI can announce them
 */
export function record(data, run, seed = dailySeed()) {
  if (data.today.date !== seed) data.today = { date: seed, best: 0, coins: 0, runs: 0, done: [] };   // new day
  const t = data.today;
  t.best = Math.max(t.best, run.score);
  t.coins += run.coins;
  t.runs += 1;
  const fresh = progress(data, seed).filter(g => g.done && !t.done.includes(g.id));
  t.done.push(...fresh.map(g => g.id));
  data.coins += fresh.length * REWARD;
  return fresh;
}
