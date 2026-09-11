# wasifkarim.com

A scroll-driven personal site: open on now, rewind to 2022, play forward, then
the work, the resume, and a way to get in touch.

The full storyboard — all 17 scenes, the shot list, and the media plan — is in
[`docs/storyboard.md`](docs/storyboard.md). Working rules for contributors and
coding agents are in [`CLAUDE.md`](CLAUDE.md).

## Running it

Requires Node 24 (see `.node-version`) and pnpm.

```sh
pnpm install
pnpm dev      # dev server
pnpm build    # static build to dist/
pnpm check    # astro + typescript diagnostics
```

## How it is put together

- **Astro**, static output, deployed on Vercel.
- **GSAP** (ScrollTrigger, SplitText, DrawSVG, MotionPath) and **Lenis**, both
  set up in `src/lib/motion.ts`. Motion never takes over scroll speed, and it
  does not start at all under `prefers-reduced-motion`.
- **`src/data/scenes.ts`** is the spine. Both the story page and `/colophon`
  read from it, so an AI-generated shot cannot ship without being disclosed.
  `assertFaceRule()` fails the build if one tries.
- **Plain CSS** with design tokens in `src/styles/tokens.css`. No utility
  framework: nearly every scene is bespoke canvas and SVG, and Astro already
  scopes component styles.

## Media

Raw source photos and footage are **not** in this repo — they run to hundreds of
megabytes. `assets/raw/` is gitignored; originals live outside git, and only
optimized web-sized derivatives get committed.

### The story's point cloud

Every picture in the story is one point cloud that changes shape scene by
scene (`src/components/CloudStage.astro`, `src/lib/cloud-stage.ts`). Each scene
names its shape in `src/data/scenes.ts`. Most shapes are built in the browser
from simple geometry and text (`src/lib/cloud-shapes.ts`); two kinds come from
files, built by `scripts/make-clouds.mjs`:

- **Portraits**, from a real photo. The photo never ships: a local tool
  estimates depth, cuts the person from the background and runs a person
  detector, all on this machine, and the cloud is built from those maps.

  ```sh
  cd scripts/portrait && npm install && cd ../..    # once; pulls in onnxruntime
  node scripts/portrait/make-maps.mjs assets/raw/real/face/DSC01197.jpg graduation
  node scripts/make-clouds.mjs
  ```

  The maps land in `assets/raw/derived/<name>/`, out of git like the photos.
  The detection box on a portrait is the detector's own box and confidence.
- **The globe**, from Natural Earth land, with the 2022 route in orange.

### The LiDAR fly-through

FIG. 14 flies through a point cloud from the car's LiDAR. Swapping in the real
scan is one command, from a PLY exported out of the rosbag:

```sh
node scripts/ply-to-points.mjs ~/scans/street.ply work \
  --caption "A LiDAR scan from the car, driving down the street"
```

That writes a desktop set and a lighter mobile set to `public/points/<name>/`
and a manifest to `src/data/points/<name>.json`; the build fails if the files
don't hold the number of points the manifest claims. Coordinates stay as ROS
publishes them (x forward, y left, z up). The camera's path through the cloud
is the `path` list in the manifest: re-running keeps an existing one, so tune
it by hand once and it stays.

Until then, FIG. 14 runs on a simulated scan from
`scripts/make-lidar-placeholder.mjs`, labelled as such on the page. three.js is
fetched only as the scene approaches, and never under reduced motion.

### Photos and clips

The REAL scenes (FIG. 03, 05, 06, 11 and 12) have their frames on the page
already, labelled until the real thing arrives. Each frame is a named slot in
`src/data/media.ts`, and filling one is a single command, no code:

```sh
node scripts/add-photo.mjs ~/Pictures/IMG_2041.jpg accepted-letter
scripts/add-clip.sh ~/Movies/printer.mov thinkbox-printer --from 3 --to 9
```

Photos are turned upright, fitted within 2400px and stripped of metadata, GPS
location included, into `src/assets/media/`; the build makes the responsive
sizes and formats. Clips are trimmed, scaled down, muted and written to
`public/media/` with a poster frame. The build fails on a file whose name
matches no slot. The slots are `accepted-letter`, `campus-1` to `campus-3`,
`club-1` to `club-3`, `graduation`, `thinkbox-printer` and
`thinkbox-poetry-camera`. FIG. 03's callouts need their positions set to the
real letter's lines once its photo is in.
