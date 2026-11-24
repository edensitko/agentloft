import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCollector, parseTranscript, redact } from '../server/collector.js';

const START = 'Wed Nov 18 16:28:16 2026';
const A = (o) => JSON.stringify({ type: 'assistant', timestamp: '2026-11-23T10:00:00Z', message: { model: 'claude-x', stop_reason: 'tool_use', content: [], ...o } });
const U = (t) => JSON.stringify({ type: 'user', message: { content: t } });
async function setup(sessions, lines = []) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'office-'));
  await fs.mkdir(path.join(home, '.claude/sessions'), { recursive: true });
  await fs.mkdir(path.join(home, '.claude/projects/p/abc/subagents'), { recursive: true });
  for (const [i, s] of sessions.entries()) await fs.writeFile(path.join(home, `.claude/sessions/${i}.json`), typeof s === 'string' ? s : JSON.stringify(s));
  await fs.writeFile(path.join(home, '.claude/projects/p/abc.jsonl'), lines.join('\n'));
  const make = (opts = {}) => createCollector({ home, processes: async () => new Map([[1, Date.parse(START + ' UTC')]]), services: async () => new Set(), ...opts });
  return { home, make };
}
const S = (o) => ({ pid: 1, sessionId: 'abc', cwd: '/x/acme', procStart: START, status: 'idle', name: 'n', updatedAt: 1, ...o });

test('dead, recycled and half-written sessions are hidden', async () => {
  const { make } = await setup([S({ pid: 9 }), S({ procStart: 'Wed Nov 18 10:00:00 2026' }), '{"pid":1,']);
  assert.equal((await make().snapshot()).workers.length, 0);
});
test('same session twice becomes one worker, newest wins', async () => {
  const { make } = await setup([S({}), S({ status: 'busy', updatedAt: 5 })]);
  const w = (await make().snapshot()).workers;
  assert.deepEqual(w.map((x) => x.status), ['working']);
  assert.equal(w[0].room.key, 'dept:sessions'); assert.ok(w[0].project.label);
});
test('blocked wrap-up means waiting until the user replies', async () => {
  const wrap = A({ content: [{ type: 'tool_use', id: '1', name: 'mcp__ccd_turn__wrap_up', input: { ask: 'Deploy?', blocked: true } }] });
  const { make } = await setup([S({})], [U('Build it'), wrap]);
  const [w] = (await make().snapshot()).workers;
  assert.equal(w.status, 'waiting'); assert.equal(w.question, 'Deploy?');
  assert.equal(parseTranscript([wrap, U('Yes')]).blocked, false);
});
test('the last wrap-up recap is kept as where the session stands, also after the user replies', async () => {
  const wrap = (recap) => A({ content: [{ type: 'tool_use', id: '1', name: 'mcp__ccd_turn__wrap_up', input: { recap } }] });
  const { make } = await setup([S({})], [U('Build it'), wrap('Built step 1.'), U('Continue'), wrap('Built step 2, not checked in the browser.'), U('Yes')]);
  const [w] = (await make().snapshot()).workers;
  assert.equal(w.recap, 'Built step 2, not checked in the browser.'); assert.equal(w.task, 'Yes');
  assert.equal(parseTranscript([U('Hello')]).recap, null);
  assert.ok(!parseTranscript([wrap('token ghp_abcdefghijklmnopqrstuvwxyz0123456789 saved')]).recap.includes('ghp_abcdefghijklmnopqrstuvwxyz0123456789'));
});
test('a waiting session says what it needs: a question, a plan, a permission or a decision', async () => {
  const use = (name, input) => A({ content: [{ type: 'tool_use', id: '1', name, input }] });
  const need = async (session, lines) => { const { make } = await setup([S(session)], lines); return (await make().snapshot()).workers[0].need; };
  assert.deepEqual(await need({}, [U('x'), use('AskUserQuestion', { questions: [{ question: 'Which color?', options: [{ label: 'Blue' }, { label: 'Green' }] }] })]), { kind: 'question', text: 'Which color?', options: ['Blue', 'Green'] });
  assert.equal((await need({}, [U('x'), use('ExitPlanMode', {})])).kind, 'plan');
  const perm = await need({ status: 'waiting' }, [U('x'), use('Bash', { command: 'rm -rf /tmp/secret-thing', description: 'Deleting a temp file' })]);
  assert.deepEqual(perm, { kind: 'permission', text: 'Running: Deleting a temp file', options: [] }); assert.ok(!JSON.stringify(perm).includes('secret-thing'));
  assert.deepEqual(await need({}, [U('x'), use('mcp__ccd_turn__wrap_up', { recap: 'r', ask: 'Deploy?', blocked: true, actions: [{ label: 'Yes' }, { label: 'Not now' }, { action: 'commit' }] })]), { kind: 'decision', text: 'Deploy?', options: ['Yes', 'Not now'] });
  assert.equal((await need({ status: 'waiting' }, [U('x')])).kind, 'reply');
  assert.equal(await need({ status: 'busy' }, [U('x'), use('Bash', { description: 'Tests' })]), null);
});
test('folder and agent names come from the company file, never from the code', async () => {
  const { make } = await setup([S({})]);
  assert.equal((await make().snapshot()).workers[0].project.label, 'acme');
  assert.equal((await make({ labels: async () => ({ projects: { acme: 'Acme Inc' }, agents: {} }) }).snapshot()).workers[0].project.label, 'Acme Inc');
  assert.equal((await make({ labels: async () => { throw new Error('x'); } }).snapshot()).workers[0].project.label, 'acme');
});
test('open links come only from well-formed ids', async () => {
  const { make } = await setup([S({ hostSessionId: 'local_ab-1', bridgeSessionId: 'session_01A' })]);
  const [w] = (await make().snapshot()).workers; assert.equal(w.open, 'local_ab-1'); assert.equal(w.web, 'session_01A');
  const bad = await setup([S({ hostSessionId: 'local_x"onclick=', bridgeSessionId: 'javascript:1' })]);
  const [b] = (await bad.make().snapshot()).workers; assert.equal(b.open, null); assert.equal(b.web, null);
});
test('unknown status is not presented as idle', async () => {
  const { make } = await setup([S({ status: 'newthing' })]);
  assert.equal((await make().snapshot()).workers[0].status, 'unknown');
});
test('subagents: running shown; finished, ended and stale hidden', async () => {
  const { home, make } = await setup([S({})]);
  const d = path.join(home, '.claude/projects/p/abc/subagents');
  const put = async (id, meta, line) => { await fs.writeFile(`${d}/agent-${id}.meta.json`, JSON.stringify(meta)); await fs.writeFile(`${d}/agent-${id}.jsonl`, line); };
  await put('run', { agentType: 'deployer' }, A({}));
  await put('fin', { agentType: 'x', finished: true }, A({}));
  await put('end', { agentType: 'x' }, A({ stop_reason: 'end_turn' }));
  const names = async (o) => (await make(o).snapshot()).workers.filter((w) => w.kind === 'agent').map((w) => w.type);
  assert.deepEqual(await names(), ['deployer']);
  assert.deepEqual(await names({ now: () => Date.now() + 3600e3 }), []);
});
test('defined agents are staff; a live run is done by that agent, a second run gets its own worker', async () => {
  const { home, make } = await setup([S({})]);
  await fs.mkdir(path.join(home, '.claude/agents'));
  await fs.writeFile(path.join(home, '.claude/agents/deployer.md'), '---\nname: deployer\ndescription: "Deploys sites. And more"\n---\nSecret body');
  await fs.writeFile(path.join(home, '.claude/agents/deployer.md.bak'), '---\nname: old\n---');
  const agents = async () => (await make().snapshot()).workers.filter((w) => w.kind === 'agent');
  let a = await agents();
  assert.deepEqual(a.map((w) => [w.id, w.status, w.role]), [['r:deployer', 'idle', 'Deploys sites']]);
  assert.ok(!JSON.stringify(a).includes('Secret'));
  const d = path.join(home, '.claude/projects/p/abc/subagents');
  for (const id of ['1', '2']) { await fs.writeFile(`${d}/agent-${id}.meta.json`, '{"agentType":"deployer","description":"A task"}'); await fs.writeFile(`${d}/agent-${id}.jsonl`, A({})); }
  a = await agents();
  assert.equal(a.length, 2); assert.ok(a.every((w) => w.status === 'working' && w.parent === 's:abc'));
  assert.equal(a.filter((w) => w.id === 'r:deployer').length, 1);
});
test('reads only the tail of a large transcript', async () => {
  const { make } = await setup([S({})], [U('x'.repeat(3e6)), A({ content: [{ type: 'tool_use', id: '1', name: 'Read', input: { file_path: '/a/b.ts' } }] })]);
  assert.equal((await make().snapshot()).workers[0].action.text, 'Reading b.ts');
});
test('secrets and raw commands never leave the collector', () => {
  assert.ok(!redact('token=abc123 ghp_abcdefghijklmnop').includes('abc'));
  const r = parseTranscript([A({ content: [{ type: 'tool_use', id: '1', name: 'Bash', input: { command: 'curl -H secretvalue' } }] })]);
  assert.ok(!JSON.stringify(r).includes('secretvalue'));
});
test('chums: alive with a finished turn is idle, a turn in progress is working, a dead process stays unknown', async () => {
  const { home } = await setup([]);
  await fs.mkdir(path.join(home, '.chums/agents'), { recursive: true });
  const cwd = path.join(home, '.chums/agents/noodle'), dir = path.join(home, '.claude/projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(home, '.chums/agents.json'), JSON.stringify([{ id: 'noodle', name: 'Noodle', cwd }]));
  await fs.writeFile(path.join(home, '.chums/agents/noodle.host.log'), 'x started (pid 5)\ny started (pid 7)\n');
  const run = async (line, pids, at = Date.now()) => { await fs.writeFile(path.join(dir, 'a.jsonl'), line); return (await createCollector({ home, processes: async () => new Map(pids.map((p) => [p, 1])), services: async () => new Set(['noodle']), now: () => at }).snapshot()).workers.find((w) => w.id === 'c:noodle').status; };
  assert.equal(await run(A({ stop_reason: 'end_turn' }), [7]), 'idle');
  assert.equal(await run(A({ content: [{ type: 'tool_use', id: '1', name: 'Read', input: {} }] }), [7]), 'working');
  assert.equal(await run(A({ content: [{ type: 'tool_use', id: '1', name: 'Read', input: {} }] }), [7], Date.now() + 3600e3), 'idle', 'stale: not working any more');
  assert.equal(await run(A({ stop_reason: 'end_turn' }), [5]), 'unknown', 'only the last started pid counts');
});
