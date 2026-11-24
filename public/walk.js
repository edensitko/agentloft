import * as THREE from 'three';
import { slide } from './slide.js';
import { t } from './i18n.js';

const EYE = 2.12, REST = -0.14, SPEED = 2.3, RUN = 4.3, STRIDE = 1.85; // metres per second covered by the recorded walk
const $ = (s) => document.querySelector(s);

/** Walk around the office as one of its people, through their eyes or from behind. */
export function createWalk(ctx) {
  const { camera, renderer, controls, people } = ctx, dom = renderer.domElement, keys = new Set();
  let turn = 0, id = null, yaw = 0, pitch = 0, bob = 0, third = false, near = null, saved = null, stick = null, dragging = null;
  const vel = { x: 0, z: 0 }, want = new THREE.Vector3(), focus = new THREE.Vector3(); let speed = 0, camReady = false;
  const dir = new THREE.Vector3(), eye = new THREE.Vector3(), MAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
  const locked = () => false, lock = () => {}; // keyboard only: the mouse never steers or gets captured while walking

  function enter(w) {
    if (id) leave();
    id = w.id; ctx.onChange(); const p = people.get(id); if (!p) { id = null; ctx.onChange(); return; }
    saved = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
    // a person sitting at a desk first stands up next to it
    ctx.prepare();
    if (ctx.blocked(p.g.position.x, p.g.position.z)) { let best = null; for (let r = 0.3; r < 5 && !best; r += 0.3) for (let a = 0; a < 16 && !best; a++) { const x = p.g.position.x + Math.cos(a / 16 * 6.283) * r, z = p.g.position.z + Math.sin(a / 16 * 6.283) * r; if (![[0, 0], [0.34, 0], [-0.34, 0], [0, 0.34], [0, -0.34]].some(([q, w2]) => ctx.blocked(x + q, z + w2))) best = [x, z]; } if (best) p.g.position.set(best[0], 0, best[1]); }
    p.controlled = true; p.path = []; p.pose = 'stand'; yaw = p.g.rotation.y + Math.PI; pitch = REST; third = true; vel.x = vel.z = speed = 0; camReady = false; focus.set(p.g.position.x, EYE, p.g.position.z);
    controls.enabled = false; camera.fov = 60; camera.near = 0.12; document.body.classList.add('walking'); ctx.resize();
    $('#walkName').textContent = t('You are {0}', w.name); $('#walk').hidden = false; lock();
  }
  function leave() {
    const p = id && people.get(id); if (p) { p.fp = false; p.lean = 0; p.walkRate = 1; p.controlled = false; p.spotKey = null; p.tag.visible = true; if (p.mesh) p.mesh.visible = true; }
    seat = spot = null; closeTask(); $('#walkDo').hidden = true; id = null; dragging = null; keys.clear(); stick = null; near = null; controls.enabled = true; camera.near = 0.8; if (saved) { camera.fov = saved.fov; camera.position.copy(saved.pos); controls.target.copy(saved.target); } camera.rotation.z = 0;
    document.body.classList.remove('walking'); $('#walk').hidden = true; if (locked()) document.exitPointerLock(); ctx.resize(); ctx.onChange();
  }
  function tick(dt) {
    const p = people.get(id); if (!p || p.gone) { leave(); return; }
    let f = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0), s = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0); if (stick) { f = -stick.y; s = stick.x; }
    // without a locked mouse the camera steers itself: left/right turn, and the view levels out while walking
    if (!locked()) { if (!stick) { turn += (s * 2.1 - turn) * Math.min(1, dt * 8); yaw -= turn * dt; s = 0; } else { yaw -= s * 1.6 * dt; s *= 0.25; } if (Math.abs(f) > 0.08 && !dragging) pitch += (REST - pitch) * Math.min(1, dt * 2.5); }
    if (seat) { if (Math.abs(f) > 0.3) stand(p); else f = 0; }
    const len = Math.hypot(f, s), run = keys.has('run') || len > 1.2, top = (run ? RUN : SPEED) * Math.min(1, len);
    // speed builds up and dies down instead of switching on and off
    const sin = Math.sin(yaw), cos = Math.cos(yaw), wx = len > 0.08 ? (-sin * f + cos * s) / len * top : 0, wz = len > 0.08 ? (-cos * f - sin * s) / len * top : 0, k = 1 - Math.exp(-dt * (len > 0.08 ? 7 : 10));
    vel.x += (wx - vel.x) * k; vel.z += (wz - vel.z) * k;
    const from = { x: p.g.position.x, z: p.g.position.z }, to = slide(from, vel.x * dt, vel.z * dt, ctx.blocked), L = ctx.limits;
    p.g.position.set(THREE.MathUtils.clamp(to.x, -L.x, L.x), 0, THREE.MathUtils.clamp(to.z, -L.z, L.z));
    // what the legs do follows what the body really did, so walking into a wall does not march in place
    const mx = p.g.position.x - from.x, mz = p.g.position.z - from.z, real = Math.hypot(mx, mz) / Math.max(dt, 1e-3); speed += (real - speed) * Math.min(1, dt * 12);
    if (real < 0.05) { vel.x *= 0.5; vel.z *= 0.5; }
    if (seat) { p.pose = 'sit'; p.face = seat.face; } else if (speed > 0.35) { p.pose = 'walk'; p.walkRate = speed / STRIDE; p.face = Math.atan2(mx, mz); } else { p.pose = 'stand'; if (len < 0.08 && locked()) p.face = yaw + Math.PI; }
    p.lean = Math.min(0.16, Math.max(0, speed - SPEED) * 0.07); p.fp = false; if (p.mesh) p.mesh.visible = true; p.tag.visible = false;
    eye.set(p.g.position.x, EYE * p.g.scale.y, p.g.position.z);
    dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    let d = 0.6; while (d < 4.4 && !ctx.blockedTall(eye.x - dir.x * (d + 0.3), eye.z - dir.z * (d + 0.3))) d += 0.2; // pull the camera in when a wall is behind it
    want.copy(eye).addScaledVector(dir, -d); want.y = Math.max(0.6, want.y + 0.35);
    // the camera trails the person softly and keeps them slightly off-centre
    const ck = ctx.calm || !camReady ? 1 : 1 - Math.exp(-dt * 9); camReady = true; camera.position.lerp(want, ck); focus.lerp(eye, ctx.calm ? 1 : 1 - Math.exp(-dt * 14));
    camera.lookAt(focus.x + dir.x * 3, focus.y + dir.y * 3 - 0.15, focus.z + dir.z * 3);
    if (!seat) seats(p);
    // who is in front of me
    let best = null, bd = 3.2; for (const [k, q] of people) { if (k === id || q.gone) continue; const x = q.g.position.x - p.g.position.x, z = q.g.position.z - p.g.position.z, d = Math.hypot(x, z); if (d < bd && (x * dir.x + z * dir.z) / (d || 1) > 0.75) { best = q; bd = d; } }
    if (best?.worker.id !== near?.worker.id || (best && best.worker !== near.worker)) { near = best; const b = $('#walkNear'); b.hidden = !best; if (best) b.textContent = ctx.describe(best.worker); }
  }
  // --- things to do on foot: hand a task to the agent in front of you, sit down
  let seat = null, spot = null;
  const closeTask = () => { $('#walkTask').hidden = true; };
  function openTask() {
    if (!near || !ctx.canTask(near.worker)) return; const w = near.worker, box = $('#walkTask'), ta = box.querySelector('textarea');
    box.hidden = false; box.querySelector('span').textContent = t('Task for {0}', w.name); ta.value = ''; keys.clear(); ta.focus();
    const send = () => { const text = ta.value.trim(); if (!text) return; ctx.task(w, text); closeTask(); };
    box.querySelector('button').onclick = send; ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  }
  function sit() {
    const p = people.get(id); if (!p) return;
    if (seat) { stand(p); return; } if (!spot) return;
    seat = spot; vel.x = vel.z = speed = 0; p.g.position.set(seat.x, 0, seat.z); p.face = seat.face; p.pose = 'sit'; yaw = seat.face + Math.PI; hint();
  }
  function stand(p) { // get up next to the seat, wherever there is room
    let best = null; for (let r = 0.5; r < 4 && !best; r += 0.25) for (let a = 0; a < 16 && !best; a++) { const x = seat.x + Math.sin(seat.face + a / 16 * 6.283) * r, z = seat.z + Math.cos(seat.face + a / 16 * 6.283) * r; if (![[0, 0], [0.34, 0], [-0.34, 0], [0, 0.34], [0, -0.34]].some(([q, w2]) => ctx.blocked(x + q, z + w2))) best = [x, z]; }
    if (best) p.g.position.set(best[0], 0, best[1]); seat = null; p.pose = 'stand'; hint();
  }
  const hint = () => { const d = $('#walkDo'), text = seat ? t('F or an arrow to stand up') : spot ? t('F to sit') : ''; d.hidden = !text; d.textContent = text; };
  function seats(p) { // the nearest free seat within reach
    let best = null, bd = 1.5; for (const s of ctx.seats()) { const d = Math.hypot(s.x - p.g.position.x, s.z - p.g.position.z); if (d < bd && ![...people].some(([k, q]) => k !== id && !q.gone && Math.hypot(q.g.position.x - s.x, q.g.position.z - s.z) < 0.5)) { best = s; bd = d; } }
    if (best !== spot) { spot = best; hint(); }
  }
  const act = () => { if (near) { if (locked()) document.exitPointerLock(); ctx.open(near.worker); } };

  addEventListener('keydown', (e) => {
    if (!id) return;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { if (e.key === 'Escape') { e.target.blur(); closeTask(); } e.stopImmediatePropagation(); return; } // typing a name or a task
    const k = MAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); } else if (e.code === 'KeyE' && !e.repeat) act(); else if (e.code === 'KeyT' && !e.repeat) { e.preventDefault(); openTask(); } else if (e.code === 'KeyF' && !e.repeat) sit(); else if (e.key === 'Escape') leave();
    e.stopImmediatePropagation(); // the map's own shortcuts are off while walking
  }, true);
  addEventListener('keyup', (e) => { if (id) keys.delete(MAP[e.code]); }, true);
  addEventListener('blur', () => keys.clear());
  const look = (x, y, k) => { yaw -= x * k; pitch = THREE.MathUtils.clamp(pitch - y * k, -1.25, 1.25); };
  // dragging looks around (the mouse is never captured); arrows keep working at the same time
  dom.addEventListener('pointerdown', (e) => { if (!id) return; e.stopImmediatePropagation(); dragging = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { dom.setPointerCapture(e.pointerId); } catch {} }, true);
  addEventListener('pointermove', (e) => { if (!id || dragging?.id !== e.pointerId) return; yaw -= (e.clientX - dragging.x) * 0.005; pitch = THREE.MathUtils.clamp(pitch - (e.clientY - dragging.y) * 0.004, -1.1, 0.9); dragging.x = e.clientX; dragging.y = e.clientY; });
  for (const t of ['pointerup', 'pointercancel']) addEventListener(t, (e) => { if (dragging?.id === e.pointerId) dragging = null; });
  dom.addEventListener('wheel', (e) => { if (id) { e.preventDefault(); e.stopImmediatePropagation(); } }, { capture: true, passive: false });
  // touch joystick
  const joy = $('#joy'); let jid = null;
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; const r = joy.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); stick = { x, y }; joy.style.setProperty('--x', Math.max(-1, Math.min(1, x)) * 34 + 'px'); joy.style.setProperty('--y', Math.max(-1, Math.min(1, y)) * 34 + 'px'); });
  for (const t of ['pointerup', 'pointercancel']) joy.addEventListener(t, () => { jid = null; stick = null; joy.style.setProperty('--x', '0px'); joy.style.setProperty('--y', '0px'); });
  $('#walkNear').onclick = () => (near && ctx.canTask(near.worker) && !ctx.hasSession(near.worker) ? openTask() : act()); $('#walkExit').onclick = leave; 
  return { enter, leave, tick, get id() { return id; }, get state() { return { yaw, pitch, third, near: near?.worker.name ?? null }; } };
}
