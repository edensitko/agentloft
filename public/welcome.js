// The first screen on a new machine: language, a name, and an office to start from.
import { t, LANG, LANGS, setLang } from './i18n.js';
import { OFFICE_TEMPLATES, officeDesign } from './office.templates.js';
import { COMPANY_TEMPLATES, localizeCompany } from './company.templates.js';

const el = (tag, o = {}, ...kids) => { const e = Object.assign(document.createElement(tag), o); e.append(...kids); return e; };
const companyOf = (id) => localizeCompany(COMPANY_TEMPLATES.find((c) => c.id === id).company);

/** apply(company, design | null) saves the choice and resolves to true when it was accepted. */
export function showWelcome(apply, cancel = null, current = null) { // cancel: given when there already is an office to go back to
  let chosen = 'startup';
  const lang = el('select'); lang.setAttribute('aria-label', t('Language')); for (const [k, l] of Object.entries(LANGS)) lang.append(el('option', { value: k, textContent: l.name, selected: k === LANG })); lang.onchange = () => setLang(lang.value);
  const name = el('input', { type: 'text', maxLength: 40, placeholder: t('Optional'), autocomplete: 'organization', value: current ?? '', dir: 'auto' });
  const cards = OFFICE_TEMPLATES.map((o) => { const r = el('input', { type: 'radio', name: 'office', value: o.id, checked: o.id === chosen }); r.onchange = () => { chosen = o.id; }; return el('label', { className: 'wcard' }, r, el('img', { src: new URL(`welcome/${o.id}.jpg`, import.meta.url).href, alt: '', width: 400, height: 250 }), el('b', { textContent: t(o.name) }), el('small', { textContent: t(o.about) })); });
  const back = el('button', { type: 'button', className: 'sclose', textContent: '✕' }); back.setAttribute('aria-label', t('Back to the current office')); back.onclick = () => { d.close(); d.remove(); cancel(); };
  const go = el('button', { type: 'submit', className: 'main', textContent: t('Open my office') }), skip = el('button', { type: 'button', textContent: t('Start with a simple office') });
  const form = el('form', {}, el('div', { className: 'whead' }, el('h2', { id: 'wTitle', textContent: cancel ? t('Choose an office') : t('Welcome to your office') }), lang, ...(cancel ? [back] : [])), el('p', { textContent: t('Your Claude Code sessions are about to get desks. Everything stays on this machine.') }),
    el('label', { className: 'wname' }, t('Company name'), name), el('fieldset', {}, el('legend', { textContent: t('Pick an office to start from') }), el('div', { className: 'wgrid' }, ...cards)), el('p', { className: 'wnote', textContent: t('You can change everything later under "Design the office".') }), el('div', { className: 'wacts' }, go, skip));
  const d = el('dialog', { id: 'welcome' }, form); d.setAttribute('aria-labelledby', 'wTitle'); document.body.append(d);
  const finish = async (company, design) => { go.disabled = skip.disabled = true; if (await apply({ ...company, name: name.value.trim() || null }, design)) { d.close(); d.remove(); } else go.disabled = skip.disabled = false; };
  form.onsubmit = (e) => { e.preventDefault(); const o = OFFICE_TEMPLATES.find((x) => x.id === chosen), c = companyOf(o.company); finish(c, officeDesign(o, c)); };
  skip.onclick = () => finish(companyOf('small'), null);
  d.addEventListener('cancel', (e) => { e.preventDefault(); (cancel ? back : skip).click(); }); // Esc: the simple office
  d.showModal(); go.focus({ preventScroll: true }); d.scrollTop = 0;
}
