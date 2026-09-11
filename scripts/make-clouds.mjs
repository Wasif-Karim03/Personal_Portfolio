#!/usr/bin/env node
/**
 * Builds the point clouds the site loads from files (see src/lib/cloud-shapes.ts
 * for the ones generated in the browser).
 *
 *   node scripts/make-clouds.mjs
 *
 * Two kinds need data the browser shouldn't download:
 *   - the portraits, from the maps scripts/portrait/make-maps.mjs made of a real
 *     photo: each point is a pixel of the person, placed by estimated depth and
 *     coloured by the photo. The photo itself is never shipped.
 *   - the globe, from Natural Earth land, with the route of the 2022 flight.
 *
 * A portrait whose maps aren't on this machine keeps its existing files, so the
 * script runs anywhere the repo is checked out.
 *
 * Writes public/clouds/<shape>-<variant>.bin and src/data/clouds.json.
 * Format: count × 3 int16 positions (÷ 32767; y up, x right, z toward the
 * viewer, within [-1, 1]), then count × 4 uint8 colours: RGB, and A as reveal
 * order (0 = always shown, 1–255 = shown once the scene is that far along).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains, geoInterpolate, geoRotation } from 'd3-geo';
import sharp from 'sharp';
import { feature } from 'topojson-client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** Every shape has exactly this many points, so any shape can become any other. */
const COUNTS = { desktop: 36000, mobile: 14000 };

const INK = [20, 20, 20];
const INK_60 = [109, 108, 105];
const INK_30 = [175, 173, 168];
const FAINT = [210, 207, 200];
const SIGNAL = [255, 79, 0];

const PORTRAITS = [
  { shape: 'portrait-now', maps: 'now' },
  { shape: 'portrait-graduation', maps: 'graduation' },
];

const manifestPath = join(root, 'src/data/clouds.json');
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { shapes: {} };
const manifest = { counts: COUNTS, shapes: {} };
mkdirSync(join(root, 'public/clouds'), { recursive: true });

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Shuffled, so each point morphs to a random place and any prefix is a fair sample. */
function shuffle(positions, colors, r) {
  for (let i = colors.length / 4 - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    for (let k = 0; k < 3; k++) [positions[i * 3 + k], positions[j * 3 + k]] = [positions[j * 3 + k], positions[i * 3 + k]];
    for (let k = 0; k < 4; k++) [colors[i * 4 + k], colors[j * 4 + k]] = [colors[j * 4 + k], colors[i * 4 + k]];
  }
}

function write(shape, variant, { positions, colors }) {
  const packed = new Int16Array(positions.length);
  for (let i = 0; i < positions.length; i++) packed[i] = Math.round(Math.min(Math.max(positions[i], -1), 1) * 32767);
  const file = `/clouds/${shape}-${variant}.bin`;
  writeFileSync(join(root, 'public', file), Buffer.concat([Buffer.from(packed.buffer), Buffer.from(colors.buffer)]));
  return file;
}

async function portrait(maps, count, seed) {
  const dir = join(root, 'assets/raw/derived', maps);
  const { data: rgb, info } = await sharp(join(dir, 'photo.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const depth = await sharp(join(dir, 'depth.png')).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
  const matte = await sharp(join(dir, 'matte.png')).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();

  // The person is the matte's confident pixels.
  const inside = [];
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let i = 0; i < W * H; i++) {
    if (matte[i] < 140) continue;
    inside.push(i);
    const x = i % W, y = Math.floor(i / W);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const depths = inside.map((i) => depth[i]).sort((a, b) => a - b);
  const lo = depths[Math.floor(depths.length * 0.02)];
  const hi = depths[Math.floor(depths.length * 0.98)];
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, s = (maxY - minY) / 2 / 0.97;
  const headLine = minY + (maxY - minY) * 0.32;

  const r = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 4);
  for (let n = 0; n < count; ) {
    const i = inside[Math.floor(r() * inside.length)];
    const x = i % W, y = Math.floor(i / W);
    // Denser on the head, where the detail is.
    if (r() > (matte[i] / 255) * (y < headLine ? 1 : 0.55)) continue;
    const d = Math.min(Math.max((depth[i] - lo) / Math.max(hi - lo, 1), 0), 1);
    positions[n * 3] = (x + r() - cx) / s;
    positions[n * 3 + 1] = -(y + r() - cy) / s;
    positions[n * 3 + 2] = (d - 0.5) * 0.6 + gauss(r) * 0.006;
    colors.set([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 0], n * 4);
    n++;
  }
  shuffle(positions, colors, r);

  const found = JSON.parse(readFileSync(join(dir, 'detection.json'), 'utf8'));
  const detection = found.person && {
    label: 'person',
    score: found.person.score,
    box: [
      (found.person.box.xmin - cx) / s,
      -(found.person.box.ymin - cy) / s,
      (found.person.box.xmax - cx) / s,
      -(found.person.box.ymax - cy) / s,
    ].map((v) => Number(v.toFixed(4))),
  };
  return { positions, colors, detection };
}

// The 2022 flight, as in src/data/flight.ts.
const ORIGIN = [90.3978, 23.8433];
const DESTINATION = [-83.068, 40.2987];
const land = feature(require('world-atlas/land-110m.json'), require('world-atlas/land-110m.json').objects.land);

// A 1° grid of land and sea, so sampling doesn't test each point against every coastline.
const landGrid = new Uint8Array(360 * 180);
for (let lat = -90; lat < 90; lat++) {
  for (let lon = -180; lon < 180; lon++) {
    landGrid[(lat + 90) * 360 + lon + 180] = geoContains(land, [lon + 0.5, lat + 0.5]) ? 1 : 0;
  }
}
const isLand = ([lon, lat]) => landGrid[Math.min(Math.floor(lat) + 90, 179) * 360 + Math.min(Math.floor(lon) + 180, 359)] === 1;

function globe(count, seed) {
  const along = geoInterpolate(ORIGIN, DESTINATION);
  const mid = along(0.5);
  // Centred on the route's midpoint, as the drawn globe was, so the whole arc faces the viewer.
  const rotate = geoRotation([-mid[0], -mid[1]]);
  const R = 0.92;
  const xyz = (lonLat, radius = R) => {
    const [l, p] = rotate(lonLat).map((v) => (v * Math.PI) / 180);
    return [Math.cos(p) * Math.sin(l) * radius, Math.sin(p) * radius, Math.cos(p) * Math.cos(l) * radius];
  };
  const randomLonLat = (r) => [r() * 360 - 180, (Math.asin(2 * r() - 1) * 180) / Math.PI];

  const r = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 4);
  const parts = [
    { weight: 0.64, sample: () => { let p; do p = randomLonLat(r); while (!isLand(p)); return [xyz(p), r() < 0.7 ? INK : INK_60, 0]; } },
    { weight: 0.1, sample: () => { let p; do p = randomLonLat(r); while (isLand(p)); return [xyz(p), FAINT, 0]; } },
    {
      weight: 0.12,
      sample: () => {
        const meridian = r() < 0.5;
        const p = meridian
          ? [Math.floor(r() * 12) * 30 - 180, (Math.asin(2 * r() - 1) * 180) / Math.PI]
          : [r() * 360 - 180, [-60, -30, 0, 30, 60][Math.floor(r() * 5)]];
        return [xyz(p), INK_30, 0];
      },
    },
    {
      weight: 0.11,
      sample: () => {
        const t = r();
        return [xyz(along(t), R * 1.012 + Math.abs(gauss(r)) * 0.004), SIGNAL, 1 + Math.round(t * 253)];
      },
    },
    { weight: 0.015, sample: () => [xyz([ORIGIN[0] + gauss(r) * 1.3, ORIGIN[1] + gauss(r) * 1.3], R * 1.015), SIGNAL, 0] },
    { weight: 0.015, sample: () => [xyz([DESTINATION[0] + gauss(r) * 1.3, DESTINATION[1] + gauss(r) * 1.3], R * 1.015), SIGNAL, 255] },
  ];
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  let n = 0;
  parts.forEach((part, index) => {
    const quota = index === parts.length - 1 ? count - n : Math.round((count * part.weight) / total);
    for (let k = 0; k < quota && n < count; k++, n++) {
      const [p, c, order] = part.sample();
      positions.set(p.map((v) => v + gauss(r) * 0.003), n * 3);
      colors.set([c[0], c[1], c[2], order], n * 4);
    }
  });
  shuffle(positions, colors, r);
  // The route's two ends, so a page can move a marker along the exact arc.
  const ends = { from: xyz(ORIGIN, R * 1.012), to: xyz(DESTINATION, R * 1.012) };
  const round = (v) => v.map((n) => Number(n.toFixed(4)));
  return { positions, colors, route: { from: round(ends.from), to: round(ends.to) } };
}

for (const { shape, maps } of PORTRAITS) {
  if (!existsSync(join(root, 'assets/raw/derived', maps, 'photo.jpg'))) {
    if (previous.shapes[shape]) {
      manifest.shapes[shape] = previous.shapes[shape];
      console.log(`${shape}: no maps here, kept the existing files`);
    } else {
      console.warn(`${shape}: no maps and no existing files; run scripts/portrait/make-maps.mjs first`);
    }
    continue;
  }
  const files = {};
  let detection;
  for (const [variant, count] of Object.entries(COUNTS)) {
    const cloud = await portrait(maps, count, variant === 'desktop' ? 101 : 202);
    files[variant] = write(shape, variant, cloud);
    detection = cloud.detection;
  }
  manifest.shapes[shape] = detection ? { files, detection } : { files };
  console.log(`${shape}: ${Object.values(COUNTS).join(' / ')} points${detection ? `, person ${detection.score}` : ''}`);
}

const globeFiles = {};
let route;
for (const [variant, count] of Object.entries(COUNTS)) {
  const cloud = globe(count, variant === 'desktop' ? 303 : 404);
  globeFiles[variant] = write('globe', variant, cloud);
  route = cloud.route;
}
manifest.shapes.globe = { files: globeFiles, route };
console.log(`globe: ${Object.values(COUNTS).join(' / ')} points`);

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('src/data/clouds.json');
