import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, fileName } from '../server/report.ts';

test('validateReport', () => {
  assert.ok(validateReport({ version: 1, ua: 'Mozilla/5.0 Titan', time: '2026-11-22T10:00:00Z', codecs: [] }));
  assert.equal(validateReport({ version: 2, ua: 'x', time: 't' }), null);
  assert.equal(validateReport({ version: 1, ua: '', time: 't' }), null);
  assert.equal(validateReport({ version: 1, ua: 'x'.repeat(1001), time: 't' }), null);
  assert.equal(validateReport('text'), null);
  assert.equal(validateReport(null), null);
});

test('fileName', () => {
  const n = fileName(new Date('2026-11-22T09:05:00Z'), 'Mozilla/5.0 Titan');
  assert.match(n, /^2026-11-22-0905-[0-9a-f]{8}\.json$/);
  assert.equal(n, fileName(new Date('2026-11-22T09:05:59Z'), 'Mozilla/5.0 Titan'));
});
