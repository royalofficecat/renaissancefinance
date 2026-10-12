// Render chosen frames as full-size PNG stills.
// Usage: node render/stills.mjs <outdir> <frame> [frame...] [--dpr=1] [--safe] [--video=cat-kingdom] [--q=lab=1]
import fs from 'node:fs';
import path from 'node:path';
import { bundle, openPage, serve, shoot, videoArg } from './lib.mjs';

const args = process.argv.slice(2);
const dpr = parseFloat((args.find((a) => a.startsWith('--dpr=')) || '--dpr=2').slice(6));
const safe = args.includes('--safe');
const query = (args.find((a) => a.startsWith('--q=')) || '--q=').slice(4);
const [outdir, ...frames] = args.filter((a) => !a.startsWith('--'));
fs.mkdirSync(outdir, { recursive: true });

const video = videoArg();
await bundle(video);
const { server, port } = await serve();
const t0 = Date.now();
const { browser, page, errors } = await openPage(port, { dpr, safe, video, query });
console.log(`scene loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const f of frames.map(Number)) {
  const t = Date.now();
  const file = path.join(outdir, `f${String(f).padStart(4, '0')}${safe ? '_safe' : ''}${query ? '_' + query.replace(/[^a-z0-9]+/gi, '-') : ''}.png`);
  await shoot(page, f, file);
  console.log(`frame ${f} -> ${file} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
}
if (errors.length) console.log('page messages:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
server.close();
