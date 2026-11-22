import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, playbackMethods, KEY_INSTRUCTION, shouldSendImmediately } from '../page/playback.js';

test('playbackMethods measures both MSE (hls.js) and native when both are possible', () => {
  assert.deepEqual(playbackMethods(true, true), ['hls.js', 'native']);
  assert.deepEqual(playbackMethods(true, false), ['native']);
  assert.deepEqual(playbackMethods(false, true), ['hls.js']);
  assert.deepEqual(playbackMethods(false, false), []);
});

test('VARIANTS separate HDR10 from E-AC-3', () => {
  assert.ok(VARIANTS.includes('hevc-4k-hdr10-aac'));
  assert.ok(VARIANTS.includes('hevc-4k-hdr10-eac3'));
});

test('Back is last in the instruction', () => {
  assert.match(KEY_INSTRUCTION, /Back$/);
});

test('only arrows delay sending', () => {
  assert.equal(shouldSendImmediately('ArrowUp'), false);
  assert.equal(shouldSendImmediately('Enter'), true);
  assert.equal(shouldSendImmediately('GoBack'), true);
});
