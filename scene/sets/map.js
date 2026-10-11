// Set D: the flat California map (Albers conic) with real terrain, rivers, reservoirs, cities,
// the illustrative flood layer and the farm-to-store route. Beats 6, 7, 8, 10, 12, 13.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { loadJSON, loadFloat32, rings, lines, projectRing, tracePath, rasterize } from '../geo.js';
import { project } from '../proj.js';
import { makeLabel, setLabelOpacity } from '../text3d.js';
import { easeInOut, easeOut, lerp, span, smooth, spring, seeded } from '../easing.js';
import { recovery } from '../timeline.js';

export const group = new THREE.Group();
const EXAG = 2;                       // vertical exaggeration (within the 1.5-3x limit)
const H = m => Math.max(0, m) / 1000 * EXAG;   // metres -> scene km (y), ocean flattened at 0
let grid, heights, terrainMat, lineMats = [], flowMat, routeMat, routeFloodMat, truck, labels = {}, clouds = [], cityDots = [];

// Hand-drawn outline of the Central Valley floor (lon, lat). Only decides where flooding may appear.
const VALLEY = [[-122.45, 40.65], [-122.55, 40.0], [-122.35, 39.2], [-122.15, 38.6], [-121.95, 38.25], [-121.85, 38.0], [-121.65, 37.7], [-121.25, 37.2], [-120.75, 36.7], [-120.35, 36.2], [-119.95, 35.6], [-119.6, 35.1], [-119.2, 34.9], [-118.85, 35.05], [-118.75, 35.45], [-118.95, 35.85], [-119.25, 36.25], [-119.55, 36.65], [-119.95, 37.1], [-120.45, 37.6], [-120.95, 38.1], [-121.25, 38.6], [-121.45, 39.1], [-121.65, 39.6], [-121.95, 40.1], [-122.2, 40.55]];
const RIVERS = new Set(['Sacramento', 'San Joaquin', 'Feather', 'American', 'Kings', 'Kern', 'Merced', 'Tuolumne', 'Stanislaus', 'Mokelumne', 'Pit', 'Trinity', 'Klamath', 'Eel', 'Russian', 'Salinas', 'Owens', 'Mojave', 'Fresno Slough', 'North Fork Feather', 'North Yuba', 'North Fork American', 'S.  Fk.  American']);
const SANTA_ANA = [[-117.17, 34.12], [-117.33, 34.05], [-117.47, 33.97], [-117.62, 33.9], [-117.78, 33.83], [-117.9, 33.73], [-117.96, 33.63]];
// Farm near Hanford -> Highway 99 -> Bakersfield -> Interstate 5 over the Grapevine -> Los Angeles -> Santa Ana
const ROUTE = [[-119.72, 36.42], [-119.45, 36.33], [-119.29, 36.33], [-119.15, 36.05], [-119.05, 35.7], [-119.02, 35.37], [-118.95, 35.1], [-118.9, 34.93], [-118.8, 34.72], [-118.7, 34.52], [-118.54, 34.4], [-118.4, 34.2], [-118.23, 34.05], [-118.05, 33.9], [-117.87, 33.75]];
const ROUTE_FLOOD = [3, 5];           // the stretch across the Tulare basin that floods

function terrainHeight(x, z) {        // bilinear height (scene km) at scene x, z (z = -north)
  const gx = (x - grid.xmin) / grid.cell, gy = (-z - grid.ymin) / grid.cell;
  const i = Math.max(0, Math.min(grid.width - 2, Math.floor(gx))), j = Math.max(0, Math.min(grid.height - 2, Math.floor(gy)));
  const fx = Math.min(1, Math.max(0, gx - i)), fy = Math.min(1, Math.max(0, gy - j));
  const h = (ii, jj) => H(heights[jj * grid.width + ii]);
  return (h(i, j) * (1 - fx) + h(i + 1, j) * fx) * (1 - fy) + (h(i, j + 1) * (1 - fx) + h(i + 1, j + 1) * fx) * fy;
}
const toScene = ([x, y], lift = 0) => new THREE.Vector3(x, terrainHeight(x, -y) + lift, -y);

function buildTerrain(states) {
  const { width: GW, height: GH } = grid;
  const geo = new THREE.PlaneGeometry(grid.xmax - grid.xmin, grid.ymax - grid.ymin, GW - 1, GH - 1);
  geo.rotateX(-Math.PI / 2);          // now x east, z south; vertex order: row 0 = top of the plane = north
  const pos = geo.attributes.position;
  const ca = states.features.find(f => f.properties.name === 'California');
  const caRings = rings(ca.geometry).map(projectRing);
  const mask = rasterize(grid, g => { tracePath(g, caRings, grid); g.fillStyle = '#fff'; g.fill(); });
  const halo = rasterize(grid, g => { tracePath(g, caRings, grid); g.strokeStyle = '#fff'; g.lineWidth = 6; g.filter = 'blur(4px)'; g.stroke(); });
  const valley = rasterize(grid, g => { tracePath(g, [projectRing(VALLEY)], grid); g.fillStyle = '#fff'; g.fill(); });
  // valley floor trend: per row, the lowest valley cell, smoothed; relief = height above that floor
  const floor = new Float32Array(GH).fill(NaN);
  for (let j = 0; j < GH; j++) { let m = Infinity; for (let i = 0; i < GW; i++) if (valley[j * GW + i] > 0.5) m = Math.min(m, heights[j * GW + i]); if (m < Infinity) floor[j] = m; }
  const sm = new Float32Array(GH);
  for (let j = 0; j < GH; j++) { let s = 0, n = 0; for (let k = -12; k <= 12; k++) { const v = floor[j + k]; if (v === v) { s += v; n++; } } sm[j] = n ? s / n : 0; }
  const aMask = new Float32Array(GW * GH), aValley = new Float32Array(GW * GH), aRelief = new Float32Array(GW * GH), aElev = new Float32Array(GW * GH), aHalo = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const src = j * GW + i;                 // grid row 0 = south
    const v = (GH - 1 - j) * GW + i;        // plane row 0 = north
    const m = heights[src];
    pos.setY(v, H(m));
    aMask[v] = mask[src]; aHalo[v] = halo[src]; aValley[v] = valley[src]; aElev[v] = m;
    aRelief[v] = m - sm[j];
  }
  geo.computeVertexNormals();
  geo.setAttribute('aMask', new THREE.BufferAttribute(aMask, 1));
  geo.setAttribute('aHalo', new THREE.BufferAttribute(aHalo, 1));
  geo.setAttribute('aValley', new THREE.BufferAttribute(aValley, 1));
  geo.setAttribute('aRelief', new THREE.BufferAttribute(aRelief, 1));
  geo.setAttribute('aElev', new THREE.BufferAttribute(aElev, 1));

  terrainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0 });
  terrainMat.userData.u = {
    uLevel: { value: 0 }, uRim: { value: 0 }, uGreen: { value: 0 }, uSepia: { value: 0 }, uHalo: { value: 0.35 },
    uLand: { value: new THREE.Color(0x6E7B8A) }, uOutside: { value: new THREE.Color(0x414B57) }, uOcean: { value: new THREE.Color(0x17395B) },
    uWater: { value: new THREE.Color(0x2F7FC2) }, uAccent: { value: new THREE.Color(0xE0A640) }, uGreenC: { value: new THREE.Color(0x5E9E5A) },
  };
  terrainMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, terrainMat.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMask, aHalo, aValley, aRelief, aElev; varying float vMask, vHalo, vValley, vRelief, vElev;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask; vHalo = aHalo; vValley = aValley; vRelief = aRelief; vElev = aElev;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLevel, uRim, uGreen, uSepia, uHalo; uniform vec3 uLand, uOutside, uOcean, uWater, uAccent, uGreenC;
        varying float vMask, vHalo, vValley, vRelief, vElev; float gWater;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 land = mix(uOutside, uLand, vMask);
        float high = smoothstep(1400.0, 3200.0, vElev);
        land = mix(land, vec3(0.70, 0.74, 0.78), high * 0.55);                       // high Sierra lighter
        land = mix(land, uGreenC, uGreen * vMask * (1.0 - high) * smoothstep(-10.0, 60.0, vElev));
        land = mix(land, vec3(0.56, 0.60, 0.65), smoothstep(30.0, 0.0, vElev) * 0.35 * vMask); // shoreline gradient
        float ocean = 1.0 - smoothstep(0.0, 1.5, vElev);
        float flood = vValley * (1.0 - smoothstep(uLevel - 2.0, uLevel + 2.0, vRelief)) * step(0.01, uLevel);
        float rimBand = vValley * smoothstep(uLevel - 1.0, uLevel + 1.5, vRelief) * (1.0 - smoothstep(uLevel + 1.5, uLevel + 9.0, vRelief)) * uRim * step(0.01, uLevel);
        vec3 col = mix(land, uOcean, ocean);
        col = mix(col, uWater * (0.85 + 0.15 * smoothstep(uLevel, uLevel - 14.0, vRelief)), flood);
        col = mix(col, uAccent, rimBand * 0.8);
        float sep = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(sep) * vec3(1.05, 0.93, 0.78), uSepia);
        diffuseColor.rgb = col;
        gWater = max(ocean, flood);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, gWater);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uAccent * (rimBand * 0.35 + vHalo * uHalo * 0.22) + uWater * flood * 0.05;');
  };
  terrainMat.customProgramCacheKey = () => 'terrain';
  const mesh = new THREE.Mesh(geo, terrainMat);
  mesh.position.set((grid.xmin + grid.xmax) / 2, 0, -(grid.ymin + grid.ymax) / 2);
  mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

function lineMaterial(color, width, opts = {}) {
  const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity: 1, depthWrite: false, ...opts });
  m.resolution.set(1080 * 2, 1920 * 2);
  lineMats.push(m);
  return m;
}
function lineFrom(ptsKm, mat, lift = 0.9) {
  const flat = []; ptsKm.forEach(p => { const v = toScene(p, lift); flat.push(v.x, v.y, v.z); });
  const g = new LineGeometry(); g.setPositions(flat);
  const l = new Line2(g, mat); l.computeLineDistances(); l.renderOrder = 3;
  return l;
}
/** Densify a lon/lat polyline so it follows the terrain. */
function densify(ring, stepKm = 6) {
  const out = []; const pts = projectRing(ring);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const d = Math.hypot(bx - ax, by - ay); const n = Math.max(1, Math.ceil(d / stepKm));
    for (let k = 0; k < n; k++) out.push([lerp(ax, bx, k / n), lerp(ay, by, k / n)]);
  }
  out.push(pts[pts.length - 1]); return out;
}

export async function build(ctx) {
  const [meta, bin, states, rivers, lakes, cities] = await Promise.all([loadJSON('/data/terrain.json'), loadFloat32('/data/terrain.bin'), loadJSON('/data/states.json'), loadJSON('/data/rivers.json'), loadJSON('/data/lakes.json'), loadJSON('/data/cities.json')]);
  grid = meta; heights = bin;
  group.add(buildTerrain(states));

  // rivers: solid base lines, plus a brighter dashed "flow" copy that animates in beat 6
  const riverMat = lineMaterial(0x2F7FC2, 2.2);
  flowMat = lineMaterial(0x8FC6F0, 3.2, { dashed: true, dashSize: 14, gapSize: 22 });
  flowMat.opacity = 0;
  const riverLines = new THREE.Group(), flowLines = new THREE.Group();
  const [caMinX, caMaxX] = [-520, 420];
  for (const f of rivers.features) {
    if (!RIVERS.has(f.properties.name)) continue;
    for (const line of lines(f.geometry)) {
      const pts = densify(line, 4).filter(([x, y]) => x > caMinX && x < caMaxX);
      if (pts.length < 2) continue;
      riverLines.add(lineFrom(pts, riverMat)); flowLines.add(lineFrom(pts, flowMat, 1.2));
    }
  }
  riverLines.add(lineFrom(densify(SANTA_ANA, 3), riverMat)); flowLines.add(lineFrom(densify(SANTA_ANA, 3), flowMat, 1.2));
  group.add(riverLines, flowLines);

  // lakes and reservoirs
  const lakeMat = new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.2, metalness: 0 });
  for (const f of lakes.features) {
    for (const ring of rings(f.geometry)) {
      const pts = projectRing(ring); if (pts.some(([x]) => x < caMinX || x > caMaxX)) continue;
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2);   // shape (x, north) -> scene (x, 0, -north), normal up
      const m = new THREE.Mesh(g, lakeMat);
      let minH = Infinity; for (const p of pts) minH = Math.min(minH, terrainHeight(p[0], -p[1]));
      m.position.y = minH + 0.35; m.renderOrder = 2;
      group.add(m);
    }
  }

  // cities: dots with labels offset up and right
  const dotGeo = new THREE.CylinderGeometry(5, 5, 1.2, 24);
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xD2CBBF, roughness: 0.6, emissive: 0xD2CBBF, emissiveIntensity: 0.25 });
  for (const c of cities) {
    const p = project(c.lon, c.lat);
    const dot = new THREE.Mesh(dotGeo, dotMat); dot.position.copy(toScene(p, 1.0)); dot.castShadow = true; group.add(dot); cityDots.push(dot);
    const lab = makeLabel(c.name, { size: 17, style: 'regular' }); lab.position.copy(toScene(p, 2.5)).add(new THREE.Vector3(8, 6, -8));
    labels[c.name] = lab; group.add(lab);
  }
  // water and region names (italic for water)
  const named = [
    ['Pacific Ocean', -123.75, 36.1, 'italic', 22], ['Sierra Nevada', -119.3, 37.9, 'italic', 22], ['Central Valley', -120.9, 37.6, 'regular', 20],
    ['Sacramento–San Joaquin Delta', -121.5, 38.0, 'italic', 14], ['Tulare Lake basin', -119.85, 36.05, 'italic', 16], ['Santa Ana River', -117.75, 33.78, 'italic', 14],
    ['Sacramento Valley', -122.0, 39.4, 'regular', 18], ['Shasta Lake', -122.3, 40.78, 'italic', 13], ['Lake Oroville', -121.42, 39.6, 'italic', 13],
  ];
  for (const [name, lon, lat, style, size] of named) {
    const lab = makeLabel(name, { size, style, color: style === 'italic' ? 0xD2CBBF : 0xF3EFE6, anchorX: 'left' }); lab.position.copy(toScene(project(lon, lat), 3)); labels[name] = lab; group.add(lab);
  }

  // the route from a Central Valley farm to a Southern California store
  routeMat = lineMaterial(0xF3EFE6, 4.5); routeFloodMat = lineMaterial(0xE0A640, 5.5);
  const routePts = densify(ROUTE, 3);
  const flat = routePts.map(p => toScene(p, 1.6));
  const routeLine = new THREE.Group(); routeLine.name = 'route';
  const g1 = new LineGeometry(); g1.setPositions(flat.flatMap(v => [v.x, v.y, v.z])); routeLine.add(new Line2(g1, routeMat));
  const fl = projectRing(ROUTE.slice(ROUTE_FLOOD[0], ROUTE_FLOOD[1] + 1)).length;
  const floodPts = densify(ROUTE.slice(ROUTE_FLOOD[0], ROUTE_FLOOD[1] + 1), 3).map(p => toScene(p, 1.8));
  const g2 = new LineGeometry(); g2.setPositions(floodPts.flatMap(v => [v.x, v.y, v.z])); routeLine.add(new Line2(g2, routeFloodMat));
  routeLine.children.forEach(l => { l.computeLineDistances(); l.renderOrder = 4; });
  routeLine.userData.curve = new THREE.CatmullRomCurve3(flat, false, 'centripetal');
  routeLine.userData.floodU = ROUTE_FLOOD[0] / (ROUTE.length - 1);
  group.add(routeLine);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xD2CBBF, roughness: 0.65 });
  const farm = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 14), boxMat); farm.position.copy(toScene(project(...ROUTE[0]), 4)); farm.castShadow = true;
  const store = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 16), boxMat); store.position.copy(toScene(project(...ROUTE[ROUTE.length - 1]), 5)); store.castShadow = true;
  truck = new THREE.Group(); truck.add(new THREE.Mesh(new THREE.BoxGeometry(10, 5, 5), new THREE.MeshStandardMaterial({ color: 0xE0A640, roughness: 0.6 })));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 5), boxMat); cab.position.set(-6.5, -0.5, 0); truck.add(cab); truck.children.forEach(m => m.castShadow = true);
  routeLine.add(farm, store, truck);
  labels['Farm'] = makeLabel('Farm', { size: 11, style: 'italic', color: 0xD2CBBF }); labels['Farm'].position.copy(farm.position).add(new THREE.Vector3(10, 6, -6)); group.add(labels['Farm']);
  labels['Grocery store'] = makeLabel('Grocery store', { size: 11, style: 'italic', color: 0xD2CBBF }); labels['Grocery store'].position.copy(store.position).add(new THREE.Vector3(10, 6, -6)); group.add(labels['Grocery store']);
  labels['Route closed'] = makeLabel('Route closed', { size: 12, style: 'italic', color: 0xD2CBBF }); labels['Route closed'].position.copy(toScene(project(...ROUTE[4]), 6)).add(new THREE.Vector3(12, 6, -4)); group.add(labels['Route closed']);

  // storm clouds over the Sierra and valley (sprites)
  const cc = document.createElement('canvas'); cc.width = cc.height = 256; const cg = cc.getContext('2d');
  const grd = cg.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, 'rgba(190,198,206,0.9)'); grd.addColorStop(0.5, 'rgba(170,180,190,0.5)'); grd.addColorStop(1, 'rgba(150,160,170,0)');
  cg.fillStyle = grd; cg.fillRect(0, 0, 256, 256);
  const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
  const rnd = seeded(21);
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, opacity: 0.55, color: 0x9AA4AE }));
    const lon = -123 + rnd() * 5, lat = 35 + rnd() * 5.5; const p = project(lon, lat);
    s.userData = { x: p[0], z: -p[1], h: 70 + rnd() * 40, size: 70 + rnd() * 90, drift: 2 + rnd() * 3 };
    s.scale.setScalar(s.userData.size); clouds.push(s); group.add(s);
  }
}

const LABEL_SETS = {
  6: ['Sacramento', 'Fresno', 'Bakersfield', 'San Francisco', 'Los Angeles', 'Redding', 'Pacific Ocean', 'Sierra Nevada', 'Central Valley', 'Sacramento–San Joaquin Delta', 'Shasta Lake', 'Lake Oroville'],
  7: ['Sacramento', 'Fresno', 'Bakersfield', 'San Francisco', 'Los Angeles', 'Pacific Ocean', 'Sierra Nevada', 'Sacramento–San Joaquin Delta', 'Tulare Lake basin'],
  8: ['Fresno', 'Bakersfield', 'Los Angeles', 'Santa Ana', 'Santa Ana River', 'Farm', 'Grocery store', 'Route closed', 'Tulare Lake basin'],
  10: ['Fresno', 'Bakersfield', 'Tulare Lake basin', 'Sierra Nevada'],
  12: ['Sacramento', 'San Francisco', 'Sacramento Valley', 'Sacramento–San Joaquin Delta', 'Pacific Ocean'],
  13: ['Sacramento', 'Fresno', 'Los Angeles', 'San Francisco', 'Pacific Ocean', 'Sierra Nevada', 'Central Valley'],
};

/** Camera: look at a map point from a distance, with tilt (0 = straight down) and heading (0 = north up). */
function aim(camera, lonLat, dist, tiltDeg, headingDeg, vfov) {
  const [x, y] = project(lonLat[0], lonLat[1]);
  const target = new THREE.Vector3(x, terrainHeight(x, -y), -y);
  const tilt = tiltDeg * Math.PI / 180, hd = headingDeg * Math.PI / 180;
  const off = new THREE.Vector3(Math.sin(tilt) * Math.sin(hd), Math.cos(tilt), Math.sin(tilt) * Math.cos(hd)).multiplyScalar(dist);
  camera.position.copy(target).add(off);
  camera.up.set(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
  // for a near top-down view, keep north at the top of the frame
  if (tiltDeg < 2) camera.up.set(-Math.sin(hd), 0, -Math.cos(hd));
  camera.lookAt(target);
  camera.fov = vfov; camera.near = 2; camera.far = 12000; camera.updateProjectionMatrix();
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(0, 0, -50), 820); lights.key.castShadow = true;
  const u = terrainMat.userData.u, local = t - beat.start, r = recovery(t);
  u.uGreen.value = r * 0.75; u.uSepia.value = 0; u.uRim.value = 1; u.uHalo.value = 0.35;
  for (const m of lineMats) m.resolution.set(1080 * ctx.renderer.getPixelRatio(), 1920 * ctx.renderer.getPixelRatio());
  const route = group.getObjectByName('route'); route.visible = false;
  for (const name in labels) setLabelOpacity(labels[name], 0);
  const show = LABEL_SETS[beat.id] || [];
  const labelA = easeOut(span(local, 0.4, 1.0)) * (1 - easeOut(span(local, beat.end - beat.start - 0.3, beat.end - beat.start)));
  for (const n of show) if (labels[n]) setLabelOpacity(labels[n], labelA);
  flowMat.opacity = 0; flowMat.dashOffset = -t * 40;
  for (const s of clouds) { s.position.set(s.userData.x + Math.sin(t * 0.1 + s.userData.z) * 10, s.userData.h, s.userData.z + t * s.userData.drift * 0.5); s.material.opacity = 0.18 * (1 - r); }

  if (beat.id === 6) {
    // top-down over the valley, slow push; flow dashes run down the rivers
    const k = easeInOut(span(local, 1.0, 5.7));
    aim(camera, [-120.6, 37.9], lerp(1500, 1250, k), 1, 0, 54.4);
    u.uLevel.value = lerp(0, 10, easeInOut(span(local, 1.5, 6)));
    flowMat.opacity = 0.9 * easeOut(span(local, 0.8, 2.0));
  } else if (beat.id === 7) {
    // the big one: patches swell and join
    const k = easeInOut(span(local, 0.8, 5.8));
    aim(camera, [-120.6, 37.6], lerp(1250, 1020, k), 1, 0, 54.4);
    u.uLevel.value = lerp(10, 40, easeInOut(span(local, 0.5, 5.0)));
    u.uRim.value = 1.0 + 0.4 * Math.sin(t * 3.0);
  } else if (beat.id === 8) {
    // fly south and tilt: the route animates from farm to store and stops at the flooded stretch
    const k = easeInOut(span(local, 0.6, 3.2));
    aim(camera, [lerp(-120.2, -118.9, k), lerp(36.8, 35.2, k)], lerp(1020, 520, k), lerp(1, 36, k), lerp(0, 12, k), 54.4);
    u.uLevel.value = 40;
    route.visible = true;
    const prog = easeInOut(span(local, 0.8, 3.2)) * route.userData.floodU;
    const p = route.userData.curve.getPointAt(prog), ahead = route.userData.curve.getPointAt(Math.min(1, prog + 0.01));
    truck.position.copy(p).add(new THREE.Vector3(0, 4, 0)); truck.lookAt(ahead.clone().add(new THREE.Vector3(0, 4, 0))); truck.rotateY(Math.PI / 2);
    routeFloodMat.opacity = smooth(2.6, 3.2, local) * (0.75 + 0.25 * Math.sin(t * 4));
    routeMat.opacity = 1;
  } else if (beat.id === 10) {
    // after the rain: the Tulare basin lake, slow orbit
    const k = easeInOut(span(local, 0.8, 4.0));
    aim(camera, [-119.75, 36.05], 360, 42, lerp(-20, 8, k), 54.4);
    u.uLevel.value = 34; u.uRim.value = 0.25;
  } else if (beat.id === 12) {
    // 1861-62: low hero angle up the Sacramento Valley, sepia flood, camera rising
    const k = easeInOut(span(local, 0.8, 5.6));
    aim(camera, [-121.8, 39.0], lerp(430, 470, k), lerp(74, 64, k), 190, 73.7);
    u.uLevel.value = 40; u.uSepia.value = 0.8; u.uRim.value = 0.15; u.uGreen.value = 0;
  } else if (beat.id === 13) {
    // resolution: wide pull-back as the flood recedes and the land greens
    const k = easeInOut(span(local, 0.6, 5.6));
    aim(camera, [-120.4, 37.3], lerp(900, 1750, k), lerp(42, 28, k), lerp(12, 0, k), 65.5);
    u.uLevel.value = lerp(40, 10, easeInOut(span(local, 0.5, 5.5))); u.uRim.value = 0.2; u.uGreen.value = 0.75 + 0.25 * k;
  }
}
