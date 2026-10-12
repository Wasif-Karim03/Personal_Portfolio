/**
 * The stage: the one canvas the opening is drawn on, and the one set of dots
 * that travels across it.
 *
 * Both scenes write here — the hero says how far the name has broken up, the
 * flight scene says how far the globe has gathered and flown — so the dots that
 * leave his name are the dots that become the Earth. Nothing else owns them.
 */
import pointsJson from '../data/story-points.json';
import { createStoryScene, type Mark, type Overlays, type Phases, type StoryPoints, type StoryScene } from './story-scene';

const data = pointsJson as unknown as StoryPoints;

/**
 * Every place he has worked, in order, as the dots draw it: the real mark where
 * one exists, the name as type where the name is the mark. Leland, Hilton and
 * Airbnb have marks; think[box] sets its name as type, brackets and all, and
 * OpsiClear has none to find. See public/logos/SOURCES.md.
 */
/**
 * Each place, with the colour its dots take while it is held.
 *
 * The colours are the real ones, lifted where a literal value would not survive
 * a black page: Hilton's mark is genuinely black and its brand blue is #003087,
 * and think[box]'s panel is #062e4c — rendered literally the first is invisible
 * and the two are indistinguishable. So Hilton stays white, because its brand
 * really is monochrome, and think[box] keeps its navy's hue at a luminance that
 * reads. Colour is used where colour actually exists.
 */
const MARKS: Mark[] = [
  { kind: 'image', src: '/logos/leland.png', tint: [1.0, 0.85, 0.44] },
  { kind: 'image', src: '/logos/hilton.png', tint: [0.95, 0.94, 0.92] },
  // The Belo is an outline, so it carries less ink than the others at the same
  // box size and can stand a little larger.
  { kind: 'image', src: '/logos/airbnb.png', scale: 1.1, tint: [1.0, 0.42, 0.42] },
  { kind: 'image', src: '/logos/thinkbox.png', tint: [0.42, 0.66, 0.9] },
  // Black and greys with no colour of its own, so it reads white like Hilton.
  { kind: 'image', src: '/logos/opsiclear.png', tint: [0.84, 0.88, 0.9] },
];

let scene: StoryScene | null = null;
let opening: Promise<StoryScene | null> | null = null;
const beats: Phases = { enter: 0, scatter: 0, assemble: 0, flight: 0, morph: 0, fade: 0, machine: 0, word: 0, wordBlend: 0 };

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
        MARKS,
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

/** Leans the words toward the pointer. */
export function tiltStage(x: number, y: number): void {
  scene?.setTilt(x, y);
}

/** Keeps the stage drawing, so the words breathe and the lean can follow. */
export function enliven(on: boolean): void {
  scene?.setLively(on);
}

/** Chooses the name the dots hold and the one they are travelling to. */
export function selectStagePlaces(a: number, b: number): void {
  scene?.showWords(a, b);
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
