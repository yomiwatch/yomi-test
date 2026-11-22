// Gegevens en keuzes voor de afspeel- en toetsmetingen.

export const VARIANTEN = [
  'h264-1080p-aac',
  'h264-1080p-ac3',
  'hevc-1080p-aac',
  'hevc-4k-sdr-aac',
  'hevc-4k-hdr10-aac',
  'hevc-4k-hdr10-eac3',
];

// "Terug" als laatste: die toets kan de browser laten teruggaan.
export const TOETS_INSTRUCTIE = 'Druk op: pijltjes, OK, Play/Pauze, Rood, Groen, Geel, Blauw, Info, Terug';

const PIJLTJES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** De app gaat via MSE (hls.js) afspelen; native meten we ernaast ter vergelijking. */
export function afspeelMethoden(nativeKan, hlsKan) {
  const m = [];
  if (hlsKan) m.push('hls.js');
  if (nativeKan) m.push('native');
  return m;
}

export function moetDirectVersturen(key) {
  return PIJLTJES.indexOf(key) === -1;
}
