/**
 * The story's dots: one set of gaussian points that holds every shape the
 * opening needs, in order.
 *
 *   his name  →  scattered  →  the globe  →  the flight  →  University Hall
 *   →  the machine he builds  →  words  →  a drawing
 *
 * They are the same points throughout. That is the whole point of the scene:
 * the name does not fade out and a globe fade in, the letters break apart and
 * those dots travel up and gather into the Earth, which later streams into the
 * hall as dot-art that the photo on the page develops out of.
 *
 * Globe places, picture places, route order and luminance come from
 * scripts/make-story-points.mjs. The name is sampled here, at runtime, from its
 * own letterforms, because where it sits depends on the size of the window.
 * Renders only when the scroll or the window changes.
 */
import {
  AddEquation,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Group,
  MathUtils,
  Matrix3,
  Matrix4,
  Mesh,
  OneFactor,
  PerspectiveCamera,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';

type Vec3 = [number, number, number];

export interface StoryPoints {
  counts: { desktop: number; mobile: number };
  files: { desktop: string; mobile: string };
  route: { from: Vec3; to: Vec3 };
  /** Every picture the dots can hold, in the order they take them. */
  pictures: Array<{ key: string; aspect: number }>;
}

/** How the name is set, when the scene opens with one. */
export interface NameSetting {
  lines: string[];
  weight: number;
  family: string;
}

/** Where the scene is, each 0 to 1. */
export interface Phases {
  /** The name arriving, dot by dot, left to right. */
  enter: number;
  /** The name breaking up and drifting off, in that same order. */
  scatter: number;
  assemble: number;
  flight: number;
  /** Streaming into University Hall. */
  morph: number;
  fade: number;
  /** Letting the hall go and building his car out of the same dots. */
  machine: number;
  /** Letting the car go and setting the next chapter's words. */
  word: number;
  /** Letting the words go and drawing a system instead. */
  plan: number;
}

export interface Overlays {
  plane: HTMLElement;
  from: HTMLElement;
  to: HTMLElement;
}

export interface StoryScene {
  set(phases: Phases): void;
  resize(): void;
  /** False when the name could not be drawn, so the page keeps its heading. */
  readonly named: boolean;
}

const FOV = 30;
const DISTANCE = 4.3;

const vertexShader = /* glsl */ `
  attribute float aRole;
  attribute float aOrder;
  attribute vec2 aUV;
  attribute float aLight;
  attribute vec2 aUV2;
  attribute float aLight2;
  attribute float aSeed;
  attribute vec2 aName;
  attribute vec2 aWord;
  attribute vec2 aPlan;
  attribute float aSweep;
  uniform mat3 uRot;
  uniform float uGlobeScale;
  uniform vec3 uGlobeOffset;
  uniform vec2 uCover;
  uniform vec2 uCover2;
  uniform vec3 uOffset2;
  uniform float uEnter;
  uniform float uScatter;
  uniform float uAssemble;
  uniform float uReveal;
  uniform float uMorph;
  uniform float uFade;
  uniform float uMachine;
  uniform float uMachineSize;
  uniform float uWord;
  uniform float uWordSize;
  uniform float uPlan;
  uniform float uPlanSize;
  uniform float uScale;
  uniform float uBase;
  uniform vec3 uRouteTone;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 hash3(float s) {
    return fract(sin(vec3(s * 127.1, s * 311.7, s * 74.7)) * 43758.5453) * 2.0 - 1.0;
  }

  float ramp(float t) { return t * t * (3.0 - 2.0 * t); }

  void main() {
    vec3 h = hash3(aSeed * 13.1);

    // 1. His name, on the plane of the screen. Each dot rises into its letter,
    //    left to right, so the name is written rather than switched on.
    vec3 named = vec3(aName, 0.0);
    float te = ramp(clamp(uEnter * 1.7 - aSweep * 0.7, 0.0, 1.0));
    vec3 p = mix(named + vec3(h.x * 0.18, -0.45 - abs(h.y) * 0.5, 0.0), named, te);

    // 2. The letters break, in the same sweep, and drift up and back into the dark.
    float tb = ramp(clamp(uScatter * 1.7 - aSweep * 0.6, 0.0, 1.0));
    p = mix(p, named + vec3(0.35 + h.x * 0.8, 1.1 + h.y * 0.7, -0.8 + h.z * 1.1), tb);

    // 3. The same dots gather into the globe, each arriving at its own moment.
    vec3 onGlobe = uRot * position;
    vec3 g = onGlobe * uGlobeScale + uGlobeOffset;
    float ta = ramp(clamp(uAssemble * 1.5 - aSeed * 0.5, 0.0, 1.0));
    p = mix(p, g, ta);

    // 4. And stream on into the picture, with a little swirl on the way.
    vec3 target = vec3((aUV.x - 0.5) * uCover.x, (0.5 - aUV.y) * uCover.y, 0.0);
    float tm = ramp(clamp(uMorph * 1.6 - fract(aSeed * 3.7) * 0.6, 0.0, 1.0));
    p = mix(p, target, tm) + hash3(aSeed * 5.3) * 0.28 * sin(3.14159 * tm);

    // 5. The hall lets go, and the same dots build the machine he made.
    vec3 built = vec3((aUV2.x - 0.5) * uCover2.x, (0.5 - aUV2.y) * uCover2.y, 0.0) + uOffset2;
    float tw = ramp(clamp(uMachine * 1.6 - fract(aSeed * 8.3) * 0.6, 0.0, 1.0));
    p = mix(p, built, tw) + hash3(aSeed * 9.1) * 0.32 * sin(3.14159 * tw);

    // 6. The car lets go, and the dots set the words the next chapter opens on.
    float tq = ramp(clamp(uWord * 1.7 - aSweep * 0.6, 0.0, 1.0));
    p = mix(p, vec3(aWord, 0.0), tq) + hash3(aSeed * 4.1) * 0.26 * sin(3.14159 * tq);

    // 7. And the words give way to a drawing of the system.
    float tp = ramp(clamp(uPlan * 1.7 - aSweep * 0.5, 0.0, 1.0));
    p = mix(p, vec3(aPlan, 0.0), tp) + hash3(aSeed * 6.7) * 0.24 * sin(3.14159 * tp);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    bool route = aRole > 0.5;
    // The far side of the globe falls away, so it reads as a sphere.
    float depth = mix(smoothstep(-0.25, 0.55, normalize(onGlobe).z), 1.0, max(max(tm, tw), max(tq, tp)));
    float drawn = (!route || aOrder <= 0.0) ? 1.0 : clamp((uReveal - aOrder) * 60.0 + 1.0, 0.0, 1.0);
    drawn = mix(drawn, 1.0, tm);
    // Depth and the flight's reveal only mean anything once the dots are a globe.
    float globeMod = mix(1.0, depth * drawn, ta);

    // Land a little under full white, so overlapping dots glow instead of blowing out.
    vec3 nameTone = vec3(0.95, 0.94, 0.92);
    vec3 globeTone = route ? uRouteTone : vec3(0.8, 0.8, 0.78) * (0.7 + 0.3 * fract(aSeed * 11.0));
    vec3 pictureTone = vec3(pow(aLight, 0.8)) * 0.78;
    vec3 machineTone = vec3(pow(aLight2, 0.85)) * 0.76;
    vColor = mix(mix(mix(mix(nameTone, globeTone, ta), pictureTone, tm), machineTone, tw), nameTone, max(tq, tp));

    float size = mix(mix(mix(mix(mix(1.4, route ? 1.25 : 1.0, ta), 1.55, tm), uMachineSize, tw), uWordSize, tq), uPlanSize, tp);
    gl_PointSize = max(uBase * size * uScale / -mv.z, 1.0);
    vAlpha = te * globeMod * (1.0 - uFade);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 16.0) * vAlpha;
    if (a < 0.01) discard;
    // Premultiplied: colour and coverage both add, so the dots build up out of
    // the picture behind them instead of masking it.
    gl_FragColor = vec4(vColor * a, a);
  }
`;

// A faint atmosphere at the rim, so the dots sit on a planet, not in a void.
const rimVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const rimFragment = /* glsl */ `
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float f = pow(1.0 - abs(dot(vNormal, vView)), 3.2) * uStrength;
    gl_FragColor = vec4(vec3(0.62, 0.68, 0.78) * f, f);
  }
`;

export async function createStoryScene(
  canvas: HTMLCanvasElement,
  data: StoryPoints,
  variant: 'desktop' | 'mobile',
  overlays: Overlays,
  name?: NameSetting,
  word?: NameSetting,
  plan?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): Promise<StoryScene> {
  const count = data.counts[variant];
  const response = await fetch(data.files[variant]);
  if (!response.ok) throw new Error(`${data.files[variant]}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  // Globe places, then one uv per picture, then roles and order, then one
  // luminance per picture. See scripts/make-story-points.mjs.
  const shots = data.pictures.length;
  let offset = 0;
  const packed = new Int16Array(buffer, offset, count * 3);
  offset += count * 6;
  const uvPacked: Uint16Array[] = [];
  for (let k = 0; k < shots; k++) {
    uvPacked.push(new Uint16Array(buffer, offset, count * 2));
    offset += count * 4;
  }
  const roles = new Uint8Array(buffer, offset, count);
  offset += count;
  const orders = new Uint8Array(buffer, offset, count);
  offset += count;
  const lightPacked: Uint8Array[] = [];
  for (let k = 0; k < shots; k++) {
    lightPacked.push(new Uint8Array(buffer, offset, count));
    offset += count;
  }
  // The shader carries two pictures; with only one, both point at it.
  const second = Math.min(1, shots - 1);

  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const uv2 = new Float32Array(count * 2);
  const role = new Float32Array(count);
  const order = new Float32Array(count);
  const light = new Float32Array(count);
  const light2 = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) position[i * 3 + k] = (packed[i * 3 + k] / 32767) * 1.05;
    uv[i * 2] = uvPacked[0][i * 2] / 65535;
    uv[i * 2 + 1] = uvPacked[0][i * 2 + 1] / 65535;
    uv2[i * 2] = uvPacked[second][i * 2] / 65535;
    uv2[i * 2 + 1] = uvPacked[second][i * 2 + 1] / 65535;
    role[i] = roles[i];
    order[i] = orders[i] / 255;
    light[i] = lightPacked[0][i] / 255;
    light2[i] = lightPacked[second][i] / 255;
    seed[i] = Math.random();
  }
  const nameXY = new Float32Array(count * 2);
  const wordXY = new Float32Array(count * 2);
  const planXY = new Float32Array(count * 2);
  const sweep = new Float32Array(count);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aUV', new BufferAttribute(uv, 2));
  geometry.setAttribute('aUV2', new BufferAttribute(uv2, 2));
  geometry.setAttribute('aRole', new BufferAttribute(role, 1));
  geometry.setAttribute('aOrder', new BufferAttribute(order, 1));
  geometry.setAttribute('aLight', new BufferAttribute(light, 1));
  geometry.setAttribute('aLight2', new BufferAttribute(light2, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1));
  geometry.setAttribute('aName', new BufferAttribute(nameXY, 2));
  geometry.setAttribute('aWord', new BufferAttribute(wordXY, 2));
  geometry.setAttribute('aPlan', new BufferAttribute(planXY, 2));
  geometry.setAttribute('aSweep', new BufferAttribute(sweep, 1));

  const uniforms = {
    uRot: { value: new Matrix3() },
    uGlobeScale: { value: 0.8 },
    uGlobeOffset: { value: new Vector3() },
    uCover: { value: [3.6, 2.3] as [number, number] },
    uCover2: { value: [3.6, 2.3] as [number, number] },
    uOffset2: { value: new Vector3() },
    // Without a name the dots simply start out in the dark, already scattered.
    uEnter: { value: name ? 0 : 1 },
    uScatter: { value: name ? 0 : 1 },
    uAssemble: { value: 0 },
    uReveal: { value: 0 },
    uMorph: { value: 0 },
    uFade: { value: 0 },
    uMachine: { value: 0 },
    // Every point lands on the machine, so it is the densest thing the dots
    // ever make. Fewer points means bigger ones (uBase), which would fill the
    // car in solid on a phone — so the size it shrinks to follows the count.
    uMachineSize: { value: 0.78 * Math.sqrt(count / 64000) },
    uWord: { value: 0 },
    uWordSize: { value: 1 },
    uPlan: { value: 0 },
    uPlanSize: { value: 1 },
    uScale: { value: 1 },
    uBase: { value: 0.0068 * Math.sqrt(64000 / count) },
    // The flight's tone: a soft champagne, warm against the white Earth without shouting.
    uRouteTone: { value: new Vector3(0.93, 0.8, 0.62) },
  };
  // Everything on this canvas glows: it adds light to whatever is behind it,
  // carrying its own coverage, so the canvas can stay clear.
  const glow = {
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
  };
  const dots = new Points(
    geometry,
    new ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, ...glow }),
  );
  dots.frustumCulled = false;

  const rimUniforms = { uStrength: { value: 0 } };
  const rim = new Mesh(
    new SphereGeometry(1.08, 64, 48),
    new ShaderMaterial({ uniforms: rimUniforms, vertexShader: rimVertex, fragmentShader: rimFragment, side: BackSide, ...glow }),
  );
  const rimGroup = new Group();
  rimGroup.add(rim);

  const scene = new Scene();
  scene.add(rimGroup, dots);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, DISTANCE);
  // Clear, not black: his photograph is behind this canvas during the name,
  // and the page's own night is behind it after that.
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  const a = new Vector3(...data.route.from).normalize();
  const b = new Vector3(...data.route.to).normalize();
  const arc = a.angleTo(b);
  const lift = 1.02;
  const hold = new Vector3(0.28, 0.16, 1).normalize();
  const heading = new Vector3();
  const ahead = new Vector3();
  const turn = new Quaternion();
  const rot3 = new Matrix3();
  const rot4 = new Matrix4();
  const tmp = new Vector3();

  let width = 0;
  let height = 0;
  let visW = 0;
  let visH = 0;
  let globeScale = 0.8;
  let namedOk = false;
  const globeOffset = new Vector3();
  let phases: Phases = { enter: name ? 0 : 1, scatter: name ? 0 : 1, assemble: 0, flight: 0, morph: 0, fade: 0, machine: 0, word: 0, plan: 0 };

  /**
   * Spreads the dots evenly over whatever was drawn on the mask, walking the lit
   * pixels with a fractional step so the coverage reaches the foot of the
   * letters however many dots there are. Returns the pixels each dot stands for,
   * which is what their size has to follow, or 0 if nothing was drawn.
   */
  const scatterMask = (mask: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number, out: Float32Array, sweepOut: Float32Array | null) => {
    const { data: pixels } = ctx.getImageData(0, 0, mask.width, mask.height);
    const hits: number[] = [];
    for (let i = 0; i < mask.width * mask.height; i++) if (pixels[i * 4 + 3] > 120) hits.push(i);
    if (hits.length === 0) return 0;

    const step = hits.length / count;
    for (let i = 0; i < count; i++) {
      const hit = hits[Math.min(hits.length - 1, Math.floor(i * step))];
      const x = ((hit % mask.width) + Math.random()) / dpr;
      const y = (Math.floor(hit / mask.width) + Math.random()) / dpr;
      // Screen pixels to the world, on the plane the camera looks straight at.
      out[i * 2] = (x / width - 0.5) * visW;
      out[i * 2 + 1] = (0.5 - y / height) * visH;
      if (sweepOut) sweepOut[i] = x / width;
    }
    return step;
  };

  /** An offscreen canvas the size of the view, ready to be written on. */
  const freshMask = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mask = document.createElement('canvas');
    mask.width = Math.round(width * dpr);
    mask.height = Math.round(height * dpr);
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.005em';
    return { mask, ctx, dpr };
  };

  /** His name, set as the page would set it. */
  const layoutName = () => {
    if (!name) return;
    namedOk = false;
    const sheet = freshMask();
    if (!sheet) return;
    const { mask, ctx, dpr } = sheet;

    const words = name.lines.map((line) => line.toUpperCase());
    const two = words.length > 1;
    // Set it as large as the page would, then pull back until the name fits.
    let size = two ? Math.min(width * 0.33, height * 0.22) : Math.min(width * 0.17, height * 0.34);
    const widest = () => {
      ctx.font = `${name.weight} ${size}px ${name.family}`;
      return Math.max(...words.map((word) => ctx.measureText(word).width));
    };
    const room = width * 0.9;
    if (widest() > room) size *= room / widest();
    ctx.font = `${name.weight} ${size}px ${name.family}`;

    // The block's foot sits at 52% of the height, as the heading does.
    const foot = height * 0.52;
    words.forEach((word, i) => {
      ctx.fillText(word, width / 2, foot - (words.length - 1 - i) * size * 0.82);
    });

    if (scatterMask(mask, ctx, dpr, nameXY, sweep) === 0) return;
    geometry.attributes.aName.needsUpdate = true;
    geometry.attributes.aSweep.needsUpdate = true;
    namedOk = true;
  };

  /**
   * A drawing rather than type: whatever the caller paints on the mask, the dots
   * take. The same sampling as the words, so nothing new is needed to add a
   * shape to the story.
   */
  const layoutPlan = () => {
    if (!plan) return;
    const sheet = freshMask();
    if (!sheet) return;
    const { mask, ctx, dpr } = sheet;
    plan(ctx, width, height);
    const step = scatterMask(mask, ctx, dpr, planXY, null);
    if (step === 0) return;
    uniforms.uPlanSize.value = Math.min(Math.max(1.05 * Math.sqrt(step), 0.3), 1.6);
    geometry.attributes.aPlan.needsUpdate = true;
  };

  /** The next chapter's words, smaller and centred, in the same face. */
  const layoutWord = () => {
    if (!word) return;
    const sheet = freshMask();
    if (!sheet) return;
    const { mask, ctx, dpr } = sheet;

    const lines = word.lines.map((line) => line.toUpperCase());
    let size = Math.min(width * 0.13, height * 0.24);
    const widest = () => {
      ctx.font = `${word.weight} ${size}px ${word.family}`;
      return Math.max(...lines.map((line) => ctx.measureText(line).width));
    };
    const room = width * 0.74;
    if (widest() > room) size *= room / widest();
    ctx.font = `${word.weight} ${size}px ${word.family}`;

    const foot = height * 0.54;
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, foot - (lines.length - 1 - i) * size * 0.86);
    });

    const step = scatterMask(mask, ctx, dpr, wordXY, null);
    if (step === 0) return;
    // Fewer pixels than the name, so the same dots pack tighter: size follows.
    uniforms.uWordSize.value = Math.min(Math.max(1.05 * Math.sqrt(step), 0.3), 1.6);
    geometry.attributes.aWord.needsUpdate = true;
  };

  const slerp = (t: number, out: Vector3) => {
    const s = Math.sin(arc);
    return out.copy(a).multiplyScalar(Math.sin((1 - t) * arc) / s).addScaledVector(b, Math.sin(t * arc) / s).normalize();
  };

  /** Screen position (CSS px) of a point on the globe, as drawn now. */
  const toScreen = (onUnit: Vector3, out: { x: number; y: number; z: number }) => {
    tmp.copy(onUnit).multiplyScalar(lift).applyQuaternion(turn).multiplyScalar(globeScale).add(globeOffset);
    out.z = tmp.clone().sub(globeOffset).normalize().z;
    tmp.project(camera);
    out.x = ((tmp.x + 1) / 2) * width;
    out.y = ((1 - tmp.y) / 2) * height;
    return out;
  };

  const here = { x: 0, y: 0, z: 0 };
  const next = { x: 0, y: 0, z: 0 };
  const cityFrom = { x: 0, y: 0, z: 0 };
  const cityTo = { x: 0, y: 0, z: 0 };

  const render = () => {
    const { enter, scatter, assemble, flight, morph, fade, machine, word: typed, plan: drawn } = phases;
    slerp(flight, heading);
    // The globe turns under the plane, like a camera following it.
    turn.setFromUnitVectors(heading, hold);
    rot3.setFromMatrix4(rot4.makeRotationFromQuaternion(turn));
    uniforms.uRot.value.copy(rot3);
    uniforms.uEnter.value = enter;
    uniforms.uScatter.value = scatter;
    uniforms.uAssemble.value = assemble;
    uniforms.uReveal.value = flight;
    uniforms.uMorph.value = morph;
    uniforms.uFade.value = fade;
    uniforms.uMachine.value = machine;
    uniforms.uWord.value = typed;
    uniforms.uPlan.value = drawn;
    rimGroup.quaternion.copy(turn);
    rimGroup.scale.setScalar(globeScale);
    rimGroup.position.copy(globeOffset);
    rimUniforms.uStrength.value = 0.3 * assemble * (1 - Math.min(Math.max(morph, machine) * 2.2, 1));
    renderer.render(scene, camera);

    // The plane: on the arc, nose along the direction of travel.
    const visible = assemble > 0.95 && flight > 0.002 && flight < 0.998 && morph < 0.02;
    toScreen(heading, here);
    toScreen(slerp(Math.min(flight + 0.01, 1), ahead), next);
    const angle = (Math.atan2(next.y - here.y, next.x - here.x) * 180) / Math.PI + 90;
    overlays.plane.style.transform = `translate(${here.x}px, ${here.y}px) rotate(${angle}deg)`;
    overlays.plane.style.opacity = visible ? '1' : '0';

    const labels = Math.max(0, Math.min(1, (assemble - 0.8) * 5)) * (1 - Math.min(morph * 4, 1));
    toScreen(a, cityFrom);
    toScreen(b, cityTo);
    overlays.from.style.transform = `translate(${cityFrom.x}px, ${cityFrom.y}px)`;
    overlays.to.style.transform = `translate(${cityTo.x}px, ${cityTo.y}px)`;
    overlays.from.style.opacity = String(labels * Math.max(0, Math.min(1, (cityFrom.z + 0.1) * 3)));
    overlays.to.style.opacity = String(labels * Math.max(0, Math.min(1, (cityTo.z + 0.1) * 3)) * (flight > 0.6 ? 1 : 0.55));
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const tan = Math.tan(MathUtils.degToRad(FOV / 2));
    visH = 2 * DISTANCE * tan;
    visW = visH * camera.aspect;
    const wide = width >= 960;
    // Wide: the globe stands in the right half. Narrow: in the upper part, above the words.
    globeScale = wide ? Math.min(0.76, visW * 0.2) : Math.min(0.46, visW * 0.4);
    // Clear of the year rail on the right edge.
    globeOffset.set(wide ? visW * 0.165 : 0, wide ? 0.02 : visH * 0.19, 0);
    uniforms.uGlobeScale.value = globeScale;
    uniforms.uGlobeOffset.value.copy(globeOffset);
    // Each picture covers the view, as the photos on the page do (object-fit: cover).
    const cover = (aspect: number): [number, number] =>
      visW / visH > aspect ? [visW, visW / aspect] : [visH * aspect, visH];
    uniforms.uCover.value = cover(data.pictures[0].aspect);
    // The machine is a subject, not a scene: it sits inside the frame rather
    // than bleeding off it, and on wide screens it stands in the right half so
    // the words have the left, where the globe stands in its own chapter.
    const shot = data.pictures[second].aspect;
    const tall = visH * (wide ? 0.6 : 0.44);
    const room = visW * (wide ? 0.56 : 0.92);
    const fit = Math.min(1, room / (tall * shot));
    uniforms.uCover2.value = [tall * shot * fit, tall * fit];
    uniforms.uOffset2.value.set(wide ? visW * 0.2 : 0, wide ? 0.02 : visH * 0.16, 0);
    uniforms.uScale.value = (height * renderer.getPixelRatio()) / (2 * tan);
    layoutName();
    layoutWord();
    layoutPlan();
    render();
  };

  resize();

  return {
    set(next) {
      phases = next;
      render();
    },
    resize,
    get named() {
      return namedOk;
    },
  };
}
