import * as THREE from 'three';
import { SLOTS, PLAN, PLAN_ID } from './nav.js';
import { PLANS } from './plans.js';
import { AVATARS } from './people.js';
import { DEPTS, ROLES, COMPANY } from './company.js';
import { COMPANY_TEMPLATES, localizeCompany } from './company.templates.js';
import { OFFICE_TEMPLATES, officeDesign } from './office.templates.js';
import { OUTSIDE } from './city.js';
import { TEMPLATES } from './templates.js';
import { buildRoom } from './world.js';
import { CATALOG, createItem } from './items.js';
import { t, LOCALE } from './i18n.js';

export const DEFAULT_ITEMS = PLAN.plants.map((it, i) => ({ ...it, id: 'p' + i }));
const $ = (s) => document.querySelector(s);
const el = (tag, o = {}, ...kids) => { const e = Object.assign(document.createElement(tag), o); e.append(...kids); return e; };
const SWATCH = ['#f2ece1', '#c9bfae', '#8f8a82', '#3a3536', '#6b4128', '#b5765a', '#c9a24b', '#7f9184', '#2f4a45', '#5c6f8f', '#31405c', '#7d6a86', '#a8485a'];
/** Whole-office looks: wall/rug colour per room, light and floor. */
const THEMES = { 'Scandinavian': { c: ['#7f9184', '#c9bfae', '#8ea0a8', '#b7a58a', '#9aa58b'], floor: 'wood', mood: 'day' }, 'Warm classic': { c: ['#8a5a3c', '#a0764e', '#6f5a44', '#94694a', '#7a4f3c'], floor: 'wood', mood: 'sunset' }, 'Dark modern': { c: ['#2f3b45', '#3a3f4a', '#26343a', '#443b4a', '#34404a'], floor: 'carpet', mood: 'night' }, 'Colorful': { c: ['#c96f4a', '#3f8f86', '#5b6fb5', '#c79a3a', '#8f5a8a'], floor: 'carpet', mood: 'day' }, 'Mediterranean': { c: ['#3f7f94', '#d8b98a', '#6ba0a5', '#c98d66', '#e0d2b8'], floor: 'stone', mood: 'day' }, 'Nature green': { c: ['#4f6f52', '#6f8a5c', '#8a9a6a', '#5f7f76', '#3f5a48'], floor: 'wood', mood: 'day' } };
const clone = (o) => JSON.parse(JSON.stringify(o));

let companyTimer = null, companyDept = null, mine = null; // mine: the user's saved templates, loaded when the company tab first opens // the department open in the company tab
export function createEditor(ctx) {
  const { scene, camera, renderer, controls, itemMeshes, rooms, people } = ctx, box = $('#editor'), dom = renderer.domElement;
  let on = false, tab = 'items', sel = null, drag = null, timer = null, undo = [], redo = [], saveText = '';
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: '#c9a6ff', transparent: true, depthTest: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 9; ring.visible = false; scene.add(ring);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), v = new THREE.Vector2();
  const cast = (e) => { const r = dom.getBoundingClientRect(); v.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(v, camera); };
  const floor = (e) => { cast(e); return ray.ray.intersectPlane(plane, new THREE.Vector3()); };
  const snap = (n) => Math.round(n * 4) / 4, clamp = (n, m) => Math.max(-m, Math.min(m, n));
  const items = (d) => (d.items ??= clone(DEFAULT_ITEMS));
  const item = () => sel?.kind === 'item' ? (ctx.getDesign().items ?? DEFAULT_ITEMS).find((i) => i.id === sel.id) : null;

  function queueSave() {
    if (!ctx.save) { status(t('Demo, not saved')); return; }
    status(t('Saving…')); clearTimeout(timer);
    timer = setTimeout(async () => { try { const sent = clone(ctx.getDesign()); const r = await ctx.save(sent); ctx.getDesign().rev = r.rev; status(t('Saved')); } catch { status(t('Save failed')); } }, 500);
  }
  const status = (txt) => { saveText = txt; const s = $('#saveState'); if (s) s.textContent = txt; };
  /** Applies one change; changes sharing a tag within a drag or slider move become one undo step. */
  let lastTag = null, lastT = 0;
  function change(fn, tag = null, redraw = true) {
    const d = clone(ctx.getDesign()), now = Date.now();
    if (!tag || tag !== lastTag || now - lastT > 1200) { undo.push(clone(d)); if (undo.length > 60) undo.shift(); redo = []; }
    lastTag = tag; lastT = now; fn(d); ctx.setDesign(d); queueSave(); mark(); if (redraw) draw();
  }
  function step(from, to) { if (!from.length) return; to.push(clone(ctx.getDesign())); lastTag = null; ctx.setDesign(from.pop()); if (sel?.kind === 'item' && !item()) sel = null; queueSave(); mark(); draw(); }
  const mod = (fn, tag, redraw) => change((d) => { const i = items(d).find((x) => x.id === sel.id); if (i) fn(i); }, tag, redraw);
  const remove = () => { const id = sel.id; sel = null; change((d) => { d.items = items(d).filter((i) => i.id !== id); }); };
  const add = (o) => { const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); sel = { kind: 'item', id }; change((d) => items(d).push({ ry: 0, s: 1, ...o, id, x: clamp(snap(o.x), 35), z: clamp(snap(o.z), 25) })); };
  function mark() {
    const i = item(), m = i && itemMeshes.get(i.id), p = sel?.kind === 'agent' && people.get(sel.id), r = sel?.kind === 'room' && rooms.get(sel.id);
    ring.visible = on && !!(m || p || r); if (!ring.visible) return;
    if (m) { const b = new THREE.Box3().setFromObject(m.group), s = b.getSize(new THREE.Vector3()); ring.position.set(i.x, 0.12, i.z); ring.scale.setScalar(Math.max(s.x, s.z) / 2 + 0.25); }
    else if (p) { ring.position.set(p.g.position.x, 0.12, p.g.position.z); ring.scale.setScalar(1.1); }
    else { ring.position.set(SLOTS[r.slot].x, 0.12, SLOTS[r.slot].z); ring.scale.setScalar(Math.min(SLOTS[r.slot].w, SLOTS[r.slot].d) / 2 - 0.4); }
  }
  function pick(sl) { sel = sl; if (sl) tab = { item: 'items', room: 'rooms', agent: 'agents' }[sl.kind]; mark(); draw(); }

  const color = (text, val, fn) => { const i = el('input', { type: 'color', value: val ?? '#8a5cff' }); i.setAttribute('aria-label', text); i.oninput = () => fn(i.value); return el('label', {}, text, i); };
  const range = (text, val, min, max, st, fn) => { const i = el('input', { type: 'range', min, max, step: st, value: val }); i.oninput = () => fn(+i.value); return el('label', {}, text, i); };
  const field = (text, val, ph, fn, max = 40) => { const i = el('input', { type: 'text', value: val ?? '', placeholder: ph ?? '', maxLength: max }); i.oninput = () => fn(i.value); return el('label', {}, text, i); };
  const choose = (text, val, opts, fn) => { const s = el('select'); for (const [k, name] of opts) s.append(el('option', { value: k, textContent: name, selected: String(k) === String(val) })); s.onchange = () => fn(s.value); return el('label', {}, text, s); };
  const swatches = (fn, list = SWATCH) => el('div', { className: 'sw' }, ...list.map((c) => { const b = el('button', { title: c }); b.style.background = c; b.setAttribute('aria-label', t('Color {0}', c)); b.onclick = () => fn(c); return b; }));
  // catalogue pictures are rendered once, from the real models
  let thumbs = null;
  function thumbnails() {
    if (thumbs) return thumbs; thumbs = {};
    const rd = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); rd.setSize(120, 96); rd.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff', '#a89680', 2.2)); const l = new THREE.DirectionalLight('#fff', 2.4); l.position.set(2, 5, 4); sc.add(l); const cm = new THREE.PerspectiveCamera(28, 1.25, 0.1, 60);
    for (const type of Object.keys(CATALOG)) { const it = createItem(sc, { id: 't', type }), b = new THREE.Box3().setFromObject(it.group), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length(); cm.position.copy(c).add(new THREE.Vector3(0.55, 0.5, 1).normalize().multiplyScalar(s * 1.75)); cm.lookAt(c); rd.render(sc, cm); thumbs[type] = rd.domElement.toDataURL(); it.dispose(); }
    rd.dispose(); rd.forceContextLoss(); return thumbs;
  }
  // room templates are pictured the same way, one per frame so the editor opens at once
  const roomPics = {}; let picJob = null;
  function roomPictures() {
    if (picJob) return; const todo = Object.keys(TEMPLATES).filter((k) => !roomPics[k]); if (!todo.length) return;
    const rd = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); rd.setSize(260, 160); rd.setClearColor('#d9d4cc'); rd.toneMapping = THREE.ACESFilmicToneMapping; rd.shadowMap.enabled = true;
    const sc = new THREE.Scene(); sc.environment = scene.environment; sc.environmentIntensity = 0.4; sc.add(new THREE.HemisphereLight('#fff', '#b59a7c', 0.9)); const l = new THREE.DirectionalLight('#fff1dc', 2.2); l.position.set(6, 16, 10); l.castShadow = true; Object.assign(l.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); l.shadow.mapSize.set(1024, 1024); const s = SLOTS[3]; l.position.add(new THREE.Vector3(s.x, 0, s.z)); l.target.position.set(s.x, 0, s.z); sc.add(l, l.target);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#cfae86', roughness: 0.7 })); fl.rotation.x = -Math.PI / 2; fl.position.set(s.x, -0.01, s.z); fl.receiveShadow = true; sc.add(fl);
    const cm = new THREE.PerspectiveCamera(32, 260 / 160, 0.5, 80); cm.position.set(s.x + 1.5, 9.5, s.z + 18.5); cm.lookAt(s.x, 1.2, s.z - 0.6);
    const next = () => { const k = todo.shift(); if (!k) { rd.dispose(); rd.forceContextLoss(); picJob = null; return; } const room = buildRoom(sc, 3, { label: TEMPLATES[k].name }, 4, { style: k }); rd.render(sc, cm); roomPics[k] = rd.domElement.toDataURL('image/jpeg', 0.85); room.dispose(); for (const i of document.querySelectorAll(`img[data-tpl="${k}"]`)) i.src = roomPics[k]; picJob = requestAnimationFrame(next); };
    picJob = requestAnimationFrame(next);
  }
  function tplGrid(current, fn) {
    roomPictures(); const card = (k, name) => { const i = el('img', { alt: '' }); if (k) { i.dataset.tpl = k; if (roomPics[k]) i.src = roomPics[k]; } const b = el('button', {}, ...(k ? [i] : []), name); b.setAttribute('aria-pressed', String((current ?? '') === k)); b.onclick = () => fn(k || undefined); return b; };
    return el('div', { className: 'tpls' }, card('', t('Plain')), ...Object.entries(TEMPLATES).map(([k, tpl]) => card(k, t(tpl.name))));
  }
  /** Tap adds in front of the camera; dragging drops the item exactly where it is released. */
  function catButton(type, text) {
    const img = el('img', { src: thumbnails()[type], alt: '' }), b = el('button', { title: t('Click to add, drag to place') }, img, text); let start = null, ghost = null;
    b.addEventListener('pointerdown', (e) => { if (e.button) return; start = [e.clientX, e.clientY]; b.setPointerCapture(e.pointerId); });
    b.addEventListener('pointermove', (e) => { if (!start) return; if (!ghost && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 8) { ghost = el('img', { src: thumbnails()[type], className: 'ghost', alt: '' }); document.body.append(ghost); } if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; } });
    const end = (e) => { if (!start) return; start = null; if (ghost) { ghost.remove(); ghost = null; b.dataset.skip = '1'; const over = document.elementFromPoint(e.clientX, e.clientY); if (e.type === 'pointerup' && over === dom) { const p = floor(e); if (p) add({ type, x: p.x, z: p.z }); } } };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    b.onclick = () => { if (b.dataset.skip) { delete b.dataset.skip; return; } const tg = controls.target; add({ type, x: tg.x, z: tg.z }); };
    return b;
  }
  const bar = $('#float');
  bar.append(...[['↺', 'Rotate left', () => mod((i) => { i.ry += Math.PI / 12; }, 'fr')], ['↻', 'Rotate right', () => mod((i) => { i.ry -= Math.PI / 12; }, 'fr')], ['−', 'Smaller', () => mod((i) => { i.s = Math.max(0.4, i.s - 0.1); }, 'fs')], ['+', 'Larger', () => mod((i) => { i.s = Math.min(2.5, i.s + 0.1); }, 'fs')], ['⧉', 'Duplicate', () => add({ ...item(), x: item().x + 1.5 })], ['🗑', 'Delete', () => remove()]].map(([ch, n, fn]) => { const b = el('button', { textContent: ch, title: t(n), className: n === 'Delete' ? 'del' : '' }); b.setAttribute('aria-label', t(n)); b.onclick = () => item() && fn(); return b; }));
  const top = new THREE.Vector3();
  function frame() { // keeps the toolbar above the selected item
    const i = on && !drag ? item() : null, m = i && itemMeshes.get(i.id); if (!m) { if (!bar.hidden) bar.hidden = true; return; }
    top.set(i.x, 2.6 * i.s, i.z).project(camera); const R = dom.getBoundingClientRect(); bar.hidden = top.z > 1; bar.style.left = Math.max(130, Math.min(R.width - 130, (top.x + 1) / 2 * R.width)) + 'px'; bar.style.top = Math.max(60, (1 - top.y) / 2 * R.height - 10) + 'px';
  }
  const btn = (text, fn, o = {}) => { const b = el('button', { textContent: text, ...o }); b.onclick = fn; return b; };
  const staff = () => ctx.getWorkers().filter((w) => w.staff || w.kind !== 'agent').sort((a, b) => a.room.label.localeCompare(b.room.label, LOCALE) || (b.lead ? 1 : 0) - (a.lead ? 1 : 0));
  const patch = (group, id, o, tag, redraw = false) => change((d) => { d[group][id] = { ...d[group][id], ...o }; for (const k of Object.keys(d[group][id])) if (d[group][id][k] === '' || d[group][id][k] === undefined) delete d[group][id][k]; }, tag, redraw);

  const draft = { name: '', dept: 'sales', brief: '', lead: false };
  function newRole() {
    const name = field(t('Name'), draft.name, t('For example: Site manager'), (v) => { draft.name = v; }), brief = field(t('Description'), draft.brief, t('What the role does'), (v) => { draft.brief = v; }, 200), lead = el('input', { type: 'checkbox', checked: draft.lead }); lead.onchange = () => { draft.lead = lead.checked; };
    return [el('h3', { textContent: t('Add a role to the team') }), name, choose(t('Department'), draft.dept, Object.entries(DEPTS).map(([k, d]) => [k, t(d.label)]), (v) => { draft.dept = v; }), brief, el('label', {}, t('Manager or team lead'), lead),
      el('div', { className: 'act' }, btn(t('Add'), () => { const name = draft.name.trim(); if (!name) { ctx.toast(t('The role needs a name')); return; } const id = 'c' + Date.now().toString(36); change((d) => { (d.custom ??= []).push({ id, name, dept: draft.dept, brief: draft.brief.trim() || undefined, lead: draft.lead }); }); Object.assign(draft, { name: '', brief: '' }); pick({ kind: 'agent', id: 'o:' + id }); }))];
  }
  const TABS = {
    items() {
      const i = item(), out = [];
      if (i) {
        out.push(el('h3', { textContent: t(CATALOG[i.type]) }), swatches((c) => mod((x) => { x.color = c; })), color(t('Other color'), i.color, (c) => mod((x) => { x.color = c; }, 'col', false)), range(t('Size'), i.s, 0.4, 2.5, 0.05, (s) => mod((x) => { x.s = s; }, 'size', false)), range(t('Rotation'), ((i.ry % 6.283) + 6.283) % 6.283, 0, 6.28, 0.01, (r) => mod((x) => { x.ry = r; }, 'rot', false)));
        if (i.type === 'sign') out.push(field(t('Text'), i.text, t('Company name'), (v) => mod((x) => { x.text = v || undefined; }, 'text', false), 24));
        out.push(el('div', { className: 'act' }, btn(t('Rotate 45°'), () => mod((x) => { x.ry += Math.PI / 4; })), btn(t('Duplicate'), () => add({ ...i, x: i.x + 1.5 })), btn(t('Delete'), remove)));
      } else out.push(el('p', { textContent: t('Drag an item from the catalog onto the floor. Click an item to select it, drag to move it, Shift + scroll wheel to rotate it. Click a room or an agent to open its design. The built-in furniture is fixed.') }));
      out.push(el('h3', { textContent: t('Add') }), el('div', { className: 'cat' }, ...Object.entries(CATALOG).map(([k, name]) => catButton(k, t(name)))));
      return out;
    },
    rooms() {
      const list = [...rooms].map(([k, r]) => [k, r.label]); if (sel?.kind !== 'room' || !rooms.has(sel.id)) sel = list[0] ? { kind: 'room', id: list[0][0] } : null; mark(); if (!sel) return [el('p', { textContent: t('No rooms') })];
      const k = sel.id, r = rooms.get(k), o = ctx.getDesign().rooms[k] ?? {};
      return [choose(t('Room'), k, list, (id) => pick({ kind: 'room', id })), field(t('Name'), o.name, r.label, (v) => patch('rooms', k, { name: v.trim() }, 'rn' + k)), el('h3', { textContent: t('Room template') }), tplGrid(o.style === 'plain' ? '' : o.style ?? DEPTS[k.slice(3)]?.style, (st) => change((d) => { d.rooms[k] = { ...d.rooms[k], style: st ?? 'plain' }; delete d.rooms[k].accent; delete d.rooms[k].floor; })), el('div', { className: 'act' }, btn(t('Apply to all rooms'), () => change((d) => { for (const key of rooms.keys()) { d.rooms[key] = { ...d.rooms[key], style: o.style ?? DEPTS[k.slice(3)]?.style ?? 'plain' }; delete d.rooms[key].accent; delete d.rooms[key].floor; } })), btn(t('Shuffle'), () => change((d) => { const l = Object.keys(TEMPLATES).sort(() => Math.random() - 0.5); [...rooms.keys()].forEach((key, n) => { d.rooms[key] = { ...d.rooms[key], style: l[n % l.length] }; delete d.rooms[key].accent; delete d.rooms[key].floor; }); })), btn(t('Show the room'), () => { const r0 = rooms.get(k); ctx.moveTo({ key: k, ...SLOTS[r0.slot] }); })), el('h3', { textContent: t('Wall and rug color') }), swatches((c) => patch('rooms', k, { accent: c }, null, true)), color(t('Other color'), o.accent, (c) => patch('rooms', k, { accent: c }, 'rc' + k)),
        choose(t('Floor'), o.floor ?? TEMPLATES[o.style ?? DEPTS[k.slice(3)]?.style]?.floor ?? 'wood', [['wood', t('Wood and rug')], ['carpet', t('Wall-to-wall carpet')], ['stone', t('Light stone')]], (f) => patch('rooms', k, { floor: f })),
        choose(t('Location'), r.slot, SLOTS.map(({ name }, i) => { const other = [...rooms].find(([, x]) => x.slot === i); return [i, other ? `${t(name)} (${other[1].label})` : t('{0} (free)', t(name))]; }), (s) => change((d) => {
          const to = +s, from = r.slot; for (const [key, x] of rooms) d.rooms[key] = { ...d.rooms[key], slot: key === k ? to : x.slot === to ? from : x.slot };
        })), el('p', { textContent: t('Moving to a taken location swaps the two rooms.') }), el('div', { className: 'act' }, btn(t('Reset room'), () => change((d) => { const slot = d.rooms[k]?.slot; d.rooms[k] = slot == null ? {} : { slot }; })))];
    },
    agents() {
      const list = staff(); if (sel?.kind !== 'agent' || !list.some((w) => w.id === sel.id)) sel = list[0] ? { kind: 'agent', id: list[0].id } : null; mark(); if (!sel) return [el('p', { textContent: t('No agents') })];
      const w = list.find((x) => x.id === sel.id), o = ctx.getDesign().agents[w.id] ?? {}, set = (x, tag) => patch('agents', w.id, x, tag);
      const homes = new Map(ctx.getWorkers().filter((x) => x.homeRoom).map((x) => [x.homeRoom.key, ctx.getDesign().rooms[x.homeRoom.key]?.name ?? x.homeRoom.label]));
      return [choose(t('Agent'), w.id, list.map((x) => [x.id, `${x.room.label}: ${x.name}`]), (id) => pick({ kind: 'agent', id })), range(t('Agent size'), o.size ?? 1, 0.7, 1.8, 0.05, (s) => set({ size: s === 1 ? undefined : s }, 'az' + w.id)), field(t('Display name'), o.name, w.realName ?? w.name, (v) => set({ name: v.trim() }, 'an' + w.id)),
        choose(t('Room'), o.room ?? w.homeRoom.key, [...homes], (r) => set({ room: r === w.homeRoom.key ? undefined : r })), choose(t('Avatar'), o.avatar ?? '', [['', t('Automatic')], ...AVATARS.map((a, i) => [a, `${a.includes('Female') ? t('Woman') : t('Man')} ${i + 1}, ${a.startsWith('Business') ? t('business') : t('casual')}`])], (a) => set({ avatar: a })),
        el('div', { className: 'act' }, btn(t('Reset agent'), () => change((d) => { delete d.agents[w.id]; })), ...(w.custom ? [btn(t('Delete role'), () => { sel = null; change((d) => { d.custom = (d.custom ?? []).filter((c) => 'o:' + c.id !== w.id); }); })] : [])), ...newRole()];
    },
    company() { // who the company is: a ready-made structure to start from, and the rules that give every session a lead
      sel = null; mark();
      const c = COMPANY, leads = ROLES.filter((r) => r.lead).map((r) => [r.id, `${r.name} · ${t(DEPTS[r.dept]?.label ?? '')}`]), rules = (c.rules ?? []).map((r) => [...r]);
      const put = (next, redraw = true) => ctx.saveCompany(next).then((ok) => { if (ok && redraw) draw(); });
      const later = (fn) => { clearTimeout(companyTimer); companyTimer = setTimeout(fn, 500); }, setRules = (redraw) => put({ ...c, rules }, redraw);
      const words = (src) => src.split('|').join(', '), source = (text) => text.split(',').map((w) => w.trim()).filter(Boolean).join('|');
      const ruleRow = (r, i) => {
        const inp = el('input', { type: 'text', value: words(r[1]), maxLength: 300 }); inp.setAttribute('aria-label', t('Words in the session or project name')); inp.dir = 'auto';
        inp.oninput = () => later(() => { const v = source(inp.value); if (v) { r[1] = v; setRules(false); } });
        const s = el('select'); s.setAttribute('aria-label', t('Team lead in charge')); for (const [k, name] of leads) s.append(el('option', { value: k, textContent: name, selected: k === r[0] })); s.onchange = () => { r[0] = s.value; setRules(false); };
        const up = btn('▲', () => { if (i) { [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]]; setRules(true); } }), del = btn('✕', () => { rules.splice(i, 1); setRules(true); });
        up.setAttribute('aria-label', t('Move rule up')); del.setAttribute('aria-label', t('Delete rule')); up.disabled = !i;
        return el('div', { className: 'rule' }, inp, s, up, del);
      };
      // departments and the people in them: rename, add, remove, and say which of your Claude agents fills a role
      const keys = Object.keys(c.depts); if (!c.depts[companyDept]) companyDept = keys[0]; const dk = companyDept, dp = c.depts[dk], inDept = c.roles.filter((r) => r.dept === dk);
      const roleSet = (id, o, redraw = false) => put({ ...c, roles: c.roles.map((r) => (r.id === id ? { ...r, ...o } : r)) }, redraw), uid = (p) => p + Date.now().toString(36);
      const taken = new Map(c.roles.filter((r) => r.agent).map((r) => [r.agent, r])), agents = ctx.agentTypes();
      const roleBox = (r) => {
        const free = agents.filter(([a]) => !taken.has(a) || taken.get(a).id === r.id), gone = r.agent && !agents.some(([a]) => a === r.agent);
        const lead = el('input', { type: 'checkbox', checked: !!r.lead }); lead.onchange = () => roleSet(r.id, { lead: lead.checked }, true);
        const del = btn(t('Delete role'), () => { if (confirm(t('Delete the role "{0}"?', r.name))) put({ ...c, roles: c.roles.filter((x) => x.id !== r.id), rules: (c.rules ?? []).filter((x) => x[0] !== r.id) }); });
        del.disabled = inDept.length < 2 || (r.lead && c.roles.filter((x) => x.lead).length < 2);
        return el('div', { className: 'rolebox' }, field(t('Role'), r.name, '', (v) => { if (v.trim()) later(() => roleSet(r.id, { name: v.trim() })); }),
          choose(t('Claude agent'), r.agent ?? '', [['', t('No agent')], ...(gone ? [[r.agent, t('{0} (not found on this machine)', r.agent)]] : []), ...free.map(([a, n]) => [a, n === a ? a : `${n} (${a})`])], (v) => roleSet(r.id, { agent: v || undefined }, true)),
          el('label', {}, t('Team lead'), lead), el('div', { className: 'act' }, del));
      };
      const newDept = el('input', { type: 'text', placeholder: t('New department name'), maxLength: 40 }); newDept.setAttribute('aria-label', t('New department name'));
      const addDept = () => {
        const name = newDept.value.trim(), used = new Set(Object.values(c.depts).map((d) => d.slot)), slot = SLOTS.findIndex((_, i) => !used.has(i));
        if (!name) { ctx.toast(t('The department needs a name')); newDept.focus(); return; } if (slot < 0) { ctx.toast(t('All rooms are taken, delete a department first')); return; }
        const id = uid('d'); companyDept = id; put({ ...c, depts: { ...c.depts, [id]: { label: name, slot } }, roles: [...c.roles, { id: uid('r'), name: t('{0} lead', name), dept: id, lead: true }] });
      };
      const dropDept = () => { if (!confirm(t('Delete the department "{0}" and its {1} roles? You can go back to the previous company.', t(dp.label), inDept.length))) return;
        const ids = new Set(inDept.map((r) => r.id)), depts = { ...c.depts }; delete depts[dk]; companyDept = null;
        put({ ...c, depts, roles: c.roles.filter((r) => r.dept !== dk), rules: (c.rules ?? []).filter((x) => !ids.has(x[0])) }); };
      const dropBtn = btn(t('Delete department'), dropDept); dropBtn.disabled = keys.length < 2 || !c.roles.some((r) => r.lead && r.dept !== dk);
      const deptPart = [el('h3', { textContent: t('Departments and roles') }), choose(t('Department'), dk, keys.map((k) => [k, t(c.depts[k].label)]), (v) => { companyDept = v; draw(); }),
        field(t('Department name'), dp.label, '', (v) => { if (v.trim()) later(() => put({ ...c, depts: { ...c.depts, [dk]: { ...dp, label: v.trim() } } }, false)); }),
        ...inDept.map(roleBox), el('div', { className: 'act' }, btn(t('Add role'), () => put({ ...c, roles: [...c.roles, { id: uid('r'), name: t('New role'), dept: dk }] })), dropBtn),
        el('div', { className: 'rule' }, newDept, btn(t('Add department'), addDept))];
      // my templates: the whole office (company and design) saved under a name, on this machine
      const reload = () => ctx.myTemplates.list().then((l) => { mine = l; if (on && tab === 'company') draw(); }); if (mine === null) { mine = []; reload(); }
      const tname = el('input', { type: 'text', placeholder: t('Template name'), maxLength: 40 }); tname.setAttribute('aria-label', t('New template name'));
      const saveMine = () => { const n = tname.value.trim(); if (!n) { ctx.toast(t('The template needs a name')); tname.focus(); return; } ctx.myTemplates.save(n).then(() => { ctx.toast(t('Template "{0}" saved', n)); reload(); }, (e) => ctx.toast(t('Template not saved: {0}', e.message))); };
      const applyMine = async (m) => {
        if (!confirm(t('Replace the company and the design with the template "{0}"? You can go back to the previous company, and the design can be reverted with the Undo button.', m.name))) return;
        const saved = await ctx.myTemplates.get(m.id); if (!saved) { ctx.toast(t('Template not found')); reload(); return; }
        if (await ctx.saveCompany(saved.company)) { change((d) => { for (const k of ['items', 'rooms', 'agents', 'custom', 'scene']) d[k] = saved.layout[k]; }); ctx.toast(t('Template "{0}" applied', m.name)); }
      };
      const minePart = [el('h3', { textContent: t('My templates') }), el('p', { textContent: t('Saves the company and the whole design as they are now, so you can come back to them later.') }), el('div', { className: 'rule' }, tname, btn(t('Save as template'), saveMine)),
        ...(mine ?? []).map((m) => { const del = btn('✕', () => { if (confirm(t('Delete the template "{0}"?', m.name))) ctx.myTemplates.remove(m.id).then(reload); }); del.setAttribute('aria-label', t('Delete template {0}', m.name));
          const go = el('button', {}, el('b', { textContent: m.name }), el('small', { textContent: t('{0} rooms · {1} roles · {2}', m.rooms, m.roles, new Date(m.at).toLocaleDateString(LOCALE)) })); go.onclick = () => applyMine(m); return el('div', { className: 'mytpl' }, go, del); })];
      const useOffice = async (tpl) => {
        if (!confirm(t('Replace the company and the whole design with "{0}"? The company name is kept, and the office you have now is saved first under My templates.', t(tpl.name)))) return;
        try { await ctx.myTemplates.save(t('Before {0}', t(tpl.name)).slice(0, 40)); } catch (e) { if (!ctx.demo) { ctx.toast(t('Nothing was changed: the current office could not be saved first')); return; } }
        const co = localizeCompany(COMPANY_TEMPLATES.find((x) => x.id === tpl.company).company);
        if (await ctx.saveCompany({ ...co, name: c.name, prompt: c.prompt ?? co.prompt, projects: c.projects, agents: c.agents })) { const look = officeDesign(tpl, co); change((d) => Object.assign(d, look)); ctx.toast(t('Template "{0}" applied', t(tpl.name))); }
      };
      const officePart = [el('h3', { textContent: t('Complete office') }), el('p', { textContent: t('One choice sets everything: the company, the look of every room, the furniture, the light and what is outside.') }),
        el('div', { className: 'ctpl' }, ...OFFICE_TEMPLATES.map((tpl) => { const b = el('button', {}, el('b', { textContent: t(tpl.name) }), el('small', { textContent: t(tpl.about) })); b.onclick = () => useOffice(tpl); return b; }))];
      const use = (tpl) => { if (confirm(t('Replace the departments, roles and rules with the template "{0}"? The name and the design are kept, and you can go back to the previous company.', t(tpl.name)))) { const co = localizeCompany(tpl.company); put({ ...co, name: c.name, prompt: c.prompt ?? co.prompt, projects: c.projects, agents: c.agents }); } };
      return [el('h3', { textContent: t('Company name') }), field(t('Name'), c.name, t('Shown in the header and on the sign'), (v) => later(() => put({ ...c, name: v.trim() || null }, false)), 40),
        ...officePart, el('h3', { textContent: t('Company template') }), el('p', { textContent: t('A template sets which departments exist, who leads each one, and where each session goes.') }),
        el('div', { className: 'ctpl' }, ...COMPANY_TEMPLATES.map((tpl) => { const b = el('button', {}, el('b', { textContent: t(tpl.name) }), el('small', { textContent: t('{0} rooms · {1}', Object.keys(tpl.company.depts).length, t(tpl.about)) })); b.onclick = () => use(tpl); return b; })),
        ...(ctx.prevCompany ? [el('div', { className: 'act' }, btn(t('Back to the previous company'), () => put(ctx.prevCompany)))] : []),
        ...minePart,
        ...deptPart,
        el('h3', { textContent: t('Who leads each session') }), el('p', { textContent: t('A session whose name, or project name, contains one of the words goes to the chosen team lead. The first matching rule wins. Separate words with commas.') }),
        ...rules.map(ruleRow), el('div', { className: 'act' }, btn(t('Add rule'), () => { rules.push([c.fallback, t('word'), 'i']); setRules(true); })),
        choose(t('When no rule matches'), c.fallback, leads, (v) => put({ ...c, fallback: v }, false)),
        el('p', { textContent: t('The name, location and template of each room are changed in the "Rooms" tab. The company is saved only on this machine.') })];
    },
    scene() {
      const o = ctx.getDesign().scene, set = (x, tag) => change((d) => { d.scene = { ...d.scene, ...x }; }, tag, false); sel = null; mark();
      return [el('h3', { textContent: t('Style for the whole office') }), el('div', { className: 'themes' }, ...Object.entries(THEMES).map(([n, th]) => { const i = el('i', {}, ...th.c.map((c) => { const b = el('b'); b.style.background = c; return b; })), b = el('button', {}, i, t(n)); b.onclick = () => change((d) => { [...rooms.keys()].forEach((k, x) => { d.rooms[k] = { ...d.rooms[k], accent: th.c[x % th.c.length], floor: th.floor }; }); d.scene = { ...d.scene, mood: th.mood }; }); return b; })), el('h3', { textContent: t('Building') }), choose(t('Floor plan'), PLAN_ID, Object.entries(PLANS).map(([k, p]) => [k, t(p.name)]), (v) => { if (confirm(t('Move to another building? Rooms go back to their default places and loose furniture is removed.'))) change((d) => { d.items = null; for (const x of Object.values(d.rooms)) delete x.slot; d.scene = { ...d.scene, plan: v }; }); else draw(); }), el('p', { textContent: t(PLAN.about) }), el('h3', { textContent: t('Outside') }), choose(t('Outside'), o.outside ?? 'city', Object.entries(OUTSIDE).map(([k, p]) => [k, t(p.name)]), (v) => set({ outside: v })), el('h3', { textContent: t('Size of all agents') }), range(t('Size'), o.people ?? 1, 0.7, 1.6, 0.05, (v) => set({ people: v }, 'pp')), el('h3', { textContent: t('Light') }), choose(t('Time of day'), o.mood ?? 'day', [['day', t('Day')], ['sunset', t('Sunset')], ['night', t('Night')]], (m) => set({ mood: m })), range(t('Light intensity'), o.light ?? 1, 0.5, 2, 0.05, (l) => set({ light: l }, 'li')), range(t('Glow'), o.glow ?? 0.12, 0, 1, 0.02, (g) => set({ glow: g }, 'gl')),
        el('div', { className: 'act' }, btn(t('Reset the whole design'), () => { if (confirm(t('Reset the whole design? You can undo right after.'))) change((d) => { Object.assign(d, { items: null, rooms: {}, agents: {}, scene: {}, custom: [], assign: {} }); }); }))];
    },
  };
  function draw() {
    if (!on) return;
    const body = TABS[tab](); // may settle the selection first
    const tabs = el('div', { className: 'tabs' }, ...[['items', t('Items')], ['rooms', t('Rooms')], ['agents', t('Agents')], ['company', t('Company')], ['scene', t('Atmosphere')]].map(([k, name]) => { const b = btn(name, () => { tab = k; sel = null; mark(); draw(); }); b.setAttribute('aria-pressed', String(k === tab)); return b; }));
    box.replaceChildren(el('h2', { textContent: t('Design the office') }), tabs, ...body, el('h3', { textContent: t('Editing') }),
      el('div', { className: 'act' }, btn(t('Undo'), () => step(undo, redo), { disabled: !undo.length }), btn(t('Redo'), () => step(redo, undo), { disabled: !redo.length }), btn(t('Done'), () => toggle(false))), el('p', { id: 'saveState', textContent: saveText }));
  }
  function toggle(v) { on = v; sel = null; saveText = ''; box.hidden = !on; document.body.classList.toggle('editing', on); $('#edit').setAttribute('aria-pressed', String(on)); $('#edit').textContent = on ? t('Done') : t('Design the office'); mark(); draw(); }
  $('#edit').onclick = () => toggle(!on);

  // Runs before OrbitControls so that dragging an item does not also turn the camera.
  dom.addEventListener('pointerdown', (e) => {
    if (!on || e.button) return; cast(e);
    const hit = ray.intersectObjects([...itemMeshes.values()].map((m) => m.group), true)[0];
    if (!hit) { drag = { x0: e.clientX, y0: e.clientY, empty: true }; return; }
    let g = hit.object; while (!g.userData.itemId) g = g.parent;
    const p = floor(e); pick({ kind: 'item', id: g.userData.itemId }); const i = item(); drag = p && { dx: i.x - p.x, dz: i.z - p.z, tag: 'drag' + Date.now() };
    controls.enabled = false;
  }, true);
  dom.addEventListener('pointermove', (e) => {
    if (!on || !drag || drag.empty) return; const p = floor(e), i = item(); if (!p || !i) return;
    const x = clamp(snap(p.x + drag.dx), 35), z = clamp(snap(p.z + drag.dz), 25); if (x === i.x && z === i.z) return;
    lastT = Date.now(); mod((it) => { it.x = x; it.z = z; }, drag.tag, false);
  });
  addEventListener('pointerup', (e) => {
    if (!on || !drag) return; const d = drag; drag = null; controls.enabled = true;
    if (!d.empty) { draw(); return; }
    if (e.target !== dom || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 5) return;
    const id = ctx.pickPerson(e); if (id && staff().some((w) => w.id === id)) return pick({ kind: 'agent', id });
    const p = floor(e), r = p && [...rooms].find(([, r]) => Math.abs(p.x - SLOTS[r.slot].x) < SLOTS[r.slot].w / 2 && Math.abs(p.z - SLOTS[r.slot].z) < SLOTS[r.slot].d / 2);
    pick(r ? { kind: 'room', id: r[0] } : null);
  });
  dom.addEventListener('wheel', (e) => { if (!on || !e.shiftKey || !item()) return; e.preventDefault(); e.stopImmediatePropagation(); mod((i) => { i.ry += Math.sign(e.deltaY || e.deltaX) * Math.PI / 24; }, 'wheel', false); }, { capture: true, passive: false });
  addEventListener('pointercancel', () => { drag = null; controls.enabled = true; });
  addEventListener('keydown', (e) => {
    if (!on || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? step(redo, undo) : step(undo, redo); return; }
    if (e.key === 'Escape') { if (sel) pick(null); else toggle(false); return; }
    if (!item()) return;
    const N = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.25], ArrowDown: [0, 0.25] }[e.key];
    if (N) { e.preventDefault(); mod((i) => { i.x = clamp(i.x + N[0], 35); i.z = clamp(i.z + N[1], 25); }, 'nudge'); }
    else if (e.code === 'KeyR') mod((i) => { i.ry += Math.PI / 4; });
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
    else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyD') { e.preventDefault(); add({ ...item(), x: item().x + 1.5 }); }
  });
  return { frame, get on() { return on; }, get selected() { return sel?.kind === 'item'; }, refresh() { if (on) mark(); } };
}
