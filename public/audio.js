// Every sound is synthesised here (no audio files): stone knocks, a saw, a chime. Starts on the first tap.
let ctx, master, base = null, offline = false;
const T = () => base ?? ctx.currentTime;
const on = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (!offline && ctx.state === 'suspended') ctx.resume();
  return ctx;
};
export const unlock = on;
// Offline use (the film soundtrack): play into a given context, each sound at the time set by `at`.
export function renderInto(context) { ctx = context; offline = true; master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination); }
export const at = (seconds) => { base = seconds; };
export const setMuted = (m) => { on(); master.gain.value = m ? 0 : 0.7; };
const listeners = [];
export const onSound = (fn) => listeners.push(fn); // the film recorder listens here
const emit = (name, arg) => listeners.forEach((fn) => fn(name, arg));

function noise(seconds) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource();
  s.buffer = b;
  return s;
}

function env(node, t, peak, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  node.connect(g).connect(master);
  return g;
}

// Stone on stone: a low body thump plus a short bright click. `weight` 0..1 deepens it for big slabs.
export function knock(weight = 0.5) {
  on(); emit('knock', weight);
  const t = T();
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(140 - weight * 60, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  env(o, t, 0.9, 0.22);
  o.start(t); o.stop(t + 0.25);
  const n = noise(0.06), f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2400 - weight * 900; f.Q.value = 1.2;
  env(n.connect(f), t, 0.5, 0.05);
  n.start(t);
}

export function lift() {
  on(); emit('lift');
  const t = T();
  const n = noise(0.12), f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 3000;
  env(n.connect(f), t, 0.12, 0.1);
  n.start(t);
}

// Wet-saw whine, length grows with how much stone gets cut off.
export function saw(amount = 0.3) {
  on(); emit('saw', amount);
  const t = T(), len = 0.15 + Math.min(0.6, amount);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(820, t);
  o.frequency.linearRampToValueAtTime(700, t + len);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
  g.gain.setValueAtTime(0.18, t + len - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(f).connect(g).connect(master);
  o.start(t); o.stop(t + len + 0.02);
}

export function bump() {
  on(); emit('bump');
  const t = T();
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(180, t);
  o.frequency.linearRampToValueAtTime(120, t + 0.12);
  env(o, t, 0.15, 0.14);
  o.start(t); o.stop(t + 0.16);
}

// Rising notes, one per star (0 stars still gets a single soft note).
export function chime(starsWon = 3) {
  on(); emit('chime', starsWon);
  const notes = [523.25, 659.25, 783.99, 1046.5].slice(0, Math.max(1, starsWon + 1));
  notes.forEach((hz, i) => {
    const t = T() + i * 0.14;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz;
    env(o, t, 0.35, 0.6);
    o.start(t); o.stop(t + 0.65);
  });
}

export const buzz = (ms) => navigator.vibrate?.(ms);
