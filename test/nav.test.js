import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANS } from '../public/plans.js';
import { setPlan, PLAN, MEETING, FLOOR, createNav, SLOTS, seats, CAFE, LOBBY, BREAKS } from '../public/nav.js';

test('placed furniture is walked around', () => {
  const nav = createNav(); nav.setObstacles([{ x: 2, z: 17.5, r: 1 }]);
  assert.ok(nav.path({ x: -2, z: 17.5 }, { x: 6, z: 17.5 }).length > 1);
  nav.setObstacles([]); assert.equal(nav.path({ x: -2, z: 17.5 }, { x: 6, z: 17.5 }).length, 1);
});
test('every break spot is reachable and all are different', () => {
  const nav = createNav(); assert.equal(new Set(BREAKS.map((b) => b.x + ',' + b.z)).size, BREAKS.length);
  for (const b of BREAKS) { const p = nav.path(LOBBY, b); assert.ok(p, JSON.stringify(b)); assert.ok(p.slice(0, -1).every((q) => !nav.isBlocked(q.x, q.z))); }
});
test('every desk reaches the lobby and cafe without crossing walls', () => {
  const nav = createNav();
  for (const s of SLOTS) for (const n of [2, 4, 6, 12, 15, 20]) for (const seat of seats(s, n)) {
    assert.ok(!nav.isBlocked(seat.x, seat.z), `seat in wall ${JSON.stringify(seat)}`);
    for (const to of [LOBBY, CAFE[0], CAFE[7]]) {
      const p = nav.path(seat, to);
      assert.ok(p, 'no path');
      assert.ok(p.slice(0, -1).every((q) => !nav.isBlocked(q.x, q.z)));
    }
  }
});
test('a sofa blocks its whole footprint, at any rotation', () => {
  const nav = createNav(); nav.setObstacles([{ x: 0, z: 17, ry: Math.PI / 2, w: 4, d: 1.3 }]);
  assert.ok(nav.isBlocked(0, 15.4) && nav.isBlocked(0, 18.6) && nav.isBlocked(0.4, 17)); assert.ok(!nav.isBlocked(1.8, 17)); assert.ok(!nav.isBlocked(0, 20));
});

for (const id of Object.keys(PLANS)) test(`floor plan ${id}: rooms do not overlap, and every desk, break spot and shared area can be reached`, () => {
  setPlan(id); try {
    const nav = createNav(), all = [...SLOTS, MEETING];
    for (const [i, a] of all.entries()) { assert.ok(Math.abs(a.x) + a.w / 2 <= FLOOR.w / 2 + 0.01 && Math.abs(a.z) + a.d / 2 <= FLOOR.d / 2 + 0.01, `${id} ${a.name} sticks out`); for (const b of all.slice(i + 1)) assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 0.01 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 - 0.01, `${id}: ${a.name} / ${b.name}`); }
    const inRoom = (x, z) => all.some((s) => Math.abs(x - s.x) < s.w / 2 - 0.1 && Math.abs(z - s.z) < s.d / 2 - 0.1), [lx, lz] = PLAN.lounge, [rx, rz] = PLAN.reception, [kx, kz] = PLAN.kitchen;
    for (const [n, x, z] of [['lounge', -12.6 + lx, 8.6 + lz], ['lounge', -3.4 + lx, 14.3 + lz], ['reception', 1 + rx, 12 + rz], ['reception', 6 + rx, 13.5 + rz], ['kitchen', -28 + kx, -8.6 + kz], ['kitchen', -17.5 + kx, -6.4 + kz], ['kitchen', -20 + kx, 2.4 + kz], ['kitchen', -28 + kx, 3 + kz]]) { assert.ok(!inRoom(x, z), `${id}: ${n} at ${x},${z} is inside a room`); assert.ok(Math.abs(x) <= FLOOR.w / 2 && Math.abs(z) <= FLOOR.d / 2, `${id}: ${n} outside`); }
    for (const b of BREAKS) assert.ok(nav.path(LOBBY, b), `${id} break ${JSON.stringify(b)}`);
    for (const s of SLOTS) for (const n of [2, 4, 6, 12]) for (const seat of seats(s, n)) assert.ok(!nav.isBlocked(seat.x, seat.z) && nav.path(seat, LOBBY), `${id} ${s.name} ${JSON.stringify(seat)}`);
    assert.ok(nav.path(LOBBY, { x: MEETING.x - 2.25, z: MEETING.z + 1.9 }), `${id} meeting`);
  } finally { setPlan('atrium'); }
});
