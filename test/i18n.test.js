import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import he from '../public/locales/he.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public');
test('every text in the interface has a Hebrew entry, with the same placeholders', async () => {
  const missing = [];
  for (const f of (await fs.readdir(dir)).filter((x) => /\.(js|html)$/.test(x) && x !== 'i18n.js')) {
    const src = await fs.readFile(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/(?<![\w.$])t\((['"])((?:\\.|(?!\1).)*)\1/g)) { const k = m[2].replace(/\\(['"])/g, '$1'); if (!(k in he)) missing.push(`${f}: ${k}`); }
  }
  assert.deepEqual(missing, []);
  for (const [k, v] of Object.entries(he)) { const slots = (s) => [...new Set(s.match(/\{\d\}/g) ?? [])].sort().join(); if (!k.includes('\\')) assert.equal(slots(v), slots(k), k); }
});

for (const f of (await fs.readdir(path.join(dir, 'locales'))).filter((x) => /^[a-z]{2}\.js$/.test(x) && x !== 'he.js')) test(`${f} has exactly the Hebrew keys, the same placeholders, and keyword lists that compile`, async () => {
  const d = (await import('../public/locales/' + f)).default, slots = (s) => [...new Set(s.match(/\{\d\}/g) ?? [])].sort().join();
  assert.deepEqual(Object.keys(d).sort(), Object.keys(he).sort());
  for (const [k, v] of Object.entries(d)) { assert.ok(typeof v === 'string' && v, k); if (!k.includes('|')) assert.equal(slots(v), slots(k), k); else new RegExp(v, 'i'); assert.equal(v.endsWith(' '), k.endsWith(' '), JSON.stringify(k)); }
});
test('every language of the landing page has every text', async () => {
  const at = path.join(dir, '../docs/lang'), en = JSON.parse(await fs.readFile(path.join(at, 'en.json'), 'utf8')), html = await fs.readFile(path.join(dir, '../docs/index.html'), 'utf8');
  for (const m of html.matchAll(/data-t="(\w+)"/g)) assert.ok(en[m[1]], m[1]);
  for (const f of await fs.readdir(at)) assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(path.join(at, f), 'utf8'))).sort(), Object.keys(en).sort(), f);
});
