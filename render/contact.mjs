// Step 3: render ~15 stills spread across the video (plain and with the safe-zone overlay)
// and assemble labelled contact sheets in out/contact/.
// Usage: node render/contact.mjs [--dpr=2] [--frames=45,200,...] [--video=cat-kingdom]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, bundle, openPage, serve, shoot, videoArg, videoPaths } from './lib.mjs';

const args = process.argv.slice(2);
const dpr = parseFloat((args.find((a) => a.startsWith('--dpr=')) || '--dpr=2').slice(6));
const framesArg = args.find((a) => a.startsWith('--frames='));
const video = videoArg();
const vp = videoPaths(video);
const DEFAULTS = {
  '': [45, 200, 270, 380, 480, 620, 740, 870, 1040, 1170, 1300, 1420, 1580, 1720, 1880],
  'cat-kingdom': [90, 250, 385, 495, 615, 720, 850, 985, 1100, 1235, 1340, 1470, 1590, 1720, 1880],
};
const TITLES = { '': 'California, 30 days of extreme rain', 'cat-kingdom': 'What if domestic cats took over California?' };
const FRAMES = framesArg ? framesArg.slice(9).split(',').map(Number) : DEFAULTS[video];
const dir = path.join(vp.out, 'contact');
for (const sub of ['plain', 'safe']) fs.mkdirSync(path.join(dir, sub), { recursive: true });

await bundle(video);
const { server, port } = await serve();
for (const safe of [false, true]) {
  const { browser, page } = await openPage(port, { dpr, safe, video });
  for (const f of FRAMES) {
    const file = path.join(dir, safe ? 'safe' : 'plain', `f${String(f).padStart(4, '0')}.png`);
    await shoot(page, f, file);
    process.stdout.write(`${safe ? 'safe' : 'plain'} ${f}  `);
  }
  await browser.close();
}
server.close();
console.log();
const py = fs.existsSync(path.join(ROOT, '.venv/bin/python')) ? path.join(ROOT, '.venv/bin/python') : 'python3';
for (const [sub, title] of [['plain', `Contact sheet: ${TITLES[video]}`], ['safe', 'Contact sheet with safe zones (red = keep text out)']]) {
  execFileSync(py, [path.join(ROOT, 'render/contact_sheet.py'), path.join(dir, sub), path.join(dir, `contact-sheet${sub === 'safe' ? '-safe' : ''}.png`), '--cols', '5', '--title', title, '--beats', vp.beats], { stdio: 'inherit' });
}
