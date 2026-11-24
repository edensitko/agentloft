import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), '../docs'), html = await fs.readFile(path.join(docs, 'index.html'), 'utf8'), js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
test('the landing page script compiles and defines every function it calls', () => {
  new Function(js); for (const f of ['show', 'split', 'films', 'gallery', 'day', 'stars', 'load']) assert.match(js, new RegExp(`function ${f}\\(`), f);
});
test('every picture, film and element the landing page uses exists', async () => {
  for (const m of html.matchAll(/(?:images|video)\/[\w-]+\.(?:jpg|mp4)/g)) await fs.access(path.join(docs, m[0]));
  for (const m of html.matchAll(/data-film="(\w+)"/g)) for (const l of ['en', 'he']) { await fs.access(path.join(docs, `video/${m[1]}-${l}.mp4`)); await fs.access(path.join(docs, `images/v-${m[1]}-${l}.jpg`)); }
  for (const m of js.matchAll(/\$\('#(\w+)'\)/g)) assert.ok(html.includes(`id="${m[1]}"`), m[1]);
});
