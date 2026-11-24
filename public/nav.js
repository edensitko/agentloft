// Floor plan + grid pathfinding. No three.js here so it can be tested in node.
import { PLANS } from './plans.js';
export const DOOR = 2.4;
/** The floor plan in use. These are set together by setPlan. */
export let PLAN, PLAN_ID, FLOOR, SLOTS, MEETING, LOBBY, TABLES, CAFE, BREAKS;
let FIXED = [];
const shift = ([dx, dz], list) => list.map(([x, z, ...rest]) => [x + dx, z + dz, ...rest]);

/** Wall segments of a room: [x1,z1,x2,z2,side] */
export function walls(s) {
  const l = s.x - s.w / 2, r = s.x + s.w / 2, t = s.z - s.d / 2, b = s.z + s.d / 2, out = [];
  const add = (x1, z1, x2, z2, side) => {
    if (s.skip?.includes(side)) return;
    if (side !== s.door) return out.push([x1, z1, x2, z2, side]);
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, h = DOOR / 2;
    if (z1 === z2) out.push([x1, z1, mx - h, z1, side], [mx + h, z1, x2, z2, side]);
    else out.push([x1, z1, x1, mz - h, side], [x1, mz + h, x1, z2, side]);
  };
  add(l, t, r, t, 'n'); add(l, b, r, b, 's'); add(l, t, l, b, 'w'); add(r, t, r, b, 'e');
  return out;
}

/** Desks for n people in this room; the grid follows the room's size. */
export function seats(s, n) {
  const cols = s.kind === 'hall' ? 5 : s.kind === 'boss' ? 4 : s.w > 14 ? (n > 4 ? 3 : 2) : n > 4 ? 3 : 2;
  const rows = s.kind === 'hall' ? (n <= 10 ? 2 : n <= 15 ? 3 : 4) : 2;
  if (s.kind !== 'hall' && s.kind !== 'boss' && n <= 2) return [-1, 1].map((k) => ({ x: s.x + k * Math.min(2.1, s.w / 4), z: s.z - 0.1 })); // two desks in the middle keep a small team's room airy
  const sx = Math.min(s.kind === 'hall' ? 5.4 : 6.4, (s.w - 1.2) / cols), sz = Math.min(s.kind === 'hall' ? 6.4 : 4.6, (s.d - 1.4) / rows);
  return Array.from({ length: rows * cols }, (_, i) => ({ x: s.x + (i % cols - (cols - 1) / 2) * sx, z: s.z + (Math.floor(i / cols) - (rows - 1) / 2) * sz - 0.2 }));
}

const E = Math.PI / 2;
/** Switches the floor plan: rooms, shared areas and the places where people take a break. */
export function setPlan(id) {
  PLAN_ID = PLANS[id] ? id : 'atrium'; const p = PLAN = PLANS[PLAN_ID], [w, d] = p.floor, K = p.kitchen, L = p.lounge, R = p.reception;
  FLOOR = { w, d }; SLOTS = p.slots; MEETING = p.meeting; LOBBY = { x: 0, z: d / 2 - 1.4 };
  TABLES = shift(K, [[-25.4, 0.9], [-21, 0.9]]);
  FIXED = [...shift(K, [[-23, -5.2, 1], [-24.4, -5.2, 0.9], [-21.6, -5.2, 0.9]]), ...shift(L, [[-8, 12.6, 0.6]]), ...shift(R, [[3.5, 13, 1.2], [2, 13, 1], [5, 13, 1]]),
    ...(p.booths ? [[p.booths[0], p.booths[1] - 1.2, 1], [p.booths[0], p.booths[1] + 1.2, 1]] : []), [MEETING.x, MEETING.z, 1.3], [MEETING.x - 1.9, MEETING.z, 1.2], [MEETING.x + 1.9, MEETING.z, 1.2]]; // furniture outside the rooms that people walk around
  // kitchen chairs around each table
  CAFE = [0, 1, 2, 3].flatMap((k) => TABLES.map(([x, z]) => { const a = k * E + E / 2; return { x: x + Math.cos(a) * 1.65, z: z + Math.sin(a) * 1.65, face: Math.atan2(-Math.cos(a), -Math.sin(a)) }; }));
  // where people who have nothing to do spend their time: kitchen chairs, sofas, pairs talking, coffee, the smoking corner outside, and their own room
  const spot = ([dx, dz], o) => ({ ...o, x: o.x + dx, z: o.z + dz }), sz = d / 2 - 21;
  BREAKS = [
    ...CAFE.map((c) => ({ ...c, sit: true })),
    ...[-9.5, -8, -6.5].map((x) => spot(L, { x, z: 9.35, face: 0, sit: true })), ...[11.8, 13.4].flatMap((z) => [spot(L, { x: -11.9, z, face: E, sit: true }), spot(L, { x: -4.1, z, face: -E, sit: true })]),
    ...[[-26.4, -6, -E], [-26.4, -3.4, -E], [-23, -7.4, 0], [-21.4, -7.4, 0]].map(([x, z, face]) => spot(K, { x, z, face, act: 'coffee' })), spot(R, { x: 3.2, z: 15.4, face: Math.PI }),
    ...[[8, 24.6], [11, 25.6], [13.6, 24.4]].flatMap(([x, z]) => [{ x, z: z + sz, face: E, smoke: true }, { x: x + 1.2, z: z + 0.2 + sz, face: -E, smoke: true }]),
    ...SLOTS.flatMap((s, slot) => [{ x: s.x + 0.7, z: s.z + s.d / 2 - 0.8, face: -E, slot }, { x: s.x - 0.7, z: s.z + s.d / 2 - 0.8, face: E, slot }]),
  ];
  // pairs in the open floor: free places that are far from each other and from everything above
  const nav = createNav(), open = [], taken = BREAKS.map((b) => [b.x, b.z, 2.2]), inside = (x, z) => [...SLOTS, MEETING].some((s) => Math.abs(x - s.x) < s.w / 2 + 0.8 && Math.abs(z - s.z) < s.d / 2 + 0.8);
  for (let x = -w / 2 + 2; x < w / 2 - 3; x += 1) for (let z = -d / 2 + 2; z < d / 2 - 1.6; z += 1) if ([0, 1.4].every((o) => !inside(x + o, z) && [-0.7, 0, 0.7].every((a) => [-0.7, 0, 0.7].every((c) => !nav.isBlocked(x + o + a, z + c)))) && nav.path(LOBBY, { x, z }) && nav.path(LOBBY, { x: x + 1.4, z })) open.push([x, z]);
  for (let n = 0; n < 8; n++) {
    let best = null, far = 0; for (const [x, z] of open) { const m = Math.min(...taken.map(([a, b]) => Math.hypot(a - x, b - z))); if (m > far) { far = m; best = [x, z]; } }
    if (!best || far < 2.6) break; taken.push(best); BREAKS.push({ x: best[0], z: best[1], face: E }, { x: best[0] + 1.4, z: best[1], face: -E });
  }
}

export function createNav() {
  const W = FLOOR.w + 20, D = FLOOR.d + 20, blocked = new Uint8Array(W * D);
  const cell = (x, z) => [Math.max(0, Math.min(W - 1, Math.floor(x + W / 2))), Math.max(0, Math.min(D - 1, Math.floor(z + D / 2)))];
  const block = (x, z) => { const [a, b] = cell(x, z); blocked[b * W + a] = 1; };
  for (const s of [...SLOTS, MEETING]) for (const [x1, z1, x2, z2] of walls(s)) {
    const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) * 3);
    for (let i = 0; i <= n; i++) {
      const x = x1 + (x2 - x1) * i / n, z = z1 + (z2 - z1) * i / n;
      const [a, b] = cell(x, z), dx = Math.abs(x - s.x), dz = Math.abs(z - s.z);
      const inDoor = (s.door === 's' && z > s.z && dx < 1.6) || ((s.door === 'e' ? x > s.x : s.door === 'w' && x < s.x) && dz < 1.6);
      if (!inDoor) blocked[b * W + a] = 1;
    }
  }
  const hw = FLOOR.w / 2, hd = FLOOR.d / 2; // outer walls, open at the entrance
  for (let x = -hw - 0.5; x <= hw + 0.5; x += 0.5) { block(x, -hd - 0.5); if (Math.abs(x) > 2.4) block(x, hd + 0.5); }
  for (let z = -hd - 0.5; z <= hd + 0.5; z += 0.5) { block(-hw - 0.5, z); block(hw + 0.5, z); }
  for (const [fx, fz, r] of FIXED) for (let x = -r; x <= r; x += 0.5) for (let z = -r; z <= r; z += 0.5) if (Math.hypot(x, z) <= r) block(fx + x, fz + z);
  for (const [x, z] of TABLES) block(x, z);

  const fixed = blocked.slice();
  /** Furniture placed in the editor: [{x,z,r}] */
  function setObstacles(list) {
    blocked.set(fixed);
    for (const o of list.filter((o) => o.w)) { // rectangles: sofas
      const c = Math.cos(o.ry ?? 0), s = Math.sin(o.ry ?? 0);
      for (let lx = -o.w / 2; lx <= o.w / 2; lx += 0.3) for (let lz = -o.d / 2; lz <= o.d / 2; lz += 0.3) block(o.x + lx * c + lz * s, o.z - lx * s + lz * c);
    }
    for (const o of list.filter((o) => !o.w)) for (let x = -o.r; x <= o.r; x += 0.5) for (let z = -o.r; z <= o.r; z += 0.5) if (Math.hypot(x, z) <= o.r) block(o.x + x, o.z + z);
  }
  function path(from, to) {
    const [sx, sz] = cell(from.x, from.z), [tx, tz] = cell(to.x, to.z);
    const start = sz * W + sx, goal = tz * W + tx;
    const g = new Map([[start, 0]]), prev = new Map(), open = [[0, start]], done = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const cur = open[bi][1]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (done.has(cur)) continue; done.add(cur);
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const id = nz * W + nx;
        if (blocked[id] && id !== goal) continue;
        if (dx && dz && (blocked[cz * W + nx] || blocked[nz * W + cx])) continue;
        const cost = g.get(cur) + (dx && dz ? 1.414 : 1);
        if (cost >= (g.get(id) ?? Infinity)) continue;
        g.set(id, cost); prev.set(id, cur);
        open.push([cost + Math.hypot(tx - nx, tz - nz), id]);
      }
    }
    if (goal !== start && !prev.has(goal)) return null;
    const pts = [{ x: to.x, z: to.z }];
    for (let c = prev.get(goal); c !== undefined && c !== start; c = prev.get(c))
      pts.unshift({ x: (c % W) - W / 2 + 0.5, z: ((c / W) | 0) - D / 2 + 0.5 });
    // pull the route straight wherever nothing is in the way
    const clear = (a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 4); for (let i = 1; i < n; i++) for (const o of [-0.3, 0.3]) { const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n; for (const [ex, ez] of [[o, 0], [0, o]]) { const [cx, cz] = cell(x + ex, z + ez); if (blocked[cz * W + cx]) return false; } } return true; };
    const out = []; let at = from;
    for (let i = 0; i < pts.length;) { let j = pts.length - 1; while (j > i && !clear(at, pts[j])) j--; out.push(at = pts[j]); i = j + 1; }
    return out;
  }
  return { path, setObstacles, isBlocked: (x, z) => { const [a, b] = cell(x, z); return !!blocked[b * W + a]; } };
}

/** The plan of the saved design (or of the office shown in the demo). In node, tests choose one with setPlan. */
async function wanted() {
  if (typeof document === 'undefined') return 'atrium';
  const q = new URLSearchParams(location.search);
  if (q.has('demo')) { const { OFFICE_TEMPLATES } = await import('./office.templates.js'); return q.get('plan') ?? OFFICE_TEMPLATES.find((o) => o.id === q.get('office'))?.plan; }
  try { return (await (await fetch('/api/layout')).json()).scene?.plan; } catch { return 'atrium'; }
}
setPlan(await wanted());
