import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CELL, grid, rotated, fits, score } from './fit.js';

const TOP = 0.9; // counter height in metres
const TOP_TOLERANCE = 0.08;
const LONGEST_RUN = 3.2; // metres; the generated kitchen is scaled to this
let target; // read from the kitchen mesh in counterFrom()
let origin;
// Stock of offcuts: model, longest side in metres. Same scan at two sizes is how yards really look.
const STOCK = [
  ['remnant-a', 1.7], ['remnant-b', 2.1], ['remnant-c', 1.3], ['remnant-a', 1.2], ['remnant-c', 0.9],
];

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2023);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(2, 6, 3);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP - 0.03);
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pieces = [];
let selected = null;
let dragging = null;

function outlineTarget() {
  const pts = [];
  const seg = (x1, y1, x2, y2) => pts.push(new THREE.Vector3(x1 * CELL, 0, y1 * CELL), new THREE.Vector3(x2 * CELL, 0, y2 * CELL));
  const on = (x, y) => x >= 0 && y >= 0 && x < target.w && y < target.h && target.cells[y * target.w + x] === 1;
  for (let y = 0; y <= target.h; y++) for (let x = 0; x <= target.w; x++) {
    if (on(x, y) !== on(x, y - 1)) seg(x, y, x + 1, y);
    if (on(x, y) !== on(x - 1, y)) seg(x, y, x, y + 1);
  }
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf4c430 }));
  line.position.copy(origin).add(new THREE.Vector3(0, 0.01, 0));
  scene.add(line);
}

// Lays a generated mesh flat, scales it to `length` and reads its true outline by casting rays straight down.
function slabFrom(model, length) {
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
  const down = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, -1, 0);
  const mask = grid(w, h, (x, y) => {
    down.set(new THREE.Vector3((x + 0.5 - w / 2) * CELL, 5, (y + 0.5 - h / 2) * CELL), dir);
    return down.intersectObject(holder, true).length > 0;
  });
  const group = new THREE.Group();
  group.add(holder);
  holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, mask, thick: size.y };
}

const dims = (p) => { const m = rotated(p.mask, p.turns); return [m.w, m.h]; };

function moveTo(p) {
  const [w, h] = dims(p);
  p.group.rotation.y = (-p.turns * Math.PI) / 2;
  p.group.position.set(origin.x + (p.x + w / 2) * CELL, TOP + p.thick / 2 + 0.005, origin.z + (p.y + h / 2) * CELL);
}

function rack(p) {
  p.placed = false;
  p.group.rotation.y = (-p.turns * Math.PI) / 2;
  p.group.position.set(p.home.x, p.thick / 2 + 0.01, p.home.z);
}

function refresh() {
  const placed = pieces.filter((p) => p.placed);
  const s = score(target, placed);
  document.getElementById('s-cov').textContent = `${Math.round(s.covered * 100)}%`;
  document.getElementById('s-waste').textContent = `${s.wasteM2.toFixed(2)} m²`;
  document.getElementById('s-seam').textContent = `${s.seamM.toFixed(1)} m`;
  document.getElementById('s-kg').textContent = `${s.savedKg} kg`;
  document.getElementById('turn').disabled = !selected;
  window.__fit = { target: [target.w, target.h, target.cells.reduce((a, b) => a + b, 0)], masks: pieces.map((p) => [p.mask.w, p.mask.h, p.mask.cells.reduce((a, b) => a + b, 0)]), pieces: pieces.map(({ id, x, y, turns, placed }) => ({ id, x, y, turns, placed })), score: s };
}

const pick = (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
};

const snapped = (p, at) => {
  const [w, h] = dims(p);
  p.x = Math.round((at.x - origin.x) / CELL - w / 2);
  p.y = Math.round((at.z - origin.z) / CELL - h / 2);
};

canvas.addEventListener('pointerdown', (e) => {
  pick(e);
  const hit = ray.intersectObjects(pieces.map((p) => p.group), true)[0];
  if (!hit) return;
  let o = hit.object;
  while (!pieces.some((p) => p.group === o)) o = o.parent;
  selected = dragging = pieces.find((p) => p.group === o);
  controls.enabled = false;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events in the drag test have no live pointer */ }
  refresh();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  pick(e);
  const at = ray.ray.intersectPlane(dragPlane, new THREE.Vector3());
  if (!at) return;
  snapped(dragging, at);
  moveTo(dragging);
});
canvas.addEventListener('pointerup', () => {
  if (!dragging) return;
  const p = dragging;
  dragging = null;
  controls.enabled = true;
  const [w, h] = dims(p);
  const near = p.x + w > 0 && p.y + h > 0 && p.x < target.w && p.y < target.h;
  p.placed = near && fits(pieces.filter((q) => q.placed), p);
  if (p.placed) moveTo(p); else rack(p);
  refresh();
});

function turn() {
  if (!selected) return;
  selected.turns = (selected.turns + 1) % 4;
  if (!selected.placed) return rack(selected), refresh();
  moveTo(selected);
  if (!fits(pieces.filter((q) => q.placed), selected)) rack(selected);
  refresh();
}
document.getElementById('turn').onclick = turn;
addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') turn(); });
document.getElementById('reset').onclick = () => {
  pieces.forEach((p) => { p.turns = 0; rack(p); });
  selected = null;
  refresh();
};

// OrbitControls must come after our pointerdown so a slab grab can switch it off first.
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = 1.35;
controls.minDistance = 3;
controls.maxDistance = 24;

let sceneDepth = 5;
function fit(front) {
  if (typeof front === 'number') sceneDepth = front;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const mid = (origin.z + sceneDepth) / 2;
  const span = Math.max(4.2 / Math.min(1.4, camera.aspect), sceneDepth - origin.z) ;
  const dist = span * 1.9;
  controls.target.set(0, 0.3, mid);
  camera.position.set(0, dist * 0.95, mid + dist * 0.35);
  controls.update();
}
addEventListener('resize', () => fit());

async function main() {
  const loader = new GLTFLoader();
  const load = (n) => loader.loadAsync(`models/${n}.glb`).then((g) => g.scene);
  const kitchen = await load('kitchen');
  scene.add(counterFrom(kitchen));
  outlineTarget();
  const cache = {};
  for (const [i, [name, len]] of STOCK.entries()) {
    cache[name] ??= await load(name);
    const { group, mask, thick } = slabFrom(cache[name], len);
    const p = { id: `${name}-${i}`, group, mask, thick, turns: 0, x: 0, y: 0, placed: false, slot: i };
    scene.add(group);
    pieces.push(p);
  }
  const front = layRack();
  pieces.forEach(rack);
  fit(front);
  refresh();
  document.getElementById('load').classList.add('gone');
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}

// The level is the mesh: stand the kitchen at counter height, then every cell whose top surface is the
// highest level of the model is counter, and anything lower (the sink, the floor) is not.
function counterFrom(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = LONGEST_RUN / Math.max(size.x, size.z);
  model.scale.set(s, TOP / size.y, s);
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  model.position.y += TOP / 2;
  model.updateMatrixWorld(true);
  box.setFromObject(model);
  box.getSize(size);
  model.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });

  const w = Math.round(size.x / CELL);
  const h = Math.round(size.z / CELL);
  const down = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, -1, 0);
  target = grid(w, h, (x, y) => {
    down.set(new THREE.Vector3((x + 0.5 - w / 2) * CELL, 5, (y + 0.5 - h / 2) * CELL), dir);
    const hit = down.intersectObject(model, true)[0];
    return !!hit && hit.point.y > TOP - TOP_TOLERANCE;
  });
  origin = new THREE.Vector3((-w * CELL) / 2, TOP, (-h * CELL) / 2);
  return model;
}

// Rows in front of the kitchen; each slab gets a square so it can turn without touching its neighbour.
function layRack() {
  let x = 0, z = origin.z + target.h * CELL + 0.7, row = 0, rowDepth = 0;
  const rows = [[]];
  for (const p of pieces) {
    const side = Math.max(p.mask.w, p.mask.h) * CELL + 0.1;
    if (x + side > 3.6) { x = 0; z += rowDepth; rowDepth = 0; rows[++row] = []; }
    p.home = { x: x + side / 2, z: z + side / 2 };
    rows[row].push(p);
    x += side;
    rowDepth = Math.max(rowDepth, side);
  }
  for (const r of rows) {
    const end = r.at(-1).home.x + (Math.max(r.at(-1).mask.w, r.at(-1).mask.h) * CELL + 0.1) / 2;
    r.forEach((p) => { p.home.x -= end / 2; });
  }
  return z + rowDepth;
}

// Test hook: screen position of a slab or of a counter cell, for the drag test in test/drag.js.
window.__at = (id, cx, cy) => {
  const p = pieces.find((q) => q.id === id);
  const v = id ? p.group.position.clone() : new THREE.Vector3(origin.x + cx * CELL, TOP, origin.z + cy * CELL);
  v.project(camera);
  return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
};

main().catch((e) => { document.getElementById('load').textContent = `Could not load the yard: ${e.message}`; });
