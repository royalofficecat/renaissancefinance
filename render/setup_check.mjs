// Makes sure the Python tools and prepared map data exist before a full render.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
if (!fs.existsSync(path.join(ROOT, '.venv/bin/python'))) {
  console.log('Creating the Python environment (.venv) ...');
  run('python3 -m venv .venv && .venv/bin/pip install -q numpy==2.2.6 pillow==11.3.0 scipy==1.15.3 shapely==2.1.1 pyproj==3.7.1');
}
const need = ['ca_height.i16', 'ca_masks.png', 'ca_extra.png', 'ca_lakes.png', 'ca_vectors.json', 'globe_land.png', 'shasta_height.f32', 'shasta_basin.png'];
if (need.some((f) => !fs.existsSync(path.join(ROOT, 'data/build', f)))) {
  console.log('Preparing map data (downloads open data the first time) ...');
  run('npm run data');
}
console.log('setup ok');
