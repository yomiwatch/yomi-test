#!/bin/sh
# Maakt de testvideo's voor de tv-proef als HLS met fMP4-segmenten.
# Gebruik: sh media/maak-media.sh   (vanuit de map proef/)
set -eu

UIT="$(dirname "$0")/uit"
DUUR=12
HLS="-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4"
HDR10="hdr10=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1):max-cll=1000,400"

maak() {
  naam="$1"; grootte="$2"; fps="$3"; shift 3
  map="$UIT/$naam"
  rm -rf "$map"; mkdir -p "$map"
  echo "== $naam"
  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=$grootte:rate=$fps:duration=$DUUR" \
    -f lavfi -i "sine=frequency=1000:duration=$DUUR" \
    "$@" -force_key_frames "expr:gte(t,n_forced*2)" $HLS -hls_segment_filename "$map/seg%d.m4s" "$map/index.m3u8"
}

maak h264-1080p-aac 1920x1080 30 -c:v libx264 -profile:v high -preset veryfast -pix_fmt yuv420p -c:a aac -ac 2
maak h264-1080p-ac3 1920x1080 30 -c:v libx264 -profile:v high -preset veryfast -pix_fmt yuv420p -c:a ac3 -ac 6
maak hevc-1080p-aac 1920x1080 30 -c:v libx265 -profile:v main -preset ultrafast -pix_fmt yuv420p -tag:v hvc1 -c:a aac -ac 2
maak hevc-4k-sdr-aac 3840x2160 24 -c:v libx265 -profile:v main10 -preset ultrafast -pix_fmt yuv420p10le -tag:v hvc1 -c:a aac -ac 2
maak hevc-4k-hdr10-eac3 3840x2160 24 -c:v libx265 -profile:v main10 -preset ultrafast -pix_fmt yuv420p10le -tag:v hvc1 \
  -x265-params "$HDR10" -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc -c:a eac3 -ac 6

echo "Klaar: $UIT"
