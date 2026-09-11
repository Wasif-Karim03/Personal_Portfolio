# wasifkarim.com — Storyboard v1

A scroll-driven story: open on Wasif today, rewind to 2022, play forward to now, then show the work, the resume, and a way to reach him.

## The one rule

**AI for atmosphere. Real footage for proof. Robot data for identity.**

Every scene is tagged with where its visuals come from:

- `REAL`: filmed or photographed by you. Your face, your hardware, your documents.
- `CC`: photographed by someone else and used under a Creative Commons licence, credited on the photo and in the colophon.
- `AI`: generated in Higgsfield. Only for things nobody could film: the flight, transitions, mood.
- `DATA`: output from your own robots and tools. YOLO detections, LiDAR point clouds, Gaussian splats.
- `CODE`: drawn live in the browser. Counters, lines, maps, text.

Your face comes from real footage and photos in `assets/raw/real/face/`. AI-generated shots of your face are allowed only for internal mockups that never ship, or for specific past scenes you approve one at a time — never the hero, the resume scene, or any "now" shot. Where a past scene needs "you" and there's no real photo, the default is still to appear from behind or in silhouette. Anything AI-generated that ships is listed in the colophon. Full rule: `CLAUDE.md`.

## Design system

- **Concept:** engineering drawing. Warm off-white paper (#F2EFE8), near-black ink (#141414), one accent in signal orange (#FF4F00).
- **Robot-vision layer:** everything the robot "sees" is drawn in orange, including detection boxes, point clouds, coordinates, and route lines. This keeps the robotics identity running through every chapter.
- **Type:** a tight grotesk for headlines, a clean sans for body text, and a monospace for labels, dates, and coordinates.
- **Chapter labels:** each chapter is a figure on the drawing sheet: FIG. 01, FIG. 02, and so on.
- **Nav:** always visible, with WORK / ABOUT / RESUME / CONTACT. "Work" jumps straight to projects, skipping the story.

---

## The scenes

**Visual direction (September 2026):** every picture is one point cloud, Gaussian-splat style, that changes shape from scene to scene as you scroll. The portraits are built from real photos; the rest is geometry drawn in code. No photo or video is shown as it was taken. The filming-day shot list and the Higgsfield plan below are kept for reference but are no longer the plan.

| # | Chapter | What happens on scroll | Source | Technique |
|---|---|---|---|---|
| 00 | Boot | A few lines of a boot log type out while assets load, then clear. | CODE | Text animation, doubles as the loading screen |
| 01 | Now · Cleveland, 2026 | You, as a point cloud built from a real photo, gather out of nothing as the page opens. An orange detection box holds you, labelled with the detector's own confidence. Your name and one line. Metadata: AI Research Engineer, OpsiClear · Cleveland, OH. | REAL + DATA | Point cloud from a photo: depth, matting and detection run locally |
| 02 | Rewind | The cloud winds into a spiral while a timecode spins from the present back to 2022. | CODE | Point-cloud spiral, timecode on scroll |
| 03 | Accepted · 2022 | The acceptance letter as a cloud of points (no logo, no signature), the lines that matter in orange: Ohio Wesleyan University, CS + Astrophysics, Schubert Scholarship. | CODE | Point cloud drawn from the letter's layout |
| 04 | The flight · 10 AUG 2022 | The cloud becomes the globe. An orange route draws from Bangladesh to Ohio as you scroll, with coordinates ticking, landing on Delaware, OH. | CODE | Point-cloud globe from Natural Earth, route revealed on scroll |
| 05 | Ohio Wesleyan · 2022–26 | The cloud builds OWU's student observatory. The degree and a short line of coursework. | CODE | Point cloud from simple geometry |
| 06 | Robotics Club | A rover in points, LiDAR on its mast. Counters roll up from 0 to 267 members and from $0 to $68K raised. Label: Founding President. | CODE | Point-cloud rover, counters on scroll |
| 07 | Summer 2023 · Leland | Software Development Intern at Leland, a software company: the first summer in the US and the first software job, shown as the initial commit in a git log. | CODE | Git log entry typed out |
| 08 | Summer 2024 · Hilton | Software Engineering Intern. An API request animates through a small diagram: app → endpoint → PostgreSQL. 6 REST endpoints, Tableau dashboard, CI/CD. | CODE | Animated diagram, no internal screens |
| 09 | Summer 2025 · Airbnb | Software Engineering Intern. A generic message box where an AI draft types itself out, then a host edits it. 10 production PRs behind feature flags, Java/Kotlin microservices. | CODE | Generic mock UI, not Airbnb's real interface |
| 10 | Parallel tracks | A git-branch graph shows work that ran alongside school: OWU dev internship, Bytewright. | CODE | SVG branch lines drawn on scroll |
| 11 | Graduation · May 2026 | A point-cloud portrait from the graduation photo. B.S. Astrophysics, B.A. Computer Science, GPA 3.82, Honors. | REAL + DATA | Point cloud from a photo, a quiet, held moment |
| 12 | think[box] · 2026 | The volumetric printer in points: a part cures inside the turning vial as you scroll. And Poetry Camera. | CODE | Point cloud, the part revealed on scroll |
| 13 | OpsiClear · Now | The timecode catches up to the present, and the cloud returns to the opening portrait: the rewind loop closes. | REAL + DATA | The opening point cloud again |
| 14 | Work | Transition: the page flies through a point cloud from your car's LiDAR and lands on the project index. | DATA | three.js points |
| 15 | Resume | The resume as a sheet of points, the download mark in orange, and the link to the PDF. | CODE | Point cloud drawn from the page layout, plus PDF link |
| 16 | Contact | An email-compose window: To: Wasif, with subject and body fields. It really sends. Your plain email address and links are shown below. | CODE | Formspree or Resend |

### Project index (scene 14)

Each project is a card that opens a full case study page. Suggested order, with robotics first:

1. **Autonomous Vehicle.** Your ROS2 stack on the Traxxas and Jetson Orin Nano. Frame it as a live build log, since it's in progress. Real driving footage, the car's own camera POV with YOLO boxes, and a LiDAR map.
2. **Poetry Camera.** Porting a cloud-LLM camera to on-device inference.
3. **Volumetric resin printer control software** (with UC Berkeley).
4. **OnlySwap.** A verified student marketplace, 245+ users.
5. **VersityRooms.**
6. **Bytewright.** The software studio you co-founded.

*You pick the final set. Four to six is the sweet spot.*

### Case study page template

Each page covers: the problem, the constraints, the system (with a diagram), what broke, how you fixed it, the result, and process media. The media is what sells it: photos of the build, failures, and wiring, not just the finished thing.

---

## Filming day shot list

Setup: phone on a tripod, 4K at 60fps, locked exposure and focus, even soft light, plain light wall. Wear the same outfit in every "now" shot.

| ID | Shot | Length | Used in |
|---|---|---|---|
| A | Hero: you facing slightly away, slowly turning to the camera, ending on a steady look | 8–10s, do 5+ takes | 01, 02 |
| B | Walk into frame from the side and stop | 5s | Transitions |
| C | Holding the resume, lifting it toward the camera | 6s | 15 |
| D | From behind: walking away, looking out a window | 5s each | 04, and past scenes |
| E | Macro: hands on wiring, Jetson, PCB, soldering | 3–5s each, several | 14, case studies |
| F | Car driving past, ground level, several passes | Multiple | 14, case study |
| G | Car POV from its own cameras, recorded on the Jetson | 30s+ | 14, case study |
| H | Poetry Camera taking a photo and printing | 10s | 12 |
| I | Volumetric printer rotating and curing | 10–20s | 12 |
| J | Top-down workbench, tools laid out | 5s | Case studies |

**Car battery:** you get about 30 minutes per charge, so shoot F and G first, with a charged pack ready.

**Data captures:**

- Run YOLO on take A and export the boxes per frame. This becomes the `person 0.96` overlay.
- Export a LiDAR scan from a rosbag to PLY, and decimate it so it loads fast on the web.
- Capture a splat of the car and of your bench with Scaniverse. It's free and processes on your phone.

**Photos to dig up from 2022:** the acceptance letter or email, the scholarship letter, airport or departure-day photos, first days on campus, and early robotics club events. Real photos from the day beat any AI shot of the same moment.

---

## Higgsfield generation plan

Keep AI to about six shots. Explore cheaply first, then render the finals in high quality.

**Plan: Higgsfield Starter** (270 credits/month; video limited to Seedance 2.0 Fast and Mini at 720p).

**Workflow: stills first, motion second.** Design each shot as a still in Nano Banana Pro (about 2 credits each). Only animate the stills you approve, using Seedance 2.0 Fast (17.5 credits per 5s at 720p, checked).

| ID | Shot | Still (Nano Banana Pro) | Motion (Seedance 2.0 Fast) |
|---|---|---|---|
| AI-1 | Silhouette at an airport gate window at dawn, plane beyond | Yes | Yes |
| AI-2 | Window seat view: night ocean, then clouds at sunrise | Yes | Yes |
| AI-3 | Descent over green summer Ohio farmland | Yes | Yes |
| AI-4 | Transition: start frame = last frame of your real clip, end frame = first frame of the next scene | No (uses real frames) | Yes, start + end frame |
| AI-5 | Two more transitions as needed | Maybe | Yes |

**Budget for one month:** about 20 stills (~40 credits) plus about 12 video clips (~210 credits) comes to ~250 of 270. That leaves little room for retries, so lock the stills before animating anything.

**720p is fine here,** because AI shots are transitions and atmosphere, never the sharp hero. Treat them in the site's style (monochrome or duotone, film grain, framed inside the drawing sheet rather than full-bleed) so the resolution never reads as soft. The sharp footage is your real 4K phone video.

**Billing:** the plan page says annual billing costs the same as monthly, so pay monthly and cancel when the shots are done. Subscribe only after filming day, when the real start frames exist.

**Tip:** default to keeping your face out of AI shots. Silhouettes and shots from behind avoid the identity-drift problem entirely. If a past scene genuinely needs your face and no real photo exists, it needs your per-scene approval and a colophon entry — see `CLAUDE.md`.

---

## Build stack

- **Framework:** Astro, deployed on Vercel at wasifkarim.com.
- **Motion:** GSAP (ScrollTrigger, SplitText, DrawSVG, MotionPath, all free now) plus Lenis for smooth scrolling.
- **Scrub scenes:** frames drawn on a canvas instead of seeking a video element, because it's more reliable when scrolling backward.
- **3D:** Spark for Gaussian splats, three.js Points for the LiDAR cloud.
- **Contact:** Formspree or Resend.

### Non-negotiables

- Scroll speed is never taken over. Animations follow the scroll; they don't control it.
- The "Work" link is always one click away.
- Mobile gets lighter versions: fewer frames, and splats load only when tapped.
- `prefers-reduced-motion` gets a calm, static version of the site.
- No internal screenshots or logos from Hilton, Airbnb, or OpsiClear. Use diagrams and generic UI instead. Get OpsiClear's okay before showing anything from work.

---

## Before we build

1. ~~Leland: what was it?~~ Software Development Intern, summer 2023, the first summer in the US.
2. ~~Bytewright, Polaris, or both?~~ Bytewright.
3. Final project list, 4 to 6 projects.
4. Update the resume with OpsiClear before it goes on the site.
5. Dig up the 2022 photos.
6. Filming day.
