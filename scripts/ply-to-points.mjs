#!/usr/bin/env node
/**
 * Converts a PLY point cloud (such as the car's LiDAR map exported from a
 * rosbag) into the files FIG. 14 reads.
 *
 *   node scripts/ply-to-points.mjs <scan.ply> <name> [options]
 *
 *   --desktop N     points in the desktop set   (default 120000)
 *   --mobile N      points in the mobile set    (default 40000)
 *   --caption TEXT  what the cloud is           (default "A LiDAR scan from the car.")
 *
 * Reads ASCII or binary PLY with float, double or integer x, y, z vertex
 * properties, samples it down to both sizes, and writes
 *   public/points/<name>/desktop.bin, public/points/<name>/mobile.bin
 *   src/data/points/<name>.json
 *
 * Coordinates stay as ROS publishes them (x forward, y left, z up). An existing
 * manifest's camera path is kept; otherwise a path along the scan's long axis is
 * written as a starting point to tune by hand.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function die(message) {
  console.error(`ply-to-points: ${message}`);
  process.exit(1);
}

// --- Arguments ----------------------------------------------------------
const [input, name, ...rest] = process.argv.slice(2);
if (!input || !name) die('usage: ply-to-points.mjs <scan.ply> <name> [--desktop N] [--mobile N] [--caption TEXT]');
if (!/^[a-z0-9-]+$/.test(name)) die(`name must be lowercase letters, digits and dashes: ${name}`);
if (!existsSync(input)) die(`no such file: ${input}`);

const options = { desktop: 120_000, mobile: 40_000, caption: 'A LiDAR scan from the car.' };
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i]?.replace(/^--/, '');
  if (!(key in options) || rest[i + 1] === undefined) die(`unknown or incomplete option: ${rest[i]}`);
  options[key] = key === 'caption' ? rest[i + 1] : Number(rest[i + 1]);
}

// --- Header -------------------------------------------------------------
const buffer = readFileSync(input);
const marker = buffer.indexOf('end_header');
if (marker < 0) die('not a PLY file: no end_header');
let dataStart = marker + 'end_header'.length;
if (buffer[dataStart] === 0x0d) dataStart++;
if (buffer[dataStart] === 0x0a) dataStart++;

const header = buffer.subarray(0, marker).toString('latin1').split(/\r?\n/).map((l) => l.trim());
if (header[0] !== 'ply') die('not a PLY file');

let format = '';
const elements = [];
for (const line of header) {
  const parts = line.split(/\s+/);
  if (parts[0] === 'format') format = parts[1];
  if (parts[0] === 'element') elements.push({ name: parts[1], count: Number(parts[2]), props: [] });
  if (parts[0] === 'property') {
    const element = elements.at(-1);
    if (!element) die('property before any element');
    element.props.push(parts[1] === 'list' ? { list: true, name: parts[4] } : { type: parts[1], name: parts[2] });
  }
}

const vertex = elements[0];
if (vertex?.name !== 'vertex') die('the first element must be vertex');
if (vertex.props.some((p) => p.list)) die('list properties on vertices are not supported');
const axes = ['x', 'y', 'z'].map((n) => vertex.props.findIndex((p) => p.name === n));
if (axes.some((i) => i < 0)) die('vertices need x, y and z properties');

// --- Vertices -----------------------------------------------------------
const count = vertex.count;
const all = new Float32Array(count * 3);

if (format === 'ascii') {
  const lines = buffer.subarray(dataStart).toString('latin1').split('\n');
  for (let i = 0; i < count; i++) {
    const cols = lines[i].trim().split(/\s+/);
    for (let k = 0; k < 3; k++) all[i * 3 + k] = Number(cols[axes[k]]);
  }
} else if (format === 'binary_little_endian' || format === 'binary_big_endian') {
  const little = format === 'binary_little_endian';
  const SIZE = { char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2, int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  const READ = {
    char: 'getInt8', int8: 'getInt8', uchar: 'getUint8', uint8: 'getUint8',
    short: 'getInt16', int16: 'getInt16', ushort: 'getUint16', uint16: 'getUint16',
    int: 'getInt32', int32: 'getInt32', uint: 'getUint32', uint32: 'getUint32',
    float: 'getFloat32', float32: 'getFloat32', double: 'getFloat64', float64: 'getFloat64',
  };
  const offsets = [];
  let stride = 0;
  for (const prop of vertex.props) {
    if (!(prop.type in SIZE)) die(`unsupported property type: ${prop.type}`);
    offsets.push(stride);
    stride += SIZE[prop.type];
  }
  if (buffer.length < dataStart + stride * count) die('file is shorter than its header says');
  const view = new DataView(buffer.buffer, buffer.byteOffset + dataStart);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const prop = vertex.props[axes[k]];
      all[i * 3 + k] = view[READ[prop.type]](i * stride + offsets[axes[k]], little);
    }
  }
} else {
  die(`unsupported PLY format: ${format}`);
}

// --- Sampling, bounds, path ---------------------------------------------
let seed = 7;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

/** A seeded random subset of `target` points, or all of them if there are fewer. */
function sample(target) {
  const keep = Math.min(target, count);
  const order = Uint32Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < keep; i++) {
    const j = i + Math.floor(random() * (count - i));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const out = new Float32Array(keep * 3);
  for (let i = 0; i < keep; i++) out.set(all.subarray(order[i] * 3, order[i] * 3 + 3), i * 3);
  return out;
}

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < all.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], all[i + k]);
    max[k] = Math.max(max[k], all[i + k]);
  }
}
const round = (v) => Number(v.toFixed(2));

const manifestPath = join(root, 'src/data/points', `${name}.json`);
let path;
if (existsSync(manifestPath)) {
  path = JSON.parse(readFileSync(manifestPath, 'utf8')).path;
}
if (!Array.isArray(path) || path.length < 2) {
  // Along the long horizontal axis, down the middle, starting high and settling
  // at about eye height above the lowest point, assumed to be the ground.
  const long = max[0] - min[0] >= max[1] - min[1] ? 0 : 1;
  const cross = 1 - long;
  const ground = min[2];
  const at = (t, z) => {
    const p = [0, 0, z];
    p[long] = min[long] + (max[long] - min[long]) * t;
    p[cross] = (min[cross] + max[cross]) / 2;
    return p.map(round);
  };
  path = [at(-0.1, ground + 10), at(0.05, ground + 4), at(0.3, ground + 1.5), at(0.65, ground + 1.3), at(0.9, ground + 1.4)];
}

// --- Output -------------------------------------------------------------
const outDir = join(root, 'public/points', name);
mkdirSync(outDir, { recursive: true });
const sets = { desktop: sample(options.desktop), mobile: sample(options.mobile) };
for (const [key, set] of Object.entries(sets)) writeFileSync(join(outDir, `${key}.bin`), Buffer.from(set.buffer));

const manifest = {
  name,
  source: 'scan',
  caption: options.caption,
  desktop: { file: `/points/${name}/desktop.bin`, count: sets.desktop.length / 3 },
  mobile: { file: `/points/${name}/mobile.bin`, count: sets.mobile.length / 3 },
  bounds: { min: min.map(round), max: max.map(round) },
  path,
};
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`ply-to-points: ${count.toLocaleString('en-US')} points from ${input}`);
console.log(`  desktop  ${manifest.desktop.count.toLocaleString('en-US')}  mobile  ${manifest.mobile.count.toLocaleString('en-US')}`);
console.log(`  manifest src/data/points/${name}.json`);
