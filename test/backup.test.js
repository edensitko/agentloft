import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBackups } from '../server/backup.js';

const DAY = 86400_000;
async function make(keep = 3) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'office-bak-')), clock = { t: new Date(2026, 10, 1, 12).getTime() }, b = createBackups(dir, { keep, now: () => clock.t });
  const put = async (f, o) => { await fs.mkdir(path.dirname(path.join(dir, f)), { recursive: true }); await fs.writeFile(path.join(dir, f), typeof o === 'string' ? o : JSON.stringify(o)); };
  return { dir, b, put, next: () => { clock.t += DAY; }, names: async () => (await b.list()).map((x) => x.name) };
}
test('one copy a day, only when something changed, and only the newest are kept', async () => {
  const { b, put, next, names } = await make();
  assert.equal(await b.daily(), null); // nothing to keep yet
  await put('layout.json', { n: 1 }); assert.equal(await b.daily(), '2026-11-01'); assert.equal(await b.daily(), null);
  next(); assert.equal(await b.daily(), null); // unchanged
  for (let i = 2; i < 7; i++) { next(); await put('layout.json', { n: i }); await b.daily(); }
  assert.deepEqual(await names(), ['2026-11-07', '2026-11-06', '2026-11-05']);
});
test('a broken file is not copied, and nothing but dated copies is ever deleted', async () => {
  const { dir, b, put, next } = await make(1);
  await put('layout.json', { n: 1 }); await put('backups/mine/keep.txt', 'x'); await b.daily();
  next(); await put('layout.json', '{"n":'); await put('company.json', { name: 'A', depts: {} }); await b.daily();
  assert.equal(await fs.readFile(path.join(dir, 'backups/mine/keep.txt'), 'utf8'), 'x');
  await assert.rejects(fs.access(path.join(dir, 'backups/2026-11-02/layout.json')));
});
test('restoring brings the copy back, keeps what was there, and can be undone', async () => {
  const { dir, b, put, next, names } = await make(); const apply = { layout: (o) => put('layout.json', o), company: (o) => put('company.json', o) }, now = async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
  await put('layout.json', { n: 1 }); await put('company.json', { name: 'Old', depts: { a: {} } }); await put('templates/tabcdef1.json', { name: 'x' }); await b.daily(); next();
  await put('layout.json', { n: 2 }); await put('company.json', { name: 'New', depts: {} }); await fs.rm(path.join(dir, 'templates/tabcdef1.json')); await put('templates/tabcdef2.json', { name: 'y' });
  assert.equal(await b.restore('2026-11-01', apply), true);
  assert.equal((await now('layout.json')).n, 1); assert.equal((await now('company.json')).name, 'Old'); assert.equal((await now('templates/tabcdef1.json')).name, 'x'); assert.equal((await now('templates/tabcdef2.json')).name, 'y');
  assert.deepEqual(await names(), ['before-restore', '2026-11-01']); assert.equal((await b.list())[1].company, 'Old');
  assert.equal(await b.restore('before-restore', apply), true); assert.equal((await now('company.json')).name, 'New');
  for (const bad of ['../x', '2026-1-1', '', 'mine', '2030-01-01']) assert.equal(await b.restore(bad, apply), false, bad);
});
