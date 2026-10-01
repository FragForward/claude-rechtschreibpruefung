'use strict';
// Prüfstand: ahmt das Verfassen-Fenster im Browser nach und reicht Nachrichten an den echten Host weiter.
// Start: node test/pruefstand-server.js  ->  http://localhost:8765
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC)/.test(k)));
env.RSP_DATEN = process.env.RSP_DATEN_TEST || path.join(ROOT, 'daten-test');
const host = spawn(process.execPath, [path.join(ROOT, 'host', 'host.js')], { env });

let puffer = Buffer.alloc(0), id = 0;
const offen = new Map();
host.stdout.on('data', d => {
  puffer = Buffer.concat([puffer, d]);
  while (puffer.length >= 4) {
    const l = puffer.readUInt32LE(0);
    if (puffer.length < 4 + l) break;
    const m = JSON.parse(puffer.subarray(4, 4 + l));
    puffer = puffer.subarray(4 + l);
    const fertig = offen.get(m.id);
    if (fertig) { offen.delete(m.id); fertig(m); }
  }
});
host.on('exit', c => { console.log('Host beendet', c); process.exit(1); });

function anHost(n) {
  return new Promise(r => {
    n.id = ++id;
    offen.set(n.id, r);
    const b = Buffer.from(JSON.stringify(n));
    const h = Buffer.alloc(4);
    h.writeUInt32LE(b.length);
    host.stdin.write(Buffer.concat([h, b]));
  });
}

const DATEIEN = {
  '/': ['test/pruefstand.html', 'text/html'],
  '/chrome': ['test/pruefstand-chrome.html', 'text/html'],
  '/content.js': ['dist/chrome/content.js', 'text/javascript'],
};

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/nachricht') {
    let body = '';
    req.on('data', d => (body += d));
    req.on('end', async () => {
      const n = JSON.parse(body);
      const a = await anHost(n);
      console.log(n.art, n.satz || n.von || '', '->', JSON.stringify(a).slice(0, 200));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(a));
    });
    return;
  }
  const d = DATEIEN[req.url];
  if (!d) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': d[1] + '; charset=utf-8', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(path.join(ROOT, d[0])));
}).listen(8765, () => console.log('Prüfstand auf http://localhost:8765'));
