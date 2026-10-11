// Downloads open map data and builds the terrain grid the scene uses.
//   Natural Earth (public domain) vectors -> data/*.json, trimmed to California
//   Terrain Tiles on AWS (Terrarium PNGs) -> data/terrain.bin (Float32 heights, metres) + data/terrain.json
// Downloads go through curl so the machine's proxy settings apply.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { project, unproject, mercPixel } from '../scene/proj.js';

const RAW = 'data/raw';
mkdirSync(RAW, { recursive: true });
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const BBOX = { w: -125.5, e: -113.5, s: 31.8, n: 42.6 };

function download(url, file) {
  if (existsSync(file)) return;
  console.log('fetch', url.split('/').pop());
  execFileSync('curl', ['-sSL', '--retry', '3', '-o', file, url], { stdio: 'inherit' });
}
function loadNE(name) {
  const f = `${RAW}/${name}.geojson`;
  download(NE + name + '.geojson', f);
  return JSON.parse(readFileSync(f, 'utf8'));
}
function bboxOf(geom) {
  let w = 180, e = -180, s = 90, n = -90;
  const walk = c => { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); };
  walk(geom.coordinates);
  return { w, e, s, n };
}
const overlaps = b => !(b.e < BBOX.w || b.w > BBOX.e || b.n < BBOX.s || b.s > BBOX.n);
function feat(f, props) { return { type: 'Feature', properties: props, geometry: f.geometry }; }

// 1. States and provinces: California plus the quiet neighbours
const states = loadNE('ne_10m_admin_1_states_provinces');
const keep = new Set(['California', 'Nevada', 'Oregon', 'Arizona', 'Baja California', 'Idaho', 'Utah', 'Sonora']);
writeFileSync('data/states.json', JSON.stringify({ type: 'FeatureCollection', features: states.features.filter(f => keep.has(f.properties.name)).map(f => feat(f, { name: f.properties.name })) }));

// 2. Land for the globe (50m) and a coarse version of states for globe outlines
const land = loadNE('ne_50m_land');
writeFileSync('data/land50.json', JSON.stringify({ type: 'FeatureCollection', features: land.features.map(f => feat(f, {})) }));

// 3. Rivers (two Natural Earth layers, de-duplicated by name) and lakes near California
const rivers = [...loadNE('ne_10m_rivers_lake_centerlines').features, ...loadNE('ne_10m_rivers_north_america').features]
  .filter(f => f.geometry && overlaps(bboxOf(f.geometry)))
  .map(f => feat(f, { name: f.properties.name || f.properties.name_en || '', rank: f.properties.scalerank, feature: f.properties.featurecla }));
writeFileSync('data/rivers.json', JSON.stringify({ type: 'FeatureCollection', features: rivers }));
const lakes = [...loadNE('ne_10m_lakes').features, ...loadNE('ne_10m_lakes_north_america').features]
  .filter(f => f.geometry && overlaps(bboxOf(f.geometry)))
  .map(f => feat(f, { name: f.properties.name || '', rank: f.properties.scalerank }));
writeFileSync('data/lakes.json', JSON.stringify({ type: 'FeatureCollection', features: lakes }));

// 4. Cities the brief needs (positions from Natural Earth populated places)
const places = loadNE('ne_10m_populated_places_simple');
const wanted = ['Los Angeles', 'San Francisco', 'Sacramento', 'Fresno', 'Bakersfield', 'San Diego', 'Redding', 'Stockton', 'San Jose', 'Santa Ana', 'Riverside', 'Modesto'];
const cities = places.features.filter(f => f.properties.adm1name === 'California' && wanted.includes(f.properties.name))
  .map(f => ({ name: f.properties.name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], pop: f.properties.pop_max }));
writeFileSync('data/cities.json', JSON.stringify(cities, null, 1));
console.log('vectors done:', rivers.length, 'rivers,', lakes.length, 'lakes,', cities.length, 'cities');

// 5. Terrain: Terrarium tiles at zoom 8, mosaicked, then resampled onto the Albers grid
const Z = 8, T = 256;
const [px0, py0] = mercPixel(BBOX.w, BBOX.n, Z), [px1, py1] = mercPixel(BBOX.e, BBOX.s, Z);
const tx0 = Math.floor(px0 / T), tx1 = Math.floor(px1 / T), ty0 = Math.floor(py0 / T), ty1 = Math.floor(py1 / T);
const MW = (tx1 - tx0 + 1) * T, MH = (ty1 - ty0 + 1) * T;
const mosaic = new Float32Array(MW * MH);
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
  const f = `${RAW}/terrarium_${Z}_${tx}_${ty}.png`;
  download(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`, f);
  const png = PNG.sync.read(readFileSync(f));
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4;
    mosaic[(ty - ty0) * T * MW + y * MW + (tx - tx0) * T + x] = png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
  }
}
function sampleMosaic(lon, lat) {
  const [px, py] = mercPixel(lon, lat, Z);
  const x = px - tx0 * T, y = py - ty0 * T;
  const x0 = Math.max(0, Math.min(MW - 2, Math.floor(x))), y0 = Math.max(0, Math.min(MH - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
  const a = mosaic[y0 * MW + x0], b = mosaic[y0 * MW + x0 + 1], c = mosaic[(y0 + 1) * MW + x0], d = mosaic[(y0 + 1) * MW + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
// Albers grid covering the projected bbox, 2 km cells
let xmin = 1e9, xmax = -1e9, ymin = 1e9, ymax = -1e9;
for (let lon = BBOX.w; lon <= BBOX.e; lon += 0.25) for (const lat of [BBOX.s, BBOX.n]) { const [x, y] = project(lon, lat); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
for (let lat = BBOX.s; lat <= BBOX.n; lat += 0.25) for (const lon of [BBOX.w, BBOX.e]) { const [x, y] = project(lon, lat); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
const CELL = 2;
const GW = Math.ceil((xmax - xmin) / CELL) + 1, GH = Math.ceil((ymax - ymin) / CELL) + 1;
const grid = new Float32Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const [lon, lat] = unproject(xmin + i * CELL, ymin + j * CELL);
  grid[j * GW + i] = sampleMosaic(lon, lat);
}
writeFileSync('data/terrain.bin', Buffer.from(grid.buffer));
writeFileSync('data/terrain.json', JSON.stringify({ width: GW, height: GH, cell: CELL, xmin, ymin, xmax: xmin + (GW - 1) * CELL, ymax: ymin + (GH - 1) * CELL, units: 'km, heights in metres, row 0 = south', source: 'Terrain Tiles on AWS (Mapzen Terrarium), zoom ' + Z }));
console.log(`terrain grid ${GW} x ${GH} at ${CELL} km, x ${xmin.toFixed(0)}..${xmax.toFixed(0)}, y ${ymin.toFixed(0)}..${ymax.toFixed(0)}`);
