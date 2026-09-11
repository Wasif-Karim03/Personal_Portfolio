#!/usr/bin/env bash
#
# Renders the site's icons and social preview image from their sources.
#
#   scripts/make-icons.sh
#
#   public/favicon.svg    → public/apple-touch-icon.png (180px)
#                           public/favicon.ico (32px, for browsers without SVG icons)
#   scripts/og-card.html  → public/og.png (1200×630, shown when a link is shared)
#
# Uses the local Google Chrome, headless, and ffmpeg. Re-run after changing
# either source.

set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

[[ -x $chrome ]] || { echo "make-icons: no Chrome at $chrome (set CHROME)" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "make-icons: needs ffmpeg" >&2; exit 1; }

# Headless Chrome writes the screenshot but doesn't always exit, so it runs in
# the background and is stopped once the file exists.
shot() { # <url> <width> <height> <out>
  local url=$1 width=$2 height=$3 out=$4 pid
  rm -f "$out"
  "$chrome" --headless=new --user-data-dir="$tmp/profile-$RANDOM" \
    --allow-file-access-from-files --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$width,$height" --virtual-time-budget=3000 \
    --screenshot="$out" "$url" >/dev/null 2>&1 &
  pid=$!
  for _ in $(seq 1 60); do
    [[ -s $out ]] && break
    sleep 0.25
  done
  sleep 0.5
  kill "$pid" 2>/dev/null || true
  [[ -s $out ]] || { echo "make-icons: no screenshot of $url" >&2; exit 1; }
}

# The icon, at 180px, on ink: iOS rounds the corners itself, and the SVG's own
# rounded corners would otherwise leave white slivers inside that mask.
cat >"$tmp/icon.html" <<HTML
<!doctype html><html><body style="margin:0;background:#141414">
<img src="file://$root/public/favicon.svg" width="180" height="180" style="display:block">
</body></html>
HTML
shot "file://$tmp/icon.html" 180 180 "$tmp/icon-180.png"
cp "$tmp/icon-180.png" "$root/public/apple-touch-icon.png"
ffmpeg -v error -y -i "$tmp/icon-180.png" -vf scale=32:32:flags=lanczos "$root/public/favicon.ico"

shot "file://$root/scripts/og-card.html" 1200 630 "$root/public/og.png"

for file in apple-touch-icon.png favicon.ico og.png; do
  printf '  %-22s %s\n' "$file" "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$root/public/$file")"
done
