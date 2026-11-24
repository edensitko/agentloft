import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_TEMPLATES, officeDesign } from '../public/office.templates.js';
import { PLANS } from '../public/plans.js';
import { COMPANY_TEMPLATES } from '../public/company.templates.js';
import { cleanLayout, ROOM_STYLES, OUTSIDES, PLAN_IDS } from '../server/layout.js';

test('every complete office names a real company, real room styles and a real place, and survives saving unchanged', () => {
  assert.equal(new Set(OFFICE_TEMPLATES.map((o) => o.id)).size, OFFICE_TEMPLATES.length);
  for (const o of OFFICE_TEMPLATES) {
    const c = COMPANY_TEMPLATES.find((x) => x.id === o.company)?.company; assert.ok(c, o.id);
    assert.ok(PLANS[o.plan].slots.length >= Object.keys(c.depts).length, `${o.id}: not enough rooms`);
    const d = officeDesign(o, c), saved = cleanLayout({ ...d });
    assert.deepEqual(Object.keys(d.rooms).sort(), Object.keys(c.depts).map((k) => 'co:' + k).sort(), o.id);
    assert.ok(Object.values(d.rooms).every((r) => ROOM_STYLES.includes(r.style)), o.id); assert.ok(OUTSIDES.includes(d.scene.outside), o.id);
    assert.deepEqual(JSON.parse(JSON.stringify({ items: saved.items, rooms: saved.rooms, scene: saved.scene })), d, o.id);
  }
});
test('a room can be saved in any of the fifteen places', () => {
  assert.equal(cleanLayout({ rooms: { a: { slot: 14 } } }).rooms.a.slot, 14); assert.equal(cleanLayout({ rooms: { a: { slot: 15 } } }).rooms.a.slot, undefined);
});

test('every complete office has its own building', () => { assert.equal(new Set(OFFICE_TEMPLATES.map((o) => o.plan)).size, OFFICE_TEMPLATES.length); assert.deepEqual(Object.keys(PLANS), PLAN_IDS); });
