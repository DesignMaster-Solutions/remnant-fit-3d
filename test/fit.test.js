import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grid, rotated, fits, score } from '../public/fit.js';

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
