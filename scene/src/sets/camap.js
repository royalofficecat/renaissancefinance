// The California relief map (beats 2, 6-10, 13 and the end card).
// 1 world unit = 10 km. Terrain is real (USGS 3DEP via Terrain Tiles) with 3x vertical exaggeration.
import * as THREE from 'three';
import { albers } from '../core/albers.js';
import { C, SKY_REFL, clay, rig, water } from '../core/look.js';
import { applyCam, move } from '../core/camera.js';
import { clamp, ease, lerp, prog, smoothstep, spring } from '../core/util.js';
import { dataTexture, loadBin, loadJSON, loadPixels, samplePix } from '../core/data.js';
import { ribbonGeometry, ribbonMaterial, updateRibbon } from '../core/ribbon.js';
import { Labels } from '../core/labels.js';

const KM = 10000;
const EXAG = 3;
const LIFT = 0.05; // gentle extrusion of California above its neighbours (world units)
const SEG_X = 600, SEG_Z = 660;

export async function createMap(pipe) {
  const [meta, vec, hbuf, masks, extra, lakes] = await Promise.all([
    loadJSON('ca_meta.json'), loadJSON('ca_vectors.json'), loadBin('ca_height.i16'),
    loadPixels('ca_masks.png'), loadPixels('ca_extra.png'), loadPixels('ca_lakes.png'),
  ]);
  const { x0, x1, y0, y1, res, nx, ny } = meta;
  const H = new Int16Array(hbuf);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const WX = (x1 - x0) / KM, WZ = (y1 - y0) / KM;

  // ---------- coordinate helpers
  const pix = (x, y) => [(x - x0) / res, (y1 - y) / res];
  const heightAt = (x, y) => {
    let [px, py] = pix(x, y);
    px = clamp(px - 0.5, 0, nx - 1.001); py = clamp(py - 0.5, 0, ny - 1.001);
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const g = (a, b) => H[b * nx + a];
    return (g(ix, iy) * (1 - fx) + g(ix + 1, iy) * fx) * (1 - fy) + (g(ix, iy + 1) * (1 - fx) + g(ix + 1, iy + 1) * fx) * fy;
  };
  const caSoft = (x, y) => samplePix(masks, ...pix(x, y), 1);
  const isLand = (x, y) => samplePix(masks, ...pix(x, y), 0) > 0.5;
  const floodAt = (x, y) => samplePix(masks, ...pix(x, y), 2);
  const yOf = (x, y) => (isLand(x, y) ? Math.max(heightAt(x, y), 0) * (EXAG / KM) + LIFT * caSoft(x, y) : 0);
  const toW = (x, y, lift = 0) => new THREE.Vector3((x - cx) / KM, yOf(x, y) + lift, -(y - cy) / KM);
  const ll = (lon, lat, lift = 0) => toW(...albers(lon, lat), lift);

  // ---------- terrain mesh
  const geo = new THREE.PlaneGeometry(WX, WZ, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) * KM + cx, y = -P.getZ(i) * KM + cy;
    P.setY(i, yOf(x, y));
  }
  geo.computeVertexNormals();
  // Mesh-matched height for draping lines exactly on the triangles
  const meshY = (wx, wz) => {
    const gx = clamp((wx / WX + 0.5) * SEG_X, 0, SEG_X - 1e-3), gz = clamp((wz / WZ + 0.5) * SEG_Z, 0, SEG_Z - 1e-3);
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const g = (a, b) => P.getY(b * (SEG_X + 1) + a);
    return (g(ix, iz) * (1 - fx) + g(ix + 1, iz) * fx) * (1 - fz) + (g(ix, iz + 1) * (1 - fx) + g(ix + 1, iz + 1) * fx) * fz;
  };

  // Object-space normal map at full data resolution (600 m) for crisp hillshading
  const nrm = new Uint8Array(nx * ny * 4);
  const Yg = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * res, y = y1 - (j + 0.5) * res;
    Yg[j * nx + i] = yOf(x, y);
  }
  const d = (2 * res) / KM;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const L = Yg[j * nx + Math.max(0, i - 1)], R = Yg[j * nx + Math.min(nx - 1, i + 1)];
    const N = Yg[Math.max(0, j - 1) * nx + i], S = Yg[Math.min(ny - 1, j + 1) * nx + i];
    let ax = -(R - L) / d, az = -(S - N) / d;
    const len = Math.hypot(ax, 1, az);
    const o = ((ny - 1 - j) * nx + i) * 4; // flip rows: uv (0,0) = south-west
    nrm[o] = ((ax / len) * 0.5 + 0.5) * 255; nrm[o + 1] = ((1 / len) * 0.5 + 0.5) * 255; nrm[o + 2] = ((az / len) * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
  }
  const normalTex = new THREE.DataTexture(nrm, nx, ny);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.magFilter = THREE.LinearFilter;
  normalTex.generateMipmaps = true; normalTex.anisotropy = 4; normalTex.needsUpdate = true;

  const U = {
    uMasks: { value: dataTexture(masks) }, uExtra: { value: dataTexture(extra) }, uLakes: { value: dataTexture(lakes) },
    uFlood: { value: 0 }, uLevee: { value: 0 }, uGreen: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.0 },
    uDim: { value: 0.52 }, uWaterCol: { value: C.water.clone() }, uBg: { value: C.bg.clone() }, uSubject: { value: C.subject.clone() },
    uGreenCol: { value: C.green.clone() }, uAccent: { value: C.accent.clone() }, uFloodGlow: { value: 0 },
  };
  const terrainMat = clay(0xffffff, 0.82, { normalMap: normalTex, normalMapType: THREE.ObjectSpaceNormalMap });
  terrainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMapUv; varying float vY; varying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMapUv = uv; vY = position.y; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec2 vMapUv; varying float vY; varying vec3 vWPos;
        uniform sampler2D uMasks, uExtra, uLakes;
        uniform float uFlood, uLevee, uGreen, uTime, uDim, uCloud, uFloodGlow;
        uniform vec3 uWaterCol, uBg, uSubject, uGreenCol, uAccent;
        float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
        float fb(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*vn(p); p=p*2.1+7.3; a*=0.5;} return s; }
        float gWater = 0.0; float gOcean = 0.0; float gEdge = 1.0;
        ${SKY_REFL}`)
      .replace('#include <color_fragment>', /* glsl */ `
        vec3 mk = texture2D(uMasks, vMapUv).rgb;
        vec3 ex = texture2D(uExtra, vMapUv).rgb;
        float lakeM = texture2D(uLakes, vMapUv).r;
        float land = smoothstep(0.4, 0.6, mk.r);
        float ca = mk.g;
        vec3 landCol = uSubject * (0.74 + 0.32 * smoothstep(0.02, 1.1, vY));
        landCol = mix(landCol * uDim, landCol, ca);
        landCol = mix(landCol, mix(uSubject, uGreenCol, 0.55), uGreen * ex.b * ca);
        if (uCloud > 0.0) {
          float cl = uCloud * smoothstep(0.45, 0.75, fb(vWPos.xz * 0.045 + vec2(uTime * 0.05, uTime * 0.02)));
          landCol *= 1.0 - 0.28 * cl;
        }
        vec3 oceanCol = mix(uWaterCol * 0.46, uBg * 0.62, smoothstep(0.0, 0.5, ex.g));
        float lake = smoothstep(0.35, 0.65, lakeM) * land;
        float flood = 0.0, depth = 0.0;
        if (uFlood > 0.0005 && mk.b < uFlood + 0.03) {
          float a = mk.b + (fb(vMapUv * 900.0) - 0.5) * 0.018;
          flood = (1.0 - smoothstep(uFlood - 0.012, uFlood + 0.004, a)) * land;
          depth = clamp((uFlood - a) * 9.0, 0.0, 1.0);
        }
        vec3 floodCol = uWaterCol * mix(1.08, 0.82, depth);
        vec3 col = mix(landCol, uWaterCol * 0.95, lake);
        col = mix(col, floodCol, flood);
        col = mix(col, oceanCol, 1.0 - land);
        gWater = max(max(lake, flood), 1.0 - land);
        gOcean = 1.0 - land;
        gEdge = smoothstep(0.0, 0.08, min(vMapUv.x, 1.0 - vMapUv.x)) * smoothstep(0.0, 0.08, min(vMapUv.y, 1.0 - vMapUv.y));
        col = mix(col, uAccent, clamp(ex.r * uLevee * 1.4, 0.0, 1.0));
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.12, 0.75, gOcean), gWater);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), max(gWater * 0.92, gOcean)));`)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, gWater * mix(1.0, 0.22, gOcean));\n// map edges melt into the background after lighting\noutgoingLight = mix(uBg, outgoingLight, gEdge);\n#include <opaque_fragment>')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float lev = ex.r * uLevee * (0.75 + 0.25 * sin(uTime * 5.0));
        totalEmissiveRadiance += uAccent * lev * 0.9;`);
  };
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;

  // Base slab under the map so tilted views never see an edge floating in space
  const slab = new THREE.Mesh(new THREE.BoxGeometry(WX, 0.6, WZ), new THREE.MeshBasicMaterial({ color: C.bg, fog: false }));
  slab.position.y = -0.62; // top face well below sea level: no z-fighting with the ocean surface
  slab.renderOrder = 1; // drawn after the terrain so hidden parts fail the depth test early

  const scene = new THREE.Scene();
  scene.background = C.bg.clone();
  scene.fog = new THREE.Fog(C.bg.clone(), 80, 300);
  scene.add(terrain, slab);
  const lights = rig(scene, pipe.renderer, { size: 20, dist: 120, intensity: 2.7, keyDir: [-0.62, 0.58, -0.3], rimDir: [0.3, 0.35, -1] });

  // ---------- lines
  const lines = [];
  const drape = (albersPts, step = 1500, lift = 0.012) => {
    const out = [];
    for (let i = 0; i < albersPts.length - 1; i++) {
      const [ax, ay] = albersPts[i], [bx, by] = albersPts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let k = 0; k < n; k++) {
        const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
        const w = new THREE.Vector3((x - cx) / KM, 0, -(y - cy) / KM);
        w.y = meshY(w.x, w.z) + lift;
        out.push(w);
      }
    }
    const [lx, ly] = albersPts[albersPts.length - 1];
    const w = new THREE.Vector3((lx - cx) / KM, 0, -(ly - cy) / KM);
    w.y = meshY(w.x, w.z) + lift;
    out.push(w);
    return out;
  };
  const addLine = (albersPts, matOpts, extraData = {}) => {
    const g = ribbonGeometry(drape(albersPts));
    const m = ribbonMaterial(matOpts);
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 2;
    scene.add(mesh);
    const item = { mesh, mat: m, length: g.userData.length, ...extraData };
    lines.push(item);
    return item;
  };
  const riverLines = vec.rivers.map((r) =>
    addLine(r.pts, { color: C.water.clone().multiplyScalar(1.15), px: r.kind === 'trunk' ? 5.5 : 3.6, maxW: r.kind === 'trunk' ? 0.12 : 0.07, edgeColor: C.accent }, { kind: r.kind, name: r.name }));
  const santaAna = addLine(vec.santaAnaRiver, { color: C.water.clone().multiplyScalar(1.15), px: 4.2, maxW: 0.06 }, { kind: 'santaana' });
  const outlineCol = new THREE.Color('#C9D0D6');
  const tulareOutline = addLine(vec.watersheds.tulare.pts, { color: outlineCol, px: 3, maxW: 0.3, dash: 14, opacity: 0 });
  const santaAnaOutline = addLine(vec.watersheds.santaana.pts, { color: C.green.clone(), px: 4, maxW: 0.3, dash: 14, opacity: 0, emissive: 0.5 });

  // ---------- route props (beats 9-10): farm -> detour -> I-5 -> Los Angeles grocery store
  const toA = (pts) => pts.map(([lo, la]) => albers(lo, la));
  // Detour: south on Highway 99 (dry ground east of the refilled Tulare Lake), then I-5 over the Grapevine
  const routeLL = [[-119.45, 36.15], [-119.38, 36.07], [-119.30, 35.92], [-119.27, 35.77], [-119.20, 35.60], [-119.05, 35.42], [-119.02, 35.28], [-118.95, 35.0], [-118.86, 34.84], [-118.62, 34.49], [-118.55, 34.39], [-118.45, 34.28], [-118.30, 34.14], [-118.205, 34.035]];
  // The direct road west to I-5 runs into the flood
  const directLL = [[-119.45, 36.15], [-119.55, 36.12], [-119.70, 36.08], [-119.85, 36.04], [-119.962, 36.008]];
  const route = addLine(toA(routeLL), { color: new THREE.Color('#D9DEE3'), px: 5, maxW: 0.2, opacity: 0, emissive: 0.15 });
  const direct = addLine(toA(directLL), { color: C.accent.clone(), px: 5, maxW: 0.2, opacity: 0, dash: 16, emissive: 0.4 });
  const routePts = drape(toA(routeLL), 1500, 0.0);
  const routeCum = [0];
  for (let i = 1; i < routePts.length; i++) routeCum.push(routeCum[i - 1] + routePts[i].distanceTo(routePts[i - 1]));
  const routeLen = routeCum[routeCum.length - 1];
  const routeAt = (dist) => {
    dist = clamp(dist, 0, routeLen - 1e-4);
    let i = routeCum.findIndex((c) => c > dist) - 1;
    if (i < 0) i = routePts.length - 2;
    const t = (dist - routeCum[i]) / (routeCum[i + 1] - routeCum[i]);
    const p = routePts[i].clone().lerp(routePts[i + 1], t);
    const dir = routePts[i + 1].clone().sub(routePts[i]).setY(0).normalize();
    return { p, dir };
  };
  // Beat 9 ends with the truck back on Interstate 5 south of the detour
  const junction = ll(-119.27, 35.77);
  let jIdx = 0;
  routePts.forEach((p, i) => { if (p.distanceTo(junction) < routePts[jIdx].distanceTo(junction)) jIdx = i; });
  const firstLeg = routeCum[jIdx];
  // Where the direct road meets the illustrative flood: barrier goes there
  const directA = toA(directLL);
  let barrierA = directA[2];
  for (let i = 0; i < directA.length - 1 && barrierA === directA[2]; i++) {
    for (let k = 0; k <= 10; k++) {
      const x = lerp(directA[i][0], directA[i + 1][0], k / 10), y = lerp(directA[i][1], directA[i + 1][1], k / 10);
      if (floodAt(x, y) < meta.floodEnd - 0.04) { barrierA = [x, y]; break; }
    }
  }
  const props = new THREE.Group();
  scene.add(props);
  const S = 0.1; // prop scale: toy pieces on the map
  const mGrey = clay(new THREE.Color('#C9CED3'), 0.7), mDark = clay(new THREE.Color('#4A5058'), 0.75), mRoof = clay(C.subject.clone().multiplyScalar(0.7), 0.7);
  const mCrop = clay(C.subject.clone().lerp(C.green, 0.35), 0.8), mAmber = clay(C.accent, 0.6, { emissive: C.accent, emissiveIntensity: 0.6 });
  const rbox = (w, h, d, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = b.receiveShadow = true; return b; };
  const gable = (w, h, d, m) => {
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
    const mm = new THREE.Mesh(g, m); mm.castShadow = true; return mm;
  };
  // Farm: barn + crop rows
  const farm = new THREE.Group();
  const barn = new THREE.Group();
  const body = rbox(1.6, 1.0, 2.4, mGrey); body.position.y = 0.5;
  const roof = gable(1.9, 0.8, 2.6, mRoof); roof.position.y = 1.0;
  barn.add(body, roof);
  barn.position.set(-1.6, 0, 0);
  farm.add(barn);
  for (let r = 0; r < 7; r++) { const row = rbox(0.45, 0.35, 5.5, mCrop); row.position.set(0.6 + r * 0.75, 0.17, 0.3); farm.add(row); }
  farm.scale.setScalar(S);
  // Pylons with an amber outage glow
  const pylons = new THREE.Group();
  const glowMats = [];
  const pylonLL = [[-119.40, 36.19], [-119.36, 36.235], [-119.32, 36.28]];
  const pylonPos = pylonLL.map(([lo, la]) => ll(lo, la));
  pylonPos.forEach((p) => {
    const t = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 4, 6), mDark); mast.position.y = 2; mast.castShadow = true;
    const arm = rbox(2.2, 0.15, 0.15, mDark); arm.position.y = 3.6;
    const gm = new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 0, roughness: 0.5, transparent: true, opacity: 0 });
    glowMats.push(gm);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12), gm); glow.position.y = 4.1;
    t.add(mast, arm, glow);
    t.position.copy(p);
    t.scale.setScalar(S);
    pylons.add(t);
  });
  const wire = (a, b) => {
    const pa = a.clone().add(new THREE.Vector3(0, 3.6 * S, 0)), pb = b.clone().add(new THREE.Vector3(0, 3.6 * S, 0));
    const mid = pa.clone().lerp(pb, 0.5).add(new THREE.Vector3(0, -0.08, 0));
    const c = new THREE.QuadraticBezierCurve3(pa, mid, pb);
    return new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.004, 4), mDark);
  };
  pylons.add(wire(pylonPos[0], pylonPos[1]), wire(pylonPos[1], pylonPos[2]));
  // Barrier on the flooded road
  const barrier = new THREE.Group();
  for (const sx of [-1.2, 1.2]) { const post = rbox(0.18, 1.3, 0.18, mDark); post.position.set(sx, 0.65, 0); barrier.add(post); }
  for (const y of [0.75, 1.15]) { const board = rbox(3.0, 0.28, 0.12, mAmber); board.position.y = y; barrier.add(board); }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), water(C.water, { transparent: true, opacity: 0.9 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02;
  barrier.add(pool);
  barrier.scale.setScalar(S);
  // Truck
  const truck = new THREE.Group();
  const cab = rbox(1.0, 1.0, 1.0, mGrey); cab.position.set(0, 0.7, 1.3);
  const trailer = rbox(1.05, 1.25, 2.6, clay(new THREE.Color('#E3E6E9'), 0.65)); trailer.position.set(0, 0.85, -0.6);
  truck.add(cab, trailer);
  for (const z of [1.3, -0.2, -1.4]) for (const x of [-0.5, 0.5]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 14), mDark); wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.28, z); truck.add(wh);
  }
  truck.scale.setScalar(S * 0.9);
  // Grocery store with an open front; empty produce bins glow amber
  const store = new THREE.Group();
  const stW = 7, stD = 4.5, stH = 2.4;
  const back = rbox(stW, stH, 0.3, mGrey); back.position.set(0, stH / 2, -stD / 2);
  const sideL = rbox(0.3, stH, stD, mGrey); sideL.position.set(-stW / 2, stH / 2, 0);
  const sideR = sideL.clone(); sideR.position.x = stW / 2;
  const sroof = rbox(stW + 0.4, 0.35, stD + 0.6, mRoof); sroof.position.y = stH + 0.17;
  const floor = rbox(stW, 0.1, stD, clay(new THREE.Color('#B9BEC4'), 0.8)); floor.position.y = 0.05;
  const lot = rbox(stW + 6, 0.06, 6, clay(new THREE.Color('#3E434A'), 0.85)); lot.position.set(0, 0.03, stD / 2 + 3);
  store.add(back, sideL, sideR, floor, lot); // roofless cut-away, like a dollhouse
  const binMats = [];
  for (let s = 0; s < 3; s++) {
    const shelf = rbox(stW - 1.2, 0.12, 0.8, mDark); shelf.position.set(0, 0.5 + s * 0.6, -stD / 2 + 1.0); store.add(shelf);
    for (let b = 0; b < 6; b++) {
      const empty = (s * 6 + b) % 3 === 1 || (s === 1 && b === 4);
      const bm = empty ? new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 0, roughness: 0.6 }) : mCrop;
      if (empty) binMats.push(bm);
      const bin = rbox(0.8, 0.28, 0.6, bm);
      bin.position.set(-stW / 2 + 1.1 + b * 0.95, 0.7 + s * 0.6, -stD / 2 + 1.0);
      store.add(bin);
      if (!empty) for (let k = 0; k < 3; k++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mCrop); fr.position.set(bin.position.x - 0.22 + k * 0.22, bin.position.y + 0.2, bin.position.z); store.add(fr); }
    }
  }
  store.scale.setScalar(S * 0.6);
  // Santa Ana recharge basins (beat 13)
  const basins = new THREE.Group();
  const basinMat = water(C.water.clone().lerp(C.green, 0.55), { emissive: C.green, emissiveIntensity: 0 });
  const bermMat = clay(C.green.clone().lerp(C.subject, 0.35), 0.8);
  const basinLL = [[-117.885, 33.838, 1.3, 0.8], [-117.865, 33.855, 1.0, 1.1], [-117.845, 33.842, 1.2, 0.7], [-117.90, 33.82, 0.9, 0.6], [-117.83, 33.86, 0.8, 0.8]];
  const basinMeshes = basinLL.map(([lo, la, w, dd]) => {
    const g = new THREE.Group();
    const berm = rbox(w + 0.3, 0.12, dd + 0.3, bermMat); berm.position.y = 0.06;
    const wtr = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, dd), basinMat); wtr.position.y = 0.1;
    g.add(berm, wtr);
    g.position.copy(ll(lo, la));
    g.scale.setScalar(0.24);
    basins.add(g);
    return g;
  });
  const storePos = ll(-118.205, 34.035);
  props.add(farm, pylons, barrier, truck, store, basins);
  farm.position.copy(ll(-119.45, 36.15)); farm.rotation.y = 0.5;
  barrier.position.copy(toW(...barrierA)); barrier.rotation.y = 0.9;
  store.position.copy(storePos); store.rotation.y = Math.PI * 0.12;

  // ---------- labels
  const labels = new Labels();
  const L = (id, text, lon, lat, o = {}) => labels.add(id, { text, pos: ll(lon, lat, 0.02), ...o });
  L('california', 'California', -119.9, 37.2, { size: 34, priority: 5 });
  L('pacific', 'Pacific Ocean', -123.2, 35.0, { italic: true, size: 32, priority: 4 });
  L('sierra', 'Sierra Nevada', -119.25, 37.75, { size: 32, priority: 5 });
  L('valley', 'Central Valley', -120.95, 37.55, { size: 32, priority: 5 });
  L('sacR', 'Sacramento River', -122.25, 39.55, { italic: true, size: 28, priority: 3 });
  L('sjR', 'San Joaquin River', -120.35, 36.98, { italic: true, size: 28, priority: 3 });
  L('delta', 'Sacramento–San Joaquin Delta', -121.62, 37.92, { size: 30, priority: 6 });
  L('tulare', 'Tulare Lake basin', -119.5, 36.28, { size: 30, priority: 6 });
  L('santaanaW', 'Santa Ana River watershed', -117.25, 33.62, { size: 30, priority: 6 });
  L('santaanaR', 'Santa Ana River', -117.62, 33.97, { italic: true, size: 28, priority: 4 });
  for (const c of vec.cities) {
    if (['Sacramento', 'Stockton', 'Fresno', 'Los Angeles', 'Bakersfield'].includes(c.name)) {
      labels.add(c.name, { text: c.name, pos: toW(c.x, c.y, 0.02), dot: true, size: 28, priority: c.name === 'Los Angeles' || c.name === 'Sacramento' ? 4 : 2 });
    }
  }
  await labels.sync();

  // ---------- shots
  const look = (lon, lat, dist, el, az, lens, lift = 0) => {
    const t = ll(lon, lat, lift);
    const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
    return { target: t, pos: t.clone().add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(dist)), lens };
  };
  const SHOT = {
    caHigh: look(-119.7, 37.1, 230, 80, 160, 50),
    caWide: look(-119.6, 37.1, 150, 66, 158, 35),
    sierraLow: look(-119.9, 37.45, 34, 20, 80, 35, 0.15),
    valleyWide: look(-120.6, 37.6, 92, 58, 156, 28),
    delta: look(-121.6, 38.05, 22, 48, 158, 50),
    floodTop: look(-120.5, 37.55, 92, 74, 156, 24),
    farm: look(-119.52, 36.12, 4.4, 48, 165, 35),
    store: look(-118.205, 34.035, 1.25, 40, 168, 50),
    saLow: look(-117.45, 33.90, 13.5, 52, 200, 35, 0.05),
    saPush: look(-117.62, 33.88, 10.5, 50, 198, 35, 0.05),
    caEnd: look(-119.6, 37.1, 118, 68, 158, 24),
  };

  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.05, 2000);
  const want = {};
  const sched = (f, a, b, ids, fadeIn = 10, fadeOut = 8) => {
    const o = smoothstep(a, a + fadeIn, f) * (1 - smoothstep(b - fadeOut, b, f));
    for (const id of ids) want[id] = Math.max(want[id] || 0, o);
  };

  function frame(f, ctx) {
    const time = f / 30;
    for (const k in want) delete want[k];
    let s;
    // ---- camera + per-beat state
    U.uTime.value = time;
    let flow = 0.25, levee = 0, flood = 0, green = 0, cloud = 0.6, warm = 0, routeO = 0, directO = 0, tulO = 0, saO = 0, exposureMap = 1;
    if (f < 300) {
      // Beat 2 (second half): arrive over California from the clouds
      s = move(f, 228, 292, SHOT.caHigh, SHOT.caWide, { fn: ease.outCubic });
      sched(f, 236, 300, ['california', 'pacific']);
    } else if (f < 780) {
      // Beat 6: crane up from the Sierra foothills to the whole valley
      s = move(f, 675, 776, SHOT.sierraLow, SHOT.valleyWide, { via: ll(-119.4, 37.9, 60) });
      flow = 1;
      sched(f, 668, 780, ['sierra'], 10, 0);
      sched(f, 700, 780, ['valley', 'sacR', 'sjR'], 12, 0);
    } else if (f < 900) {
      // Beat 7: push in on the Delta; levees glow amber under strain
      s = move(f, 795, 896, SHOT.valleyWide, SHOT.delta);
      flow = 1;
      levee = smoothstep(800, 830, f);
      flood = lerp(0, 0.11, prog(f, 840, 900));
      sched(f, 780, 812, ['sierra', 'valley', 'sacR', 'sjR'], 0, 12);
      sched(f, 815, 900, ['delta', 'Sacramento', 'Stockton']);
    } else if (f < 1080) {
      // Beat 8: crane up to top-down as separate floods join into one
      s = move(f, 915, 1062, SHOT.delta, SHOT.floodTop, { via: ll(-121.2, 37.8, 70) });
      flow = 0.8;
      levee = 1 - smoothstep(900, 930, f);
      flood = lerp(0.11, meta.floodEnd, ease.inOutSine(prog(f, 915, 1050)));
      tulO = smoothstep(960, 990, f);
      sched(f, 900, 915, ['delta', 'Sacramento', 'Stockton'], 0, 12);
      sched(f, 930, 1080, ['Sacramento', 'Fresno', 'valley'], 12, 0);
      sched(f, 975, 1080, ['tulare'], 12, 0);
    } else if (f < 1200) {
      // Beat 9: fly to a valley farm; the direct road is flooded, power goes out, truck takes the detour
      s = move(f, 1095, 1150, SHOT.floodTop, SHOT.farm, { via: ll(-119.9, 36.6, 40), viaT: ll(-119.7, 36.3) });
      flood = meta.floodEnd;
      cloud = 0.5;
      routeO = smoothstep(1130, 1145, f);
      directO = smoothstep(1130, 1145, f);
      sched(f, 1080, 1100, ['Sacramento', 'Fresno', 'valley', 'tulare'], 0, 14);
      sched(f, 1140, 1200, ['Fresno'], 10, 0);
    } else if (f < 1320) {
      // Beat 10: follow the truck south to a Los Angeles store with empty shelves
      flood = meta.floodEnd;
      routeO = 1; directO = 1 - smoothstep(1210, 1240, f);
      // Lock onto the truck within the first second, rise higher mid-route so the ground slides by gently
      const td = truckDist(f);
      const tp = routeAt(td).p;
      const lock = ease.inOutSine(prog(f, 1215, 1240));
      const tgt = SHOT.farm.target.clone().lerp(tp, lock);
      const lift = lerp(1, 4.2, Math.sin(Math.PI * prog(f, 1215, 1292)));
      const follow = { target: tgt, pos: tgt.clone().add(SHOT.farm.pos.clone().sub(SHOT.farm.target).multiplyScalar(lift)), lens: 35 };
      s = move(f, 1272, 1316, follow, SHOT.store, { fn: ease.inOutCubic });
      sched(f, 1200, 1225, ['Fresno'], 0, 12);
      sched(f, 1250, 1320, ['Los Angeles'], 10, 0);
    } else {
      // Beat 13 + end card: Santa Ana basins in warm light, then rise to the whole state
      warm = 1; cloud = 0; flow = 0.6;
      exposureMap = 0.9;
      s = move(f, 1652, 1700, SHOT.saLow, SHOT.saPush, { fn: ease.inOutSine }); // holds while title and caption land
      if (f > 1702) s = move(f, 1702, 1796, SHOT.saPush, SHOT.caEnd, { via: ll(-118.4, 34.6, 45), viaT: ll(-118.6, 35.4) });
      if (f >= 1800) s = move(f, 1800, 1920, SHOT.caEnd, { ...SHOT.caEnd, pos: SHOT.caEnd.pos.clone().multiplyScalar(1.03) }, { fn: ease.inOutSine });
      flood = lerp(0.2, 0.1, prog(f, 1620, 1800));
      green = ease.inOutSine(prog(f, 1650, 1780));
      saO = 1 - smoothstep(1730, 1760, f);
      sched(f, 1630, 1712, ['santaanaR', 'santaanaW', 'Los Angeles'], 10, 12);
      sched(f, 1750, 1800, ['california'], 10, 8);
    }
    // Near plane scales with distance so depth precision stays high (no flicker or z-fighting)
    const nearD = clamp(s.pos.distanceTo(s.target) * 0.03, 0.02, 3);
    if (Math.abs(cam.near - nearD) > 1e-6) { cam.near = nearD; cam.far = nearD * 2500; cam.updateProjectionMatrix(); }
    applyCam(cam, s);
    lights.follow(s.target, clamp(s.pos.distanceTo(s.target) * 0.35, 3, 60));
    lights.warmth(warm);
    U.uFlood.value = flood; U.uLevee.value = levee; U.uGreen.value = green; U.uCloud.value = cloud;
    // Fog tracks the view distance so far map edges melt into the background
    const dist = s.pos.distanceTo(s.target);
    scene.fog.near = dist * 1.1; scene.fog.far = dist * 2.4;

    for (const l of lines) updateRibbon(l.mat, cam, time);
    for (const r of riverLines) {
      r.mat.uniforms.uFlow.value = r.kind === 'north' ? flow * 0.5 : flow;
      r.mat.uniforms.uEdge.value = r.kind === 'trunk' ? levee : 0;
      r.mat.uniforms.uPx.value = (r.kind === 'trunk' ? 5.5 : 3.6) * (r.kind === 'trunk' ? 1 + levee * 1.2 : 1);
      r.mat.uniforms.uFlowPeriod.value = clamp(dist * 0.02, 0.4, 3.5);
    }
    santaAna.mat.uniforms.uFlow.value = f >= 1620 ? 1 : 0.2;
    santaAna.mat.uniforms.uFlowPeriod.value = clamp(dist * 0.02, 0.15, 3.5);
    tulareOutline.mat.uniforms.uOpacity.value = tulO * (f < 1100 ? 1 : 1 - smoothstep(1085, 1100, f));
    santaAnaOutline.mat.uniforms.uOpacity.value = saO * smoothstep(1640, 1660, f);

    // Route props
    const routeOn = f >= 1080 && f < 1320;
    terrain.receiveShadow = routeOn || f >= 1620; // shadows only matter when props stand on the map
    props.children.forEach((c) => (c.visible = false));
    if (routeOn) {
      farm.visible = pylons.visible = barrier.visible = truck.visible = store.visible = true;
      route.mat.uniforms.uOpacity.value = routeO;
      route.mat.uniforms.uReveal.value = truckDist(f) + 0.02;
      direct.mat.uniforms.uOpacity.value = directO;
      const tb = spring((f - 1135) / 30, 0.6);
      barrier.scale.setScalar(S * Math.max(0.0001, tb));
      const out = smoothstep(1140, 1146, f) * (0.75 + 0.25 * Math.sin(time * 9));
      glowMats.forEach((m) => { m.opacity = out; m.emissiveIntensity = 2.2 * out; });
      farm.scale.setScalar(S * Math.max(1e-4, spring((f - 1100) / 30)));
      pylons.scale.setScalar(Math.max(1e-4, spring((f - 1108) / 30)));
      const { p, dir } = routeAt(truckDist(f));
      truck.position.copy(p);
      truck.rotation.y = Math.atan2(dir.x, dir.z);
      store.scale.setScalar(S * 0.6 * Math.max(1e-4, spring((f - 1262) / 30)));
      const gaps = smoothstep(1290, 1300, f) * (0.7 + 0.3 * Math.sin(time * 6));
      binMats.forEach((m) => (m.emissiveIntensity = 1.4 * gaps));
    } else {
      route.mat.uniforms.uOpacity.value = 0;
      direct.mat.uniforms.uOpacity.value = 0;
    }
    if (f >= 1620) {
      basins.visible = true;
      basinMeshes.forEach((b, i) => b.scale.setScalar(0.24 * Math.max(1e-4, spring((f - 1640 - i * 4) / 30))));
      basinMat.emissiveIntensity = 0.9 * smoothstep(1650, 1690, f);
    }

    labels.update(cam, want, ctx.avoid);
    return {
      scene, camera: cam, labels: labels.scene,
      bloom: 0.25, exposure: exposureMap * (f >= 1800 ? lerp(1, 0.62, ease.inOutSine(prog(f, 1800, 1830))) : 1),
      vignette: f >= 1800 ? lerp(0.25, 0.5, prog(f, 1800, 1830)) : 0.25,
    };
  }

  // Truck position along the route by frame (beats 9-10)
  function truckDist(f) {
    const leg1 = Math.min(firstLeg, 1.1); // beat 9: the truck sets off on the detour and stays in frame
    if (f < 1200) return lerp(0, leg1, ease.inOutSine(prog(f, 1150, 1196)));
    return lerp(leg1, routeLen, ease.inOutSine(prog(f, 1215, 1288)));
  }

  return { scene, frame, labels, cam, ll };
}
