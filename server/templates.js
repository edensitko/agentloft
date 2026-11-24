import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cleanCompany } from './company.js';
import { cleanLayout } from './layout.js';

const ID = /^t[a-z0-9]{6,16}$/, MAX = 30;

/**
 * The user's own saved offices: a name, the company and the design, one file each in a folder on their machine.
 * Both parts are cleaned on the way in and again on the way out, so a hand-edited file cannot break the office.
 */
export function createTemplates(dir, now = Date.now) {
  const file = (id) => path.join(dir, id + '.json');
  const read = async (id) => {
    if (!ID.test(id)) return null;
    try { const t = JSON.parse(await fs.readFile(file(id), 'utf8')); return { id, name: String(t.name ?? '').slice(0, 40) || 'Untitled', at: Number(t.at) || 0, company: cleanCompany(t.company), layout: cleanLayout(t.layout ?? {}) }; } catch { return null; }
  };
  const ids = async () => { try { return (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => ID.test(id)); } catch { return []; } };
  return {
    get: read,
    /** Newest first, without the contents. */
    async list() { return (await Promise.all((await ids()).map(read))).filter(Boolean).sort((a, b) => b.at - a.at).map((t) => ({ id: t.id, name: t.name, at: t.at, rooms: Object.keys(t.company.depts).length, roles: t.company.roles.length })); },
    async save({ name, company, layout }) {
      const n = typeof name === 'string' ? name.trim().slice(0, 40) : ''; if (!n) throw new Error('a template needs a name');
      const t = { name: n, at: now(), company: cleanCompany(company), layout: cleanLayout(layout ?? {}) };
      if ((await ids()).length >= MAX) throw new Error(`there are already ${MAX} templates, delete one first`);
      const id = 't' + now().toString(36) + Math.random().toString(36).slice(2, 6); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(file(id), JSON.stringify(t, null, 2)); return { id, name: n, at: t.at };
    },
    async remove(id) { if (!ID.test(id)) return false; try { await fs.unlink(file(id)); return true; } catch { return false; } },
  };
}
