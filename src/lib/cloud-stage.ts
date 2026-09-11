/**
 * The point-cloud stage: a single three.js Points object that is every picture
 * on the page, turning from one shape into the next.
 *
 * Imported dynamically once the page has loaded. The canvas is transparent: the
 * paper shows through, and the text sits above it. Each point is drawn as a
 * soft gaussian splat. Points travel with a slight swirl and a per-point delay,
 * so a change of shape reads as the cloud dissolving and reassembling.
 */
import {
  BufferAttribute,
  BufferGeometry,
  MathUtils,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Cloud } from './cloud-shapes';

export interface ScreenBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CloudStage {
  /**
   * Draws `from` turning into `to`: mix 0 is `from`, 1 is `to`. Each reveal is
   * that shape's scene progress, for points that appear as a scene goes on.
   */
  show(from: Cloud, to: Cloud, mix: number, revealFrom: number, revealTo: number): void;
  /** The slow drift. Off, the stage renders only when show() is called. */
  setDrift(on: boolean): void;
  /** Where a box in cloud coordinates is on screen right now, in CSS pixels. */
  projectBox(box: [number, number, number, number]): ScreenBox;
  /** Called after every render, to keep overlays on the cloud. */
  onRender(callback: () => void): void;
  resize(): void;
}

const FOV = 30;

const vertexShader = /* glsl */ `
  attribute vec3 aTo;
  attribute vec4 aColFrom;
  attribute vec4 aColTo;
  attribute float aSeed;
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uRevealFrom;
  uniform float uRevealTo;
  uniform float uOpacityFrom;
  uniform float uOpacityTo;
  varying vec4 vColor;

  float shown(float order, float reveal) {
    return order <= 0.0 ? 1.0 : clamp((reveal - order) * 40.0 + 1.0, 0.0, 1.0);
  }

  void main() {
    // Each point leaves at its own moment, so the shape dissolves, not slides.
    float t = clamp(uMix * 1.6 - aSeed * 0.6, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 swirl = normalize(vec3(sin(aSeed * 91.7), cos(aSeed * 47.3), sin(aSeed * 13.1 + 1.0)));
    vec3 p = mix(position, aTo, t) + swirl * sin(3.14159 * t) * (0.1 + 0.2 * fract(aSeed * 7.0));
    p += 0.005 * vec3(sin(uTime * 0.9 + aSeed * 40.0), cos(uTime * 0.7 + aSeed * 23.0), sin(uTime * 0.8 + aSeed * 11.0));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(uSize * (0.55 + 0.9 * fract(aSeed * 13.7)) * uScale / -mv.z, 1.0);

    float alpha = mix(shown(aColFrom.a, uRevealFrom) * uOpacityFrom, shown(aColTo.a, uRevealTo) * uOpacityTo, t);
    vColor = vec4(mix(aColFrom.rgb, aColTo.rgb, t), alpha);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec4 vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 14.0);
    if (a < 0.04) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }
`;

export function createCloudStage(canvas: HTMLCanvasElement, count: number): CloudStage {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);

  const from = new Float32Array(count * 3);
  const to = new Float32Array(count * 3);
  const colorsFrom = new Uint8Array(count * 4);
  const colorsTo = new Uint8Array(count * 4);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();

  const geometry = new BufferGeometry();
  const attributes = {
    from: new BufferAttribute(from, 3),
    to: new BufferAttribute(to, 3),
    colorsFrom: new BufferAttribute(colorsFrom, 4, true),
    colorsTo: new BufferAttribute(colorsTo, 4, true),
  };
  geometry.setAttribute('position', attributes.from);
  geometry.setAttribute('aTo', attributes.to);
  geometry.setAttribute('aColFrom', attributes.colorsFrom);
  geometry.setAttribute('aColTo', attributes.colorsTo);
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

  const uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    // Fewer points on phones, so each splat is a little larger.
    uSize: { value: 0.017 * Math.sqrt(36000 / count) },
    uScale: { value: 1 },
    uRevealFrom: { value: 1 },
    uRevealTo: { value: 1 },
    uOpacityFrom: { value: 1 },
    uOpacityTo: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let width = 0;
  let height = 0;
  let shownFrom: Cloud | undefined;
  let shownTo: Cloud | undefined;
  let drift = false;
  let frame = 0;
  const started = performance.now();
  const callbacks: Array<() => void> = [];

  const render = () => {
    const time = drift ? (performance.now() - started) / 1000 : 0;
    uniforms.uTime.value = time;
    points.rotation.y = drift ? Math.sin(time * 0.22) * 0.22 : 0;
    points.rotation.x = drift ? Math.sin(time * 0.15) * 0.04 : 0;
    renderer.render(scene, camera);
    for (const callback of callbacks) callback();
  };

  const loop = () => {
    frame = 0;
    if (!drift || document.hidden) return;
    render();
    frame = requestAnimationFrame(loop);
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);

    // Wide screens: the cloud stands to the right of the text column.
    // Narrow ones: the canvas is the panel at the top, and the cloud fills it,
    // nudged down clear of the nav.
    const wide = width >= 960;
    camera.aspect = width / height;
    const tan = Math.tan(MathUtils.degToRad(FOV / 2));
    // World units of height on screen: a cloud 2 tall fills about 70% of a wide screen.
    const visible = wide ? 2.85 : Math.max(2.4 / 0.82, 2.4 / (0.9 * camera.aspect));
    camera.position.set(0, 0, visible / (2 * tan));
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(width, height, wide ? -width * 0.22 : 0, wide ? 0 : -height * 0.07, width, height);
    camera.updateProjectionMatrix();
    uniforms.uScale.value = (height * renderer.getPixelRatio()) / (2 * tan);
    render();
  };

  document.addEventListener('visibilitychange', () => {
    if (drift && !document.hidden && !frame) frame = requestAnimationFrame(loop);
  });

  resize();

  const corner = new Vector3();

  return {
    show(a, b, mix, revealFrom, revealTo) {
      if (a !== shownFrom) {
        from.set(a.positions);
        colorsFrom.set(a.colors);
        attributes.from.needsUpdate = true;
        attributes.colorsFrom.needsUpdate = true;
        shownFrom = a;
      }
      if (b !== shownTo) {
        to.set(b.positions);
        colorsTo.set(b.colors);
        attributes.to.needsUpdate = true;
        attributes.colorsTo.needsUpdate = true;
        shownTo = b;
      }
      uniforms.uMix.value = mix;
      uniforms.uRevealFrom.value = revealFrom;
      uniforms.uRevealTo.value = revealTo;
      uniforms.uOpacityFrom.value = a.opacity;
      uniforms.uOpacityTo.value = b.opacity;
      if (!drift) render();
    },
    setDrift(on) {
      drift = on;
      if (on && !frame) frame = requestAnimationFrame(loop);
      if (!on) render();
    },
    projectBox([x0, y0, x1, y1]) {
      points.updateMatrixWorld();
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
        corner.set(x, y, 0).applyMatrix4(points.matrixWorld).project(camera);
        const sx = ((corner.x + 1) / 2) * width;
        const sy = ((1 - corner.y) / 2) * height;
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
      return { left, top, width: right - left, height: bottom - top };
    },
    onRender(callback) {
      callbacks.push(callback);
    },
    resize,
  };
}
