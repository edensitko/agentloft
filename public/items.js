import { COMPANY } from './company.js';
import { t, DIR } from './i18n.js';
import * as THREE from 'three';
import { M, Batch, canvasTexture } from './materials.js';
import { B, R, C, plant, desk, shelf, sofa, pendant, cafeChair, taskChair } from './furniture.js';

/** How much floor each item takes; people walk around it. Rugs and lamps do not block. */
export const RADIUS = { plantA: 0.55, plantB: 0.55, sofa: 1.3, armchair: 0.8, cafeTable: 1, desk: 1, chair: 0.4, shelf: 0.9, meeting: 1.8, floorLamp: 0.3, divider: 0.9 };
export const CATALOG = { plantA: 'Tree', plantB: 'Palm', sofa: 'Sofa', armchair: 'Armchair', cafeTable: 'Coffee table', desk: 'Desk', chair: 'Chair', shelf: 'Bookshelf', meeting: 'Meeting table', floorLamp: 'Floor lamp', rug: 'Rug', tv: 'Screen', divider: 'Divider', sign: 'Sign' };
const MAKE = {
  plantA: (b) => plant(b, 0, 0, 1.1, 0), plantB: (b) => plant(b, 0, 0, 1.1, 1), sofa: (b) => sofa(b, 0, 0, 0, 3.2), armchair: (b) => sofa(b, 0, 0, 0, 1.3),
  cafeTable: (b) => { b.add(C(0.82, 0.82, 0.05, 40), M.marble, 0, 0.96, 0).add(C(0.05, 0.05, 0.92, 14), M.metal, 0, 0.48, 0).add(C(0.4, 0.44, 0.04, 28), M.metal, 0, 0.02, 0); cafeChair(b, 1.2, 0, -Math.PI / 2); cafeChair(b, -1.2, 0, Math.PI / 2); },
  desk: (b) => desk(b, 0, -0.6, 0), chair: (b) => taskChair(b, 0, 0), shelf: (b) => shelf(b, 0, 0, 2.4),
  meeting: (b) => { b.add(R(4.4, 0.08, 1.8, 0.04), M.walnut, 0, 0.98, 0); for (const x of [-1.5, 1.5]) b.add(R(0.12, 0.94, 1.2, 0.03), M.metal, x, 0.48, 0); for (const x of [-1.3, 0, 1.3]) for (const d of [-1, 1]) taskChair(b, x, d * 1.5, d < 0 ? 0 : Math.PI); },
  lamp: (b) => pendant(b, 0, 0, 3.2), floorLamp: (b) => b.add(C(0.28, 0.3, 0.04, 24), M.metal, 0, 0.02, 0).add(C(0.02, 0.02, 2.1, 10), M.metal, 0, 1.05, 0).add(C(0.22, 0.34, 0.42, 28), M.warm, 0, 2.2, 0),
  rug: (b) => b.add(R(4, 0.03, 3, 0.01), M.carpet, 0, 0.075, 0), tv: (b) => b.add(R(2.6, 1.5, 0.08, 0.03), M.plastic, 0, 1.75, 0).add(B(2.5, 1.4, 0.005), M.screen, 0, 1.75, 0.045).add(B(0.08, 1, 0.06), M.metal, 0, 0.5, 0).add(R(1.2, 0.04, 0.5, 0.02), M.metal, 0, 0.02, 0),
  divider: (b) => b.add(R(2.4, 1.7, 0.05, 0.02), M.glass, 0, 0.9, 0).add(R(2.4, 0.06, 0.1, 0.02), M.metal, 0, 1.76, 0).add(R(2.4, 0.08, 0.3, 0.02), M.metal, 0, 0.04, 0), sign: (b) => b.add(R(3.2, 0.9, 0.08, 0.03), M.plastic, 0, 2.2, 0).add(C(0.04, 0.04, 2.2, 10), M.metal, -1.3, 1.1, -0.04).add(C(0.04, 0.04, 2.2, 10), M.metal, 1.3, 1.1, -0.04),
};
/** The part of each item that takes the chosen colour. */
const TINT = { plantA: M.pot, plantB: M.pot, sofa: M.sofa, armchair: M.sofa, cafeTable: M.marble, desk: M.oak, chair: M.mesh, shelf: M.walnut, meeting: M.walnut, lamp: M.metal, floorLamp: M.warm, rug: M.carpet, tv: M.plastic, divider: M.glass, sign: null };

export function createItem(scene, it) {
  const group = new THREE.Group(), b = new Batch(), own = []; MAKE[it.type](b.at(0, 0)); b.flush(group);
  if (it.color && TINT[it.type]) for (const m of group.children) if (m.material === TINT[it.type]) { m.material = m.material.clone(); m.material.color.set(it.color); own.push(m.material); }
  if (it.type === 'sign') {
    const [g, tex] = canvasTexture(640, 170); g.textAlign = 'center'; g.direction = DIR; g.font = '700 92px system-ui'; g.fillStyle = '#0b0a18'; g.fillRect(0, 0, 640, 170); g.shadowColor = g.fillStyle = it.color ?? '#b48cff'; g.shadowBlur = 24; g.fillText(it.text ?? COMPANY.name ?? t('Office'), 320, 118, 600);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.4, 1.4, 1.4) }), m = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.82), mat); m.position.set(0, 2.2, 0.045); group.add(m); own.push(mat, tex);
  }
  group.userData.itemId = it.id; scene.add(group);
  return { group, dispose() { group.traverse((o) => o.isMesh && o.geometry.dispose()); own.forEach((o) => o.dispose()); group.removeFromParent(); } };
}
