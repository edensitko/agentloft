import { promises as fs } from 'node:fs';
import path from 'node:path';
import { liveProcesses, liveServices, sameProcess } from './platform.js';

const TAIL = 512 * 1024;
const AGENT_STALE_MS = 10 * 60_000;
const CHUM_ACTIVE_MS = 3 * 60_000;

const readJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return null; } };
const ls = async (d) => { try { return await fs.readdir(d, { withFileTypes: true }); } catch { return []; } };

export function redact(s = '') {
  return s
    .replace(/\b(sk|ghp|gho|github_pat|xox[abp]|AKIA|AIza|eyJ)[-_A-Za-z0-9.]{12,}/g, '•••')
    .replace(/((?:password|passwd|token|secret|api[_-]?key|\u05e1\u05d9\u05e1\u05de\u05d4|\u05e1\u05d9\u05e1\u05de\u05d0)\s*[:=]?\s+|(?:password|token|secret|api[_-]?key)[:=])\S+/gi, '$1•••');
}
const clip = (s, n = 180) => { const t = redact(s.replace(/\s+/g, ' ').trim()); return t.length > n ? t.slice(0, n) + '…' : t; };

async function readTail(file, bytes = TAIL) {
  const fh = await fs.open(file, 'r');
  try {
    const { size } = await fh.stat();
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    if (start) lines.shift();
    return lines;
  } finally { await fh.close(); }
}

export function describeTool(name, input = {}) {
  const base = (p) => (p ? ' ' + String(p).split(/[\\/]/).pop() : '');
  const n = String(name);
  if (/^(Edit|Write|NotebookEdit)$/.test(n)) return { kind: 'edit', text: 'Editing' + base(input.file_path) };
  if (n === 'Read') return { kind: 'read', text: 'Reading' + base(input.file_path) };
  // the command itself may hold secrets, so only its description is shown
  if (n === 'Bash') return { kind: 'run', text: input.description ? 'Running: ' + clip(String(input.description), 70) : 'Running a command' };
  if (/^(Grep|Glob|ToolSearch)$/.test(n)) return { kind: 'search', text: 'Searching' };
  if (/^Web/.test(n)) return { kind: 'web', text: 'Searching the web' };
  if (/^(Agent|Task|Workflow)$/.test(n)) return { kind: 'agent', text: 'Running agent' + (input.description ? ': ' + clip(String(input.description), 60) : '') };
  if (n === 'Skill') return { kind: 'skill', text: 'Skill: ' + clip(String(input.skill ?? ''), 50) };
  if (n === 'AskUserQuestion' || n === 'ExitPlanMode') return { kind: 'ask', text: 'Asking you' };
  if (/browser|chrome/i.test(n)) return { kind: 'web', text: 'Working in the browser' };
  if (n.startsWith('mcp__')) return { kind: 'tool', text: n.split('__').pop().replaceAll('_', ' ') };
  return { kind: 'tool', text: n };
}

export function parseTranscript(lines) {
  const r = { model: null, effort: null, contextTokens: null, branch: null, task: null, action: null, lastAt: null, ended: false, question: null, blocked: false, pendingAsk: false, recap: null, ask: null, plan: false, held: null, choices: [] };
  const open = new Map();
  for (const line of lines) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const msg = e.message;
    if ((e.type !== 'assistant' && e.type !== 'user') || !msg) continue;
    if (e.timestamp) r.lastAt = Date.parse(e.timestamp);
    if (e.gitBranch) r.branch = e.gitBranch;
    const parts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: String(msg.content ?? '') }];
    if (e.type === 'user') {
      r.ended = false;
      let isResult = false;
      for (const p of parts) if (p?.type === 'tool_result') { isResult = true; open.delete(p.tool_use_id); }
      const text = parts.filter((p) => p?.type === 'text').map((p) => p.text).join(' ')
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
      if (!isResult && !e.isMeta && text) {
        r.question = null; r.blocked = false; open.clear();
        if (!text.startsWith('<') && !text.startsWith('[Request interrupted')) r.task = clip(text);
      }
      continue;
    }
    if (msg.model && msg.model !== '<synthetic>') r.model = msg.model;
    if (e.effort) r.effort = e.effort;
    const u = msg.usage;
    if (u) { const t = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); if (t) r.contextTokens = t; }
    r.ended = msg.stop_reason === 'end_turn';
    for (const p of parts) if (p?.type === 'tool_use') {
      open.set(p.id, p);
      if (/__wrap_up$/.test(p.name)) { r.question = p.input?.ask ? clip(String(p.input.ask), 120) : null; r.blocked = p.input?.blocked === true; r.choices = r.question && Array.isArray(p.input?.actions) ? p.input.actions.map((a) => a?.label).filter((l) => typeof l === 'string').slice(0, 3).map((l) => clip(l, 40)) : []; if (p.input?.recap) r.recap = clip(String(p.input.recap), 320); } // the recap is the session's own words on where it stands
      else if (!/__update_plan$|__mark_chapter$/.test(p.name)) r.action = describeTool(p.name, p.input);
    }
  }
  const pending = [...open.values()], asked = pending.find((p) => p.name === 'AskUserQuestion'), q = asked?.input?.questions?.[0];
  r.pendingAsk = pending.some((p) => p.name === 'AskUserQuestion' || p.name === 'ExitPlanMode');
  // what exactly the session wants: a question with its choices, a plan to approve, or a tool call that has not come back
  r.ask = asked ? { text: clip(String(q?.question ?? 'Asking you'), 200), options: (Array.isArray(q?.options) ? q.options : []).map((o) => o?.label).filter((l) => typeof l === 'string').slice(0, 4).map((l) => clip(l, 40)) } : null;
  r.plan = pending.some((p) => p.name === 'ExitPlanMode');
  const tool = pending.filter((p) => !/^(AskUserQuestion|ExitPlanMode)$|__wrap_up$|__update_plan$|__mark_chapter$/.test(p.name)).pop();
  r.held = tool ? describeTool(tool.name, tool.input).text : null;
  return r;
}

export function projectOf(cwd, home) {
  const dir = cwd.replace(/[\\/]\.claude[\\/]worktrees[\\/].*$/, '');
  if (dir.startsWith(path.join(home, '.chums'))) return { key: 'chums', label: 'Chums team' };
  if (dir === home) return { key: 'home', label: 'General' };
  const key = dir.split(/[\\/]/).filter(Boolean).pop() ?? dir;
  return { key: dir, label: LABELS.projects?.[key] ?? key }; // nicer project names come from the user's company file
}

// Display names for folders and agents that the user's company file adds; set at the start of every snapshot.
let LABELS = { projects: {}, agents: {} };
const KNOWN = { 'general-purpose': 'General agent', Explore: 'Code explorer', Plan: 'Planner', fork: 'Session fork', 'web-fetch': 'Web reader' }; // agents that ship with Claude
const agentRoom = () => ({ key: 'dept:sessions', label: 'General agents' }); // the company decides the real room, in the browser
const agentName = (type) => LABELS.agents?.[type] ?? KNOWN[type] ?? type;

/** Agents defined by the user: name and description from the frontmatter only. */
async function readRoster(dir) {
  const out = [];
  for (const e of await ls(dir)) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    let text; try { text = await fs.readFile(path.join(dir, e.name), 'utf8'); } catch { continue; }
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]; if (!fm) continue;
    const get = (k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim().replace(/^"(.*)"$/, '$1') ?? null;
    const type = get('name'); if (type) out.push({ type, role: clip((get('description') ?? '').split(/[.!?](?:\s|$)/)[0], 160) || null, model: get('model') });
  }
  return out;
}

export function createCollector({ home, processes = liveProcesses, services = liveServices, now = Date.now, labels = async () => null }) {
  const root = path.join(home, '.claude');
  const cache = new Map();   // file -> {mtime,size,data}
  const located = new Map(); // sessionId -> transcript path

  async function transcript(file) {
    let st; try { st = await fs.stat(file); } catch { return null; }
    const hit = cache.get(file);
    if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit;
    try {
      const v = { mtime: st.mtimeMs, size: st.size, data: parseTranscript(await readTail(file)) };
      // a huge tool result can push the prompt out of the tail window
      if (hit) { v.data.task ??= hit.data.task; v.data.model ??= hit.data.model; }
      // screenshots can fill the window, so look further back once for the prompt
      if (!hit && !v.data.task && st.size > TAIL) v.data.task = parseTranscript(await readTail(file, 16 * TAIL)).task;
      cache.set(file, v); return v;
    } catch { return null; }
  }

  async function locate(id) {
    const known = located.get(id);
    if (known) { try { await fs.access(known); return known; } catch { located.delete(id); } }
    let best = null, bestTime = -1;
    for (const d of await ls(path.join(root, 'projects'))) {
      if (!d.isDirectory()) continue;
      const f = path.join(root, 'projects', d.name, id + '.jsonl');
      try { const s = await fs.stat(f); if (s.mtimeMs > bestTime) { best = f; bestTime = s.mtimeMs; } } catch {}
    }
    if (best) located.set(id, best);
    return best;
  }

  async function subagents(dir, depth = 0) {
    const out = [];
    for (const e of await ls(dir)) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) out.push(...await subagents(full, depth + 1));
      else if (/^agent-.+\.jsonl$/.test(e.name)) {
        let st; try { st = await fs.stat(full); } catch { continue; }
        if (now() - st.mtimeMs > AGENT_STALE_MS) continue;
        const meta = (await readJson(full.replace(/\.jsonl$/, '.meta.json'))) ?? {};
        if (meta.finished || meta.stoppedByUser) continue;
        const t = await transcript(full);
        if (!t || t.data.ended) continue;
        out.push({ id: e.name.slice(6, -6), meta, t: t.data, startedAt: st.birthtimeMs });
      }
    }
    return out;
  }

  // Past runs per agent type; walking every project is slow, so once a minute is enough.
  let history = { at: -Infinity, by: new Map() };
  async function runs() {
    if (now() - history.at < 60_000) return history.by;
    const by = new Map();
    const walk = async (dir, depth) => {
      for (const e of await ls(dir)) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (depth < 5) await walk(full, depth + 1); continue; }
        if (!dir.includes('/subagents') || !e.name.endsWith('.meta.json')) continue;
        const meta = await readJson(full); if (!meta?.agentType) continue;
        let st; try { st = await fs.stat(full.replace(/\.meta\.json$/, '.jsonl')); } catch { continue; }
        const r = by.get(meta.agentType) ?? { count: 0, lastAt: 0, task: null };
        r.count++; if (st.mtimeMs > r.lastAt) { r.lastAt = st.mtimeMs; r.session = path.basename(dir.slice(0, dir.indexOf('/subagents'))); r.task = meta.description ? clip(String(meta.description)) : null; }
        by.set(meta.agentType, r);
      }
    };
    await walk(path.join(root, 'projects'), 0);
    history = { at: now(), by };
    return by;
  }

  return {
    async snapshot() {
      const l = await labels().catch(() => null); LABELS = { projects: l?.projects ?? {}, agents: l?.agents ?? {} };
      const records = []; for (const e of await ls(path.join(root, 'sessions'))) if (e.name.endsWith('.json')) { const s = await readJson(path.join(root, 'sessions', e.name)); if (s?.sessionId && s.cwd) records.push(s); }
      const [procs, svc] = await Promise.all([processes(records.map((s) => s.pid)), services()]);
      const byId = new Map();
      for (const s of records) {
        if (!procs.has(s.pid) || !sameProcess(s, procs.get(s.pid))) continue; // ended, or its number was reused
        const prev = byId.get(s.sessionId);
        if (!prev || (s.updatedAt ?? 0) > (prev.updatedAt ?? 0)) byId.set(s.sessionId, s);
      }
      const workers = [];
      const chumsSeen = new Set();
      const chums = (await readJson(path.join(home, '.chums', 'agents.json'))) ?? [];
      const chumList = Array.isArray(chums) ? chums : Object.values(chums.agents ?? {});
      for (const s of byId.values()) {
        const file = await locate(s.sessionId);
        const t = (file && (await transcript(file))?.data) || null;
        const project = projectOf(s.cwd, home);
        const chum = chumList.find((c) => c.cwd === s.cwd && s.cwd.includes('/.chums/'));
        if (chum) chumsSeen.add(chum.id);
        const busy = s.status === 'busy' || s.status === 'shell';
        const waiting = s.status === 'waiting' || t?.pendingAsk || (s.status === 'idle' && t?.blocked);
        const status = waiting ? 'waiting' : busy ? 'working' : s.status === 'idle' ? 'idle' : 'unknown';
        const need = !waiting ? null : t?.ask ? { kind: 'question', ...t.ask } : t?.plan ? { kind: 'plan', text: 'A plan is waiting for your approval', options: [] }
          : s.status === 'waiting' && t?.held ? { kind: 'permission', text: t.held, options: [] } // only the tool's description, never the command itself
          : t?.question ? { kind: 'decision', text: t.question, options: t.choices } : { kind: 'reply', text: 'Waiting for your reply', options: [] };
        workers.push({
          id: 's:' + s.sessionId, kind: chum ? 'chum' : 'session', name: chum?.name ?? s.name ?? 'Untitled session', status, project, room: chum ? project : { key: 'dept:sessions', label: 'General agents' }, role: chum?.claudeAgent ? agentName(chum.claudeAgent) : null, agentType: chum?.claudeAgent ?? null,
          task: t?.task ?? null, action: t?.action ?? null, model: t?.model ?? null, effort: t?.effort ?? null,
          contextTokens: t?.contextTokens ?? null, branch: t?.branch ?? null, question: t?.question ?? null, recap: t?.recap ?? null, need,
          open: /^local_[\w-]+$/.test(s.hostSessionId ?? '') ? s.hostSessionId : null, web: /^session_\w+$/.test(s.bridgeSessionId ?? '') ? s.bridgeSessionId : null,
          startedAt: s.startedAt ?? null, since: s.statusUpdatedAt ?? s.updatedAt ?? null, lastAt: t?.lastAt ?? null,
        });
        if (!file) continue;
        for (const a of await subagents(path.join(file.slice(0, -6), 'subagents'))) workers.push({
          id: 'a:' + a.id, parent: 's:' + s.sessionId, kind: 'agent', type: a.meta.agentType ?? 'agent', name: agentName(a.meta.agentType ?? 'Agent'), status: 'working', project, room: agentRoom(a.meta.agentType),
          task: a.meta.description ? clip(String(a.meta.description)) : null, action: a.t.action, model: a.t.model, effort: a.t.effort,
          contextTokens: a.t.contextTokens, branch: a.t.branch, question: null, startedAt: a.startedAt, since: a.startedAt, lastAt: a.t.lastAt,
        });
      }
      // Chums run Claude under their own host and keep no status file, so their state is read from what is on disk:
      // the process from the host log must be alive, and the newest transcript says whether a turn is in progress.
      for (const c of chumList) if (c?.id && svc.has(c.id) && !chumsSeen.has(c.id)) {
        const base = { id: 'c:' + c.id, kind: 'chum', name: c.name ?? c.id, status: 'unknown', project: { key: 'chums', label: 'Chums team' }, room: { key: 'chums', label: 'Chums team' }, role: c.claudeAgent ? agentName(c.claudeAgent) : null, agentType: c.claudeAgent ?? null,
          task: null, action: null, model: null, effort: null, contextTokens: null, branch: null, question: null, startedAt: null, since: null, lastAt: null };
        try {
          const log = await fs.readFile(path.join(home, '.chums', 'agents', c.id + '.host.log'), 'utf8'), pid = Number([...log.matchAll(/started \(pid (\d+)\)/g)].pop()?.[1]);
          if (pid && procs.has(pid)) {
            const dir = path.join(root, 'projects', String(c.cwd ?? '').replace(/[^A-Za-z0-9]/g, '-')); let newest = null, at = 0;
            for (const e of await ls(dir)) if (e.name.endsWith('.jsonl')) { const st = await fs.stat(path.join(dir, e.name)); if (st.mtimeMs > at) { at = st.mtimeMs; newest = path.join(dir, e.name); } }
            const t = newest && (await transcript(newest))?.data;
            // alive and its last turn is finished, or nothing was written for a while: idle. Writing right now: working.
            const live = t && !t.ended && now() - at < CHUM_ACTIVE_MS;
            Object.assign(base, { status: t?.pendingAsk || (t?.blocked && !live) ? 'waiting' : live ? 'working' : 'idle', startedAt: procs.get(pid) ?? null, since: at || null, lastAt: t?.lastAt ?? (at || null), task: t?.task ?? null, action: t?.action ?? null, model: t?.model ?? null, contextTokens: t?.contextTokens ?? null });
          }
        } catch {}
        workers.push(base);
      }
      // Every defined agent is a permanent employee; its first live run is done by that employee.
      const [roster, past] = await Promise.all([readRoster(path.join(root, 'agents')), runs()]);
      for (const def of roster) {
        const live = workers.filter((w) => w.kind === 'agent' && w.type === def.type).sort((x, y) => (x.startedAt ?? 0) - (y.startedAt ?? 0))[0];
        const h = past.get(def.type), extra = { role: def.role, runs: h?.count ?? 0, staff: true };
        if (live) Object.assign(live, extra, { id: 'r:' + def.type });
        else workers.push({
          id: 'r:' + def.type, kind: 'agent', type: def.type, name: agentName(def.type), status: 'idle', project: null, room: agentRoom(def.type), ...extra,
          task: null, lastTask: h?.task ?? null, lastSession: h?.session ? 's:' + h.session : null, action: null, model: def.model, effort: null, contextTokens: null, branch: null, question: null, startedAt: null, since: null, lastAt: h?.lastAt ?? null,
        });
      }
      workers.sort((a, b) => a.id.localeCompare(b.id));
      return { at: now(), workers };
    },
  };
}
