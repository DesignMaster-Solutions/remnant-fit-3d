# Remnant Fit 3D

Entry for the Manycore Aholo Global 3D AI Hackathon. A browser puzzle about a real waste problem in stone shops: offcuts get thrown away because nobody can picture them on a counter.

Every slab and the kitchen are Aholo Lux3D generations (`lux3d/gen.py`, G1 text-to-3D). The game casts rays down onto the generated meshes: each slab outline, the counter and its sink hole all come from the mesh, so a new Lux3D kitchen is a new level with no level data. Drag slabs onto the counter, turn them, and score cover against sawn-off waste and seam length. Saved weight uses 3 cm stone at 2.7 t/m³.

- `public/fit.js`: fitting rules on a 10 cm grid, tested in `test/fit.test.js` (`npm test`)
- `public/game.js`: three.js scene, drag and turn
- Live: https://remnant-fit-3d.designmaster.workers.dev
- `test/drag.js`: drag test run inside the page on a real device
- Deploy: `npx wrangler deploy`
