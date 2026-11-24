import { t, tLine } from './i18n.js';

/** How long ago, in short words, rounded so the text stays stable for a while. */
export function ago(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return t('now'); if (m < 60) return t('{0} min', m); const h = Math.round(m / 60); if (h < 24) return t('{0} h', h); return t('{0} days', Math.round(h / 24));
}
const BIG_CONTEXT = 150000, STALE = 24 * 3600 * 1000;

/**
 * The status of a team as a meeting summary, built only from what the office already knows about each worker.
 * A session's recap (its own last words on where it stands) is preferred over the last thing the user typed.
 * Returns { counts, sections: [{ key, title, items: [{ id, name, text, more? }] }], text } - text is the same summary as plain lines, for copying.
 */
/** What a waiting worker needs from the user, as a short label and the full line. */
export const NEED = { question: t('Asking you'), plan: t('Plan to approve'), permission: t('Needs permission'), decision: t('Waiting for a decision'), reply: t('Waiting for a reply') };
export function needOf(w) {
  const n = w.need; if (!n) return { label: t('Waiting for you'), text: w.question ?? t('Waiting for your reply'), options: [] };
  const text = n.kind === 'permission' ? t('Needs permission: ') + n.text.replace(/^Running: /, '') : tLine(n.text); // the opening is stripped from the server's own text, before any translation
  return { label: NEED[n.kind] ?? t('Waiting for you'), text: n.via ? `${n.via}: ${text}` : text, options: n.options ?? [] };
}

export function meetingSummary(team, label, now = Date.now()) {
  const by = (s) => team.filter((w) => w.status === s), since = (w) => (w.since ? ago(now - w.since) : null);
  const waiting = by('waiting').map((w) => ({ id: w.id, name: w.name, text: [needOf(w).text, needOf(w).options.length ? `(${needOf(w).options.join(' / ')})` : null, since(w) && t('for {0}', since(w))].filter(Boolean).join(' · '), more: w.recap ?? null }));
  const working = by('working').map((w) => ({ id: w.id, name: w.name, text: [tLine(w.task ?? w.action?.text) ?? t('Working'), w.task && tLine(w.action?.text), since(w)].filter(Boolean).join(' · '), more: w.recap ? t('Before: {0}', w.recap) : null }));
  const idle = team.filter((w) => w.status !== 'waiting' && w.status !== 'working').map((w) => ({ id: w.id, name: w.name,
    text: w.kind === 'session' ? [w.recap ?? w.task, w.lastAt ? t('last active {0} ago', ago(now - w.lastAt)) : null].filter(Boolean).join(' · ') || t('No activity') : w.lastTask ? t('Last task: {0}', w.lastTask) : t('No task yet') }));
  const notes = team.flatMap((w) => [
    w.contextTokens > BIG_CONTEXT ? { id: w.id, name: w.name, text: t('Large context ({0}k tokens), worth continuing in a new session', Math.round(w.contextTokens / 1000)) } : null,
    w.kind === 'session' && w.status === 'idle' && w.lastAt && now - w.lastAt > STALE ? { id: w.id, name: w.name, text: t('Untouched for {0}, close it or pick it up', ago(now - w.lastAt)) } : null,
  ].filter(Boolean));
  const sections = [{ key: 'waiting', title: t('Waiting on you'), items: waiting }, { key: 'working', title: t('Working now'), items: working }, { key: 'notes', title: t('Worth a look'), items: notes }, { key: 'idle', title: t('Idle now'), items: idle }].filter((s) => s.items.length);
  const counts = { all: team.length, waiting: waiting.length, working: working.length, idle: idle.length };
  const text = [t('Meeting summary: {0}', label), t('{0} in the team · {1} working · {2} waiting for you · {3} idle', counts.all, counts.working, counts.waiting, counts.idle), ...sections.flatMap((s) => ['', s.title + ':', ...s.items.flatMap((i) => [`- ${i.name}: ${i.text}`, ...(i.more ? [`  ${i.more}`] : [])])])].join('\n');
  return { counts, sections, text };
}
