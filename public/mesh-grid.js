// Reads a level out of a generated mesh: shared by the game and by the node tests, so both see the same grid.
import * as THREE from 'three';
import { CELL, grid, keepLarge, solid } from './fit.js';

export const TOP = 0.9; // counter height in metres
const TOP_TOLERANCE = 0.08;
// Highest surface over each cell centre, found by rasterising every triangle seen from above. Same answer
// as casting a ray down through each cell, but it costs one pass over the mesh instead of one per cell.
export function heights(obj, w, h) {
  const top = new Float32Array(w * h).fill(-Infinity);
  const v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const p = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); p.set([v.x, v.y, v.z], i * 3); }
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const a = (idx ? idx.getX(t) : t) * 3, b = (idx ? idx.getX(t + 1) : t + 1) * 3, c = (idx ? idx.getX(t + 2) : t + 2) * 3;
      const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) / CELL + w / 2 - 0.5)), x1 = Math.min(w - 1, Math.floor(Math.max(ax, bx, cx) / CELL + w / 2 - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(az, bz, cz) / CELL + h / 2 - 0.5)), y1 = Math.min(h - 1, Math.floor(Math.max(az, bz, cz) / CELL + h / 2 - 0.5));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const px = (gx + 0.5 - w / 2) * CELL, pz = (gy + 0.5 - h / 2) * CELL;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d;
        const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const y = l1 * p[a + 1] + l2 * p[b + 1] + l3 * p[c + 1];
        if (y > top[gy * w + gx]) top[gy * w + gx] = y;
      }
    }
  });
  return top;
}

// Stands the kitchen at counter height with its longest side at `run` metres. Every cell whose surface is
// the highest level of the model is counter; anything lower (the sink, a cooktop hole, the floor) is not.
export function counterFrom(model, run) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = run / Math.max(size.x, size.z);
  model.scale.set(s, TOP / size.y, s);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  model.position.y += TOP / 2;
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  box.getSize(size);
  const w = Math.round(size.x / CELL);
  const h = Math.round(size.z / CELL);
  const top = heights(model, w, h);
  const target = keepLarge(solid(grid(w, h, (x, y) => top[y * w + x] > TOP - TOP_TOLERANCE)), 20);
  return { model, target, origin: new THREE.Vector3((-w * CELL) / 2, TOP, (-h * CELL) / 2) };
}

// Lays a generated offcut flat, scales its longest side to `length` and reads its outline from above.
export function slabFrom(model, length) {
  const inner = model.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  if (size.x < size.y && size.x <= size.z) inner.rotation.z = Math.PI / 2;
  else if (size.z < size.y && size.z <= size.x) inner.rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(inner);
  holder.updateMatrixWorld(true);
  box.setFromObject(holder);
  box.getSize(size);
  inner.scale.multiplyScalar(length / Math.max(size.x, size.z));
  holder.updateMatrixWorld(true);
  box.setFromObject(holder);
  holder.position.sub(box.getCenter(new THREE.Vector3()));
  holder.updateMatrixWorld(true);
  box.setFromObject(holder);
  box.getSize(size);
  const w = Math.max(1, Math.round(size.x / CELL));
  const h = Math.max(1, Math.round(size.z / CELL));
  const top = heights(holder, w, h);
  const mask = grid(w, h, (x, y) => top[y * w + x] > -Infinity);
  const group = new THREE.Group();
  group.add(holder);
  return { group, mask, thick: size.y };
}
