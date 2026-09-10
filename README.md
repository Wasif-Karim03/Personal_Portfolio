# wasifkarim.com

A scroll-driven personal site: open on now, rewind to 2022, play forward, then
the work, the resume, and a way to get in touch.

The full storyboard — all 17 scenes, the shot list, and the media plan — is in
[`docs/storyboard.md`](docs/storyboard.md). Working rules for contributors and
coding agents are in [`CLAUDE.md`](CLAUDE.md).

## Running it

Requires Node 24 (see `.node-version`) and pnpm.

```sh
pnpm install
pnpm dev      # dev server
pnpm build    # static build to dist/
pnpm check    # astro + typescript diagnostics
```

## How it is put together

- **Astro**, static output, deployed on Vercel.
- **GSAP** (ScrollTrigger, SplitText, DrawSVG, MotionPath) and **Lenis**, both
  set up in `src/lib/motion.ts`. Motion never takes over scroll speed, and it
  does not start at all under `prefers-reduced-motion`.
- **`src/data/scenes.ts`** is the spine. Both the story page and `/colophon`
  read from it, so an AI-generated shot cannot ship without being disclosed.
  `assertFaceRule()` fails the build if one tries.
- **Plain CSS** with design tokens in `src/styles/tokens.css`. No utility
  framework: nearly every scene is bespoke canvas and SVG, and Astro already
  scopes component styles.

## Media

Raw source photos and footage are **not** in this repo — they run to hundreds of
megabytes. `assets/raw/` is gitignored; originals live outside git, and only
optimized web-sized derivatives get committed.
