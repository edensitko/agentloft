import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { cleanLayout, createStore, ROOM_STYLES } from '../server/layout.js';

test('unknown fields, types and wild values are dropped or clamped', () => {
  const l = cleanLayout({ evil: 1, items: [{ type: 'plantA', x: 999, s: 'x', color: 'url(x)' }, { type: 'script' }, null], rooms: { a: { slot: 99, name: ' x '.repeat(50), floor: 'lava' } }, scene: { mood: 'x', light: 50 } });
  assert.deepEqual(l.items, [{ id: 'i0', type: 'plantA', x: 35, z: 0, ry: 0, s: 1 }]);
  assert.equal(l.rooms.a.slot, undefined); assert.ok(l.rooms.a.name.length <= 40); assert.equal(l.scene.light, 2); assert.equal(l.evil, undefined);
  assert.throws(() => cleanLayout([]));
});
test('a design survives a restart and a corrupt file does not crash', async () => {
  const f = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'lay-')), 'd/layout.json');
  await createStore(f).set({ agents: { 'r:manager': { name: 'Dana', avatar: 'Business_Male_01' } } });
  const l = await createStore(f).get(); assert.equal(l.agents['r:manager'].name, 'Dana'); assert.equal(l.rev, 1); assert.equal(l.agents['r:manager'].avatar, 'Business_Male_01');
  await fs.writeFile(f, '{'); assert.equal((await createStore(f).get()).rev, 0);
});
test('room templates: known styles are kept, and every one of them exists in the page', async () => {
  const l = cleanLayout({ rooms: { a: { style: 'tech' }, b: { style: 'evil' } } }); assert.equal(l.rooms.a.style, 'tech'); assert.equal(l.rooms.b.style, undefined);
  const src = await fs.readFile(new URL('../public/templates.js', import.meta.url), 'utf8'); for (const s of ROOM_STYLES.slice(1)) assert.match(src, new RegExp(`\\n  ${s}: \\{ name`));
});
test('assignments and custom roles are validated', () => {
  const l = cleanLayout({ assign: { 's:a-1': 'cfo', bad: 'x', 's:b': '<x>' }, custom: [{ id: 'c1', name: 'A', dept: 'sales', lead: true }, { id: '<', name: 'x' }, { id: 'c2' }], agents: { a: { size: 9 } } });
  assert.deepEqual(l.assign, { 's:a-1': 'cfo' }); assert.deepEqual(l.custom, [{ id: 'c1', name: 'A', dept: 'sales', lead: true }]); assert.equal(l.agents.a.size, 1.8);
});
test('a personal look is kept and clamped', () => {
  const a = cleanLayout({ agents: { x: { cloth: '#112233', pants: '#445566', hair: 'red', tone: 9, tall: 0.1, wide: 1.1 } } }).agents.x;
  assert.deepEqual(a, { cloth: '#112233', pants: '#445566', tone: 1.3, tall: 0.85, wide: 1.1 });
});
