# wasifkarim.com

Scroll-driven personal site. Full storyboard and scene list: `docs/storyboard.md`.

## Stack

- Astro, deployed on Vercel at wasifkarim.com
- pnpm, Node 24 (pinned in `.node-version` and `package.json` `engines`)
- GSAP (ScrollTrigger, SplitText, DrawSVG, MotionPath) + Lenis for motion

## Media source rules

Every visual is tagged by where it comes from:

- `REAL` — filmed or photographed by Wasif. His face, his hardware, his documents.
- `CC` — photographed by someone else and used under a Creative Commons licence. Credited on the photo and in the colophon.
- `AI` — generated in Higgsfield. For things nobody could film: the flight, transitions, mood.
- `DATA` — output from his own robots and tools. YOLO detections, LiDAR point clouds, Gaussian splats.
- `CODE` — drawn live in the browser. Counters, lines, maps, text.

### Wasif's face

- Wasif's face comes from real footage and real photos in `assets/raw/real/face/`.
- AI-generated images of his face are allowed only for (a) internal mockups that never ship, or (b) specific past scenes Wasif approves one at a time. Never for the hero, the resume scene, or any "now" shot.
- Any AI-generated person-shot that ships is listed in the site's colophon ("How this site was made").

## Other non-negotiables

- Scroll speed is never taken over. Animations follow the scroll; they don't control it.
- The "Work" link is always one click away.
- `prefers-reduced-motion` gets a calm, static version of the site.
- No internal screenshots or logos from Hilton, Airbnb, or OpsiClear. Use diagrams and generic UI instead.
