// The company that the office shows: departments, the people who lead them, and the rules that decide who is responsible for a session.
// It is data, not code: the server hands over the user's own company (data/company.json, kept on their machine) and the office
// falls back to a built-in template when there is none. Roles with `agent` are real Claude agents from ~/.claude/agents; a role
// whose agent file is missing, and any role added in the editor, still works as an office role.
import { COMPANY_TEMPLATES, localizeCompany } from './company.templates.js';
import { t } from './i18n.js';

export let COMPANY, DEPTS, ROLES;
let RULES = [], FALLBACK = null, STAFF_DEPT = null;
/** Switches the office to a company definition. Bad rules are skipped, so one typo does not take the office down. */
export function setCompany(c) {
  COMPANY = c; DEPTS = c.depts ?? {}; ROLES = (c.roles ?? []).filter((r) => DEPTS[r.dept]);
  RULES = (c.rules ?? []).flatMap(([id, source, flags]) => { try { return ROLES.some((r) => r.id === id) ? [[id, new RegExp(source, flags ?? 'i')]] : []; } catch { return []; } });
  FALLBACK = ROLES.find((r) => r.id === c.fallback) ?? ROLES.find((r) => r.lead) ?? ROLES[0] ?? null;
  STAFF_DEPT = DEPTS[c.staffDept] ? c.staffDept : FALLBACK?.dept ?? Object.keys(DEPTS)[0];
}
setCompany(localizeCompany(COMPANY_TEMPLATES[0].company));

/** The lead's role id when the task text names one of the agents ("Use the agent acme-finance …"), else null. */
export function taskRole(task, roles = ROLES) {
  const name = /\bthe agent ([\w-]+)/i.exec(task ?? '')?.[1], r = name && roles.find((x) => x.agent === name);
  return r ? leadOf(r, roles).id : null;
}
/** The manager or team lead responsible for a session. */
export function assign(w, roles = ROLES) {
  const byId = (id) => roles.find((r) => r.id === id);
  for (const text of [w.name ?? '', `${w.project?.label ?? ''} ${w.project?.key ?? ''}`]) for (const [id, re] of RULES) if (re.test(text) && byId(id)) return leadOf(byId(id), roles);
  return FALLBACK;
}
const leadOf = (r, roles) => (r.lead ? r : roles.find((x) => x.dept === r.dept && x.lead) ?? r);
const room = (dept) => ({ key: 'co:' + dept, label: DEPTS[dept]?.label ?? dept });

/** Places everyone in the company. Leads without work of their own reflect the sessions they are responsible for. */
export function organise(list, design = {}) {
  const custom = (design.custom ?? []).filter((r) => DEPTS[r.dept]).map((r) => ({ ...r, custom: true })), roles = [...ROLES, ...custom], out = [];
  const live = new Set(list.filter((w) => w.staff).map((w) => w.type)), idOf = (r) => (r.agent && live.has(r.agent) ? 'r:' + r.agent : 'o:' + r.id);
  const bySession = new Map(), chums = new Map();
  for (const w of list) {
    if (w.kind === 'session') { const chosen = roles.find((r) => r.id === design.assign?.[w.id]), r = chosen ?? assign(w, roles); bySession.set(w.id, r); out.push({ ...w, leadRole: r.id, leadId: idOf(r), leadName: r.name, room: room(r.dept), auto: !chosen }); }
    else if (w.kind === 'chum') { if (w.agentType && !chums.has(w.agentType)) chums.set(w.agentType, w); } // a Chum is the person behind a role, not an extra employee; one without a role is not part of the office
    else if (w.staff) { const r = roles.find((x) => x.agent === w.type); out.push(r ? { ...w, name: r.name, lead: !!r.lead, roleId: r.id, room: room(r.dept) } : { ...w, room: room(STAFF_DEPT) }); }
  }
  for (const w of list) if (w.kind === 'agent' && !w.staff) { const r = bySession.get(w.parent); out.push({ ...w, room: room(r?.dept ?? FALLBACK?.dept ?? STAFF_DEPT) }); }
  for (const r of roles) if (!(r.agent && live.has(r.agent))) out.push({ id: 'o:' + r.id, kind: 'role', staff: true, roleId: r.id, lead: !!r.lead, custom: !!r.custom, name: r.name, role: r.brief ?? null, brief: r.brief ?? null, status: 'idle', project: null, room: room(r.dept), task: null, action: null, model: null, contextTokens: null, branch: null, question: null, startedAt: null, lastAt: null });
  for (const w of out) if (w.lead) {
    const mine = out.filter((s) => s.kind === 'session' && s.leadId === w.id); w.team = mine.map((s) => s.id);
    if (w.status !== 'idle') continue;
    const top = mine.find((s) => s.status === 'waiting') ?? mine.find((s) => s.status === 'working');
    if (top) { w.status = top.status; w.action = { kind: 'lead', text: t('Leading: ') + top.name }; w.question = top.question; w.need = top.need ? { ...top.need, via: top.name } : null; w.viaSession = top.id; } // the lead points at the session that needs you
  }
  // the Chum that runs a role: the role carries its name, and its own work shows on the role
  for (const w of out) { const c = w.roleId && chums.get(roles.find((r) => r.id === w.roleId)?.agent); if (!c) continue;
    w.chum = c.name; w.name = `${w.name} · ${c.name}`;
    if (w.status === 'idle' && (c.status === 'working' || c.status === 'waiting')) Object.assign(w, { status: c.status, action: c.action, task: c.task, question: c.question, lastAt: c.lastAt, model: c.model });
    else if (w.status === 'idle' && c.status === 'unknown') w.chumDown = true;
  }
  return out;
}
