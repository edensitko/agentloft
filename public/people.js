import { needOf } from './summary.js';
import { tLine } from './i18n.js';
import * as THREE from 'three';
import { label } from './world.js';

// People: Microsoft Rocketbox avatars (MIT), converted by tools/convert-rocketbox.mjs. Source unit is centimetres.
const UNIT = 0.0132, BASE = new URL('avatars/', import.meta.url).href;
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return (h ^ h >>> 15) >>> 0; };
const ALL = ['Business_Female_01', 'Business_Female_02', 'Business_Female_03', 'Business_Female_04', 'Business_Male_01', 'Business_Male_02', 'Business_Male_03', 'Business_Male_04', 'Business_Male_05', 'Business_Male_06', 'Business_Male_07', 'Female_Adult_01', 'Female_Adult_05', 'Female_Adult_08', 'Male_Adult_01', 'Male_Adult_05'];
// inside another page a few people are enough: each one is a couple of megabytes to download
export const AVATARS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('embed') ? ['Business_Female_01', 'Business_Male_02', 'Business_Female_04', 'Male_Adult_01', 'Business_Male_05', 'Female_Adult_08'] : ALL;
const TYPES = { Float32Array, Uint16Array, Uint32Array, Int16Array };
async function unpack(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url); const buf = await r.arrayBuffer(), n = new DataView(buf).getUint32(0, true), meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
  return { meta, get: (k) => { const [t, o, len] = meta.arrays[k]; return new TYPES[t](buf, 4 + n + o, len); } };
}
const texLoader = new THREE.TextureLoader(); texLoader.setPath(BASE);
const tex = (f, srgb) => { const t = texLoader.load(f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const models = new Map();
function model(id) {
  if (!models.has(id)) models.set(id, unpack(BASE + id + '.bin').then(({ meta, get }) => {
    const geo = new THREE.BufferGeometry();
    for (const [k, n] of [['position', 3], ['normal', 3], ['uv', 2], ['skinIndex', 4], ['skinWeight', 4]]) geo.setAttribute(k, new THREE.BufferAttribute(get(k), n));
    geo.setIndex(new THREE.BufferAttribute(get('index'), 1)); for (const g of meta.groups) geo.addGroup(...g);
    const mats = meta.mats.map((m) => {
      const see = m.kind === 'opacity' || m.kind === 'glasses';
      return new THREE.MeshPhysicalMaterial({ map: tex(m.map, true), normalMap: m.normal ? tex(m.normal) : null, roughness: m.kind === 'head' ? 0.58 : see ? 0.6 : 0.82, specularIntensity: m.kind === 'head' ? 0.5 : 0.35, ...(see ? { alphaTest: m.kind === 'glasses' ? 0.1 : 0.4, side: THREE.DoubleSide } : {}) });
    });
    return { meta, geo, mats, inv: get('inv') };
  }));
  return models.get(id);
}
let clipsP = null;
const clips = () => (clipsP ??= unpack(BASE + 'clips.bin').then(({ meta, get }) => Object.fromEntries(Object.entries(meta.clips).map(([name, c]) => {
  const times = Float32Array.from({ length: c.n }, (_, i) => i / c.fps), tracks = [];
  for (const [t, key] of Object.entries(c.tracks)) {
    if (!t.startsWith('Bip01')) continue;
    const a = get(key);
    if (t.endsWith('quaternion')) tracks.push(new THREE.QuaternionKeyframeTrack(t, times, Float32Array.from(a, (x) => x / 32767)));
    else { const p = Float32Array.from(a); for (let i = 0; i < c.n; i++) { p[i * 3] = 0; p[i * 3 + 2] = 0; } tracks.push(new THREE.VectorKeyframeTrack(t, times, p)); } // the office decides where people are, the clip only how they move
  }
  return [name, new THREE.AnimationClip(name, -1, tracks)];
}))));

// --- a personal look: the avatar's own textures repainted (clothes, hair, skin tone)
const imgs = new Map(), image = (f) => imgs.get(f) ?? imgs.set(f, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = BASE + f; })).get(f);
const isSkin = (r, g, b) => r > 95 && r > g && g > b && r - b > 28 && r - b < 120 && g / r > 0.58 && g / r < 0.86;
/** Which part of the body texture is the top (red), the trousers or skirt (blue) or the shoes: painted from the model itself, by height. */
function regions(m) {
  if (m.mask) return m.mask;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d', { willReadFrequently: true }), pos = m.geo.attributes.position, uv = m.geo.attributes.uv, idx = m.geo.index.array, mm = new THREE.Matrix4().fromArray(m.meta.meshMatrix), v = new THREE.Vector3();
  const ys = new Float32Array(pos.count); let lo = Infinity, hi = -Infinity; for (let i = 0; i < pos.count; i++) { ys[i] = v.fromBufferAttribute(pos, i).applyMatrix4(mm).y; lo = Math.min(lo, ys[i]); hi = Math.max(hi, ys[i]); }
  const waist = lo + (hi - lo) * 0.57, shoe = lo + (hi - lo) * 0.045; x.lineWidth = 3; x.lineJoin = 'round';
  for (const [start, count, mi] of m.meta.groups) { if (m.meta.mats[mi].kind !== 'body') continue;
    for (let t = start; t < start + count; t += 3) { const a = idx[t], b = idx[t + 1], d = idx[t + 2], y = (ys[a] + ys[b] + ys[d]) / 3; x.fillStyle = x.strokeStyle = y > waist ? '#f00' : y > shoe ? '#00f' : '#0f0';
      x.beginPath(); x.moveTo(uv.getX(a) * S, (1 - uv.getY(a)) * S); x.lineTo(uv.getX(b) * S, (1 - uv.getY(b)) * S); x.lineTo(uv.getX(d) * S, (1 - uv.getY(d)) * S); x.closePath(); x.fill(); x.stroke(); } }
  return (m.mask = { data: x.getImageData(0, 0, S, S).data, S });
}
/** top / bottom / color: new colours that keep the fabric's own light and shade. tone: skin made lighter or darker. */
async function repaint(file, { color, top, bottom, mask, tone, keepSkin }) {
  const img = await image(file), c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data, W = c.width, H = c.height, lin = (h) => (h ? new THREE.Color(h).convertLinearToSRGB() : null);
  const cols = [lin(color ?? top), lin(bottom)], sum = [0, 0], n = [0, 0];
  const part = (i) => { if (!mask) return 0; const px = (i / 4) % W, py = (i / 4 / W) | 0, k = (((py / H * mask.S) | 0) * mask.S + ((px / W * mask.S) | 0)) * 4; return mask.data[k] > 128 ? 0 : mask.data[k + 2] > 128 ? 1 : -1; };
  for (let i = 0; i < p.length; i += 28) if (p[i + 3] > 20 && !(keepSkin && isSkin(p[i], p[i + 1], p[i + 2]))) { const k = part(i); if (k >= 0) { sum[k] += 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]; n[k]++; } }
  const avg = sum.map((s2, k) => Math.max(30, s2 / Math.max(1, n[k]))), bright = cols.map((q) => (q ? Math.max(0.35, 0.3 * q.r + 0.59 * q.g + 0.11 * q.b) : 1));
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    if (keepSkin ? isSkin(r, g, b) : !cols[0]) { if (tone != null) { p[i] = Math.min(255, r * tone); p[i + 1] = Math.min(255, g * tone * (tone < 1 ? 0.97 : 1)); p[i + 2] = Math.min(255, b * tone * (tone < 1 ? 0.93 : 1)); } continue; }
    const k = part(i), q = k >= 0 ? cols[k] : null; if (!q) continue;
    const l = (0.3 * r + 0.59 * g + 0.11 * b) / avg[k] * 0.62 / bright[k] * 255; p[i] = Math.min(255, q.r * l); p[i + 1] = Math.min(255, q.g * l); p[i + 2] = Math.min(255, q.b * l);
  }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** Materials for this person; `own` lists what must be freed with them. */
async function dress(m, look) {
  if (!look.cloth && !look.pants && !look.hair && look.tone == null) return { mats: m.mats, own: [] };
  const own = [], mats = await Promise.all(m.mats.map(async (base, i) => {
    const { kind, map } = m.meta.mats[i], job = kind === 'body' && (look.cloth || look.pants || look.tone != null) ? { top: look.cloth, bottom: look.pants, mask: regions(m), tone: look.tone, keepSkin: true } : kind === 'head' && look.tone != null ? { tone: look.tone } : kind === 'opacity' && look.hair ? { color: look.hair } : null;
    if (!job) return base; const mat = base.clone(); mat.map = await repaint(map, job); own.push(mat, mat.map); return mat;
  }));
  return { mats, own };
}
const inUse = new Map(); // avatar -> people wearing it, so that faces repeat as late as possible
function choose(id) {
  const start = hash(id) % AVATARS.length; let best = null;
  for (let i = 0; i < AVATARS.length; i++) { const a = AVATARS[(start + i) % AVATARS.length]; if (best === null || (inUse.get(a) ?? 0) < (inUse.get(best) ?? 0)) best = a; }
  return best;
}
const COLORS = { working: '#25b873', waiting: '#ff8f2d', idle: '#8f96d8', unknown: '#8a8598' };
const ringGeo = new THREE.RingGeometry(0.62, 0.68, 64), hitGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.4, 8);
const puffMat = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), r = x.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(235,235,235,.75)'); r.addColorStop(1, 'rgba(235,235,235,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const cigGeo = new THREE.CylinderGeometry(0.45, 0.45, 8, 8), cigMat = new THREE.MeshStandardMaterial({ color: '#f3efe6' }), emberGeo = new THREE.SphereGeometry(0.55, 8, 6), emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a1e').multiplyScalar(2) });
const phoneGeo = new THREE.BoxGeometry(7, 14.5, 0.9), phoneMat = [0, 1, 2, 3, 4, 5].map((i) => i === 4 ? new THREE.MeshBasicMaterial({ color: '#9fc4ff' }) : new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.4 }));
const cupGeo = new THREE.CylinderGeometry(3.6, 2.9, 9.5, 14), cupMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6 });
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), tq = new THREE.Quaternion();

export function createPerson(scene, w, look = {}) {
  const h = hash(w.id), g = new THREE.Group(); scene.add(g);
  const avatar = AVATARS.includes(look.avatar) ? look.avatar : choose(w.id); inUse.set(avatar, (inUse.get(avatar) ?? 0) + 1);
  const sex = avatar.includes('Female') ? 'f' : 'm';
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }), ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 0.09; ring.rotation.x = -Math.PI / 2; g.add(ring);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false }), hit = new THREE.Mesh(hitGeo, hitMat); hit.position.y = 1.2; hit.userData.id = w.id; g.add(hit);
  const tag = label('', 'tag'); tag.position.y = 2.6; g.add(tag);
  let mixer = null, actions = null, current = null, bones = null, skeleton = null, dead = false, sig = '', skin = null;

  let own = [];
  Promise.all([model(avatar), clips()]).then(async ([m, lib]) => {
    const look2 = await dress(m, look); if (dead) { look2.own.forEach((o) => o.dispose()); return; } own = look2.own;
    const list = m.meta.bones.map(([name, , ...v]) => { const b = new THREE.Bone(); b.name = name; b.position.fromArray(v, 0); b.quaternion.fromArray(v, 3); b.scale.fromArray(v, 7); return b; });
    m.meta.bones.forEach(([, p], i) => { if (p >= 0) list[p].add(list[i]); });
    skin = new THREE.Group(); { const u = UNIT * (0.97 + (h % 7) / 100), wide = look.wide ?? 1; skin.scale.set(u * wide, u * (look.tall ?? 1), u * wide); }
    for (const [i, mat] of m.meta.root) { const holder = new THREE.Group(); new THREE.Matrix4().fromArray(mat).decompose(holder.position, holder.quaternion, holder.scale); holder.add(list[i]); skin.add(holder); }
    skeleton = new THREE.Skeleton(m.meta.skin.map((i) => list[i]), m.meta.skin.map((_, i) => new THREE.Matrix4().fromArray(m.inv, i * 16)));
    const mesh = new THREE.SkinnedMesh(m.geo, look2.mats); mesh.bind(skeleton, new THREE.Matrix4().fromArray(m.meta.bind));
    // bones already include the person's place in the office, so the mesh itself stays at the world origin
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true; mesh.raycast = () => {};
    scene.add(mesh); me.mesh = mesh; g.add(skin);
    bones = Object.fromEntries(list.map((b) => [b.name, b]));
    mixer = new THREE.AnimationMixer(skin); actions = {};
    for (const k of ['desk', 'sit', 'breathe', 'look', 'stand', 'wave', 'walk']) { const a = mixer.clipAction(lib[`${sex}_${k}`]); a.time = (h % 97) / 97 * a.getClip().duration; actions[k] = a; }
    actions.desk.timeScale = 0.9; play(wanted(0), 0); mixer.update(0.001);
  }).catch((e) => console.error('avatar', avatar, e));

  const wanted = (t) => {
    if (me.pose === 'stand' && me.greet > t && !me.controlled) return 'wave';
    if (me.pose === 'walk') return me.yield && !me.controlled ? 'stand' : 'walk'; if (me.pose === 'type') return 'sit'; if (me.pose === 'wave') return 'wave'; if (me.pose !== 'sit') return 'stand';
    const k = Math.floor((t + h % 60) / 13 + (h % 5)) % 4; return ['sit', 'breathe', 'sit', 'look'][k];
  };
  function play(name, fade = 0.45) { if (current === name) return; const a = actions[name]; a.reset(); a.time = (h % 97) / 97 * a.getClip().duration; a.setEffectiveWeight(1).play(); if (current) actions[current].crossFadeTo(a, fade, false); current = name; }
  const turn = (b, axis, a) => { if (b) b.quaternion.multiply(tq.setFromAxisAngle(axis, a)); };

  /** Bends elbow and shoulder until the wrist reaches the target (world space). */
  function reach(side, target, weight, keepHand = true) {
    const hand = bones[`Bip01_${side}_Hand`], chain = [bones[`Bip01_${side}_Forearm`], bones[`Bip01_${side}_UpperArm`]]; if (!hand || !chain[0] || !chain[1]) return;
    const keep = hand.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 6; i++) for (const b of chain) {
      b.getWorldPosition(V1); hand.getWorldPosition(V2); V3.subVectors(V2, V1).normalize(); V4.subVectors(target, V1).normalize();
      Q1.setFromUnitVectors(V3, V4); Q2.identity().slerp(Q1, weight); // world-space turn, applied in the bone's parent space
      b.parent.getWorldQuaternion(Q1); b.quaternion.premultiply(Q1.clone().invert().multiply(Q2).multiply(Q1)); b.updateWorldMatrix(false, true);
    }
    if (!keepHand) return; // a raised hand follows the forearm, a hand on the desk keeps its palm down
    hand.parent.getWorldQuaternion(Q1); hand.quaternion.copy(Q1.invert().multiply(keep)); hand.updateWorldMatrix(false, true); // palms stay facing down
  }
  let typing = 0, smoke = null;
  function smoking(dt, t) {
    const on = me.pose === 'smoke'; if (!on && !smoke) return;
    if (on && !smoke) {
      const cig = new THREE.Mesh(cigGeo, cigMat), em = new THREE.Mesh(emberGeo, emberMat); em.position.y = 4.2; cig.add(em); bones.Bip01_R_Hand.add(cig); cig.position.set(9.5, 1.5, 1); cig.rotation.set(Math.PI / 2, 0, 0.3);
      smoke = { cig, puffs: Array.from({ length: 7 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffMat, transparent: true, depthWrite: false, opacity: 0 })); s.userData.o = i / 7; scene.add(s); return s; }) };
    }
    if (!on) { smoke.cig.removeFromParent(); for (const s of smoke.puffs) { s.removeFromParent(); s.material.dispose(); } smoke = null; return; }
    const c = ((t + h % 11) % 8.5) / 8.5, lift = THREE.MathUtils.smoothstep(c, 0.05, 0.16) - THREE.MathUtils.smoothstep(c, 0.34, 0.46);
    g.updateWorldMatrix(true, true); bones.Bip01_Head.getWorldPosition(V1); const mouth = V1.clone(), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
    const rest = g.localToWorld(new THREE.Vector3(-0.24, 1.3, 0.34)), target = rest.lerp(mouth.clone().addScaledVector(fwd, 0.22 * g.scale.x).add(new THREE.Vector3(0, -0.06, 0)), lift); reach('R', target, 1);
    const tip = smoke.cig.localToWorld(new THREE.Vector3(0, 4.5, 0));
    for (const [i, s] of smoke.puffs.entries()) { // two rise from the cigarette, the rest are breathed out after a draw
      const exhale = i > 1, k = exhale ? (c - 0.46 - i * 0.025) / 0.32 : (t * 0.35 + s.userData.o) % 1;
      if (k < 0 || k > 1) { s.material.opacity = 0; continue; }
      s.position.copy(exhale ? mouth : tip).addScaledVector(fwd, exhale ? 0.15 + k * 0.75 : 0); s.position.y += k * (exhale ? 0.45 : 0.7); s.position.x += Math.sin(i * 2 + k * 3) * 0.06; s.scale.setScalar(0.07 + k * (exhale ? 0.5 : 0.18)); s.material.opacity = (1 - k) * (exhale ? 0.5 : 0.3);
    }
  }
  /** What a person does with their hands while on a break: phone, coffee, or talking with the person next to them. */
  let prop = null, lastAct = null, ease = 0, speak = 0;
  const E1 = new THREE.Euler(), SIDE = new THREE.Vector3(), FWD = new THREE.Vector3(), HEAD = new THREE.Vector3(), T1 = new THREE.Vector3();
  const nod = (bone, axis, angle) => { if (!bone) return; bone.parent.updateWorldMatrix(true, false); bone.parent.getWorldQuaternion(Q1); Q2.setFromAxisAngle(axis, angle); bone.quaternion.premultiply(Q1.clone().invert().multiply(Q2).multiply(Q1)); bone.updateWorldMatrix(false, true); };
  function acting(t) {
    const act = me.path.length || me.controlled || (me.pose !== 'stand' && me.pose !== 'sit') || me.greet > t ? null : me.act, kind = act === 'phone' || act === 'coffee' ? act : null;
    if (prop && prop.kind !== kind) { prop.mesh.removeFromParent(); prop = null; }
    if (!act) return;
    if (kind && !prop) {
      const mesh = kind === 'phone' ? new THREE.Mesh(phoneGeo, phoneMat) : new THREE.Mesh(cupGeo, cupMat); bones.Bip01_R_Hand.add(mesh);
      mesh.position.set(8, kind === 'phone' ? 2.4 : 4.6, 0.5);
      prop = { kind, mesh };
    }
    g.updateWorldMatrix(true, true); const q = g.getWorldQuaternion(new THREE.Quaternion()), k = g.scale.x, a = t + h % 23;
    SIDE.set(-1, 0, 0).applyQuaternion(q); FWD.set(0, 0, 1).applyQuaternion(q); bones.Bip01_Head.getWorldPosition(HEAD);
    const at = (x, y, z) => T1.copy(HEAD).addScaledVector(SIDE, x * k).addScaledVector(FWD, z * k).add(V4.set(0, y * k, 0)).clone();
    // the hand keeps its recorded orientation, so the thing in it is turned in world space: cup upright, screen to the face
    const hold = () => { if (!prop) return; const hq = bones.Bip01_R_Hand.getWorldQuaternion(Q1).invert(); prop.mesh.quaternion.copy(hq).multiply(q); if (act === 'phone') prop.mesh.quaternion.multiply(Q2.setFromEuler(E1.set(0.75, Math.PI, 0, 'YXZ'))); };
    if (act !== lastAct) { lastAct = act; ease = 0; } ease = Math.min(1, ease + 0.035); const e = ease * ease * (3 - 2 * ease); // the arm comes up gently, never snaps
    if (act === 'phone') { nod(bones.Bip01_Head, SIDE, (-0.34 + Math.sin(a * 0.4) * 0.04) * e); reach('R', at(0.07, -0.33, 0.3), e, false); }
    else if (act === 'coffee') { const c = (a % 10) / 10, lift = THREE.MathUtils.smoothstep(c, 0.08, 0.2) - THREE.MathUtils.smoothstep(c, 0.36, 0.5); nod(bones.Bip01_Head, SIDE, 0.12 * lift); reach('R', at(0.2, -0.45, 0.3).lerp(at(0.03, -0.13, 0.17), lift), e, false); }
    else if (act === 'talk') { // one speaks with a hand while the other listens and nods, then they swap
      const turnNow = Math.floor(t / 5.5) % 2 === (me.talkTurn ?? 0); speak += ((turnNow ? 1 : 0) - speak) * 0.04;
      nod(bones.Bip01_Head, SIDE, speak * Math.sin(a * 1.1) * 0.03 - (1 - speak) * (0.04 + Math.max(0, Math.sin(a * 1.6)) * 0.07));
      if (speak > 0.03) reach(h % 2 ? 'L' : 'R', at((h % 2 ? -1 : 1) * (0.2 + Math.sin(a * 0.9) * 0.04), -0.46 + Math.sin(a * 1.3) * 0.04, 0.3), speak * 0.75 * e, false);
    }
    hold();
  }
  const me = {
    g, hit, tag, worker: w, path: [], pose: 'stand', face: 0, gone: false, onArrive: null, avatar,
    update(nw, emphasize) {
      me.worker = nw; ringMat.color.set(COLORS[nw.status]); ring.visible = nw.status === 'waiting' || nw.status === 'working' || emphasize;
      const el = tag.element, cls = `tag ${nw.status}${nw.kind === 'agent' ? ' agent' : ''} show${nw.kind === 'session' ? ' sess' : ''}${nw.lead ? ' lead' : ''}${emphasize ? ' on' : ''}`;
      const txt = nw.status === 'waiting' ? `${nw.name} · ${needOf(nw).label}` : nw.status === 'working' && nw.action ? `${nw.name} · ${tLine(nw.action.text)}` : nw.name;
      if (sig !== cls + txt) { sig = cls + txt; el.className = cls; el.textContent = txt; }
    },
    go(path, pose, face, done) { me.path = path ?? []; me.nextPose = pose; me.nextFace = face; me.onArrive = done; me.pose = me.path.length ? 'walk' : pose; if (!me.path.length) { me.face = face; done?.(); } },
    tick(dt, t, calm, hold = null) {
      if (me.path.length && !me.controlled) {
        const p = me.path[0], dx = p.x - g.position.x, dz = p.z - g.position.z, d = Math.hypot(dx, dz), step = dt * (calm ? 1e4 : 1.75); // matches the recorded stride, so feet do not slide
        if (d > 1e-3) me.face = Math.atan2(dx, dz);
        // someone standing in the way (the person the viewer walks as): wait instead of walking through them
        me.yield = !!hold && d > 1e-3 && Math.hypot(g.position.x + dx / d * 0.7 - hold.x, g.position.z + dz / d * 0.7 - hold.z) < 0.75;
        if (me.yield) {} else if (d <= step) { g.position.set(p.x, 0, p.z); me.path.shift(); if (!me.path.length) { me.pose = me.nextPose; me.face = me.nextFace; me.onArrive?.(); } }
        else { g.position.x += dx / d * step; g.position.z += dz / d * step; }
      }
      // someone walks up: a person who is just standing turns to them, and waves once
      if (hold && !me.controlled && !me.path.length && me.pose === 'stand') {
        const hx = hold.x - g.position.x, hz = hold.z - g.position.z, hd = Math.hypot(hx, hz);
        if (hd < 2.6) { me.home ??= me.face; me.face = Math.atan2(hx, hz); if (hd < 1.9 && t > (me.greetAgain ?? 0)) { me.greet = t + 2.2; me.greetAgain = t + 40; } }
        else if (me.home != null) { me.face = me.home; me.home = null; }
      } else if (me.home != null && (me.path.length || me.pose !== 'stand')) me.home = null;
      let df = me.face - g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); g.rotation.y += calm ? df : df * Math.min(1, dt * (me.fp ? 22 : me.controlled ? 9 : 6));
      tag.position.y = me.pose === 'type' || me.pose === 'sit' ? 2.05 : 2.6;
      if (mixer) {
        actions.walk.timeScale = me.controlled ? Math.min(2.3, Math.max(0.55, me.walkRate ?? 1)) : 1; // steps keep pace with the ground, so feet do not slide
        play(wanted(calm ? 0 : t), me.controlled ? 0.22 : 0.45); if (!calm) mixer.update(dt);
        if (me.lean > 0.01 && bones.Bip01_Spine) { const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion())); bones.Bip01_Spine.parent.updateWorldMatrix(true, false); bones.Bip01_Spine.parent.getWorldQuaternion(Q1); Q2.setFromAxisAngle(ax, me.lean); bones.Bip01_Spine.quaternion.premultiply(Q1.clone().invert().multiply(Q2).multiply(Q1)); } // leaning into a run
        typing += ((me.pose === 'type' ? 1 : 0) - typing) * Math.min(1, dt * 4);
        if (typing > 0.02) {
          const lean = g.getWorldQuaternion(new THREE.Quaternion()), ax = new THREE.Vector3(1, 0, 0).applyQuaternion(lean);
          const spine = bones.Bip01_Spine1; if (spine) { spine.parent.updateWorldMatrix(true, false); spine.parent.getWorldQuaternion(Q1); Q2.setFromAxisAngle(ax, 0.16 * typing); spine.quaternion.premultiply(Q1.clone().invert().multiply(Q2).multiply(Q1)); }
          g.updateWorldMatrix(true, true);
          for (const s of ['L', 'R']) reach(s, g.localToWorld(new THREE.Vector3(s === 'L' ? 0.17 : -0.17, 1.12, 0.46)), typing);
        }
        bones.Bip01_Head.scale.setScalar(me.fp ? 0.001 : 1); // seen from its own eyes: no head in front of the camera
        if (me.fp && me.pose === 'walk') { // arms swing up into the bottom of the view, like a brisk walk
          g.updateWorldMatrix(true, true); const sw = Math.sin(t * 7.5);
          for (const s of ['L', 'R']) { const k = s === 'L' ? 1 : -1; reach(s, g.localToWorld(new THREE.Vector3(k * 0.3, 1.58 + k * sw * 0.08, 0.54 + k * sw * 0.2)), 0.75); }
        }
        if (!calm) smoking(dt, t); if (!calm) acting(t); else if (prop) { prop.mesh.removeFromParent(); prop = null; }
        if (me.pose === 'type' && !calm) { // typing is added on top of the recorded desk pose
          const a = t + h % 50;
          const busy = Math.sin(a * 0.9) > -0.75 ? 1 : 0.15;
          for (const s of ['L', 'R']) {
            turn(bones[`Bip01_${s}_Hand`], Z, Math.sin(a * 7 + (s === 'L' ? 0 : 2)) * 0.05 * busy);
            for (let f = 1; f <= 4; f++) turn(bones[`Bip01_${s}_Finger${f}`], Z, Math.sin(a * (11 + f * 2.3) + f * 1.7 + (s === 'L' ? 0 : 1)) * 0.2 * busy);
          }
        }
      }
      ring.scale.setScalar(me.worker.status === 'waiting' && !calm ? 1.1 + Math.sin(t * 4) * 0.12 : 1);
    },
    dispose() { dead = true; own.forEach((o) => o.dispose()); if (smoke) for (const s of smoke.puffs) { s.removeFromParent(); s.material.dispose(); } inUse.set(avatar, Math.max(0, (inUse.get(avatar) ?? 1) - 1)); tag.element.remove(); g.removeFromParent(); me.mesh?.removeFromParent(); skeleton?.dispose(); mixer?.stopAllAction(); ringMat.dispose(); hitMat.dispose(); },
  };
  return me;
}
