// Steps the scene's virtual clock one frame at a time with Playwright and saves lossless PNGs.
//   node render/capture.mjs --styleframes            three full-size look-development frames
//   node render/capture.mjs --contact [--safe]       14 stills + a labelled contact sheet
//   node render/capture.mjs --all                    every frame to out/frames/
//   node render/capture.mjs --frames 100-160         a range of frames
//   node render/capture.mjs --times 1.5,29.5         specific seconds (for fixes)
// Options: --pr 2 (pixel ratio; 2 renders at 2160 x 3840), --safe (safe-zone overlay), --out DIR
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };
const FPS = 30, TOTAL = 64 * FPS;
const PR = Number(opt('pr', 2));
const SAFE = !!opt('safe', false);

let frames = [], outDir = opt('out', null), mode = 'frames';
if (opt('styleframes', false)) { mode = 'style'; frames = [1.5, 29.5, 46.4].map(s => Math.round(s * FPS)); outDir ??= 'out/styleframes'; }
else if (opt('contact', false)) { mode = 'contact'; frames = Array.from({ length: 14 }, (_, i) => Math.round((i + 0.5) * TOTAL / 14)); outDir ??= 'out/contact'; }
else if (opt('times', false)) { mode = 'contact'; frames = String(opt('times')).split(',').map(s => Math.round(Number(s) * FPS)); outDir ??= 'out/fixes'; }
else if (opt('frames', false)) { const [a, b] = String(opt('frames')).split('-').map(Number); frames = Array.from({ length: b - a + 1 }, (_, i) => a + i); outDir ??= 'out/frames'; }
else if (opt('all', false)) { frames = Array.from({ length: TOTAL }, (_, i) => i); outDir ??= 'out/frames'; }
else { console.error('nothing to do: pass --styleframes, --contact, --all, --frames a-b or --times s,s'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

execFileSync('node', ['render/build.mjs'], { stdio: 'inherit' });
const { server, port } = await serve();
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: PR });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
page.on('crash', () => { console.error('browser page crashed (usually out of memory in the software renderer)'); });
await page.goto(`http://127.0.0.1:${port}/scene/index.html?pr=${PR}${SAFE ? '&safe=1' : ''}`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error('scene failed to load:\n' + err); process.exit(1); }

const t0 = Date.now();
for (let i = 0; i < frames.length; i++) {
  const n = frames[i];
  try { await page.evaluate(n => window.__render(n), n); }
  catch (e) { console.error('render failed at frame', n, '-', e.message.split('\n')[0]); if (errors.length) console.error('console so far:\n  ' + [...new Set(errors)].join('\n  ').slice(0, 3000)); process.exit(1); }
  const file = `${outDir}/${mode === 'frames' ? 'f' + String(n).padStart(5, '0') : 't' + (n / FPS).toFixed(2).replace('.', '_')}.png`;
  await page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide' });
  if (i % 10 === 0 || i === frames.length - 1) {
    const el = (Date.now() - t0) / 1000, per = el / (i + 1);
    console.log(`frame ${n} (${(n / FPS).toFixed(2)} s) -> ${file}   ${(per).toFixed(1)} s/frame, ~${((frames.length - i - 1) * per / 60).toFixed(0)} min left`);
  }
}
if (errors.length) { console.log('\nbrowser console messages:'); [...new Set(errors)].slice(0, 20).forEach(e => console.log('  ' + e.slice(0, 300))); }
writeFileSync(`${outDir}/frames.json`, JSON.stringify({ frames, fps: FPS, pr: PR, safe: SAFE }));
await browser.close(); server.close();
console.log('done:', frames.length, 'frames in', outDir);
