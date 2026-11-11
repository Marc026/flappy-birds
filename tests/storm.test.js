import test from 'node:test';
import assert from 'node:assert/strict';
import { lightning, glow, PERIOD } from '../js/storm.js';

// Lightning timing is shared by the renderer (flash) and the main loop (thunder).

test('lightning strikes once per period and the sky is dark in between', () => {
  assert.deepEqual(lightning(0), { k: 0, t: 0 });
  assert.equal(lightning(PERIOD / 2), null);
  assert.equal(lightning(PERIOD + 3).k, 1);
});

test('glow stays within 0..1 and fades to nothing', () => {
  for (let t = 0; t < 20; t += 0.5) assert.ok(glow(t) >= 0 && glow(t) <= 1);
  assert.equal(glow(16), 0);
});
