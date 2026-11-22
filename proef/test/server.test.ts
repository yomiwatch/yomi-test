import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { maakHandler } from '../server/server.ts';

let server: http.Server;
let basis: string;
let resultaten: string;

before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proef-'));
  const media = path.join(tmp, 'media');
  const pagina = path.join(tmp, 'pagina');
  resultaten = path.join(tmp, 'resultaten');
  fs.mkdirSync(path.join(media, 'a'), { recursive: true });
  fs.mkdirSync(pagina);
  fs.mkdirSync(resultaten);
  fs.writeFileSync(path.join(media, 'a', 'index.m3u8'), '#EXTM3U\n');
  fs.writeFileSync(path.join(tmp, 'geheim.txt'), 'geheim');
  fs.writeFileSync(path.join(pagina, 'index.html'), '<p>proef</p>');
  server = http.createServer(maakHandler({ mediaMap: media, paginaMap: pagina, resultatenMap: resultaten }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => { server.close(); });

const geldig = { versie: 1, ua: 'Mozilla/5.0 Titan', tijd: '2026-11-22T10:00:00Z', codecs: [] };

test('GET /ping geeft ok en pnaGezien=false zolang er geen PNA-preflight was', async () => {
  const r = await fetch(`${basis}/ping`, { headers: { Origin: 'https://proef.example' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://proef.example');
  assert.deepEqual(await r.json(), { ok: true, pnaGezien: false });
});

test('OPTIONS met PNA-verzoek geeft toestemming en wordt per herkomst onthouden', async () => {
  const r = await fetch(`${basis}/ping`, { method: 'OPTIONS', headers: {
    Origin: 'https://proef.example', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-private-network'), 'true');
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://proef.example');
  assert.deepEqual(await (await fetch(`${basis}/ping`, { headers: { Origin: 'https://proef.example' } })).json(), { ok: true, pnaGezien: true });
  assert.deepEqual(await (await fetch(`${basis}/ping`, { headers: { Origin: 'https://ander.example' } })).json(), { ok: true, pnaGezien: false });
});

test('rapport krijgt alleen PNA-preflights van de eigen herkomst, en daarna wordt het gewist', async () => {
  await fetch(`${basis}/ping`, { method: 'OPTIONS', headers: { Origin: 'https://a.example', 'Access-Control-Request-Private-Network': 'true' } });
  const post = (origin: string) => fetch(`${basis}/rapport`, { method: 'POST', headers: { Origin: origin }, body: JSON.stringify(geldig) });
  const lees = async (r: Response) => JSON.parse(fs.readFileSync(path.join(resultaten, ((await r.json()) as { opgeslagen: string }).opgeslagen), 'utf8'));
  assert.equal((await lees(await post('https://b.example'))).pnaGezien, false);
  const a1 = await lees(await post('https://a.example'));
  assert.equal(a1.pnaGezien, true);
  assert.equal(a1.pnaPreflights.length, 1);
  assert.equal((await lees(await post('https://a.example'))).pnaGezien, false);
  for (const f of fs.readdirSync(resultaten)) fs.rmSync(path.join(resultaten, f));
});

test('afgebroken upload laat de server niet crashen', async () => {
  const net = await import('node:net');
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((klaar) => {
    const s = net.connect(port, '127.0.0.1', () => {
      s.write('POST /rapport HTTP/1.1\r\nHost: x\r\nContent-Length: 5000\r\n\r\n{"versie":');
      setTimeout(() => { s.destroy(); setTimeout(klaar, 50); }, 20);
    });
  });
  assert.equal((await fetch(`${basis}/ping`)).status, 200);
});

test('POST /rapport slaat geldig rapport op met pnaGezien', async () => {
  const r = await fetch(`${basis}/rapport`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(geldig) });
  assert.equal(r.status, 201);
  const { opgeslagen } = await r.json() as { opgeslagen: string };
  const inhoud = JSON.parse(fs.readFileSync(path.join(resultaten, opgeslagen), 'utf8'));
  assert.equal(inhoud.ua, 'Mozilla/5.0 Titan');
  assert.equal(typeof inhoud.pnaGezien, 'boolean');
  fs.rmSync(path.join(resultaten, opgeslagen));
});

test('POST /rapport weigert ongeldige JSON met 400 en schrijft niets', async () => {
  const r1 = await fetch(`${basis}/rapport`, { method: 'POST', body: '{kapot' });
  assert.equal(r1.status, 400);
  const r2 = await fetch(`${basis}/rapport`, { method: 'POST', body: JSON.stringify({ versie: 9 }) });
  assert.equal(r2.status, 400);
  assert.deepEqual(fs.readdirSync(resultaten), []);
});

test('POST /rapport weigert >1 MB met 413', async () => {
  const r = await fetch(`${basis}/rapport`, { method: 'POST', body: 'x'.repeat(1_048_577) });
  assert.equal(r.status, 413);
  assert.deepEqual(fs.readdirSync(resultaten), []);
});

test('pad-traversal buiten de mediamap geeft 404', async () => {
  for (const p of ['/media/../geheim.txt', '/media/%2e%2e/geheim.txt', '/media/a/..%2f..%2fgeheim.txt']) {
    const r = await fetch(`${basis}${p}`);
    assert.equal(r.status, 404, p);
  }
});

test('GET /media/a/index.m3u8 heeft juiste content-type', async () => {
  const r = await fetch(`${basis}/media/a/index.m3u8`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/vnd.apple.mpegurl');
});

test('GET /pagina/index.html serveert de pagina', async () => {
  const r = await fetch(`${basis}/pagina/index.html`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type')!, /text\/html/);
  assert.equal(await r.text(), '<p>proef</p>');
});
