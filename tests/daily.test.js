import test from 'node:test';
import assert from 'node:assert/strict';
import { goalsFor, progress, record, REWARD } from '../js/daily.js';

// Daily goals are deterministic per date, tracked per day and paid once.

const blank = () => ({ coins: 0, today: { date: 0, best: 0, coins: 0, runs: 0, done: [] } });

test('the same date always yields the same three goals', () => {
  assert.deepEqual(goalsFor(20261106), goalsFor(20261106));
  assert.equal(goalsFor(20261106).length, 3);
});

test('a completed goal pays once, and progress resets on a new day', () => {
  const data = blank();
  const seed = 20261106;
  const scoreGoal = goalsFor(seed)[0];
  const done = record(data, { score: scoreGoal.target, coins: 0 }, seed);
  assert.ok(done.some(g => g.id === 'score'));
  assert.equal(data.coins, REWARD);
  record(data, { score: scoreGoal.target, coins: 0 }, seed);      // same goal again: no second payout
  assert.equal(data.coins, REWARD);
  assert.ok(progress(data, 20261107).every(g => !g.done));          // next day starts fresh
});
