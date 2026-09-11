/**
 * The story's dots: one set of gaussian points that holds every shape the
 * opening needs, in order.
 *
 *   his name  →  scattered  →  the globe  →  the flight  →  University Hall
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
  picture: { aspect: number };
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
  morph: number;
  fade: number;
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
  attribute float aSeed;
  attribute vec2 aName;
  attribute float aSweep;
  uniform mat3 uRot;
  uniform float uGlobeScale;
  uniform vec3 uGlobeOffset;
  uniform vec2 uCover;
  uniform float uEnter;
  uniform float uScatter;
  uniform float uAssemble;
  uniform float uReveal;
  uniform float uMorph;
  uniform float uFade;
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

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    bool route = aRole > 0.5;
    // The far side of the globe falls away, so it reads as a sphere.
    float depth = mix(smoothstep(-0.25, 0.55, normalize(onGlobe).z), 1.0, tm);
    float drawn = (!route || aOrder <= 0.0) ? 1.0 : clamp((uReveal - aOrder) * 60.0 + 1.0, 0.0, 1.0);
    drawn = mix(drawn, 1.0, tm);
    // Depth and the flight's reveal only mean anything once the dots are a globe.
    float globeMod = mix(1.0, depth * drawn, ta);

    // Land a little under full white, so overlapping dots glow instead of blowing out.
    vec3 nameTone = vec3(0.95, 0.94, 0.92);
    vec3 globeTone = route ? uRouteTone : vec3(0.8, 0.8, 0.78) * (0.7 + 0.3 * fract(aSeed * 11.0));
    vec3 pictureTone = vec3(pow(aLight, 0.8)) * 0.78;
    vColor = mix(mix(nameTone, globeTone, ta), pictureTone, tm);

    float size = mix(mix(1.4, route ? 1.25 : 1.0, ta), 1.55, tm);
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
): Promise<StoryScene> {
  const count = data.counts[variant];
  const response = await fetch(data.files[variant]);
  if (!response.ok) throw new Error(`${data.files[variant]}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  let offset = 0;
  const packed = new Int16Array(buffer, offset, count * 3);
  offset += count * 6;
  const uvPacked = new Uint16Array(buffer, offset, count * 2);
  offset += count * 4;
  const roles = new Uint8Array(buffer, offset, count);
  offset += count;
  const orders = new Uint8Array(buffer, offset, count);
  offset += count;
  const lights = new Uint8Array(buffer, offset, count);

  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const role = new Float32Array(count);
  const order = new Float32Array(count);
  const light = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) position[i * 3 + k] = (packed[i * 3 + k] / 32767) * 1.05;
    uv[i * 2] = uvPacked[i * 2] / 65535;
    uv[i * 2 + 1] = uvPacked[i * 2 + 1] / 65535;
    role[i] = roles[i];
    order[i] = orders[i] / 255;
    light[i] = lights[i] / 255;
    seed[i] = Math.random();
  }
  const nameXY = new Float32Array(count * 2);
  const sweep = new Float32Array(count);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aUV', new BufferAttribute(uv, 2));
  geometry.setAttribute('aRole', new BufferAttribute(role, 1));
  geometry.setAttribute('aOrder', new BufferAttribute(order, 1));
  geometry.setAttribute('aLight', new BufferAttribute(light, 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 1));
  geometry.setAttribute('aName', new BufferAttribute(nameXY, 2));
  geometry.setAttribute('aSweep', new BufferAttribute(sweep, 1));

  const uniforms = {
    uRot: { value: new Matrix3() },
    uGlobeScale: { value: 0.8 },
    uGlobeOffset: { value: new Vector3() },
    uCover: { value: [3.6, 2.3] as [number, number] },
    // Without a name the dots simply start out in the dark, already scattered.
    uEnter: { value: name ? 0 : 1 },
    uScatter: { value: name ? 0 : 1 },
    uAssemble: { value: 0 },
    uReveal: { value: 0 },
    uMorph: { value: 0 },
    uFade: { value: 0 },
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
  let phases: Phases = { enter: name ? 0 : 1, scatter: name ? 0 : 1, assemble: 0, flight: 0, morph: 0, fade: 0 };

  /**
   * Sets the name into an offscreen canvas and spreads the dots evenly over its
   * letterforms, walking the lit pixels with a fractional step so the coverage
   * reaches the foot of the letters however many dots there are.
   */
  const layoutName = () => {
    if (!name) return;
    namedOk = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mask = document.createElement('canvas');
    mask.width = Math.round(width * dpr);
    mask.height = Math.round(height * dpr);
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const words = name.lines.map((line) => line.toUpperCase());
    const two = words.length > 1;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.005em';

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

    const { data: pixels } = ctx.getImageData(0, 0, mask.width, mask.height);
    const hits: number[] = [];
    for (let i = 0; i < mask.width * mask.height; i++) if (pixels[i * 4 + 3] > 120) hits.push(i);
    if (hits.length === 0) return;

    const step = hits.length / count;
    for (let i = 0; i < count; i++) {
      const hit = hits[Math.min(hits.length - 1, Math.floor(i * step))];
      const x = ((hit % mask.width) + Math.random()) / dpr;
      const y = (Math.floor(hit / mask.width) + Math.random()) / dpr;
      // Screen pixels to the world, on the plane the camera looks straight at.
      nameXY[i * 2] = (x / width - 0.5) * visW;
      nameXY[i * 2 + 1] = (0.5 - y / height) * visH;
      sweep[i] = x / width;
    }
    geometry.attributes.aName.needsUpdate = true;
    geometry.attributes.aSweep.needsUpdate = true;
    namedOk = true;
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
    const { enter, scatter, assemble, flight, morph, fade } = phases;
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
    rimGroup.quaternion.copy(turn);
    rimGroup.scale.setScalar(globeScale);
    rimGroup.position.copy(globeOffset);
    rimUniforms.uStrength.value = 0.3 * assemble * (1 - Math.min(morph * 2.2, 1));
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
    // The picture covers the view, as the photo on the page does (object-fit: cover).
    const aspect = data.picture.aspect;
    uniforms.uCover.value = visW / visH > aspect ? [visW, visW / aspect] : [visH * aspect, visH];
    uniforms.uScale.value = (height * renderer.getPixelRatio()) / (2 * tan);
    layoutName();
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
