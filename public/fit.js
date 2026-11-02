// Pure fitting rules: everything is a boolean grid of 10 cm cells, so the game and the tests share one truth.
export const CELL = 0.1; // metres
const KG_PER_M2 = 81; // 3 cm stone at 2.7 t/m3

export function grid(w, h, on) {
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) cells[y * w + x] = 1;
  return { w, h, cells };
}

const at = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.cells[y * g.w + x] === 1;

// One clockwise quarter turn per `turns`; same sense as a mesh rotated by -turns * 90 degrees around Y.
export function rotated(mask, turns) {
  let m = mask;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
    const src = m;
    m = grid(src.h, src.w, (x, y) => at(src, y, src.h - 1 - x));
  }
  return m;
}

const cellsOf = (piece) => {
  const m = rotated(piece.mask, piece.turns || 0);
  const out = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(m, x, y)) out.push([x + piece.x, y + piece.y]);
  return out;
};

// Two slabs cannot share a cell; overhang past the counter is legal because it gets sawn off.
export function fits(placed, piece) {
  const taken = new Set(placed.filter((p) => p.id !== piece.id).flatMap(cellsOf).map(String));
  return cellsOf(piece).every((c) => !taken.has(String(c)));
}

export function score(target, placed) {
  const owner = new Map();
  let waste = 0;
  for (const p of placed) {
    for (const [x, y] of cellsOf(p)) {
      if (at(target, x, y)) owner.set(`${x},${y}`, p.id);
      else waste++;
    }
  }
  let seams = 0;
  for (const [key, id] of owner) {
    const [x, y] = key.split(',').map(Number);
    for (const n of [`${x + 1},${y}`, `${x},${y + 1}`]) if (owner.has(n) && owner.get(n) !== id) seams++;
  }
  const total = target.cells.reduce((a, b) => a + b, 0);
  const m2 = CELL * CELL;
  return {
    covered: owner.size / total,
    wasteM2: waste * m2,
    seamM: seams * CELL,
    savedKg: Math.round(owner.size * m2 * KG_PER_M2),
    rating: Math.max(0, Math.round((owner.size / total) * 100 - waste * m2 * 10 - seams * CELL * 5)),
  };
}

// Rating weights from score(): a cell of cover is 100/total points, a sawn-off cell 0.1, a seam edge 0.5.
// The foreman lays the biggest slabs first, each at the spot and turn that adds the most rating.
// shortcut: greedy, not optimal; it is the bar to beat, not the best possible plan.
export function foreman(target, stock) {
  const total = target.cells.reduce((a, b) => a + b, 0);
  const pad = Math.max(...stock.map((s) => Math.max(s.mask.w, s.mask.h))) + 1;
  const W = target.w + 2 * pad, H = target.h + 2 * pad;
  const owner = new Int16Array(W * H); // 0 = free, else index + 1 of the slab that took the cell
  const onT = new Uint8Array(W * H);
  for (let y = 0; y < target.h; y++) for (let x = 0; x < target.w; x++) onT[(y + pad) * W + x + pad] = target.cells[y * target.w + x];
  const plan = [];
  const area = (s) => s.mask.cells.reduce((a, b) => a + b, 0);
  const cover = 100 / total;
  [...stock].sort((a, b) => area(b) - area(a)).forEach((s, si) => {
    let best = null;
    for (let turns = 0; turns < 4; turns++) {
      const m = rotated(s.mask, turns);
      const local = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.cells[y * m.w + x]) local.push(y * W + x);
      for (let oy = 1 - m.h; oy < target.h; oy++) for (let ox = 1 - m.w; ox < target.w; ox++) {
        const base = (oy + pad) * W + ox + pad;
        let gain = 0, clash = false;
        for (const l of local) {
          const k = base + l;
          if (owner[k]) { clash = true; break; }
          if (!onT[k]) { gain -= 0.1; continue; }
          gain += cover;
          if (owner[k + 1]) gain -= 0.5;
          if (owner[k - 1]) gain -= 0.5;
          if (owner[k + W]) gain -= 0.5;
          if (owner[k - W]) gain -= 0.5;
        }
        if (!clash && gain > 0 && (!best || gain > best.gain)) best = { gain, base, x: ox, y: oy, turns, local };
      }
    }
    if (!best) return;
    for (const l of best.local) owner[best.base + l] = si + 1;
    plan.push({ id: s.id, x: best.x, y: best.y, turns: best.turns });
  });
  return plan;
}

export const stars = (rating, bar) => (rating >= bar ? 3 : rating >= 0.9 * bar ? 2 : rating >= 0.7 * bar ? 1 : 0);

// Closing a job: what the offcuts covered is stone saved; the rest is cut from a new slab.
export function jobResult(target, placed) {
  const s = score(target, placed);
  const total = target.cells.reduce((a, b) => a + b, 0);
  return { ...s, newKg: Math.round(total * (1 - s.covered) * CELL * CELL * KG_PER_M2) };
}

// Drops 4-connected patches under `min` cells: bits of handle or trim that reach the top of the cabinets.
export function keepLarge(g, min) {
  const seen = new Uint8Array(g.w * g.h);
  const out = grid(g.w, g.h, () => false);
  for (let s = 0; s < seen.length; s++) {
    if (!g.cells[s] || seen[s]) continue;
    const patch = [s];
    seen[s] = 1;
    for (let i = 0; i < patch.length; i++) {
      const k = patch[i], x = k % g.w, y = (k / g.w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const n = ny * g.w + nx;
        if (nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && g.cells[n] && !seen[n]) { seen[n] = 1; patch.push(n); }
      }
    }
    if (patch.length >= min) for (const k of patch) out.cells[k] = 1;
  }
  return out;
}

// Keeps a cell only if some full 2x2 block of cells contains it: a counter has width, a handle does not.
export function solid(g) {
  const on = (x, y) => at(g, x, y);
  return grid(g.w, g.h, (x, y) => on(x, y) && [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) =>
    on(x + dx, y + dy) && on(x + dx + 1, y + dy) && on(x + dx, y + dy + 1) && on(x + dx + 1, y + dy + 1)));
}
