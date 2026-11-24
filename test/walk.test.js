import test from 'node:test';
import assert from 'node:assert/strict';
import { createNav, LOBBY, SLOTS } from '../public/nav.js';
import { slide } from '../public/slide.js';
test('walking slides along walls and never passes through them, even on a slow frame', () => {
  const wall = (x) => x > 5; let p = slide({ x: 0, z: 0 }, 50, 3, wall); assert.ok(p.x <= 5 && p.x > 4); assert.ok(p.z > 2.9);
  assert.notDeepEqual(slide({ x: 6, z: 0 }, -1, 0, wall), { x: 6, z: 0 }, 'can get out of furniture');
});
test('on the real floor you can walk in from the entrance but not through the outer wall', () => {
  const nav = createNav(), b = (x, z) => nav.isBlocked(x, z);
  let p = { x: 0, z: 25 }; for (let i = 0; i < 40; i++) p = slide(p, 0, -0.3, b); assert.ok(p.z < 18, 'entered');
  let q = { x: -15, z: 25 }; for (let i = 0; i < 60; i++) q = slide(q, 0, -0.3, b); assert.ok(q.z > 20.5, 'stopped at the wall');
});
