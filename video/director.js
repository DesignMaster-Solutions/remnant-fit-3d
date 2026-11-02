// Plays the real game for the film, frame by frame, through the same pointer handlers a player uses.
// HyperFrames seeks forward in time (hf-seek); each seek pumps the game clock up to that time.
// Every sound and story beat is sent to video/record.mjs so the soundtrack and captions land on the picture.
import { onSound } from './audio.js';

const FPS = 30, FRAME = 1000 / FPS;
let film = 0; // ms of film shown so far
const send = (e) => fetch('http://127.0.0.1:8971/', { method: 'POST', body: JSON.stringify({ ...e, at: +(film / 1000).toFixed(3) }) }).catch(() => {});
const mark = (t, extra = {}) => send({ t, ...extra });
onSound((t, arg) => send({ t, arg }));

const canvas = () => document.querySelector('canvas');
const ev = (type, [x, y]) => canvas().dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 3, bubbles: true, isPrimary: true, button: 0, buttons: 1, pointerType: 'mouse' }));
const click = (sel) => document.querySelector(sel).click();
const piece = (id) => window.__fit.pieces.find((p) => p.id === id);
const loaded = (n) => new Promise((res) => {
  const ok = () => window.__fit && window.__fit.level === n && !document.getElementById('load').classList.contains('on');
  const poll = () => (ok() ? res() : setTimeout(poll, 50));
  poll();
});
const smooth = (t) => t * t * (3 - 2 * t);

function* drag(id, cx, cy, ms) {
  const a = window.__at(id);
  ev('pointerdown', a);
  yield 160;
  for (let t = 0; t <= ms; t += FRAME) {
    const b = window.__at(null, cx, cy), k = smooth(Math.min(1, t / ms));
    ev('pointermove', [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    yield FRAME;
  }
  ev('pointerup', window.__at(null, cx, cy));
}

// Lays the foreman's plan by hand. `mistake` first drops the second slab onto the first one.
function* lay(speed = 1, mistake = false) {
  const plan = window.__plan();
  for (const [i, q] of plan.entries()) {
    if (mistake && i === 1) {
      const first = piece(plan[0].id), [w, h] = first.dims;
      yield* drag(q.id, first.x + w / 2, first.y + h / 2, 700 * speed);
      mark('mistake');
      yield 900;
    }
    if (q.turns) {
      const tap = window.__at(q.id);
      ev('pointerdown', tap); ev('pointerup', tap);
      yield 450;
      for (let k = 0; k < q.turns; k++) { click('#turn'); mark('turn'); yield 380 * speed; }
      yield 250;
    }
    const [w, h] = piece(q.id).dims;
    yield* drag(q.id, q.x + w / 2, q.y + h / 2, 900 * speed);
    yield 650 * speed;
  }
}

function* script() {
  mark('intro');
  yield 5200;
  click('#start');
  yield loaded(0);
  mark('job', { n: 1 });
  yield 1800;
  yield* lay(1.15);
  yield 900;
  click('#finish'); mark('finish', { n: 1 });
  yield 4200;
  document.querySelectorAll('#r-jobs .dot')[2].click();
  yield loaded(2);
  mark('job', { n: 3 });
  yield 1500;
  yield* lay(0.85, true);
  yield 700;
  click('#finish'); mark('finish', { n: 3 });
  yield 4000;
  document.querySelectorAll('#r-jobs .dot')[4].click();
  yield loaded(4);
  mark('job', { n: 5 });
  yield 1200;
  yield* lay(0.75);
  yield 700;
  click('#finish'); mark('finish', { n: 5 });
  yield 6000;
  mark('end');
}

// Film time only moves while nothing is loading: a level load takes zero film time.
const run = script();
let resumeAt = 0, done = false;
async function pumpTo(ms) {
  while (film < ms) {
    if (!done && film >= resumeAt) {
      const r = run.next();
      if (r.done) { done = true; continue; }
      if (r.value instanceof Promise) { await r.value; continue; }
      resumeAt = film + r.value;
      continue;
    }
    const step = Math.min(FRAME, ms - film, done ? Infinity : resumeAt - film);
    window.__clock.pump(step);
    film += step;
  }
}

// The host probes a few spread-out times first; the game only moves forward, so it starts on the first
// frame-to-frame step. Replaying from 0 is deterministic, so a reopened page is safe.
let armed = false, last = -1;
window.addEventListener('hf-seek', (e) => {
  const t = e.detail.time;
  if (!armed) { if (t > last && t - last < 0.05) armed = true; last = t; if (!armed) return; }
  e.detail.waitUntil(pumpTo(t * 1000));
});
