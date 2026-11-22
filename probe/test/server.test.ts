import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createHandler } from '../server/server.ts';

let server: http.Server;
let base: string;
let results: string;

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
  const media = path.join(tmp, 'media');
  const page = path.join(tmp, 'page');
  results = path.join(tmp, 'results');
  fs.mkdirSync(path.join(media, 'a'), { recursive: true });
  fs.mkdirSync(page);
  fs.mkdirSync(results);
  fs.writeFileSync(path.join(media, 'a', 'index.m3u8'), '#EXTM3U\n');
  fs.writeFileSync(path.join(tmp, 'secret.txt'), 'secret');
  fs.writeFileSync(path.join(page, 'index.html'), '<p>probe</p>');
  server = http.createServer(createHandler({ mediaDir: media, pageDir: page, resultsDir: results }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => { server.close(); });

const valid = { version: 1, ua: 'Mozilla/5.0 Titan', time: '2026-11-22T10:00:00Z', codecs: [] };

test('GET /ping returns ok and pnaSeen=false as long as there was no PNA preflight', async () => {
  const r = await fetch(`${base}/ping`, { headers: { Origin: 'https://probe.example' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://probe.example');
  assert.deepEqual(await r.json(), { ok: true, pnaSeen: false });
});

test('OPTIONS with a PNA request grants permission and is remembered per origin', async () => {
  const r = await fetch(`${base}/ping`, { method: 'OPTIONS', headers: {
    Origin: 'https://probe.example', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-private-network'), 'true');
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://probe.example');
  assert.deepEqual(await (await fetch(`${base}/ping`, { headers: { Origin: 'https://probe.example' } })).json(), { ok: true, pnaSeen: true });
  assert.deepEqual(await (await fetch(`${base}/ping`, { headers: { Origin: 'https://other.example' } })).json(), { ok: true, pnaSeen: false });
});

test('a report only gets PNA preflights from its own origin, and they are cleared afterwards', async () => {
  await fetch(`${base}/ping`, { method: 'OPTIONS', headers: { Origin: 'https://a.example', 'Access-Control-Request-Private-Network': 'true' } });
  const post = (origin: string) => fetch(`${base}/report`, { method: 'POST', headers: { Origin: origin }, body: JSON.stringify(valid) });
  const read = async (r: Response) => JSON.parse(fs.readFileSync(path.join(results, ((await r.json()) as { saved: string }).saved), 'utf8'));
  assert.equal((await read(await post('https://b.example'))).pnaSeen, false);
  const a1 = await read(await post('https://a.example'));
  assert.equal(a1.pnaSeen, true);
  assert.equal(a1.pnaPreflights.length, 1);
  assert.equal((await read(await post('https://a.example'))).pnaSeen, false);
  for (const f of fs.readdirSync(results)) fs.rmSync(path.join(results, f));
});

test('an aborted upload does not crash the server', async () => {
  const net = await import('node:net');
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((done) => {
    const s = net.connect(port, '127.0.0.1', () => {
      s.write('POST /report HTTP/1.1\r\nHost: x\r\nContent-Length: 5000\r\n\r\n{"version":');
      setTimeout(() => { s.destroy(); setTimeout(done, 50); }, 20);
    });
  });
  assert.equal((await fetch(`${base}/ping`)).status, 200);
});

test('POST /report saves a valid report with pnaSeen', async () => {
  const r = await fetch(`${base}/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(valid) });
  assert.equal(r.status, 201);
  const { saved } = await r.json() as { saved: string };
  const content = JSON.parse(fs.readFileSync(path.join(results, saved), 'utf8'));
  assert.equal(content.ua, 'Mozilla/5.0 Titan');
  assert.equal(typeof content.pnaSeen, 'boolean');
  fs.rmSync(path.join(results, saved));
});

test('POST /report rejects invalid JSON with 400 and writes nothing', async () => {
  const r1 = await fetch(`${base}/report`, { method: 'POST', body: '{broken' });
  assert.equal(r1.status, 400);
  const r2 = await fetch(`${base}/report`, { method: 'POST', body: JSON.stringify({ version: 9 }) });
  assert.equal(r2.status, 400);
  assert.deepEqual(fs.readdirSync(results), []);
});

test('POST /report rejects >1 MB with 413', async () => {
  const r = await fetch(`${base}/report`, { method: 'POST', body: 'x'.repeat(1_048_577) });
  assert.equal(r.status, 413);
  assert.deepEqual(fs.readdirSync(results), []);
});

test('path traversal outside the media directory returns 404', async () => {
  for (const p of ['/media/../secret.txt', '/media/%2e%2e/secret.txt', '/media/a/..%2f..%2fsecret.txt']) {
    const r = await fetch(`${base}${p}`);
    assert.equal(r.status, 404, p);
  }
});

test('GET /media/a/index.m3u8 has the right content type', async () => {
  const r = await fetch(`${base}/media/a/index.m3u8`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/vnd.apple.mpegurl');
});

test('GET /page/index.html serves the page', async () => {
  const r = await fetch(`${base}/page/index.html`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type')!, /text\/html/);
  assert.equal(await r.text(), '<p>probe</p>');
});
