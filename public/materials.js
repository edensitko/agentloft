import * as THREE from 'three';

export function canvasTexture(w, h, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return [c.getContext('2d'), t];
}
let seed = 7; export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function tex(size, draw, rx = 1, ry = rx, srgb = true) { const [g, t] = canvasTexture(size, size, srgb); draw(g, size); t.repeat.set(rx, ry); return t; }
const noise = (g, s, n, a, dark = '0,0,0', light = '255,255,255') => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? dark : light},${rnd() * a})`; const r = 1 + rnd() * 2; g.fillRect(rnd() * s, rnd() * s, r, r); } };

const woodDraw = (base) => (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * s, d = rnd() < 0.6; g.strokeStyle = d ? `rgba(40,18,5,${rnd() * 0.22})` : `rgba(255,215,165,${rnd() * 0.12})`; g.lineWidth = 0.5 + rnd() * 2;
    g.beginPath(); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x / s * Math.PI * 2 + i) * 4); g.stroke();
  }
};
const plankDraw = (g, s) => {
  for (let r = 0; r < 8; r++) for (let k = -1; k < 2; k++) {
    const w = s * 0.75, x = k * w + (r % 3) * s * 0.25, v = rnd() * 26, y = r * s / 8;
    g.fillStyle = `rgb(${118 + v},${80 + v * 0.8},${52 + v * 0.6})`; g.fillRect(x, y, w, s / 8);
    for (let i = 0; i < 16; i++) { g.strokeStyle = `rgba(40,20,8,${rnd() * 0.2})`; const yy = y + rnd() * s / 8; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy + (rnd() - 0.5) * 5); g.stroke(); }
    g.strokeStyle = 'rgba(25,12,6,.6)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, s / 8); g.lineWidth = 1;
  }
};
const stoneDraw = (g, s) => {
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
    const v = 148 + rnd() * 10; g.fillStyle = `rgb(${v},${v - 9},${v - 18})`; g.fillRect(x * s / 2, y * s / 2, s / 2, s / 2);
  }
  for (let i = 0; i < 60; i++) { const x = rnd() * s, y = rnd() * s, r = 30 + rnd() * 90, q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(${rnd() < 0.5 ? '70,55,48' : '235,222,205'},.025)`); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, s, s); }
  noise(g, s, 9000, 0.05);
  g.strokeStyle = 'rgba(70,58,50,.5)'; g.lineWidth = 2; for (const k of [0, s / 2]) { g.strokeRect(k, -2, s / 2, s + 4); g.strokeRect(-2, k, s + 4, s / 2); }
};
const weave = (g, s) => { g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, s, s); for (let i = 0; i < s; i += 4) for (let j = 0; j < s; j += 4) { g.fillStyle = `rgba(0,0,0,${((i + j) / 4 % 2 ? 0.28 : 0.06) + rnd() * 0.12})`; g.fillRect(i, j, 4, 4); } };
export const fabricBump = tex(128, weave, 4, 4, false);
const plaster = tex(256, (g, s) => { g.fillStyle = '#999'; g.fillRect(0, 0, s, s); noise(g, s, 8000, 0.16); }, 2, 1, false);

const S = (o) => new THREE.MeshStandardMaterial(o);
export const stoneTex = (rx, ry) => tex(512, stoneDraw, rx, ry);
export const plankTex = tex(512, plankDraw, 2.5, 2);
const walnut = tex(256, woodDraw('#7a4b2c')), oak = tex(256, woodDraw('#b88455'));
const stone = stoneTex(3, 2.4), floorTex = tex(1024, (g, s) => { // long light-oak boards
  for (let r = 0; r < 12; r++) for (let k = -1; k < 2; k++) { const w = s * 0.62, x = k * w + (r * 0.37 % 1) * w, v = rnd() * 20, y = r * s / 12; g.fillStyle = `rgb(${186 + v},${152 + v},${114 + v * 0.9})`; g.fillRect(x, y, w, s / 12); for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(110,72,36,${rnd() * 0.13})`; const yy = y + rnd() * s / 12; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy + (rnd() - 0.5) * 8, x + w * 0.6, yy + (rnd() - 0.5) * 8, x + w, yy); g.stroke(); } g.strokeStyle = 'rgba(70,45,25,.45)'; g.lineWidth = 1.2; g.strokeRect(x, y, w, s / 12); g.lineWidth = 1; }
}, 7, 5);
const code = tex(256, (g, s) => {
  g.fillStyle = '#0b1020'; g.fillRect(0, 0, s, s); const col = ['#7fd7ff', '#c79bff', '#ffcf7a', '#7ee6a8', '#c9d2ea'];
  g.fillStyle = '#1b2440'; g.fillRect(0, 0, s, 18); g.fillRect(0, 0, 46, s);
  for (let y = 30; y < s - 8; y += 11) { let x = 58 + (rnd() * 4 | 0) * 12; for (let k = 0; k < 4 && x < s - 20; k++) { const w = 10 + rnd() * 44; g.fillStyle = col[rnd() * 5 | 0]; g.fillRect(x, y, Math.min(w, s - x - 8), 4); x += w + 7; } }
});
export const M = {
  floor: S({ map: floorTex, bumpMap: floorTex, bumpScale: 0.35, roughness: 0.5, color: '#f3e6d4', envMapIntensity: 0.6 }),
  herring: S({ map: plankTex, bumpMap: plankTex, bumpScale: 0.4, roughness: 0.42, color: '#d8c4b0' }),
  stone: S({ map: stone, roughness: 0.4 }), concrete: S({ color: '#a7a39c', roughness: 0.95, bumpMap: plaster, bumpScale: 0.5 }), plaster: S({ color: '#ece7de', roughness: 0.95, bumpMap: plaster, bumpScale: 0.35 }), sage: S({ color: '#7f9184', roughness: 0.6 }), rug: S({ color: '#c9bfae', roughness: 1, bumpMap: fabricBump, bumpScale: 2.5 }),
  plank: S({ map: plankTex, bumpMap: plankTex, bumpScale: 0.7, roughness: 0.48 }),
  carpet: S({ color: '#9a948c', bumpMap: fabricBump, bumpScale: 1.5, roughness: 1 }),
  slab: S({ color: '#15131f', roughness: 0.8 }), wall: S({ color: '#6b5a54', bumpMap: plaster, bumpScale: 0.6, roughness: 0.92 }),
  slat: S({ map: walnut, roughness: 0.55 }), metal: S({ color: '#22212a', metalness: 0.9, roughness: 0.34 }), chrome: S({ color: '#c9c9d2', metalness: 1, roughness: 0.18 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#eaf2f2', transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0, clearcoat: 1, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide }),
  oak: S({ map: oak, bumpMap: oak, bumpScale: 0.25, roughness: 0.42 }), walnut: S({ map: walnut, bumpMap: walnut, bumpScale: 0.25, roughness: 0.4 }),
  plastic: S({ color: '#191921', roughness: 0.5 }), white: S({ color: '#e4ddd4', roughness: 0.35 }), mesh: S({ color: '#26262f', bumpMap: fabricBump, bumpScale: 2, roughness: 0.95 }),
  sofa: S({ color: '#8f8a82', bumpMap: fabricBump, bumpScale: 2, roughness: 1 }), cushion: S({ color: '#a9744a', bumpMap: fabricBump, bumpScale: 2, roughness: 1 }),
  leafA: S({ color: '#2f6b37', roughness: 0.5, side: THREE.DoubleSide }), leafB: S({ color: '#4c8a42', roughness: 0.55, side: THREE.DoubleSide }), leafC: S({ color: '#1f4d30', roughness: 0.5, side: THREE.DoubleSide }),
  pot: S({ color: '#3a3536', roughness: 0.6, bumpMap: plaster, bumpScale: 1 }), soil: S({ color: '#20160f', roughness: 1 }), trunk: S({ color: '#5b422e', roughness: 1 }),
  marble: new THREE.MeshPhysicalMaterial({ color: '#c9c3ba', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
  paper: S({ color: '#e9e3d6', roughness: 0.9 }), off: S({ color: '#08080d', roughness: 0.12, metalness: 0.3 }), screen: new THREE.MeshBasicMaterial({ map: code, color: '#ffffff' }),
  bookA: S({ color: '#8b3f35', roughness: 0.8 }), bookB: S({ color: '#2f4d68', roughness: 0.8 }), bookC: S({ color: '#c7a75c', roughness: 0.8 }), bookD: S({ color: '#d8d0c2', roughness: 0.8 }),
  warm: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffbd78').multiplyScalar(1.25) }), violet: new THREE.MeshBasicMaterial({ color: new THREE.Color('#8b5cff').multiplyScalar(1.7) }),
};

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Collects many static pieces and draws each material in a single call. */
export class Batch {
  constructor() { this.by = new Map(); this.o = new THREE.Object3D(); this.base = new THREE.Matrix4(); }
  at(x, z, ry = 0, s = 1) { this.base.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s)); return this; }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    this.o.position.set(x, y, z); this.o.rotation.set(rx, ry, rz); this.o.scale.set(sx, sy, sz); this.o.updateMatrix();
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(this.o.matrix).applyMatrix4(this.base);
    (this.by.get(mat) ?? this.by.set(mat, []).get(mat)).push(g); return this;
  }
  flush(parent) {
    for (const [mat, list] of this.by) {
      const m = new THREE.Mesh(mergeGeometries(list), mat); list.forEach((g) => g.dispose());
      const lit = !mat.isMeshBasicMaterial && !mat.transparent; m.castShadow = lit; m.receiveShadow = lit; parent.add(m);
    }
    this.by.clear();
  }
}
