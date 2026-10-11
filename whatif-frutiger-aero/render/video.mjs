// Step C: record every frame (1080×1920, 30 fps) and mux it with the generated soundtrack.
// Frames are rendered by several headless browsers in parallel; each one pipes its JPEG
// screenshots straight into its own ffmpeg, and the pieces are joined at the end.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { openScene, ROOT } from './serve.mjs';
import { FPS, TOTAL } from '../scene/beats.js';

const FRAMES = Math.round(TOTAL * FPS); // 1875
const WORKERS = Number(process.argv[2] || 3);
const OUT = path.join(ROOT, 'out');
const TMP = path.join(OUT, 'frames');
fs.mkdirSync(TMP, { recursive: true });

async function renderPart(w) {
  const from = Math.floor(FRAMES * w / WORKERS), to = Math.floor(FRAMES * (w + 1) / WORKERS);
  const file = path.join(TMP, `part${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  const scene = await openScene();
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    const jpg = await scene.frame(f / FPS, undefined, 'jpeg');
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - from) % 100 === 0) console.log(`worker ${w}: frame ${f}/${to - 1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end(); await done; await scene.close();
  return file;
}

execFileSync('node', [path.join(ROOT, 'render', 'audio.mjs')], { stdio: 'inherit' });
const parts = await Promise.all(Array.from({ length: WORKERS }, (_, w) => renderPart(w)));
fs.writeFileSync(path.join(TMP, 'parts.txt'), parts.map(p => `file '${p}'`).join('\n'));
const final = path.join(OUT, 'what-if-frutiger-aero.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'parts.txt'), '-i', path.join(OUT, 'soundtrack.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(TOTAL), '-movflags', '+faststart', final], { stdio: 'inherit' });
console.log('wrote', final);
