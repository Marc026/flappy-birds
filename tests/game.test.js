import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STATUS } from '../js/game.js';

// Unit tests for the pure game rules (run with `npm test`; no browser needed).

test('a new game waits for the first flap', () => {
  const g = new Game();
  assert.equal(g.status, STATUS.READY);
  assert.deepEqual(g.update(), []);   // nothing moves before the first flap
  assert.equal(g.bird.v, 0);
});

test('flapping starts the run and launches the bird upward', () => {
  const g = new Game();
  assert.equal(g.flap(), true);
  assert.equal(g.status, STATUS.PLAYING);
  assert.ok(g.bird.v < 0);
});

test('falling to the ground ends the run with a hit event', () => {
  const g = new Game();
  g.flap();
  let events = [];
  for (let i = 0; i < 300 && g.status === STATUS.PLAYING; i++) events = g.update();
  assert.equal(g.status, STATUS.OVER);
  assert.ok(events.includes('hit'));
  assert.equal(g.flap(), false);   // input is ignored after a crash
});

test('passing a pipe scores one point', () => {
  const g = new Game();
  g.flap();
  g.pipes = [{ x: 30, gy: g.bird.y, gap: 120, passed: false }];   // pipe about to clear the bird
  g.update();
  g.update();
  assert.equal(g.score, 1);
});
