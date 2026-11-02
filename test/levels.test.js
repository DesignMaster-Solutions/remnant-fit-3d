// Every level is read from its Lux3D kitchen exactly as the game does, then the foreman must be able to
// cover most of it with that level's yard: proof that each job can be finished with three stars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, NAMES } from '../public/levels.js';
import { counterFrom, slabFrom } from '../public/mesh-grid.js';
import { foreman, score, fits } from '../public/fit.js';
import { loadGlb } from './glb.js';

const cache = {};
const model = (n) => (cache[n] ??= loadGlb(new URL(`../public/models/${n}.glb`, import.meta.url).pathname));
const area = (g) => g.cells.reduce((a, b) => a + b, 0);

for (const [i, level] of LEVELS.entries()) {
  test(`job ${i + 1} (${level.kitchen}) is a real counter the foreman can cover`, async () => {
    const { target } = counterFrom((await model(level.kitchen)).clone(true), level.run);
    assert.ok(area(target) > 120, `counter too small: ${area(target)} cells`);
    assert.ok(area(target) < target.w * target.h, 'counter has no shape: every cell is top');
    const stock = [];
    for (const [k, [name, len]] of level.stock.entries()) {
      assert.ok(NAMES[name], `${name} has no display name`);
      const { mask } = slabFrom(await model(name), len);
      assert.ok(area(mask) >= 20, `${name} at ${len} m reads as ${area(mask)} cells`);
      stock.push({ id: `${name}-${k}`, mask });
    }
    const placed = foreman(target, stock).map((p) => ({ ...p, mask: stock.find((s) => s.id === p.id).mask }));
    for (const p of placed) assert.ok(fits(placed, p));
    const s = score(target, placed);
    assert.ok(s.covered >= 0.8, `foreman only covers ${Math.round(s.covered * 100)}%`);
    assert.ok(s.rating > 50, `foreman rating ${s.rating}`);
    console.log(`job ${i + 1}: ${target.w}x${target.h}, ${area(target)} cells, foreman ${Math.round(s.covered * 100)}% cover, ${s.wasteM2.toFixed(2)} m2 cut, ${s.seamM.toFixed(1)} m seams, rating ${s.rating}`);
  });
}

test('the top-down rasteriser reads the same grids the v1 raycaster did', async () => {
  assert.equal(area(counterFrom((await model('kitchen')).clone(true), 3.2).target), 583);
  assert.equal(area(slabFrom(await model('remnant-b'), 2.1).mask), 197);
});
