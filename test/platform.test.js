import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parsePs, parseWindows, sameProcess, liveProcesses, notifyCommand, exists } from '../server/platform.js';
import { createCollector, projectOf, describeTool } from '../server/collector.js';

const T = Date.parse('2026-11-21T10:00:00Z');
test('process lists are read from ps and from PowerShell', () => {
  assert.equal(parsePs('  12 Sat Nov 21 10:00:00 2026\nnoise\n').get(12), T);
  const w = parseWindows('4 \r\n1234 2026-11-21T10:00:00.0000000Z\r\n'); assert.equal(w.get(1234), T); assert.ok(Number.isNaN(w.get(4)));
});
test('a reused pid is told apart, in either format of start time, and an unknown start is trusted', () => {
  assert.ok(sameProcess({ procStart: 'Sat Nov 21 10:00:00 2026' }, T)); assert.ok(!sameProcess({ procStart: 'Sat Nov 21 10:00:00 2026' }, T + 60_000));
  for (const procStart of [undefined, '8841223', '133765920000000000']) { assert.ok(sameProcess({ procStart, updatedAt: T + 5000 }, T)); assert.ok(!sameProcess({ procStart, updatedAt: T }, T + 3600_000)); }
  assert.ok(sameProcess({ procStart: 'x' }, NaN));
});
test('on this machine: a running process is found, an ended one is not, and its session appears and disappears', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']); await new Promise((r) => child.once('spawn', r));
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'office-pid-')); await fs.mkdir(path.join(home, '.claude', 'sessions'), { recursive: true });
  const now = Date.now(); await fs.writeFile(path.join(home, '.claude', 'sessions', '1.json'), JSON.stringify({ pid: child.pid, sessionId: 'abc', cwd: path.join(home, 'shop'), status: 'idle', name: 'n', updatedAt: now, startedAt: now }));
  const sessions = async () => (await createCollector({ home }).snapshot()).workers.filter((w) => w.kind === 'session');
  try {
    assert.ok(exists(child.pid)); assert.ok((await liveProcesses([child.pid])).has(child.pid));
    const [s] = await sessions(); assert.equal(s?.project.label, 'shop');
  } finally { const gone = new Promise((r) => child.once('exit', r)); child.kill('SIGKILL'); await gone; }
  for (let i = 0; i < 20 && exists(child.pid); i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal((await sessions()).length, 0);
});
test('Windows paths are understood', () => {
  assert.equal(projectOf('C:\\Users\\a\\code\\shop\\.claude\\worktrees\\x', 'C:\\Users\\a').label, 'shop'); assert.equal(describeTool('Read', { file_path: 'C:\\a\\b.ts' }).text, 'Reading b.ts');
});
test('notification text is never part of a script, on any system', () => {
  const evil = '"; rm -rf / #$(calc) `x`';
  for (const p of ['darwin', 'win32', 'linux']) {
    const [cmd, args, opts] = notifyCommand('t', evil, p); assert.ok(cmd);
    if (p === 'win32') { assert.ok(!args.join(' ').includes('rm -rf')); assert.equal(opts.env.OFFICE_BODY, evil); } else { assert.equal(args.at(-1), evil); assert.equal(args[args.indexOf('--') + 1], 't'); }
  }
});
