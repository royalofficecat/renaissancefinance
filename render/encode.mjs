// Joins the rendered frames and the mastered audio into the final mp4, then reports on it.
//   node render/encode.mjs [--frames out/frames] [--audio out/audio.wav] [--out out/final.mp4]
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const frames = opt('frames', 'out/frames'), audio = opt('audio', 'out/audio.wav'), out = opt('out', 'out/final.mp4');
const n = readdirSync(frames).filter(f => /^f\d{5}\.png$/.test(f)).length;
if (n !== 1920) console.warn(`warning: expected 1920 frames, found ${n}`);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-stats', '-y',
  '-framerate', '30', '-i', `${frames}/f%05d.png`, '-i', audio,
  '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p',
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out], { stdio: 'inherit' });
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,bit_rate:format=duration,size', '-of', 'json', out], { encoding: 'utf8' }).stdout;
const info = JSON.parse(probe);
console.log('\nfinal file:', out);
console.log(' size:', (statSync(out).size / 1e6).toFixed(1), 'MB');
console.log(' duration:', Number(info.format.duration).toFixed(2), 's');
for (const s of info.streams) console.log(' stream:', s.codec_name, s.profile || '', s.width ? `${s.width}x${s.height}` : '', s.r_frame_rate || '', s.pix_fmt || '', s.bit_rate ? Math.round(s.bit_rate / 1000) + ' kbps' : '');
