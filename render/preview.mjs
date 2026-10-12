// A fast motion preview (animatic): every frame rendered at low pixel density, joined into a small MP4
// without sound. For checking timing, camera moves and transitions before the full-quality render.
// Usage: node render/preview.mjs [--video=cat-kingdom] [--dpr=0.5] [--workers=2] [--every=1]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bundle, openPage, serve, shoot, videoArg, videoPaths } from './lib.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const video = videoArg();
const vp = videoPaths(video);
const beats = JSON.parse(fs.readFileSync(vp.beats, 'utf8'));
const DPR = parseFloat(arg('dpr', '0.5')), WORKERS = parseInt(arg('workers', '2'), 10), EVERY = parseInt(arg('every', '1'), 10);
const dir = path.join(vp.out, 'preview');
fs.mkdirSync(dir, { recursive: true });
const name = (f) => path.join(dir, `f${String(f).padStart(4, '0')}.png`);

await bundle(video);
const { server, port } = await serve();
const todo = [];
for (let f = 0; f < beats.totalFrames; f += EVERY) if (!fs.existsSync(name(f))) todo.push(f);
const chunks = [];
for (let i = 0; i < todo.length; i += 30) chunks.push(todo.slice(i, i + 30));
console.log(`${todo.length} preview frames, ${WORKERS} workers, dpr ${DPR}`);
const t0 = Date.now();
let done = 0;
async function worker() {
  const { browser, page } = await openPage(port, { dpr: DPR, video });
  while (chunks.length) {
    for (const f of chunks.shift()) {
      await shoot(page, f, name(f) + '.tmp.png');
      fs.renameSync(name(f) + '.tmp.png', name(f));
      if (++done % 60 === 0) console.log(`${done}/${todo.length}  ${((Date.now() - t0) / 1000 / done).toFixed(2)} s/frame`);
    }
  }
  await browser.close();
}
await Promise.all(Array.from({ length: WORKERS }, worker));
server.close();
// join the frames (repeat each frame if only every n-th was rendered)
const list = path.join(dir, 'frames.txt');
const lines = [];
for (let f = 0; f < beats.totalFrames; f += EVERY) lines.push(`file '${name(f)}'`, `duration ${(EVERY / beats.fps).toFixed(5)}`);
fs.writeFileSync(list, lines.join('\n') + '\n');
const out = path.join(vp.out, `${video || 'video'}-preview-animatic.mp4`);
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=540:960:flags=lanczos,fps=${beats.fps}`,
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(`wrote ${out}`);
