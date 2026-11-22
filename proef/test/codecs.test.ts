import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODEC_GEVALLEN, meetCodecs, meetCapabilities, CAPABILITY_GEVALLEN } from '../pagina/codecs.js';

test('meetCodecs vraagt elk geval één keer en neemt het antwoord over', () => {
  const gevraagd: string[] = [];
  const r = meetCodecs((m: string) => { gevraagd.push(m); return m.includes('avc1'); });
  assert.equal(r.length, CODEC_GEVALLEN.length);
  assert.deepEqual(gevraagd, CODEC_GEVALLEN.map((g: { mime: string }) => g.mime));
  assert.equal(r.find((x: { naam: string }) => x.naam === 'H.264 High 1080p')!.ondersteund, true);
  assert.equal(r.find((x: { naam: string }) => x.naam === 'H.265 Main10 4K (hvc1)')!.ondersteund, false);
});

test('meetCodecs behandelt een exception als niet ondersteund', () => {
  const r = meetCodecs(() => { throw new Error('kapot'); });
  assert.ok(r.every((x: { ondersteund: boolean }) => x.ondersteund === false));
});

test('meetCapabilities zet fouten om naar null-waarden met foutmelding', async () => {
  const r = await meetCapabilities(async (c: any) => {
    if (c.video.hdrMetadataType) throw new Error('HDR niet bekend');
    return { supported: true, smooth: true, powerEfficient: false };
  });
  assert.equal(r.length, CAPABILITY_GEVALLEN.length);
  const hdr = r.find((x: { naam: string }) => x.naam === 'H.265 4K24 HDR10 25 Mbit/s')!;
  assert.equal(hdr.supported, null);
  assert.match(hdr.fout!, /HDR niet bekend/);
  assert.equal(r[0].supported, true);
});

test('controleerHdrVelden: TypeError op ongeldige transferFunction betekent dat HDR-velden gelezen worden', async () => {
  const { controleerHdrVelden } = await import('../pagina/codecs.js');
  assert.equal(await controleerHdrVelden(async (c: any) => { if (c.video.transferFunction === 'ongeldig') throw new TypeError('bad enum'); return { supported: true }; }), 'gerespecteerd');
  assert.equal(await controleerHdrVelden(async () => ({ supported: true })), 'genegeerd');
  assert.equal(await controleerHdrVelden(async () => { throw new Error('anders'); }), 'onbekend');
});
