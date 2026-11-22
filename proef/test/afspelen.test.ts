import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTEN, afspeelMethoden, TOETS_INSTRUCTIE, moetDirectVersturen } from '../pagina/afspelen.js';

test('afspeelMethoden meet MSE (hls.js) én native als beide kunnen', () => {
  assert.deepEqual(afspeelMethoden(true, true), ['hls.js', 'native']);
  assert.deepEqual(afspeelMethoden(true, false), ['native']);
  assert.deepEqual(afspeelMethoden(false, true), ['hls.js']);
  assert.deepEqual(afspeelMethoden(false, false), []);
});

test('VARIANTEN scheiden HDR10 van E-AC-3', () => {
  assert.ok(VARIANTEN.includes('hevc-4k-hdr10-aac'));
  assert.ok(VARIANTEN.includes('hevc-4k-hdr10-eac3'));
});

test('Terug staat als laatste in de instructie', () => {
  assert.match(TOETS_INSTRUCTIE, /Terug$/);
});

test('alleen pijltjes wachten met versturen', () => {
  assert.equal(moetDirectVersturen('ArrowUp'), false);
  assert.equal(moetDirectVersturen('Enter'), true);
  assert.equal(moetDirectVersturen('GoBack'), true);
});
