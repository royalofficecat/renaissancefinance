// Makes 1080 x 1920 viewing copies (high-quality downscale) of the 2x frames in a folder.
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = process.argv[2]; const out = dir + '/preview'; mkdirSync(out, { recursive: true });
for (const f of readdirSync(dir).filter(f => f.endsWith('.png'))) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', `${dir}/${f}`, '-vf', 'scale=1080:1920:flags=lanczos', `${out}/${f}`]);
console.log('previews in', out);
