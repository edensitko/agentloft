import test from 'node:test';
import assert from 'node:assert/strict';
import { organise, assign, taskRole, setCompany, DEPTS, ROLES } from '../public/company.js';
import { COMPANY_TEMPLATES, localizeCompany } from '../public/company.templates.js';
import { cleanCompany } from '../server/company.js';
import { SLOTS } from '../public/nav.js';
// A made-up company, so the tests do not depend on anybody's real one.
const ACME = { name: 'Acme', fallback: 'cto', staffDept: 'ops',
  depts: { exec: { label: 'Management', slot: 1 }, dev: { label: 'Development', slot: 0 }, finance: { label: 'Finance', slot: 14 }, sales: { label: 'Sales', slot: 4 }, ai: { label: 'AI', slot: 7 }, ops: { label: 'Operations', slot: 8 } },
  roles: [{ id: 'ceo', name: 'CEO', dept: 'exec', lead: true, agent: 'manager' }, { id: 'cfo', name: 'Head of finance', dept: 'finance', lead: true, agent: 'acme-finance' }, { id: 'sales', name: 'Head of sales', dept: 'sales', lead: true },
    { id: 'cto', name: 'Dev lead', dept: 'dev', lead: true }, { id: 'qa', name: 'QA tester', dept: 'dev', agent: 'qa-tester' }, { id: 'ailead', name: 'AI lead', dept: 'ai', lead: true }, { id: 'sec', name: 'Security', dept: 'ops', lead: true, agent: 'security-auditor' }],
  rules: [['ailead', 'voice|bot', 'i'], ['sales', 'sales|deck', 'i'], ['gone', 'x', 'i'], ['cfo', '(', 'i']] };
const use = (c) => setCompany(cleanCompany(c));
test.beforeEach(() => use(ACME));
const S = (id, name, o = {}) => ({ id: 's:' + id, kind: 'session', name, status: 'idle', project: { key: 'k', label: 'p' }, room: { key: 'x', label: 'x' }, ...o });
test('every session always has a manager or team lead', () => {
  for (const n of ['Voice assistant for a business', 'Topspin app - tasks', 'Something else entirely', '']) assert.ok(assign(S('1', n)).lead, n);
  assert.equal(assign(S('1', 'Voice assistant for a business')).id, 'ailead'); assert.equal(assign(S('1', 'Company decks')).id, 'sales'); assert.equal(assign(S('1', 'xyz')).id, 'cto');
});
test('a manual choice wins and a deleted role falls back to a lead', () => {
  assert.equal(organise([S('1', 'Decks')], { assign: { 's:1': 'cfo' } })[0].leadRole, 'cfo');
  assert.ok(organise([S('1', 'Decks')], { assign: { 's:1': 'gone' } })[0].leadName);
});
test('a lead mirrors real work only, and goes back to idle without it', () => {
  const lead = (st) => organise([S('1', 'Decks', { status: st })]).find((w) => w.id === 'o:sales');
  assert.equal(lead('working').status, 'working'); assert.equal(lead('waiting').status, 'waiting'); assert.equal(lead('idle').status, 'idle');
});
test('real agents fill their role once; custom roles are added', () => {
  const l = organise([{ id: 'r:manager', kind: 'agent', staff: true, type: 'manager', name: 'x', status: 'idle', room: {} }], { custom: [{ id: 'c1', name: 'New', dept: 'sales' }, { id: 'c2', name: 'Bad', dept: 'nope' }] });
  assert.equal(l.filter((w) => w.roleId === 'ceo').length, 1); assert.ok(l.some((w) => w.name === 'New')); assert.ok(!l.some((w) => w.name === 'Bad'));
});
test('every built-in template is a valid company that fits the floor', () => {
  assert.ok(COMPANY_TEMPLATES.length >= 4); assert.equal(new Set(COMPANY_TEMPLATES.map((t) => t.id)).size, COMPANY_TEMPLATES.length);
  for (const t of COMPANY_TEMPLATES) {
    const c = cleanCompany(t.company); use(t.company); assert.ok(t.name && t.about, t.id);
    const slots = Object.values(DEPTS).map((d) => d.slot); assert.equal(new Set(slots).size, slots.length, t.id); assert.ok(slots.every((s) => SLOTS[s]), t.id);
    for (const d of Object.keys(DEPTS)) assert.ok(ROLES.some((r) => r.dept === d && r.lead), `${t.id}: ${d} has no lead`);
    assert.equal(c.rules.length, t.company.rules.length, `${t.id}: a rule names a missing role or does not compile`);
    assert.ok(ROLES.every((r) => !r.agent), `${t.id}: templates must not name agents`); assert.ok(assign(S('1', 'Something else entirely')).lead, t.id);
  }
});
test('a company file is cleaned: broken rules are dropped, broken structure is refused', () => {
  const c = cleanCompany(ACME); assert.deepEqual(c.rules.map((r) => r[0]), ['ailead', 'sales']); assert.equal(c.fallback, 'cto');
  assert.throws(() => cleanCompany({ ...ACME, depts: { a: { label: 'A', slot: 1 }, b: { label: 'B', slot: 1 } } }), /share a room/);
  assert.throws(() => cleanCompany({ ...ACME, roles: ACME.roles.map((r) => ({ ...r, lead: false })) }), /lead/);
  assert.throws(() => cleanCompany({ ...ACME, roles: [{ id: 'x', name: 'x', dept: 'nope', lead: true }] }), /bad role/); assert.throws(() => cleanCompany(null));
  assert.equal(cleanCompany({ ...ACME, fallback: 'gone' }).fallback, 'ceo');
});
test('sessions with no matching rule go to the fallback lead, also when the fallback is missing', () => {
  assert.equal(assign(S('1', 'xyz')).id, 'cto'); setCompany({ ...cleanCompany(ACME), fallback: 'nobody' }); assert.ok(assign(S('1', 'xyz')).lead);
});
test('a task that names an agent puts the session in that agent\'s team', () => {
  assert.equal(taskRole('Use the agent acme-finance (Agent tool, subagent_type: acme-finance) for the following task'), 'cfo');
  assert.equal(taskRole('Use the agent qa-tester for'), 'cto'); // a team member: its lead
  assert.equal(taskRole('Just a task'), null); assert.equal(taskRole(null), null); assert.equal(taskRole('Use the agent nobody'), null);
});
test('a Chum is the person behind its role; a Chum without a role is not in the office', () => {
  const C = (name, agentType, status) => ({ id: 'c:' + name, kind: 'chum', name, agentType, status, room: {} });
  const l = organise([C('Noodle', 'manager', 'working'), C('Peeps', null, 'idle'), C('Tangle', 'security-auditor', 'idle')]);
  assert.ok(!l.some((w) => w.kind === 'chum'));
  const ceo = l.find((w) => w.roleId === 'ceo'); assert.equal(ceo.name, 'CEO · Noodle'); assert.equal(ceo.status, 'working');
  assert.equal(l.find((w) => w.roleId === 'sec').status, 'idle'); assert.ok(!l.some((w) => w.name.includes('Peeps')));
});
test('a template localised in English is an equal copy, and the template itself is not touched', () => {
  for (const t of COMPANY_TEMPLATES) {
    const before = JSON.stringify(t.company), c = localizeCompany(t.company);
    assert.deepEqual(c, t.company, t.id); assert.notEqual(c, t.company); assert.notEqual(c.depts, t.company.depts); assert.notEqual(c.roles[0], t.company.roles[0]); assert.notEqual(c.rules[0], t.company.rules[0]);
    c.depts.exec.label = 'x'; c.roles[0].name = 'x'; c.rules[0][1] = 'x'; assert.equal(JSON.stringify(t.company), before, t.id);
  }
});
