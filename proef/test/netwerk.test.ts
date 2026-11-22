import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metTimeout, serverAdressen, meetNetwerk } from '../pagina/netwerk.js';

test('serverAdressen', () => {
  assert.deepEqual(serverAdressen('192-168-1-20'), {
    https: 'https://192-168-1-20.local-ip.sh:8443', http: 'http://192.168.1.20:8080' });
  assert.equal(serverAdressen(null), null);
  assert.equal(serverAdressen('evil.com'), null);
});

test('metTimeout verwerpt na de tijd met label', async () => {
  await assert.rejects(metTimeout(new Promise(() => {}), 20, 'h265'), /time-out: h265/);
});

test('meetNetwerk: falende fetch wordt een meting met ok=false en fout, geen exception', async () => {
  const fake = (async (url: string) => {
    if (url.startsWith('http://')) throw new TypeError('Failed to fetch');
    return new Response('ok', { status: 200 });
  }) as typeof fetch;
  const r = await meetNetwerk(serverAdressen('192-168-1-20')!, fake, 100);
  assert.deepEqual(r.map((x: { naam: string }) => x.naam), ['LAN https (local-ip.sh)', 'LAN http (verwacht geblokkeerd)', 'Eigen herkomst (controle)']);
  assert.equal(r[0].ok, true);
  assert.equal(r[0].status, 200);
  assert.equal(r[1].ok, false);
  assert.match(r[1].fout!, /Failed to fetch/);
});

test('meetNetwerk: hangende fetch eindigt als time-out', async () => {
  const hang = (() => new Promise(() => {})) as unknown as typeof fetch;
  const r = await meetNetwerk(serverAdressen('10-0-0-2')!, hang, 30);
  assert.ok(r.every((x: { ok: boolean, fout?: string }) => x.ok === false && /time-out/.test(x.fout!)));
});
