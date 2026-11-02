// Renders the film soundtrack offline with the game's own synth (public/audio.js), one sound per recorded event.
// node video/soundtrack.mjs video/out/events-final.jsonl video/out/sfx.wav <seconds>
import { readFileSync, writeFileSync } from 'node:fs';
import { OfflineAudioContext } from 'node-web-audio-api';
import * as sfx from '../public/audio.js';

const [src, out, secs] = process.argv.slice(2);
const events = readFileSync(src, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rate = 48000, ctx = new OfflineAudioContext(2, Math.ceil(rate * +secs), rate);
sfx.renderInto(ctx);
const play = { knock: sfx.knock, lift: sfx.lift, saw: sfx.saw, bump: sfx.bump, chime: sfx.chime };
let n = 0;
for (const e of events) if (play[e.t]) { sfx.at(e.at); play[e.t](e.arg ?? undefined); n++; }
const buf = await ctx.startRendering();
const L = buf.getChannelData(0), R = buf.getChannelData(1);
const pcm = Buffer.alloc(44 + L.length * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + L.length * 4, 4); pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22); pcm.writeUInt32LE(rate, 24);
pcm.writeUInt32LE(rate * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(L.length * 4, 40);
for (let i = 0; i < L.length; i++) {
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
}
writeFileSync(out, pcm);
console.log(`${n} sounds -> ${out}`);
