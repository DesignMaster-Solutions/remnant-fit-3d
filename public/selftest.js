// Loaded only with ?selftest: plays job 1 through the real pointer handlers and prints what happened,
// so a device or simulator with no script console can still run the test and show the result.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (ok, ms = 20000) => { const t = Date.now(); while (!ok()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(100); } };
const c = () => document.querySelector('canvas');
const ev = (type, [x, y]) => c().dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, button: 0, buttons: 1, pointerType: 'touch' }));
async function drag(id, cx, cy) {
  const a = __at(id), b = __at(null, cx, cy);
  ev('pointerdown', a);
  for (let i = 1; i <= 8; i++) { ev('pointermove', [a[0] + ((b[0] - a[0]) * i) / 8, a[1] + ((b[1] - a[1]) * i) / 8]); await wait(16); }
  ev('pointerup', b);
  await wait(400);
  return __fit.pieces.find((p) => p.id === id);
}
const out = document.createElement('pre');
out.id = 'selftest';
out.style.cssText = 'position:fixed;left:8px;top:120px;z-index:9;background:#000c;color:#9be08a;font:12px/1.3 monospace;padding:8px;margin:0;max-width:94vw;white-space:pre-wrap';
document.body.append(out);
const log = (s) => { out.textContent += s + '\n'; };
const check = (name, ok, detail = '') => log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
(async () => {
  try {
    await until(() => document.getElementById('start'));
    document.getElementById('start').click();
    await until(() => window.__fit && window.__fit.level === 0);
    await wait(500);
    const t = __fit.target;
    check('job 1 read from the mesh', t[2] > 120, `${t[0]}x${t[1]} ${t[2]} cells`);
    const first = __fit.pieces[0].id, second = __fit.pieces[1].id;
    let p = await drag(first, 6, 3);
    check('drag onto the counter places the slab', p.placed, `${first} at ${p.x},${p.y}`);
    p = await drag(second, 6, 3);
    check('a slab dropped on another goes back to the yard', !p.placed);
    const turns = p.turns;
    document.getElementById('turn').click();
    await wait(300);
    check('turn button turns the selected slab', __fit.pieces[1].turns === (turns + 1) % 4);
    // A plain tap on a yard slab only selects it, even when 0,0 on the counter is taken.
    await wait(1800); // let the bounce toast clear
    await drag(first, 1, 1);
    const tap = __at(__fit.pieces[2].id);
    ev('pointerdown', tap); ev('pointerup', tap);
    await wait(200);
    const t2 = document.getElementById('toast');
    check('a tap in the yard selects without trying to place', !__fit.pieces[2].placed && !(t2.classList.contains('on') && t2.textContent.includes('taken')), t2.textContent);
    document.getElementById('reset').click();
    await wait(500);
    check('start over clears the counter', __fit.score.covered === 0);
    // Lay the foreman's own plan by hand: tap to select, turn, drag. Matching it must earn three stars.
    for (const q of __plan()) {
      const tap = __at(q.id);
      ev('pointerdown', tap); ev('pointerup', tap);
      await wait(400);
      for (let k = 0; k < q.turns; k++) { document.getElementById('turn').click(); await wait(250); }
      const [w, h] = __fit.pieces.find((x) => x.id === q.id).dims;
      await drag(q.id, q.x + w / 2, q.y + h / 2);
    }
    check('the foreman plan laid by hand matches his score', __fit.score.rating === __fit.bar, `${__fit.score.rating} vs ${__fit.bar}`);
    document.getElementById('finish').click();
    await wait(600);
    const card = document.getElementById('result');
    check('finish shows the result card with 3 stars', card.classList.contains('on') && document.getElementById('r-stars').textContent === '★★★', document.getElementById('r-title').textContent);
    document.getElementById('next').click();
    await until(() => __fit.level === 1);
    check('next job loads job 2', true, `${__fit.target[0]}x${__fit.target[1]}`);
    log('DONE');
  } catch (e) { log('FAIL exception ' + e.message); }
})();
