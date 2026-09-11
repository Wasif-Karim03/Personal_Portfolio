/**
 * The flight globe: Natural Earth land as white gaussian dots on black, the
 * 2022 route from Dhaka to Ohio drawn as the reader scrolls, and a light that
 * travels the arc. Built from the same point file as the story's globe
 * (scripts/make-clouds.mjs), recoloured here for the dark story.
 *
 * Imported dynamically as the prologue comes near. It renders only when the
 * scroll or the window changes; nothing loops.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  MathUtils,
  PerspectiveCamera,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { CloudManifest, Variant, Vec3 } from './cloud-shapes';

export interface FlightGlobe {
  /** 0 before take-off, 1 on landing. */
  setProgress(progress: number): void;
  resize(): void;
}

export interface CityPin {
  el: HTMLElement;
  at: 'from' | 'to';
}

// The point file's colours mark what each point is; each becomes a shade here.
const ROLES: Array<{ rgb: Vec3; tone: Vec3; size: number }> = [
  { rgb: [20, 20, 20], tone: [236, 236, 233], size: 1 }, // land
  { rgb: [109, 108, 105], tone: [150, 152, 157], size: 0.9 }, // land, second tone
  { rgb: [210, 207, 200], tone: [34, 36, 40], size: 0.7 }, // ocean
  { rgb: [175, 173, 168], tone: [70, 73, 78], size: 0.7 }, // graticule
  // The flight is the one thing in colour: orange, so it reads against the white Earth.
  { rgb: [255, 79, 0], tone: [255, 112, 48], size: 2.2 }, // the route and the two cities
];

const vertexShader = /* glsl */ `
  attribute vec3 aTone;
  attribute float aSize;
  attribute float aOrder;
  uniform float uReveal;
  uniform float uScale;
  uniform float uBase;
  varying vec3 vTone;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(uBase * aSize * uScale / -mv.z, 1.0);
    // The far side of the sphere fades, so it reads as a globe, not a disc.
    float facing = normalize(normalMatrix * position).z;
    float depth = smoothstep(-0.35, 0.55, facing);
    // Route points appear in order as the flight goes on.
    float shown = aOrder <= 0.0 ? 1.0 : clamp((uReveal - aOrder) * 60.0 + 1.0, 0.0, 1.0);
    vTone = aTone;
    vAlpha = depth * shown;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vTone;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 16.0);
    if (a < 0.03) discard;
    gl_FragColor = vec4(vTone * a * vAlpha, 1.0);
  }
`;

const headVertex = /* glsl */ `
  uniform float uScale;
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
  }
`;

const headFragment = /* glsl */ `
  uniform float uOn;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    float core = exp(-d * 60.0);
    float halo = exp(-d * 9.0) * 0.5;
    // A near-white core in an orange glow: the plane, lit.
    vec3 color = mix(vec3(1.0, 0.44, 0.19), vec3(1.0, 0.93, 0.85), core);
    gl_FragColor = vec4(color * (core + halo) * uOn, 1.0);
  }
`;

const FOV = 30;

export async function createFlightGlobe(
  canvas: HTMLCanvasElement,
  manifest: CloudManifest,
  variant: Variant,
  pins: CityPin[],
): Promise<FlightGlobe> {
  const entry = manifest.shapes.globe;
  if (!entry?.route) throw new Error('clouds.json has no globe route');
  const count = manifest.counts[variant];
  const response = await fetch(entry.files[variant]);
  if (!response.ok) throw new Error(`${entry.files[variant]}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const packed = new Int16Array(buffer, 0, count * 3);
  const rgba = new Uint8Array(buffer, count * 6, count * 4);

  const positions = new Float32Array(count * 3);
  const tones = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const orders = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = packed[i * 3] / 32767;
    positions[i * 3 + 1] = packed[i * 3 + 1] / 32767;
    positions[i * 3 + 2] = packed[i * 3 + 2] / 32767;
    const role = ROLES.find(({ rgb }) => rgb[0] === rgba[i * 4] && rgb[1] === rgba[i * 4 + 1] && rgb[2] === rgba[i * 4 + 2]) ?? ROLES[3];
    // A little variation per point, so the land glitters rather than lies flat.
    const jitter = 0.8 + 0.2 * (((i * 2654435761) >>> 0) / 4294967296);
    tones[i * 3] = (role.tone[0] / 255) * jitter;
    tones[i * 3 + 1] = (role.tone[1] / 255) * jitter;
    tones[i * 3 + 2] = (role.tone[2] / 255) * jitter;
    sizes[i] = role.size;
    orders[i] = rgba[i * 4 + 3] / 255;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aTone', new BufferAttribute(tones, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aOrder', new BufferAttribute(orders, 1));

  const uniforms = {
    uReveal: { value: 0 },
    uScale: { value: 1 },
    uBase: { value: 0.011 * Math.sqrt(36000 / count) },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending });
  const dots = new Points(geometry, material);
  dots.frustumCulled = false;

  // The light on the arc: slerped between the two ends, lifted a touch off the surface.
  const from = new Vector3(...entry.route.from);
  const to = new Vector3(...entry.route.to);
  const radius = from.length() * 1.015;
  const a = from.clone().normalize();
  const b = to.clone().normalize();
  const angle = a.angleTo(b);
  const headPosition = new Float32Array(3);
  const headGeometry = new BufferGeometry();
  headGeometry.setAttribute('position', new BufferAttribute(headPosition, 3));
  const headUniforms = { uScale: { value: 1 }, uSize: { value: 0.09 }, uOn: { value: 0 } };
  const head = new Points(headGeometry, new ShaderMaterial({ uniforms: headUniforms, vertexShader: headVertex, fragmentShader: headFragment, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending }));
  head.frustumCulled = false;

  const globe = new Group();
  globe.add(dots, head);
  const scene = new Scene();
  scene.add(globe);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  let width = 0;
  let height = 0;
  let progress = 0;
  const tmp = new Vector3();
  const heading = new Vector3();
  const turn = new Quaternion();
  // Where the plane is held on screen: a little right of and above centre, so
  // the trail behind it stays in view on the near side of the globe.
  const hold = new Vector3(0.3, 0.14, 1).normalize();

  const place = (pin: CityPin) => {
    tmp.copy(pin.at === 'from' ? from : to).applyMatrix4(globe.matrixWorld);
    const facing = tmp.clone().normalize().z;
    tmp.project(camera);
    pin.el.style.transform = `translate(${((tmp.x + 1) / 2) * width}px, ${((1 - tmp.y) / 2) * height}px)`;
    pin.el.style.opacity = String(Math.max(0, Math.min(1, (facing + 0.1) * 3)));
  };

  const render = () => {
    const flight = MathUtils.clamp((progress - 0.08) / 0.84, 0, 1);
    uniforms.uReveal.value = flight;
    const t = Math.sin((1 - flight) * angle) / Math.sin(angle);
    const u = Math.sin(flight * angle) / Math.sin(angle);
    heading.copy(a).multiplyScalar(t).addScaledVector(b, u).normalize();
    // The globe turns under the plane, like a camera following it: Dhaka faces
    // you at take-off, Ohio on landing.
    turn.setFromUnitVectors(heading, hold);
    globe.quaternion.copy(turn);
    tmp.copy(heading).multiplyScalar(radius);
    headPosition.set([tmp.x, tmp.y, tmp.z]);
    headGeometry.attributes.position.needsUpdate = true;
    headUniforms.uOn.value = flight > 0.001 && flight < 0.999 ? 1 : 0;
    globe.updateMatrixWorld();
    renderer.render(scene, camera);
    for (const pin of pins) place(pin);
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const tan = Math.tan(MathUtils.degToRad(FOV / 2));
    // Fit the sphere (radius about 0.95) with a little air, whatever the shape of the box.
    const fit = 2.25 / Math.min(1, camera.aspect);
    camera.position.set(0, 0, fit / (2 * tan));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const scale = (height * renderer.getPixelRatio()) / (2 * tan);
    uniforms.uScale.value = scale;
    headUniforms.uScale.value = scale;
    render();
  };

  resize();

  return {
    setProgress(next) {
      progress = MathUtils.clamp(next, 0, 1);
      render();
    },
    resize,
  };
}
