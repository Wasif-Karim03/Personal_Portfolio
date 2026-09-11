/**
 * Wasif's name, drawn as gaussian dots.
 *
 * The name is set into an offscreen canvas in the site's display face, and the
 * dots are sampled from those letterforms, so the shape is the type, not an
 * approximation. They drift in from below and settle, sweeping left to right;
 * as the opening scrolls away they lift toward the globe that follows, so the
 * story's dots carry from one scene into the next.
 *
 * Imported dynamically after the page loads. The page keeps the real heading
 * for screen readers, and shows it instead of this when WebGL is missing.
 */
import { AddEquation, BufferAttribute, BufferGeometry, CustomBlending, OneFactor, OrthographicCamera, Points, Scene, ShaderMaterial, WebGLRenderer } from 'three';

export interface NameDots {
  /** Settles the letters into place, once. */
  intro(): void;
  /** 0 while the opening is in view, 1 once it has scrolled away. */
  setScroll(progress: number): void;
  resize(): void;
}

const vertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aSweep;
  uniform float uIntro;
  uniform float uScroll;
  uniform float uSize;
  uniform float uSpread;
  varying float vAlpha;

  float hash(float s) { return fract(sin(s * 127.1) * 43758.5453); }

  void main() {
    // Settling in: each dot arrives from just below, left to right.
    float t = clamp(uIntro * 1.7 - aSweep * 0.7, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec2 from = position.xy + vec2((hash(aSeed * 3.3) - 0.5) * 70.0, 70.0 + hash(aSeed * 9.1) * 90.0);
    vec2 p = mix(from, position.xy, t);

    // Leaving: up and a little right, toward where the globe gathers. The dots
    // go in the same left-to-right sweep they arrived in, so the name is carried
    // off a piece at a time instead of dissolving all at once into a haze.
    float lift = clamp(uScroll * 1.7 - aSweep * 0.6, 0.0, 1.0);
    float s = lift * lift;
    vec2 drift = normalize(vec2(0.25 + hash(aSeed * 5.7) * 0.35, -1.0));
    p += drift * s * uSpread * (0.6 + hash(aSeed * 7.7) * 0.5);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
    // They thin as they travel, so the stream fines away rather than greying the
    // photograph behind it.
    gl_PointSize = uSize * (0.8 + 0.5 * hash(aSeed * 13.7)) * (1.0 - 0.45 * s);
    vAlpha = t * (1.0 - smoothstep(0.2, 0.9, lift));
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTone;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 15.0) * vAlpha;
    if (a < 0.01) discard;
    // Premultiplied: colour and coverage both add, so the dots build the
    // letters up out of the photograph instead of masking it.
    gl_FragColor = vec4(uTone * a, a);
  }
`;

interface Setting {
  /** One line on wide screens, two when the screen is tall and narrow. */
  lines: string[];
  weight: number;
  family: string;
}

/** Null when the letters could not be sampled; the caller then keeps the plain heading. */
export function createNameDots(canvas: HTMLCanvasElement, setting: Setting, count: number, tone = [0.95, 0.94, 0.92]): NameDots | null {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, -1, 1);

  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sweep = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  geometry.setAttribute('aSweep', new BufferAttribute(sweep, 1));

  const uniforms = {
    uIntro: { value: 0 },
    uScroll: { value: 0 },
    uSize: { value: 2.4 },
    uSpread: { value: 600 },
    uTone: { value: tone },
  };
  const points = new Points(geometry, new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, blending: CustomBlending,
    blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
    blendEquationAlpha: AddEquation, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor }));
  points.frustumCulled = false;
  scene.add(points);

  let width = 0;
  let height = 0;
  let drawn = false;
  let running = false;
  let introStart = 0;

  /** Sets the name in an offscreen canvas and scatters the dots over its letters. */
  const measure = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mask = document.createElement('canvas');
    mask.width = Math.round(width * dpr);
    mask.height = Math.round(height * dpr);
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    const two = setting.lines.length > 1;
    const words = setting.lines.map((line) => line.toUpperCase());
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.005em';

    // Set it as large as the CSS would, then pull back until the name fits.
    let size = two ? Math.min(width * 0.33, height * 0.22) : Math.min(width * 0.17, height * 0.34);
    const widest = () => {
      ctx.font = `${setting.weight} ${size}px ${setting.family}`;
      return Math.max(...words.map((word) => ctx.measureText(word).width));
    };
    const room = width * 0.9;
    if (widest() > room) size *= room / widest();
    ctx.font = `${setting.weight} ${size}px ${setting.family}`;
    // The block's foot sits at 52% of the height, as the heading does.
    const foot = height * 0.52;
    words.forEach((word, i) => {
      const y = foot - (words.length - 1 - i) * size * 0.82;
      ctx.fillText(word, width / 2, y);
    });

    const { data } = ctx.getImageData(0, 0, mask.width, mask.height);
    const hits: number[] = [];
    for (let i = 0; i < mask.width * mask.height; i++) if (data[i * 4 + 3] > 120) hits.push(i);
    if (hits.length === 0) return false;

    // The dots walk the whole span of lit pixels, jittered: an even coverage of
    // the letterforms, where sampling at random leaves clumps and reads as static.
    // The step is fractional, so the walk always ends at the foot of the letters.
    const step = hits.length / count;
    // Dots sized to that spacing, so the strokes are solid and the edges grainy.
    uniforms.uSize.value = Math.min(Math.max(2 * Math.sqrt(step), 1.7), 7);

    for (let i = 0; i < count; i++) {
      const hit = hits[Math.min(hits.length - 1, Math.floor(i * step))];
      const x = ((hit % mask.width) + Math.random()) / dpr;
      const y = (Math.floor(hit / mask.width) + Math.random()) / dpr;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = 0;
      sweep[i] = x / width;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aSweep.needsUpdate = true;
    drawn = true;
    return true;
  };

  const render = () => renderer.render(scene, camera);

  const frame = () => {
    if (!running) return;
    uniforms.uIntro.value = Math.min((performance.now() - introStart) / 1500, 1);
    render();
    if (uniforms.uIntro.value < 1) requestAnimationFrame(frame);
    else running = false;
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.right = width;
    camera.bottom = height;
    camera.updateProjectionMatrix();
    uniforms.uSpread.value = Math.max(width, height) * 0.7;
    measure();
    render();
  };

  resize();
  if (!drawn) {
    renderer.dispose();
    return null;
  }

  return {
    intro() {
      introStart = performance.now();
      running = true;
      requestAnimationFrame(frame);
    },
    setScroll(progress) {
      uniforms.uScroll.value = Math.min(Math.max(progress, 0), 1);
      if (!running) render();
    },
    resize,
  };
}
