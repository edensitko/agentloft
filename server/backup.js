import { promises as fs } from 'node:fs';
import path from 'node:path';

const DAY = /^\d{4}-\d{2}-\d{2}$/, UNDO = 'before-restore', TPL = /^t[a-z0-9]{6,16}\.json$/;
const exists = (f) => fs.access(f).then(() => true, () => false);
const local = (ms) => { const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/**
 * Daily copies of the user's own files (design, company, saved templates) in data/backups, on their machine.
 * One copy per day, only when something changed since the last one, and the newest `keep` days stay.
 */
export function createBackups(dir, { keep = 7, now = Date.now } = {}) {
  const root = path.join(dir, 'backups'), days = async () => (await fs.readdir(root).catch(() => [])).filter((d) => DAY.test(d)).sort().reverse();
  /** name -> text of every file worth keeping; a file that is not valid JSON is left out, so a broken one never replaces a good copy. */
  async function read(from) {
    const out = new Map(), take = async (name) => { try { const text = await fs.readFile(path.join(from, name), 'utf8'); JSON.parse(text); out.set(name, text); } catch {} };
    for (const n of ['layout.json', 'company.json']) await take(n);
    for (const f of (await fs.readdir(path.join(from, 'templates')).catch(() => [])).filter((x) => TPL.test(x)).sort()) await take('templates/' + f);
    return out;
  }
  async function write(name, files) {
    const tmp = path.join(root, `.${name}.${process.pid}.tmp`), to = path.join(root, name);
    await fs.rm(tmp, { recursive: true, force: true }); for (const [f, text] of files) { await fs.mkdir(path.dirname(path.join(tmp, f)), { recursive: true }); await fs.writeFile(path.join(tmp, f), text); }
    await fs.rm(to, { recursive: true, force: true }); await fs.rename(tmp, to);
  }
  const same = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
  return {
    /** Makes today's copy when there is none yet. Returns its name, or null when nothing was needed. */
    async daily() {
      const today = local(now()), have = await days(); if (have.includes(today)) return null;
      const files = await read(dir); if (!files.size || (have[0] && same(files, await read(path.join(root, have[0]))))) return null;
      await write(today, files); for (const old of (await days()).slice(keep)) await fs.rm(path.join(root, old), { recursive: true, force: true });
      return today;
    },
    async list() {
      const names = [...(await exists(path.join(root, UNDO)) ? [UNDO] : []), ...await days()];
      return Promise.all(names.map(async (name) => { const f = await read(path.join(root, name)); let company = null, rooms = 0; try { const c = JSON.parse(f.get('company.json')); company = c.name ?? null; rooms = Object.keys(c.depts ?? {}).length; } catch {} return { name, company, rooms, templates: [...f.keys()].filter((k) => k.startsWith('templates/')).length }; }));
    },
    /** Brings a copy back. What is there now is kept first as "before-restore". Templates are only added, never removed. `apply` validates and saves. */
    async restore(name, apply) {
      if (name !== UNDO && !DAY.test(name)) return false;
      const files = await read(path.join(root, name)); if (!files.size) return false;
      await write(UNDO, await read(dir));
      if (files.has('company.json')) await apply.company(JSON.parse(files.get('company.json')));
      if (files.has('layout.json')) await apply.layout(JSON.parse(files.get('layout.json')));
      for (const [f, text] of files) if (f.startsWith('templates/') && !(await exists(path.join(dir, f)))) { await fs.mkdir(path.join(dir, 'templates'), { recursive: true }); await fs.writeFile(path.join(dir, f), text); }
      return true;
    },
  };
}
