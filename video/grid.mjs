// Draws the counter grid the game reads from a kitchen mesh, as an SVG: node video/grid.mjs <model> <run> > out.svg
import { loadGlb } from '../test/glb.js';
import { counterFrom } from '../public/mesh-grid.js';
const [name, run] = process.argv.slice(2);
const { target: t } = counterFrom(await loadGlb(new URL(`../public/models/${name}.glb`, import.meta.url).pathname), +run);
const s = 22, cells = [];
for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
  const on = t.cells[y * t.w + x];
  cells.push(`<rect x="${x * s + 1}" y="${y * s + 1}" width="${s - 2}" height="${s - 2}" fill="${on ? '#f4c430' : '#2c3035'}"/>`);
}
console.log(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.w * s}" height="${t.h * s}"><rect width="100%" height="100%" fill="#1d2023"/>${cells.join('')}</svg>`);
