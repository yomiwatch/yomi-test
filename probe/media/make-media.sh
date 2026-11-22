#!/bin/sh
# Creates the test videos for the TV probe as HLS with fMP4 segments.
# Usage: sh media/make-media.sh   (from the probe/ directory)
set -eu

OUT="$(dirname "$0")/out"
DURATION=12
HLS="-f hls -hls_time 4 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4"
HDR10="hdr10=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1):max-cll=1000,400"

encode() {
  name="$1"; size="$2"; fps="$3"; shift 3
  dir="$OUT/$name"
  rm -rf "$dir"; mkdir -p "$dir"
  echo "== $name"
  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=$size:rate=$fps:duration=$DURATION" \
    -f lavfi -i "sine=frequency=1000:duration=$DURATION" \
    "$@" -force_key_frames "expr:gte(t,n_forced*2)" $HLS -hls_segment_filename "$dir/seg%d.m4s" "$dir/index.m3u8"
}

encode h264-1080p-aac 1920x1080 30 -c:v libx264 -profile:v high -preset veryfast -pix_fmt yuv420p -c:a aac -ac 2
encode h264-1080p-ac3 1920x1080 30 -c:v libx264 -profile:v high -preset veryfast -pix_fmt yuv420p -c:a ac3 -ac 6
encode hevc-1080p-aac 1920x1080 30 -c:v libx265 -profile:v main -preset ultrafast -pix_fmt yuv420p -tag:v hvc1 -c:a aac -ac 2
encode hevc-4k-sdr-aac 3840x2160 24 -c:v libx265 -profile:v main10 -preset ultrafast -pix_fmt yuv420p10le -tag:v hvc1 -c:a aac -ac 2
encode hevc-4k-hdr10-aac 3840x2160 24 -c:v libx265 -profile:v main10 -preset ultrafast -pix_fmt yuv420p10le -tag:v hvc1 \
  -x265-params "$HDR10" -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc -c:a aac -ac 2
encode hevc-4k-hdr10-eac3 3840x2160 24 -c:v libx265 -profile:v main10 -preset ultrafast -pix_fmt yuv420p10le -tag:v hvc1 \
  -x265-params "$HDR10" -color_primaries bt2020 -color_trc smpte2084 -colorspace bt2020nc -c:a eac3 -ac 6

echo "Done: $OUT"
