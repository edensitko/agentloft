// Settings: everything about this viewer and this machine that is not the design of the office.
import { t, LANG, LANGS, LOCALE, setLang } from './i18n.js';

const el = (tag, o = {}, ...kids) => { const e = Object.assign(document.createElement(tag), o); e.append(...kids); return e; };
const row = (label, control, note) => el('label', { className: 'setrow' }, el('span', {}, el('b', { textContent: label }), ...(note ? [el('small', { textContent: note })] : [])), control);
const choose = (opts, val, fn) => { const s = el('select'); for (const [k, text] of opts) s.append(el('option', { value: k, textContent: text, selected: k === val })); s.onchange = () => fn(s.value); return s; };

/** ctx: { notify, setNotify, quality, setQuality, startOver, demo, local, toast } */
export function showSettings(ctx) {
  const d = el('dialog', { id: 'settings' }), close = el('button', { type: 'button', textContent: '✕', className: 'sclose' }); close.setAttribute('aria-label', t('Close settings')); close.onclick = () => d.close();
  const alerts = el('input', { type: 'checkbox', checked: ctx.notify }); alerts.onchange = () => ctx.setNotify(alerts.checked);
  const over = el('button', { type: 'button', textContent: t('Start over') }); over.onclick = () => { if (confirm(t('Choose the office again? The office you have now is saved first under My templates.'))) { d.close(); ctx.startOver(); } };
  const quit = el('button', { type: 'button', className: 'danger', textContent: t('Turn off the server') });
  quit.onclick = async () => {
    if (!confirm(t('Turn off the server? Your Claude sessions keep running. To come back, start it again from the terminal, or log in again if it starts by itself.'))) return;
    const r = await fetch('/api/quit', { method: 'POST' }).catch(() => null);
    if (!r?.ok) { ctx.toast(t('The office could not be closed')); return; }
    ctx.stop?.(); d.close(); document.body.append(el('main', { id: 'bye' }, el('h1', { textContent: t('The office is closed') }), el('p', { textContent: t('Your Claude sessions are still running. You can close this tab.') })));
  };
  const exit = el('button', { type: 'button', className: 'main', textContent: t('Exit the office') }); exit.onclick = () => { location.href = 'https://edensitko.github.io/agentloft/'; };
  const box = el('div', { className: 'backups' }, el('small', { textContent: t('No backups yet') }));
  const when = (n) => (n === 'before-restore' ? t('Before the last restore') : new Date(n + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }));
  if (!ctx.demo) fetch('/api/backups').then((r) => r.json()).then((list) => { if (list.length) box.replaceChildren(...list.map((b) => {
    const go = el('button', { type: 'button', textContent: t('Restore') }); go.setAttribute('aria-label', `${t('Restore')}: ${when(b.name)}`);
    go.onclick = async () => { if (!confirm(t('Go back to this copy? What you have now is kept first, so you can return to it.'))) return; go.disabled = true; const r = await fetch('/api/backups/' + b.name, { method: 'POST' }).catch(() => null); if (r?.ok) location.reload(); else { go.disabled = false; ctx.toast(t('The backup could not be restored')); } };
    return el('div', { className: 'setrow' }, el('span', {}, el('b', { textContent: when(b.name) }), el('small', { textContent: [b.company, t('{0} rooms', b.rooms)].filter(Boolean).join(' · ') })), go);
  })); }).catch(() => {});
  const keys = [['[ ]', t('Previous or next room')], ['↑ ↓ ← →', t('Walk and turn, while walking')], ['Shift', t('Run, while walking')], ['E', t('Open the session of the person in front of you')], ['T', t('Give them a task')], ['F', t('Sit down')], ['Esc', t('Leave walking')]];
  d.append(el('div', { className: 'whead' }, el('h2', { id: 'sTitle', textContent: t('Settings') }), close),
    row(t('Language'), choose(Object.entries(LANGS).map(([k, l]) => [k, l.name]), LANG, setLang)),
    row(t('Alerts'), alerts, t('A sound here and a notification on your computer when a session starts waiting for you')),
    row(t('Graphics'), choose([['auto', t('Automatic')], ['high', t('High')], ['low', t('Low')]], ctx.quality, ctx.setQuality), t('Low is for older machines and battery')),
    ...(ctx.demo ? [] : [row(t('Office'), over, t('Pick a ready-made office again'))]),
    ...(ctx.demo ? [] : [el('h3', { textContent: t('Backups') }), el('p', { textContent: t('A copy of your company, design and templates is kept for each of the last seven days they changed, on this computer.') }), box]),
    el('h3', { textContent: t('Keyboard') }), el('dl', { className: 'skeys' }, ...keys.flatMap(([k, text]) => [el('dt', {}, el('kbd', { textContent: k })), el('dd', { textContent: text })])),
    el('h3', { textContent: t('Privacy') }), el('p', { textContent: t('Your company, design and templates are saved only in the data folder next to the code. Nothing is sent anywhere.') }),
    el('div', { className: 'wacts' }, exit, ...(ctx.local && !ctx.demo ? [quit] : [])));
  d.setAttribute('aria-labelledby', 'sTitle'); d.onclose = () => d.remove(); d.onclick = (e) => { if (e.target === d) d.close(); }; document.body.append(d); d.showModal(); d.scrollTop = 0;
}
