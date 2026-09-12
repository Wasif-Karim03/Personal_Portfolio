/**
 * The stage: the one canvas the opening is drawn on, and the one set of dots
 * that travels across it.
 *
 * Both scenes write here — the hero says how far the name has broken up, the
 * flight scene says how far the globe has gathered and flown — so the dots that
 * leave his name are the dots that become the Earth. Nothing else owns them.
 */
import pointsJson from '../data/story-points.json';
import { createStoryScene, type Overlays, type Phases, type StoryPoints, type StoryScene } from './story-scene';

const data = pointsJson as unknown as StoryPoints;

let scene: StoryScene | null = null;
let opening: Promise<StoryScene | null> | null = null;
const beats: Phases = { enter: 0, scatter: 0, assemble: 0, flight: 0, morph: 0, fade: 0, machine: 0, word: 0, plan: 0 };

/**
 * Chapter 04's shape: the path a request takes through the system, drawn as
 * outlines so the dots trace edges rather than filling boxes in. Wide screens
 * lay it left to right; narrow ones stack it. The six ticks over the middle are
 * the six endpoints.
 */
function requestPath(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const wide = w >= 960;
  const boxW = wide ? w * 0.17 : w * 0.56;
  const boxH = wide ? h * 0.15 : h * 0.1;
  const xs = wide ? [w * 0.25, w * 0.5, w * 0.75] : [w * 0.5, w * 0.5, w * 0.5];
  const ys = wide ? [h * 0.45, h * 0.45, h * 0.45] : [h * 0.26, h * 0.44, h * 0.62];
  const edge = Math.max(2, Math.min(boxW, boxH) * 0.055);

  const box = (x: number, y: number) => {
    const radius = Math.min(boxW, boxH) * 0.16;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, radius);
    ctx.fill();
    // Punch the middle out, so what is left is the outline.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect(x - boxW / 2 + edge, y - boxH / 2 + edge, boxW - 2 * edge, boxH - 2 * edge, Math.max(radius - edge, 1));
    ctx.fill();
    ctx.restore();
  };

  // The run between one box and the next.
  for (let i = 0; i < 2; i++) {
    if (wide) ctx.fillRect(xs[i] + boxW / 2, ys[i] - edge / 2, xs[i + 1] - xs[i] - boxW, edge);
    else ctx.fillRect(xs[i] - edge / 2, ys[i] + boxH / 2, edge, ys[i + 1] - ys[i] - boxH);
  }
  for (let i = 0; i < 3; i++) box(xs[i], ys[i]);

  // Six endpoints, ticked against the middle of the path. Laid out left to
  // right there is room above the boxes; stacked there is not — that space
  // belongs to the labels — so the ticks stand alongside instead.
  const tick = Math.max(2, edge);
  if (wide) {
    const tall = boxH * 0.32;
    const gap = boxW / 7;
    for (let i = 0; i < 6; i++) {
      const x = xs[1] - boxW / 2 + gap * (i + 1) - tick / 2;
      ctx.fillRect(x, ys[1] - boxH / 2 - tall - boxH * 0.22, tick, tall);
    }
  } else {
    const long = boxW * 0.17;
    const gap = boxH / 7;
    for (let i = 0; i < 6; i++) {
      const y = ys[1] - boxH / 2 + gap * (i + 1) - tick / 2;
      ctx.fillRect(xs[1] + boxW / 2 + boxW * 0.07, y, long, tick);
    }
  }
}

export function stageCanvas(): HTMLCanvasElement | null {
  return document.querySelector<HTMLCanvasElement>('[data-stage-dots]');
}

export function hasWebGL(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/** Builds the scene on the stage canvas, once. Resolves null if it cannot. */
export function openStage(): Promise<StoryScene | null> {
  if (opening) return opening;
  opening = (async () => {
    const canvas = stageCanvas();
    const plane = document.querySelector<HTMLElement>('[data-plane]');
    const from = document.querySelector<HTMLElement>('[data-city-from]');
    const to = document.querySelector<HTMLElement>('[data-city-to]');
    if (!canvas || !plane || !from || !to || !hasWebGL()) return null;
    try {
      const overlays: Overlays = { plane, from, to };
      // Portrait stacks the two words, as the heading does.
      const portrait = matchMedia('(max-aspect-ratio: 4/5)').matches;
      const face = "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif";
      // The sampled letterforms are only his if the display face has arrived.
      await document.fonts.load(`850 100px ${face}`).catch(() => {});
      await document.fonts.ready;
      scene = await createStoryScene(
        canvas,
        data,
        matchMedia('(max-width: 48rem)').matches ? 'mobile' : 'desktop',
        overlays,
        { lines: portrait ? ['Wasif', 'Karim'] : ['Wasif Karim'], weight: 850, family: face },
        // Chapter 03 opens on these, set in the same face as his name.
        { lines: ['git init'], weight: 850, family: face },
        requestPath,
      );
      scene.set(beats);
      window.addEventListener('resize', () => scene?.resize());
      return scene;
    } catch (error) {
      console.warn('story stage unavailable', error);
      canvas.hidden = true;
      return null;
    }
  })();
  return opening;
}

/** Moves the beats this scene owns; the rest stay where they were. */
export function setStage(part: Partial<Phases>): void {
  Object.assign(beats, part);
  scene?.set(beats);
}

/** Writes the name in, dot by dot. Runs once, when the loader lifts. */
export function enterStage(duration = 1700): void {
  const start = performance.now();
  const step = () => {
    const t = Math.min((performance.now() - start) / duration, 1);
    setStage({ enter: t });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
