#!/usr/bin/env bash
#
# Adds a real clip to one of the media slots in src/data/media.ts.
#
#   scripts/add-clip.sh <video> <slot> [--from SECONDS] [--to SECONDS] [--width PX]
#   e.g. scripts/add-clip.sh ~/Movies/printer.mov thinkbox-printer --from 3 --to 9
#
# Trims it, scales it down to --width (default 1080), drops the audio and
# writes public/media/<slot>.mp4 (H.264, starts playing before it has fully
# loaded), plus public/media/<slot>.jpg, its first frame, as the poster.

set -euo pipefail

die() {
  echo "add-clip: $*" >&2
  exit 1
}

[[ $# -ge 2 ]] || die "usage: add-clip.sh <video> <slot> [--from S] [--to S] [--width PX]"
input=$1
slot=$2
shift 2

from=""
to=""
width=1080
while [[ $# -gt 0 ]]; do
  case $1 in
    --from) from=$2; shift 2 ;;
    --to) to=$2; shift 2 ;;
    --width) width=$2; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -f $input ]] || die "no such video: $input"
[[ $slot =~ ^[a-z0-9-]+$ ]] || die "slot names are lowercase letters, digits and dashes: $slot"
command -v ffmpeg >/dev/null || die "needs ffmpeg"

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/public/media"
mkdir -p "$out"

encoders=$(ffmpeg -hide_banner -encoders 2>/dev/null)
if grep -q libx264 <<<"$encoders"; then
  codec=(-c:v libx264 -preset slow -crf 23)
elif grep -q h264_videotoolbox <<<"$encoders"; then
  codec=(-c:v h264_videotoolbox -b:v 5M)
else
  die "this ffmpeg has no H.264 encoder"
fi

trim=()
[[ -n $from ]] && trim+=(-ss "$from")
[[ -n $to ]] && trim+=(-to "$to")

# ${trim[@]+...} keeps an empty array safe under set -u in macOS's bash 3.2.
ffmpeg -v error -y ${trim[@]+"${trim[@]}"} -i "$input" -an \
  -vf "scale='min($width,iw)':-2:flags=lanczos:out_range=tv,format=yuv420p" -color_range tv \
  "${codec[@]}" -movflags +faststart "$out/$slot.mp4"
ffmpeg -v error -y -i "$out/$slot.mp4" -frames:v 1 -q:v 3 "$out/$slot.jpg"

size=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$out/$slot.mp4")
length=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$slot.mp4")
echo "add-clip: $slot from $input"
echo "  $size, ${length%.*}s, $(du -h "$out/$slot.mp4" | cut -f1), no audio, poster $slot.jpg"
echo "  public/media/$slot.mp4; check the slot's alt text in src/data/media.ts"
