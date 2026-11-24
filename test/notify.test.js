import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatcher } from '../server/notify.js';
const W = (id, status) => ({ id, status });
test('each agent is announced once when it starts waiting, never on start-up', () => {
  let t = 0; const watch = createWatcher({ now: () => t });
  assert.deepEqual(watch([W('a', 'waiting'), W('b', 'working')]), [], 'already waiting at start');
  assert.deepEqual(watch([W('a', 'waiting'), W('b', 'waiting')]).map((w) => w.id), ['b']);
  assert.deepEqual(watch([W('a', 'waiting'), W('b', 'waiting')]), [], 'still waiting');
  watch([W('b', 'working')]); t = 10_000; assert.deepEqual(watch([W('b', 'waiting')]), [], 'flapping within a minute');
  watch([W('b', 'working')]); t = 100_000; assert.deepEqual(watch([W('b', 'waiting')]).map((w) => w.id), ['b']);
});
