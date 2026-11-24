import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingSummary, ago, needOf } from '../public/summary.js';

const NOW = 1_000_000_000_000, MIN = 60000, H = 60 * MIN;
const team = [
  { id: 'a', name: 'Team lead', kind: 'agent', status: 'idle', lastTask: 'Review a commit' },
  { id: 'b', name: 'Site session', kind: 'session', status: 'waiting', question: 'Deploy?', since: NOW - 12 * MIN },
  { id: 'c', name: 'Bot session', kind: 'session', status: 'working', task: 'Build phase 1', action: { text: 'Running tests' }, since: NOW - 3 * MIN, contextTokens: 186000 },
  { id: 'd', name: 'Old session', kind: 'session', status: 'idle', task: 'Sign-up page', lastAt: NOW - 50 * H },
  { id: 'e', name: 'New agent', kind: 'agent', status: 'idle' },
];

test('ago rounds to minutes, hours and days', () => {
  assert.equal(ago(20000), 'now'); assert.equal(ago(12 * MIN), '12 min'); assert.equal(ago(3 * H), '3 h'); assert.equal(ago(50 * H), '2 days');
});

test('summary puts whoever waits first, then work, notes and idle', () => {
  const s = meetingSummary(team, 'AI & automation', NOW);
  assert.deepEqual(s.sections.map((x) => x.key), ['waiting', 'working', 'notes', 'idle']);
  assert.deepEqual(s.counts, { all: 5, waiting: 1, working: 1, idle: 3 });
  assert.equal(s.sections[0].items[0].text, 'Deploy? · for 12 min');
  assert.equal(s.sections[1].items[0].text, 'Build phase 1 · Running tests · 3 min');
});

test('notes flag a big context and a session nobody touched for over a day', () => {
  const notes = meetingSummary(team, 'x', NOW).sections.find((x) => x.key === 'notes').items;
  assert.deepEqual(notes.map((n) => n.id), ['c', 'd']);
  assert.match(notes[0].text, /186k tokens/); assert.match(notes[1].text, /2 days/);
});

test('idle agents show their last task, or that they never got one', () => {
  const idle = meetingSummary(team, 'x', NOW).sections.find((x) => x.key === 'idle').items;
  assert.equal(idle.find((i) => i.id === 'a').text, 'Last task: Review a commit');
  assert.equal(idle.find((i) => i.id === 'e').text, 'No task yet');
});

test('an empty team has no sections and the text still names the team', () => {
  const s = meetingSummary([], 'Finance', NOW);
  assert.deepEqual(s.sections, []); assert.match(s.text, /^Meeting summary: Finance\n0 in the team/);
});

test('a session recap replaces the last typed message, and follows the question of a waiting one', () => {
  const t = [{ id: 'a', name: 'Session', kind: 'session', status: 'idle', task: 'yes', recap: 'The page is built, not deployed.', lastAt: NOW - 2 * H },
    { id: 'b', name: 'Session B', kind: 'session', status: 'waiting', question: 'Deploy?', recap: 'Everything is ready to deploy.' }];
  const s = meetingSummary(t, 'x', NOW);
  assert.equal(s.sections.find((x) => x.key === 'idle').items[0].text, 'The page is built, not deployed. · last active 2 h ago');
  assert.equal(s.sections[0].items[0].more, 'Everything is ready to deploy.'); assert.match(s.text, /\n  Everything is ready to deploy\./);
});

test('a waiting worker is described by what it needs', () => {
  assert.deepEqual(needOf({ need: { kind: 'permission', text: 'Running: tests', options: [] } }), { label: 'Needs permission', text: 'Needs permission: tests', options: [] });
  assert.equal(needOf({ need: { kind: 'plan', text: 'A plan is waiting', options: [], via: 'Site session' } }).text, 'Site session: A plan is waiting');
  assert.equal(needOf({ need: { kind: 'question', text: 'Which colour?', options: ['Blue', 'Green'] } }).label, 'Asking you');
  assert.deepEqual(needOf({ question: 'Deploy?' }), { label: 'Waiting for you', text: 'Deploy?', options: [] });
  const s = meetingSummary([{ id: 'a', name: 'Session', kind: 'session', status: 'waiting', need: { kind: 'question', text: 'Which colour?', options: ['Blue', 'Green'] } }], 'x', NOW);
  assert.equal(s.sections[0].items[0].text, 'Which colour? · (Blue / Green)');
});
