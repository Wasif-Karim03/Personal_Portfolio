#!/usr/bin/env bash
#
# Builds the placeholder resume sequence (FIG. 15) until filming day shot C exists.
#
#   scripts/make-resume-placeholder.sh
#
# Renders a synthetic clip in the drawing-sheet palette (the hero placeholder's
# ink figure, lifting a sheet of paper up toward the camera), runs it through
# extract-frames.sh exactly like real footage, and writes the sheet's box for
# every frame. The download button sits on that box, so the paper can become it.
#
# Deliberately abstract: no face, real or generated (see CLAUDE.md). It is
# replaced by running extract-frames.sh on shot C and tracing the real sheet.

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

# The figure, as in the hero placeholder, standing centred.
CENTRE_X=960
BODY_W=300
BODY_H=700
HEAD_W=126
HEAD_H=145
NECK=18
BODY_Y=$((FLOOR - BODY_H))
HEAD_Y=$((BODY_Y - HEAD_H - NECK))

# The sheet: roughly A4 in proportion, held low, then lifted with an ease-out
# so it settles as it reaches the camera. The box-track script below repeats
# this geometry, so keep the two in step.
PAPER_W=280
PAPER_H=396
PAPER_X=$((CENTRE_X - PAPER_W / 2))
START_Y=600
LIFT=290
P="(t/$DURATION)"
PAPER_Y="($START_Y-$LIFT*(1-(1-$P)*(1-$P)))"

src() { echo "color=c=$1:s=$2:r=$FPS:d=$DURATION"; }

# The sheet's own markings are static, so plain drawbox is fine for them: an
# ink edge, a heading bar and lines of "text".
sheet="[3]drawbox=x=0:y=0:w=iw:h=ih:c=0x141414:t=3,drawbox=x=36:y=28:w=150:h=16:c=0x141414:t=fill"
for line in 70 100 130 190 220 250 280 310 340; do
  sheet+=",drawbox=x=36:y=$line:w=iw-72:h=6:c=0x141414@0.35:t=fill"
done
sheet+="[sheet];"

graph="[0]drawgrid=w=120:h=120:t=1:c=0x141414@0.07"
graph+=",drawbox=x=0:y=$FLOOR:w=iw:h=2:c=0x141414@0.45:t=fill[bg];"
graph+="[bg][1]overlay=x=$((CENTRE_X - BODY_W / 2)):y=$BODY_Y[body];"
graph+="[body][2]overlay=x=$((CENTRE_X - HEAD_W / 2)):y=$HEAD_Y[figure];"
graph+="$sheet"
# Motion goes through overlay, whose x/y are evaluated per frame with t as time.
graph+="[figure][sheet]overlay=x=$PAPER_X:y=$PAPER_Y[held];"
# A timeline along the bottom edge, so it is obvious which frame is on screen.
graph+="[held][4]overlay=x=-W+W*t/$DURATION:y=H-6"

echo "make-resume-placeholder: rendering ${DURATION}s synthetic clip"
ffmpeg -v error \
  -f lavfi -i "$(src 0xF2EFE8 "${WIDTH}x${HEIGHT}")" \
  -f lavfi -i "$(src 0x141414 "${BODY_W}x${BODY_H}")" \
  -f lavfi -i "$(src 0x141414 "${HEAD_W}x${HEAD_H}")" \
  -f lavfi -i "$(src 0xFBFAF6 "${PAPER_W}x${PAPER_H}")" \
  -f lavfi -i "$(src 0xA4A29E "${WIDTH}x6")" \
  -filter_complex "$graph" -c:v ffv1 "$tmp/resume.mkv"

"$root/scripts/extract-frames.sh" "$tmp/resume.mkv" resume \
  --source placeholder \
  --alt "Placeholder: an ink figure lifting a sheet of paper toward the camera."

count=$(node -p 'require(process.argv[1]).desktop.count' "$root/src/data/sequences/resume.json")

COUNT=$count WIDTH=$WIDTH HEIGHT=$HEIGHT PAPER_X=$PAPER_X PAPER_W=$PAPER_W \
  PAPER_H=$PAPER_H START_Y=$START_Y LIFT=$LIFT \
  node -e '
    const env = Object.fromEntries(
      Object.entries(process.env).map(([key, value]) => [key, Number(value)]),
    );
    const round = (value, places) => Number(value.toFixed(places));

    // Same geometry as the ffmpeg overlay. Frame k sits at t = (k / COUNT) * DURATION.
    const frames = Array.from({ length: env.COUNT }, (_, k) => {
      const p = k / env.COUNT;
      const y = env.START_Y - env.LIFT * (1 - (1 - p) ** 2);
      return [
        round(env.PAPER_X / env.WIDTH, 4),
        round(y / env.HEIGHT, 4),
        round(env.PAPER_W / env.WIDTH, 4),
        round(env.PAPER_H / env.HEIGHT, 4),
        1,
      ];
    });

    // One frame per line keeps diffs readable when a traced track replaces this.
    const rows = frames.map((frame) => "    " + JSON.stringify(frame)).join(",\n");
    process.stdout.write(`{\n  "label": "resume",\n  "frames": [\n${rows}\n  ]\n}\n`);
  ' >"$root/src/data/sequences/resume.paper.json"

echo "  paper track src/data/sequences/resume.paper.json ($count frames)"
