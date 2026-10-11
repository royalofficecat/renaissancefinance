// Bundles the scene (three.js + troika + our code) into one file the page loads.
import { build } from 'esbuild';
await build({ entryPoints: ['scene/main.js'], bundle: true, format: 'esm', outfile: 'scene/dist/bundle.js', sourcemap: 'inline', logLevel: 'info', target: 'es2022' });
