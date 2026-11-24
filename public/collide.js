import * as THREE from 'three';

/**
 * What blocks a person on foot, taken from the real geometry: every surface between knee and head height
 * is sampled into a fine grid. `tall` holds only what is above head height, for the camera behind the person.
 */
export function buildGrid(scene, hx, hz, cell = 0.25) {
  const W = Math.ceil(hx * 2 / cell), D = Math.ceil(hz * 2 / cell), body = new Uint8Array(W * D), tall = new Uint8Array(W * D);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Matrix4(), STEP = cell * 0.5;
  const mark = (x, y, z) => { const i = Math.floor((x + hx) / cell), j = Math.floor((z + hz) / cell); if (i < 0 || j < 0 || i >= W || j >= D) return; if (y > 0.3 && y < 1.75) body[j * W + i] = 1; if (y > 1.95 && y < 2.9) tall[j * W + i] = 1; };
  function tri() {
    const lo = Math.min(a.y, b.y, c.y), hi = Math.max(a.y, b.y, c.y); if (hi < 0.3 || lo > 2.9) return;
    if (Math.min(a.x, b.x, c.x) > hx || Math.max(a.x, b.x, c.x) < -hx || Math.min(a.z, b.z, c.z) > hz || Math.max(a.z, b.z, c.z) < -hz) return;
    const n = Math.min(400, Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / STEP)));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n, w = 1 - u - v; mark(a.x * u + b.x * v + c.x * w, a.y * u + b.y * v + c.y * w, a.z * u + b.z * v + c.z * w); }
  }
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.noCollide || !o.visible || o.material.visible === false || o.material.side === THREE.BackSide) return;
    for (let p = o.parent; p; p = p.parent) if (!p.visible || p.userData.noCollide) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index?.array, n = idx ? idx.length : pos.count, count = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < count; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, m); m.premultiply(o.matrixWorld); } else m.copy(o.matrixWorld);
      for (let t = 0; t < n; t += 3) { a.fromBufferAttribute(pos, idx ? idx[t] : t).applyMatrix4(m); b.fromBufferAttribute(pos, idx ? idx[t + 1] : t + 1).applyMatrix4(m); c.fromBufferAttribute(pos, idx ? idx[t + 2] : t + 2).applyMatrix4(m); tri(); }
    }
  });
  const at = (g) => (x, z) => { const i = Math.floor((x + hx) / cell), j = Math.floor((z + hz) / cell); return i < 0 || j < 0 || i >= W || j >= D || g[j * W + i] === 1; };
  return { body: at(body), tall: at(tall) };
}
