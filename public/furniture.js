import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, rnd } from './materials.js';

const cache = new Map();
const memo = (k, f) => cache.get(k) ?? cache.set(k, f()).get(k);
export const B = (w, h, d) => memo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const R = (w, h, d, r = 0.04) => memo(`r${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) < 0.7 ? 1 : 2, r));
export const C = (a, b, h, n = 14) => memo(`c${a},${b},${h},${n}`, () => new THREE.CylinderGeometry(a, b, h, n));
const T = (r, t, arc = Math.PI * 2) => memo(`t${r},${t},${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));

/** A leaf that tapers, folds along its midrib and droops. */
function leaf(len, wid, droop) {
  return memo(`l${len},${wid},${droop}`, () => {
    const g = new THREE.PlaneGeometry(1, 1, 2, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, v = p.getY(i) + 0.5, w = Math.sin(Math.PI * Math.pow(v, 0.75)) * wid;
      p.setXYZ(i, u * w, v * len * (1 - droop * v * 0.35), Math.abs(u) * w * 0.35 + droop * v * v * len * 0.7);
    }
    g.computeVertexNormals(); return g;
  });
}
export function plant(b, x, z, s = 1, type = 0) {
  b.at(x, z, rnd() * 6, s);
  b.add(C(0.5, 0.36, 0.85, 28), M.pot, 0, 0.43, 0).add(C(0.46, 0.46, 0.04, 24), M.soil, 0, 0.85, 0).add(T(0.49, 0.03), M.pot, 0, 0.86, 0, Math.PI / 2);
  const mats = [M.leafA, M.leafB, M.leafC];
  if (type === 0) { // rubber-tree: trunk with leaves up its length
    b.add(C(0.04, 0.07, 1.7, 8), M.trunk, 0, 1.6, 0);
    for (let i = 0; i < 34; i++) { const a = i * 2.4, y = 1.15 + i / 34 * 1.35, t = 0.55 + rnd() * 0.65; b.add(leaf(0.85, 0.2, 0.7), mats[i % 3], Math.cos(a) * 0.04, y, Math.sin(a) * 0.04, t, -a, 0, 0.75 + rnd() * 0.4); }
  } else for (let i = 0; i < 26; i++) { // palm-like rosette
    const a = i * 2.4; b.add(leaf(1.5, 0.15, 1), mats[i % 3], 0, 0.85, 0, 0.1 + (i / 26) * 0.75, a, 0, 0.75 + rnd() * 0.35, 0.8 + rnd() * 0.4, 1);
  }
}
export function taskChair(b, x, z, ry = 0, cloth = M.mesh) {
  b.at(x, z, ry);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; b.add(R(0.07, 0.05, 0.42, 0.02), M.chrome, Math.sin(a) * 0.2, 0.12, Math.cos(a) * 0.2, 0, a).add(C(0.06, 0.06, 0.06, 10), M.plastic, Math.sin(a) * 0.4, 0.06, Math.cos(a) * 0.4, 0, a, Math.PI / 2); }
  b.add(C(0.045, 0.045, 0.4, 12), M.chrome, 0, 0.32, 0).add(R(0.72, 0.1, 0.7, 0.05), cloth, 0, 0.58, 0);
  b.add(R(0.66, 0.8, 0.06, 0.03), cloth, 0, 1.12, -0.4, -0.12).add(R(0.08, 0.5, 0.05, 0.02), M.plastic, 0, 0.82, -0.43, -0.1);
  for (const s of [-1, 1]) b.add(R(0.08, 0.04, 0.4, 0.02), M.plastic, s * 0.42, 0.86, -0.02).add(R(0.04, 0.3, 0.06, 0.015), M.plastic, s * 0.42, 0.7, -0.05);
}
export function cafeChair(b, x, z, ry) {
  b.at(x, z, ry);
  b.add(R(0.62, 0.06, 0.6, 0.03), M.walnut, 0, 0.6, 0).add(R(0.6, 0.36, 0.05, 0.025), M.walnut, 0, 1.06, -0.32, -0.15);
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(C(0.022, 0.022, 0.6, 8), M.metal, a * 0.26, 0.3, c * 0.25, c * -0.06, 0, a * 0.06);
  for (const a of [-1, 1]) b.add(C(0.02, 0.02, 0.6, 8), M.metal, a * 0.24, 0.85, -0.3, -0.12);
}
/** Returns nothing; the live screen is added separately so it can switch on and off. */
export function desk(b, x, z, i, top = M.oak, cloth = M.mesh) {
  taskChair(b, x, z, (i % 3 - 1) * 0.05, cloth); b.at(x, z - 0.25);
  b.add(R(2.2, 0.06, 1.05, 0.02), top, 0, 0.96, 1.08);
  for (const s of [-1, 1]) b.add(R(0.06, 0.94, 0.06, 0.01), M.metal, s * 1.0, 0.47, 0.64).add(R(0.06, 0.94, 0.06, 0.01), M.metal, s * 1.0, 0.47, 1.5).add(R(0.05, 0.05, 0.9, 0.01), M.metal, s * 1.0, 0.9, 1.07);
  b.add(R(0.5, 0.62, 0.7, 0.02), M.white, 0.72, 0.36, 1.1); for (const y of [0.22, 0.42, 0.6]) b.add(B(0.16, 0.02, 0.02), M.metal, 0.72, y, 0.74);
  b.add(R(1.1, 0.66, 0.045, 0.02), M.plastic, 0, 1.5, 1.36).add(B(0.08, 0.34, 0.04), M.metal, 0, 1.15, 1.39).add(R(0.36, 0.02, 0.24, 0.01), M.metal, 0, 1.0, 1.38);
  b.add(R(0.62, 0.025, 0.2, 0.01), M.plastic, 0, 1.005, 0.82).add(R(0.1, 0.03, 0.15, 0.015), M.white, 0.46, 1.005, 0.82);
  if (i % 2) b.add(C(0.06, 0.05, 0.13, 16), M.white, -0.75, 1.06, 0.85); else b.add(B(0.26, 0.03, 0.34), M.paper, -0.7, 1.0, 0.9, 0, 0.2).add(B(0.24, 0.03, 0.32), M.bookB, -0.7, 1.03, 0.9, 0, -0.1);
  if (i % 3 === 0) b.add(C(0.1, 0.12, 0.03, 16), M.metal, 0.85, 1.0, 1.3).add(C(0.012, 0.012, 0.5, 6), M.metal, 0.85, 1.25, 1.3, 0, 0, 0.2).add(C(0.05, 0.12, 0.14, 16), M.metal, 0.72, 1.5, 1.22, 0.5);
}
export function shelf(b, x, z, w = 3) {
  b.at(x, z); for (const y of [0.05, 0.65, 1.25, 1.85]) b.add(B(w, 0.05, 0.4), M.walnut, 0, y, 0);
  for (const s of [-1, 1]) b.add(B(0.05, 1.85, 0.4), M.walnut, s * w / 2, 0.93, 0);
  const books = [M.bookA, M.bookB, M.bookC, M.bookD];
  for (const y of [0.08, 0.68, 1.28]) { let px = -w / 2 + 0.12; while (px < w / 2 - 0.2) { if (rnd() < 0.16) { px += 0.3; continue; } const bw = 0.05 + rnd() * 0.06, h = 0.3 + rnd() * 0.16; b.add(B(1, 1, 1), books[rnd() * 4 | 0], px + bw / 2, y + h / 2, 0, 0, 0, 0, bw, h, 0.28); px += bw + 0.006; } }
}
/** Furniture that blocks walking reports its footprint here while a room is being built. */
export const solids = { list: null };
export function sofa(b, x, z, ry, w) {
  solids.list?.push({ x, z, ry, w: w + 0.5, d: 1.3 });
  b.at(x, z, ry); const n = Math.max(1, Math.round(w / 1.25)), cw = w / n;
  b.add(R(w + 0.1, 0.2, 1.22, 0.05), M.sofa, 0, 0.3, 0).add(R(w + 0.1, 0.62, 0.22, 0.08), M.sofa, 0, 0.62, -0.52, -0.06); // frame and back
  for (const s of [-1, 1]) { b.add(R(0.26, 0.5, 1.22, 0.11), M.sofa, s * (w / 2 + 0.16), 0.5, 0).add(R(0.3, 0.1, 1.26, 0.05), M.sofa, s * (w / 2 + 0.16), 0.76, 0); for (const zz of [-0.5, 0.5]) b.add(C(0.03, 0.022, 0.2, 8), M.walnut, s * (w / 2 + 0.05), 0.1, zz, 0, 0, s * 0.12); }
  for (let i = 0; i < n; i++) { const cx = (i + 0.5) * cw - w / 2; // a seat cushion and a leaning back cushion per place
    b.add(R(cw - 0.03, 0.2, 0.92, 0.09), M.sofa, cx, 0.5, 0.12, -0.02).add(R(cw - 0.06, 0.5, 0.24, 0.11), M.sofa, cx, 0.85, -0.3, -0.2); }
  b.add(R(0.46, 0.44, 0.16, 0.08), M.cushion, w / 2 - 0.3, 0.8, -0.1, -0.35, -0.3).add(R(0.4, 0.38, 0.14, 0.07), M.linen ?? M.cushion, -w / 2 + 0.32, 0.78, -0.08, -0.3, 0.35);
}

export function pendant() {} // hanging lamps were removed: they got in the way of the view

/** Long planter with dense greenery, used between team areas. */
export function planter(b, x, z, ry, len) {
  b.at(x, z, ry); b.add(R(len, 0.62, 0.55, 0.02), M.oak, 0, 0.33, 0).add(B(len - 0.1, 0.04, 0.45), M.soil, 0, 0.64, 0);
  const mats = [M.leafA, M.leafB, M.leafC], n = Math.round(len * 11);
  for (let i = 0; i < n; i++) b.add(leaf(0.75, 0.13, 0.6), mats[i % 3], (i / n - 0.5) * (len - 0.3), 0.62, (rnd() - 0.5) * 0.3, 0.1 + rnd() * 0.6, rnd() * 6.28, 0, 0.75 + rnd() * 0.5);
}
