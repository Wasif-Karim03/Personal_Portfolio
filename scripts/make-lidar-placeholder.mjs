#!/usr/bin/env node
/**
 * Builds the placeholder point cloud for FIG. 14 until the car's LiDAR scan exists.
 *
 *   node scripts/make-lidar-placeholder.mjs
 *
 * Simulates what the car would record driving down a street: a spinning
 * 16-beam LiDAR at RC-car height, swept every couple of metres along the road,
 * each beam ray-cast against simple geometry (road, kerbs, building fronts,
 * parked cars, poles). The result has the rings and shadows a real scan has,
 * so the fly-through is tuned against something honest.
 *
 * Writes the same files scripts/ply-to-points.mjs writes for a real scan:
 *   public/points/work/desktop.bin, public/points/work/mobile.bin  (float32 x, y, z)
 *   src/data/points/work.json                                      (manifest)
 *
 * Coordinates follow ROS: x forward, y left, z up, in metres.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'work';
const DESKTOP = 120_000;
const MOBILE = 40_000;

// Seeded, so re-running produces the same cloud and a clean diff.
let seed = 42;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

// --- The street ---------------------------------------------------------
const LENGTH = 80; // metres of street
const ROAD_HALF = 4; // the road is 8 m wide
const KERB = 0.12;
const FRONT = 9; // building fronts start at y = ±9
const SENSOR_Z = 0.35; // LiDAR height on an RC car
const RANGE = 30; // furthest return

/** Axis-aligned boxes: [xmin, xmax, ymin, ymax, zmin, zmax]. */
const boxes = [];

for (const side of [-1, 1]) {
  // Building fronts, with the odd alley between them.
  let x = -6;
  while (x < LENGTH + 6) {
    const width = 8 + random() * 10;
    const front = FRONT + random() * 1.2;
    const [ya, yb] = [side * front, side * (front + 6)];
    boxes.push([x, x + width, Math.min(ya, yb), Math.max(ya, yb), 0, 6 + random() * 10]);
    x += width + (random() < 0.3 ? 2 + random() * 3 : 0.3);
  }

  // Kerb and pavement.
  boxes.push([-6, LENGTH + 6, side > 0 ? ROAD_HALF : -FRONT, side > 0 ? FRONT : -ROAD_HALF, 0, KERB]);

  // Parked cars along both edges of the road.
  for (let x = 3; x < LENGTH; x += 7 + random() * 6) {
    if (random() < 0.35) continue;
    const y = side * (ROAD_HALF - 1.1);
    boxes.push([x, x + 4.3, y - 0.9, y + 0.9, 0.15, 1.45]);
  }
}

/** Vertical poles: [cx, cy, radius, height]. */
const poles = [];
for (const side of [-1, 1]) {
  for (let x = 6; x < LENGTH; x += 12) poles.push([x + random(), side * (ROAD_HALF + 1.2), 0.12, 5]);
}

// --- Ray casting --------------------------------------------------------
function cast(o, d) {
  let best = RANGE;

  // Ground plane.
  if (d[2] < -1e-6) {
    const t = -o[2] / d[2];
    if (t > 0 && t < best) best = t;
  }

  // Boxes, by the slab method.
  for (const box of boxes) {
    let near = 1e-4;
    let far = best;
    let hit = true;
    for (let axis = 0; axis < 3 && hit; axis++) {
      const lo = box[axis * 2];
      const hi = box[axis * 2 + 1];
      if (Math.abs(d[axis]) < 1e-9) {
        if (o[axis] < lo || o[axis] > hi) hit = false;
        continue;
      }
      const t1 = (lo - o[axis]) / d[axis];
      const t2 = (hi - o[axis]) / d[axis];
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      if (near > far) hit = false;
    }
    if (hit && near < best) best = near;
  }

  // Poles, as capped vertical cylinders.
  for (const [cx, cy, r, h] of poles) {
    const ox = o[0] - cx;
    const oy = o[1] - cy;
    const a = d[0] * d[0] + d[1] * d[1];
    if (a < 1e-9) continue;
    const b = 2 * (ox * d[0] + oy * d[1]);
    const disc = b * b - 4 * a * (ox * ox + oy * oy - r * r);
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    const z = o[2] + t * d[2];
    if (t > 1e-4 && t < best && z >= 0 && z <= h) best = t;
  }

  return best < RANGE ? best : null;
}

// --- The drive ----------------------------------------------------------
const BEAMS = Array.from({ length: 16 }, (_, i) => ((-15 + 2 * i) * Math.PI) / 180);
const AZIMUTH_STEPS = 450; // 0.8° apart
const points = [];

for (let sx = 0; sx <= LENGTH; sx += 2.5) {
  const origin = [sx, 0, SENSOR_Z];
  for (const elevation of BEAMS) {
    const ce = Math.cos(elevation);
    const se = Math.sin(elevation);
    for (let step = 0; step < AZIMUTH_STEPS; step++) {
      const azimuth = (step / AZIMUTH_STEPS) * 2 * Math.PI;
      const d = [ce * Math.cos(azimuth), ce * Math.sin(azimuth), se];
      const t = cast(origin, d);
      if (t === null) continue;
      // A couple of centimetres of range noise, as a real sensor has.
      const range = t + (random() + random() - 1) * 0.02;
      points.push(origin[0] + d[0] * range, origin[1] + d[1] * range, origin[2] + d[2] * range);
    }
  }
}

// --- Output -------------------------------------------------------------
/** A seeded random subset of `count` points, or all of them if there are fewer. */
function sample(all, count) {
  const total = all.length / 3;
  const order = Array.from({ length: total }, (_, i) => i);
  const keep = Math.min(count, total);
  for (let i = 0; i < keep; i++) {
    const j = i + Math.floor(random() * (total - i));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out = new Float32Array(keep * 3);
  for (let i = 0; i < keep; i++) out.set(all.slice(order[i] * 3, order[i] * 3 + 3), i * 3);
  return out;
}

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < points.length; i += 3) {
  for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], points[i + axis]);
    max[axis] = Math.max(max[axis], points[i + axis]);
  }
}

const round = (v) => Number(v.toFixed(2));
const outDir = join(root, 'public/points', NAME);
mkdirSync(outDir, { recursive: true });
const sets = { desktop: sample(points, DESKTOP), mobile: sample(points, MOBILE) };
for (const [key, set] of Object.entries(sets)) {
  writeFileSync(join(outDir, `${key}.bin`), Buffer.from(set.buffer));
}

const manifest = {
  name: NAME,
  source: 'placeholder',
  caption: 'Placeholder point cloud: a simulated 16-beam LiDAR driven down a street.',
  desktop: { file: `/points/${NAME}/desktop.bin`, count: sets.desktop.length / 3 },
  mobile: { file: `/points/${NAME}/mobile.bin`, count: sets.mobile.length / 3 },
  bounds: { min: min.map(round), max: max.map(round) },
  // From above and behind the street, down to car height, then along it.
  path: [
    [-14, 0, 12],
    [-2, 0, 5],
    [12, 0, 1.6],
    [40, 0, 1.2],
    [66, 0, 1.3],
  ],
};
const manifestPath = join(root, 'src/data/points', `${NAME}.json`);
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const kb = (set) => `${Math.round(set.byteLength / 1024)} KB`;
console.log(`make-lidar-placeholder: ${(points.length / 3).toLocaleString('en-US')} returns simulated`);
console.log(`  desktop  ${manifest.desktop.count.toLocaleString('en-US')} points  ${kb(sets.desktop)}`);
console.log(`  mobile   ${manifest.mobile.count.toLocaleString('en-US')} points  ${kb(sets.mobile)}`);
console.log(`  manifest src/data/points/${NAME}.json`);
