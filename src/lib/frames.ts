/**
 * Scroll-scrubbed image sequences, drawn to a canvas.
 *
 * FIG. 01, 02 and 15 all scrub footage with the scroll. Frames go to a canvas
 * rather than seeking a <video>, because video seeking is unreliable when
 * scrolling backwards (docs/storyboard.md, build stack).
 *
 * Frames come from scripts/extract-frames.sh, which writes the images to
 * public/sequences/<name>/ and the manifest to src/data/sequences/<name>.json.
 *
 * Client-safe: no Node imports. Build-time validation lives in
 * src/data/sequences/index.ts.
 */

export interface SequenceVariant {
  count: number;
  width: number;
  height: number;
  /** Frame URL with `{i}` standing in for the zero-padded frame index. */
  pattern: string;
  pad: number;
}

export interface SequenceManifest {
  name: string;
  /** 'placeholder' until real footage replaces it. The component labels it. */
  source: 'placeholder' | 'footage';
  /** Describes what the frames actually show, so it changes with the footage. */
  alt: string;
  desktop: SequenceVariant;
  /** Fewer, smaller frames for phones — a storyboard non-negotiable. */
  mobile: SequenceVariant;
  /** First frame: shown until the canvas takes over. */
  poster: string;
  /** Last frame: the calm, static version for reduced motion. */
  still: string;
}

/** A box normalised to 0–1 of the frame, plus the detector's confidence. */
export type Detection = [x: number, y: number, w: number, h: number, confidence: number];

export interface DetectionTrack {
  /** Class label drawn on the box, e.g. 'person'. */
  label: string;
  /** One entry per frame of the source clip; null where nothing was detected. */
  frames: Array<Detection | null>;
}

/** Frames fetched at once. Enough to fill HTTP/2 without starving the page. */
const CONCURRENCY = 6;

/**
 * Coarse-to-fine load order: the first and last frames, then every 64th, 32nd,
 * and so on down to every frame. A fast early scroll still shows motion, just
 * at lower temporal resolution, instead of stalling on a gap.
 */
export function loadOrder(count: number): number[] {
  const order: number[] = [];
  const seen = new Uint8Array(count);
  const push = (index: number) => {
    if (index >= 0 && index < count && !seen[index]) {
      seen[index] = 1;
      order.push(index);
    }
  };

  push(0);
  push(count - 1);

  let stride = 1;
  while (stride * 2 < count) stride *= 2;
  for (; stride >= 1; stride /= 2) {
    for (let index = 0; index < count; index += stride) push(index);
  }

  return order;
}

/** Loads one variant's frames and hands back whichever is nearest to hand. */
export class FrameSequence {
  readonly count: number;
  private readonly variant: SequenceVariant;
  private readonly images: Array<HTMLImageElement | undefined>;
  private started = false;

  constructor(variant: SequenceVariant) {
    this.variant = variant;
    this.count = variant.count;
    this.images = new Array(variant.count);
  }

  url(index: number): string {
    return this.variant.pattern.replace(
      '{i}',
      String(index).padStart(this.variant.pad, '0'),
    );
  }

  /** Starts loading; calls `onLoad` as each frame decodes. Safe to call twice. */
  load(onLoad: (index: number) => void): void {
    if (this.started) return;
    this.started = true;

    const queue = loadOrder(this.count);
    const next = () => {
      const index = queue.shift();
      if (index === undefined) return;

      const image = new Image();
      image.decoding = 'async';
      image.src = this.url(index);
      image
        .decode()
        .then(
          () => {
            this.images[index] = image;
            onLoad(index);
          },
          // A broken frame is skipped; nearest() fills the gap from its neighbours.
          () => {},
        )
        .finally(next);
    };

    for (let lane = 0; lane < CONCURRENCY; lane++) next();
  }

  /** The loaded frame closest to `index`, or undefined before any has loaded. */
  nearest(index: number): { image: HTMLImageElement; index: number } | undefined {
    for (let distance = 0; distance < this.count; distance++) {
      const before = this.images[index - distance];
      if (before) return { image: before, index: index - distance };
      const after = this.images[index + distance];
      if (after) return { image: after, index: index + distance };
    }
    return undefined;
  }
}

/** Draws a sequence into a canvas, cover-fitted, with an optional detection box. */
export class ScrubRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sequence: FrameSequence;
  private readonly detections: DetectionTrack | undefined;
  private readonly colours: { signal: string; paper: string; mono: string };
  private frame = 0;
  private drawn: HTMLImageElement | undefined;
  private dpr = 1;

  constructor(
    canvas: HTMLCanvasElement,
    sequence: FrameSequence,
    detections?: DetectionTrack,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is unavailable');

    this.canvas = canvas;
    this.ctx = ctx;
    this.sequence = sequence;
    this.detections = detections;

    // The robot-vision layer uses the site's own tokens, not hard-coded colours.
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;
    this.colours = {
      signal: token('--signal', '#ff4f00'),
      paper: token('--paper', '#f2efe8'),
      mono: token('--font-mono', 'monospace'),
    };
  }

  /** Matches the backing store to the canvas's displayed size. Call draw() after. */
  resize(): void {
    // Capped at 2: a 3x backing store on a phone costs memory for no visible gain.
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.canvas.clientWidth * this.dpr);
    const height = Math.round(this.canvas.clientHeight * this.dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.drawn = undefined;
  }

  /** Scroll progress in 0–1 across the scrub. */
  setProgress(progress: number): void {
    const clamped = Math.min(Math.max(progress, 0), 1);
    this.frame = Math.round(clamped * (this.sequence.count - 1));
    this.draw();
  }

  /** Draws the current frame if it changed. True once anything is on screen. */
  draw(): boolean {
    const found = this.sequence.nearest(this.frame);
    if (!found) return false;
    if (found.image === this.drawn) return true;

    const { width: cw, height: ch } = this.canvas;
    if (!cw || !ch) return false;

    const { image, index } = found;
    const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    // Cover-fit fills the canvas, so the previous frame and its box are gone.
    this.ctx.drawImage(image, dx, dy, dw, dh);
    // Keyed to the frame actually drawn, so the box stays on the subject even
    // while nearest() is standing in for a frame that has not loaded.
    this.drawDetection(index, dx, dy, dw, dh);

    this.drawn = image;
    return true;
  }

  private drawDetection(
    index: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    const track = this.detections;
    if (!track || track.frames.length === 0) return;

    // The track has its own frame count; line the two up by position in the clip.
    const position = this.sequence.count > 1 ? index / (this.sequence.count - 1) : 0;
    const detection = track.frames[Math.round(position * (track.frames.length - 1))];
    if (!detection) return;

    const [x, y, w, h, confidence] = detection;
    const { ctx, dpr, colours } = this;
    const line = 2 * dpr;
    const bx = dx + x * dw;
    const by = dy + y * dh;

    ctx.lineWidth = line;
    ctx.strokeStyle = colours.signal;
    ctx.strokeRect(bx, by, w * dw, h * dh);

    const text = `${track.label} ${confidence.toFixed(2)}`;
    const size = 11 * dpr;
    const pad = 4 * dpr;
    ctx.font = `${size}px ${colours.mono}`;
    const tagWidth = ctx.measureText(text).width + pad * 2;
    const tagHeight = size + pad * 2;
    // Above the box, or tucked inside it when the box meets the top edge.
    const tagY = by - tagHeight >= 0 ? by - tagHeight : by;
    const tagX = bx - line / 2;

    ctx.fillStyle = colours.signal;
    ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
    ctx.fillStyle = colours.paper;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, tagX + pad, tagY + tagHeight / 2);
  }
}
