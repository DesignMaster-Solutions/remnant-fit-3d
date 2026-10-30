// Runs in the page (browse <device> js): a pointer drag from the rack to the counter through the real handlers.
const c = document.querySelector('canvas');
const ev = (t, [x, y]) => c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, button: 0, buttons: 1, pointerType: 'touch' }));
const out = [];
const drag = (id, cx, cy) => { const a = __at(id), b = __at(null, cx, cy); ev('pointerdown', a); ev('pointermove', b); ev('pointerup', b); const p = __fit.pieces.find((q) => q.id === id); out.push([id, p.placed, p.x, p.y]); };
drag('remnant-a-0', 8, 4); // big marble onto the run
drag('remnant-b-1', 8, 4); // same spot: must bounce back to the rack
const bounced = !__fit.pieces.find((q) => q.id === 'remnant-b-1').placed;
drag('remnant-c-2', 22, 4);
document.getElementById('turn').click();
await new Promise((r) => setTimeout(r, 400));
return JSON.stringify({ out, bounced, score: __fit.score, turned: __fit.pieces.find((q) => q.id === 'remnant-c-2') });
