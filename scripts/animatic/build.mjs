#!/usr/bin/env node
/**
 * Builds the story animatic: a rough cut of the scroll story as a video, to
 * preview it before anything is filmed or animated. Zero credits: it only
 * assembles the picked AI stills, real photos and title cards drawn in the
 * site's design system, with the site's own fonts.
 *
 *   node scripts/animatic/build.mjs v1    stills with a slow push-in
 *   node scripts/animatic/build.mjs v2    motion clips swapped in where they exist
 *
 * Writes docs/preview/animatic-<version>.mp4 (kept out of git). Needs ffmpeg and
 * Google Chrome; the cards are rendered in headless Chrome, since this ffmpeg
 * has no text filter.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const version = process.argv[2] ?? 'v1';
const work = join(root, 'docs/preview', `build-${version}`);
mkdirSync(work, { recursive: true });
const FPS = 24;
const FADE = 0.3;

/** The picked stills, and the clips that replace them in v2. */
const PICKS = { 'AI-1': 'AI-1_v2', 'AI-2': 'AI-2_v1', 'AI-3': 'AI-3_v2' };
const clipFor = (shot) => join(root, 'assets/raw/ai', `${shot}_motion.mp4`);

const FLIGHT = 'FIG. 04 · The flight · 10 Aug 2022';

// The story in order. Facts are from the resume and docs/storyboard.md.
const segments = [
  { kind: 'card', dur: 3.5, card: { fig: 'FIG. 00 · Boot', tags: ['CODE'], boot: ['> wasifkarim.com', '> loading scenes 00–16 ......... ok', '> person detector ............. ok', '> ready'] } },
  {
    kind: 'photo', dur: 6,
    photo: { src: 'assets/raw/derived/now/photo.jpg', detection: 'assets/raw/derived/now/detection.json', position: 'north' },
    card: { fig: 'FIG. 01 · Now · Cleveland, 2026', tags: ['REAL', 'DATA'], head: 'Wasif Karim', facts: ['AI Research Engineer · OpsiClear', 'Production services, AI features, robots.'] },
  },
  { kind: 'rewind', dur: 4.5 },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 03 · Accepted · 2022', tags: ['REAL'], head: 'Accepted', facts: ['Ohio Wesleyan University', 'CS <b>+</b> Astrophysics', 'Schubert Scholarship'], placeholder: 'The 2022 acceptance letter, macro, with drawing-style callouts' } },
  { kind: 'ai', shot: 'AI-1', dur: 5, label: [FLIGHT, 'AI-1 · Departure'] },
  { kind: 'ai', shot: 'AI-2', dur: 5, label: [FLIGHT, 'AI-2 · Crossing'] },
  { kind: 'ai', shot: 'AI-3', dur: 5, label: [FLIGHT, 'AI-3 · Arrival'] },
  { kind: 'card', dur: 4.5, card: { fig: FLIGHT, tags: ['CODE'], head: 'Dhaka <b>→</b> Delaware, OH', facts: ['12,851 km, great circle', 'The route draws on scroll, coordinates ticking'] } },
  {
    kind: 'photo', dur: 5,
    photo: { src: 'assets/raw/real/face/20260509_154903.jpg', position: 'centre' },
    card: { fig: 'FIG. 05 · Ohio Wesleyan · 2022–26', tags: ['REAL'], head: 'Ohio Wesleyan', facts: ['B.S. Astrophysics', 'B.A. Computer Science', 'ML · Computer Vision · NLP · Databases'] },
  },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 06 · Robotics Club', tags: ['REAL', 'CODE'], head: 'Founding President', facts: ['0 <b>→</b> 267 members', '$0 <b>→</b> $68K raised'] } },
  { kind: 'card', dur: 3.5, card: { fig: 'FIG. 07 · Summer 2023', tags: ['TBD'], head: 'Summer 2023 · TBD', facts: [] } },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 08 · Summer 2024 · Hilton', tags: ['CODE'], head: 'Software Engineering Intern', facts: ['App <b>→</b> /api <b>→</b> PostgreSQL', '6 REST endpoints · Tableau dashboard · CI/CD'] } },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 09 · Summer 2025 · Airbnb', tags: ['CODE'], head: 'The model drafts, the host decides', facts: ['10 production PRs behind feature flags', 'Java / Kotlin microservices'] } },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 10 · Parallel tracks · 2022–26', tags: ['CODE'], head: 'Alongside school', facts: ['OWU dev internship · 30+ users, 6 departments', 'Co-founded Bytewright · CTO · 5 client projects'] } },
  {
    kind: 'photo', dur: 5.5,
    photo: { src: 'assets/raw/derived/graduation/photo.jpg', detection: 'assets/raw/derived/graduation/detection.json', position: 'centre' },
    card: { fig: 'FIG. 11 · Graduation · May 2026', tags: ['REAL'], head: 'Graduated', facts: ['B.S. Astrophysics · B.A. Computer Science', 'GPA 3.82 · Honors'] },
  },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 12 · think[box] · 2026', tags: ['REAL'], head: 'think[box]', facts: ['Volumetric resin printer, with UC Berkeley', 'Poetry Camera'], placeholder: 'The volumetric printer curing a part in one rotation; Poetry Camera printing a poem' } },
  { kind: 'card', dur: 4.5, card: { fig: 'FIG. 13 · OpsiClear · Now', tags: ['DATA'], head: 'Back to now', facts: ['The timecode catches up to the present', 'A Gaussian splat resolves out of points'] } },
  { kind: 'card', dur: 4.5, card: { fig: 'FIG. 14 · Work', tags: ['DATA'], head: 'The work', facts: ["A fly-through of the car's LiDAR point cloud", 'Lands on the project index'] } },
  { kind: 'card', dur: 5, card: { fig: 'FIG. 15 · Resume', tags: ['REAL'], head: 'Resume', facts: ['The paper becomes the download button'], placeholder: 'Holding the resume up toward the camera' } },
  { kind: 'card', dur: 5.5, card: { fig: 'FIG. 16 · Contact', tags: ['CODE'], head: 'Say hello', facts: ['An email window that really sends', 'mdwasifkarim2003@gmail.com'] } },
];

// ---- Cards, drawn in headless Chrome with the site's fonts and colours.

const font = (path) => pathToFileURL(require.resolve(path)).href;
const studio = join(work, 'studio.html');
writeFileSync(studio, `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Archivo'; src: url(${font('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: 'Chivo Mono'; src: url(${font('@fontsource-variable/chivo-mono/files/chivo-mono-latin-wght-normal.woff2')}) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; width: 1280px; height: 720px; background: transparent; }
* { box-sizing: border-box; }
.card { position: relative; width: 1280px; height: 720px; padding: 64px 72px; background: #F2EFE8; color: #141414; font-family: 'Archivo'; overflow: hidden; }
.card::after { content: ''; position: absolute; inset: 22px; border: 1px solid rgba(20,20,20,.28); }
.mono { font-family: 'Chivo Mono'; }
.fig { font-family: 'Chivo Mono'; font-size: 19px; letter-spacing: .12em; text-transform: uppercase; color: #b83800; }
.tags { position: absolute; top: 64px; right: 72px; font-family: 'Chivo Mono'; font-size: 17px; letter-spacing: .08em; color: rgba(20,20,20,.6); }
.text { position: absolute; left: 72px; top: 150px; width: 1100px; }
.card--split .text { width: 560px; }
h1 { margin: 0 0 30px; font-stretch: 75%; font-weight: 700; font-size: 124px; line-height: .92; }
.card--split h1 { font-size: 100px; }
.facts p { margin: 0 0 10px; font-family: 'Chivo Mono'; font-size: 26px; line-height: 1.45; }
.card--split .facts p { font-size: 22px; }
b { color: #FF4F00; font-weight: 500; }
.boot { margin: 0; font-family: 'Chivo Mono'; font-size: 30px; line-height: 1.7; }
.boot span:last-child { color: #FF4F00; }
.frame { position: absolute; left: 686px; top: 106px; width: 532px; height: 544px; border: 2px solid #141414; }
.ph { position: absolute; left: 688px; top: 108px; width: 528px; height: 540px; border: 2px dashed rgba(20,20,20,.45); display: grid; place-content: center; gap: 18px; padding: 48px; text-align: center; font-family: 'Chivo Mono'; font-size: 22px; line-height: 1.5; color: #141414; }
.ph__label { color: #b83800; letter-spacing: .14em; font-size: 20px; }
.foot { position: absolute; left: 72px; right: 72px; bottom: 44px; display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(20,20,20,.28); font-family: 'Chivo Mono'; font-size: 14px; letter-spacing: .08em; color: rgba(20,20,20,.6); text-transform: uppercase; }
.date { position: absolute; left: 72px; top: 200px; font-stretch: 75%; font-weight: 700; font-size: 250px; line-height: 1; font-variant-numeric: tabular-nums; }
.clock { position: absolute; left: 80px; top: 470px; font-family: 'Chivo Mono'; font-size: 34px; letter-spacing: .1em; color: rgba(20,20,20,.6); font-variant-numeric: tabular-nums; }
.chip { position: absolute; left: 40px; bottom: 40px; padding: 12px 16px; background: #F2EFE8; font-family: 'Chivo Mono'; font-size: 16px; line-height: 1.6; letter-spacing: .08em; text-transform: uppercase; }
.chip span { display: block; }
.chip span:first-child { color: #b83800; }
</style></head><body><div id="stage"></div><script>
window.render = async (html) => {
  document.getElementById('stage').innerHTML = html;
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
};
</script></body></html>`);

const foot = (right = 'story preview · not the site') => `<div class="foot"><span>wasifkarim.com</span><span>${right}</span></div>`;

function cardHtml(c, photo = false) {
  const split = Boolean(c.placeholder || photo);
  const facts = (c.facts ?? []).map((f) => `<p>${f}</p>`).join('');
  const boot = c.boot ? `<pre class="boot">${c.boot.map((l) => `<span>${l}</span>`).join('\n')}</pre>` : '';
  const right = c.placeholder
    ? `<div class="ph"><span class="ph__label">REAL FOOTAGE</span><span>${c.placeholder}</span></div>`
    : photo ? '<div class="frame"></div>' : '';
  return `<div class="card${split ? ' card--split' : ''}"><div class="fig">${c.fig}</div><div class="tags">${c.tags.map((t) => `[${t}]`).join(' ')}</div><div class="text">${c.head ? `<h1>${c.head}</h1>` : ''}<div class="facts">${facts}</div>${boot}</div>${right}${foot()}</div>`;
}

const two = (v) => String(v).padStart(2, '0');
function rewindHtml(i, frames) {
  const from = Date.UTC(2026, 8, 11, 21, 4, 0);
  const to = Date.UTC(2022, 7, 10, 0, 0, 0);
  const t = Math.min(i / (frames * 0.8), 1);
  const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  const d = new Date(from + (to - from) * eased);
  const day = `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())}`;
  const clock = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), t < 1 ? (i * 7) % FPS : 0].map(two).join(':');
  return `<div class="card"><div class="fig">FIG. 02 · Rewind</div><div class="tags">[CODE]</div><div class="date">${day}</div><div class="clock">${clock}</div>${foot('2026 → 2022')}</div>`;
}

const chipHtml = (lines) => `<div class="chip">${lines.map((l) => `<span>${l}</span>`).join('')}<span>[AI] generated</span></div>`;

async function chrome() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, `.chrome-${port}`)}`,
    '--allow-file-access-from-files', '--hide-scrollbars', '--window-size=1280,720', '--no-first-run', 'about:blank',
  ], { stdio: 'ignore' });
  // Never leave a headless Chrome behind, even if a step below fails.
  process.on('exit', () => proc.kill());
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('headless Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: pathToFileURL(studio).href });
  await sleep(1500);
  return {
    async shot(html, out) {
      await send('Runtime.evaluate', { expression: `render(${JSON.stringify(html)})`, awaitPromise: true });
      const { result } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1280, height: 720, scale: 1 } });
      writeFileSync(out, Buffer.from(result.data, 'base64'));
    },
    close() { ws.close(); proc.kill(); },
  };
}

// ---- Photos: cropped into the card's frame, the detector's box drawn on.

// Below the source tags, so the panel never covers them.
const PANEL = { x: 688, y: 108, w: 528, h: 540 };
async function panelPhoto(spec, out) {
  const buffer = await sharp(join(root, spec.src)).rotate().toBuffer();
  const { width, height } = await sharp(buffer).metadata();
  const overlays = [];
  if (spec.detection) {
    const { person, width: dw } = JSON.parse(readFileSync(join(root, spec.detection), 'utf8'));
    const k = width / dw;
    const [x0, y0, x1, y1] = [person.box.xmin, person.box.ymin, person.box.xmax, person.box.ymax].map((v) => v * k);
    const stroke = width * 0.006;
    const size = width * 0.024;
    const tagY = Math.max(y0 - size * 1.5, 0);
    overlays.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#FF4F00" stroke-width="${stroke}"/>
      <rect x="${x0 - stroke / 2}" y="${tagY}" width="${size * 7.4}" height="${size * 1.5}" fill="#FF4F00"/>
      <text x="${x0 + size * 0.4}" y="${tagY + size * 1.1}" font-family="Menlo, monospace" font-size="${size}" fill="#141414">person ${person.score.toFixed(2)}</text>
    </svg>`) });
  }
  // Composite at full size first: sharp resizes before it composites.
  let framed = sharp(await sharp(buffer).composite(overlays).png().toBuffer());
  // With a detection, frame the person: the box with some air, at the panel's shape.
  if (spec.detection) {
    const { person, width: dw } = JSON.parse(readFileSync(join(root, spec.detection), 'utf8'));
    const k = width / dw;
    const [x0, y0, x1, y1] = [person.box.xmin, person.box.ymin, person.box.xmax, person.box.ymax].map((v) => v * k);
    let h = Math.min((y1 - y0) * 1.18, height);
    let w = h * (PANEL.w / PANEL.h);
    if (w > width) { w = width; h = w * (PANEL.h / PANEL.w); }
    const left = Math.round(Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), width - w));
    const top = Math.round(Math.min(Math.max(y0 - h * 0.1, 0), height - h));
    framed = framed.extract({ left, top, width: Math.round(w), height: Math.round(h) });
  }
  await framed.resize(PANEL.w * 2, PANEL.h * 2, { fit: 'cover', position: spec.position }).png().toFile(out);
}

// ---- Segments, then one pass of 0.3s dissolves.

const ffmpeg = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const encode = ['-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an'];
/** A slow push-in: rescaled every frame from a large source, so it doesn't jitter. */
const push = (dur, w, h, amount) => `scale=w='2*trunc(${w / 2}*(1+${amount}*t/${dur}))':h=-2:eval=frame,crop=${w}:${h}`;

const browser = await chrome();
const files = [];
let usedClips = 0;
for (const [i, s] of segments.entries()) {
  const n = String(i).padStart(2, '0');
  const out = join(work, `seg-${n}.mp4`);
  const dur = String(s.dur);
  if (s.kind === 'card') {
    await browser.shot(cardHtml(s.card), join(work, `card-${n}.png`));
    ffmpeg('-loop', '1', '-framerate', String(FPS), '-t', dur, '-i', join(work, `card-${n}.png`), ...encode, out);
  } else if (s.kind === 'photo') {
    await browser.shot(cardHtml(s.card, true), join(work, `card-${n}.png`));
    await panelPhoto(s.photo, join(work, `photo-${n}.png`));
    ffmpeg('-loop', '1', '-framerate', String(FPS), '-t', dur, '-i', join(work, `card-${n}.png`),
      '-loop', '1', '-framerate', String(FPS), '-t', dur, '-i', join(work, `photo-${n}.png`),
      '-filter_complex', `[1]${push(s.dur, PANEL.w, PANEL.h, 0.07)}[p];[0][p]overlay=${PANEL.x}:${PANEL.y}`, ...encode, out);
  } else if (s.kind === 'rewind') {
    const frames = Math.round(s.dur * FPS);
    mkdirSync(join(work, 'rewind'), { recursive: true });
    for (let f = 0; f < frames; f++) await browser.shot(rewindHtml(f, frames), join(work, 'rewind', `${String(f).padStart(3, '0')}.png`));
    ffmpeg('-framerate', String(FPS), '-i', join(work, 'rewind', '%03d.png'), ...encode, out);
  } else if (s.kind === 'ai') {
    await browser.shot(chipHtml(s.label), join(work, `chip-${n}.png`));
    const clip = clipFor(s.shot);
    if (version !== 'v1' && existsSync(clip)) {
      usedClips++;
      ffmpeg('-i', clip, '-loop', '1', '-framerate', String(FPS), '-i', join(work, `chip-${n}.png`),
        '-filter_complex', `[0]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=${FPS},setsar=1[v];[v][1]overlay=0:0:shortest=1`, '-t', dur, ...encode, out);
    } else {
      const base = join(work, `still-${n}.png`);
      await sharp(join(root, 'assets/raw/ai', `${PICKS[s.shot]}.png`)).resize(2560, 1440, { fit: 'cover' }).png().toFile(base);
      ffmpeg('-loop', '1', '-framerate', String(FPS), '-t', dur, '-i', base, '-loop', '1', '-framerate', String(FPS), '-t', dur, '-i', join(work, `chip-${n}.png`),
        '-filter_complex', `[0]${push(s.dur, 1280, 720, 0.08)}[v];[v][1]overlay=0:0`, ...encode, out);
    }
  }
  files.push({ out, dur: s.dur });
  process.stdout.write(`${n} `);
}
browser.close();

let chain = '';
let offset = 0;
let last = '[0:v]';
files.forEach((f, i) => {
  if (i === 0) return;
  offset += files[i - 1].dur - FADE;
  const label = i === files.length - 1 ? '[out]' : `[x${i}]`;
  chain += `${last}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${label};`;
  last = label;
});
const final = join(root, 'docs/preview', `animatic-${version}.mp4`);
ffmpeg(...files.flatMap((f) => ['-i', f.out]), '-filter_complex', chain.slice(0, -1), '-map', '[out]', ...encode, '-movflags', '+faststart', final);
const total = files.reduce((sum, f) => sum + f.dur, 0) - FADE * (files.length - 1);
console.log(`\n${final.replace(root + '/', '')}: ${files.length} segments, ${total.toFixed(1)}s${version !== 'v1' ? `, ${usedClips} motion clips` : ''}`);
