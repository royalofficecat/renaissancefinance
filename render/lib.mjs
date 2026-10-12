// Shared render helpers: bundle the scene, serve the project folder, open a capture browser.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'out');

/** The first video lives in scene/src; later videos in scene/videos/<name>/. */
export const videoPaths = (video) => video
  ? { entry: path.join(ROOT, `scene/videos/${video}/main.js`), bundle: path.join(ROOT, `scene/dist/${video}.js`), page: `/scene/videos/${video}/index.html`, beats: path.join(ROOT, `scene/videos/${video}/beats.json`), out: path.join(OUT, video) }
  : { entry: path.join(ROOT, 'scene/src/main.js'), bundle: path.join(ROOT, 'scene/dist/bundle.js'), page: '/scene/index.html', beats: path.join(ROOT, 'scene/beats.json'), out: OUT };

export const videoArg = () => { const a = process.argv.find((x) => x.startsWith('--video=')); return a ? a.slice(8) : ''; };

export async function bundle(video = '') {
  const vp = videoPaths(video);
  await esbuild.build({
    entryPoints: [vp.entry],
    bundle: true,
    format: 'esm',
    outfile: vp.bundle,
    loader: { '.json': 'json' },
    logLevel: 'warning',
    target: 'chrome120',
  });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.i16': 'application/octet-stream', '.f32': 'application/octet-stream' };

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

export function chromePath() {
  const base = '/opt/pw-browsers';
  const dir = fs.readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
  return path.join(base, dir, 'chrome-linux/chrome');
}

export async function openPage(port, { dpr = 2, safe = false, video = '' } = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb',
      '--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu-vsync', '--hide-scrollbars'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}${videoPaths(video).page}?dpr=${dpr}${safe ? '&safe=1' : ''}`);
  await page.waitForFunction(() => window.__videoReady || window.__videoError, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.__videoError);
  if (err) throw new Error('scene failed to load:\n' + err);
  return { browser, page, errors };
}

export async function shoot(page, frame, file) {
  await page.evaluate((f) => window.__video.renderFrame(f), frame);
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}
