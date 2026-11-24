import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTemplates } from '../server/templates.js';
import { COMPANY_TEMPLATES } from '../public/company.templates.js';

const company = COMPANY_TEMPLATES[0].company;
const make = async () => { const dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'office-tpl-')), 'templates'); let t = 1000; return { dir, tpl: createTemplates(dir, () => t++) }; };

test('a saved template comes back with its company and design, newest first', async () => {
  const { tpl } = await make();
  assert.deepEqual(await tpl.list(), []);
  const a = await tpl.save({ name: ' First ', company, layout: { scene: { mood: 'night' } } }), b = await tpl.save({ name: 'Second', company, layout: {} });
  assert.deepEqual((await tpl.list()).map((t) => t.name), ['Second', 'First']); assert.equal((await tpl.list())[0].rooms, 4);
  const got = await tpl.get(a.id); assert.equal(got.name, 'First'); assert.equal(got.layout.scene.mood, 'night'); assert.equal(got.company.roles.length, company.roles.length);
  assert.equal(await tpl.remove(b.id), true); assert.equal(await tpl.remove(b.id), false); assert.equal((await tpl.list()).length, 1);
});
test('a template without a name or with a broken company is refused', async () => {
  const { tpl } = await make();
  await assert.rejects(tpl.save({ name: '  ', company, layout: {} }), /name/);
  await assert.rejects(tpl.save({ name: 'x', company: { depts: {} }, layout: {} }), /department/);
  assert.deepEqual(await tpl.list(), []);
});
test('ids cannot reach outside the folder, and a broken file is skipped', async () => {
  const { tpl, dir } = await make();
  const { id } = await tpl.save({ name: 'Good', company, layout: {} });
  await fs.writeFile(path.join(dir, 'tbroken1.json'), '{"name":'); await fs.writeFile(path.join(dir, 'notes.json'), '{}');
  assert.deepEqual((await tpl.list()).map((t) => t.id), [id]);
  for (const bad of ['../company', '..%2Fx', 'tbroken1', 'T123456', '']) assert.equal(await tpl.get(bad), null, bad);
  assert.equal(await tpl.remove('../company'), false);
});
test('there is a ceiling on how many templates are kept', async () => {
  const { tpl } = await make();
  for (let i = 0; i < 30; i++) await tpl.save({ name: 't' + i, company, layout: {} });
  await assert.rejects(tpl.save({ name: 'one too many', company, layout: {} }), /delete one/);
});
