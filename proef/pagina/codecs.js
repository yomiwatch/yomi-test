// Codec- en capability-metingen voor de tv-proef.

export const CODEC_GEVALLEN = [
  { naam: 'H.264 High 1080p', mime: 'video/mp4; codecs="avc1.640028"', soort: 'video' },
  { naam: 'H.264 High 4K', mime: 'video/mp4; codecs="avc1.640033"', soort: 'video' },
  { naam: 'H.265 Main 1080p (hvc1)', mime: 'video/mp4; codecs="hvc1.1.6.L120.90"', soort: 'video' },
  { naam: 'H.265 Main10 4K (hvc1)', mime: 'video/mp4; codecs="hvc1.2.4.L153.B0"', soort: 'video' },
  { naam: 'H.265 Main10 4K (hev1)', mime: 'video/mp4; codecs="hev1.2.4.L153.B0"', soort: 'video' },
  { naam: 'AV1 10-bit 4K', mime: 'video/mp4; codecs="av01.0.12M.10"', soort: 'video' },
  { naam: 'VP9 profiel 2', mime: 'video/webm; codecs="vp09.02.51.10"', soort: 'video' },
  { naam: 'AAC', mime: 'audio/mp4; codecs="mp4a.40.2"', soort: 'audio' },
  { naam: 'AC-3', mime: 'audio/mp4; codecs="ac-3"', soort: 'audio' },
  { naam: 'E-AC-3', mime: 'audio/mp4; codecs="ec-3"', soort: 'audio' },
  { naam: 'Opus', mime: 'audio/mp4; codecs="opus"', soort: 'audio' },
  { naam: 'FLAC', mime: 'audio/mp4; codecs="flac"', soort: 'audio' },
  { naam: 'DTS', mime: 'audio/mp4; codecs="dtsc"', soort: 'audio' },
  { naam: 'TrueHD', mime: 'audio/mp4; codecs="mlpa"', soort: 'audio' },
];

const HEVC_4K = 'video/mp4; codecs="hvc1.2.4.L153.B0"';

export const CAPABILITY_GEVALLEN = [
  {
    naam: 'H.264 1080p30 8 Mbit/s',
    config: { type: 'media-source', video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8000000, framerate: 30 } },
  },
  {
    naam: 'H.265 4K60 SDR 25 Mbit/s',
    config: { type: 'media-source', video: { contentType: HEVC_4K, width: 3840, height: 2160, bitrate: 25000000, framerate: 60 } },
  },
  {
    naam: 'H.265 4K24 HDR10 25 Mbit/s',
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
export function meetCodecs(isTypeSupported) {
  return CODEC_GEVALLEN.map((g) => {
    let ondersteund = false;
    try { ondersteund = Boolean(isTypeSupported(g.mime)); } catch (e) { ondersteund = false; }
    return { naam: g.naam, mime: g.mime, ondersteund };
  });
}

/** @param {(c: object) => Promise<{supported: boolean, smooth: boolean, powerEfficient: boolean}>} decodingInfo */
export async function meetCapabilities(decodingInfo) {
  const uit = [];
  for (const g of CAPABILITY_GEVALLEN) {
    try {
      const r = await decodingInfo(g.config);
      uit.push({ naam: g.naam, supported: r.supported, smooth: r.smooth, powerEfficient: r.powerEfficient });
    } catch (e) {
      uit.push({ naam: g.naam, supported: null, smooth: null, powerEfficient: null, fout: String(e && e.message ? e.message : e) });
    }
  }
  return uit;
}

/**
 * Oudere Chromium negeert onbekende velden zoals transferFunction stil, waardoor de
 * HDR-meting het SDR-antwoord zou herhalen. Een ongeldige waarde moet een TypeError
 * geven als de velden echt gelezen worden.
 * @returns {Promise<'gerespecteerd'|'genegeerd'|'onbekend'>}
 */
export async function controleerHdrVelden(decodingInfo) {
  const config = {
    type: 'media-source',
    video: { contentType: HEVC_4K, width: 3840, height: 2160, bitrate: 25000000, framerate: 24, transferFunction: 'ongeldig' },
  };
  try {
    await decodingInfo(config);
    return 'genegeerd';
  } catch (e) {
    return e instanceof TypeError ? 'gerespecteerd' : 'onbekend';
  }
}
