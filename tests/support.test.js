import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, dailySeed } from '../js/rng.js';
import * as fx from '../js/fx.js';
import { Game } from '../js/game.js';

// Tests for the seeded RNG, the effects pool and seeded pipe generation.

test('same seed gives the same sequence, and values stay in [0, 1)', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(makeRng(1)(), makeRng(2)());
});

test('dailySeed is YYYYMMDD in UTC', () => {
  assert.equal(dailySeed(new Date(Date.UTC(2026, 10, 6))), 20261106);
});

test('the particle pool never exceeds its cap and drains to empty', () => {
  fx.emit(0, 0, 1000, '#fff');
  assert.equal(fx.pool.filter(p => p.on).length, fx.pool.length);   // capped, no growth
  for (let i = 0; i < 60; i++) fx.step();
  assert.equal(fx.pool.filter(p => p.on).length, 0);
});

test('a seeded game spawns identical pipes', () => {
  const a = new Game(7);
  const b = new Game(7);
  a.flap(); b.flap();
  a.update(); b.update();
  assert.equal(a.pipes[0].gy, b.pipes[0].gy);
  assert.equal(a.pipes[0].coin, b.pipes[0].coin);
});
