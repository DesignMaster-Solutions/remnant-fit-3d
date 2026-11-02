import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CELL, rotated, fits, score, foreman, jobResult, stars } from './fit.js';
import { TOP, counterFrom, slabFrom } from './mesh-grid.js';
import { LEVELS } from './levels.js';
import * as sfx from './audio.js';
import * as ui from './ui.js';

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!window.__FILM });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2023);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(2, 6, 3);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
const controls = new OrbitControls(camera, canvas);
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const loader = new GLTFLoader();
const models = {};
const load = (n) => (models[n] ??= loader.loadAsync(`models/${n}.glb`).then((g) => g.scene));

// Game clock: real time normally, pumped frame by frame when the film recorder drives the page.
let now = 0;
const tweens = [];
const tween = (ms, fn, done) => tweens.push({ t0: now, ms, fn, done });
const ease = (t) => 1 - (1 - t) ** 3;
const bounce = (t) => (t < 0.7 ? (t / 0.7) ** 2 : 1 - Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.06);

let level, levelIndex = 0, target, origin, bar = 1, pieces = [], selected = null, dragging = null, firstMove = true;
const state = ui.loadProgress();

// Sawn-off and clash cells drawn over the slabs as tiles; dust as a small burst of points.
const MAX_TILES = 4000;
const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false }), MAX_TILES);
tiles.count = 0;
tiles.renderOrder = 2;
scene.add(tiles);
const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xd9d4c7, size: 0.035, transparent: true, depthWrite: false }));
scene.add(dust);
let dustBits = [];

function puff(at, n = 40) {
  dustBits = Array.from({ length: n }, () => ({
    p: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)),
    v: new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.9, (Math.random() - 0.5) * 1.2),
  }));
  dust.material.opacity = 0.9;
}

const levelGroup = new THREE.Group();
scene.add(levelGroup);
let outline;

async function loadLevel(i) {
  levelIndex = i;
  level = LEVELS[i];
  ui.loading(true);
  levelGroup.clear();
  pieces = [];
  selected = dragging = null;
  const kitchen = (await load(level.kitchen)).clone(true);
  ({ target, origin } = counterFrom(kitchen, level.run));
  kitchen.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  levelGroup.add(kitchen);
  levelGroup.add(outline = outlineOf(target, origin));
  for (const [k, [name, len]] of level.stock.entries()) {
    const { group, mask, thick } = slabFrom(await load(name), len);
    group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const p = { id: `${name}-${k}`, name, group, mask, thick, turns: 0, x: 0, y: 0, placed: false };
    levelGroup.add(group);
    pieces.push(p);
  }
  const plan = foreman(target, pieces);
  bar = score(target, plan.map((q) => ({ ...q, mask: pieces.find((p) => p.id === q.id).mask }))).rating;
  const front = layRack();
  pieces.forEach((p) => rack(p, false));
  frame(front);
  refresh();
  ui.loading(false);
  ui.job(i, LEVELS.length, level, bar);
  sfx.knock(0.2);
}

function outlineOf(t, o) {
  const pts = [];
  const seg = (x1, y1, x2, y2) => pts.push(new THREE.Vector3(x1 * CELL, 0, y1 * CELL), new THREE.Vector3(x2 * CELL, 0, y2 * CELL));
  const on = (x, y) => x >= 0 && y >= 0 && x < t.w && y < t.h && t.cells[y * t.w + x] === 1;
  for (let y = 0; y <= t.h; y++) for (let x = 0; x <= t.w; x++) {
    if (on(x, y) !== on(x, y - 1)) seg(x, y, x + 1, y);
    if (on(x, y) !== on(x - 1, y)) seg(x, y, x, y + 1);
  }
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf4c430 }));
  line.position.copy(o).add(new THREE.Vector3(0, 0.012, 0));
  return line;
}

const dims = (p) => { const m = rotated(p.mask, p.turns); return [m.w, m.h]; };
const onCounter = (p) => new THREE.Vector3(origin.x + (p.x + dims(p)[0] / 2) * CELL, TOP + p.thick / 2 + 0.005, origin.z + (p.y + dims(p)[1] / 2) * CELL);
const inRack = (p) => new THREE.Vector3(p.home.x, p.thick / 2 + 0.01, p.home.z);

function glide(p, to, ms = 260, fn = ease, done) {
  const from = p.group.position.clone();
  tween(ms, (t) => p.group.position.lerpVectors(from, to, fn(t)), done);
}

function rack(p, animate = true) {
  p.placed = false;
  p.group.rotation.y = (-p.turns * Math.PI) / 2;
  if (animate) glide(p, inRack(p), 380); else p.group.position.copy(inRack(p));
}

// Tiles: orange for what the saw will take off, red where the slab sits on another one.
function paintTiles() {
  const placed = pieces.filter((p) => p.placed && p !== dragging);
  const taken = new Set();
  for (const p of placed) for (const c of cellsOf(p)) taken.add(String(c));
  let n = 0;
  const m4 = new THREE.Matrix4();
  const put = (p, [x, y], color) => {
    if (n >= MAX_TILES) return;
    m4.makeTranslation(origin.x + (x + 0.5) * CELL, p.group.position.y + p.thick / 2 + 0.006, origin.z + (y + 0.5) * CELL);
    tiles.setMatrixAt(n, m4);
    tiles.setColorAt(n++, new THREE.Color(color));
  };
  const on = (x, y) => x >= 0 && y >= 0 && x < target.w && y < target.h && target.cells[y * target.w + x] === 1;
  for (const p of [...placed, ...(dragging ? [dragging] : [])]) {
    for (const c of cellsOf(p)) {
      if (p === dragging && taken.has(String(c))) put(p, c, 0xe5533d);
      else if (!on(...c)) put(p, c, 0xf08a24);
    }
  }
  tiles.count = n;
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
}

function cellsOf(p) {
  const m = rotated(p.mask, p.turns);
  const out = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.cells[y * m.w + x]) out.push([x + p.x, y + p.y]);
  return out;
}

function refresh() {
  const placed = pieces.filter((p) => p.placed);
  const s = score(target, placed);
  ui.stats(s, bar, !!selected, placed.length > 0);
  paintTiles();
  window.__fit = {
    level: levelIndex, bar, target: [target.w, target.h, target.cells.reduce((a, b) => a + b, 0)],
    pieces: pieces.map((p) => ({ id: p.id, x: p.x, y: p.y, turns: p.turns, placed: p.placed, dims: dims(p) })), score: s,
  };
}

const pick = (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
};
const snapTo = (p, at) => {
  const [w, h] = dims(p);
  p.x = Math.round((at.x - origin.x) / CELL - w / 2);
  p.y = Math.round((at.z - origin.z) / CELL - h / 2);
};

let lastTap = { id: null, at: -1e9 };
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (!target) return;
  pick(e);
  const hit = ray.intersectObjects(pieces.map((p) => p.group), true)[0];
  if (!hit) return;
  let o = hit.object;
  while (!pieces.some((p) => p.group === o)) o = o.parent;
  const p = pieces.find((q) => q.group === o);
  // A second tap on the same slab turns it: the quickest turn on a phone.
  if (lastTap.id === p.id && now - lastTap.at < 320) { selected = p; lastTap.id = null; turn(); return; }
  lastTap = { id: p.id, at: now };
  selected = dragging = p;
  dragging.lift = 0.18;
  dragging.moved = false;
  controls.enabled = false;
  sfx.lift();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers in tests have no capture */ }
  refresh();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  dragging.moved = true;
  pick(e);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP - 0.03);
  const at = ray.ray.intersectPlane(plane, new THREE.Vector3());
  if (!at) return;
  snapTo(dragging, at);
  dragging.group.rotation.y = (-dragging.turns * Math.PI) / 2;
  dragging.group.position.copy(onCounter(dragging)).add(new THREE.Vector3(0, dragging.lift, 0));
  paintTiles();
});
canvas.addEventListener('pointerup', () => { if (dragging) drop(dragging); });
canvas.addEventListener('pointercancel', () => { if (dragging) drop(dragging); });

function drop(p) {
  dragging = null;
  controls.enabled = true;
  if (!p.moved) { refresh(); return; } // a tap only selects
  const [w, h] = dims(p);
  const near = p.x + w > 0 && p.y + h > 0 && p.x < target.w && p.y < target.h;
  const before = score(target, pieces.filter((q) => q.placed && q !== p));
  p.placed = near && fits(pieces.filter((q) => q.placed), p);
  if (!p.placed) {
    if (near) { sfx.bump(); sfx.buzz([20, 40, 20]); ui.toast('That spot is taken. Back to the yard.'); }
    rack(p);
    refresh();
    return;
  }
  const after = score(target, pieces.filter((q) => q.placed));
  const to = onCounter(p);
  glide(p, to, 300, bounce, () => {
    const big = p.mask.cells.reduce((a, b) => a + b, 0) / 400;
    sfx.knock(Math.min(1, big));
    sfx.buzz(18);
    puff(to);
    shake = 0.04;
    const cut = after.wasteM2 - before.wasteM2;
    if (cut > 0.005) { sfx.saw(cut); ui.toast(`Saw takes ${Math.round(cut * 81)} kg off`); }
    if (after.covered >= 0.999) ui.nudgeFinish();
  });
  if (firstMove) { firstMove = false; ui.coach('Tap a slab twice (or press Turn) to rotate it. Orange is what the saw cuts off.'); }
  refresh();
}

function turn() {
  if (!selected) return;
  const p = selected;
  p.turns = (p.turns + 1) % 4;
  const from = p.group.rotation.y, to = (-p.turns * Math.PI) / 2;
  const target2 = from - Math.PI / 2;
  tween(180, (t) => { p.group.rotation.y = from + (target2 - from) * ease(t); }, () => { p.group.rotation.y = to; });
  sfx.lift();
  if (p.placed) {
    p.group.position.copy(onCounter(p));
    if (!fits(pieces.filter((q) => q.placed), p)) { sfx.bump(); rack(p); }
  }
  refresh();
}

function finish() {
  const placed = pieces.filter((p) => p.placed);
  const r = jobResult(target, placed);
  const got = stars(r.rating, bar);
  state.jobs[levelIndex] = Math.max(state.jobs[levelIndex] || 0, got);
  state.kg[levelIndex] = Math.max(state.kg[levelIndex] || 0, r.savedKg);
  ui.saveProgress(state);
  sfx.chime(got);
  if (got) puff(new THREE.Vector3(0, TOP, 0), 90);
  ui.result(r, bar, got, levelIndex, LEVELS.length, state);
}

ui.bind({
  turn,
  finish,
  reset: () => { pieces.forEach((p) => { p.turns = 0; rack(p); }); selected = null; refresh(); },
  next: () => loadLevel((levelIndex + 1) % LEVELS.length),
  replay: () => loadLevel(levelIndex),
  jump: (i) => loadLevel(i),
  mute: (m) => sfx.setMuted(m),
});
addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') turn(); });

controls.enableDamping = true;
controls.maxPolarAngle = 1.35;
controls.minDistance = 3;
controls.maxDistance = 26;

let yard = { x0: -1.8, x1: 1.8, z1: 5 }, shake = 0;
// Fits the counter and the yard between the header and the footer: steeper camera on a tall screen,
// distance found by bisection on the projected corners, then a view offset centres the band.
function frame(front) {
  if (front && typeof front === 'object') yard = front;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  const top = document.querySelector('header').offsetHeight, bottom = document.querySelector('footer').offsetHeight;
  const xa = Math.min(origin.x, yard.x0) - 0.2, xb = Math.max(origin.x + target.w * CELL, yard.x1) + 0.2;
  const z0 = origin.z - 0.1, z1 = Math.max(yard.z1, origin.z + target.h * CELL) + 0.1;
  const corners = [];
  for (const x of [xa, xb]) for (const z of [z0, z1]) for (const y of [0, TOP]) corners.push(new THREE.Vector3(x, y, z));
  const tilt = camera.aspect < 0.8 ? 0.22 : 0.42; // how far the camera leans back from straight down
  const mid = new THREE.Vector3((xa + xb) / 2, 0.3, (z0 + z1) / 2);
  const band = 2 * (1 - (top + bottom) / h) * 0.94;
  const extent = (dist) => {
    camera.position.set(mid.x, mid.y + dist * Math.cos(tilt), mid.z + dist * Math.sin(tilt));
    camera.lookAt(mid);
    camera.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of corners) { const v = c.clone().project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return { x0, x1, y0, y1, fits: x1 - x0 < 1.9 && y1 - y0 < band };
  };
  let lo = 1, hi = 60;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (extent(m).fits) hi = m; else lo = m; }
  const e = extent(hi);
  // Shift the picture so the scene's middle sits in the middle of the free band.
  const want = ((bottom - top) / h);
  camera.setViewOffset(w, h, 0, ((want - (e.y0 + e.y1) / 2) * h) / 2, w, h);
  controls.target.copy(mid);
  controls.update();
}
addEventListener('resize', () => {
  if (!target) return;
  const box = layRack();
  pieces.forEach((p) => { if (!p.placed && p !== dragging) rack(p, false); });
  frame(box);
});

// The yard: beside the kitchen on a wide screen, in rows in front of it on a tall one. Each slab gets a
// square so it can turn without touching its neighbour. Returns the box the yard covers.
function layRack() {
  const wide = innerWidth / innerHeight > 1.3;
  const maxRow = wide ? Math.max(2.4, target.h * CELL) : Math.max(3.6, target.w * CELL);
  const left = wide ? origin.x + target.w * CELL + 0.5 : 0;
  let x = 0, z = wide ? origin.z : origin.z + target.h * CELL + 0.6, row = 0, rowDepth = 0;
  const rows = [[]];
  for (const p of pieces) {
    const side = Math.max(p.mask.w, p.mask.h) * CELL + 0.1;
    if (x + side > maxRow && rows[row].length) { x = 0; z += rowDepth; rowDepth = 0; rows[++row] = []; }
    p.home = { x: x + side / 2, z: z + side / 2 };
    p.side = side;
    rows[row].push(p);
    x += side;
    rowDepth = Math.max(rowDepth, side);
  }
  let x1 = 0;
  for (const r of rows) {
    const end = r.at(-1).home.x + r.at(-1).side / 2;
    r.forEach((p) => { p.home.x += wide ? left : -end / 2; });
    x1 = Math.max(x1, end);
  }
  return wide ? { x0: left, x1: left + x1, z1: z + rowDepth } : { x0: -x1 / 2, x1: x1 / 2, z1: z + rowDepth };
}

let last = performance.now();
function tick(dt) {
  now += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], t = Math.min(1, (now - tw.t0) / tw.ms);
    tw.fn(t);
    if (t >= 1) { tweens.splice(i, 1); tw.done?.(); }
  }
  if (dustBits.length) {
    const s = dt / 1000;
    for (const b of dustBits) { b.v.y -= 2.5 * s; b.p.addScaledVector(b.v, s); }
    dust.geometry.setFromPoints(dustBits.map((b) => b.p));
    dust.material.opacity *= 0.96;
    if (dust.material.opacity < 0.03) dustBits = [];
  }
  controls.update();
  const jitter = shake > 0.001 ? new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0) : null;
  if (jitter) camera.position.add(jitter);
  renderer.render(scene, camera);
  if (jitter) camera.position.sub(jitter);
  shake *= 0.82;
}

// Test and film hooks: screen position of a slab or of a counter cell; a clock the recorder can drive.
window.__at = (id, cx, cy) => {
  let v;
  if (id) {
    const p = pieces.find((q) => q.id === id), m = rotated(p.mask, p.turns);
    let best = null; // the filled cell nearest the middle: the middle of an L is empty
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const d = (x + 0.5 - m.w / 2) ** 2 + (y + 0.5 - m.h / 2) ** 2;
      if (m.cells[y * m.w + x] && (!best || d < best.d)) best = { d, x, y };
    }
    v = p.group.position.clone().add(new THREE.Vector3((best.x + 0.5 - m.w / 2) * CELL, p.thick / 2, (best.y + 0.5 - m.h / 2) * CELL));
  } else v = new THREE.Vector3(origin.x + cx * CELL, TOP, origin.z + cy * CELL);
  v.project(camera);
  const r = canvas.getBoundingClientRect();
  return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
};
window.__level = (i) => loadLevel(i);
window.__plan = () => foreman(target, pieces);
window.__clock = { pump: (ms) => tick(ms), canvas };

const direct = +new URLSearchParams(location.search).get('job');
if (direct >= 1 && direct <= LEVELS.length) loadLevel(direct - 1).catch((e) => ui.fail(e)); // link straight to a job
else ui.intro(state, () => loadLevel(0)).catch((e) => ui.fail(e));
if (location.search.includes('selftest')) import('./selftest.js');
if (!window.__FILM) {
  renderer.setAnimationLoop(() => { const t = performance.now(); tick(Math.min(50, t - last)); last = t; });
}
