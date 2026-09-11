/**
 * The FIG. 14 fly-through: a LiDAR point cloud drawn with three.js, the camera
 * moved along a path by scroll progress.
 *
 * Imported dynamically by the scene, so three only downloads as FIG. 14 comes
 * near. It renders on demand, on a scroll or a resize, never on a loop: the
 * picture only changes when the reader scrolls.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Fog,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

type Vec3 = [number, number, number];

export interface PointCloudManifest {
  name: string;
  /** 'placeholder' until the car's scan replaces it. The scene labels it. */
  source: 'placeholder' | 'scan';
  caption: string;
  desktop: { file: string; count: number };
  /** Fewer points for phones. */
  mobile: { file: string; count: number };
  bounds: { min: Vec3; max: Vec3 };
  /** Camera path in ROS coordinates (x forward, y left, z up). */
  path: Vec3[];
}

export interface PointFlight {
  /** 0 at the start of the path, 1 at its end. */
  setProgress(progress: number): void;
  resize(): void;
  dispose(): void;
}

/**
 * ROS (x forward, y left, z up) to three.js (x right, y up, -z forward). A
 * proper rotation, not a mirror, so the scan keeps its handedness.
 */
const fromRos = ([x, y, z]: Vec3) => new Vector3(-y, z, -x);

/** A white disc, tinted by the material's colour: round points, not squares. */
function dot(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  return new CanvasTexture(canvas);
}

export async function createPointFlight(
  canvas: HTMLCanvasElement,
  manifest: PointCloudManifest,
  variant: 'desktop' | 'mobile',
  colours: { paper: string; signal: string },
): Promise<PointFlight> {
  const response = await fetch(manifest[variant].file);
  if (!response.ok) throw new Error(`${manifest[variant].file}: HTTP ${response.status}`);
  const positions = new Float32Array(await response.arrayBuffer());

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    positions[i] = -y;
    positions[i + 1] = z;
    positions[i + 2] = -x;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  // Orange: the points are what the robot sees. Round, because the default
  // squares turn into blocky tiles once the camera is down among them.
  const material = new PointsMaterial({
    color: new Color(colours.signal),
    map: dot(),
    alphaTest: 0.5,
    size: variant === 'mobile' ? 0.08 : 0.05,
    sizeAttenuation: true,
  });

  const scene = new Scene();
  scene.background = new Color(colours.paper);
  // Distance fades into the paper, like ink thinning out on the sheet.
  scene.fog = new Fog(colours.paper, 6, 48);
  scene.add(new Points(geometry, material));

  const camera = new PerspectiveCamera(55, 1, 0.1, 120);
  const path = new CatmullRomCurve3(manifest.path.map(fromRos), false, 'centripetal');

  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  let progress = 0;
  const ahead = new Vector3();

  const render = () => {
    const p = Math.min(Math.max(progress, 0), 1);
    path.getPointAt(p, camera.position);
    // Look along the path's direction, which stays defined at its very end.
    ahead.copy(path.getTangentAt(p)).add(camera.position);
    camera.lookAt(ahead);
    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };

  resize();

  return {
    setProgress(next) {
      progress = next;
      render();
    },
    resize,
    dispose() {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
