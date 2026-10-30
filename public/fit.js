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
