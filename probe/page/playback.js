// Data and choices for the playback and key measurements.

export const VARIANTS = [
  'h264-1080p-aac',
  'h264-1080p-ac3',
  'hevc-1080p-aac',
  'hevc-4k-sdr-aac',
  'hevc-4k-hdr10-aac',
  'hevc-4k-hdr10-eac3',
];

// "Back" goes last: that key can make the browser navigate back.
export const KEY_INSTRUCTION = 'Press: arrows, OK, Play/Pause, Red, Green, Yellow, Blue, Info, Back';

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** The app will play via MSE (hls.js); we measure native alongside it for comparison. */
export function playbackMethods(nativeCan, hlsCan) {
  const m = [];
  if (hlsCan) m.push('hls.js');
  if (nativeCan) m.push('native');
  return m;
}

export function shouldSendImmediately(key) {
  return ARROWS.indexOf(key) === -1;
}
