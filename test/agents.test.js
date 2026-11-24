import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks this machine's own company file, when there is one: every role that names an agent must have that agent.
const dir = path.join(os.homedir(), '.claude/agents'), file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/company.json');
test('every role that names an agent is backed by a well-formed agent file', async (t) => {
  let company; try { company = JSON.parse(await fs.readFile(file, 'utf8')); await fs.access(dir); } catch { return t.skip('no company file or no agents on this machine'); }
  for (const r of company.roles.filter((x) => x.agent)) {
    const s = await fs.readFile(path.join(dir, r.agent + '.md'), 'utf8');
    const fm = s.match(/^---\n([\s\S]*?)\n---\n/)?.[1]; assert.ok(fm, r.agent); assert.match(fm, new RegExp(`^name: ${r.agent}$`, 'm')); assert.match(fm, /^description: .{20,}/m);
  }
});
