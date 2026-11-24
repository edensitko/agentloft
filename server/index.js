import { execFile } from 'node:child_process';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createCompany } from './company.js';
import { createTemplates } from './templates.js';
import { createCollector } from './collector.js';
import { createStore } from './layout.js';
import { createWatcher } from './notify.js';
import { notify } from './platform.js';
import { createBackups } from './backup.js';

const PORT = Number(process.env.PORT) || 4455;
const REMOTE_HOST = process.env.OFFICE_HOST, REMOTE_USER = process.env.OFFICE_USER;
const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '../public');
const THREE = path.join(here, '../node_modules/three');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const company = createCompany(path.join(here, '../data/company.json')); // the user's own company; absent on a fresh install
const templates = createTemplates(path.join(here, '../data/templates')); // offices the user saved by name
const backups = createBackups(path.join(here, '../data')); // a copy a day of the user's own files
const backUp = () => backups.daily().catch((e) => console.error('backup', e.message)); backUp(); setInterval(backUp, 3600_000).unref();
const collector = createCollector({ home: os.homedir(), labels: () => company.get() });
const store = createStore(path.join(here, '../data/layout.json')); // the office design, the only thing this server ever writes
const clients = new Set();
let last = { at: Date.now(), workers: [] };
let lastKey = '';
const newlyWaiting = createWatcher();
/** Closes the office. Under launchd it would come straight back, so the job is unloaded until the next login. */
function quit() {
  const label = process.env.XPC_SERVICE_NAME ?? '', stop = () => process.exit(0);
  if (/^[\w.-]*(agentloft|claude-office)$/.test(label)) execFile('/bin/launchctl', ['bootout', `gui/${process.getuid()}/${label}`], stop); else stop();
}

async function tick() {
  try {
    last = await collector.snapshot();
    const fresh = newlyWaiting(last.workers);
    if (fresh.length && (await store.get()).notify !== false) for (const w of fresh.slice(0, 3)) notify('Office: waiting for you', `${w.name}${w.question ? ': ' + w.question : ' is waiting for your reply'}`);
    const key = JSON.stringify(last.workers);
    if (key !== lastKey) { lastKey = key; for (const c of clients) c.write(`data: ${JSON.stringify(last)}\n\n`); }
    else for (const c of clients) c.write(`event: beat\ndata: ${last.at}\n\n`);
  } catch (e) { console.error('snapshot failed:', e.message); }
  setTimeout(tick, clients.size ? 1500 : 4000); // also without a page open, so that waiting agents are noticed
}

http.createServer(async (req, res) => {
  // Blocks DNS rebinding: session data must only reach pages served from this machine.
  // Remote access goes through Tailscale Serve only: right host, the owner's login, never the public Funnel.
  const local = [`localhost:${PORT}`, `127.0.0.1:${PORT}`].includes(req.headers.host) && !req.headers['x-forwarded-for'];
  const remote = REMOTE_HOST && REMOTE_USER && req.headers.host === REMOTE_HOST
    && req.headers['tailscale-user-login'] === REMOTE_USER && !req.headers['tailscale-funnel-request'];
  if (!local && !remote) return res.writeHead(403).end();

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return res.writeHead(400).end(); }
  const tplId = /^\/api\/templates\/([\w-]+)$/.exec(p)?.[1];
  if (((p === '/api/layout' || p === '/api/company' || p === '/api/templates') && req.method === 'PUT') || (tplId && req.method === 'DELETE')) {
    // Same-origin only: another site open in the browser must not be able to rewrite the design.
    const origins = local ? [`http://${req.headers.host}`] : [`https://${req.headers.host}`];
    if (!origins.includes(req.headers.origin) || (req.method === 'PUT' && !/^application\/json/.test(req.headers['content-type'] ?? ''))) return res.writeHead(403).end();
    if (req.method === 'DELETE') return res.writeHead((await templates.remove(tplId)) ? 204 : 404).end();
    let body = '';
    for await (const c of req) { body += c; if (body.length > 400_000) return res.writeHead(413).end(); }
    const json = (code, o) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(o));
    if (p === '/api/templates') { try { return json(200, await templates.save(JSON.parse(body))); } catch (e) { return json(400, { error: String(e.message ?? e).slice(0, 200) }); } }
    if (p === '/api/company') {
      try { const c = await company.set(JSON.parse(body)); for (const x of clients) x.write(`event: company\ndata: ${JSON.stringify(c)}\n\n`); return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(c)); }
      catch (e) { return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e.message ?? e).slice(0, 200) })); }
    }
    try {
      const l = await store.set(JSON.parse(body));
      for (const c of clients) c.write(`event: layout\ndata: ${JSON.stringify(l)}\n\n`);
      return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(l));
    } catch { return res.writeHead(400).end(); }
  }
  const back = /^\/api\/backups\/([\w-]+)$/.exec(p)?.[1];
  if (back && req.method === 'POST') { // same-origin only, like every write
    const origin = local ? `http://${req.headers.host}` : `https://${req.headers.host}`; if (req.headers.origin !== origin) return res.writeHead(403).end();
    try {
      const send = (event, o) => { for (const c of clients) c.write(`event: ${event}\ndata: ${JSON.stringify(o)}\n\n`); };
      const ok = await backups.restore(back, { company: async (c) => send('company', await company.set(c)), layout: async (l) => send('layout', await store.set(l)) });
      return res.writeHead(ok ? 204 : 404).end();
    } catch (e) { return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e.message ?? e).slice(0, 200) })); }
  }
  if (p === '/api/quit' && req.method === 'POST') { // only from the page itself, and only on this machine
    if (!local || req.headers.origin !== `http://${req.headers.host}`) return res.writeHead(403).end();
    res.writeHead(204).end(() => quit()); return;
  }
  if (req.method !== 'GET') return res.writeHead(405).end();
  if (p === '/api/layout') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(await store.get()));
  if (p === '/api/templates') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(await templates.list()));
  if (tplId) { const t = await templates.get(tplId); return res.writeHead(t ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(t)); }
  if (p === '/api/backups') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(await backups.list()));
  if (p === '/api/company') return res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(await company.get()));
  if (p === '/api/state') return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(last));
  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    clients.add(res); req.on('close', () => clients.delete(res));
    collector.snapshot().then((s) => { last = s; res.write(`data: ${JSON.stringify(s)}\n\n`); }).catch(() => {});
    return;
  }
  const base = p.startsWith('/three/') ? THREE : PUBLIC;
  const file = path.join(base, p.startsWith('/three/') ? p.slice(7) : p === '/' ? 'index.html' : p);
  if (!file.startsWith(base + path.sep)) return res.writeHead(403).end();
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}`));
tick();
