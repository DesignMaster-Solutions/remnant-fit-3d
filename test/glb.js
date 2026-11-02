// Loads a GLB in node as a plain three.js object (geometry only), so tests read levels exactly like the game.
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export async function loadGlb(path) {
  const doc = await io.read(path);
  const root = new THREE.Group();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(prim.getAttribute('POSITION').getArray()), 3));
      const idx = prim.getIndices();
      if (idx) g.setIndex(Array.from(idx.getArray()));
      const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      o.applyMatrix4(m);
      root.add(o);
    }
  }
  return root;
}

export const ascii = (g) => Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => (g.cells[y * g.w + x] ? '#' : '.')).join('')).join('\n');
