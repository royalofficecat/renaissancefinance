// One command for the whole video: frames (parallel browsers, resumable) -> audio -> mp4 -> QA.
// Usage: node render/render_all.mjs [--workers=2] [--from=0] [--to=1920] [--force] [--skip-encode] [--video=cat-kingdom]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, bundle, openPage, serve, shoot, videoArg, videoPaths } from './lib.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const WORKERS = parseInt(arg('workers', '2'), 10);
const video = videoArg();
const vp = videoPaths(video);
const OUT = vp.out;
const beats = JSON.parse(fs.readFileSync(vp.beats, 'utf8'));
// per video: the soundtrack script and the finished file's name
const AUDIO = { '': 'audio/generate.py', 'cat-kingdom': 'audio/cat_kingdom.py', 'utah-rain': 'audio/utah_rain.py' }[video];
const MP4_NAME = { '': 'california-30-days-of-rain.mp4', 'cat-kingdom': 'what-if-cats-took-over-california.mp4', 'utah-rain': 'what-if-it-rained-in-utah-for-30-days.mp4' }[video];
const FROM = parseInt(arg('from', '0'), 10), TO = parseInt(arg('to', String(beats.totalFrames)), 10);
const FORCE = process.argv.includes('--force');
const framesDir = path.join(OUT, 'frames');
fs.mkdirSync(framesDir, { recursive: true });
const name = (f) => path.join(framesDir, `f${String(f).padStart(4, '0')}.png`);

await bundle(video);
const { server, port } = await serve();
const todo = [];
for (let f = FROM; f < TO; f++) if (FORCE || !fs.existsSync(name(f))) todo.push(f);
// Hand out work in 30-frame chunks so every worker renders long, contiguous stretches
const chunks = [];
for (let i = 0; i < todo.length; i += 30) chunks.push(todo.slice(i, i + 30));
console.log(`${todo.length} frames to render with ${WORKERS} workers`);
const t0 = Date.now();
let done = 0;
const logStream = fs.createWriteStream(path.join(framesDir, 'log.jsonl'), { flags: 'a' });
async function worker(id) {
  const { browser, page, errors } = await openPage(port, { dpr: 2, video });
  while (chunks.length) {
    const chunk = chunks.shift();
    for (const f of chunk) {
      const tmp = name(f) + '.tmp.png';
      await shoot(page, f, tmp);
      fs.renameSync(tmp, name(f));
      const info = await page.evaluate(() => window.__video.info());
      logStream.write(JSON.stringify(info) + '\n');
      done++;
      if (done % 20 === 0) {
        const el = (Date.now() - t0) / 1000, rate = done / el;
        console.log(`${done}/${todo.length} frames, ${rate.toFixed(2)} fps, about ${Math.round((todo.length - done) / rate / 60)} min left`);
      }
    }
  }
  if (errors.length) console.log(`worker ${id} page messages:`, [...new Set(errors)].filter((e) => !e.includes('404')).slice(0, 5));
  await browser.close();
}
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
logStream.end();
server.close();
console.log(`frames done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

if (!process.argv.includes('--skip-encode')) {
  const py = fs.existsSync(path.join(ROOT, '.venv/bin/python')) ? path.join(ROOT, '.venv/bin/python') : 'python3';
  execFileSync(py, [path.join(ROOT, AUDIO)], { stdio: 'inherit' });
  const mp4 = path.join(OUT, MP4_NAME);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(beats.fps), '-i', path.join(framesDir, 'f%04d.png'),
    '-i', path.join(OUT, 'audio/soundtrack.wav'),
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', '-shortest', mp4], { stdio: 'inherit' });
  console.log('wrote', mp4);
}
