import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STATUS } from '../js/game.js';
import { MODES } from '../js/config.js';

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

test('coins are collected when the bird touches them', () => {
  const g = new Game(1);
  g.flap();
  g.pipes = [{ x: 40, gy: g.bird.y, cy: g.bird.y, gap: 120, passed: false, amp: 0, ph: 0, coin: true }];
  const events = g.update();
  assert.ok(events.includes('coin'));
  assert.equal(g.coins, 1);
});

test('speed grows with the score and late-game pipes sway', () => {
  const g = new Game(3);
  g.flap();
  g.score = 20;
  g.update();
  assert.ok(g.speed > 2);          // faster than the base speed
  assert.ok(g.pipes[0].amp > 0);   // pipes spawned after 15 points sway
});

test('modes change the tuning: Zen is slow with wide constant gaps, Hard is tight and fast', () => {
  const zen = new Game(1, MODES.zen);
  const hard = new Game(1, MODES.hard);
  zen.flap(); zen.update();
  hard.flap(); hard.update();
  assert.equal(zen.pipes[0].gap, MODES.zen.gap);
  assert.equal(zen.pipes[0].amp, 0);
  assert.ok(hard.pipes[0].gap < zen.pipes[0].gap);
  assert.ok(hard.speed > zen.speed);
});

test('a shield absorbs one crash, then the next one is fatal', () => {
  const g = new Game(1);
  g.flap();
  g.shield = true;
  g.bird.y = 440;                                    // below the ground line
  assert.ok(g.update().includes('break'));
  assert.equal(g.shield, false);
  assert.equal(g.status, STATUS.PLAYING);
  g.bird.y = 440;                                    // crash again, no shield left
  assert.ok(g.update().includes('hit'));
  assert.equal(g.status, STATUS.OVER);
});

test('a decision pipe is safe through either opening and deadly on the wall between them', () => {
  const g = new Game(1);
  g.flap();
  g.pipes = [{ x: 60, gy: 135, cy: 135, cy2: 345, gap: 110, passed: false, choice: -1 }];
  g.bird.y = 345;
  assert.equal(g.collides(), false);   // inside opening B
  g.bird.y = 135;
  assert.equal(g.collides(), false);   // inside opening A
  g.bird.y = 240;
  assert.equal(g.collides(), true);    // on the wall
});

test('a story segment spawns its pipes, then one decision pipe, then stops', () => {
  const g = new Game(1, MODES.classic, { left: 1, labels: ['A', 'B'] });
  g.flap();
  const seen = new Set();
  let choice = null;
  for (let i = 0; i < 700 && choice === null; i++) {
    g.bird.y = 240;                    // hold the bird steady mid-screen
    g.bird.v = 0;
    if (g.update().includes('choice')) choice = g.choice;
    g.pipes.forEach(p => seen.add(p));
  }
  assert.equal(seen.size, 2);          // one ordinary pipe + one decision pipe, nothing after
  assert.ok([...seen].some(p => p.cy2 !== undefined));
  assert.ok([0, 1].includes(choice));
  assert.equal(g.status, STATUS.PLAYING);
});

test('in a story segment a crash is a stumble, not game over', () => {
  const g = new Game(1, MODES.classic, { left: 5, labels: ['A', 'B'] });
  g.flap();
  g.bird.y = 440;
  assert.ok(g.update().includes('stumble'));
  assert.equal(g.status, STATUS.PLAYING);
});
