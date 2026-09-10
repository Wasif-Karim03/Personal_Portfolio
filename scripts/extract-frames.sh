#!/usr/bin/env bash
#
# Turns a video into the frame sets a scrub scene reads (see src/lib/frames.ts).
#
#   scripts/extract-frames.sh <video> <name> --alt "what the frames show" [options]
#
# Writes
#   public/sequences/<name>/desktop/0000.jpg …  the full frame set
#   public/sequences/<name>/mobile/0000.jpg …   fewer, smaller frames for phones
#   public/sequences/<name>/poster.jpg           first frame, shown before the canvas
#   public/sequences/<name>/still.jpg            last frame, the reduced-motion view
#   src/data/sequences/<name>.json               the manifest the site reads
#
# Re-running replaces the previous frames, so swapping placeholder frames for
# real footage is one command. The build then checks the manifest against the
# files on disk (src/data/sequences/index.ts).
#
# Options
#   --alt TEXT          alt text describing what the frames show (required)
#   --frames N          desktop frame count          (default 120)
#   --mobile-frames N   mobile frame count           (default 60)
#   --width PX          desktop frame width          (default 1280)
#   --mobile-width PX   mobile frame width           (default 720)
#   --quality Q         JPEG quality, 2 best to 31   (default 4)
#   --source S          footage | placeholder        (default footage)
#
# JPEG rather than WebP: it decodes fastest, which is what scrubbing needs, and
# Homebrew's ffmpeg is built without a WebP encoder.

set -euo pipefail

die() {
  echo "extract-frames: $*" >&2
  exit 1
}

[[ $# -ge 2 ]] || die "usage: extract-frames.sh <video> <name> --alt TEXT [options]"
video=$1
name=$2
shift 2

alt=""
frames=120
mobile_frames=60
width=1280
mobile_width=720
quality=4
source=footage

while [[ $# -gt 0 ]]; do
  case $1 in
    --alt) alt=$2; shift 2 ;;
    --frames) frames=$2; shift 2 ;;
    --mobile-frames) mobile_frames=$2; shift 2 ;;
    --width) width=$2; shift 2 ;;
    --mobile-width) mobile_width=$2; shift 2 ;;
    --quality) quality=$2; shift 2 ;;
    --source) source=$2; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -f $video ]] || die "no such video: $video"
# The name becomes a directory this script deletes and recreates, so keep it plain.
[[ $name =~ ^[a-z0-9-]+$ ]] || die "name must be lowercase letters, digits and dashes: $name"
[[ -n $alt ]] || die "--alt is required: describe what the frames actually show"
[[ $source == footage || $source == placeholder ]] || die "--source must be footage or placeholder"
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || die "needs ffmpeg and ffprobe"
command -v node >/dev/null || die "needs node"

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/public/sequences/$name"
manifest="$root/src/data/sequences/$name.json"

duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")
[[ -n $duration ]] || die "could not read the duration of $video"

# One frame set, sampled evenly across the whole clip and scaled to a width.
extract() { # <dir> <count> <width>
  local dir=$1 count=$2 w=$3 rate
  rm -rf "$dir"
  mkdir -p "$dir"
  rate=$(awk -v n="$count" -v d="$duration" 'BEGIN { printf "%.6f", n / d }')
  ffmpeg -v error -i "$video" \
    -vf "fps=$rate,scale=$w:-2:flags=lanczos" \
    -q:v "$quality" -start_number 0 "$dir/%04d.jpg"
}

echo "extract-frames: $name from $(basename "$video") (${duration}s)"
extract "$out/desktop" "$frames" "$width"
extract "$out/mobile" "$mobile_frames" "$mobile_width"

# Globs sort lexically, and the names are zero-padded, so this is frame order.
desktop=("$out"/desktop/*.jpg)
mobile=("$out"/mobile/*.jpg)
cp "${desktop[0]}" "$out/poster.jpg"
cp "${desktop[${#desktop[@]}-1]}" "$out/still.jpg"

size_of() {
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$1"
}

mkdir -p "$(dirname "$manifest")"
NAME=$name SOURCE=$source ALT=$alt \
  DESKTOP_COUNT=${#desktop[@]} DESKTOP_SIZE=$(size_of "${desktop[0]}") \
  MOBILE_COUNT=${#mobile[@]} MOBILE_SIZE=$(size_of "${mobile[0]}") \
  node -e '
    const env = process.env;
    const variant = (key, count, size) => {
      const [width, height] = size.split("x").map(Number);
      return {
        count: Number(count),
        width,
        height,
        pattern: `/sequences/${env.NAME}/${key}/{i}.jpg`,
        pad: 4,
      };
    };
    const manifest = {
      name: env.NAME,
      source: env.SOURCE,
      alt: env.ALT,
      desktop: variant("desktop", env.DESKTOP_COUNT, env.DESKTOP_SIZE),
      mobile: variant("mobile", env.MOBILE_COUNT, env.MOBILE_SIZE),
      poster: `/sequences/${env.NAME}/poster.jpg`,
      still: `/sequences/${env.NAME}/still.jpg`,
    };
    process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  ' >"$manifest"

echo "  desktop  ${#desktop[@]} frames  $(size_of "${desktop[0]}")  $(du -sh "$out/desktop" | cut -f1)"
echo "  mobile   ${#mobile[@]} frames  $(size_of "${mobile[0]}")  $(du -sh "$out/mobile" | cut -f1)"
echo "  manifest ${manifest#"$root"/}"
