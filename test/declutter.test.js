import test from 'node:test';
import assert from 'node:assert/strict';
import { declutter, nudge } from '../public/declutter.js';

const box = (id, x, y, rank = 1, o = {}) => ({ id, x, y, w: 100, h: 20, rank, count: true, ...o });
test('labels that do not touch all stay', () => { const r = declutter([box('a', 0, 0), box('b', 0, 40), box('c', 200, 0)]); assert.equal(r.hidden.size, 0); assert.equal(r.more.size, 0); });
test('on the same spot the most important one stays, and says how many are behind it', () => {
  const r = declutter([box('work', 10, 5, 2), box('waits', 0, 0, 0), box('lead', 20, 8, 3)]);
  assert.deepEqual([...r.hidden].sort(), ['lead', 'work']); assert.equal(r.more.get('waits'), 2);
});
test('what is left never overlaps, whatever the crowd', () => {
  let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const all = Array.from({ length: 60 }, (_, i) => box('b' + i, rnd() * 300, rnd() * 300, Math.floor(rnd() * 4))), { hidden } = declutter(all), kept = all.filter((b) => !hidden.has(b.id));
  for (const [i, a] of kept.entries()) for (const b of kept.slice(i + 1)) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  assert.ok(all.filter((b) => b.rank === 0).length === 0 || kept.some((b) => b.rank === 0));
});
test('a label that is already visible is not swapped for an equal one, and room names are hidden without being counted', () => {
  assert.deepEqual([...declutter([box('a', 0, 0), box('b', 5, 5)], new Set(['b'])).hidden], ['a']);
  const r = declutter([box('p', 0, 0), box('room', 5, 5, 9, { count: false })]); assert.ok(r.hidden.has('room')); assert.equal(r.more.size, 0);
});
test('a label at the edge slides in, one in the middle stays, and one whose person is off the screen is dropped', () => {
  assert.equal(nudge(200, 100, 390), 0); assert.equal(nudge(10, 100, 390), 44); assert.equal(nudge(390, 100, 390), -54);
  assert.equal(nudge(-1, 100, 390), null); assert.equal(nudge(391, 100, 390), null); assert.equal(nudge(0, 900, 390), 195);
});
