/**
 * The shapes the point cloud takes, scene by scene.
 *
 * Three come from files built by scripts/make-clouds.mjs: the two portraits,
 * made from real photos, and the globe. The rest are built here from simple
 * geometry and text, in the browser, so they cost no download: a few
 * milliseconds each, made when first needed.
 *
 * Every cloud has the same number of points, so any shape can become any other
 * point for point. The points are shuffled, so each travels to a random place
 * in the next shape and the change reads as the cloud reassembling.
 *
 * Coordinates: y up, x right, z toward the viewer, within about [-1, 1].
 * Colours are RGBA bytes, where A is the reveal order: 0 is always shown, and
 * 1–255 appear as the scene's scroll progress passes A / 255.
 */

export type Vec3 = [number, number, number];
type RGB = readonly [number, number, number];
type Rand = () => number;
type Sampler = (r: Rand) => Vec3;
type Axis = 'x' | 'y' | 'z';

export type Variant = 'desktop' | 'mobile';

export interface Detection {
  label: string;
  score: number;
  /** Left, top, right, bottom, in cloud coordinates. */
  box: [number, number, number, number];
}

export interface Cloud {
  positions: Float32Array;
  colors: Uint8Array;
  /** 0 for the empty stage, where the points drift out and fade. */
  opacity: number;
  /** For portraits: the detector's box around the person in the source photo. */
  detection?: Detection;
}

export interface CloudManifest {
  counts: Record<Variant, number>;
  shapes: Record<string, { files: Record<Variant, string>; detection?: Detection }>;
}

const INK: RGB = [20, 20, 20];
const INK_60: RGB = [109, 108, 105];
const INK_30: RGB = [175, 173, 168];
const FAINT: RGB = [210, 207, 200];
const SIGNAL: RGB = [255, 79, 0];
const BEAM: RGB = [255, 168, 128];

const DISPLAY = '"Archivo Variable", "Arial Narrow", Arial, sans-serif';
const MONO = '"Chivo Mono Variable", ui-monospace, Menlo, monospace';

function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: Rand): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, times(sub(b, a), t));
const pick = <T>(r: Rand, items: readonly T[]): T => items[Math.floor(r() * items.length)];
const either = (a: RGB, b: RGB, chanceOfA: number) => (r: Rand): RGB => (r() < chanceOfA ? a : b);

/** Local (across, along, across) to world, with `along` on the given axis. */
function orient(axis: Axis, a: number, h: number, b: number): Vec3 {
  return axis === 'y' ? [a, h, b] : axis === 'x' ? [h, a, b] : [a, b, h];
}

function direction(r: Rand): Vec3 {
  const y = 2 * r() - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - y * y);
  return [Math.cos(a) * s, y, Math.sin(a) * s];
}

// Samplers: each returns one random point on a surface, line or region.

function box(c: Vec3, [w, h, d]: Vec3): Sampler {
  const faces = [w * h, w * h, w * d, w * d, h * d, h * d];
  const total = faces.reduce((sum, f) => sum + f, 0);
  return (r) => {
    let at = r() * total;
    let face = 0;
    while (face < 5 && at > faces[face]) at -= faces[face++];
    const u = r() - 0.5;
    const v = r() - 0.5;
    const side = face % 2 === 0 ? 0.5 : -0.5;
    const local: Vec3 =
      face < 2 ? [u * w, v * h, side * d] : face < 4 ? [u * w, side * h, v * d] : [side * w, u * h, v * d];
    return add(c, local);
  };
}

function boxEdges(c: Vec3, [w, h, d]: Vec3): Sampler {
  const lengths = [w, h, d];
  const total = w + h + d;
  return (r) => {
    let at = r() * total;
    let axis = 0;
    while (axis < 2 && at > lengths[axis]) at -= lengths[axis++];
    const a = r() < 0.5 ? -0.5 : 0.5;
    const b = r() < 0.5 ? -0.5 : 0.5;
    const t = r() - 0.5;
    const local: Vec3 = axis === 0 ? [t * w, a * h, b * d] : axis === 1 ? [a * w, t * h, b * d] : [a * w, b * h, t * d];
    return add(c, local);
  };
}

function cylinder(c: Vec3, radius: number, height: number, axis: Axis = 'y'): Sampler {
  return (r) => {
    const a = r() * Math.PI * 2;
    return add(c, orient(axis, Math.cos(a) * radius, (r() - 0.5) * height, Math.sin(a) * radius));
  };
}

function disk(c: Vec3, radius: number, axis: Axis = 'y', inner = 0): Sampler {
  return (r) => {
    const a = r() * Math.PI * 2;
    const rad = Math.sqrt(inner * inner + r() * (radius * radius - inner * inner));
    return add(c, orient(axis, Math.cos(a) * rad, 0, Math.sin(a) * rad));
  };
}

const ring = (c: Vec3, radius: number, axis: Axis = 'y') => disk(c, radius, axis, radius * 0.96);

function sphere(c: Vec3, radius: number, keep: (p: Vec3) => boolean = () => true): Sampler {
  return (r) => {
    for (let tries = 0; tries < 60; tries++) {
      const p = times(direction(r), radius);
      if (keep(p)) return add(c, p);
    }
    return add(c, [0, radius, 0]);
  };
}

function segment(a: Vec3, b: Vec3, dashes = 0): Sampler {
  return (r) => {
    let t = r();
    while (dashes && (t * dashes) % 1 > 0.55) t = r();
    return lerp(a, b, t);
  };
}

function curve(f: (t: number) => Vec3, thickness = 0): Sampler {
  return (r) => add(f(r()), [gauss(r) * thickness, gauss(r) * thickness, gauss(r) * thickness]);
}

function onPlane(o: Vec3, u: Vec3, v: Vec3, s: number, t: number, bend: number): Vec3 {
  const p = add(add(o, times(u, s)), times(v, t));
  p[2] -= bend * (2 * s - 1) ** 2;
  return p;
}

function plane(o: Vec3, u: Vec3, v: Vec3, bend = 0): Sampler {
  return (r) => onPlane(o, u, v, r(), r(), bend);
}

function outline(o: Vec3, u: Vec3, v: Vec3): Sampler {
  return (r) => {
    const t = r();
    return pick(r, [
      () => add(o, times(u, t)),
      () => add(add(o, v), times(u, t)),
      () => add(o, times(v, t)),
      () => add(add(o, u), times(v, t)),
    ])();
  };
}

function triangle(a: Vec3, b: Vec3, c: Vec3): Sampler {
  return (r) => {
    let u = r();
    let v = r();
    if (u + v > 1) [u, v] = [1 - u, 1 - v];
    return add(a, add(times(sub(b, a), u), times(sub(c, a), v)));
  };
}

// Rasters: text and outlines drawn on a 2D canvas, then sampled onto a plane.

interface Mask {
  w: number;
  h: number;
  pixels: Uint32Array;
}

function mask(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Mask {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { w, h, pixels: new Uint32Array(0) };
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  draw(ctx);
  const { data } = ctx.getImageData(0, 0, w, h);
  const hits: number[] = [];
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 110) hits.push(i);
  return { w, h, pixels: Uint32Array.from(hits) };
}

function font(ctx: CanvasRenderingContext2D, weight: number, size: number, family: string, condensed = false) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fontStretch = condensed ? 'condensed' : 'normal';
}

/** A mask laid on a plane: from `topLeft`, `across` its width and `down` its height. */
function raster(m: Mask, topLeft: Vec3, across: Vec3, down: Vec3, bend = 0): Sampler {
  return (r) => {
    if (m.pixels.length === 0) return topLeft;
    const i = m.pixels[Math.floor(r() * m.pixels.length)];
    return onPlane(topLeft, across, down, ((i % m.w) + r()) / m.w, (Math.floor(i / m.w) + r()) / m.h, bend);
  };
}

interface Part {
  weight: number;
  sample: Sampler;
  color: RGB | ((r: Rand) => RGB);
  order?: (r: Rand) => number;
}

interface Placement {
  /** Radians about x, y and z. Applied z, then x, then y. */
  rotate?: Vec3;
  scale?: number;
  offset?: Vec3;
  jitter?: number;
}

function build(count: number, seed: number, parts: Part[], placement: Placement = {}): Cloud {
  const r = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 4);
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  const [rx, ry, rz] = placement.rotate ?? [0, 0, 0];
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const k = placement.scale ?? 1;
  const [ox, oy, oz] = placement.offset ?? [0, 0, 0];
  const jitter = placement.jitter ?? 0.004;

  let i = 0;
  parts.forEach((part, index) => {
    const quota =
      index === parts.length - 1 ? count - i : Math.min(count - i, Math.round((count * part.weight) / total));
    for (let n = 0; n < quota; n++, i++) {
      let [x, y, z] = part.sample(r);
      x += gauss(r) * jitter;
      y += gauss(r) * jitter;
      z += gauss(r) * jitter;
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      positions[i * 3] = x * k + ox;
      positions[i * 3 + 1] = y * k + oy;
      positions[i * 3 + 2] = z * k + oz;
      const c = typeof part.color === 'function' ? part.color(r) : part.color;
      colors[i * 4] = c[0];
      colors[i * 4 + 1] = c[1];
      colors[i * 4 + 2] = c[2];
      colors[i * 4 + 3] = part.order ? part.order(r) : 0;
    }
  });

  for (let a = count - 1; a > 0; a--) {
    const b = Math.floor(r() * (a + 1));
    for (let c = 0; c < 3; c++) [positions[a * 3 + c], positions[b * 3 + c]] = [positions[b * 3 + c], positions[a * 3 + c]];
    for (let c = 0; c < 4; c++) [colors[a * 4 + c], colors[b * 4 + c]] = [colors[b * 4 + c], colors[a * 4 + c]];
  }
  return { positions, colors, opacity: 1 };
}

/** A sheet of paper, 8.5 × 11, for the letter and the resume. */
const SHEET = { W: 850, H: 1100, topLeft: [-0.65, 0.84, 0] as Vec3, across: [1.3, 0, 0] as Vec3, down: [0, -1.68, 0] as Vec3 };
const onSheet = (m: Mask) => raster(m, SHEET.topLeft, SHEET.across, SHEET.down, 0.1);
const sheetBorder = () => mask(SHEET.W, SHEET.H, (ctx) => {
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, SHEET.W - 8, SHEET.H - 8);
});

const shapes: Record<string, (count: number) => Cloud> = {
  /** The empty stage: points out past the edges, faded. */
  none: (count) => ({
    ...build(count, 3, [{ weight: 1, sample: (r) => times(direction(r), 2.6 + r() * 1.6), color: INK_30 }]),
    opacity: 0,
  }),

  /** FIG. 02: a spiral winding back, for time running in reverse. */
  rewind: (count) => {
    const arm: Sampler = (r) => {
      const t = r();
      const a = t * Math.PI * 9 + Math.floor(r() * 3) * ((Math.PI * 2) / 3) + gauss(r) * 0.1;
      const rad = 0.12 + 0.88 * t + gauss(r) * 0.025;
      return [Math.cos(a) * rad, Math.sin(a) * rad, (0.5 - t) * 1.4];
    };
    return build(count, 11, [
      { weight: 0.95, sample: arm, color: either(INK, INK_60, 0.4) },
      { weight: 0.05, sample: arm, color: SIGNAL },
    ], { rotate: [0.65, 0.3, 0], scale: 0.95 });
  },

  /** FIG. 03: the acceptance letter. */
  letter: (count) => {
    const { W, H } = SHEET;
    const bars: Array<[number, number, boolean]> = [
      [300, 180, false], [350, 690, false], [380, 660, false], [410, 480, true], [440, 670, false], [470, 380, false],
      [530, 690, false], [560, 650, false], [590, 450, true], [620, 670, false], [650, 280, false],
      [720, 180, false], [800, 240, false],
    ];
    const head = mask(W, H, (ctx) => {
      ctx.textAlign = 'center';
      font(ctx, 700, 66, DISPLAY, true);
      ctx.fillText('OHIO WESLEYAN UNIVERSITY', W / 2, 128);
      font(ctx, 400, 22, MONO);
      ctx.fillText('DELAWARE, OHIO', W / 2, 165);
      ctx.fillRect(80, 192, W - 160, 3);
      ctx.textAlign = 'right';
      ctx.fillText('2022', W - 80, 245);
    });
    const text = mask(W, H, (ctx) => bars.forEach(([y, w, mark]) => !mark && ctx.fillRect(80, y, w, 12)));
    const marks = mask(W, H, (ctx) => bars.forEach(([y, w, mark]) => mark && ctx.fillRect(80, y, w, 12)));
    return build(count, 21, [
      { weight: 0.1, sample: onSheet(sheetBorder()), color: INK },
      // Dense enough on the letterhead that the university's name reads.
      { weight: 0.28, sample: onSheet(head), color: INK },
      { weight: 0.18, sample: onSheet(text), color: INK_60 },
      { weight: 0.1, sample: onSheet(marks), color: SIGNAL },
      { weight: 0.34, sample: plane(SHEET.topLeft, SHEET.across, SHEET.down, 0.1), color: FAINT },
    ], { rotate: [-0.06, -0.26, 0.02] });
  },

  /** FIG. 05: Ohio Wesleyan's student observatory, for the astrophysics degree. */
  observatory: (count) => {
    const dome: Vec3 = [0, 0.26, 0.05];
    const R = 0.44;
    const slitEdge = (t: number): Vec3 => {
      const x = t < 0.5 ? -0.05 : 0.05;
      const angle = ((t * 2) % 1) * (Math.PI / 2);
      const rr = Math.sqrt(R * R - x * x);
      return [x, dome[1] + rr * Math.sin(angle), dome[2] + rr * Math.cos(angle)];
    };
    const windows: Sampler = (r) => [pick(r, [-0.72, -0.52, 0.52, 0.72]) + (r() - 0.5) * 0.1, -0.52 + (r() - 0.5) * 0.2, 0.402];
    return build(count, 31, [
      { weight: 0.2, sample: box([0, -0.52, 0], [1.7, 0.46, 0.8]), color: INK_60 },
      { weight: 0.07, sample: boxEdges([0, -0.52, 0], [1.7, 0.46, 0.8]), color: INK },
      { weight: 0.05, sample: box([0, -0.27, 0], [1.78, 0.04, 0.88]), color: INK },
      { weight: 0.04, sample: windows, color: INK },
      { weight: 0.14, sample: cylinder([0, -0.02, 0.05], 0.42, 0.52), color: INK_60 },
      { weight: 0.03, sample: ring([0, 0.24, 0.05], 0.5), color: INK },
      { weight: 0.02, sample: ring([0, -0.28, 0.05], 0.42), color: INK },
      { weight: 0.2, sample: sphere(dome, R, (p) => p[1] >= 0 && !(Math.abs(p[0]) < 0.05 && p[2] > 0)), color: either(INK_30, INK_60, 0.6) },
      { weight: 0.03, sample: curve(slitEdge), color: INK },
      { weight: 0.02, sample: plane([-0.08, -0.28, 0.472], [0.16, 0, 0], [0, 0.24, 0]), color: INK },
      { weight: 0.02, sample: box([0, -0.77, 0.5], [0.5, 0.05, 0.2]), color: INK_60 },
      { weight: 0.08, sample: disk([0, -0.8, 0], 1.25), color: FAINT },
      { weight: 0.03, sample: sphere([0, 0, 0], 1.75, (p) => p[2] < -0.3 && p[1] > -0.2), color: either(INK_30, SIGNAL, 0.93) },
    ], { rotate: [0.2, -0.55, 0], scale: 0.95, offset: [0, 0.08, 0] });
  },

  /** FIG. 06: a club rover, LiDAR on the mast. */
  rover: (count) => {
    const wheels: Vec3[] = [[0.52, -0.1, 0.47], [0.52, -0.1, -0.47], [-0.52, -0.1, 0.47], [-0.52, -0.1, -0.47]];
    const tire: Sampler = (r) => cylinder(pick(r, wheels), 0.24, 0.16, 'z')(r);
    const hub: Sampler = (r) => {
      const [x, y, z] = pick(r, wheels);
      return disk([x, y, z + Math.sign(z) * 0.08], 0.13, 'z')(r);
    };
    return build(count, 41, [
      { weight: 0.17, sample: box([0, 0, 0], [1.3, 0.2, 0.78]), color: INK_60 },
      { weight: 0.06, sample: boxEdges([0, 0, 0], [1.3, 0.2, 0.78]), color: INK },
      { weight: 0.05, sample: box([0.08, 0.14, 0], [0.34, 0.08, 0.26]), color: INK },
      { weight: 0.03, sample: box([-0.36, 0.13, 0.18], [0.3, 0.06, 0.2]), color: INK_60 },
      { weight: 0.26, sample: tire, color: INK },
      { weight: 0.06, sample: hub, color: INK_60 },
      { weight: 0.02, sample: cylinder([-0.3, 0.36, 0], 0.025, 0.44), color: INK },
      { weight: 0.06, sample: cylinder([-0.3, 0.62, 0], 0.14, 0.1), color: SIGNAL },
      { weight: 0.02, sample: disk([-0.3, 0.67, 0], 0.14), color: SIGNAL },
      { weight: 0.01, sample: box([0.66, 0.08, 0], [0.05, 0.07, 0.18]), color: SIGNAL },
      { weight: 0.01, sample: segment([0.45, 0.12, -0.3], [0.45, 0.58, -0.34]), color: INK },
      { weight: 0.06, sample: disk([0, -0.35, 0], 1.0), color: FAINT },
    ], { rotate: [0.3, 0.65, 0], scale: 1.1, offset: [0, -0.05, 0] });
  },

  /** FIG. 07: a laptop, the first commit on its screen. */
  laptop: (count) => {
    const hinge: Vec3 = [-0.75, -0.42, -0.25];
    const across: Vec3 = [1.5, 0, 0];
    const up: Vec3 = [0, 0.95, -0.3];
    const screenTop = add(hinge, up);
    const log = mask(900, 560, (ctx) => {
      font(ctx, 400, 40, MONO);
      ['$ git log --reverse', 'commit 0000001', 'Author: Wasif Karim', 'Date:   Summer 2023'].forEach((line, i) =>
        ctx.fillText(line, 40, 70 + i * 56),
      );
    });
    const subject = mask(900, 560, (ctx) => {
      font(ctx, 700, 96, DISPLAY, true);
      ctx.fillText('Initial commit', 110, 450);
    });
    const onScreen = (m: Mask) => raster(m, add(add(screenTop, times(across, 0.05)), times(up, -0.06)), times(across, 0.9), times(up, -0.86));
    const keys: Sampler = (r) => {
      const col = Math.floor(r() * 12);
      const row = Math.floor(r() * 4);
      return [-0.62 + (col + 0.15 + r() * 0.7) * (1.24 / 12), -0.42, -0.08 + (row + 0.15 + r() * 0.7) * (0.42 / 4)];
    };
    return build(count, 51, [
      { weight: 0.1, sample: box([0, -0.45, 0.25], [1.5, 0.05, 1.0]), color: INK_60 },
      { weight: 0.04, sample: boxEdges([0, -0.45, 0.25], [1.5, 0.05, 1.0]), color: INK },
      { weight: 0.1, sample: keys, color: INK },
      { weight: 0.02, sample: outline([-0.22, -0.42, 0.45], [0.44, 0, 0], [0, 0, 0.23]), color: INK },
      { weight: 0.2, sample: plane(hinge, across, up), color: FAINT },
      { weight: 0.06, sample: outline(hinge, across, up), color: INK },
      { weight: 0.14, sample: onScreen(log), color: INK_60 },
      { weight: 0.1, sample: onScreen(subject), color: SIGNAL },
    ], { rotate: [0.25, -0.5, 0], scale: 1.1, offset: [0, 0.1, 0] });
  },

  /** FIG. 08: app, endpoint, database, and the request between them. */
  api: (count) => {
    const cans: Vec3[] = [[1, -0.2, 0], [1, 0, 0], [1, 0.2, 0]];
    const rack: Sampler = (r) => [-0.2 + 0.4 * r(), -0.2 + 0.15 * Math.floor(r() * 4), 0.252];
    return build(count, 61, [
      { weight: 0.08, sample: box([-1, 0, 0], [0.36, 0.68, 0.06]), color: INK_60 },
      { weight: 0.03, sample: boxEdges([-1, 0, 0], [0.36, 0.68, 0.06]), color: INK },
      { weight: 0.12, sample: box([0, 0, 0], [0.5, 0.66, 0.5]), color: INK_60 },
      { weight: 0.04, sample: boxEdges([0, 0, 0], [0.5, 0.66, 0.5]), color: INK },
      { weight: 0.03, sample: rack, color: INK },
      { weight: 0.01, sample: (r) => [0.17, -0.2 + 0.15 * Math.floor(r() * 4) + 0.03, 0.26], color: SIGNAL },
      { weight: 0.12, sample: (r) => cylinder(pick(r, cans), 0.26, 0.15)(r), color: INK_60 },
      { weight: 0.04, sample: (r) => { const [x, y, z] = pick(r, cans); return ring([x, y + pick(r, [-0.075, 0.075]), z], 0.26)(r); }, color: INK },
      { weight: 0.04, sample: (r) => (r() < 0.5 ? segment([-0.82, 0.12, 0], [-0.25, 0.12, 0]) : segment([0.25, 0.12, 0], [0.74, 0.12, 0]))(r), color: INK },
      { weight: 0.03, sample: (r) => (r() < 0.5 ? segment([-0.82, -0.12, 0], [-0.25, -0.12, 0], 12) : segment([0.25, -0.12, 0], [0.74, -0.12, 0], 12))(r), color: INK_30 },
      { weight: 0.02, sample: sphere([-0.5, 0.12, 0], 0.045), color: SIGNAL },
    ], { rotate: [0.25, -0.45, 0], scale: 0.8 });
  },

  /** FIG. 09: a guest's message, and a host's reply drafting itself. */
  chat: (count) => {
    const W = 1000;
    const H = 520;
    const bubble = (fill: boolean, tailLeft: boolean) =>
      mask(W, H, (ctx) => {
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.roundRect(10, 10, W - 20, H - 110, 60);
        const x = tailLeft ? 140 : W - 140;
        ctx.moveTo(x - 40, H - 101);
        ctx.lineTo(x + (tailLeft ? -60 : 60), H - 12);
        ctx.lineTo(x + 40, H - 101);
        if (fill) ctx.fill();
        else ctx.stroke();
      });
    const lines = (rows: Array<[number, number]>) => mask(W, H, (ctx) => rows.forEach(([y, w]) => ctx.fillRect(80, y, w, 26)));
    const guest = { tl: [-1.05, 0.9, -0.3] as Vec3, across: [1.25, 0, 0] as Vec3, down: [0, -0.65, 0] as Vec3 };
    const host = { tl: [-0.3, 0.12, 0.25] as Vec3, across: [1.35, 0, 0] as Vec3, down: [0, -0.7, 0] as Vec3 };
    const onGuest = (m: Mask) => raster(m, guest.tl, guest.across, guest.down);
    const onHost = (m: Mask) => raster(m, host.tl, host.across, host.down);
    return build(count, 81, [
      { weight: 0.08, sample: onGuest(bubble(false, true)), color: INK_60 },
      { weight: 0.1, sample: onGuest(bubble(true, true)), color: FAINT },
      { weight: 0.07, sample: onGuest(lines([[90, 760], [160, 620], [230, 420]])), color: INK_30 },
      { weight: 0.1, sample: onHost(bubble(false, false)), color: INK },
      { weight: 0.12, sample: onHost(bubble(true, false)), color: FAINT },
      { weight: 0.12, sample: onHost(lines([[90, 800], [160, 700], [230, 760], [300, 330]])), color: INK },
      { weight: 0.02, sample: onHost(mask(W, H, (ctx) => ctx.fillRect(425, 292, 14, 42))), color: SIGNAL },
    ], { rotate: [0.08, -0.35, 0] });
  },

  /** FIG. 10: the git graph, in depth. */
  branches: (count) => {
    const bump = (t: number) => Math.sin(Math.PI * t) ** 0.5;
    const outward = (t: number) => 1 - (1 - Math.min(t / 0.3, 1)) ** 2;
    const main = (t: number): Vec3 => [0, 1 - 2 * t, 0];
    const intern = (t: number): Vec3 => [0.42 * bump(t), 0.55 - 1.1 * t, 0.2 * bump(t)];
    const studio = (t: number): Vec3 => [0.8 * outward(t), 0.15 - 1.15 * t, -0.25 * outward(t)];
    const commits: Vec3[] = [main(0.08), intern(0.35), studio(0.3), [0, -0.55, 0]];
    return build(count, 71, [
      { weight: 0.22, sample: curve(main, 0.012), color: INK },
      { weight: 0.18, sample: curve(intern, 0.012), color: INK_60 },
      { weight: 0.2, sample: curve(studio, 0.012), color: INK_60 },
      { weight: 0.12, sample: (r) => sphere(pick(r, commits), 0.05)(r), color: INK },
      { weight: 0.03, sample: ring([0, -0.55, 0], 0.09, 'z'), color: INK },
      { weight: 0.05, sample: sphere(studio(1), 0.06), color: SIGNAL },
      { weight: 0.2, sample: curve(main, 0.07), color: FAINT },
    ], { rotate: [0.12, -0.75, 0], scale: 0.95 });
  },

  /** FIG. 12: the volumetric printer, a part curing inside the turning vial. */
  printer: (count) => {
    const vial: Vec3 = [0.25, 0, 0];
    const knot: Sampler = (r) => {
      const t = r() * Math.PI * 2;
      const rr = Math.cos(3 * t) + 2;
      return add(vial, [rr * Math.cos(2 * t) * 0.065 + gauss(r) * 0.022, -Math.sin(3 * t) * 0.15 + gauss(r) * 0.022, rr * Math.sin(2 * t) * 0.065 + gauss(r) * 0.022]);
    };
    const resin: Sampler = (r) => {
      const a = r() * Math.PI * 2;
      const rad = 0.28 * Math.sqrt(r());
      return add(vial, [Math.cos(a) * rad, (r() - 0.5) * 0.96, Math.sin(a) * rad]);
    };
    const beam: Sampler = (r) => {
      const t = r();
      const a = r() * Math.PI * 2;
      const rad = 0.26 * t * Math.sqrt(r());
      return [-0.5 + 0.45 * t, Math.cos(a) * rad, Math.sin(a) * rad];
    };
    return build(count, 91, [
      { weight: 0.12, sample: cylinder(vial, 0.3, 1.0), color: INK_30 },
      { weight: 0.02, sample: ring(add(vial, [0, 0.5, 0]), 0.3), color: INK },
      { weight: 0.02, sample: ring(add(vial, [0, -0.5, 0]), 0.3), color: INK },
      { weight: 0.08, sample: resin, color: FAINT },
      // Cures all at once, as the printer does, while the scene scrolls past.
      { weight: 0.22, sample: knot, color: SIGNAL, order: (r) => 1 + Math.floor(r() * 254) },
      { weight: 0.06, sample: disk(add(vial, [0, -0.56, 0]), 0.4), color: INK_60 },
      { weight: 0.03, sample: cylinder([0.25, -0.7, 0], 0.12, 0.2), color: INK_60 },
      { weight: 0.08, sample: box([-0.8, 0, 0], [0.44, 0.32, 0.34]), color: INK_60 },
      { weight: 0.04, sample: boxEdges([-0.8, 0, 0], [0.44, 0.32, 0.34]), color: INK },
      { weight: 0.02, sample: cylinder([-0.54, 0, 0], 0.08, 0.08, 'x'), color: INK },
      { weight: 0.06, sample: beam, color: BEAM },
      { weight: 0.06, sample: box([-0.25, -0.84, 0], [1.7, 0.04, 0.7]), color: INK_60 },
    ], { rotate: [0.22, 0.5, 0] });
  },

  /** FIG. 15: the resume, with the download mark in the corner. */
  resume: (count) => {
    const { W, H } = SHEET;
    const sections = [
      { y: 270, lines: 3 },
      { y: 420, lines: 2 },
      { y: 530, lines: 9 },
      { y: 860, lines: 3 },
    ];
    const head = mask(W, H, (ctx) => {
      font(ctx, 700, 100, DISPLAY, true);
      ctx.fillText('WASIF KARIM', 80, 150);
      font(ctx, 400, 20, MONO);
      ctx.fillText('CLEVELAND, OH · WASIFKARIM.COM', 80, 190);
      ctx.fillRect(80, 215, W - 160, 3);
    });
    const headings = mask(W, H, (ctx) => sections.forEach(({ y }) => ctx.fillRect(80, y, 170, 16)));
    const text = mask(W, H, (ctx) =>
      sections.forEach(({ y, lines }) => {
        for (let n = 0; n < lines; n++) ctx.fillRect(80, y + 40 + n * 28, 380 + ((n * 137 + y) % 300), 10);
      }),
    );
    const download = mask(W, H, (ctx) => {
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(720, 900);
      ctx.lineTo(720, 1000);
      ctx.moveTo(680, 960);
      ctx.lineTo(720, 1000);
      ctx.lineTo(760, 960);
      ctx.stroke();
      ctx.fillRect(670, 1022, 100, 12);
    });
    return build(count, 111, [
      { weight: 0.08, sample: onSheet(sheetBorder()), color: INK },
      { weight: 0.18, sample: onSheet(head), color: INK },
      { weight: 0.06, sample: onSheet(headings), color: INK },
      { weight: 0.22, sample: onSheet(text), color: INK_60 },
      { weight: 0.06, sample: onSheet(download), color: SIGNAL },
      { weight: 0.4, sample: plane(SHEET.topLeft, SHEET.across, SHEET.down, 0.1), color: FAINT },
    ], { rotate: [-0.08, 0.42, 0.02] });
  },

  /** FIG. 16: an open envelope, a letter coming out. */
  envelope: (count) => {
    const W = 1000;
    const H = 640;
    const body = { tl: [-0.8, 0.2, 0] as Vec3, across: [1.6, 0, 0] as Vec3, down: [0, -1.02, 0] as Vec3 };
    const letter = { tl: [-0.66, 0.66, -0.06] as Vec3, across: [1.32, 0, 0] as Vec3, down: [0, -0.5, 0] as Vec3 };
    const lines = mask(W, H, (ctx) => {
      ctx.lineWidth = 9;
      ctx.strokeRect(5, 5, W - 10, H - 10);
      ctx.beginPath();
      ctx.moveTo(5, H - 5);
      ctx.lineTo(W / 2, H * 0.42);
      ctx.lineTo(W - 5, H - 5);
      ctx.stroke();
    });
    const writing = mask(W, H, (ctx) => [[120, 560], [200, 480], [280, 520]].forEach(([y, w]) => ctx.fillRect(90, y, w, 22)));
    const at = mask(W, H, (ctx) => {
      font(ctx, 700, 260, MONO);
      ctx.fillText('@', 720, 360);
    });
    const flap: [Vec3, Vec3, Vec3] = [[-0.8, 0.2, 0], [0.8, 0.2, 0], [0, 0.78, -0.32]];
    return build(count, 121, [
      { weight: 0.3, sample: plane(body.tl, body.across, body.down), color: FAINT },
      { weight: 0.2, sample: raster(lines, body.tl, body.across, body.down), color: INK },
      { weight: 0.06, sample: triangle(...flap), color: FAINT },
      { weight: 0.05, sample: (r) => (r() < 0.5 ? segment(flap[0], flap[2]) : segment(flap[1], flap[2]))(r), color: INK },
      { weight: 0.08, sample: plane(letter.tl, letter.across, letter.down), color: FAINT },
      { weight: 0.06, sample: raster(writing, letter.tl, letter.across, letter.down), color: INK_60 },
      { weight: 0.05, sample: raster(at, letter.tl, letter.across, letter.down), color: SIGNAL },
    ], { rotate: [0.18, -0.35, 0], offset: [0, 0.12, 0] });
  },
};

/** Loads a shape from its file, or builds it here. */
export async function loadShape(name: string, variant: Variant, manifest: CloudManifest): Promise<Cloud> {
  const count = manifest.counts[variant];
  const entry = manifest.shapes[name];
  if (entry) {
    const url = entry.files[variant];
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    const packed = new Int16Array(buffer, 0, count * 3);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = packed[i] / 32767;
    const colors = new Uint8Array(buffer, count * 6, count * 4).slice();
    return { positions, colors, opacity: 1, detection: entry.detection };
  }
  const make = shapes[name];
  if (!make) throw new Error(`No cloud called "${name}"`);
  // Letters and labels are drawn in the site's own faces, so wait for them.
  await document.fonts.ready;
  return make(count);
}
