import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { meetingSummary, needOf } from './summary.js';
import { createNav, FLOOR, SLOTS, MEETING, LOBBY, BREAKS, PLAN, PLAN_ID, seats } from './nav.js';
import { buildWorld, buildRoom, buildSpare } from './world.js';
import { organise, setCompany, COMPANY, DEPTS, ROLES } from './company.js';
import { OFFICE_TEMPLATES, officeDesign } from './office.templates.js';
import { declutter, nudge } from './declutter.js';
import { showSettings } from './settings.js';
import { showWelcome } from './welcome.js';
import { COMPANY_TEMPLATES, localizeCompany } from './company.templates.js';
import { AVATARS } from './people.js';
import { createPerson } from './people.js';
import { createEditor, DEFAULT_ITEMS } from './editor.js';
import { solids } from './furniture.js';
import { buildGrid } from './collide.js';
import { taskRole } from './company.js';
import { createWalk } from './walk.js';
import { createItem, RADIUS } from './items.js';
import { t, tLine, LANG, DIR, LOCALE, LANGS } from './i18n.js';

// the page's own text is English in the HTML; here it is put into the active language, before anything reads it
for (const e of document.querySelectorAll('[data-t]')) e.textContent = t(e.textContent);
for (const a of ['aria-label', 'title', 'placeholder']) for (const e of document.querySelectorAll(`[data-t-${a}]`)) e.setAttribute(a, t(e.getAttribute('data-t-' + a)));

const $ = (s) => document.querySelector(s);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const demo = new URLSearchParams(location.search).has('demo');
const STATUS = { working: t('Working'), waiting: t('Waiting for you'), idle: t('Idle'), unknown: t('Active, status unknown') };
const ORDER = { waiting: 0, working: 1, unknown: 2, idle: 3 };

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
$('#stage').append(renderer.domElement);
const labels = new CSS2DRenderer(); labels.domElement.className = 'labels'; $('#stage').append(labels.domElement);
// on a narrow screen labels that land on the same spot give way to the most important one, which says how many are behind it
let shownLabels = new Set(), labelNo = 0;
function thinLabels() {
  const els = [...labels.domElement.querySelectorAll('.tag,.room')], narrow = innerWidth <= 760;
  if (!narrow) { if (shownLabels.size) { for (const e of els) { delete e.dataset.crowd; delete e.dataset.more; } shownLabels = new Set(); } return; }
  for (const e of labelSizes.keys()) if (!e.isConnected) labelSizes.delete(e);
  const boxes = []; for (const e of els) {
    e.dataset.label ??= ++labelNo; const b = e.getBoundingClientRect(), st = getComputedStyle(e);
    if (b.width) { const s = labelSizes.get(e) ?? labelSizes.set(e, {}).get(e); s.w = b.width; s.h = b.height; }
    if (!b.width || 'off' in e.dataset || st.display === 'none' || +st.opacity < 0.05 || b.right < 0 || b.left > innerWidth || b.bottom < 0 || b.top > innerHeight) { delete e.dataset.crowd; delete e.dataset.more; continue; }
    const c = e.classList, person = c.contains('tag'); boxes.push({ id: e.dataset.label, el: e, x: b.x, y: b.y, w: b.width, h: b.height, count: person, rank: !person ? 4 : c.contains('on') ? 0 : c.contains('waiting') ? (c.contains('lead') ? 1.5 : 1) : c.contains('working') ? (c.contains('lead') ? 2.5 : 2) : 3 });
  }
  const { hidden, more } = declutter(boxes, shownLabels); shownLabels = new Set(boxes.filter((b) => !hidden.has(b.id)).map((b) => b.id));
  for (const b of boxes) { if (hidden.has(b.id)) b.el.dataset.crowd = ''; else delete b.el.dataset.crowd; const n = more.get(b.id); if (n) b.el.dataset.more = n; else delete b.el.dataset.more; }
}
setInterval(thinLabels, 200);
// On a phone, keep whole labels on the screen. Runs on every frame, so it reads only the position the renderer just wrote; sizes come from thinLabels.
const labelSizes = new Map();
function keepLabelsIn() {
  if (innerWidth > 760) { for (const e of labelSizes.keys()) { e.style.translate = ''; delete e.dataset.off; } labelSizes.clear(); return; }
  const { clientWidth: w, clientHeight: h } = labels.domElement;
  for (const [e, s] of labelSizes) {
    const m = /\(\s*(-?[\d.e+-]+)px\s*,\s*(-?[\d.e+-]+)px/.exec(e.style.transform); if (!m) continue;
    const dx = nudge(+m[1], s.w, w), dy = nudge(+m[2], s.h, h), off = dx === null || dy === null, to = off || (!dx && !dy) ? '' : `${dx}px ${dy}px`;
    if (off !== ('off' in e.dataset)) { if (off) e.dataset.off = ''; else delete e.dataset.off; }
    if (s.to !== to) e.style.translate = s.to = to;
  }
}
const camera = new THREE.PerspectiveCamera(26, 1, 0.8, 900);
const controls = new OrbitControls(camera, renderer.domElement);
// ?embed: a small window inside another page, so scrolling that page must not zoom the office; ?embed=clean shows only the scene
const embed = new URLSearchParams(location.search).get('embed');
if (embed !== null) { controls.enableZoom = false; document.body.classList.add('embed', ...(embed === 'clean' ? ['clean'] : [])); }
Object.assign(controls, { enableDamping: true, maxPolarAngle: 1.45, minPolarAngle: 0.02, zoomToCursor: true, zoomSpeed: 1.4, rotateSpeed: 0.75, panSpeed: 1.1, dampingFactor: 0.12, minDistance: 2.5, maxDistance: 190, screenSpacePanning: false });
function setDrag(mode) { // what a plain drag does; the other action is on the right button / two fingers
  const pan = mode === 'pan';
  controls.mouseButtons = { LEFT: pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN };
  controls.touches = { ONE: pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: pan ? THREE.TOUCH.DOLLY_ROTATE : THREE.TOUCH.DOLLY_PAN };
  for (const b of document.querySelectorAll('[data-drag]')) b.setAttribute('aria-pressed', String(b.dataset.drag === mode));
  try { localStorage.setItem('drag', mode); } catch {}
}
for (const b of document.querySelectorAll('[data-drag]')) b.onclick = () => setDrag(b.dataset.drag);
let savedDrag = 'pan'; try { savedDrag = localStorage.getItem('drag') === 'rotate' ? 'rotate' : 'pan'; } catch {}
setDrag(savedDrag);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Contact shadows: sampled at half size, which is invisible once blurred but far cheaper.
const gtao = new GTAOPass(scene, camera, 2, 2); gtao.blendIntensity = 0.95;
gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
const aoSize = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => aoSize(Math.ceil(w / 2), Math.ceil(h / 2));
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.55, 1); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(new SMAAPass());

let fly = null;
function home(now) {
  const k = Math.max(1, 1.5 / camera.aspect);
  const fit = Math.max(0.72, Math.max(FLOOR.w / 58, FLOOR.d / 42)) * k, pos = new THREE.Vector3(-29 * fit, 56 * fit, 66 * fit), target = new THREE.Vector3(0, 0, 1);
  if (now || calm) { camera.position.copy(pos); controls.target.copy(target); fly = null; } else fly = { pos, target };
}
function resize() {
  const { clientWidth: w, clientHeight: h } = $('#stage'); if (!w || !h) return;
  camera.aspect = w / h; const side = !document.body.classList.contains('closed') && !document.body.classList.contains('walking') && w > 760 ? 286 : 0; // keep the office centred beside the list
  if (side) { camera.aspect = (w - side) / h; camera.setViewOffset(w - side, h, 0, 0, w, h); } else camera.clearViewOffset();
  camera.updateProjectionMatrix(); renderer.setSize(w, h); composer.setSize(w, h); labels.setSize(w, h);
}
{ document.body.classList.add('closed'); $('#toggle').setAttribute('aria-expanded', 'false'); }
new ResizeObserver(resize).observe($('#stage')); resize(); home(true);
controls.addEventListener('start', () => { fly = null; });

const collect = (f) => { solids.list = []; const o = f(); o.solids = solids.list; solids.list = null; return o; };
const world = collect(() => buildWorld(scene, renderer)), nav = createNav();
const spares = new Map();
const people = new Map(), rooms = new Map(); // project key -> {slot, capacity, room}
let design = { notify: true, rev: 0, items: null, rooms: {}, agents: {}, assign: {}, custom: [], scene: {} };
let viewRoom = null;
let all = [], workers = [], selected = null, hovered = null, first = true;

/** Calm view: who works or waits, every session's agent, its lead, and the CEO. The rest appear when they get work or when their room is opened. */
const onFloor = (w) => gather?.ids.has(w.id) || w.status === 'working' || w.status === 'waiting' || w.kind === 'session' || w.team?.length || w.roleId === 'ceo' || w.room.key === viewRoom || w.id === selected || w.id === walk?.id;
let walk = null;
function named(w) { const a = design.agents[w.id]; return a?.name ? { ...w, name: a.name, realName: w.name } : w; }
const homeSlot = (k) => DEPTS[k.slice(3)]?.slot;
function layout() {
  for (const w of all) { const to = design.agents[w.id]?.room; if (to && to !== w.room.key) w.room = { key: to, label: all.find((x) => x.homeRoom?.key === to)?.homeRoom.label ?? design.rooms[to]?.name ?? t('Room') }; }
  // projects keep their slot; when slots run out the last one is shared
  const members = new Map();
  for (const w of all) if (!members.has(w.room.key) && DEPTS[w.room.key.slice(3)]) members.set(w.room.key, []);
  for (const w of workers) (members.get(w.room.key) ?? members.set(w.room.key, []).get(w.room.key)).push(w);
  for (const [k, r] of rooms) if (k !== '*' && !members.has(k)) { r.room.dispose(); rooms.delete(k); }
  const groups = new Map();
  const ranked = [...members].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  ranked.sort((a, b) => rooms.has(b[0]) - rooms.has(a[0]));
  const tooMany = ranked.length > SLOTS.length;
  ranked.forEach(([k, list], i) => {
    const key = tooMany && i >= SLOTS.length - 1 ? '*' : k;
    const gr = groups.get(key) ?? { label: design.rooms[key]?.name ?? (key === '*' ? t('More projects') : (list[0]?.room.label ?? all.find((w) => w.room.key === k)?.room.label)), list: [] };
    gr.list.push(...list); groups.set(key, gr);
  });
  for (const [k, r] of rooms) if (!groups.has(k)) { r.room.dispose(); rooms.delete(k); }
  for (const [k, gr] of groups) {
    let r = rooms.get(k);
    const dept = DEPTS[k.slice(3)], own = { ...(dept?.style ? { style: dept.style } : {}), ...design.rooms[k] }, count = Math.max(gr.list.length, all.filter((w) => w.room.key === k).length); // sized for the whole team, so the room stays the same whoever is shown
    if (!r) {
      const used = new Set([...rooms.values()].map((x) => x.slot)), want = own.slot ?? homeSlot(k) ?? null;
      const wish = [...groups.keys()].filter((o) => o !== k).map((o) => design.rooms[o]?.slot ?? homeSlot(o)).filter((x) => x != null);
      let slot = want != null && want < SLOTS.length && !used.has(want) ? want : SLOTS.findIndex((_, n) => !used.has(n) && !wish.includes(n));
      if (slot < 0) slot = SLOTS.findIndex((_, n) => !used.has(n));
      rooms.set(k, r = { slot, sig: null });
    }
    const exec = SLOTS[r.slot].kind === 'boss' && count <= 6 && (!own.style || own.style === 'plain'), cap = exec ? 4 : seats(SLOTS[r.slot], count).length;
    if (own.style === 'plain') delete own.style;
    const sig = JSON.stringify([own.style, own.accent, own.floor, exec, cap, gr.label]);
    if (r.sig !== sig) {
      gridDirty = true; r.room?.dispose(); Object.assign(r, { sig, cap, label: gr.label, room: collect(() => buildRoom(scene, r.slot, gr, count, { ...own, executive: exec })) });
      for (const q of people.values()) if (q.spotKey?.startsWith('d:' + k + ':')) q.spotKey = null;
    }
    for (const w of gr.list) w.roomKey = k;
  }
  const used = new Set([...rooms.values()].map((x) => x.slot));
  SLOTS.forEach((_, i) => {
    if (used.has(i)) { spares.get(i)?.dispose(); spares.delete(i); }
    else if (!spares.has(i)) gridDirty = true, spares.set(i, collect(() => buildSpare(scene, i)));
  });
  scene.traverse((o) => { if (o.isPointLight) { o.intensity = o.userData.i * world.lampLevel; o.visible = world.lampLevel > 0.3; } }); // by day the lamps add nothing, so they cost nothing // rooms built later get the current light level
}

/** Chairs around the meeting table. */
const MEET = [...[0, 1, 2, 3].flatMap((k) => [-1, 1].map((d) => ({ x: MEETING.x - 2.25 + k * 1.5, z: MEETING.z + d * 1.9, face: d < 0 ? 0 : Math.PI }))), ...[-1, 1].map((d) => ({ x: MEETING.x + d * 3.9, z: MEETING.z, face: d < 0 ? Math.PI / 2 : -Math.PI / 2 }))];
let gather = null; // { room, to: 'room' | 'meeting', ids }
function place(p, w, wander = false) {
  if (p.controlled) return; // the viewer is walking as this person
  const r = rooms.get(w.roomKey), s = SLOTS[r.slot];
  // the computer is for people who work (or wait for an answer about their work); idle people take a break
  // a team that was called together sits at its desks or around the meeting table until it is released
  const called = gather?.ids.has(w.id) ? gather.to : null, meet = called === 'meeting';
  const onBreak = w.status === 'idle' && !called, prefix = meet ? 'm:' : onBreak ? 'break:' : `d:${w.roomKey}:`;
  if (!p.spotKey?.startsWith(prefix) || (onBreak && wander)) {
    const used = new Set([...people.values()].filter((x) => x !== p).map((x) => x.spotKey)), list = meet ? MEET : onBreak ? BREAKS : r.room.seats;
    const free = list.map((_, n) => n).filter((n) => !used.has(prefix + n) && prefix + n !== p.spotKey);
    if (onBreak && [...people.values()].filter((x) => x !== p && x.spot?.smoke).length < 2) { const sm = free.filter((n) => list[n].smoke); if (sm.length && Math.random() < 0.35) free.splice(0, free.length, ...sm); }
    if (onBreak && Math.random() < 0.6) { // rather walk over to someone who is already standing there than stand alone
      const taken = [...people.values()].filter((x) => x !== p && x.worker.status === 'idle' && x.spot && !x.spot.sit && !x.spot.smoke && !x.spot.over).map((x) => x.spot);
      const join = free.filter((n) => !list[n].sit && !list[n].smoke && taken.some((o) => Math.hypot(o.x - list[n].x, o.z - list[n].z) < 1.8)); if (join.length) free.splice(0, free.length, ...join);
    }
    const homely = onBreak && Math.random() < 0.5 ? free.filter((n) => list[n].slot === r.slot) : []; if (homely.length) free.splice(0, free.length, ...homely);
    const i = free.length ? free[onBreak ? Math.floor(Math.random() * free.length) : 0] : -1;
    if (i < 0 && onBreak && p.spotKey?.startsWith(prefix)) return; // nowhere else to go, stay
    p.seat = i; p.spotKey = prefix + (i < 0 ? 'x' + w.id : i);
    const k = [...people.values()].filter((x) => x !== p && x.spot?.over && x.spotKey?.startsWith(prefix)).length; // how many already stand without a seat here
    const sm = meet ? MEETING : s; p.spot = i >= 0 ? { face: 0, ...list[i] } : { x: sm.x + (k % 7 - 3) * Math.min(1.2, sm.w / 9) + 0.6, z: sm.z + sm.d / 2 - 0.9 - Math.floor(k / 7) * 0.9, face: Math.PI, over: true };
    p.restFor = p.spot.sit ? 35 + Math.random() * 60 : 14 + Math.random() * 26; p.until = Infinity; p.moving = true;
  }
  const pose = p.spot.over ? 'stand' : meet ? 'sit' : onBreak ? (p.spot.sit ? 'sit' : p.spot.smoke ? 'smoke' : 'stand') : w.status === 'working' ? 'type' : w.status === 'waiting' ? 'wave' : 'sit';
  if (p.moving) { p.moving = false; p.go(nav.path(p.g.position, p.spot) ?? [p.spot], pose, p.spot.face, () => { p.until = performance.now() / 1000 + p.restFor; }); }
  else if (p.path.length) p.nextPose = pose; else p.pose = pose;
}
/** Nobody just stands there: on a break people talk to whoever is next to them, drink coffee, or look at their phone. */
const hashOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function activity(p) {
  const w = p.worker, s = p.spot; if (!s || s.over || w.status !== 'idle' || p.path.length || p.controlled || s.smoke || !p.spotKey?.startsWith('break:')) return null;
  const n = hashOf(w.id) + (p.seat ?? 0);
  if (s.sit) return ['phone', 'coffee', null, 'coffee', 'phone'][n % 5];
  const mate = [...people.values()].find((o) => o !== p && !o.gone && !o.path.length && o.pose === 'stand' && o.worker.status === 'idle' && o.spotKey?.startsWith('break:') && Math.hypot(o.g.position.x - p.g.position.x, o.g.position.z - p.g.position.z) < 2.1);
  if (mate) { p.talkTurn = w.id < mate.worker.id ? 0 : 1; if (p.home == null) p.face = Math.atan2(mate.g.position.x - p.g.position.x, mate.g.position.z - p.g.position.z); return 'talk'; }
  return s.act ?? ['phone', 'coffee'][n % 2];
}
setInterval(() => { for (const p of people.values()) p.act = calm ? null : activity(p); }, 700);
setInterval(() => { // a few at a time get up and go somewhere else
  if (calm) return; const now = performance.now() / 1000; let n = 0;
  for (const p of people.values()) if (!p.gone && p.worker.status === 'idle' && p.worker.roomKey && now > p.until && n++ < 2) place(p, p.worker, true);
}, 2500);

function apply(list) {
  // a session that was opened with a task for an agent belongs to that agent's team from then on
  if (!demo) { let changed = false; for (const w of list) if (w.kind === 'session' && !design.assign[w.id]) { const role = taskRole(w.task, [...ROLES, ...design.custom]); if (role) { design.assign[w.id] = role; changed = true; } } if (changed) saveDesign(); }
  all = organise(list, design).map((w) => ({ ...named(w.kind === 'agent' || w.name === 'Untitled session' ? { ...w, name: t(w.name) } : w), homeRoom: w.room, room: { key: w.room.key, label: design.rooms[w.room.key]?.name ?? w.room.label } })); workers = all.filter(onFloor); layout();
  const ids = new Set(workers.map((w) => w.id));
  for (const w of workers) {
    let p = people.get(w.id);
    if (p?.gone) { p.dispose(); people.delete(w.id); p = null; }
    if (!p) {
      p = createPerson(scene, w, design.agents[w.id]); people.set(w.id, p);
      const from = w.parent && people.get(w.parent)?.g.position;
      p.g.position.copy(from ?? new THREE.Vector3(LOBBY.x, 0, LOBBY.z)); p.fresh = first || (w.status !== 'working' && !w.parent);
    }
    p.g.scale.setScalar((design.scene.people ?? 1) * (design.agents[w.id]?.size ?? 1));
    place(p, w);
    if (p.fresh && !p.controlled) { p.fresh = false; const s = p.spot; p.g.position.set(s.x, 0, s.z); p.go([], p.nextPose ?? p.pose, s.face, () => { p.until = performance.now() / 1000 + Math.random() * p.restFor; }); } // no stampede on page load
    p.update(w, selected === w.id);
  }
  for (const [id, p] of people) if (!ids.has(id) && !p.gone) {
    if (all.some((w) => w.id === id)) { p.dispose(); people.delete(id); continue; } // only hidden, still in the company
    p.gone = true; p.spotKey = null; p.tag.visible = false;
    p.go(nav.path(p.g.position, LOBBY) ?? [], 'stand', 0, () => { p.dead = true; });
  }
  refreshObstacles();
  for (const r of rooms.values()) for (let i = 0; i < r.cap; i++) r.room.setScreen(i, false);
  for (const w of workers) if (w.status === 'working') { const p = people.get(w.id); if (p.spotKey.startsWith('d:') && p.seat >= 0 && !p.controlled) rooms.get(w.roomKey).room.setScreen(p.seat, true); }
  const n = { working: 0, waiting: 0, idle: 0, unknown: 0, sessions: 0 };
  for (const w of workers) { n[w.status]++; if (w.kind === 'session') n.sessions++; }
  world.drawBoard(n);
  $('#nWorking').textContent = n.working; $('#nWaiting').textContent = n.waiting; $('#nIdle').textContent = n.idle; document.body.classList.toggle('haswait', n.waiting > 0);
  document.title = n.waiting ? t('({0}) waiting for you · Office', n.waiting) : officeName();
  if (selected && !all.some((w) => w.id === selected)) select(null);
  first = false; renderList(); renderDetail(); renderActive(); watchWaiting(); bell(); editor.refresh();
}

const ago = (at) => { if (!at) return null; const m = Math.max(0, Math.round((Date.now() - at) / 60000)); return m < 1 ? t('now') : m < 60 ? t('{0} min ago', m) : m < 1440 ? t('{0} h ago', Math.floor(m / 60)) : t('{0} days ago', Math.floor(m / 1440)); };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// --- opening the real session behind a character
const onMac = ['localhost', '127.0.0.1'].includes(location.hostname);
/** {href, text} for a worker, or null when nothing can be opened from this device. */
/** The session's own page on claude.ai (it exists while Remote Control is on for that session): the place to answer or approve from a browser. */
function webLink(w) {
  const s = !w ? null : w.kind === 'session' || (w.kind === 'chum' && w.open) ? w : all.find((x) => x.id === (w.parent ?? w.viaSession ?? w.lastSession ?? w.team?.[0]));
  return s?.web ? { href: 'https://claude.ai/code/' + s.web, text: t('Session opens in the browser') } : null;
}
function openLink(w) {
  if (!w) return null;
  const s = w.kind === 'session' || (w.kind === 'chum' && w.open) ? w : all.find((x) => x.id === (w.parent ?? w.viaSession ?? w.lastSession ?? w.team?.[0]));
  const what = w.kind === 'session' ? t('Open session') : w.parent || w.viaSession ? t('Open its session') : w.team?.length && !w.lastSession ? t('Open a team session') : t('Open its last session');
  if (s && onMac && s.open) return { href: 'claude://code/continue?session=' + encodeURIComponent(s.open), text: what };
  if (s && !onMac && s.web) return { href: 'https://claude.ai/code/' + s.web, text: what };
  return null;
}
// the user's own company comes from their machine; without one the office starts from the first built-in template
let prevCompany = null;
function useCompany(c) { if (c) setCompany(c); document.title = officeName(); if (raw) apply(raw); renderRooms(); editor.refresh?.(); }
/** Saves the company to the user's machine. Resolves to true when it was accepted. */
async function saveCompany(next, keepPrev = true) {
  const before = COMPANY;
  if (demo) { if (keepPrev) prevCompany = before; useCompany(next); return true; } // the demo never writes to disk
  try {
    const r = await fetch('/api/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }), body = await r.json().catch(() => null);
    if (!r.ok) { toast(t('Company not saved: {0}', body?.error ?? r.status)); return false; }
    if (keepPrev) prevCompany = before; useCompany(body); return true;
  } catch { toast(t('Company not saved, no connection to the server')); return false; }
}
/** The choice made on the welcome screen. */
async function startWith(company, look) {
  if (!demo && loadedOnce && started) { // an office already exists: keep it under My templates, with its project and agent names
    try { await myTemplates.save(t('Before {0}', new Date().toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })).slice(0, 40)); } catch { toast(t('Nothing was changed: the current office could not be saved first')); return false; }
    company = { ...company, projects: COMPANY.projects, agents: COMPANY.agents };
  }
  if (!(await saveCompany(company))) return false; if (look) { setDesign({ ...design, ...look }); saveDesign(); } return true; }
const officeName = () => (COMPANY.name ? t('{0} Office', COMPANY.name) : t('Office'));
const asRole = (w) => `Act as ${w.name}${COMPANY.name ? ' of ' + COMPANY.name : ''}. ${w.brief ?? ''}\n${COMPANY.prompt ?? ''}`.trim();
function newLink(w) {
  if (!onMac || w.kind === 'session') return null;
  if (w.kind === 'role') return { href: 'claude://code/new?q=' + encodeURIComponent(`${asRole(w)}\n\nThe task: `), text: t('New session in this role') };
  return w.type ? { href: 'claude://code/new?q=' + encodeURIComponent(`Use the agent ${w.type}: `), text: t('New session with this agent') } : null;
}
/** Opens a new Claude session, in the chosen project, that hands the task to this agent. */
function taskLink(w, task, folder) {
  const text = w.type && w.staff ? `Use the agent ${w.type} (Agent tool, subagent_type: ${w.type}) for the following task, wait for the result and summarise it for me:\n\n${task}` : `${asRole(w)}\n\nThe task: ${task}`;
  return 'claude://code/new?q=' + encodeURIComponent(text) + (folder ? '&folder=' + encodeURIComponent(folder) : '');
}
function renderTask(w) {
  const box = $('#dTask'), can = onMac && w && w.kind !== 'session' && w.kind !== 'chum' && (w.staff || w.kind === 'role'), key = can ? w.id : '';
  if (box.dataset.key === key) return; box.dataset.key = key; box.replaceChildren(); if (!can) return;
  const ta = el('textarea'); ta.rows = 3; ta.maxLength = 800; ta.placeholder = t('Task for {0}…', w.name); ta.setAttribute('aria-label', t('Task for {0}', w.name));
  const sel = el('select'); sel.setAttribute('aria-label', t('Project')); let last = ''; try { last = localStorage.getItem('taskFolder') ?? ''; } catch {}
  const dirs = new Map(); for (const x of all) if (x.kind === 'session' && x.project?.key?.startsWith('/')) dirs.set(x.project.key, x.project.label);
  sel.append(...[['', t('No project (I will choose in Claude)')], ...dirs].map(([k, label]) => { const o = el('option', '', label); o.value = k; o.selected = k === last; return o; }));
  const b = el('button', 'main', t('Send task')); b.onclick = () => { const task = ta.value.trim(); if (!task) { toast(t('Write a task first')); ta.focus(); return; } try { localStorage.setItem('taskFolder', sel.value); } catch {} go({ href: taskLink(w, task, sel.value), text: t('Opening a new Claude session with the task') }); ta.value = ''; };
  ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) b.click(); });
  box.append(el('span', '', t('New task')), ta, sel, b);
}
function openWorker(w) { const l = openLink(w) ?? newLink(w); if (!l) { toast(onMac ? t('This agent has no open session') : t('This session can only be opened from the computer it runs on')); return; } go(l); }
function go(l) { const a = el('a'); a.href = l.href; if (l.href.startsWith('https')) { a.target = '_blank'; a.rel = 'noopener'; } a.click(); toast(l.text + '…'); }
let toastT; function toast(msg) { const b = $('#toast'); b.textContent = msg; b.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { b.hidden = true; }, 2600); }
const GROUPS = [t('Active now'), t('Managers and team leads'), t('Team'), t('Session agents')];
const group = (w) => (w.status === 'waiting' || w.status === 'working' ? GROUPS[0] : w.kind === 'session' ? GROUPS[3] : w.lead ? GROUPS[1] : GROUPS[2]);
function renderList() {
  const q = $('#q').value.trim().toLowerCase(), box = $('#list'), focus = document.activeElement?.dataset?.id;
  const rows = (q ? all : workers).filter((w) => !q || `${w.name} ${w.type ?? ''} ${w.role ?? ''} ${w.room.label} ${w.task ?? ''}`.toLowerCase().includes(q))
    
    .sort((a, b) => GROUPS.indexOf(group(a)) - GROUPS.indexOf(group(b)) || ORDER[a.status] - ORDER[b.status] || (b.lastAt ?? 0) - (a.lastAt ?? 0));
  const head = (title) => el('h3', '', title);
  box.replaceChildren(...rows.flatMap((w, i) => {
    const b = el('button', `row ${w.status}${selected === w.id ? ' sel' : ''}`); b.dataset.id = w.id;
    const txt = el('span', 'txt'); txt.append(el('b', '', w.name), el('small', '', w.kind === 'agent' && w.status === 'working' && w.task ? tLine(w.task) : w.kind === 'session' ? `${w.leadName ?? ''} · ${STATUS[w.status]}` : `${w.room.label} · ${w.team?.length ? t('{0} sessions', w.team.length) : STATUS[w.status]}`));
    b.append(el('i', 'dot'), txt); b.onclick = () => select(w.id, true); b.ondblclick = () => openWorker(w);
    const wrap = el('div', 'rowwrap'); wrap.append(b); const lk = openLink(w); if (lk) { const o = el('button', 'openbtn', '↗'); o.setAttribute('aria-label', `${lk.text}: ${w.name}`); o.title = lk.text; o.onclick = () => go(lk); wrap.append(o); }
    return i === 0 || group(w) !== group(rows[i - 1]) ? [head(group(w)), wrap] : [wrap];
  }));
  if (!rows.length) box.append(el('p', 'empty', q ? t('No results') : t('No agents or sessions right now')));
  if (focus) box.querySelector(`[data-id="${CSS.escape(focus)}"]`)?.focus();
}
function renderDetail() {
  const w = all.find((x) => x.id === selected), d = $('#detail'); d.hidden = !w; if (!w) return;
  $('#dName').textContent = w.name; $('#dStatus').textContent = STATUS[w.status]; $('#dStatus').className = 'pill ' + w.status;
  const parent = w.parent && all.find((x) => x.id === w.parent);
  const rows = [[t('Type'), { session: t('Session agent'), agent: w.staff ? t('Defined Claude agent') : t('Temporary agent'), chum: t('Chum'), role: t('Office role (no Claude agent defined)') }[w.kind]], [t('ID'), w.type], [t('Role'), w.role], [t('Chum'), w.chum ? (w.chumDown ? t('{0} (not running)', w.chum) : w.chum) : null], [t('Room'), w.room.label], [t('Started from'), parent?.name], [t('Project'), w.kind === 'chum' ? null : w.project?.label], [t('Latest status'), w.recap], w.kind === 'session' ? [t('Your last message'), w.task] : [t('Task'), tLine(w.task)], [t('Last task'), tLine(w.lastTask)], [t('Saved runs'), w.staff ? String(w.runs) : null],
    [w.status === 'working' ? t('Now') : t('Last action'), tLine(w.action?.text)], [t('Last activity'), ago(w.lastAt)], [t('Opened'), ago(w.startedAt)],
    [t('Model'), w.model && w.model + (w.effort ? ` · ${w.effort}` : '')], [t('Context'), w.contextTokens && t('{0} tokens', w.contextTokens.toLocaleString(LOCALE))], [t('Branch'), w.branch]];
  const nb = $('#dNeed'), nd = w.status === 'waiting' ? needOf(w) : null, nk = JSON.stringify([w.id, nd, webLink(w)?.href]);
  if (nb.dataset.key !== nk) {
    nb.dataset.key = nk; nb.hidden = !nd; nb.replaceChildren();
    if (nd) {
      nb.append(el('b', '', nd.label), el('p', '', tLine(nd.text))); nb.lastChild.dir = 'auto';
      if (nd.options.length) { const ul = el('ul'); ul.setAttribute('aria-label', t('Suggested options')); ul.append(...nd.options.map((o) => el('li', '', o))); nb.append(ul); }
      const approve = w.need?.kind === 'permission' || w.need?.kind === 'plan', l = openLink(w), wl = webLink(w);
      if (wl) { const b = el('button', 'main', approve ? t('Approve in the browser') : t('Answer in the browser')); b.onclick = () => go(wl); nb.append(b); }
      if (l && l.href !== wl?.href) { const b = el('button', wl ? '' : 'main', approve ? t('Open in Claude to approve') : t('Open in Claude to answer')); b.onclick = () => go(l); nb.append(b); }
      if (!wl) nb.append(el('small', '', l ? t('To approve from the browser, turn on Remote Control in that session') : t('You answer in the session itself, in Claude')));
    }
  }
  const acts = $('#dActs'), L = openLink(w), N = newLink(w), key = JSON.stringify([w.id, L, N]);
  if (acts.dataset.key !== key) { acts.dataset.key = key; acts.replaceChildren(...[L, N, { walk: true, text: t('Walk as this agent') }].filter(Boolean).map((l, i) => { const b = el('button', i === 0 ? 'main' : '', l.text); b.onclick = () => (l.walk ? walkAs(w) : go(l)); return b; })); }
  renderTask(w);
  const box = $('#dLead'), ld = JSON.stringify([w.id, w.leadRole, w.team, design.custom.length]);
  if (box.dataset.key !== ld) {
    box.dataset.key = ld; box.replaceChildren();
    if (w.kind === 'session' && w.leadRole) { // choose who is responsible for this session
      const s = el('select'); s.setAttribute('aria-label', t('Team lead')); for (const [k, dp] of Object.entries(DEPTS)) { const g = el('optgroup'); g.label = dp.label; for (const q of [...ROLES, ...design.custom].filter((q) => q.dept === k && q.lead)) { const o = el('option', '', q.name); o.value = q.id; o.selected = q.id === w.leadRole; g.append(o); } if (g.children.length) s.append(g); }
      s.onchange = () => { const d = JSON.parse(JSON.stringify(design)); d.assign[w.id] = s.value; setDesign(d); saveDesign(); };
      box.append(el('span', '', w.auto ? t('Team lead (assigned automatically)') : t('Team lead')), s);
    } else if (w.team?.length) { box.append(el('span', '', t('Sessions it is responsible for'))); for (const id of w.team) { const x = all.find((q) => q.id === id); if (!x) continue; const b = el('button', x.status, x.name); b.onclick = () => select(id, true); box.append(b); } }
  }
  $('#dRows').replaceChildren(...rows.filter((r) => r[1]).flatMap(([k, v]) => { const dd = el('dd', '', v); dd.dir = 'auto'; return [el('dt', '', k), dd]; }));
}
function select(id, zoom) {
  selected = id;
  for (const p of people.values()) if (!p.gone) p.update(p.worker, p.worker.id === id);
  const p = id && people.get(id);
  if (p && zoom && p.spot) {
    const target = new THREE.Vector3(p.spot.x, 1.2, p.spot.z), pos = target.clone().add(new THREE.Vector3(-7, 11, 15));
    if (calm) { camera.position.copy(pos); controls.target.copy(target); } else fly = { pos, target };
  }
  renderList(); renderDetail();
}
$('#q').oninput = renderList; $('#close').onclick = () => select(null); 
// --- camera pad: hold to keep moving
const sph = new THREE.Spherical(), off = new THREE.Vector3();
function orbit(dTheta, dPhi, k = 1) { fly = null; off.copy(camera.position).sub(controls.target); sph.setFromVector3(off); sph.theta += dTheta; sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, 0.02, 1.45); sph.radius = THREE.MathUtils.clamp(sph.radius * k, 2.5, 190); camera.position.copy(controls.target).add(off.setFromSpherical(sph)); }
const PAD = { left: [-1.3, 0, 1], right: [1.3, 0, 1], up: [0, -0.9, 1], down: [0, 0.9, 1], in: [0, 0, 0.35], out: [0, 0, 2.8] }, held = new Set();
for (const b of document.querySelectorAll('[data-cam]')) {
  const k = b.dataset.cam; b.addEventListener('pointerdown', (e) => { if (e.button) return; b.setPointerCapture(e.pointerId); stopAuto(); held.add(k); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, () => held.delete(k));
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const [a, c, z] = PAD[k]; orbit(a * 0.2, c * 0.2, z ** 0.2); } });
}
const KEYCAM = { KeyQ: 'left', KeyE: 'right', PageUp: 'up', PageDown: 'down', Equal: 'in', NumpadAdd: 'in', Minus: 'out', NumpadSubtract: 'out' };
function padTick(dt) { for (const k of held) { const [a, c, z] = PAD[k]; orbit(a * dt, c * dt, z ** dt); } const s = $('#zoomer'); if (document.activeElement !== s) s.value = String(Math.round(1000 - Math.log(camera.position.distanceTo(controls.target) / 2.5) / Math.log(190 / 2.5) * 1000)); }
$('#zoomer').oninput = (e) => { fly = null; stopAuto(); const d = 2.5 * (190 / 2.5) ** (1 - e.target.value / 1000); camera.position.sub(controls.target).setLength(d).add(controls.target); };
function floorAt(e) { const r = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ptr, camera); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()); }
function focusOn(pt, k) { const t = new THREE.Vector3(THREE.MathUtils.clamp(pt.x, -60, 60), 1, THREE.MathUtils.clamp(pt.z, -50, 50)), d = camera.position.clone().sub(controls.target).multiplyScalar(k); if (d.length() < 8) d.setLength(8); fly = { pos: t.clone().add(d), target: t }; }
// --- rooms: one click zooms to a room; [ and ] step through them
function areas() {
  const inside = (a) => [...people.values()].filter((q) => !q.gone && (q.worker.status === 'working' || q.worker.status === 'waiting') && Math.abs(q.g.position.x - a.x) < a.w / 2 && Math.abs(q.g.position.z - a.z) < a.d / 2).length;
  return [...[...rooms].map(([k, v]) => ({ key: k, label: v.label, ...SLOTS[v.slot] })), { key: 'meeting', label: t('Meeting room'), ...MEETING }, { key: 'kitchen', label: t('Kitchen'), x: -24 + PLAN.kitchen[0], z: -3.4 + PLAN.kitchen[1], w: 10, d: 14 }, { key: 'lounge', label: t('Lounge'), x: -8 + PLAN.lounge[0], z: 12 + PLAN.lounge[1], w: 12, d: 10 }, { key: 'lobby', label: t('Reception'), x: 2.5 + PLAN.reception[0], z: 14 + PLAN.reception[1], w: 11, d: 12 }, { key: 'smoke', label: t('Smoking corner'), x: 11, z: FLOOR.d / 2 + 4, w: 10, d: 5 }].map((a) => ({ ...a, n: inside(a) }));
}
function viewArea(a) {
  stopAuto(); viewRoom = a.key; peek = false; roomBoxOff = null; if (selected) select(null); const t = new THREE.Vector3(a.x, 0.8, a.z), need = Math.max(a.w / Math.max(0.6, camera.aspect), a.d * 0.8), d = need / (2 * Math.tan(THREE.MathUtils.degToRad(13))) * 1.12 + 4;
  if (raw) apply(raw); fly = { pos: t.clone().add(new THREE.Vector3(-0.22, 0.74, 0.64).normalize().multiplyScalar(d)), target: t }; renderRooms(); renderRoomBox();
}
// --- the people of the room that is open: its team for a department, whoever is inside for a shared area
let roomBoxOff = null, peek = false; // peek: the room was opened by a click on its floor, the camera has not gone there yet
function renderRoomBox() {
  const box = $('#roomBox'), a = viewRoom && areas().find((x) => x.key === viewRoom), show = !!a && !selected && roomBoxOff !== viewRoom && !walk?.id;
  if (!show) { if (!box.hidden) { box.hidden = true; box.dataset.sig = ''; } return; }
  const here = (w) => { const p = people.get(w.id); return !!p && !p.gone && Math.abs(p.g.position.x - a.x) < a.w / 2 && Math.abs(p.g.position.z - a.z) < a.d / 2; };
  const rank = (w) => (w.team?.length || w.lead ? 0 : 4) + ({ waiting: 0, working: 1 }[w.status] ?? 2) + (w.kind === 'session' ? 0.5 : 0);
  const sitting = a.key === 'meeting' && gather?.to === 'meeting'; // the meeting room lists whoever was called to it, also while they are on their way
  const list = all.filter((w) => rooms.has(a.key) ? (w.roomKey ?? w.room.key) === a.key : here(w) || (sitting && gather.ids.has(w.id))).sort((x, y) => rank(x) - rank(y));
  const mine = gather?.room === a.key, sig = JSON.stringify([a.key, a.label, mine && gather.to, sitting, gather?.to === 'meeting' && (sitting || mine) ? meetingSummary(all.filter((w) => gather.ids.has(w.id) && !w.team?.length), '').text : 0, list.map((w) => [w.id, w.name, w.status, w.action?.text])]); box.hidden = false; if (box.dataset.sig === sig) return; box.dataset.sig = sig;
  const h = $('#rName'); h.textContent = a.label; h.append(el('span', '', list.length ? String(list.length) : ''));
  const inMeeting = gather?.to === 'meeting' && (sitting || mine), sum = inMeeting ? meetingSummary(all.filter((w) => gather.ids.has(w.id) && !w.team?.length), rooms.get(gather.room)?.label ?? a.label) : null;
  const call = (to) => { gather = to ? { room: a.key, to, ids: new Set(list.map((w) => w.id)) } : null; box.dataset.sig = ''; if (raw) apply(raw); renderRoomBox(); };
  const btn = (text, to, on) => { const b = el('button', '', text); b.setAttribute('aria-pressed', String(!!on)); b.onclick = () => call(on ? null : to); return b; };
  $('#rActs').replaceChildren(...(rooms.has(a.key) && list.length ? [btn(mine && gather.to === 'room' ? t('Release') : t('Gather here'), 'room', mine && gather.to === 'room'), btn(mine && gather.to === 'meeting' ? t('End meeting') : t('To meeting room'), 'meeting', mine && gather.to === 'meeting')] : sitting ? [btn(t('End meeting'), null, true)] : []));
  box.classList.toggle('big', !!sum);
  if (sum) { // a meeting is on: the list becomes the team's status summary
    const copy = el('button', '', t('Copy summary')); copy.onclick = () => navigator.clipboard?.writeText(sum.text).then(() => toast(t('Summary copied')), () => toast(t('Copy failed'))) ?? toast(t('No clipboard access in this browser'));
    $('#rActs').append(copy);
    $('#rList').replaceChildren(el('p', 'sumline', t('{0} working · {1} waiting for you · {2} idle', sum.counts.working, sum.counts.waiting, sum.counts.idle)), ...sum.sections.flatMap((sec) => [el('h3', 'sum ' + sec.key, sec.title), ...sec.items.map((i) => {
      const b = el('button', 'row sumrow'), txt = el('span', 'txt'); txt.append(el('b', '', i.name), el('small', '', i.text)); if (i.more) txt.append(el('small', 'more', i.more)); b.append(txt); b.onclick = () => select(i.id, true); return b; })]));
    return;
  }
  $('#rList').replaceChildren(...(list.length ? list.map((w) => {
    const b = el('button', 'row ' + w.status), txt = el('span', 'txt'); txt.append(el('b', '', w.name), el('small', '', w.status === 'working' && w.action ? tLine(w.action.text) : w.status === 'waiting' ? tLine(needOf(w).text) : `${w.kind === 'session' ? t('Session') : w.team?.length || w.lead ? t('Team lead') : t('Agent')} · ${STATUS[w.status]}`));
    b.append(el('i', 'dot'), txt); b.onclick = () => select(w.id, true); return b;
  }) : [el('p', 'empty', rooms.has(a.key) ? t('No one in this team') : t('No one here right now'))]));
}
$('#roomClose').onclick = () => { roomBoxOff = viewRoom; renderRoomBox(); };
setInterval(renderRoomBox, 600);
function renderRooms() {
  const list = areas(), sig = JSON.stringify([viewRoom, list.map((a) => [a.key, a.label, a.n])]); if ($('#rooms').dataset.sig === sig) return; $('#rooms').dataset.sig = sig;
  const all0 = el('button', '', t('Whole office')); all0.setAttribute('aria-pressed', String(!viewRoom)); all0.onclick = () => { viewRoom = null; if (raw) apply(raw); home(); renderRooms(); };
  const focusKey = document.activeElement?.dataset?.room;
  $('#rooms').replaceChildren(all0, ...list.map((a) => { const b = el('button', '', a.label); b.dataset.room = a.key; if (a.n) b.append(el('span', '', String(a.n))); b.setAttribute('aria-pressed', String(viewRoom === a.key)); b.onclick = () => viewArea(a); return b; }));
  if (focusKey) $('#rooms').querySelector(`[data-room="${CSS.escape(focusKey)}"]`)?.focus();
}
setInterval(renderRooms, 1500);
addEventListener('keydown', (e) => { if (typing(e) || !['BracketLeft', 'BracketRight'].includes(e.code)) return; const l = areas(), i = l.findIndex((a) => a.key === viewRoom); viewArea(l[(i + (e.code === 'BracketRight' ? 1 : -1) + l.length) % l.length]); });

const VIEWS = {
  iso: () => { viewRoom = null; if (raw) apply(raw); home(); renderRooms(); }, top: () => { const k = Math.max(1, 1.5 / camera.aspect); fly = { pos: new THREE.Vector3(0, 98 * k, 3), target: new THREE.Vector3(0, 0, 1) }; },
  front: () => { fly = { pos: new THREE.Vector3(0, 24, 66), target: new THREE.Vector3(0, 0, 0) }; },
  eye: () => { const t = controls.target.clone().setY(1.6), d = camera.position.clone().sub(controls.target).setY(0); if (d.length() < 0.1) d.set(0, 0, 1); d.setLength(9); fly = { pos: t.clone().add(d).setY(2.3), target: t }; },
};
for (const b of document.querySelectorAll('[data-view]')) b.onclick = () => { stopAuto(); VIEWS[b.dataset.view](); };
// --- "someone is waiting for you": the Mac shows a notification (from the server); the open page also chimes
const bell = () => { $('#bell').setAttribute('aria-pressed', String(design.notify)); $('#bell').textContent = design.notify ? t('🔔 Alerts') : t('🔕 Alerts off'); };
const setNotify = (v) => { if (v !== design.notify) $('#bell').onclick(); };
$('#settingsBtn').onclick = () => showSettings({ notify: design.notify, setNotify, quality: gfx, setQuality: setGfx, startOver: () => showWelcome(startWith, () => {}, COMPANY.name), demo, local: onMac, toast, stop: () => renderer.setAnimationLoop(null) });
$('#bell').onclick = () => { const d = JSON.parse(JSON.stringify(design)); d.notify = !design.notify; setDesign(d); saveDesign(); bell(); if (d.notify) chime(); };
let audio = null, waitingIds = null;
function chime() { try { audio ??= new AudioContext(); const t = audio.currentTime; for (const [f, at] of [[880, 0], [1175, 0.16]]) { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.18, t + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.5); o.connect(g).connect(audio.destination); o.start(t + at); o.stop(t + at + 0.55); } } catch {} }
function watchWaiting() { const now = new Set(all.filter((w) => w.status === 'waiting' && w.kind === 'session').map((w) => w.id)); if (waitingIds && design.notify && !onMac && [...now].some((id) => !waitingIds.has(id))) chime(); waitingIds = now; } // on the Mac itself the system notification already makes the sound
$('#camBtn').onclick = () => { const o = document.body.classList.toggle('cam'); $('#camBtn').setAttribute('aria-expanded', String(o)); };
$('#toggle').onclick = () => { const o = document.body.classList.toggle('closed'); $('#toggle').setAttribute('aria-expanded', String(!o)); resize(); home(); };
if (onMac) { const b = el('button', '', '↗'); b.id = 'waitOpen'; b.title = t('Sessions waiting for you, in Claude'); b.setAttribute('aria-label', b.title); b.onclick = () => go({ href: 'claude://code/needs-input', text: t('Opening the sessions waiting for you in Claude') }); $('#waitBtn').after(b); }
$('#waitBtn').onclick = () => { const l = all.filter((w) => w.status === 'waiting'); if (l.length) select(l[(l.findIndex((w) => w.id === selected) + 1) % l.length].id, true); };
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !editor.on) { select(null); home(); } });

// live strip: who is active right now
function renderActive() {
  const act = all.filter((w) => w.status === 'waiting' || w.status === 'working').sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  $('#active').replaceChildren(...act.map((w) => {
    const b = el('button', 'card ' + w.status); b.append(el('b', '', w.name), el('span', '', w.status === 'waiting' ? tLine(needOf(w).text) : tLine(w.action?.text) ?? t('Working')), el('small', '', [w.kind === 'session' ? w.project.label : null, w.kind === 'session' ? w.task : tLine(w.task)].filter(Boolean).join(' · ')));
    b.onclick = () => select(w.id, true); b.ondblclick = () => openWorker(w); const wrap = el('div', 'cardwrap'); wrap.append(b); const lk = openLink(w); if (lk) { const o = el('button', 'openbtn', '↗'); o.setAttribute('aria-label', `${lk.text}: ${w.name}`); o.title = lk.text; o.onclick = () => go(lk); wrap.append(o); } return wrap;
  }), ...(act.length ? [] : [el('p', 'none', t('No active agent right now'))]));
}

// --- the saved design -----------------------------------------------------
const itemMeshes = new Map();
function showItems() {
  const list = design.items ?? DEFAULT_ITEMS, ids = new Set(list.map((i) => i.id));
  for (const [id, m] of itemMeshes) if (!ids.has(id)) { m.dispose(); itemMeshes.delete(id); }
  for (const it of list) {
    const sig = [it.type, it.color, it.text].join('|'); let m = itemMeshes.get(it.id);
    if (m && m.sig !== sig) { m.dispose(); m = null; }
    if (!m) { m = createItem(scene, it); m.sig = sig; itemMeshes.set(it.id, m); }
    m.group.position.set(it.x, 0, it.z); m.group.rotation.y = it.ry; m.group.scale.setScalar(it.s);
  }
  obstacleSig = ''; refreshObstacles(); gridDirty = true;
}
let obstacleSig = '';
function refreshObstacles() { // people walk around desks and around furniture placed in the editor
  const list = (design.items ?? DEFAULT_ITEMS).filter((i) => RADIUS[i.type]).map((i) => (i.type === 'sofa' || i.type === 'armchair' ? { x: i.x, z: i.z, ry: i.ry, w: (i.type === 'sofa' ? 3.7 : 1.8) * i.s, d: 1.3 * i.s } : { x: i.x, z: i.z, r: RADIUS[i.type] * i.s }));
  list.push(...world.solids); for (const r of [...rooms.values()].map((x) => x.room).concat([...spares.values()])) list.push(...(r?.solids ?? []));
  for (const r of rooms.values()) for (const p of r.room.seats) if (p.face == null) for (const dx of [-0.7, 0.7]) list.push({ x: p.x + dx, z: p.z + 1.3, r: 0.4 });
  const sig = JSON.stringify(list); if (sig !== obstacleSig) { obstacleSig = sig; nav.setObstacles(list); }
}
let newPlan = false, loadedOnce = false, started = false; // started: there is a saved company on this machine
function setDesign(d) {
  if (!demo && (d.scene?.plan ?? 'atrium') !== PLAN_ID && d.rev !== undefined && loadedOnce) { newPlan = true; } // another building: the page starts again once the design is saved
  const old = design; design = { notify: d.notify !== false, rev: d.rev ?? 0, items: d.items ?? null, rooms: d.rooms ?? {}, agents: d.agents ?? {}, assign: d.assign ?? {}, custom: d.custom ?? [], scene: d.scene ?? {} };
  showItems();
  if (world.setOutside(design.scene.outside)) gridDirty = true; // other ground to walk on
  world.setMood(design.scene.mood, design.scene.light); bloom.strength = design.scene.glow ?? 0.12;
  // rooms whose wanted place changed are rebuilt where they belong
  if (JSON.stringify(Object.entries(old.rooms).map(([k, v]) => [k, v.slot])) !== JSON.stringify(Object.entries(design.rooms).map(([k, v]) => [k, v.slot]))) {
    for (const [k, r] of rooms) { r.room.dispose(); rooms.delete(k); }
    for (const p of people.values()) if (p.spotKey?.startsWith('d:')) p.spotKey = null;
  }
  const looks = (d) => Object.fromEntries(Object.entries(d.agents).map(([k, { name, room, size, ...l }]) => [k, JSON.stringify(l)]));
  const A = looks(old), N = looks(design);
  for (const [id, p] of people) if ((A[id] ?? '{}') !== (N[id] ?? '{}') && !p.gone) {
    const q = createPerson(scene, p.worker, design.agents[id]); q.g.position.copy(p.g.position); q.g.rotation.copy(p.g.rotation);
    Object.assign(q, { controlled: p.controlled, until: p.until, restFor: p.restFor, onArrive: p.onArrive, face: p.face, pose: p.pose, path: p.path, nextPose: p.nextPose, nextFace: p.nextFace, spot: p.spot, spotKey: p.spotKey, seat: p.seat }); p.dispose(); people.set(id, q);
  }
  if (raw) apply(raw);
}
let raw = null, saveT;
function saveDesign() { if (demo) return; clearTimeout(saveT); saveT = setTimeout(async () => { try { const q = await fetch('/api/layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(design) }); if (!q.ok) throw new Error(q.status); design.rev = (await q.json()).rev; if (newPlan) return location.reload(); toast(t('Saved')); } catch { toast(t('Save failed')); } }, 300); }
// the user's saved offices live in a folder on their machine; these are the four calls the editor needs
const J = { 'Content-Type': 'application/json' }, myTemplates = {
  list: () => fetch('/api/templates').then((r) => (r.ok ? r.json() : [])).catch(() => []),
  get: (id) => fetch('/api/templates/' + encodeURIComponent(id)).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  save: async (name) => { if (demo) throw new Error(t('Nothing is saved in demo mode')); const r = await fetch('/api/templates', { method: 'PUT', headers: J, body: JSON.stringify({ name, company: COMPANY, layout: design }) }), b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.error ?? r.status); return b; },
  remove: (id) => fetch('/api/templates/' + encodeURIComponent(id), { method: 'DELETE' }).then((r) => r.ok).catch(() => false),
};
const editor = createEditor({ demo, myTemplates, saveCompany, get prevCompany() { return prevCompany; }, agentTypes: () => (raw ?? []).filter((w) => w.staff && w.type && w.kind === 'agent').map((w) => [w.type, w.name]).sort((x, y) => x[0].localeCompare(y[0])),
  scene, camera, renderer, controls, itemMeshes, rooms, people,
  getDesign: () => design, setDesign, getWorkers: () => all, pickPerson: (e) => pickAt(e), toast, topView: () => { const k = Math.max(1, 1.5 / camera.aspect); fly = { pos: new THREE.Vector3(-1, 92 * k, 38 * k), target: new THREE.Vector3(0, 0, 1) }; }, homeView: () => home(), floorAt: (e) => floorAt(e), moveTo: (a) => viewArea(a),
  save: demo ? null : async (d) => { const r = await fetch('/api/layout', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); if (!r.ok) throw new Error(r.status); const saved = await r.json(); if ((saved.scene?.plan ?? 'atrium') !== PLAN_ID) location.reload(); return saved; },
});

// --- game camera: WASD / arrows to move, automatic tour of the active agents ----
const keys = new Set(); let auto = false, autoAt = 0, autoI = 0;
const typing = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
addEventListener('keydown', (e) => { if (!typing(e) && MOVE[e.code] && !e.metaKey && !e.ctrlKey && !(editor.on && editor.selected)) { keys.add(e.code); fly = null; stopAuto(); if (document.activeElement === document.body) e.preventDefault(); } });
addEventListener('keydown', (e) => { if (!typing(e) && KEYCAM[e.code] && !e.metaKey && !e.ctrlKey) { stopAuto(); held.add(KEYCAM[e.code]); } });
addEventListener('keyup', (e) => { keys.delete(e.code); held.delete(KEYCAM[e.code]); }); addEventListener('blur', () => { keys.clear(); held.clear(); });
function moveCamera(dt) {
  if (!keys.size) return;
  const f = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize(), r = new THREE.Vector3(-f.z, 0, f.x), d = new THREE.Vector3();
  for (const k of keys) d.addScaledVector(r, MOVE[k][0]).addScaledVector(f, -MOVE[k][1]);
  d.multiplyScalar(dt * Math.max(7, camera.position.distanceTo(controls.target) * 0.55));
  const t = controls.target.clone().add(d); t.x = THREE.MathUtils.clamp(t.x, -70, 70); t.z = THREE.MathUtils.clamp(t.z, -60, 60);
  camera.position.add(t.clone().sub(controls.target)); controls.target.copy(t);
}
function stopAuto() { auto = false; $('#auto').setAttribute('aria-pressed', 'false'); }
$('#auto').onclick = () => { auto = !auto; autoAt = 0; $('#auto').setAttribute('aria-pressed', String(auto)); if (!auto) home(); };
controls.addEventListener('start', stopAuto);
function tour(t) {
  if (!auto || t < autoAt) return; autoAt = t + 9;
  const l = workers.filter((w) => w.status === 'working' || w.status === 'waiting'); if (!l.length) { home(); return; }
  const p = people.get(l[autoI++ % l.length].id); if (!p) return;
  const a = autoI * 1.3, target = new THREE.Vector3(p.spot.x, 1.3, p.spot.z); fly = { pos: target.clone().add(new THREE.Vector3(Math.sin(a) * 5, 5.5, 8)), target };
}

// --- walking as a person
// on foot you collide with the real furniture, walls, plants and trees; the grid is rebuilt when the office changes
let grid = null, gridDirty = true;
const prepareGrid = () => { if (!gridDirty && grid) return; gridDirty = false; for (const q of people.values()) q.g.visible = false; grid = buildGrid(scene, FLOOR.w / 2 + 9, FLOOR.d / 2 + 9); for (const q of people.values()) q.g.visible = true; };
walk = createWalk({ camera, renderer, controls, people, calm, resize, prepare: prepareGrid, blocked: (x, z) => { if (grid.body(x, z)) return true; for (const [k, q] of people) if (k !== walk.id && !q.gone && Math.hypot(q.g.position.x - x, q.g.position.z - z) < 0.36) return true; return false; }, blockedTall: (x, z) => grid.tall(x, z), limits: { x: FLOOR.w / 2 + 8.5, z: FLOOR.d / 2 + 8.5 }, open: (w) => openWorker(w), onChange: () => { if (raw) apply(raw); },
  describe: (w) => { const l = openLink(w); const what = w.status === 'working' && w.action ? tLine(w.action.text) : STATUS[w.status]; return `${w.name} · ${what}${l ? ' · E ' + l.text : ''}${canTask(w) ? ' · ' + t('T task') : ''}`; },
  canTask, hasSession: (w) => !!openLink(w), seats: () => BREAKS.filter((b) => b.sit),
  task: (w, text) => { let folder = ''; try { folder = localStorage.getItem('taskFolder') ?? ''; } catch {} go({ href: taskLink(w, text, folder), text: t('Opening a new Claude session with the task') }); } });
function canTask(w) { return onMac && w.kind !== 'session' && w.kind !== 'chum' && !!(w.staff || w.kind === 'role'); }
function walkAs(w) { if (!w) return; $('#studio').hidden = true; if (editor.on) $('#edit').click(); stopAuto(); fly = null; select(null); walk.enter(w); }
// personalising the character you walk as: look, size and name, saved with the design
function customise(patch) {
  const id = walk.id; if (!id) return; const d = JSON.parse(JSON.stringify(design)); d.agents[id] = { ...d.agents[id], ...patch }; setDesign(d); saveDesign();
  const a = d.agents[id]; 
}
const stepAvatar = (k) => { const cur = design.agents[walk.id]?.avatar ?? people.get(walk.id)?.avatar; customise({ avatar: AVATARS[(AVATARS.indexOf(cur) + k + AVATARS.length) % AVATARS.length] }); };
// the character studio: everything about how you look
const CLOTH = ['#f2efe8', '#1c1d22', '#2f4568', '#6d2f36', '#3f5a48', '#8a6a48', '#c9a24b', '#7d6a86', '#b5524a', '#4f7d8a'], HAIRS = ['#16120f', '#3b2418', '#6e4526', '#a87a45', '#d8b878', '#8c3f2c', '#8a8a8a', '#e6e2da'];
function studio() {
  const id = walk.id, a = design.agents[id] ?? {}, box = $('#studio'), w = all.find((x) => x.id === id);
  const row = (label, ...k) => { const d = el('div', 'srow'); d.append(el('span', '', label), ...k); return d; };
  const dots = (list, cur, fn) => { const d = el('div', 'sdots'); for (const c of list) { const b = el('button'); b.style.background = c; b.setAttribute('aria-label', t('Color {0}', c)); b.setAttribute('aria-pressed', String(cur === c)); b.onclick = () => fn(c); d.append(b); } const i = el('input'); i.type = 'color'; i.value = cur ?? list[0]; i.setAttribute('aria-label', t('Another color')); i.onchange = () => fn(i.value); d.append(i); return d; };
  const slide = (val, min, max, fn) => { const i = el('input'); i.type = 'range'; i.min = min; i.max = max; i.step = 0.01; i.value = val; i.onchange = () => fn(+i.value); return i; };
  const set = (o) => { customise(o); studio(); };
  const nm = el('input'); nm.type = 'text'; nm.maxLength = 40; nm.value = a.name ?? ''; nm.placeholder = w?.realName ?? w?.name ?? ''; nm.onchange = () => { set({ name: nm.value.trim() || undefined }); $('#walkName').textContent = t('You are {0}', nm.value.trim() || nm.placeholder); };
  const rtl = DIR === 'rtl', prev = el('button', '', rtl ? '▶' : '◀'), next = el('button', '', rtl ? '◀' : '▶'); prev.setAttribute('aria-label', t('Previous character')); next.setAttribute('aria-label', t('Next character')); prev.onclick = () => { stepAvatar(-1); studio(); }; next.onclick = () => { stepAvatar(1); studio(); };
  const cur = a.avatar ?? people.get(id)?.avatar, reset = el('button', 'wide', t('Reset character')); reset.onclick = () => { const d = JSON.parse(JSON.stringify(design)); delete d.agents[id]; setDesign(d); saveDesign(); studio(); };
  box.replaceChildren(el('h3', '', t('My character')), row(t('Name'), nm), row(t('Base'), prev, el('b', '', `${cur?.includes('Female') ? t('Woman') : t('Man')} ${AVATARS.indexOf(cur) + 1}/${AVATARS.length}`), next),
    row(t('Shirt'), dots(CLOTH, a.cloth, (c) => set({ cloth: c }))), row(t('Pants'), dots(CLOTH, a.pants, (c) => set({ pants: c }))), row(t('Hair'), dots(HAIRS, a.hair, (c) => set({ hair: c }))),
    row(t('Skin tone'), slide(a.tone ?? 1, 0.55, 1.25, (v) => set({ tone: Math.abs(v - 1) < 0.02 ? undefined : v }))), row(t('Height'), slide(a.tall ?? 1, 0.85, 1.15, (v) => set({ tall: v }))), row(t('Build'), slide(a.wide ?? 1, 0.85, 1.25, (v) => set({ wide: v }))), row(t('Overall size'), slide(a.size ?? 1, 0.7, 1.8, (v) => set({ size: v }))), reset);
}
$('#lookBtn').onclick = () => { const o = $('#studio').hidden; $('#studio').hidden = !o; $('#lookBtn').setAttribute('aria-expanded', String(o)); if (o) studio(); };
$('#walkBtn').onclick = () => walkAs(all.find((w) => w.roleId === 'ceo') ?? all[0]);

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
function pickAt(e) {
  const r = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ptr, camera);
  return ray.intersectObjects([...people.values()].filter((p) => !p.gone).map((p) => p.hit))[0]?.object.userData.id ?? null;
}
renderer.domElement.addEventListener('pointerdown', (e) => { if (editor.on) return; down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => { if (!editor.on && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const id = pickAt(e); select(id, !!id); if (!id && !walk.id) { const pt = floorAt(e), a = pt && areas().find((x) => Math.abs(pt.x - x.x) < x.w / 2 && Math.abs(pt.z - x.z) < x.d / 2); if (a && (viewRoom !== a.key || roomBoxOff === a.key)) { viewRoom = a.key; peek = true; roomBoxOff = null; if (raw) apply(raw); renderRooms(); renderRoomBox(); } } } });
renderer.domElement.addEventListener('dblclick', (e) => { if (editor.on || walk.id) return; const id = pickAt(e); if (id) openWorker(all.find((w) => w.id === id)); else { const pt = floorAt(e), a = pt && areas().find((x) => Math.abs(pt.x - x.x) < x.w / 2 && Math.abs(pt.z - x.z) < x.d / 2); if (a && (viewRoom !== a.key || peek)) viewArea(a); else if (pt) focusOn(pt, 0.55); } });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons || editor.on || walk.id) return; const id = pickAt(e); if (id === hovered) return;
  people.get(hovered)?.tag.element.classList.remove('hover'); hovered = id; people.get(id)?.tag.element.classList.add('hover');
  renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
});

// Quality follows the machine: too slow for a while steps down, plenty of headroom steps back up.
const LEVELS = [{ pr: 1.6, ao: true, sh: 2 }, { pr: 1.25, ao: true, sh: 3 }, { pr: 1, ao: true, sh: 4 }, { pr: 1, ao: false, sh: 6 }, { pr: 0.75, ao: false, sh: 10 }];
let level = 0, acc = 0, cnt = 0, frameNo = 0, upBlock = 0;
function setLevel(n) { level = n; const q = LEVELS[n], pr = Math.min(devicePixelRatio, q.pr); renderer.setPixelRatio(pr); composer.setPixelRatio(pr); gtao.enabled = q.ao; resize(); }
let gfx = 'auto'; try { gfx = localStorage.getItem('graphics') ?? 'auto'; } catch {}
function setGfx(v) { gfx = v; try { localStorage.setItem('graphics', v); } catch {} if (v !== 'auto') setLevel(v === 'high' ? 0 : LEVELS.length - 1); }
if (gfx !== 'auto') setGfx(gfx);
function quality(raw, now) { if (gfx !== 'auto') return;
  if (document.hidden || raw > 0.5) { acc = cnt = 0; return; } // a paused tab says nothing about speed
  acc += raw; if (++cnt < 90) return; const ms = acc / cnt * 1000; acc = cnt = 0;
  if (ms > 24 && level < LEVELS.length - 1) { setLevel(level + 1); upBlock = now + 60; } else if (ms < 11 && level > 0 && now > upBlock) { setLevel(level - 1); upBlock = now + 30; }
}
renderer.shadowMap.autoUpdate = false;
const clock = new THREE.Timer();
renderer.setAnimationLoop((ms) => {
  clock.update(ms); const dt = Math.min(clock.getDelta(), 0.1), t = clock.getElapsed(); quality(clock.getDelta(), t); if (frameNo++ % LEVELS[level].sh === 0) renderer.shadowMap.needsUpdate = true;
  const walker = walk.id ? people.get(walk.id)?.g.position : null;
  for (const [id, p] of people) { p.tick(dt, t, calm, id === walk.id ? null : walker); if (p.dead) { p.dispose(); people.delete(id); } }
  if (walk.id) { fly = null; prepareGrid(); walk.tick(dt); } else if (fly) { const k = 1 - Math.exp(-dt * 4); camera.position.lerp(fly.pos, k); controls.target.lerp(fly.target, k); if (camera.position.distanceTo(fly.pos) < 0.1) fly = null; }
  document.body.classList.toggle('far', !walk.id && camera.position.distanceTo(controls.target) > 44); world.tick(calm ? 0 : t); if (!walk.id) { moveCamera(dt); padTick(dt); tour(t); controls.update(); } composer.render(); labels.render(scene, camera); keepLabelsIn();
  editor.frame(); if (hovered && people.get(hovered)) people.get(hovered).tag.element.classList.add('hover');
});
setInterval(() => { if (selected) renderDetail(); }, 30_000);

const live = (ok, text) => { $('#conn').className = ok ? 'ok' : 'bad'; $('#conn').textContent = text; };
showItems(); world.setMood();
if (!demo) fetch('/api/layout').then((r) => r.json()).then(setDesign).catch(() => {}).finally(() => { loadedOnce = true; });
if (demo) { // ?demo: a made-up studio with made-up sessions, so the office can be tried (and photographed) without Claude running; nothing is saved
  live(false, t('Demo'));
  const office = OFFICE_TEMPLATES.find((o) => o.id === new URLSearchParams(location.search).get('office'));
  setCompany({ ...localizeCompany(COMPANY_TEMPLATES.find((x) => x.id === (office?.company ?? 'studio')).company), name: 'Acme' }); document.title = officeName();
  const now = Date.now(), MIN = 60000, proj = (label) => ({ key: '/demo/' + label, label });
  const S = (i, name, status, project, o = {}) => ({ id: 's:demo' + i, kind: 'session', name, status, project: proj(project), room: { key: 'dept:sessions', label: '' }, task: null, action: null, question: null, recap: null, need: null, model: 'claude', effort: 'medium',
    contextTokens: 40000 + i * 31000, branch: 'main', open: null, web: null, startedAt: now - (i + 2) * 47 * MIN, since: now - (i + 1) * 4 * MIN, lastAt: now - i * 9 * MIN, ...o });
  const base = () => [
    S(0, t('Restaurant site: menu and orders'), 'working', t('Restaurant site'), { task: t('Add a menu page with photos'), action: { kind: 'edit', text: 'Editing menu.tsx' }, recap: t('The homepage is done and checked on mobile. The menu page is in progress.') }),
    S(1, t('Shop launch campaign'), 'waiting', t('Online shop'), { recap: t('Three ad versions are ready as drafts. Nothing has been published.'), need: { kind: 'question', text: t('Which version should the campaign use?'), options: [t('The short one'), t('With the price'), t('With the video')] } }),
    S(2, t('Sign-up bug fix'), 'working', t('Ordering app'), { task: t('Users are not getting a verification code'), action: { kind: 'run', text: 'Running: ' + t('sign-up tests') }, recap: t('The bug is reproduced: the code is sent twice and the second cancels the first.') }),
    S(3, t('Homepage redesign'), 'idle', t('Company site'), { recap: t('Two sketches are ready. They are waiting for you to pick one.'), lastAt: now - 26 * 60 * MIN }),
    S(4, t('Server backup and update'), 'waiting', t('Infrastructure'), { recap: t('The nightly backup was checked and is fine. The security updates are ready to install.'), need: { kind: 'permission', text: 'Running: ' + t('install security updates on the server'), options: [] } }),
    S(5, t('Price quote for a new client'), 'idle', t('Sales'), { recap: t('The quote follows the price list and is saved as a draft. It has not been sent.'), lastAt: now - 3 * 60 * MIN }),
    S(6, t('Ordering app: payment screen'), 'working', t('Ordering app'), { task: t('Build the payment screen'), action: { kind: 'agent', text: 'Running agent: ' + t('Code review') }, contextTokens: 212000, recap: t('The summary screen is built. The payment screen is in review.') }),
    { id: 'a:demo1', parent: 's:demo6', kind: 'agent', type: 'general-purpose', name: t('General agent'), status: 'working', project: proj(t('Ordering app')), room: { key: 'dept:sessions', label: '' }, task: t('Code review'), action: { kind: 'read', text: 'Reading checkout.ts' }, startedAt: now - 2 * MIN, since: now - 2 * MIN, lastAt: now },
  ];
  let step = 0; const tick = () => { const l = base(); if (step % 2) Object.assign(l[3], { status: 'working', action: { kind: 'edit', text: 'Editing hero.css' }, since: Date.now() }); raw = l; apply(l); step++; };
  if (office) setDesign(officeDesign(office, COMPANY));
  tick(); setInterval(tick, 20000);
  // ?demo=waiting|meeting|editor|walk opens the demo on one of its scenes, for a quick look or a screenshot
  const scene = new URLSearchParams(location.search).get('demo'), click = (sel, text) => [...document.querySelectorAll(sel)].find((b) => !text || b.textContent.includes(text))?.click(); // text: the same key the label was made from, so it matches in any language
  setTimeout(() => {
    if (scene === 'waiting') select('s:demo1', true);
    else if (scene === 'meeting') { click('#rooms button[data-room="co:clients"]'); setTimeout(() => click('#rActs button', t('To meeting room')), 400); }
    else if (scene === 'editor') { click('#edit'); setTimeout(() => click('#editor .tabs button', t('Company')), 300); }
    else if (scene === 'welcome') showWelcome(startWith);
    else if (scene === 'walk') click('#walkBtn');
  }, 2500);
} else {
  // the user's own company comes from their machine; without one the office starts from the first built-in template
  await fetch('/api/company').then((r) => r.json()).then((c) => { started = c !== null; useCompany(c); if (c === null && onMac) showWelcome(startWith); }).catch(() => {});
  const es = new EventSource('/api/events');
  es.addEventListener('company', (e) => useCompany(JSON.parse(e.data)));
  let beat = Date.now();
  es.onmessage = (e) => { beat = Date.now(); live(true, t('Live')); raw = JSON.parse(e.data).workers; apply(raw); };
  es.addEventListener('layout', (e) => { const d = JSON.parse(e.data); if (editor.on || d.rev === design.rev) return; if ((d.scene?.plan ?? 'atrium') !== PLAN_ID) return location.reload(); setDesign(d); });
  es.addEventListener('beat', () => { beat = Date.now(); live(true, t('Live')); });
  setInterval(() => { if (Date.now() - beat > 8000) live(false, t('Disconnected, data is not updating')); }, 2000);
}
Object.assign(window, { __office: { controls, people, rooms, renderer, composer, camera, editor, get level() { return level; }, get walk() { return walk; }, fly: (pos, target) => { fly = { pos, target }; }, get design() { return design; }, feed: (list) => { raw = list; apply(list); } } }); // feed: show a hand-made state, for checking a view that the live data does not have right now
{ const h = document.querySelector('header'), fit = () => document.documentElement.style.setProperty('--hw', h.offsetWidth + 'px') ?? document.documentElement.style.setProperty('--hh', h.offsetHeight + 'px'); fit(); new ResizeObserver(fit).observe(h); addEventListener('resize', fit); }
