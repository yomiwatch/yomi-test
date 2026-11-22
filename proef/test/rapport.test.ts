import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valideerRapport, bestandsnaam } from '../server/rapport.ts';

test('valideerRapport', () => {
  assert.ok(valideerRapport({ versie: 1, ua: 'Mozilla/5.0 Titan', tijd: '2026-11-22T10:00:00Z', codecs: [] }));
  assert.equal(valideerRapport({ versie: 2, ua: 'x', tijd: 't' }), null);
  assert.equal(valideerRapport({ versie: 1, ua: '', tijd: 't' }), null);
  assert.equal(valideerRapport({ versie: 1, ua: 'x'.repeat(1001), tijd: 't' }), null);
  assert.equal(valideerRapport('tekst'), null);
  assert.equal(valideerRapport(null), null);
});

test('bestandsnaam', () => {
  const n = bestandsnaam(new Date('2026-11-22T09:05:00Z'), 'Mozilla/5.0 Titan');
  assert.match(n, /^2026-11-22-0905-[0-9a-f]{8}\.json$/);
  assert.equal(n, bestandsnaam(new Date('2026-11-22T09:05:59Z'), 'Mozilla/5.0 Titan'));
});
