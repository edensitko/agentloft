import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, canvasTexture, rnd } from './materials.js';
import { FLOOR } from './nav.js';

// Street-level city. The office block is at the origin; parks sit on the camera's side so nothing hides the office.
const Y = -0.3, BX = 37, BZ = 30, ROAD = 14, PX = BX * 2 + ROAD, PZ = BZ * 2 + ROAD;
const park = (i, j) => (j === 1 && Math.abs(i) <= 1) || (i === -1 && j === 0);
const std = (o) => new THREE.MeshStandardMaterial(o);

function leafTexture() {
  const [g, t] = canvasTexture(256, 256); const c = ['#3f6b2f', '#4f7f38', '#2f5426', '#658f45', '#39602c'];
  for (let i = 0; i < 190; i++) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 108; g.save(); g.translate(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); g.rotate(rnd() * 6.28); g.fillStyle = c[rnd() * 5 | 0]; g.beginPath(); g.ellipse(0, 0, 13, 5.5, 0, 0, 6.3); g.fill(); g.restore(); }
  return t;
}
function treeGeometry() {
  const leaf = [], trunk = [new THREE.CylinderGeometry(0.16, 0.3, 4, 8).translate(0, 2, 0).toNonIndexed()];
  for (let i = 0; i < 5; i++) { const b = new THREE.CylinderGeometry(0.06, 0.12, 2.4, 6); b.translate(0, 1.2, 0).rotateZ(0.6).rotateY(i * 1.26).translate(0, 3.2, 0); trunk.push(b.toNonIndexed()); }
  const n = new THREE.Vector3();
  for (let i = 0; i < 90; i++) {
    const q = new THREE.PlaneGeometry(1.9, 1.9), a = rnd() * 6.28, v = rnd() * 2 - 1, r = 1.4 + rnd() * 1.1, x = Math.cos(a) * Math.sqrt(1 - v * v) * r, y = 5.6 + v * r * 0.85, z = Math.sin(a) * Math.sqrt(1 - v * v) * r;
    q.rotateX(rnd() * 6.28).rotateY(rnd() * 6.28).translate(x, y, z); n.set(x, y - 5, z).normalize(); // normals point out of the crown, so it is lit as one soft volume
    for (let k = 0; k < 4; k++) q.attributes.normal.setXYZ(k, n.x, n.y, n.z); leaf.push(q.toNonIndexed());
  }
  return [mergeGeometries(trunk), mergeGeometries(leaf)];
}
/** A car built from its side profile: body with wheel arches, glasshouse, pillars, wheels, lights, trim and plates. */
function carGeometry(t) {
  const flat = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); n.morphAttributes = {}; return n; };
  const extrude = (pts, w, bevel = 0.06) => { const s = new THREE.Shape(); pts.forEach((p, k) => (p.length === 2 ? (k ? s.lineTo(...p) : s.moveTo(...p)) : s.quadraticCurveTo(...p))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: w - bevel * 2, bevelEnabled: true, bevelSize: bevel * 0.7, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 }); g.translate(0, 0, -(w - bevel * 2) / 2).rotateY(-Math.PI / 2); return g; };
  const box = (w, h, d, x, y, z, rx = 0, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).translate(x, y, z), rbox = (w, h, d, x, y, z, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, r).translate(x, y, z);
  const { L, W, hood, belt, roof, wf, wr, r, ws, rs, rf, rr } = t, F = L / 2, B = -L / 2, P = { paint: [], glass: [], black: [], chrome: [], tire: [], rim: [], head: [], tail: [], plate: [] };
  // body outline from the front bumper over the hood and boot, then back along the sill around both wheel arches
  const s = new THREE.Shape(); s.moveTo(F - 0.04, 0.3); s.quadraticCurveTo(F + 0.03, 0.5, F - 0.06, hood - 0.12); s.quadraticCurveTo(F - 0.25, hood, F - 0.75, hood + 0.04); s.lineTo(ws, belt); s.lineTo(rs, belt + 0.02); s.lineTo(B + 0.32, t.boot); s.quadraticCurveTo(B + 0.02, t.boot - 0.03, B, t.boot - 0.25); s.quadraticCurveTo(B - 0.03, 0.5, B + 0.06, 0.32);
  s.lineTo(wr - r - 0.09, 0.27); s.absarc(wr, 0.34, r + 0.09, Math.PI + 0.15, -0.15, true); s.lineTo(wf - r - 0.09, 0.27); s.absarc(wf, 0.34, r + 0.09, Math.PI + 0.15, -0.15, true); s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: W - 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.1, bevelSegments: 4, curveSegments: 14 }); body.translate(0, 0, -(W - 0.2) / 2).rotateY(-Math.PI / 2);
  const bp = body.attributes.position; for (let k = 0; k < bp.count; k++) { const y = bp.getY(k), z = bp.getZ(k), x = bp.getX(k), nose = Math.max(0, Math.abs(z) - F + 0.9) / 0.9; bp.setX(k, x * (1 - nose * nose * 0.1) * (1 - Math.max(0, y - 0.65) * 0.1)); } body.computeVertexNormals(); P.paint.push(body);
  // glasshouse narrows toward the roof
  const taper = (g) => { const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const h = Math.max(0, (p.getY(k) - belt) / (roof - belt)); p.setX(k, p.getX(k) * (1 - h * 0.15)); } g.computeVertexNormals(); return g; };
  P.glass.push(taper(extrude([[ws + 0.02, belt - 0.03], [rf, roof - 0.05], [rr, roof - 0.05], [rs + 0.02, belt - 0.03]], W - 0.2, 0.04)));
  P.paint.push(taper(extrude([[rf + 0.06, roof - 0.085], [rf - 0.1, roof - 0.012, rf - 0.25, roof], [rr + 0.2, roof], [rr + 0.05, roof - 0.012, rr - 0.05, roof - 0.085]], W - 0.19, 0.05)));
  const pillar = (z0, z1, w) => { for (const d of [-1, 1]) { const g = new THREE.BoxGeometry(0.05, 1, w), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const h = p.getY(k) + 0.5; p.setXYZ(k, d * (W / 2 - 0.1) * (1 - h * 0.15) + p.getX(k), belt - 0.02 + h * (roof - belt - 0.02), z0 + (z1 - z0) * h + p.getZ(k)); } g.computeVertexNormals(); P.paint.push(g); } };
  pillar(ws, rf, 0.09); pillar((ws + rs) / 2 + 0.05, (rf + rr) / 2, 0.1); pillar(rs, rr, t.cp);
  for (const d of [-1, 1]) {
    for (const z of [wf, wr]) { // tyre, rim, five spokes, hub
      const x = d * (W / 2 - 0.13), put = (g) => g.rotateY(d > 0 ? 0 : Math.PI).translate(x, r, z);
      P.tire.push(put(new THREE.TorusGeometry(r - 0.085, 0.1, 10, 26).rotateY(Math.PI / 2)), put(new THREE.CylinderGeometry(r - 0.09, r - 0.09, 0.16, 22).rotateZ(Math.PI / 2)));
      P.rim.push(put(new THREE.TorusGeometry(r - 0.13, 0.018, 6, 26).rotateY(Math.PI / 2).translate(0.09, 0, 0)), put(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12).rotateZ(Math.PI / 2).translate(0.1, 0, 0)));
      for (let k = 0; k < 5; k++) P.rim.push(put(new THREE.BoxGeometry(0.025, r - 0.13, 0.055).translate(0.09, (r - 0.13) / 2, 0).rotateX(k * Math.PI * 0.4)));
      P.black.push(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.3, 20).rotateZ(Math.PI / 2).translate(d * (W / 2 - 0.3), 0.35, z)); // dark wheel well
    }
    const sx = d * (W / 2 + 0.002);
    P.black.push(rbox(0.03, 0.13, wf - wr - r * 2 - 0.3, sx - d * 0.02, 0.28, (wf + wr) / 2, 0.01)); // sill
    for (const z of [ws - 0.15, (ws + rs) / 2 + 0.05, rs + 0.12]) P.black.push(box(0.012, belt - 0.42, 0.012, sx - d * 0.005, (belt + 0.36) / 2, z)); // door gaps
    P.chrome.push(box(0.02, 0.022, ws - rs - 0.1, d * (W / 2 - 0.085), belt + 0.005, (ws + rs) / 2)); for (const z of [(ws + rs) / 2 + 0.28, rs + 0.35]) P.chrome.push(rbox(0.03, 0.03, 0.17, sx, belt - 0.14, z, 0.012)); // trim, handles
    P.paint.push(rbox(0.17, 0.12, 0.1, d * (W / 2 + 0.08), belt + 0.07, ws - 0.2, 0.04)); P.glass.push(box(0.13, 0.085, 0.01, d * (W / 2 + 0.08), belt + 0.07, ws - 0.255));
    P.head.push(rbox(0.42, 0.11, 0.16, d * (W / 2 - 0.34), hood - 0.19, F - 0.03, 0.04)); P.tail.push(rbox(0.4, 0.12, 0.12, d * (W / 2 - 0.3), t.boot - 0.2, B - 0.02, 0.03));
    P.black.push(rbox(0.32, 0.12, 0.06, d * (W / 2 - 0.36), 0.42, F - 0.02, 0.03)); P.chrome.push(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12).rotateX(Math.PI / 2).translate(d * (W / 2 - 0.45), 0.29, B));
  }
  P.black.push(rbox(W - 0.95, 0.2, 0.06, 0, hood - 0.26, F, 0.03), rbox(W - 0.5, 0.14, 0.07, 0, 0.36, F, 0.03), rbox(W - 0.35, 0.18, 0.07, 0, 0.38, B, 0.03), box(W - 0.3, 0.06, L - 0.6, 0, 0.24, 0)); for (let k = 0; k < 3; k++) P.chrome.push(box(W - 1.0, 0.012, 0.02, 0, hood - 0.31 + k * 0.05, F + 0.03));
  P.plate.push(box(0.52, 0.11, 0.015, 0, 0.45, F + 0.045), box(0.52, 0.11, 0.015, 0, t.boot - 0.36, B - 0.035)); P.black.push(box(0.012, 0.012, 0.5, 0, roof + 0.01, 0));
  if (t.rails) for (const d of [-1, 1]) P.black.push(rbox(0.05, 0.05, rf - rr + 0.1, d * (W / 2 - 0.27), roof + 0.05, (rf + rr) / 2, 0.02));
  return Object.fromEntries(Object.entries(P).map(([k, l]) => [k, mergeGeometries(l.map(flat))]));
}
const CARS = [
  { L: 4.6, W: 1.84, hood: 0.86, belt: 0.95, roof: 1.44, boot: 0.98, wf: 1.38, wr: -1.36, r: 0.33, ws: 0.88, rs: -1.55, rf: 0.22, rr: -0.9, cp: 0.2 }, // sedan
  { L: 4.5, W: 1.9, hood: 1.0, belt: 1.1, roof: 1.68, boot: 1.08, wf: 1.36, wr: -1.34, r: 0.37, ws: 0.9, rs: -2.05, rf: 0.28, rr: -1.75, cp: 0.22, rails: true }, // SUV
  { L: 3.95, W: 1.76, hood: 0.9, belt: 0.98, roof: 1.48, boot: 0.96, wf: 1.2, wr: -1.2, r: 0.32, ws: 0.78, rs: -1.75, rf: 0.2, rr: -1.45, cp: 0.24 }, // hatchback
];

/** What is outside the windows. Names are shown through t() in the editor. `nature` places have open ground with a few roads instead of city blocks. */
export const OUTSIDE = {
  city: { name: 'City', cars: 44 },
  campus: { name: 'Green campus', nature: '#4c6632', cars: 10, trees: 520 },
  suburb: { name: 'Suburb', nature: '#587039', cars: 14, trees: 260, houses: true },
  beach: { name: 'Beach', nature: '#b99f6c', cars: 10, trees: 150, sea: true, palms: true },
  mountains: { name: 'Mountains', nature: '#465f2e', cars: 6, trees: 560, peaks: true },
};
/** A palm: a leaning trunk and drooping fronds. */
function palmGeometry() {
  const leaf = [], trunk = new THREE.CylinderGeometry(0.16, 0.28, 7, 8, 6).translate(0, 3.5, 0).toNonIndexed(), bend = (y) => (y / 7) ** 2 * 0.9, p = trunk.attributes.position;
  for (let k = 0; k < p.count; k++) p.setX(k, p.getX(k) + bend(p.getY(k))); trunk.computeVertexNormals();
  for (let i = 0; i < 11; i++) {
    const q = new THREE.PlaneGeometry(0.85, 3.6, 2, 6).translate(0, 1.8, 0), a = q.attributes.position;
    for (let k = 0; k < a.count; k++) { const l = a.getY(k) / 3.6, x = a.getX(k) * (1 - l * 0.75) * Math.min(1, 0.25 + l * 3); a.setXYZ(k, x, 0.75 * Math.sin(l * 2.2) - l * l * 1.7 - Math.abs(x) * 0.45, l * 3.1); }
    q.rotateY(i * 0.571 + (i % 2) * 0.2).translate(0.9, 6.9 - (i % 3) * 0.15, 0); q.computeVertexNormals(); leaf.push(q.toNonIndexed());
  }
  return [trunk, mergeGeometries(leaf)];
}
/** A ring of hills behind everything: grey rock, pale with distance, snow on top. */
function peaksGeometry() {
  const all = [], c = new THREE.Color();
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * 6.283 + rnd() * 0.12, d = 330 + rnd() * 70, h = 60 + rnd() * 75, r = 60 + rnd() * 30, g = new THREE.ConeGeometry(r, h, 18, 9).translate(0, h / 2 - 4, 0).toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3);
    const n = (x, y, z) => Math.sin(x * 0.11 + i) * Math.cos(z * 0.13 - i) * 5 + Math.sin(x * 0.31 + y * 0.2 + z * 0.27) * 2.2;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), e = n(x, y, z) * (1 - y / h * 0.5); p.setXYZ(k, x + e, y + e * 0.6, z + e); c.set(y > h * 0.66 + e ? '#eef2f5' : y > h * 0.3 ? '#8d939a' : '#6f8064').lerp(new THREE.Color('#b9cfe0'), 0.25); c.toArray(col, k * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.translate(Math.cos(a) * d, Y, Math.sin(a) * d); g.computeVertexNormals(); all.push(g);
  }
  return mergeGeometries(all);
}

/** The world outside, which can be swapped while the office is open. */
export function buildCity(scene) {
  let kind = 'city', mood = 'day', now = build(scene, kind);
  return {
    tick: (t) => now.tick(t),
    setMood(m) { mood = m; now.setMood(m); },
    get outside() { return kind; },
    setOutside(k) { const next = OUTSIDE[k] ? k : 'city'; if (next === kind) return false; now.dispose(); kind = next; now = build(scene, kind); now.setMood(mood); return true; },
  };
}
function build(scene, kind) {
  const E = OUTSIDE[kind];
  const g = new THREE.Group(); scene.add(g);
  const U = { day: { value: 1 }, sky: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(34, 52, -18).normalize() } };
  const inst = (geo, mat, list, shadow = false) => { if (!list.length) return { userData: {} }; const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(); list.forEach((t, i) => { o.position.set(t[0], t[1], t[2]); o.rotation.set(0, t[3] ?? 0, 0); const s = t[4] ?? 1; Array.isArray(s) ? o.scale.set(...s) : o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; g.add(m); return m; };
  // --- ground: asphalt, sidewalks, lawns, markings
  const noisy = (base, spread, rep) => { const [c, t] = canvasTexture(256, 256); c.fillStyle = base; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${rnd() * spread})`; c.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); } t.repeat.set(rep, rep); return t; };
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), std({ map: E.nature ? noisy(E.nature, 0.22, 110) : noisy('#4b4c4f', 0.16, 160), roughness: 0.95 })); asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = Y - 0.16; asphalt.receiveShadow = true; g.add(asphalt);
  const [pc, paving] = canvasTexture(256, 256); pc.fillStyle = '#a8a39a'; pc.fillRect(0, 0, 256, 256); for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) { const v = 155 + rnd() * 22; pc.fillStyle = `rgb(${v},${v - 5},${v - 13})`; pc.fillRect(x * 64 + 1.5, y * 64 + 1.5, 61, 61); }
  paving.repeat.set(30, 24);
  const walkMat = std({ map: paving, roughness: 0.95 }), [gc, grassT] = canvasTexture(256, 256); gc.fillStyle = '#6c8a49'; gc.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { gc.strokeStyle = `rgba(${40 + rnd() * 90},${80 + rnd() * 80},${30 + rnd() * 30},.5)`; const x = rnd() * 256, y = rnd() * 256; gc.beginPath(); gc.moveTo(x, y); gc.lineTo(x + rnd() * 3 - 1.5, y - 2 - rnd() * 4); gc.stroke(); } grassT.repeat.set(18, 14);
  const lawnMat = std({ map: grassT, roughness: 1 }), pathMat = std({ color: '#c9b795', roughness: 1 });
  const walks = [], lawns = [], paths = [], trees = [], bld = [], lamps = [], dashes = [], zebra = [], bench = [], hedges = [];
  const around = E.nature ? 0 : 3;
  for (let i = -around; i <= around; i++) for (let j = -around; j <= Math.min(2, around); j++) {
    const cx = i * PX, cz = j * PZ; walks.push(E.nature ? [0, Y - 0.085, 2, 0, [(FLOOR.w + 8) / (BX * 2), 1, (FLOOR.d + 14) / (BZ * 2)]] : [cx, Y - 0.085, cz]);
    for (let k = -2; k <= 2; k++) { if (Math.abs(i) < 3 && Math.abs(j) < 3) { lamps.push([cx + k * 15, Y, cz + BZ - 1.2, Math.PI / 2], [cx + k * 15, Y, cz - BZ + 1.2, -Math.PI / 2]); if ((i || j) && !E.nature) trees.push([cx + k * 15 + 7, Y, cz + BZ - 2, rnd() * 6, 0.7 + rnd() * 0.25], [cx + k * 15 + 7, Y, cz - BZ + 2, rnd() * 6, 0.7 + rnd() * 0.25]); } }
    if (!i && !j) continue;
    if (park(i, j)) {
      lawns.push([cx, Y - 0.03, cz]); paths.push([cx, Y + 0.0, cz, 0, [62, 1, 3]], [cx, Y + 0.0, cz, 0, [3, 1, 46]]);
      for (let k = 0; k < 34; k++) { const x = (rnd() - 0.5) * 60, z = (rnd() - 0.5) * 44; if (Math.abs(x) > 4 && Math.abs(z) > 4 && (j !== 1 || z > -10)) trees.push([cx + x, Y, cz + z, rnd() * 6, 0.75 + rnd() * 0.5]); }
      for (let k = -2; k <= 2; k++) if (k) bench.push([cx + k * 11, Y, cz + 2.4, 0]);
      continue;
    }
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) { if (rnd() < 0.06) continue; const near = j < 0 || i > 0, h = near ? 12 + rnd() ** 1.7 * 44 + (j < -1 ? 14 : 0) : 8 + rnd() * 12, w = 14.5 + rnd() * 3, d = 13.5 + rnd() * 2.8; bld.push([cx - 27 + a * 18, Y, cz - 17.5 + b * 17.5, 0, [w, h, d]]); }
  }
  const houses = [], roofs = [], fallen = [];
  if (E.nature) {
    // open ground: the streets around the office are laid on it (by the sea only the two that run along the shore)
    const road = std({ map: noisy('#4b4c4f', 0.16, 40), roughness: 0.95 }), strip = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), road); m.rotation.x = -Math.PI / 2; m.position.set(x, Y - 0.154, z); m.receiveShadow = true; g.add(m); };
    for (const k of [-0.5, 0.5]) { strip(900, ROAD, 0, k * PZ); if (!E.sea) strip(ROAD, 900, k * PX, 0); }
    const bx = FLOOR.w / 2 + 6, bz = FLOOR.d / 2 + 9, free = (x, z, m) => [-0.5, 0.5].every((k) => Math.abs(z - k * PZ) > ROAD / 2 + m && (E.sea || Math.abs(x - k * PX) > ROAD / 2 + m)) && !(Math.abs(x) < bx + m && Math.abs(z) < bz + m);
    const shore = -PZ / 2 - 46, ok = (x, z, m) => free(x, z, m) && (!E.sea || z > shore + 8) && !(z > BZ && z < 78 && Math.abs(x) < 46); // the camera's side stays open
    if (E.houses) for (let i = -4; i <= 4; i++) for (let j = -5; j <= 3; j++) { const x = i * 29 + (rnd() - 0.5) * 5, z = j * 27 + (rnd() - 0.5) * 5; if (!ok(x, z, 10)) continue; const w = 10 + rnd() * 3, d = 8.5 + rnd() * 2, h = rnd() < 0.5 ? 3.6 : 6.4, r = rnd() < 0.5 ? 0 : Math.PI / 2; houses.push([x, Y, z, r, [w, h, d]]); roofs.push([x, Y + h, z, r, [w + 1.2, 2.6, d + 1.2]]); fallen.push([x, z]); }
    for (let k = 0, left = E.trees; left > 0 && k < 4000; k++) { const x = (rnd() - 0.5) * 420, z = (rnd() - 0.5) * 380, near = Math.hypot(x, z) < 130; if (!ok(x, z, 4) || (near && rnd() < 0.35) || fallen.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue; trees.push([x, Y, z, rnd() * 6, 0.7 + rnd() * 0.55]); left--; }
    if (E.sea) {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(1200, 600), new THREE.MeshPhysicalMaterial({ color: '#2b7f98', roughness: 0.22, metalness: 0.1, clearcoat: 0.6, envMapIntensity: 1.3 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, Y - 0.1, shore - 300); g.add(sea);
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(1200, 3.2), std({ color: '#f3f7f6', roughness: 1, transparent: true, opacity: 0.75 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, Y - 0.09, shore); g.add(foam);
    }
    if (E.peaks) { const m = new THREE.Mesh(peaksGeometry(), std({ vertexColors: true, roughness: 1, flatShading: true })); m.userData.noCollide = true; g.add(m); }
    for (const k of [-0.5, 0.5]) { for (let x = -320; x < 320; x += 7) dashes.push([x, Y - 0.15, k * PZ, 0, [3, 1, 0.16]]); if (!E.sea) for (let z = -260; z < 260; z += 7) dashes.push([k * PX, Y - 0.15, z, 0, [0.16, 1, 3]]); }
  } else {
  for (let i = -3; i <= 4; i++) { const x = (i - 0.5) * PX; for (let z = -260; z < 200; z += 7) if (Math.abs(((z / PZ + 100.5) % 1) - 0.5) * PZ < BZ - 2) dashes.push([x, Y - 0.15, z, 0, [0.16, 1, 3]]); }
  for (let j = -3; j <= 3; j++) { const z = (j - 0.5) * PZ; for (let x = -320; x < 320; x += 7) if (Math.abs(((x / PX + 100.5) % 1) - 0.5) * PX < BX - 2) dashes.push([x, Y - 0.15, z, 0, [3, 1, 0.16]]); }
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -6; k <= 6; k++) for (const s of [-1, 1]) { zebra.push([i * PX + s * (BX - 3.5), Y - 0.15, (j - 0.5) * PZ + k, 0, [3.2, 1, 0.5]]); zebra.push([(i - 0.5) * PX + k, Y - 0.15, j * PZ + s * (BZ - 3.5), 0, [0.5, 1, 3.2]]); }
  }
  inst(new THREE.BoxGeometry(BX * 2, 0.15, BZ * 2), walkMat, walks); inst(new THREE.BoxGeometry(BX * 2 - 7, 0.1, BZ * 2 - 7), lawnMat, lawns); inst(new THREE.BoxGeometry(1, 0.06, 1), pathMat, paths);
  const paint = std({ color: '#e4e1d8', roughness: 0.9 }); inst(new THREE.BoxGeometry(1, 0.02, 1), paint, dashes); inst(new THREE.BoxGeometry(1, 0.02, 1), paint, zebra);
  // --- the plot around the office: lawn strips, hedges, trees by the entrance
  for (const [cx, w] of [[-(FLOOR.w / 2 + 5) / 2, FLOOR.w / 2 - 7], ...(FLOOR.w > 46 ? [[23, 11]] : [])]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 4), lawnMat); m.position.set(cx, Y, FLOOR.d / 2 + 4.4); m.receiveShadow = true; g.add(m); for (let k = -1; k <= 1; k++) trees.push([cx + k * w * 0.36, Y, FLOOR.d / 2 + 4.6, k, 0.55]); hedges.push([cx, Y + 0.4, FLOOR.d / 2 + 2.2, 0, [w, 0.9, 0.8]]); }
  for (let k = -2; k <= 2; k++) { trees.push([-FLOOR.w / 2 - 4.4, Y, k * 9, k, 0.62]); trees.push([FLOOR.w / 2 + 4.4, Y, k * 9 - 3, k, 0.8]); trees.push([k * 12 + 4, Y, -FLOOR.d / 2 - 4.6, k, 0.8]); }
  inst(new THREE.BoxGeometry(1, 1, 1), M.leafA, hedges, true);
  const [tr, lf] = E.palms ? palmGeometry() : treeGeometry(), lt = leafTexture();
  inst(tr, M.trunk, trees, true); const lm = E.palms ? std({ color: '#4f7d3a', side: THREE.DoubleSide, roughness: 0.8 }) : std({ map: lt, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }); inst(lf, lm, trees, true).userData.noCollide = true;
  inst(mergeGeometries([new THREE.BoxGeometry(2.2, 0.1, 0.6).translate(0, 0.6, 0), new THREE.BoxGeometry(2.2, 0.6, 0.08).translate(0, 1, -0.3), new THREE.BoxGeometry(0.1, 0.6, 0.6).translate(-0.9, 0.3, 0), new THREE.BoxGeometry(0.1, 0.6, 0.6).translate(0.9, 0.3, 0)]), M.walnut, bench, true);
  inst(mergeGeometries([new THREE.CylinderGeometry(0.07, 0.12, 7, 8).translate(0, 3.5, 0), new THREE.BoxGeometry(1.9, 0.08, 0.14).translate(0.9, 7, 0)]), M.metal, lamps, true);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffd9a0' }); inst(new THREE.BoxGeometry(0.7, 0.07, 0.26).translate(1.6, 6.94, 0), bulb, lamps);
  // --- buildings
  const windowM = std({ color: '#26323a', roughness: 0.15, metalness: 0.3, emissive: '#ffc880', emissiveIntensity: 0 });
  const facade = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute float seed; varying vec3 vL,vN,vS,vW; varying float vT,vD; void main(){ vS=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz)); vL=position*vS; vN=normal; vT=seed; vec4 w=modelMatrix*instanceMatrix*vec4(position,1.); vW=w.xyz; vec4 p=viewMatrix*w; vD=-p.z; gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform float day; uniform vec3 sky,sunCol,sunDir; varying vec3 vL,vN,vS,vW; varying float vT,vD;
      float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
      void main(){
        vec3 wall = vT<.2?vec3(.62,.42,.33): vT<.4?vec3(.80,.76,.69): vT<.6?vec3(.55,.56,.57): vT<.8?vec3(.71,.65,.56): vec3(.34,.40,.45);
        wall*=.9+.2*h(vec2(floor(vT*91.),3.)); float glassy=step(.8,vT);
        float dif=max(dot(vN,sunDir),0.), amb=.42+.18*vN.y; vec3 alb=wall; vec3 emit=vec3(0.); float refl=0.;
        if(abs(vN.y)<.5){
          bool sx=abs(vN.x)>.5; float u=sx?vL.z:vL.x, W=sx?vS.z:vS.x, y=vL.y; float fl=3.4, n=max(2.,floor(W/(2.6+fract(vT*7.)*1.4)));
          vec2 c=vec2((u/W+.5)*n, (y-4.2)/fl), id=floor(c), f=fract(c); float ground=step(y,4.2);
          float m=mix(.2,.05,glassy); vec2 lo=vec2(m,mix(.24,.06,glassy)), hi=vec2(1.-m,mix(.86,.97,glassy));
          float win=step(lo.x,f.x)*step(f.x,hi.x)*step(lo.y,f.y)*step(f.y,hi.y)*(1.-ground)*step(y,vS.y-1.4);
          float fr=win*(1.-step(lo.x+.03,f.x)*step(f.x,hi.x-.03)*step(lo.y+.04,f.y)*step(f.y,hi.y-.04)); fr=max(fr,win*(1.-step(.02,abs(f.x-.5)))*(1.-glassy));
          alb*=1.-.10*step(.955,f.y)*(1.-glassy); alb*=.94+.06*h(floor(vec2(u*1.5,y*3.)));
          float shade=win*smoothstep(hi.y,hi.y-.16,f.y); // recessed glass: shadow under the lintel
          vec3 gl=mix(vec3(.05,.07,.09),sky*.75,.28+.4*h(id+vT*9.)*.6+.25*clamp(y/vS.y,0.,1.)); float cur=step(.62,h(id+vT*33.))*step(f.x,lo.x+.22+.2*h(id)); gl=mix(gl,vec3(.72,.69,.62),cur*.55*(1.-glassy));
          if(win>.5){ alb=mix(gl*(.55+.45*shade),vec3(.13,.13,.14),fr); refl=1.-fr; }
          if(ground>.5&&y>.5&&y<3.5){ float sh=step(.06,fract(c.x*.5))*step(fract(c.x*.5),.94); vec3 shop=mix(vec3(.10,.11,.12),vec3(.75,.62,.42),.25+.5*h(vec2(floor(c.x*.5),vT))); alb=mix(vec3(.2),shop,sh); emit+=sh*vec3(1.,.8,.5)*(.10+.8*(1.-day))*h(vec2(floor(c.x*.5),vT+2.)); }
          if(y>3.5&&y<4.2){ float k=h(vec2(floor(c.x*.5),floor(vT*77.))); alb=k<.3?vec3(.55,.2,.17):k<.6?vec3(.2,.34,.3):vec3(.3,.31,.34); }
          emit+=win*(1.-fr)*(1.-day)*step(.6,h(id+floor(vT*97.)))*mix(vec3(1.,.72,.4),vec3(.8,.88,1.),step(.8,h(id+4.)))*(.25+.5*h(id+8.));
          alb*=mix(.72,1.,smoothstep(0.,5.,y)); if(y>vS.y-.5) alb=wall*.7;
        } else { alb=mix(vec3(.5,.49,.47),vec3(.4,.4,.41),h(vec2(floor(vT*31.),1.))); vec2 q=abs(vL.xz)-vS.xz*.5; alb*=mix(1.15,.9,step(max(q.x,q.y),-.6)); }
        vec3 col=alb*(sunCol*dif*mix(1.,.35,refl)+mix(sky,vec3(1.),.45)*amb*mix(.16,.95,day))+emit; col+=refl*sky*.10*day;
        gl_FragColor=vec4(mix(col,sky,smoothstep(130.,360.,vD)*.92),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), seeds = Float32Array.from(bld, () => rnd()); unit.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 1)); inst(unit, facade, bld);
  const roof = []; for (const [x, , z, , [w, h, d]] of bld) for (let k = 0; k < 3; k++) roof.push([x + (rnd() - 0.5) * w * 0.6, Y + h, z + (rnd() - 0.5) * d * 0.6, 0, [1.5 + rnd() * 3, 0.8 + rnd() * 1.8, 1.5 + rnd() * 2.5]]);
  inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), std({ color: '#8b8a87', roughness: 0.9 }), roof);
  if (houses.length) { // homes: plastered walls, a hipped roof, a door and lit windows on the long sides
    const wall = inst(unit.clone().deleteAttribute('seed'), std({ color: '#fff', roughness: 0.9 }), houses, true), tones = ['#e9e2d3', '#d8cdb8', '#cfd6d6', '#e4d3c2', '#f0ece2']; houses.forEach((_, i) => wall.setColorAt(i, new THREE.Color(tones[i % 5])));
    const hip = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0); inst(hip, std({ color: '#8a4b36', roughness: 0.85, flatShading: true }), roofs, true);
    const panes = [], doors = []; for (const [x, , z, r, [w, h, d]] of houses) for (const s of [-1, 1]) for (let f = 0; f < (h > 5 ? 2 : 1); f++) for (const k of [-0.28, 0.28, ...(f ? [0] : [])]) { const lx = k * w, lz = s * (d / 2 + 0.02); panes.push([x + lx * Math.cos(r) + lz * Math.sin(r), Y + 1.7 + f * 2.8, z - lx * Math.sin(r) + lz * Math.cos(r), r]); }
    for (const [x, , z, r, [, , d]] of houses) doors.push([x + (d / 2 + 0.03) * Math.sin(r), Y + 1.05, z + (d / 2 + 0.03) * Math.cos(r), r]);
    inst(new THREE.BoxGeometry(1.5, 1.2, 0.06), windowM, panes); inst(new THREE.BoxGeometry(1.1, 2.1, 0.06), std({ color: '#5a3b28', roughness: 0.7 }), doors);
  }
  // --- sky
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { sky: U.sky, top: { value: new THREE.Color() } }, vertexShader: 'varying vec3 v; void main(){ v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: `uniform vec3 sky,top; varying vec3 v; void main(){ gl_FragColor=vec4(mix(sky,top,smoothstep(-.02,.5,normalize(v).y)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }` });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), skyMat));
  // --- traffic
  const N = E.cars, TOTAL = N + 14, cols = ['#c9ccd0', '#15171b', '#7d1518', '#23426e', '#e9e8e4', '#5a5f66', '#2f3f37', '#8a8f96', '#f2f1ee', '#3a3d42'];
  const cars = Array.from({ length: N }, (_, i) => { const alongX = !!E.sea || i % 2 === 0, lines = E.nature ? 2 : 3, line = alongX ? [-0.5, 0.5, -1.5][(i / 2 | 0) % lines] * PZ : [-0.5, 0.5, 1.5][(i / 2 | 0) % lines] * PX, dir = (i >> 2) & 1 ? 1 : -1; return { alongX, line, dir, at: rnd() * 420 - 210, v: 9 + rnd() * 5, now: 9 }; });
  const paintM = new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: 0.32, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.9 }), headM = new THREE.MeshBasicMaterial(), tailM = new THREE.MeshBasicMaterial();
  const mats = { paint: paintM, glass: new THREE.MeshPhysicalMaterial({ color: '#0d1216', roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 2.4 }), black: std({ color: '#121316', roughness: 0.75 }), chrome: M.chrome, tire: std({ color: '#17181a', roughness: 0.95 }), rim: std({ color: '#aeb2b8', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.6 }), head: headM, tail: tailM, plate: std({ color: '#f2c21c', roughness: 0.6 }) };
  // every third car is one model; each model is drawn once per material
  const models = CARS.map((t, k) => { const n = Math.ceil((TOTAL - k) / 3); return Object.entries(carGeometry(t)).map(([key, geo]) => { const m = new THREE.InstancedMesh(geo, mats[key], n); m.castShadow = key === 'paint' || key === 'glass'; m.receiveShadow = key === 'paint'; m.frustumCulled = false; m.userData.noCollide = true; if (key === 'paint') for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(cols[((i * 3 + k) * 7) % cols.length])); g.add(m); return m; }); });
  const parts = models.flat(), o = new THREE.Object3D(), put = (i, x, z, r) => { o.position.set(x, Y - 0.15, z); o.rotation.y = r; o.updateMatrix(); for (const p of models[i % 3]) p.setMatrixAt(i / 3 | 0, o.matrix); };
  for (let k = 0; k < 14; k++) put(N + k, -27 + (k % 7) * 8.5 + (k * 37 % 5) * 0.2, (k < 7 ? 1 : -1) * (BZ + 1.15), k < 7 ? -Math.PI / 2 : Math.PI / 2); // parked along the kerb, facing with the traffic
  let last = 0;
  function tick(t) {
    const dt = Math.min(0.1, t - last); last = t;
    cars.forEach((c, i) => {
      let gap = 1e9; for (const d of cars) if (d !== c && d.alongX === c.alongX && d.line === c.line && d.dir === c.dir) { const x = (d.at - c.at) * c.dir; if (x > 0 && x < gap) gap = x; } // keep distance
      c.now += (Math.min(c.v, Math.max(0, (gap - 6.5) * 1.2)) - c.now) * Math.min(1, dt * 3); c.at += c.dir * c.now * dt; if (c.at > 230) c.at = -230; if (c.at < -230) c.at = 230;
      const side = c.line + (c.alongX ? c.dir : -c.dir) * 3; c.alongX ? put(i, c.at, side, c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : put(i, side, c.at, c.dir > 0 ? 0 : Math.PI);
    });
    for (const p of parts) p.instanceMatrix.needsUpdate = true;
  }
  tick(0);
  return {
    tick,
    setMood(m) {
      const k = { day: ['#b9cfe0', '#5f93c9', 1, '#fff0d8', 0.95], sunset: ['#e0a888', '#7d6a94', 0.55, '#ff9a5c', 0.9], night: ['#1c2233', '#070a14', 0, '#8ea6e0', 0.1] }[m];
      U.sky.value.set(k[0]); skyMat.uniforms.top.value.set(k[1]); U.day.value = k[2]; U.sunCol.value.set(k[3]).multiplyScalar(k[4]);
      const n = 1 - k[2]; windowM.emissiveIntensity = n * 0.9; bulb.color.set('#ffd9a0').multiplyScalar(0.6 + n * 1.8); headM.color.set('#fff3dc').multiplyScalar(0.8 + n * 2); tailM.color.set('#c01818').multiplyScalar(0.6 + n * 2);
    },
    dispose() {
      const shared = new Set(Object.values(M)), mats = new Set([paintM, headM, tailM]);
      g.traverse((m) => { if (!m.isMesh) return; m.geometry.dispose(); for (const x of [m.material].flat()) if (!shared.has(x)) mats.add(x); m.dispose?.(); });
      for (const x of mats) { x.map?.dispose(); x.dispose(); } g.removeFromParent();
    },
  };
}
