import { promises as fs } from 'node:fs';
import path from 'node:path';

const str = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
const ID = /^[\w-]{1,40}$/;

/**
 * Validates a company definition and returns a clean copy, or throws with the reason.
 * It is the user's own file, yet it is also written from the browser, so sizes and shapes are bounded.
 */
export function cleanCompany(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('company must be an object');
  const depts = {};
  for (const [k, d] of Object.entries(c.depts ?? {}).slice(0, 15)) {
    if (!ID.test(k) || !str(d?.label, 40) || !Number.isInteger(d.slot) || d.slot < 0 || d.slot > 14) throw new Error(`bad department ${k}`);
    depts[k] = { label: str(d.label, 40), slot: d.slot, ...(str(d.style, 20) ? { style: str(d.style, 20) } : {}) };
  }
  const slots = Object.values(depts).map((d) => d.slot);
  if (!slots.length) throw new Error('a company needs at least one department'); if (new Set(slots).size !== slots.length) throw new Error('two departments share a room');
  const roles = [], seen = new Set();
  for (const r of (Array.isArray(c.roles) ? c.roles : []).slice(0, 60)) {
    if (!ID.test(r?.id ?? '') || seen.has(r.id) || !str(r.name, 40) || !depts[r.dept]) throw new Error(`bad role ${r?.id}`);
    seen.add(r.id); roles.push({ id: r.id, name: str(r.name, 40), dept: r.dept, ...(r.lead ? { lead: true } : {}), ...(ID.test(r.agent ?? '') ? { agent: r.agent } : {}), ...(str(r.brief, 300) ? { brief: str(r.brief, 300) } : {}) });
  }
  if (!roles.some((r) => r.lead)) throw new Error('a company needs at least one lead');
  const rules = [];
  for (const rule of (Array.isArray(c.rules) ? c.rules : []).slice(0, 80)) {
    const [id, source, flags] = Array.isArray(rule) ? rule : []; if (!seen.has(id) || !str(source, 300)) continue;
    const f = /^[imsu]{0,4}$/.test(flags ?? '') ? flags ?? 'i' : 'i'; try { new RegExp(source, f); } catch { continue; } rules.push([id, source.trim().slice(0, 300), f]);
  }
  const labels = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 80).filter(([k, v]) => /^[\w.@-]{1,60}$/.test(k) && str(v, 40)).map(([k, v]) => [k, str(v, 40)]));
  return { name: str(c.name, 40), prompt: str(c.prompt, 400), fallback: seen.has(c.fallback) ? c.fallback : roles.find((r) => r.lead).id, staffDept: depts[c.staffDept] ? c.staffDept : null,
    depts, roles, rules, projects: labels(c.projects), agents: labels(c.agents) };
}

/** The user's company file. `get()` is null when there is none or it is broken, so the office falls back to a template. */
export function createCompany(file) {
  let cached, at = 0;
  return {
    async get() {
      try { const st = await fs.stat(file); if (st.mtimeMs !== at) { cached = cleanCompany(JSON.parse(await fs.readFile(file, 'utf8'))); at = st.mtimeMs; } return cached; } catch { at = 0; cached = null; return null; }
    },
    // before overwriting, the current file is kept as company.prev.json: one step back, on disk
    async set(c) { const clean = cleanCompany(c); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.copyFile(file, file.replace(/\.json$/, '.prev.json')).catch(() => {}); const tmp = file + '.tmp'; await fs.writeFile(tmp, JSON.stringify(clean, null, 2)); await fs.rename(tmp, file); at = 0; return clean; },
  };
}
