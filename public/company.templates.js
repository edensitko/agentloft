// Ready-made companies to start from. None of them names real agents, so they work on any machine;
// connect a role to one of your own Claude agents in the editor (the `agent` field) to make it a real one.
// Everything here is written in English; localizeCompany() hands a template over in the language of the page.
import { t } from './i18n.js';

const dept = (label, slot, style) => ({ label, slot, ...(style ? { style } : {}) });
const lead = (id, name, d, brief) => ({ id, name, dept: d, lead: true, brief });

const SAFE = 'No money, sending, publishing or deploying without my approval.';
const R = {
  sec: ['sec', 'security|breach|hack|secret', 'i'], money: ['cfo', 'financ|accounting|payment|invoice|billing', 'i'],
  ai: ['ailead', 'bot|\\bAI\\b|agent|claude|automat|llm|prompt', 'i'], sales: ['sales', 'sales|quote|proposal|deck', 'i'],
  marketing: ['cmo', 'marketing|campaign|\\bseo\\b|social|content|\\bads?\\b|blog|landing', 'i'], product: ['cpo', 'products?\\b|roadmap|\\bspecs?\\b|feature|\\bcms\\b', 'i'],
  design: ['designlead', 'template|design|\\bui\\b|\\bux\\b|figma', 'i'], ops: ['opslead', 'server|docker|deploy|backup|\\bci\\b|infra', 'i'],
  clients: ['pm', 'client|website for|\\bapp\\b', 'i'], support: ['supportlead', 'support|outage|not working|bug|error|fix', 'i'],
};

export const COMPANY_TEMPLATES = [
  {
    id: 'small', name: 'Small team', about: 'Four rooms: management, development, design and marketing, operations. A good place to start.',
    company: {
      name: null, prompt: SAFE, fallback: 'cto', staffDept: 'ops',
      depts: { exec: dept('Management', 1), dev: dept('Development', 0), creative: dept('Design & marketing', 9, 'creative'), ops: dept('Operations & support', 8, 'modern') },
      roles: [lead('ceo', 'Manager', 'exec', 'Holds one picture of all the work and decides what comes first.'), lead('cto', 'Dev lead', 'dev', 'Architecture, code and code review.'),
        lead('cmo', 'Head of design & marketing', 'creative', 'Design, content and marketing.'), lead('opslead', 'Head of operations', 'ops', 'Servers, deploys and incidents. Deploys only with approval.')],
      rules: [R.marketing, ['cmo', R.design[1], 'i'], R.ops, ['opslead', R.support[1], 'i']],
    },
  },
  {
    id: 'solo', name: 'Solo', about: 'Three rooms for one person with agents: the work itself, clients, and marketing.',
    company: {
      name: null, prompt: SAFE, fallback: 'cto', staffDept: 'dev',
      depts: { exec: dept('My office', 1), dev: dept('Work', 0), clients: dept('Clients', 5, 'boho'), creative: dept('Marketing & content', 9, 'creative') },
      roles: [lead('ceo', 'Me', 'exec', 'Priorities and the overall picture.'), lead('cto', 'Head of work', 'dev', 'Everything that gets built and written.'), lead('pm', 'Client manager', 'clients', 'Client projects, schedules and handovers.'), lead('cmo', 'Marketing & content', 'creative', 'Content, campaigns and presence.')],
      rules: [R.clients, R.marketing],
    },
  },
  {
    id: 'studio', name: 'Digital studio', about: 'An agency that builds for clients: development, design, clients and projects, marketing, support and operations.',
    company: {
      name: null, prompt: SAFE, fallback: 'cto', staffDept: 'ops',
      depts: { exec: dept('Management', 1), dev: dept('Development', 0), design: dept('Design', 13, 'boho'), clients: dept('Clients & projects', 5, 'boho'), sales: dept('Sales', 4, 'industrial'),
        marketing: dept('Marketing & content', 9, 'creative'), support: dept('Support', 12, 'modern'), ops: dept('Operations & servers', 8, 'server') },
      roles: [lead('ceo', 'CEO', 'exec', 'Holds one picture and decides what comes first.'), lead('cto', 'Dev lead', 'dev', 'Architecture, code and code review.'), lead('designlead', 'Design lead', 'design', 'A design language for each client, UX and accessibility.'),
        lead('pm', 'Head of clients & projects', 'clients', 'Specs, tasks, schedules and delivery.'), lead('sales', 'Head of sales', 'sales', 'Sales pipeline, quotes and decks.'),
        lead('cmo', 'Head of marketing', 'marketing', 'Content, campaigns and promotion.'), lead('supportlead', 'Support lead', 'support', 'Reproducing, diagnosing and closing issues.'), lead('opslead', 'Head of operations', 'ops', 'Servers, deploys and backups. Deploys only with approval.')],
      rules: [R.sales, R.marketing, R.design, R.ops, R.clients, R.support],
    },
  },
  {
    id: 'product', name: 'Product company', about: 'A startup building a product: development, product, design, AI and data, growth, operations and security.',
    company: {
      name: null, prompt: SAFE, fallback: 'cto', staffDept: 'ops',
      depts: { exec: dept('Management', 1), dev: dept('Development', 0), product: dept('Product', 10, 'nature'), design: dept('Design', 13, 'boho'), ai: dept('AI & data', 7, 'tech'), marketing: dept('Growth & marketing', 9, 'creative'), ops: dept('Operations & security', 8, 'server') },
      roles: [lead('ceo', 'CEO', 'exec', 'Holds one picture and decides what comes first.'), lead('cto', 'Dev lead', 'dev', 'Architecture, code and code review.'), lead('cpo', 'Head of product', 'product', 'Roadmap, priorities and specs.'),
        lead('designlead', 'Design lead', 'design', 'UX, UI and the design system.'), lead('ailead', 'AI lead', 'ai', 'Models, agents, prompts and evaluation.'), lead('cmo', 'Head of growth', 'marketing', 'Marketing, content and measurement.'),
        lead('opslead', 'Head of operations', 'ops', 'Servers, deploys and business continuity. Deploys only with approval.'), lead('sec', 'Security', 'ops', 'Security reviews, secrets and permissions.')],
      rules: [R.sec, R.ai, R.marketing, R.product, R.design, R.ops],
    },
  },
  {
    id: 'full', name: 'Full company', about: 'Every room is taken: 15 departments, from finance to office and legal.',
    company: {
      name: null, prompt: SAFE, fallback: 'cto', staffDept: 'ops',
      depts: { exec: dept('Management', 1), dev: dept('Development', 0), it: dept('IT & servers', 2, 'server'), crm: dept('CRM & data', 3, 'modern'), sales: dept('Sales', 4, 'industrial'), clients: dept('Clients & projects', 5, 'boho'),
        service: dept('Customer service', 6, 'social'), ai: dept('AI & automation', 7, 'tech'), ops: dept('Operations & security', 8, 'modern'), marketing: dept('Marketing & content', 9, 'creative'), product: dept('Product', 10, 'nature'),
        office: dept('Office, legal & people', 11, 'library'), support: dept('Technical support', 12, 'modern'), design: dept('Design', 13, 'boho'), finance: dept('Finance', 14, 'classic') },
      roles: [lead('ceo', 'CEO', 'exec', 'Holds one picture and decides what comes first.'), lead('cto', 'Dev lead', 'dev', 'Architecture, code and code review.'), lead('itlead', 'Head of IT & servers', 'it', 'Servers, network and backups.'),
        lead('crm', 'CRM manager', 'crm', 'Leads, clients and data integrity.'), lead('sales', 'Head of sales', 'sales', 'Sales pipeline, quotes and decks.'), lead('pm', 'Head of clients & projects', 'clients', 'Specs, tasks, schedules and delivery.'),
        lead('service', 'Head of service', 'service', 'Requests, response times and service quality.'), lead('ailead', 'AI lead', 'ai', 'Bots, agents and automations.'), lead('opslead', 'Head of operations', 'ops', 'Processes and orderly deploys. Deploys only with approval.'),
        lead('sec', 'Security', 'ops', 'Security reviews, secrets and permissions.'), lead('cmo', 'Head of marketing', 'marketing', 'Content, campaigns and promotion.'), lead('cpo', 'Head of product', 'product', 'Roadmap, priorities and specs.'),
        lead('officem', 'Office manager', 'office', 'Documents, scheduling and internal order.'), lead('supportlead', 'Support lead', 'support', 'Reproducing, diagnosing and closing issues.'), lead('designlead', 'Design lead', 'design', 'Design language, UX and accessibility.'),
        lead('cfo', 'Head of finance', 'finance', 'Cash flow, collections and reports. Makes no payments.')],
      rules: [R.sec, R.money, ['officem', 'legal|contract|agreement|privacy|accessibility', 'i'], R.ai, R.sales, R.marketing, R.product, R.design, ['crm', '\\bcrm\\b|leads', 'i'], ['itlead', 'server|docker|backup|network', 'i'],
        ['opslead', 'deploy|operations', 'i'], R.clients, R.support, ['service', 'customer service|service desk|helpdesk', 'i']],
    },
  },
];

/**
 * A built-in template's company in the active language, as a deep copy: department labels, role names and briefs,
 * the prompt, and each rule's keyword list (so a language can match its own words). The company name is left as is.
 */
export function localizeCompany(company) {
  const text = (v) => (typeof v === 'string' ? t(v) : v);
  return {
    ...company, prompt: text(company.prompt),
    depts: Object.fromEntries(Object.entries(company.depts ?? {}).map(([k, d]) => [k, { ...d, label: text(d.label) }])),
    roles: (company.roles ?? []).map((r) => ({ ...r, name: text(r.name), ...('brief' in r ? { brief: text(r.brief) } : {}) })),
    rules: (company.rules ?? []).map(([id, source, ...flags]) => [id, text(source), ...flags]),
  };
}
