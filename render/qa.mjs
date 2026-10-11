// Post-encode checks on the final mp4: container facts, loudness, scene-cut scan, and a contact sheet from the file.
//   node render/qa.mjs out/final.mp4
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
const file = process.argv[2] || 'out/final.mp4';
const run = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' }).stderr;

// 1. container and streams
const probe = JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,nb_frames:format=duration,size', '-of', 'json', file], { encoding: 'utf8' }).stdout);
const v = probe.streams.find(s => s.width), a = probe.streams.find(s => !s.width);
const dur = Number(probe.format.duration);
const report = [];
report.push(`file: ${file}  size ${(statSync(file).size / 1e6).toFixed(1)} MB  duration ${dur.toFixed(2)} s`);
report.push(`video: ${v.codec_name} ${v.profile} ${v.width}x${v.height} ${v.r_frame_rate} fps ${v.pix_fmt}  frames ${v.nb_frames}`);
report.push(`audio: ${a.codec_name} ${a.profile || ''}`);
const ok = [];
ok.push([v.width === 1080 && v.height === 1920, '1080 x 1920']);
ok.push([v.r_frame_rate === '30/1', '30 fps']);
ok.push([dur >= 30 && dur <= 65, 'length 30-65 s']);
ok.push([v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p', 'h.264 high, yuv420p']);
ok.push([a.codec_name === 'aac', 'aac audio']);

// 2. loudness of the encoded audio
const lo = run(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
const I = Number((lo.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]), TP = Number((lo.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1]);
report.push(`loudness: ${I} LUFS integrated, true peak ${TP} dBTP`);
ok.push([I > -15 && I < -13, 'about -14 LUFS']); ok.push([TP <= -0.9, 'peaks under -1 dBTP']);

// 3. scene-cut scan: a big frame-to-frame change anywhere but a planned set change is a pop or a snap
const PLANNED = [8, 12, 20, 36, 40, 44, 48, 60];
const sc = run(['-i', file, '-vf', "select='gt(scene,0.25)',showinfo", '-f', 'null', '-']);
const cuts = [...sc.matchAll(/pts_time:\s*([\d.]+)/g)].map(m => Number(m[1]));
const unplanned = cuts.filter(t => !PLANNED.some(p => Math.abs(t - p) < 0.08));
report.push(`scene cuts detected at: ${cuts.map(t => t.toFixed(2)).join(', ') || 'none'}`);
report.push(`unplanned cuts (possible pops/snaps): ${unplanned.map(t => t.toFixed(2)).join(', ') || 'none'}`);
ok.push([unplanned.length === 0, 'no unplanned cuts or pops']);

// 4. contact sheet from the encoded file
mkdirSync('out/final-contact', { recursive: true });
for (let i = 0; i < 14; i++) { const t = (i + 0.5) * dur / 14; execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', `out/final-contact/t${t.toFixed(2).replace('.', '_')}.png`]); }
execFileSync('node', ['render/contact-sheet.mjs', 'out/final-contact', '--title', 'Final mp4, 14 stills'], { stdio: 'ignore' });
report.push('contact sheet from the mp4: out/final-contact/contact-sheet.png');

report.push('', ...ok.map(([pass, what]) => `${pass ? 'PASS' : 'FAIL'}  ${what}`));
console.log(report.join('\n'));
writeFileSync('out/qa-report.txt', report.join('\n'));
