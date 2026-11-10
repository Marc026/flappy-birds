import test from 'node:test';
import assert from 'node:assert/strict';
import { newStory, next, choose, clock, endingId, ending, CAST } from '../js/story.js';
import { NODES, ENDINGS } from '../js/story-data.js';

// Story engine and data integrity: every link resolves, every speaker exists, endings follow the rules.

test('every link in the story graph resolves and no node is orphaned', () => {
  const seen = new Set();
  const walk = id => {
    if (seen.has(id)) return;
    assert.ok(NODES[id], `missing node ${id}`);
    seen.add(id);
    const n = NODES[id];
    if (n.next) walk(n.next);
    (n.options ?? []).forEach(o => walk(o.next));
  };
  walk('intro');
  assert.deepEqual([...seen].sort(), Object.keys(NODES).sort());
});

test('every speaker in every scene and ending is in the cast', () => {
  const everything = { flags: { window: true, cake: true, helped: true, ignored: true } };
  const lines = [
    ...Object.values(NODES).flatMap(n => n.lines ?? []),
    ...Object.values(ENDINGS).flatMap(e => e.lines(everything)),
  ];
  assert.ok(lines.length > 20);
  lines.forEach(([who, text]) => {
    assert.ok(CAST[who], `unknown speaker ${who}`);
    assert.ok(text.length > 0);
  });
});

test('clock is bedtime minus the minutes left', () => {
  const s = newStory();
  assert.equal(clock(s), '7:50 PM');
  s.time = 0;
  assert.equal(clock(s), '8:30 PM');
  s.time = -15;
  assert.equal(clock(s), '8:45 PM');
});

test('choices apply their effects and follow their links', () => {
  const s = newStory();
  next(s);
  assert.equal(s.node, 'seg1');
  choose(s, 1);                        // the Park: calm, but five minutes slower
  assert.equal(s.time, 35);
  assert.equal(s.node, 'park');
  s.node = 'seg2';
  choose(s, 0);                        // the bakery: seed cake, two hearts
  assert.equal(s.love, 2);
  assert.ok(s.flags.cake);
});

test('endings depend on time, hearts and kindness', () => {
  const s = newStory();
  s.time = 10; s.love = 3;
  assert.equal(endingId(s), 'tucked');
  s.love = 1;
  assert.equal(endingId(s), 'justintime');
  s.time = 0;
  assert.equal(endingId(s), 'late');
  s.flags.helped = true;
  assert.equal(endingId(s), 'late_helped');
  assert.ok(ending(s).lines.length > 3);
});
