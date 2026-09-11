/**
 * The scene registry. Single source of truth for the scroll story.
 *
 * Both the story page and /colophon read from here, so an AI-generated shot
 * cannot ship without appearing in the colophon. See CLAUDE.md for the face rule.
 */

/**
 * Where a visual comes from. Mirrors the tags in docs/storyboard.md. CC is a
 * photo by someone else, used under a Creative Commons licence and credited.
 */
export type MediaSource = 'REAL' | 'CC' | 'AI' | 'DATA' | 'CODE';

export interface AiShot {
  /** Stable id matching the Higgsfield plan in docs/storyboard.md, e.g. 'AI-1'. */
  id: string;
  description: string;
  /** Tool that generated it, named in the colophon. */
  tool: string;
  /** Does a recognisable person appear? Gates the face rule in CLAUDE.md. */
  depictsPerson: boolean;
  /** False while this is an internal mockup that never leaves the repo. */
  ships: boolean;
  /**
   * ISO date Wasif approved this specific shot. Required by assertFaceRule()
   * when a person-shot ships.
   */
  approvedOn?: string;
}

export type SceneStatus =
  /** Built and signed off. */
  | 'done'
  /** Everything it needs exists; safe to build now. */
  | 'ready'
  /** Waiting on filming day or a data capture. */
  | 'blocked-on-media'
  /** Waiting on a decision from Wasif. */
  | 'blocked-on-decision';

export interface Scene {
  /** Figure number on the drawing sheet, e.g. '01'. */
  fig: string;
  slug: string;
  title: string;
  summary: string;
  sources: MediaSource[];
  technique: string;
  status: SceneStatus;
  /**
   * How the scene sits on the page. Almost everything is a scroll section; the
   * boot log is an overlay because it doubles as the loading screen.
   */
  presentation?: 'section' | 'overlay';
  /** What the scene is waiting on, when status is blocked. */
  blockedOn?: string;
  aiShots?: AiShot[];
  /**
   * The shape the point cloud takes for this scene: one generated in
   * src/lib/cloud-shapes.ts, or a file listed in src/data/clouds.json. 'none'
   * clears the stage.
   */
  cloud?: string;
  /** For a cloud that means something by itself, like a portrait: what it shows. */
  cloudAlt?: string;
}

export const scenes: Scene[] = [
  {
    fig: '00',
    slug: 'boot',
    title: 'Boot',
    summary: 'A few lines of a boot log type out while assets load, then clear.',
    sources: ['CODE'],
    technique: 'Text animation, doubles as the loading screen',
    status: 'done',
    presentation: 'overlay',
  },
  {
    fig: '01',
    slug: 'now',
    title: 'Now · Cleveland, 2026',
    summary:
      'Wasif as a point cloud, built from a real photo of him, gathers out of nothing as the page opens. An orange detection box holds him, labelled with the detector\'s own confidence. Name and one line.',
    sources: ['REAL', 'DATA'],
    technique: 'Point cloud from a photo: depth, matting and detection run locally',
    status: 'done',
    cloud: 'portrait-now',
    cloudAlt: 'A portrait of Wasif Karim made of points, built from a photograph of him.',
  },
  {
    fig: '02',
    slug: 'rewind',
    title: 'Rewind',
    summary: 'The cloud winds into a spiral while a timecode spins from the present back to 10 August 2022.',
    sources: ['CODE'],
    technique: 'Point-cloud spiral and a timecode on scroll',
    status: 'done',
    cloud: 'rewind',
  },
  {
    fig: '03',
    slug: 'accepted',
    title: 'Accepted · 2022',
    summary:
      'The acceptance letter as a cloud of points, the lines that matter in orange: Ohio Wesleyan University, CS + Astrophysics, Schubert Scholarship.',
    // A drawing, not a copy: no logo, no signature, no invented wording.
    sources: ['CODE'],
    technique: "Point cloud drawn from the letter's layout",
    status: 'done',
    cloud: 'letter',
  },
  {
    fig: '04',
    slug: 'flight',
    title: 'The flight · 10 AUG 2022',
    summary:
      'The cloud becomes the globe. An orange route draws from Bangladesh to Ohio as you scroll, coordinates ticking, landing on Delaware, OH.',
    sources: ['CODE'],
    technique: 'Point-cloud globe from Natural Earth; the route revealed with the scroll',
    status: 'done',
    cloud: 'globe',
  },
  {
    fig: '05',
    slug: 'ohio-wesleyan',
    title: 'Ohio Wesleyan · 2022–26',
    summary: "The cloud builds Ohio Wesleyan's student observatory, for the astrophysics. The degree and a line of coursework.",
    sources: ['CODE'],
    technique: 'Point cloud from simple geometry',
    status: 'done',
    cloud: 'observatory',
  },
  {
    fig: '06',
    slug: 'robotics-club',
    title: 'Robotics Club',
    summary:
      'A rover in points, LiDAR on its mast. Counters roll from 0 to 267 members and $0 to $68K raised. Label: Founding President.',
    sources: ['CODE'],
    technique: 'Point-cloud rover; counters on scroll',
    status: 'done',
    cloud: 'rover',
  },
  {
    fig: '07',
    slug: 'leland',
    title: 'Summer 2023 · Leland',
    summary:
      'Software Development Intern at Leland, a software company. The first summer in the US, and the first job writing software: the initial commit.',
    sources: ['CODE'],
    technique: 'A git log entry that types itself out; a laptop in points',
    status: 'done',
    cloud: 'laptop',
  },
  {
    fig: '08',
    slug: 'hilton',
    title: 'Summer 2024 · Hilton',
    summary:
      "Software Engineering Intern. The request's path in points: app → endpoint → PostgreSQL. 6 REST endpoints, Tableau dashboard, CI/CD.",
    sources: ['CODE'],
    technique: 'Point-cloud diagram, no internal screens',
    status: 'done',
    cloud: 'api',
  },
  {
    fig: '09',
    slug: 'airbnb',
    title: 'Summer 2025 · Airbnb',
    summary:
      'Software Engineering Intern. A generic message box where an AI draft types itself out, then a host edits it. 10 production PRs behind feature flags, Java/Kotlin microservices.',
    sources: ['CODE'],
    technique: "Generic mock UI, not Airbnb's real interface; message bubbles in points",
    status: 'done',
    cloud: 'chat',
  },
  {
    fig: '10',
    slug: 'parallel-tracks',
    title: 'Parallel tracks',
    summary: 'A git-branch graph shows work that ran alongside school: the OWU dev internship and Bytewright.',
    sources: ['CODE'],
    technique: 'SVG branch lines drawn on scroll; the same graph in points',
    status: 'done',
    cloud: 'branches',
  },
  {
    fig: '11',
    slug: 'graduation',
    title: 'Graduation · May 2026',
    summary:
      'A point-cloud portrait from the graduation photo. B.S. Astrophysics, B.A. Computer Science, GPA 3.82, Honors.',
    sources: ['REAL', 'DATA'],
    technique: 'Point cloud from a photo; a quiet, held moment',
    status: 'done',
    cloud: 'portrait-graduation',
    cloudAlt: 'A portrait of Wasif Karim in his graduation cap and gown, made of points, built from a photograph of him.',
  },
  {
    fig: '12',
    slug: 'thinkbox',
    title: 'think[box] · 2026',
    summary:
      'The volumetric printer in points: a part cures inside the turning vial as you scroll. And Poetry Camera.',
    sources: ['CODE'],
    technique: 'Point cloud from simple geometry; the part revealed with the scroll',
    status: 'done',
    cloud: 'printer',
  },
  {
    fig: '13',
    slug: 'opsiclear',
    title: 'OpsiClear · Now',
    summary:
      'The timecode catches up to the present, and the cloud returns to the portrait it opened on: the rewind loop closes.',
    sources: ['REAL', 'DATA'],
    technique: 'The opening point cloud, again',
    status: 'blocked-on-decision',
    blockedOn: "OpsiClear's okay before anything from the job is shown.",
    cloud: 'portrait-now',
  },
  {
    fig: '14',
    slug: 'work',
    title: 'Work',
    summary:
      "The page flies through a point cloud from the car's LiDAR and lands on the project index.",
    sources: ['DATA'],
    technique: 'three.js points',
    status: 'blocked-on-media',
    blockedOn:
      "The car's LiDAR scan, exported to PLY (placeholder cloud for now). The fly-through is built.",
    // The fly-through has its own canvas; the story's cloud steps aside for it.
    cloud: 'none',
  },
  {
    fig: '15',
    slug: 'resume',
    title: 'Resume',
    summary: 'The resume as a sheet of points, the download mark in orange, and the link to the PDF.',
    sources: ['CODE'],
    technique: 'Point cloud drawn from the page layout, plus PDF link',
    status: 'blocked-on-decision',
    blockedOn: 'The resume PDF needs OpsiClear added.',
    cloud: 'resume',
  },
  {
    fig: '16',
    slug: 'contact',
    title: 'Contact',
    summary:
      'An email-compose window: To: Wasif, with subject and body fields. It really sends. An open envelope in points.',
    sources: ['CODE'],
    technique: 'Formspree, posted from a plain HTML form so it works without JS',
    status: 'blocked-on-decision',
    blockedOn:
      'A real Formspree form in PUBLIC_FORMSPREE_ENDPOINT. The form posts to a placeholder address for now, so a message fails and points to email instead.',
    cloud: 'envelope',
  },
];

export const sceneBySlug = new Map(scenes.map((s) => [s.slug, s]));

/** Every AI shot declared anywhere in the story. */
export function allAiShots(): Array<AiShot & { scene: Scene }> {
  return scenes.flatMap((scene) =>
    (scene.aiShots ?? []).map((shot) => ({ ...shot, scene })),
  );
}

/** The AI shots that actually ship. These are what the colophon must list. */
export function shippingAiShots(): Array<AiShot & { scene: Scene }> {
  return allAiShots().filter((shot) => shot.ships);
}

/**
 * Enforces the face rule from CLAUDE.md at build time: a shipping AI shot with a
 * person in it needs Wasif's per-shot approval on record. Called from the
 * colophon page so a violation fails `astro build` rather than shipping quietly.
 */
export function assertFaceRule(): void {
  const unapproved = shippingAiShots().filter(
    (shot) => shot.depictsPerson && !shot.approvedOn,
  );

  if (unapproved.length > 0) {
    const list = unapproved
      .map((shot) => `  ${shot.id} (FIG. ${shot.scene.fig} ${shot.scene.title})`)
      .join('\n');
    throw new Error(
      `Face rule violation — see CLAUDE.md.\n` +
        `These AI shots depict a person and are set to ship, but have no approvedOn date:\n${list}\n` +
        `Either set approvedOn once Wasif approves that specific shot, or set ships: false.`,
    );
  }
}
