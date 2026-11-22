import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODEC_CASES, measureCodecs, measureCapabilities, CAPABILITY_CASES } from '../page/codecs.js';

test('measureCodecs asks each case once and takes the answer', () => {
  const asked: string[] = [];
  const r = measureCodecs((m: string) => { asked.push(m); return m.includes('avc1'); });
  assert.equal(r.length, CODEC_CASES.length);
  assert.deepEqual(asked, CODEC_CASES.map((c: { mime: string }) => c.mime));
  assert.equal(r.find((x: { name: string }) => x.name === 'H.264 High 1080p')!.supported, true);
  assert.equal(r.find((x: { name: string }) => x.name === 'H.265 Main10 4K (hvc1)')!.supported, false);
});

test('measureCodecs treats an exception as not supported', () => {
  const r = measureCodecs(() => { throw new Error('broken'); });
  assert.ok(r.every((x: { supported: boolean }) => x.supported === false));
});

test('measureCapabilities turns errors into null values with an error message', async () => {
  const r = await measureCapabilities(async (c: any) => {
    if (c.video.hdrMetadataType) throw new Error('HDR unknown');
    return { supported: true, smooth: true, powerEfficient: false };
  });
  assert.equal(r.length, CAPABILITY_CASES.length);
  const hdr = r.find((x: { name: string }) => x.name === 'H.265 4K24 HDR10 25 Mbit/s')!;
  assert.equal(hdr.supported, null);
  assert.match(hdr.error!, /HDR unknown/);
  assert.equal(r[0].supported, true);
});

test('checkHdrFields: a TypeError on an invalid transferFunction means HDR fields are read', async () => {
  const { checkHdrFields } = await import('../page/codecs.js');
  assert.equal(await checkHdrFields(async (c: any) => { if (c.video.transferFunction === 'invalid') throw new TypeError('bad enum'); return { supported: true }; }), 'respected');
  assert.equal(await checkHdrFields(async () => ({ supported: true })), 'ignored');
  assert.equal(await checkHdrFields(async () => { throw new Error('other'); }), 'unknown');
});
