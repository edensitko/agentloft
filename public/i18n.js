// Languages. Text is written in English in the code and looked up here, so English needs no dictionary:
//   t('Waiting for you')      t('{0} rooms', n)
// A language is a dictionary (English text -> translated text) under locales/, and a line in LANGS. A missing entry falls
// back to English, so a half-translated language still works.
export const LANGS = {
  en: { name: 'English', dir: 'ltr', locale: 'en-US' }, es: { name: 'Español', dir: 'ltr', locale: 'es-ES' }, fr: { name: 'Français', dir: 'ltr', locale: 'fr-FR' }, de: { name: 'Deutsch', dir: 'ltr', locale: 'de-DE' },
  pt: { name: 'Português', dir: 'ltr', locale: 'pt-BR' }, ru: { name: 'Русский', dir: 'ltr', locale: 'ru-RU' }, he: { name: 'עברית', dir: 'rtl', locale: 'he-IL' }, ar: { name: 'العربية', dir: 'rtl', locale: 'ar' },
};

function pick() {
  try {
    const q = new URLSearchParams(location.search).get('lang'); if (q && LANGS[q]) { localStorage.setItem('lang', q); return q; }
    const saved = localStorage.getItem('lang'); if (saved && LANGS[saved]) return saved;
    const mine = (navigator.language || 'en').slice(0, 2).toLowerCase(); return LANGS[mine] ? mine : 'en';
  } catch { return 'en'; }
}
/** The language of this page. Outside a browser (the tests) it is always English. */
export const LANG = typeof document === 'undefined' ? 'en' : pick();
export const DIR = LANGS[LANG].dir, LOCALE = LANGS[LANG].locale;
if (typeof document !== 'undefined') { document.documentElement.lang = LANG; document.documentElement.dir = DIR; }

const PACK = LANG === 'en' ? {} : await import(`./locales/${LANG}.js`).then((m) => m.default).catch(() => ({})); // only the language in use is loaded

/** Translates an English text; {0}, {1}… are replaced by the extra arguments. */
export function t(text, ...args) {
  const s = PACK[text] ?? text;
  return args.length ? s.replace(/\{(\d)\}/g, (_, i) => String(args[i] ?? '')) : s;
}
/** Switches language and reloads, because labels are built once when the page starts. */
export function setLang(lang) { if (!LANGS[lang] || lang === LANG) return; try { localStorage.setItem('lang', lang); } catch {} const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u); }

// Text that the server writes (what a tool is doing) arrives in English; these are its fixed openings.
const OPENINGS = ['Running agent: ', 'Running: ', 'Reading ', 'Editing ', 'Skill: ', 'Needs permission: ', 'Leading: '];
/** Translates a line that came from the server, keeping the file name or description that follows its opening. */
export function tLine(text) {
  if (LANG === 'en' || typeof text !== 'string') return text;
  for (const o of OPENINGS) if (text.startsWith(o)) return t(o) + text.slice(o.length);
  return t(text);
}
