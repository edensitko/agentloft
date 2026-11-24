// Turns the Microsoft Rocketbox FBX/TGA files (MIT) into small files for the browser.
// usage: node tools/convert-rocketbox.mjs <folder that holds Assets/ and LICENSE.md>
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
globalThis.window = globalThis; globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {} }) };
const THREE = await import('three'); const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js'); const { mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
const src = process.argv[2], out = path.resolve(import.meta.dirname, '../public/avatars'); fs.mkdirSync(out, { recursive: true });
const load = (f) => { const b = fs.readFileSync(f); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), ''); };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
/** header length (u32) + JSON header + raw arrays, each 4-byte aligned */
function pack(file, meta, arrays) {
  let off = 0; const parts = [];
  meta.arrays = {}; for (const [k, a] of Object.entries(arrays)) { const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength), pad = (4 - b.length % 4) % 4; meta.arrays[k] = [a.constructor.name, off, a.length]; parts.push(b, Buffer.alloc(pad)); off += b.length + pad; }
  let j = Buffer.from(JSON.stringify(meta)); j = Buffer.concat([j, Buffer.alloc((4 - j.length % 4) % 4, 32)]); const h = Buffer.alloc(4); h.writeUInt32LE(j.length); fs.writeFileSync(file, Buffer.concat([h, j, ...parts]));
}
const tex = (tga, name, size, alpha) => { const f = path.join(out, name + (alpha ? '.png' : '.jpg')); execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tga, '-vf', `scale=${size}:${size}:flags=lanczos`, ...(alpha ? ['-pix_fmt', 'rgba'] : ['-q:v', '3', '-pix_fmt', 'yuvj444p']), '-frames:v', '1', f]); return path.basename(f); };
const list = [];
for (const fbx of walk(path.join(src, 'Assets/Avatars')).filter((f) => f.endsWith('.fbx')).sort()) {
  const id = path.basename(fbx, '.fbx'), dir = path.join(path.dirname(fbx), '../Textures'), files = fs.readdirSync(dir), g = load(fbx); g.updateMatrixWorld(true);
  let mesh; g.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const bones = []; g.traverse((o) => { if (o.isBone) bones.push(o); });
  const find = (re) => files.find((f) => re.test(f));
  const mats = [].concat(mesh.material).map((m) => {
    const kind = /glass/i.test(m.name) ? 'glasses' : /opac|hair/i.test(m.name) ? 'opacity' : /head/i.test(m.name) ? 'head' : 'body';
    const c = kind === 'glasses' ? find(/glasses.*color/) : kind === 'opacity' ? find(/^[a-z]\d+_opacity_color/) ?? find(/opacity_color/) : find(new RegExp(kind + '_color')), n = kind === 'head' || kind === 'body' ? find(new RegExp(kind + '_normal\\.tga')) : null;
    return { kind, map: c && tex(path.join(dir, c), `${id}_${kind}`, 1024, kind === 'opacity' || kind === 'glasses'), normal: n && tex(path.join(dir, n), `${id}_${kind}_n`, 512) };
  });
  let geo = mesh.geometry; for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
  const groups = geo.groups.map((x) => [x.start, x.count, x.materialIndex]); geo.morphAttributes = {}; geo = mergeVertices(geo, 1e-4);
  const A = geo.attributes;
  // the root of the skeleton may hang under helper nodes: fold them into one matrix
  const roots = bones.filter((b) => !b.parent?.isBone); if (roots.length !== 1) console.log(id, 'roots', roots.map((r) => r.name));
  pack(path.join(out, id + '.bin'), {
    id, groups, mats, meshMatrix: mesh.matrixWorld.toArray(), bind: mesh.bindMatrix.toArray(), root: roots.map((r) => [bones.indexOf(r), r.parent.matrixWorld.toArray()]),
    bones: bones.map((b) => [b.name, bones.indexOf(b.parent), ...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]), skin: mesh.skeleton.bones.map((b) => bones.indexOf(b)),
  }, { inv: new Float32Array(mesh.skeleton.boneInverses.flatMap((m) => m.toArray())), index: new Uint32Array(geo.index.array), position: new Float32Array(A.position.array), normal: new Float32Array(A.normal.array), uv: new Float32Array(A.uv.array), skinIndex: new Uint16Array(A.skinIndex.array), skinWeight: new Float32Array(A.skinWeight.array) });
  list.push(id); console.log(id, A.position.count, mats.map((m) => `${m.kind}:${m.map ? 1 : 0}${m.normal ? 1 : 0}`).join(' '));
}
const ANIM = { desk: 'sit_table_idle_neutral_01', sit: 'sit_chair_idle_neutral_01', breathe: 'sit_chair_breathe_01', look: 'sit_chair_idle_look_around', stand: 'idle_neutral_01', wave: 'wave_01', walk: 'walk_neutral' };
const clips = {};
for (const f of walk(path.join(src, 'Assets/Animations')).filter((f) => f.endsWith('.fbx'))) {
  const base = path.basename(f, '.max.fbx'), key = Object.keys(ANIM).find((k) => base.slice(2) === ANIM[k]); if (!key) continue;
  const g = load(f), clip = g.animations[0], dur = Math.min(clip.duration, 16), fps = key === 'walk' ? 30 : 15, n = Math.max(2, Math.round(dur * fps)), loop = key === 'walk' || clip.duration < 4 ? 0 : fps; // cross-fade the last second into the first
  const data = {};
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split('.'); if (/Nub|Footsteps|Mouth|Lip|Cheek|Brow|brow|Nose|Jaw|Tongue|Caninus|Masseter/.test(bone)) continue;
    if (prop !== 'quaternion' && !(bone === 'Bip01' && prop === 'position')) continue;
    const it = t.createInterpolant(), sz = t.getValueSize(), v = []; for (let i = 0; i < n + loop; i++) v.push([...it.evaluate(Math.min(clip.duration, i / fps))]);
    for (let i = 0; i < loop; i++) { const k = i / loop, a = v[n + i], b = v[i]; if (sz === 4) v[i] = new THREE.Quaternion(...a).slerp(new THREE.Quaternion(...b), k).toArray(); else v[i] = a.map((x, j) => x + (b[j] - x) * k); }
    data[t.name] = new Float32Array(v.slice(0, n).flat());
  }
  clips[`${base[0]}_${key}`] = { fps, n, data };
  const p = data['Bip01.position']; const R = [0, 1, 2].map((a) => { let lo = 1e9, hi = -1e9; for (let i = a; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); } return [lo.toFixed(1), hi.toFixed(1)]; }); console.log(base, 'dur', clip.duration.toFixed(1), 'n', n, 'tracks', Object.keys(data).length, 'root', JSON.stringify(R));
}
const meta = { clips: {} }, arr = {}; let i = 0;
for (const [k, c] of Object.entries(clips)) { meta.clips[k] = { fps: c.fps, n: c.n, tracks: {} }; for (const [t, a] of Object.entries(c.data)) { const q = t.endsWith('quaternion'); arr['a' + i] = q ? Int16Array.from(a, (x) => Math.round(x * 32767)) : a; meta.clips[k].tracks[t] = 'a' + i++; } }
pack(path.join(out, 'clips.bin'), meta, arr); fs.writeFileSync(path.join(out, 'list.json'), JSON.stringify(list)); fs.copyFileSync(path.join(src, 'LICENSE.md'), path.join(out, 'LICENSE-Microsoft-Rocketbox.md'));
