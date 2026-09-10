#!/usr/bin/env bash
#
# Builds the placeholder hero sequence (FIG. 01) until filming day shot A exists.
#
#   scripts/make-hero-placeholder.sh
#
# Renders a short synthetic clip in the drawing-sheet palette (an ink figure
# standing in for Wasif, walking into the middle of the frame), runs it through
# extract-frames.sh exactly like real footage, and writes a matching detection
# track so the orange person box has something to follow.
#
# Deliberately abstract: no face, real or generated (see CLAUDE.md). It is
# replaced by running extract-frames.sh on the real clip, and the YOLO export
# over src/data/sequences/hero.detections.json.

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# 15 fps for 8 s is 120 frames, the same as the desktop set.
FPS=15
DURATION=8
WIDTH=1920
HEIGHT=1080
FLOOR=1000

# The figure: a body and a head sliding right over the clip. Motion goes
# through overlay because its x/y are evaluated per frame with t as time; in
# drawbox, t means line thickness. The detection script below repeats this
# geometry, so keep the two in step.
BODY_W=300
BODY_H=700
HEAD_W=126
HEAD_H=145
NECK=18
START_X=760 # figure's centre x at the first frame
TRAVEL=200  # pixels it moves over the clip
BODY_Y=$((FLOOR - BODY_H))
HEAD_Y=$((BODY_Y - HEAD_H - NECK))
SPEED="($TRAVEL/$DURATION)"

src() { echo "color=c=$1:s=$2:r=$FPS:d=$DURATION"; }

graph="[0]drawgrid=w=120:h=120:t=1:c=0x141414@0.07"
graph+=",drawbox=x=0:y=$FLOOR:w=iw:h=2:c=0x141414@0.45:t=fill[sheet];"
graph+="[sheet][1]overlay=x=$((START_X - BODY_W / 2))+$SPEED*t:y=$BODY_Y[body];"
graph+="[body][2]overlay=x=$((START_X - HEAD_W / 2))+$SPEED*t:y=$HEAD_Y[figure];"
# A timeline along the bottom edge, so it is obvious which frame is on screen.
graph+="[figure][3]overlay=x=-W+W*t/$DURATION:y=H-6"

echo "make-hero-placeholder: rendering ${DURATION}s synthetic clip"
ffmpeg -v error \
  -f lavfi -i "$(src 0xF2EFE8 "${WIDTH}x${HEIGHT}")" \
  -f lavfi -i "$(src 0x141414 "${BODY_W}x${BODY_H}")" \
  -f lavfi -i "$(src 0x141414 "${HEAD_W}x${HEAD_H}")" \
  -f lavfi -i "$(src 0xA4A29E "${WIDTH}x6")" \
  -filter_complex "$graph" -c:v ffv1 "$tmp/hero.mkv"

"$root/scripts/extract-frames.sh" "$tmp/hero.mkv" hero \
  --source placeholder \
  --alt "Placeholder: an ink figure standing in for Wasif, walking into the frame."

count=$(node -p 'require(process.argv[1]).desktop.count' "$root/src/data/sequences/hero.json")

COUNT=$count WIDTH=$WIDTH HEIGHT=$HEIGHT FLOOR=$FLOOR DURATION=$DURATION \
  START_X=$START_X TRAVEL=$TRAVEL BODY_W=$BODY_W HEAD_Y=$HEAD_Y \
  node -e '
    const env = Object.fromEntries(
      Object.entries(process.env).map(([key, value]) => [key, Number(value)]),
    );
    const round = (value, places) => Number(value.toFixed(places));
    const pad = 12;

    const frames = Array.from({ length: env.COUNT }, (_, k) => {
      const p = k / env.COUNT; // frame k sits at t = p * DURATION
      // The detector takes a moment to lock on.
      if (p < 0.05) return null;

      // Same geometry as the ffmpeg overlays.
      const left = env.START_X + env.TRAVEL * p - env.BODY_W / 2;
      const top = env.HEAD_Y;

      // Confidence firms up as the figure settles, ending near 0.96.
      const confidence = 0.61 + 0.35 * (1 - (1 - p) ** 2);

      return [
        round((left - pad) / env.WIDTH, 4),
        round((top - pad) / env.HEIGHT, 4),
        round((env.BODY_W + pad * 2) / env.WIDTH, 4),
        round((env.FLOOR - top + pad * 2) / env.HEIGHT, 4),
        round(confidence, 2),
      ];
    });

    // One frame per line keeps diffs readable when real detections replace these.
    const rows = frames.map((frame) => "    " + JSON.stringify(frame)).join(",\n");
    process.stdout.write(`{\n  "label": "person",\n  "frames": [\n${rows}\n  ]\n}\n`);
  ' >"$root/src/data/sequences/hero.detections.json"

echo "  detections src/data/sequences/hero.detections.json ($count frames)"
