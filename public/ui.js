// Everything on the page that is not the 3D scene: HUD, coach line, cards and saved progress.
const $ = (id) => document.getElementById(id);
const KEY = 'remnant-fit-v2';
let actions = {};
let toastTimer;

export const loadProgress = () => {
  try { return { jobs: [], kg: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { jobs: [], kg: [] }; }
};
export const saveProgress = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const totalKg = (s) => s.kg.reduce((a, b) => a + (b || 0), 0);
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export function bind(a) {
  actions = a;
  $('turn').onclick = () => a.turn();
  $('finish').onclick = () => a.finish();
  $('reset').onclick = () => a.reset();
  $('next').onclick = () => { hide('result'); a.next(); };
  $('again').onclick = () => { hide('result'); a.replay(); };
  $('mute').onclick = () => {
    const m = $('mute').getAttribute('aria-pressed') !== 'true';
    $('mute').setAttribute('aria-pressed', String(m));
    $('mute').textContent = m ? 'Sound off' : 'Sound on';
    a.mute(m);
  };
}

const show = (id) => $(id).classList.add('on');
const hide = (id) => $(id).classList.remove('on');

function jobDots(state, total, el) {
  el.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const b = document.createElement('button');
    b.className = 'dot';
    b.textContent = `${i + 1}`;
    b.title = state.jobs[i] ? `Job ${i + 1}: ${starText(state.jobs[i])}` : `Job ${i + 1}`;
    if (state.jobs[i]) b.dataset.stars = starText(state.jobs[i]);
    b.onclick = () => { hide('intro'); hide('result'); actions.jump(i); };
    el.append(b);
  }
}

export function intro(state, start) {
  const done = state.jobs.filter(Boolean).length;
  $('intro-kg').textContent = done ? `So far you kept ${totalKg(state)} kg of stone out of the skip.` : '';
  jobDots(state, 5, $('intro-jobs'));
  show('intro');
  return new Promise((resolve, reject) => {
    $('start').onclick = () => { hide('intro'); start().then(resolve, reject); };
  });
}

export function loading(on) { $('load').classList.toggle('on', on); }
export function fail(e) { $('load').textContent = `Could not load the yard: ${e.message}`; $('load').classList.add('on'); }

export function job(i, total, level, bar) {
  $('job').textContent = `Job ${i + 1}/${total} · ${level.title}`;
  $('client').textContent = level.client;
  $('bar').textContent = bar;
  $('finish').classList.remove('ready');
  coach(i === 0 ? 'Drag a slab from the yard onto the yellow outline.' : 'Beat the foreman: more cover, less saw, fewer seams.');
}

export function stats(s, bar, canTurn) {
  $('s-cov').textContent = `${Math.round(s.covered * 100)}%`;
  $('s-waste').textContent = `${Math.round(s.wasteM2 * 81)} kg`;
  $('s-seam').textContent = `${s.seamM.toFixed(1)} m`;
  $('s-kg').textContent = `${s.savedKg} kg`;
  $('you').textContent = s.rating;
  $('you').parentElement.classList.toggle('ahead', s.rating >= bar);
  $('turn').disabled = !canTurn;
}

export function coach(text) { $('hint').textContent = text; }
export function nudgeFinish() { $('finish').classList.add('ready'); coach('Counter covered. Finish the job, or rearrange to beat the foreman.'); }

export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
}

export function result(r, bar, got, i, total, state) {
  $('r-stars').textContent = starText(got);
  $('r-title').textContent = got === 3 ? 'You beat the foreman' : got ? 'Job done' : 'The client wants another go';
  $('r-saved').textContent = `${r.savedKg} kg`;
  $('r-new').textContent = `${r.newKg} kg`;
  $('r-cut').textContent = `${Math.round(r.wasteM2 * 81)} kg`;
  $('r-score').textContent = `${r.rating} vs foreman ${bar}`;
  const last = i === total - 1;
  $('r-total').textContent = last
    ? `All ${total} kitchens: ${totalKg(state)} kg of offcuts kept out of the skip.`
    : `Running total: ${totalKg(state)} kg kept out of the skip.`;
  $('next').textContent = last ? 'Back to job 1' : 'Next job';
  jobDots(state, total, $('r-jobs'));
  show('result');
  $('next').focus();
}
