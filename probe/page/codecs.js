// Codec and capability measurements for the TV probe.

export const CODEC_CASES = [
  { name: 'H.264 High 1080p', mime: 'video/mp4; codecs="avc1.640028"', kind: 'video' },
  { name: 'H.264 High 4K', mime: 'video/mp4; codecs="avc1.640033"', kind: 'video' },
  { name: 'H.265 Main 1080p (hvc1)', mime: 'video/mp4; codecs="hvc1.1.6.L120.90"', kind: 'video' },
  { name: 'H.265 Main10 4K (hvc1)', mime: 'video/mp4; codecs="hvc1.2.4.L153.B0"', kind: 'video' },
  { name: 'H.265 Main10 4K (hev1)', mime: 'video/mp4; codecs="hev1.2.4.L153.B0"', kind: 'video' },
  { name: 'AV1 10-bit 4K', mime: 'video/mp4; codecs="av01.0.12M.10"', kind: 'video' },
  { name: 'VP9 profile 2', mime: 'video/webm; codecs="vp09.02.51.10"', kind: 'video' },
  { name: 'AAC', mime: 'audio/mp4; codecs="mp4a.40.2"', kind: 'audio' },
  { name: 'AC-3', mime: 'audio/mp4; codecs="ac-3"', kind: 'audio' },
  { name: 'E-AC-3', mime: 'audio/mp4; codecs="ec-3"', kind: 'audio' },
  { name: 'Opus', mime: 'audio/mp4; codecs="opus"', kind: 'audio' },
  { name: 'FLAC', mime: 'audio/mp4; codecs="flac"', kind: 'audio' },
  { name: 'DTS', mime: 'audio/mp4; codecs="dtsc"', kind: 'audio' },
  { name: 'TrueHD', mime: 'audio/mp4; codecs="mlpa"', kind: 'audio' },
];

const HEVC_4K = 'video/mp4; codecs="hvc1.2.4.L153.B0"';

export const CAPABILITY_CASES = [
  {
    name: 'H.264 1080p30 8 Mbit/s',
    config: { type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8000000, framerate: 30 } },
  },
  {
    name: 'H.265 4K60 SDR 25 Mbit/s',
    config: { type: 'media-source', video: { contentType: HEVC_4K, width: 3840, height: 2160, bitrate: 25000000, framerate: 60 } },
  },
  {
    name: 'H.265 4K24 HDR10 25 Mbit/s',
    config: {
      type: 'media-source',
      video: {
        contentType: HEVC_4K, width: 3840, height: 2160, bitrate: 25000000, framerate: 24,
        hdrMetadataType: 'smpteSt2086', colorGamut: 'rec2020', transferFunction: 'pq',
      },
    },
  },
];

/** @param {(mime: string) => boolean} isTypeSupported */
export function measureCodecs(isTypeSupported) {
  return CODEC_CASES.map((c) => {
    let supported = false;
    try { supported = Boolean(isTypeSupported(c.mime)); } catch (e) { supported = false; }
    return { name: c.name, mime: c.mime, supported };
  });
}

/** @param {(c: object) => Promise<{supported: boolean, smooth: boolean, powerEfficient: boolean}>} decodingInfo */
export async function measureCapabilities(decodingInfo) {
  const out = [];
  for (const c of CAPABILITY_CASES) {
    try {
      const r = await decodingInfo(c.config);
      out.push({ name: c.name, supported: r.supported, smooth: r.smooth, powerEfficient: r.powerEfficient });
    } catch (e) {
      out.push({ name: c.name, supported: null, smooth: null, powerEfficient: null, error: String(e && e.message ? e.message : e) });
    }
  }
  return out;
}

/**
 * Older Chromium silently ignores unknown fields such as transferFunction, so the
 * HDR measurement would repeat the SDR answer. An invalid value must throw a
 * TypeError if the fields are actually read.
 * @returns {Promise<'respected'|'ignored'|'unknown'>}
 */
export async function checkHdrFields(decodingInfo) {
  const config = {
    type: 'media-source',
    video: { contentType: HEVC_4K, width: 3840, height: 2160, bitrate: 25000000, framerate: 24, transferFunction: 'invalid' },
  };
  try {
    await decodingInfo(config);
    return 'ignored';
  } catch (e) {
    return e instanceof TypeError ? 'respected' : 'unknown';
  }
}
