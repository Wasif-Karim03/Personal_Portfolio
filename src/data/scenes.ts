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
      'Wasif turns toward the camera as the page scrolls. An orange detection box tracks him, labeled person 0.96. Name and one line appear.',
    sources: ['REAL', 'DATA'],
    technique: 'Scroll-scrubbed image sequence; YOLO run on his own clip',
    status: 'blocked-on-media',
    blockedOn: 'Filming day shot A, plus a YOLO pass exporting per-frame boxes',
  },
  {
    fig: '02',
    slug: 'rewind',
    title: 'Rewind',
    summary:
      'A timecode spins from 2026 back to 2022. The hero clip plays in reverse and frames from later chapters flicker past.',
    sources: ['CODE'],
    technique: 'Counter plus reversed sequence',
    status: 'blocked-on-media',
    blockedOn:
      'Shot A, shared with FIG. 01 (placeholder frames for now), and frames from later chapters to flicker past once they exist.',
  },
  {
    fig: '03',
    slug: 'accepted',
    title: 'Accepted · 2022',
    summary:
      'The acceptance letter, redrawn as a line drawing with callouts: Ohio Wesleyan University, CS + Astrophysics, Schubert Scholarship.',
    // A drawing, not a copy: no logo, no signature, no invented wording. A photo
    // of the real letter in the accepted-letter slot replaces it; then this is REAL.
    sources: ['CODE'],
    technique: 'Letter drawn in SVG, with animated annotation lines',
    status: 'done',
  },
  {
    fig: '04',
    slug: 'flight',
    title: 'The flight · 10 AUG 2022',
    summary:
      'Wasif at an airport window, seen from behind. Cut to a globe where an orange line draws from Bangladesh to Ohio, coordinates ticking, landing on Delaware, OH.',
    sources: ['AI', 'CODE'],
    technique: 'Higgsfield shot plus SVG route drawn on scroll',
    status: 'blocked-on-media',
    blockedOn:
      'Higgsfield shots AI-1 to AI-3 for the airport and the window seat, generated after filming day. The route map is built.',
    aiShots: [
      {
        id: 'AI-1',
        description: 'Silhouette at an airport gate window at dawn, plane beyond',
        tool: 'Higgsfield — Nano Banana Pro still, Seedance 2.0 Fast motion',
        depictsPerson: true,
        ships: false,
      },
      {
        id: 'AI-2',
        description: 'Window seat view: night ocean, then clouds at sunrise',
        tool: 'Higgsfield — Nano Banana Pro still, Seedance 2.0 Fast motion',
        depictsPerson: false,
        ships: false,
      },
      {
        id: 'AI-3',
        description: 'Descent over green summer Ohio farmland',
        tool: 'Higgsfield — Nano Banana Pro still, Seedance 2.0 Fast motion',
        depictsPerson: false,
        ships: false,
      },
    ],
  },
  {
    fig: '05',
    slug: 'ohio-wesleyan',
    title: 'Ohio Wesleyan · 2022–26',
    summary: 'Campus photos, credited to their photographers. A short line of coursework.',
    sources: ['CC'],
    technique: 'Parallax photo stack, kept subtle',
    status: 'done',
  },
  {
    fig: '06',
    slug: 'robotics-club',
    title: 'Robotics Club',
    summary:
      'Counters roll from 0 to 267 members and $0 to $68K raised. Label: Founding President. Generated pictures of a build night, a competition and the workroom stand in until there are real club photos.',
    sources: ['AI', 'CODE'],
    technique: 'Counters on scroll',
    status: 'done',
    aiShots: [
      {
        id: 'AI-6',
        description: 'Hands assembling a small robot on a workbench. Hands only, no faces.',
        tool: 'Higgsfield — GPT Image 2',
        depictsPerson: false,
        ships: true,
      },
      {
        id: 'AI-7',
        description: 'A student-built robot on a competition field in a gym. No people.',
        tool: 'Higgsfield — GPT Image 2',
        depictsPerson: false,
        ships: true,
      },
      {
        id: 'AI-8',
        description: 'A robotics workroom table with robots under construction. No people.',
        tool: 'Higgsfield — GPT Image 2',
        depictsPerson: false,
        ships: true,
      },
    ],
  },
  {
    fig: '07',
    slug: 'leland',
    title: 'Summer 2023 · Leland',
    summary:
      'Software Development Intern at Leland, a software company. The first summer in the US, and the first job writing software: the initial commit.',
    sources: ['CODE'],
    technique: 'A git log entry that types itself out',
    status: 'done',
  },
  {
    fig: '08',
    slug: 'hilton',
    title: 'Summer 2024 · Hilton',
    summary:
      'Software Engineering Intern. An API request animates through a small diagram: app → endpoint → PostgreSQL. 6 REST endpoints, Tableau dashboard, CI/CD.',
    sources: ['CODE'],
    technique: 'Animated diagram, no internal screens',
    status: 'done',
  },
  {
    fig: '09',
    slug: 'airbnb',
    title: 'Summer 2025 · Airbnb',
    summary:
      'Software Engineering Intern. A generic message box where an AI draft types itself out, then a host edits it. 10 production PRs behind feature flags, Java/Kotlin microservices.',
    sources: ['CODE'],
    technique: "Generic mock UI, not Airbnb's real interface",
    status: 'done',
  },
  {
    fig: '10',
    slug: 'parallel-tracks',
    title: 'Parallel tracks',
    summary:
      'A git-branch graph shows work that ran alongside school: the OWU dev internship and Bytewright.',
    sources: ['CODE'],
    technique: 'SVG branch lines drawn on scroll',
    status: 'done',
  },
  {
    fig: '11',
    slug: 'graduation',
    title: 'Graduation · May 2026',
    summary:
      'A real photo. B.S. Astrophysics, B.A. Computer Science, GPA 3.82, Honors.',
    sources: ['REAL'],
    technique: 'A quiet, held moment',
    status: 'done',
  },
  {
    fig: '12',
    slug: 'thinkbox',
    title: 'think[box] · 2026',
    summary:
      'Real footage: the volumetric printer curing a part in one rotation, and Poetry Camera printing a poem.',
    sources: ['REAL'],
    technique: 'Short looping clips',
    status: 'blocked-on-media',
    blockedOn: 'Filming day shots H and I, the printer and Poetry Camera. The scene is built.',
  },
  {
    fig: '13',
    slug: 'opsiclear',
    title: 'OpsiClear · Now',
    summary:
      'The timecode catches up to the present and the rewind loop closes. A Gaussian splat resolves out of points.',
    sources: ['DATA'],
    technique: 'Spark splat viewer',
    status: 'blocked-on-media',
    blockedOn: 'Scaniverse splat capture; also needs OpsiClear sign-off',
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
  },
  {
    fig: '15',
    slug: 'resume',
    title: 'Resume',
    summary:
      'Real video of Wasif holding the resume toward the camera. The paper becomes the download button.',
    sources: ['REAL'],
    technique: 'Scrubbed clip plus PDF link',
    status: 'blocked-on-media',
    blockedOn:
      'Filming day shot C (placeholder frames for now), and the resume PDF needs OpsiClear added. The scene is built.',
  },
  {
    fig: '16',
    slug: 'contact',
    title: 'Contact',
    summary:
      'An email-compose window: To: Wasif, with subject and body fields. It really sends.',
    sources: ['CODE'],
    technique: 'Formspree, posted from a plain HTML form so it works without JS',
    status: 'blocked-on-decision',
    blockedOn:
      'A real Formspree form in PUBLIC_FORMSPREE_ENDPOINT. The form posts to a placeholder address for now, so a message fails and points to email instead.',
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
