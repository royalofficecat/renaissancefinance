// Delivery copies of a finished video: an upload copy (same look, capped bit rate so apps don't re-compress
// it harshly) and a small 720p copy for quick sharing. The master's audio is copied untouched (re-encoding AAC
// would push its true peak back up). Usage: node render/deliver.mjs [--video=cat-kingdom]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { videoArg, videoPaths } from './lib.mjs';

const video = videoArg();
const OUT = videoPaths(video).out;
const name = { '': 'california-30-days-of-rain', 'cat-kingdom': 'what-if-cats-took-over-california', 'utah-rain': 'what-if-it-rained-in-utah-for-30-days' }[video];
const src = path.join(OUT, `${name}.mp4`);
if (!fs.existsSync(src)) throw new Error(`missing ${src}: run render/render_all.mjs first`);
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit', cwd: OUT });
const color = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// Upload copy: H.264 High, CRF 18 with a 16 Mbit/s ceiling
ff(['-i', src, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '18', '-maxrate', '16M', '-bufsize', '32M', '-pix_fmt', 'yuv420p', ...color,
  '-c:a', 'copy', '-movflags', '+faststart', path.join(OUT, `${name}-upload.mp4`)]);
// 720p preview: two-pass 3.2 Mbit/s
const log = path.join(OUT, 'ffmpeg2pass');
const v720 = ['-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-b:v', '3200k', '-pix_fmt', 'yuv420p', ...color];
ff(['-i', src, ...v720, '-pass', '1', '-passlogfile', log, '-an', '-f', 'mp4', '/dev/null']);
ff(['-i', src, ...v720, '-pass', '2', '-passlogfile', log, '-c:a', 'copy', '-movflags', '+faststart', path.join(OUT, `${name}-preview-720p.mp4`)]);
for (const f of fs.readdirSync(OUT)) if (f.startsWith('ffmpeg2pass')) fs.rmSync(path.join(OUT, f));
for (const f of [`${name}.mp4`, `${name}-upload.mp4`, `${name}-preview-720p.mp4`]) console.log(f, `${(fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1)} MB`);
