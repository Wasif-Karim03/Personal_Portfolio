// Scrolls a page in headless Chrome and screenshots it, via the DevTools protocol.
// node scripts/dev/screenshot.mjs <url> <outDir> <width> <height> <reduced:0|1> <name=js-to-scroll> ...
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [url, outDir, w, h, reduced, ...steps] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500);
const profile = join(outDir, `.profile-${port}`);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars',
  `--window-size=${w},${h}`, '--use-angle=metal', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 60 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await sleep(250);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else events.push(m); });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
if (reduced === '1') await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.navigate', { url });
for (let i = 0; i < 80 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await sleep(100);
await sleep(3500);
for (const step of steps) {
  const [name, ...js] = step.split('=');
  if (js.length) await send('Runtime.evaluate', { expression: js.join('='), awaitPromise: true });
  await sleep(2600);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
  console.log('shot', name);
}
const logs = events.filter((e) => e.method === 'Runtime.consoleAPICalled' || e.method === 'Log.entryAdded' || e.method === 'Runtime.exceptionThrown')
  .map((e) => e.params.entry?.text ?? e.params.args?.map((a) => a.value ?? a.description).join(' ') ?? e.params.exceptionDetails?.exception?.description ?? '')
  .filter((t) => t && !/DevTools|Download the/.test(t));
if (logs.length) console.log('console:\n  ' + [...new Set(logs)].slice(0, 12).join('\n  '));
ws.close(); chrome.kill();
