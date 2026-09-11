#!/usr/bin/env node
/**
 * Builds the points for the story's flight scene (src/lib/story-scene.ts).
 *
 *   node scripts/make-story-points.mjs
 *
 * One set of points plays three roles as the reader scrolls: scattered dust,
 * then the globe with the 2022 flight from Dhaka to Ohio, then Ohio Wesleyan's
 * University Hall as dot-art, which the real photo develops out of. So every
 * point carries both places: where it sits on the globe, and where it sits in
 * the picture.
 *
 * Globe: Natural Earth land (world-atlas 110m) sampled on a half-degree grid;
 * no ocean or graticule points, so the continents read cleanly. The route is
 * the great circle, drawn in order.
 * Picture: src/assets/story/hall.jpg, sampled toward edges and light, so the
 * building's lines come through.
 *
 * Writes public/story/points-<variant>.bin and src/data/story-points.json.
 * Per variant, for count points: int16 globe xyz (÷ 32767, unit sphere),
 * uint16 picture uv (÷ 65535), uint8 role (0 land, 1 route, 2 Dhaka, 3 Ohio),
 * uint8 route order (0 always shown, 1–255 shown in turn), uint8 luminance.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoContains, geoInterpolate, geoRotation } from 'd3-geo';
import sharp from 'sharp';
import { feature } from 'topojson-client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const COUNTS = { desktop: 64000, mobile: 26000 };
const PICTURE = join(root, 'src/assets/story/hall.jpg');

// The 2022 flight, as in src/data/flight.ts.
const ORIGIN = [90.3978, 23.8433];
const DESTINATION = [-83.068, 40.2987];

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

// Land on a half-degree grid, so sampling doesn't test every point against every coastline.
const topology = require('world-atlas/land-110m.json');
const land = feature(topology, topology.objects.land);
const STEP = 0.5;
const COLS = 360 / STEP;
const ROWS = 180 / STEP;
const grid = new Uint8Array(COLS * ROWS);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    grid[r * COLS + c] = geoContains(land, [-180 + (c + 0.5) * STEP, -90 + (r + 0.5) * STEP]) ? 1 : 0;
  }
}
const isLand = ([lon, lat]) => grid[Math.min(Math.floor((lat + 90) / STEP), ROWS - 1) * COLS + Math.min(Math.floor((lon + 180) / STEP), COLS - 1)] === 1;

const along = geoInterpolate(ORIGIN, DESTINATION);
const mid = along(0.5);
const rotate = geoRotation([-mid[0], -mid[1]]);
const xyz = (lonLat, radius = 1) => {
  const [l, p] = rotate(lonLat).map((v) => (v * Math.PI) / 180);
  return [Math.cos(p) * Math.sin(l) * radius, Math.sin(p) * radius, Math.cos(p) * Math.cos(l) * radius];
};

// The picture's weights: edges and light, so the architecture comes through as dots.
const PW = 640;
const PH = 360;
const lum = await sharp(PICTURE).resize(PW, PH, { fit: 'cover' }).greyscale().extractChannel(0).raw().toBuffer();
const weights = new Float64Array(PW * PH);
let total = 0;
for (let y = 1; y < PH - 1; y++) {
  for (let x = 1; x < PW - 1; x++) {
    const i = y * PW + x;
    const gx = lum[i + 1] - lum[i - 1];
    const gy = lum[i + PW] - lum[i - PW];
    const edge = Math.min(Math.hypot(gx, gy) / 90, 1);
    const w = 0.04 + 0.5 * edge + 0.45 * (lum[i] / 255) ** 2;
    weights[i] = w;
    total += w;
  }
}
const cdf = new Float64Array(PW * PH);
let run = 0;
for (let i = 0; i < weights.length; i++) { run += weights[i] / total; cdf[i] = run; }
const pickPixel = (u) => {
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
  return lo;
};

function build(count, seed) {
  const r = mulberry32(seed);
  const globe = new Int16Array(count * 3);
  const uv = new Uint16Array(count * 2);
  const role = new Uint8Array(count);
  const order = new Uint8Array(count);
  const light = new Uint8Array(count);
  const quotas = [Math.round(count * 0.935), Math.round(count * 0.045), Math.round(count * 0.01)];
  quotas.push(count - quotas[0] - quotas[1] - quotas[2]);

  let n = 0;
  const put = (p, kind, ord) => {
    globe[n * 3] = Math.round(p[0] * 32767 / 1.05);
    globe[n * 3 + 1] = Math.round(p[1] * 32767 / 1.05);
    globe[n * 3 + 2] = Math.round(p[2] * 32767 / 1.05);
    role[n] = kind;
    order[n] = ord;
    // Its place in the picture, independent of its place on the globe.
    const px = pickPixel(r());
    uv[n * 2] = Math.round(Math.min(((px % PW) + r()) / PW, 1) * 65535);
    uv[n * 2 + 1] = Math.round(Math.min((Math.floor(px / PW) + r()) / PH, 1) * 65535);
    light[n] = lum[px];
    n++;
  };

  for (let k = 0; k < quotas[0]; k++) {
    let p;
    do p = [r() * 360 - 180, (Math.asin(2 * r() - 1) * 180) / Math.PI]; while (!isLand(p));
    put(xyz(p, 1 + (r() - 0.5) * 0.004), 0, 0);
  }
  for (let k = 0; k < quotas[1]; k++) {
    const t = r();
    put(xyz(along(t), 1.012 + r() * 0.003), 1, 1 + Math.round(t * 253));
  }
  const near = (c) => [c[0] + (r() - 0.5) * 2.2, c[1] + (r() - 0.5) * 2.2];
  for (let k = 0; k < quotas[2]; k++) put(xyz(near(ORIGIN), 1.014), 2, 0);
  for (let k = 0; k < quotas[3]; k++) put(xyz(near(DESTINATION), 1.014), 3, 255);

  // Shuffle together, so each point's globe place and picture place are strangers:
  // the morph reads as the globe dissolving and the building gathering.
  for (let a = count - 1; a > 0; a--) {
    const b = Math.floor(r() * (a + 1));
    for (let c = 0; c < 3; c++) [globe[a * 3 + c], globe[b * 3 + c]] = [globe[b * 3 + c], globe[a * 3 + c]];
    [role[a], role[b]] = [role[b], role[a]];
    [order[a], order[b]] = [order[b], order[a]];
  }
  return Buffer.concat([Buffer.from(globe.buffer), Buffer.from(uv.buffer), Buffer.from(role.buffer), Buffer.from(order.buffer), Buffer.from(light.buffer)]);
}

mkdirSync(join(root, 'public/story'), { recursive: true });
const files = {};
for (const [variant, count] of Object.entries(COUNTS)) {
  const file = `/story/points-${variant}.bin`;
  writeFileSync(join(root, 'public', file), build(count, variant === 'desktop' ? 505 : 606));
  files[variant] = file;
}
const meta = await sharp(PICTURE).metadata();
const round = (v) => v.map((x) => Number(x.toFixed(4)));
writeFileSync(
  join(root, 'src/data/story-points.json'),
  JSON.stringify({
    counts: COUNTS,
    files,
    route: { from: round(xyz(ORIGIN, 1.012)), to: round(xyz(DESTINATION, 1.012)) },
    picture: { aspect: Number((meta.width / meta.height).toFixed(4)) },
  }, null, 2) + '\n',
);
console.log(`story points: ${Object.values(COUNTS).join(' / ')}, picture ${meta.width}x${meta.height}`);
