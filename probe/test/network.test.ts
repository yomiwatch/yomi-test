import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, serverAddresses, measureNetwork } from '../page/network.js';

test('serverAddresses', () => {
  assert.deepEqual(serverAddresses('192-168-1-20'), {
    https: 'https://192-168-1-20.local-ip.sh:8443', http: 'http://192.168.1.20:8080' });
  assert.equal(serverAddresses(null), null);
  assert.equal(serverAddresses('evil.com'), null);
});

test('withTimeout rejects after the time with a label', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20, 'h265'), /timeout: h265/);
});

test('measureNetwork: a failing fetch becomes a measurement with ok=false and an error, not an exception', async () => {
  const fake = (async (url: string) => {
    if (url.startsWith('http://')) throw new TypeError('Failed to fetch');
    return new Response('ok', { status: 200 });
  }) as typeof fetch;
  const r = await measureNetwork(serverAddresses('192-168-1-20')!, fake, 100);
  assert.deepEqual(r.map((x: { name: string }) => x.name), ['LAN https (local-ip.sh)', 'LAN http (expected blocked)', 'Same origin (control)']);
  assert.equal(r[0].ok, true);
  assert.equal(r[0].status, 200);
  assert.equal(r[1].ok, false);
  assert.match(r[1].error!, /Failed to fetch/);
});

test('measureNetwork: a hanging fetch ends as a timeout', async () => {
  const hang = (() => new Promise(() => {})) as unknown as typeof fetch;
  const r = await measureNetwork(serverAddresses('10-0-0-2')!, hang, 30);
  assert.ok(r.every((x: { ok: boolean, error?: string }) => x.ok === false && /timeout/.test(x.error!)));
});
