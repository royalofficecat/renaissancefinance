// Step B: render 14 stills spread across the video and tile them into one contact sheet.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openScene, ROOT } from './serve.mjs';

const OUT = path.join(ROOT, 'out', 'stills');
fs.mkdirSync(OUT, { recursive: true });
// opening frame, the path bend, one moment inside each later beat, and the end card = 15 frames
const TIMES = [0.0, 2.8, 6.9, 12.0, 15.8, 20.6, 25.0, 29.6, 33.6, 39.0, 43.2, 46.8, 52.0, 56.6, 60.8];
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;

const scene = await openScene();
for (const [i, t] of TIMES.entries()) {
  if (only && !only.includes(i)) continue;
  const f = path.join(OUT, `still_${String(i).padStart(2, '0')}_${t.toFixed(1)}s.png`);
  const t0 = Date.now(); await scene.frame(t, f); console.log(path.basename(f), Date.now() - t0, 'ms');
}
await scene.close();

// Contact sheet: 5 × 3 grid of 360×640 thumbnails with timestamps.
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort().map(f => path.join(OUT, f));
const inputs = files.flatMap(f => ['-i', f]);
const label = files.map((f, i) => {
  const t = path.basename(f).match(/_([\d.]+)s\.png/)[1];
  return `[${i}:v]scale=360:640,drawtext=text='${t}s':x=12:y=12:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8[v${i}]`;
});
const layout = files.map((_, i) => `${(i % 5) * 360}_${Math.floor(i / 5) * 640}`).join('|');
const filter = label.join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=${layout}[out]`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[out]', path.join(ROOT, 'out', 'contact_sheet.png')]);
console.log('contact sheet written');
