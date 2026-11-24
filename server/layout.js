import { promises as fs } from 'node:fs';
import path from 'node:path';

export const ITEM_TYPES = ['plantA', 'plantB', 'sofa', 'armchair', 'cafeTable', 'desk', 'chair', 'shelf', 'meeting', 'lamp', 'floorLamp', 'rug', 'tv', 'divider', 'sign'];
export const ROOM_STYLES = ['plain', 'modern', 'industrial', 'tech', 'nature', 'boho', 'creative', 'classic', 'studio', 'library', 'social', 'server'];
export const PLAN_IDS = ['atrium', 'loft', 'courtyard', 'shore', 'corridor', 'core', 'cabin'];
export const OUTSIDES = ['city', 'campus', 'suburb', 'beach', 'mountains'];
export const EMPTY = { rev: 0, notify: true, items: null, rooms: {}, agents: {}, assign: {}, custom: [], scene: {} };
const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, n) || undefined : undefined);
const oneOf = (v, l) => (l.includes(v) ? v : undefined);
const prune = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const mapOf = (o, max, f) => Object.fromEntries(Object.entries(o && typeof o === 'object' && !Array.isArray(o) ? o : {}).slice(0, max)
  .filter(([k, v]) => k.length <= 200 && k !== '__proto__' && v && typeof v === 'object').map(([k, v]) => [k, prune(f(v))]));

/** Keeps only known fields with sane values, so a saved design can never break the page. */
export function cleanLayout(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('bad layout');
  return {
    rev: 0, notify: o.notify !== false,
    items: Array.isArray(o.items) ? o.items.slice(0, 300).filter((i) => i && ITEM_TYPES.includes(i.type)).map((i, n) => prune({
      id: str(i.id, 40) ?? 'i' + n, type: i.type, x: num(i.x, -35, 35, 0), z: num(i.z, -25, 25, 0), ry: num(i.ry, -100, 100, 0), s: num(i.s, 0.4, 2.5, 1), color: hex(i.color), text: str(i.text, 24),
    })) : null,
    rooms: mapOf(o.rooms, 60, (r) => ({ name: str(r.name, 40), accent: hex(r.accent), style: oneOf(r.style, ROOM_STYLES), floor: oneOf(r.floor, ['wood', 'carpet', 'stone']), slot: Number.isInteger(r.slot) && r.slot >= 0 && r.slot < 15 ? r.slot : undefined })),
    agents: mapOf(o.agents, 200, (a) => ({ name: str(a.name, 40), cloth: hex(a.cloth), pants: hex(a.pants), hair: hex(a.hair), tone: typeof a.tone === 'number' ? num(a.tone, 0.5, 1.3, 1) : undefined, tall: typeof a.tall === 'number' ? num(a.tall, 0.85, 1.15, 1) : undefined, wide: typeof a.wide === 'number' ? num(a.wide, 0.85, 1.25, 1) : undefined, avatar: typeof a.avatar === 'string' && /^[A-Za-z_]{1,30}_\d\d$/.test(a.avatar) ? a.avatar : undefined, room: str(a.room, 200), size: typeof a.size === 'number' ? num(a.size, 0.7, 1.8, 1) : undefined })),
    assign: Object.fromEntries(Object.entries(o.assign && typeof o.assign === 'object' && !Array.isArray(o.assign) ? o.assign : {}).filter(([k, v]) => /^s:[\w-]{1,80}$/.test(k) && /^\w{1,40}$/.test(v)).slice(0, 500)),
    custom: (Array.isArray(o.custom) ? o.custom : []).slice(0, 60).filter((c) => c && /^\w{1,40}$/.test(c.id) && str(c.name, 40)).map((c) => prune({ id: c.id, name: str(c.name, 40), dept: str(c.dept, 20), brief: str(c.brief, 200), lead: c.lead === true })),
    scene: prune({ plan: oneOf(o.scene?.plan, PLAN_IDS), outside: oneOf(o.scene?.outside, OUTSIDES), mood: oneOf(o.scene?.mood, ['night', 'sunset', 'day']), light: num(o.scene?.light, 0.5, 2, undefined), glow: num(o.scene?.glow, 0, 1, undefined), people: num(o.scene?.people, 0.7, 1.6, undefined) }),
  };
}

export function createStore(file) {
  let current = null;
  return {
    async get() {
      if (current) return current;
      try { const raw = JSON.parse(await fs.readFile(file, 'utf8')); current = { ...cleanLayout(raw), rev: Number(raw.rev) || 1 }; } catch { current = EMPTY; }
      return current;
    },
    async set(body) {
      const prev = await this.get(), next = { ...cleanLayout(body), rev: prev.rev + 1 };
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(next, null, 1)); await fs.rename(tmp, file);
      return (current = next);
    },
  };
}
