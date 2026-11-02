// Receives the film director events (sounds, story beats) while HyperFrames renders the game.
// node video/record.mjs video/out/events.jsonl
import { appendFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
const out = process.argv[2];
writeFileSync(out, '');
createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { if (body) appendFileSync(out, body + '\n'); res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); res.end(); });
}).listen(8971, '127.0.0.1', () => console.log('recording to', out));
