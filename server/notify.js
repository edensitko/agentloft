/** Tracks who is waiting for the user and reports each person once, when they start waiting. */
export function createWatcher({ now = Date.now, quiet = 60_000 } = {}) {
  let known = null; const last = new Map();
  return function newlyWaiting(workers) {
    const waiting = new Map(workers.filter((w) => w.status === 'waiting').map((w) => [w.id, w]));
    const fresh = known === null ? [] : [...waiting.values()].filter((w) => !known.has(w.id) && now() - (last.get(w.id) ?? -Infinity) > quiet); // nothing on start-up, and no flapping
    for (const w of fresh) last.set(w.id, now());
    known = new Set(waiting.keys());
    return fresh;
  };
}
