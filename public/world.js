import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { FLOOR, SLOTS, MEETING, TABLES, CAFE, PLAN, walls, seats } from './nav.js';
import { M, Batch, canvasTexture } from './materials.js';
import { TEMPLATES } from './templates.js';
import { t, DIR } from './i18n.js';
import { buildCity } from './city.js';
import { B, R, C, plant, planter, desk, shelf, sofa, pendant, cafeChair, taskChair } from './furniture.js';

export function label(text, cls) { const el = document.createElement('div'); el.className = cls; el.textContent = text; return new CSS2DObject(el); }
const glow = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });

export function buildWorld(scene, renderer) {
  scene.background = new THREE.Color('#d9d4cc');
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const hemi = new THREE.HemisphereLight('#ffffff', '#b59a7c', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2); sun.position.set(34, 52, -18); sun.castShadow = true; // daylight comes in through the back and right windows
  sun.shadow.mapSize.set(3072, 3072); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 36, bottom: -36, far: 150 }); scene.add(sun);
  const base = new THREE.Group(); scene.add(base); const b = new Batch(), lamps = [];
  const city = buildCity(scene);
  const [kx, kz] = PLAN.kitchen, [lx, lz] = PLAN.lounge, [rx, rz] = PLAN.reception;
  if (PLAN.wall) M.plaster.color.set(PLAN.wall);
  const ground = { concrete: M.concrete, stone: M.stone, herring: M.herring, dark: new THREE.MeshStandardMaterial({ color: '#2c3036', roughness: 0.55 }) }[PLAN.ground] ?? M.floor;
  b.add(B(FLOOR.w + 1, 0.3, FLOOR.d + 1), M.concrete, 0, -0.16, 0).add(B(FLOOR.w, 0.04, FLOOR.d), ground, 0, -0.02, 0);
  if (PLAN.garden) { const [x, z, w, d] = PLAN.garden; b.add(B(w, 0.06, d), new THREE.MeshStandardMaterial({ color: '#57743c', roughness: 1 }), x, 0.02, z); for (const s of [-1, 1]) b.add(B(w + 0.4, 0.16, 0.2), M.concrete, x, 0.06, z + s * d / 2).add(B(0.2, 0.16, d), M.concrete, x + s * w / 2, 0.06, z); }
  const H = 4.4, hw = FLOOR.w / 2, hd = FLOOR.d / 2;
  // outer walls: full height at the back and right, cut low at the front and left so the camera can look in
  const wall = (len, along, at, cut) => {
    const put = (l, h, t, mat, p, y) => b.add(along ? B(l, h, t) : B(t, h, l), mat, along ? p : at, y, along ? at : p);
    if (cut) { put(len + 0.4, 0.5, 0.35, M.plaster, 0, 0.25); put(len + 0.4, 0.03, 0.4, M.metal, 0, 0.515); return; }
    const bays = Math.round(len / 6), bw = len / bays;
    put(len + 0.4, 0.75, 0.35, M.plaster, 0, 0.375); put(len + 0.4, 0.55, 0.35, M.plaster, 0, H - 0.275); put(len, 0.06, 0.5, M.oak, 0, 0.78);
    for (let i = 0; i <= bays; i++) put(0.8, H, 0.35, M.plaster, -len / 2 + i * bw, H / 2);
    for (let i = 0; i < bays; i++) { const c = -len / 2 + (i + 0.5) * bw; put(bw - 0.8, H - 1.3, 0.04, M.glass, c, 2.3); for (const k of [0]) put(0.05, H - 1.3, 0.1, M.metal, c + k * (bw - 0.9), 2.3); for (const y of [0.83, H - 0.6]) put(bw - 0.8, 0.06, 0.1, M.metal, c, y); }
  };
  wall(FLOOR.w, true, -hd - 0.2, false); wall(FLOOR.d, false, hw + 0.2, false); for (const d of [-1, 1]) b.add(B(hw - 3, 0.5, 0.35), M.plaster, d * (hw + 3) / 2, 0.25, hd + 0.2).add(B(hw - 3, 0.03, 0.4), M.metal, d * (hw + 3) / 2, 0.515, hd + 0.2).add(B(0.2, 3.1, 0.3), M.metal, d * 2.9, 1.55, hd + 0.2); // the entrance
  b.add(B(6, 0.25, 0.5), M.metal, 0, 3.1, hd + 0.2).add(B(4.6, 0.03, 2.4), M.carpet, 0, 0.0, hd + 1.6); wall(FLOOR.d, false, -hw - 0.2, true);
  // kitchen along the left side: tall units, counter, island, tables
  b.at(-28 + kx, -2.6 + kz, Math.PI / 2);
  for (let k = -1; k <= 1; k++) b.add(R(1.5, 2.6, 0.9, 0.02), M.sage, 5 + k * 0 - 0.0, 1.3, 0).add(R(1.5, 2.6, 0.9, 0.02), M.white, -5.6, 1.3, 0);
  b.add(R(9, 0.95, 0.9, 0.02), M.sage, -0.3, 0.48, 0).add(R(9.1, 0.06, 1.0, 0.01), M.marble, -0.3, 0.98, 0); for (let x = -4.3; x <= 3.8; x += 1.5) b.add(R(1.44, 0.8, 0.03, 0.01), M.sage, x + 0.2, 0.5, 0.46).add(B(0.3, 0.02, 0.03), M.metal, x + 0.2, 0.82, 0.49);
  b.add(R(1.4, 0.03, 0.7, 0.01), M.metal, 1.6, 1.0, 0).add(C(0.03, 0.03, 0.5, 12), M.chrome, 1.6, 1.25, -0.28).add(R(1.2, 0.02, 0.7, 0.01), M.off, -1.4, 1.02, 0).add(R(1.0, 0.75, 0.65, 0.05), M.chrome, 3.2, 1.4, 0).add(C(0.16, 0.12, 0.5, 18), M.plastic, -3.4, 1.25, 0);
  b.add(B(6, 0.05, 0.35), M.oak, -0.4, 1.95, -0.2); for (let i = 0; i < 9; i++) b.add(C(0.07, 0.055, 0.14, 16), i % 3 ? M.white : M.sage, -3 + i * 0.6, 2.05, -0.2);
  b.at(-23 + kx, -5.2 + kz); b.add(R(4.4, 0.98, 1.4, 0.03), M.walnut, 0, 0.5, 0).add(R(4.8, 0.07, 1.8, 0.02), M.marble, 0, 1.03, 0).add(C(0.28, 0.16, 0.12, 28), M.oak, 1.2, 1.13, 0); for (let i = 0; i < 4; i++) b.add(C(0.09, 0.09, 0.02, 18), M.white, -1.6 + i * 0.35, 1.08, 0.2);
  for (const x of [-1.5, 0, 1.5]) { b.at(-23 + kx + x, -3.8 + kz); b.add(C(0.26, 0.26, 0.06, 24), M.walnut, 0, 0.92, 0).add(C(0.03, 0.03, 0.9, 10), M.metal, 0, 0.46, 0).add(C(0.26, 0.28, 0.03, 24), M.metal, 0, 0.015, 0); }
  for (const x of [-1.8, 0, 1.8]) pendant(b, -23 + x * 0.8, -5.2, 3.2);
  for (const [x, z] of TABLES) { b.at(x, z); b.add(C(0.82, 0.82, 0.05, 40), M.oak, 0, 0.96, 0).add(C(0.05, 0.05, 0.92, 14), M.metal, 0, 0.48, 0).add(C(0.4, 0.44, 0.04, 28), M.metal, 0, 0.02, 0).add(C(0.06, 0.045, 0.12, 14), M.white, 0.25, 1.04, 0.2).add(C(0.1, 0.07, 0.22, 16), M.sage, -0.1, 1.09, -0.1); pendant(b, x, z, 3.2); }
  for (const c of CAFE) cafeChair(b, c.x, c.z, c.face);
  planter(b, -17.4 + kx, -6.4 + kz, Math.PI / 2, 3.4); planter(b, -17.4 + kx, 1.4 + kz, Math.PI / 2, 3.4);
  // lounge, front left
  b.at(-8 + lx, 12.2 + lz); b.add(R(11, 0.03, 7.4, 0.01), M.rug, 0, 0.03, 0);
  sofa(b, -8 + lx, 9.15 + lz, 0, 4.8); sofa(b, -12.1 + lx, 12.6 + lz, Math.PI / 2, 3.4); sofa(b, -3.9 + lx, 12.6 + lz, -Math.PI / 2, 3.4);
  b.at(-8 + lx, 12.6 + lz); b.add(R(2.6, 0.08, 1.5, 0.04), M.oak, 0, 0.52, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(C(0.03, 0.025, 0.5, 10), M.metal, x * 1.1, 0.25, z * 0.55); b.add(B(0.45, 0.04, 0.32), M.bookB, 0.5, 0.59, 0.1, 0, 0.3).add(C(0.16, 0.1, 0.14, 24), M.white, -0.5, 0.63, 0);
  // reception and entrance
  b.at(3.5 + rx, 13 + rz); b.add(R(5.2, 1.15, 0.9, 0.06), M.walnut, 0, 0.58, 0).add(R(5.5, 0.06, 1.15, 0.02), M.marble, 0, 1.18, 0).add(R(0.95, 0.52, 0.04, 0.015), M.plastic, 0.8, 1.5, 0.1).add(C(0.1, 0.07, 0.25, 18), M.white, -1.8, 1.33, 0); for (let x = -2.5; x <= 2.5; x += 0.18) b.add(B(0.08, 1.0, 0.03), M.slat, x, 0.6, 0.47);
  taskChair(b, 3.5 + rx, 11.9 + rz, 0);
  b.at(0, hd - 1.2); b.add(R(5.4, 0.03, 2.2, 0.01), M.carpet, 0, 0.02, 0);
  // corridor: phone booths and a bench
  for (const d of PLAN.booths ? [-1.2, 1.2] : []) { b.at(PLAN.booths[0], PLAN.booths[1] + d, -Math.PI / 2); b.add(R(2.1, 2.9, 1.9, 0.08), M.sage, 0, 1.45, -0.15).add(B(1.6, 2.3, 0.05), M.off, 0, 1.3, 0.81).add(B(1.5, 2.2, 0.05), M.glass, 0, 1.3, 0.84).add(C(0.03, 0.03, 0.5, 8), M.chrome, 0.62, 1.2, 0.9); }
  
  // smoking corner outside: deck, pergola, bench, standing ashtrays
  b.at(11, hd + 4); b.add(R(9.6, 0.12, 4.4, 0.02), M.oak, 0, -0.1, 0); for (const x of [-4.5, 4.5]) for (const z of [-1.9, 1.9]) b.add(B(0.14, 2.9, 0.14), M.metal, x, 1.4, z); for (const z of [-1.9, 1.9]) b.add(B(9.2, 0.12, 0.12), M.metal, 0, 2.85, z); for (let x = -4.4; x <= 4.4; x += 0.55) b.add(B(0.07, 0.1, 4), M.slat, x, 2.95, 0);
  for (const x of [-1.9, 1.3]) b.add(C(0.18, 0.22, 0.95, 22), M.metal, x, 0.45, 0).add(C(0.2, 0.2, 0.05, 22), M.chrome, x, 0.94, 0).add(C(0.15, 0.15, 0.02, 18), M.paper, x, 0.965, 0);
  b.add(R(3, 0.1, 0.55, 0.02), M.walnut, 0.2, 0.5, 1.7).add(R(3, 0.5, 0.06, 0.02), M.walnut, 0.2, 0.9, 1.95); for (const x of [-1.2, 1.6]) b.add(B(0.1, 0.5, 0.5), M.metal, x, 0.22, 1.7); planter(b, 11, hd + 5.9, 0, 8);
  // big meeting room
  shell(b, MEETING, new THREE.MeshStandardMaterial({ color: '#46545f', roughness: 0.9 }));
  b.at(MEETING.x, MEETING.z); b.add(R(9, 0.03, 6.4, 0.01), M.rug, 0, 0.03, 0.4).add(R(6.2, 0.09, 2.2, 0.06), M.walnut, 0, 0.98, 0); for (const x of [-2, 2]) b.add(R(0.14, 0.94, 2, 0.03), M.metal, x, 0.48, 0).add(R(0.34, 0.06, 0.34, 0.03), M.plastic, x, 1.05, 0);
  for (let k = 0; k < 4; k++) for (const d of [-1, 1]) taskChair(b, MEETING.x - 2.25 + k * 1.5, MEETING.z + d * 1.9, d < 0 ? 0 : Math.PI); for (const d of [-1, 1]) taskChair(b, MEETING.x + d * 3.9, MEETING.z, d < 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const x of [-1.8, 0, 1.8]) pendant(b, MEETING.x + x, MEETING.z, 3.2); shelf(b, MEETING.x - 4.2, MEETING.z - 4, 1.9); shelf(b, MEETING.x + 4.2, MEETING.z - 4, 1.9); plant(b, MEETING.x - 4.7, MEETING.z + 3.6, 1, 1); plant(b, MEETING.x + 4.7, MEETING.z + 3.6, 1, 0);
  // live status wall: the meeting room's big screen
  b.at(MEETING.x, MEETING.z - 4.4); b.add(R(5.5, 2.25, 0.1, 0.03), M.plastic, 0, 2.05, 0.2);
  const [bg, boardTex] = canvasTexture(1024, 400);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 2.07), new THREE.MeshBasicMaterial({ map: boardTex, color: '#cfcfcf' })); face.position.set(MEETING.x, 2.05, MEETING.z - 4.13); base.add(face);
  b.at(0, 0); b.flush(base);
  for (const [i, d, x, y, z] of [[70, 18, -23 + kx, 5, -4 + kz], [60, 16, -8 + lx, 5, 12 + lz], [60, 18, 4 + rx, 5, 13 + rz], [70, 16, MEETING.x, 4.5, MEETING.z], [45, 18, FLOOR.w / 4, 5, 4]]) { const l = new THREE.PointLight('#ffcf9a', i, d); l.userData.i = i; l.position.set(x, y, z); base.add(l); lamps.push(l); }
  for (const [name, x, y, z] of [[t('Kitchen'), -24 + kx, 3.4, -9.6 + kz], [t('Lounge'), -8 + lx, 2.2, 8 + lz], [t('Reception'), 3.5 + rx, 2.4, 12.8 + rz], [t('Smoking corner'), 11, 3.4, hd + 3.2], [t('Meeting room'), MEETING.x, 4, MEETING.z - 4.2]]) { const l = label(name, 'room'); l.position.set(x, y, z); base.add(l); }
  return {
    lampLevel: 0.25, tick: city.tick, setOutside: (k) => city.setOutside(k),
    setMood(m = 'day', light = 1) {
      const k = { day: ['#dcd8d1', '#ffffff', '#c2a987', 0.75, '#fff1dc', 2.3, 0.45, 0.2], sunset: ['#c9a88f', '#f3c9b4', '#8a6348', 0.6, '#ff9d58', 2.6, 0.32, 0.7], night: ['#1a1b22', '#8fa0d0', '#4a3524', 0.35, '#a9bdf0', 0.45, 0.16, 1.25] }[m];
      city.setMood(m); hemi.color.set(k[1]); hemi.groundColor.set(k[2]); hemi.intensity = k[3] * light; sun.color.set(k[4]); sun.intensity = k[5] * light; scene.environmentIntensity = k[6] * light; this.lampLevel = k[7];
      scene.traverse((o) => { if (o.isPointLight) { o.intensity = o.userData.i * k[7]; o.visible = k[7] > 0.3; } });
      document.body.classList.toggle('light', m === 'day');
    },
    drawBoard(n) {
      bg.fillStyle = '#12151c'; bg.fillRect(0, 0, 1024, 400); bg.direction = DIR; bg.textAlign = 'center';
      bg.fillStyle = '#e9ecf2'; bg.font = '600 46px system-ui'; bg.fillText(t('Office status'), 512, 74);
      [[t('working'), n.working, '#4be09a'], [t('waiting'), n.waiting, '#ffa24a'], [t('idle'), n.idle, '#b8c4e8'], [t('sessions'), n.sessions, '#d9c7a8']].forEach(([name, v, col], i) => { // columns run in reading order
        const x = DIR === 'rtl' ? 1024 - 140 - i * 248 : 140 + i * 248; bg.fillStyle = col; bg.font = '700 132px system-ui'; bg.fillText(String(v), x, 240); bg.fillStyle = '#c9ced8'; bg.font = '42px system-ui'; bg.fillText(name, x, 326);
      });
      boardTex.needsUpdate = true;
    },
  };
}

const ACCENTS = ['#5f7f76', '#b5765a', '#5c6f8f', '#a08a5b', '#7d6a86', '#6f8a5c', '#8a5c62', '#4f7d8a'];
function shell(b, s, tint) {
  const back = s.z - s.d / 2, pw = Math.min(7.6, s.w * 0.5);
  if (s.skip?.includes('n')) { b.at(s.x, back + 0.05); b.add(B(pw, 3.3, 0.08), tint, 0, 1.72, 0.06); for (const d of [-1, 1]) for (let k = pw / 2 + 0.15; k < pw / 2 + 1.1; k += 0.2) b.add(B(0.09, 3.3, 0.06), M.slat, d * k, 1.72, 0.08); }
  b.at(0, 0);
  for (const [x1, z1, x2, z2, side] of walls(s)) {
    const along = Math.abs(x2 - x1) > 0, len = along ? x2 - x1 : z2 - z1, x = (x1 + x2) / 2, z = (z1 + z2) / 2;
    const box = (l, h, t, mat, y) => b.add(along ? B(l, h, t) : B(t, h, l), mat, x, y, z);
    if (side === 'n' && s.kind !== 'hall') {
      box(len, 3.2, 0.2, M.plaster, 1.6); box(len + 0.1, 0.05, 0.24, M.metal, 3.22); b.add(B(pw, 3.0, 0.03), tint, x, 1.65, z + 0.115);
    } else {
      box(len, 2.6, 0.03, M.glass, 1.33); box(len, 0.05, 0.06, M.metal, 2.65); box(len, 0.08, 0.06, M.metal, 0.04);
      const n = Math.max(1, Math.round(len / 3.7)); for (let i = 0; i <= n; i++) b.add(B(0.035, 2.65, 0.05), M.metal, along ? x1 + len * i / n : x, 1.33, along ? z : z1 + len * i / n);
    }
  }
  if (s.kind === 'hall') { b.at(s.x, back); b.add(R(7.6, 3.1, 0.2, 0.03), tint, 0, 1.6, 0.1); for (let k = -3.7; k <= 3.7; k += 0.2) b.add(B(0.09, 3.05, 0.04), M.slat, k, 1.6, -0.02); for (const d of [-1, 1]) { planter(b, s.x + d * (s.w / 2 - 2.5), back + 0.7, 0, 4); } }
}
function finish(g, b, s, text) {
  b.at(0, 0); b.flush(g);
  const l = label(text, 'room'); l.position.set(s.x, 3.9, s.z - s.d / 2); g.add(l);
  return () => { l.element.remove(); g.traverse((o) => o.isMesh && o.geometry.dispose()); g.removeFromParent(); };
}

export function buildRoom(scene, slotIndex, project, count, opt = {}) {
  if (opt.executive) return buildExecutive(scene, slotIndex, project, opt);
  const s = SLOTS[slotIndex], g = new THREE.Group(), b = new Batch(); scene.add(g);
  const tpl = TEMPLATES[opt.style], floor = opt.floor ?? tpl?.floor; const accent = opt.accent ?? tpl?.accent ?? ACCENTS[slotIndex % ACCENTS.length], strip = glow('#5fd0a0', 1.2), paint = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.9 }), rug = M.carpet.clone(), back = s.z - s.d / 2;
  rug.color.set('#b9b2a8').lerp(new THREE.Color(accent), 0.45);
  if (floor === 'stone' || floor === 'carpet') b.add(B(s.w - 0.1, 0.04, s.d - 0.1), floor === 'stone' ? M.stone : rug, s.x, 0.02, s.z); else b.add(R(s.w - 2, 0.03, s.d - 2.2, 0.01), rug, s.x, 0.03, s.z + 0.2);
  shell(b, s, paint);
  if (tpl) { // the template's own wall covers the plain one; in the hall it stands behind the screen
    const w = s.kind === 'hall' ? 8 : s.w - 0.3; b.at(s.x, back); b.add(B(w, 3.25, 0.06), tpl.wall, 0, 1.66, s.kind === 'hall' ? 0.24 : 0.17);
    tpl.deco(b, s);
  }
  const seatList = seats(s, count), screens = [], live = new THREE.PlaneGeometry(1.03, 0.59), led = new THREE.PlaneGeometry(0.3, 0.02);
  seatList.forEach((p, i) => {
    desk(b, p.x, p.z, i, tpl?.top, tpl?.chair);
    const sc = new THREE.Mesh(live, M.off); sc.position.set(p.x, 1.5, p.z + 1.083); sc.rotation.y = Math.PI; g.add(sc);
    const ld = new THREE.Mesh(led, M.off); ld.position.set(p.x, 1.42, p.z + 1.136); g.add(ld); // visible from behind the monitor
    screens.push((on) => { sc.material = on ? M.screen : M.off; ld.material = on ? strip : M.off; });
  });
  const tvOn = tpl?.tv !== false; b.at(s.x, back); if (tvOn) b.add(R(3.8, 1.5, 0.1, 0.03), M.plastic, 0, 2.15, 0.28);
  const [ctx, tex] = canvasTexture(512, 200); const gr = ctx.createLinearGradient(0, 0, 512, 200); gr.addColorStop(0, '#14171d'); gr.addColorStop(1, '#232831'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 512, 200);
  ctx.fillStyle = '#fff'; ctx.font = '700 64px system-ui'; ctx.textAlign = 'center'; ctx.direction = DIR; ctx.fillText(project.label, 256, 122, 470);
  const tvMat = new THREE.MeshBasicMaterial({ map: tex, color: '#bdbdbd' }), tv = new THREE.Mesh(new THREE.PlaneGeometry(3.65, 1.36), tvMat); tv.position.set(s.x, 2.15, back + 0.335); tv.visible = tvOn; g.add(tv);
  if (tpl) { if (s.kind === 'hall') for (const dx of [-0.38, -0.13, 0.13, 0.38].map((k) => k * s.w)) for (const dz of [-3, 3.6]) pendant(b, s.x + dx, s.z + dz, 3.7); }
  else if (s.kind !== 'hall') { const sw = Math.min(2.2, (s.w - 7) / 2 - 0.4); if (sw > 1.2) for (const d of [-1, 1]) shelf(b, s.x + d * (s.w / 2 - sw / 2 - 0.4), back + 0.45, sw); plant(b, s.x + s.w / 2 - 0.9, s.z + s.d / 2 - 0.9, 0.9, slotIndex % 2); for (const dx of [-2.4, 2.4]) pendant(b, s.x + dx, s.z + 0.4, 3.6); }
  else { for (const dx of [-0.38, -0.13, 0.13, 0.38].map((k) => k * s.w)) for (const dz of [-3, 3.6]) pendant(b, s.x + dx, s.z + dz, 3.7); for (const d of [-1, 1]) plant(b, s.x + d * (s.w / 2 - 1.1), s.z + s.d / 2 - 1.1, 1.1, 1); }
  const light = new THREE.PointLight('#ffcf9a', 0, 16); light.userData.i = s.kind === 'hall' ? 160 : 85; if (s.kind === 'hall') light.distance = 30; light.position.set(s.x, 4.2, s.z); g.add(light);
  const dispose = finish(g, b, s, project.label);
  return { seats: seatList, setScreen: (i, on) => screens[i]?.(on), dispose() { dispose(); tex.dispose(); tvMat.dispose(); strip.dispose(); paint.dispose(); rug.dispose(); } };
}

/** The manager's corner office: command desk with guest seats, lounge, library wall and a wall of live screens. */
function buildExecutive(scene, slotIndex, project, opt) {
  const s = SLOTS[slotIndex], g = new THREE.Group(), b = new Batch(), back = s.z - s.d / 2, strip = glow('#5fd0a0', 1.2); scene.add(g);
  const paint = new THREE.MeshStandardMaterial({ color: opt.accent ?? '#2f4a45', roughness: 0.9 }), rug = M.rug.clone(), leather = new THREE.MeshPhysicalMaterial({ color: '#6b4128', roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.5 }), brass = new THREE.MeshStandardMaterial({ color: '#b48a4e', metalness: 1, roughness: 0.28 });
  if (opt.accent) rug.color.lerp(new THREE.Color(opt.accent), 0.25);
  if (opt.floor === 'stone' || opt.floor === 'carpet') b.add(B(s.w - 0.1, 0.04, s.d - 0.1), opt.floor === 'stone' ? M.stone : rug, s.x, 0.02, s.z); else b.add(B(s.w - 0.1, 0.04, s.d - 0.1), M.herring, s.x, 0.02, s.z);
  shell(b, s, paint);
  // full walnut back wall with a lit library on both sides and the screens in the middle
  b.at(s.x, back); b.add(B(s.w - 0.3, 3.6, 0.08), M.walnut, 0, 1.85, 0.2).add(B(s.w - 0.4, 0.03, 0.05), M.warm, 0, 3.08, 0.24);
  for (const d of [-1, 1]) { for (const o of [4.5]) shelf(b, s.x + d * o, back + 0.55, 1.95); b.at(s.x, back); b.add(B(3.9, 0.02, 0.04), M.warm, d * 5.2, 1.95, 0.35); for (const x of [3.5, 4.2, 4.9, 6.6]) b.add(C(0.12, 0.08, 0.3, 20), x > 4.5 ? brass : M.white, d * x, 2.05, 0.42); }
  b.add(R(4.6, 1.7, 0.08, 0.03), M.plastic, 0, 2.0, 0.28); for (const d of [-1, 1]) b.add(B(0.03, 2.9, 0.05), brass, d * 2.75, 1.6, 0.22);
  const [c, tex] = canvasTexture(1024, 370); c.fillStyle = '#10151a'; c.fillRect(0, 0, 1024, 370); c.direction = DIR; c.textAlign = 'center'; c.fillStyle = '#f0e6d4'; c.font = '700 92px system-ui'; c.fillText(project.label, 512, 150, 960); c.fillStyle = '#9fb7ad'; c.font = '46px system-ui'; c.fillText(project.list?.[0]?.name ?? '', 512, 250, 960);
  const tvMat = new THREE.MeshBasicMaterial({ map: tex, color: '#d0d0d0' }), tv = new THREE.Mesh(new THREE.PlaneGeometry(4.45, 1.58), tvMat); tv.position.set(s.x, 2.0, back + 0.325); g.add(tv);
  // command desk
  const dx = s.x - 2.4, dz = s.z - 1.7; b.at(dx, dz); b.add(R(5.4, 0.03, 5.4, 0.01), rug, 0, 0.06, 1.6);
  b.add(R(3.6, 0.09, 1.35, 0.03), M.walnut, 0, 0.96, 1.15).add(R(3.4, 0.78, 0.06, 0.02), M.walnut, 0, 0.52, 1.62).add(B(3.4, 0.02, 0.07), brass, 0, 0.82, 1.63);
  for (const d of [-1, 1]) b.add(R(0.75, 0.86, 1.15, 0.02), M.walnut, d * 1.35, 0.47, 1.12).add(R(0.1, 0.02, 0.03, 0.005), brass, d * 1.35, 0.7, 0.53).add(R(0.1, 0.02, 0.03, 0.005), brass, d * 1.35, 0.45, 0.53);
  b.add(R(1.9, 0.02, 0.7, 0.01), leather, 0, 1.012, 0.9).add(R(0.62, 0.025, 0.2, 0.01), M.plastic, 0, 1.03, 0.64).add(R(0.1, 0.03, 0.15, 0.015), M.white, 0.48, 1.03, 0.66);
  for (const d of [-1, 1]) b.add(R(1.0, 0.58, 0.04, 0.015), M.plastic, d * 0.56, 1.47, 1.38, 0, d * 0.2).add(B(0.07, 0.3, 0.04), M.metal, d * 0.56, 1.15, 1.42).add(R(0.32, 0.02, 0.22, 0.01), M.metal, d * 0.56, 1.01, 1.42);
  b.add(C(0.13, 0.15, 0.03, 20), brass, -1.45, 1.02, 1.3).add(C(0.014, 0.014, 0.5, 8), brass, -1.45, 1.27, 1.3).add(C(0.12, 0.2, 0.2, 24), M.paper, -1.45, 1.58, 1.3).add(B(0.4, 0.05, 0.3), M.bookA, 1.4, 1.03, 1.2, 0, 0.2).add(B(0.36, 0.04, 0.28), M.bookD, 1.4, 1.075, 1.2, 0, -0.1);
  // high-back leather chair
  b.at(dx, dz); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; b.add(R(0.07, 0.05, 0.44, 0.02), M.chrome, Math.sin(a) * 0.2, 0.1, Math.cos(a) * 0.2, 0, a); }
  b.add(C(0.045, 0.045, 0.4, 12), M.chrome, 0, 0.32, 0).add(R(0.8, 0.14, 0.76, 0.06), leather, 0, 0.55, 0).add(R(0.78, 1.15, 0.14, 0.06), leather, 0, 1.2, -0.46, -0.12).add(R(0.6, 0.24, 0.1, 0.05), leather, 0, 1.7, -0.44, -0.12); for (const d of [-1, 1]) b.add(R(0.09, 0.06, 0.45, 0.03), leather, d * 0.45, 0.86, -0.02).add(R(0.05, 0.28, 0.06, 0.015), M.chrome, d * 0.45, 0.7, -0.05);
  // two guest chairs, lounge, round meeting table
  const arm = (x, z, ry) => { b.at(x, z, ry); b.add(R(0.95, 0.26, 0.9, 0.08), leather, 0, 0.5, 0).add(R(0.95, 0.7, 0.2, 0.08), leather, 0, 0.9, -0.42, -0.15); for (const d of [-1, 1]) b.add(R(0.16, 0.34, 0.9, 0.06), leather, d * 0.5, 0.7, 0); for (const [x2, z2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(C(0.03, 0.02, 0.38, 8), brass, x2 * 0.4, 0.19, z2 * 0.36); };
  arm(dx - 1.1, dz + 3.4, Math.PI - 0.25); arm(dx + 1.1, dz + 3.4, Math.PI + 0.25);
  sofa(b, s.x + 5.6, s.z - 0.9, -Math.PI / 2, 3); arm(s.x + 2.5, s.z - 0.9, Math.PI / 2); b.at(s.x + 4.1, s.z - 0.9); b.add(R(3.8, 0.03, 4, 0.01), rug, 0, 0.055, 0);
  b.at(s.x + 4.05, s.z - 0.9); b.add(C(0.75, 0.75, 0.06, 40), M.marble, 0, 0.5, 0).add(C(0.08, 0.3, 0.48, 20), brass, 0, 0.25, 0).add(C(0.06, 0.045, 0.1, 14), M.white, 0.25, 0.58, 0.1).add(B(0.4, 0.03, 0.3), M.bookB, -0.2, 0.55, 0, 0, 0.5);
  b.at(s.x + 4.3, s.z + 2.7); b.add(C(1.05, 1.05, 0.06, 44), M.walnut, 0, 0.97, 0).add(C(0.09, 0.4, 0.94, 24), M.metal, 0, 0.48, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; cafeChair(b, s.x + 4.3 + Math.sin(a) * 1.35, s.z + 2.7 + Math.cos(a) * 1.35, a + Math.PI); }
  // credenza, art, lamps, plants
  b.at(s.x - 5.95, s.z - 0.2, Math.PI / 2); b.add(R(3.6, 0.75, 0.6, 0.02), M.walnut, 0, 0.5, 0).add(R(3.7, 0.04, 0.66, 0.01), M.marble, 0, 0.9, 0); for (let i = -1; i <= 1; i++) b.add(B(0.02, 0.6, 0.01), brass, i * 0.9, 0.5, 0.305); b.add(C(0.14, 0.1, 0.4, 24), brass, -1.2, 1.12, 0).add(R(0.5, 0.36, 0.04, 0.01), M.paper, 0.5, 1.1, 0, -0.15).add(C(0.09, 0.07, 0.24, 18), M.white, 1.3, 1.04, 0);
  b.at(s.x + 5.8, s.z - 3.2); b.add(C(0.26, 0.28, 0.04, 24), brass, 0, 0.02, 0).add(C(0.018, 0.018, 2.1, 10), brass, 0, 1.05, 0).add(C(0.2, 0.34, 0.4, 28), M.paper, 0, 2.2, 0);
  plant(b, s.x - 5.6, s.z + 3.6, 1.05, 1);
  const light = new THREE.PointLight('#ffcf9a', 0, 17); light.userData.i = 110; light.position.set(s.x, 4, s.z); g.add(light);
  const screens = [], live = new THREE.PlaneGeometry(0.94, 0.52), seatList = [{ x: dx, z: dz }, { x: s.x + 4.3 + Math.sin(0.6) * 1.35, z: s.z + 2.7 + Math.cos(0.6) * 1.35, face: 0.6 + Math.PI }, { x: s.x + 4.3 + Math.sin(0.6 + Math.PI / 2) * 1.35, z: s.z + 2.7 + Math.cos(0.6 + Math.PI / 2) * 1.35, face: 0.6 + Math.PI * 1.5 }, { x: s.x + 4.3 + Math.sin(0.6 + Math.PI) * 1.35, z: s.z + 2.7 + Math.cos(0.6 + Math.PI) * 1.35, face: 0.6 }];
  for (const d of [-1, 1]) { const m = new THREE.Mesh(live, M.off); m.position.set(dx + d * 0.56 - d * 0.005, 1.47, dz + 1.352); m.rotation.y = Math.PI + d * 0.2; g.add(m); screens.push(m); }
  const dispose = finish(g, b, s, project.label);
  return { seats: seatList, setScreen: (i, on) => { if (i === 0) for (const m of screens) m.material = on ? M.screen : M.off; }, dispose() { dispose(); tex.dispose(); [tvMat, strip, paint, rug, leather, brass].forEach((m) => m.dispose()); } };
}

/** Unused room: a lounge or a meeting room until a project moves in. */
export function buildSpare(scene, i) {
  const s = SLOTS[i], g = new THREE.Group(), b = new Batch(), lounge = i % 2 === 1, strip = new THREE.MeshStandardMaterial({ color: '#8c8478', roughness: 0.9 }), back = s.z - s.d / 2; scene.add(g);
  shell(b, s, strip);
  b.at(0, 0);
  if (lounge) {
    b.add(R(9, 0.03, 7, 0.01), M.carpet, s.x, 0.03, s.z);
    sofa(b, s.x, s.z - 2.7, 0, 5); sofa(b, s.x - 3.7, s.z + 0.5, Math.PI / 2, 3.4); sofa(b, s.x + 3.7, s.z + 0.5, -Math.PI / 2, 3.4);
    b.at(s.x, s.z + 0.4); b.add(R(2.2, 0.08, 1.2, 0.03), M.walnut, 0, 0.5, 0); for (const [x, z] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) b.add(C(0.03, 0.02, 0.48, 8), M.metal, x * 0.95, 0.24, z * 0.9); b.add(B(0.4, 0.05, 0.3), M.bookA, 0.4, 0.57, 0, 0, 0.4).add(C(0.1, 0.07, 0.18, 16), M.white, -0.4, 0.63, 0.1);
    shelf(b, s.x + 4, back + 0.45, 3);
  } else {
    b.add(R(11, 0.03, 8, 0.01), M.carpet, s.x, 0.03, s.z);
    b.at(s.x, s.z); b.add(R(7.6, 0.08, 2.4, 0.04), M.walnut, 0, 0.98, 0); for (const x of [-2.4, 2.4]) b.add(R(0.12, 0.94, 1.6, 0.03), M.metal, x, 0.48, 0);
    b.add(R(0.3, 0.06, 0.3, 0.03), M.plastic, 0, 1.05, 0);
    for (let k = 0; k < 5; k++) for (const d of [-1, 1]) taskChair(b, s.x - 3 + k * 1.5, s.z + d * 1.85, d < 0 ? 0 : Math.PI);
    b.at(s.x, back); b.add(R(4.6, 1.9, 0.1, 0.03), M.off, 0, 1.9, 0.28);
    pendant(b, s.x - 2, s.z, 3.6); pendant(b, s.x + 2, s.z, 3.6);
  }
  for (const d of [-1, 1]) plant(b, s.x + d * (s.w / 2 - 0.9), back + 1, 1, d > 0 ? 1 : 0);
  const light = new THREE.PointLight('#ffcf9a', 0, 15); light.userData.i = 70; light.position.set(s.x, 4, s.z); g.add(light);
  const dispose = finish(g, b, s, lounge ? t('Quiet room') : t('Small meeting room'));
  return { dispose() { dispose(); strip.dispose(); } };
}
