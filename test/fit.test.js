import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grid, rotated, fits, score, foreman, stars, jobResult, keepLarge, solid } from '../public/fit.js';

const bar = grid(3, 1, () => true); // ###
const ell = grid(2, 2, (x, y) => !(x === 1 && y === 1)); // ##/#.

test('quarter turns keep area and four turns are identity', () => {
  const r = rotated(ell, 1);
  assert.deepEqual([r.w, r.h], [2, 2]);
  assert.deepEqual([...r.cells], [1, 1, 0, 1]); // clockwise: gap moves from bottom-right to bottom-left
  assert.deepEqual([...rotated(ell, 4).cells], [...ell.cells]);
  assert.deepEqual([rotated(bar, 1).w, rotated(bar, 1).h], [1, 3]);
});

test('slabs cannot overlap but may overhang', () => {
  const a = { id: 'a', mask: bar, x: 0, y: 0 };
  assert.equal(fits([a], { id: 'b', mask: bar, x: 2, y: 0 }), false);
  assert.equal(fits([a], { id: 'b', mask: bar, x: 3, y: 0 }), true);
  assert.equal(fits([a], { id: 'a', mask: bar, x: 1, y: 0 }), true); // moving itself
});

test('score counts cover, sawn-off waste, seams and saved stone', () => {
  const t = grid(4, 1, () => true);
  const s = score(t, [
    { id: 'a', mask: bar, x: -1, y: 0 }, // one cell hangs off
    { id: 'b', mask: bar, x: 2, y: 0 }, // one cell hangs off
  ]);
  assert.equal(s.covered, 1);
  assert.ok(Math.abs(s.wasteM2 - 0.02) < 1e-9);
  assert.ok(Math.abs(s.seamM - 0.1) < 1e-9);
  assert.equal(s.savedKg, 3);
  assert.equal(s.rating, 99); // 100 - 0.2 waste - 0.5 seam
});

test('the foreman covers the counter without overlaps and rates as score() does', () => {
  const t = grid(5, 2, () => true);
  const stock = [{ id: 'a', mask: grid(3, 2, () => true) }, { id: 'b', mask: grid(2, 2, () => true) }, { id: 'c', mask: bar }];
  const plan = foreman(t, stock);
  const placed = plan.map((p) => ({ ...p, mask: stock.find((s) => s.id === p.id).mask }));
  for (const p of placed) assert.ok(fits(placed, p), `${p.id} overlaps`);
  const s = score(t, placed);
  assert.equal(s.covered, 1);
  assert.equal(s.wasteM2, 0);
  assert.ok(!plan.some((p) => p.id === 'c'), 'a slab that only adds waste stays in the yard');
});

test('the foreman turns a slab when that is what fits', () => {
  const t = grid(1, 3, () => true);
  const [p] = foreman(t, [{ id: 'a', mask: bar }]);
  assert.equal(p.turns % 2, 1);
  assert.equal(score(t, [{ ...p, mask: bar }]).covered, 1);
});

test('stars compare the player with the foreman', () => {
  assert.equal(stars(50, 100), 0);
  assert.equal(stars(70, 100), 1);
  assert.equal(stars(90, 100), 2);
  assert.equal(stars(100, 100), 3);
  assert.equal(stars(101, 100), 3);
});

test('finishing a job buys new stone for whatever is left uncovered', () => {
  const t = grid(4, 1, () => true);
  const r = jobResult(t, [{ id: 'a', mask: bar, x: 0, y: 0 }]);
  assert.equal(r.savedKg, 2);
  assert.equal(r.newKg, 1);
});

test('specks smaller than a hand (handles poking up to the top) are not counter', () => {
  const g = grid(8, 3, (x, y) => y === 0 || (y === 2 && x === 3));
  const k = keepLarge(g, 4);
  assert.equal(k.cells.reduce((a, b) => a + b, 0), 8);
  assert.equal(k.cells[2 * 8 + 3], 0);
});

test('a one-cell-wide strip hanging off the counter is a handle, not counter', () => {
  const g = grid(6, 4, (x, y) => y < 2 || x === 2);
  const s = solid(g);
  assert.equal(s.cells.reduce((a, b) => a + b, 0), 12);
});
