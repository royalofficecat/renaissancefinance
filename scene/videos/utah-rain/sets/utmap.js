// The Utah relief map (globe fly-down, the "two water worlds" divide, Lake Powell, Great Salt Lake, the payoff).
// Real base: NAD83 / UTM zone 12N, USGS 3DEP relief at 2x, Natural Earth rivers and lakes, the USGS WBD drainage
// divide. Imagined layers (labelled "imagined scenario"): rain shadow, runoff threads, greenery, the lake's growth,
// ponding in closed basins, flow arrows. 1 world unit = 10 km.
import * as THREE from 'three';
import { dataTexture, loadBin, loadJSON, loadPixels, samplePix } from '../../../src/core/data.js';
import { ribbonGeometry, ribbonMaterial, updateRibbon } from '../../../src/core/ribbon.js';
import { Labels } from '../../../src/core/labels.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { clamp, ease, lerp, prog } from '../../../src/core/util.js';
import { C, HEX, S, SKY_REFL, SKY_U, backdrop, clay, rig, tone } from '../look.js';

const KM = 10000;
const EXAG = 2;
const SEG_X = 420, SEG_Z = 500;
const FPS = 30;
const ll2utm = (lon, lat) => {
  // NAD83 / UTM zone 12N (central meridian -111), Snyder's series; accurate to centimetres in Utah
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const phi = (lat * Math.PI) / 180, lam = ((lon + 111) * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, Cc = ep2 * Math.cos(phi) ** 2, A = lam * Math.cos(phi);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const x = 500000 + k0 * N * (A + ((1 - T + Cc) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * Cc - 58 * ep2) * A ** 5) / 120);
  const y = k0 * (M + N * Math.tan(phi) * (A * A / 2 + ((5 - T + 9 * Cc + 4 * Cc * Cc) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * Cc - 330 * ep2) * A ** 6) / 720));
  return [x, y];
};

// The imagined scenario over time (frame -> 0..1 levels), shared by every map beat
export function scenario(f) {
  const up = (a, b) => ease.inOutSine(prog(f, a, b));
  const clearing = up(1500, 1565);
  const after = up(1640, 1790);
  return {
    cloud: 1 - clearing,
    runoff: (0.15 + 0.85 * up(200, 1020)) * (1 - 0.65 * after),
    green: up(300, 900) * (1 - 0.6 * after),
    grow: (0.9 * up(1020, 1380) + 0.1 * up(1380, 1500)) * (1 - 0.6 * after),
    pond: up(780, 1440) * (1 - 0.55 * after),
    divide: up(790, 840) * (1 - up(1010, 1040)),
    warmth: clearing,
    rings: after,
  };
}

export async function createUtahMap(pipe) {
  const [meta, vec, hbuf, masks, wat, flow] = await Promise.all([
    loadJSON('ut_meta.json'), loadJSON('ut_vectors.json'), loadBin('ut_height.i16'), loadPixels('ut_masks.png'), loadPixels('ut_water.png'), loadPixels('ut_flow.png'),
  ]);
  const { x0, x1, y0, y1, res, nx, ny } = meta;
  const H = new Int16Array(hbuf);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const WX = (x1 - x0) / KM, WZ = (y1 - y0) / KM;
  const pix = (x, y) => [(x - x0) / res, (y1 - y) / res];
  const heightAt = (x, y) => {
    let [px, py] = pix(x, y);
    px = clamp(px - 0.5, 0, nx - 1.001); py = clamp(py - 0.5, 0, ny - 1.001);
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const g = (a, b) => H[b * nx + a];
    return (g(ix, iy) * (1 - fx) + g(ix + 1, iy) * fx) * (1 - fy) + (g(ix, iy + 1) * (1 - fx) + g(ix + 1, iy + 1) * fx) * fy;
  };
  const BASE = 1100; // metres: lowest ground in frame sits near y = 0
  const yOf = (x, y) => Math.max(0, heightAt(x, y) - BASE) * (EXAG / KM) + 0.03 * samplePix(masks, ...pix(x, y), 1);
  const toW = (x, y, lift = 0) => new THREE.Vector3((x - cx) / KM, yOf(x, y) + lift, -(y - cy) / KM);
  const ll = (lon, lat, lift = 0) => toW(...ll2utm(lon, lat), lift);

  // ---------- terrain
  const geo = new THREE.PlaneGeometry(WX, WZ, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, yOf(P.getX(i) * KM + cx, -P.getZ(i) * KM + cy));
  geo.computeVertexNormals();
  const meshY = (wx, wz) => {
    const gx = clamp((wx / WX + 0.5) * SEG_X, 0, SEG_X - 1e-3), gz = clamp((wz / WZ + 0.5) * SEG_Z, 0, SEG_Z - 1e-3);
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const g = (a, b) => P.getY(b * (SEG_X + 1) + a);
    return (g(ix, iz) * (1 - fx) + g(ix + 1, iz) * fx) * (1 - fz) + (g(ix, iz + 1) * (1 - fx) + g(ix + 1, iz + 1) * fx) * fz;
  };
  // full-resolution normal map for crisp hillshading
  const nrm = new Uint8Array(nx * ny * 4), Yg = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) Yg[j * nx + i] = Math.max(0, H[j * nx + i] - BASE) * (EXAG / KM);
  const d2 = (2 * res) / KM;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const L = Yg[j * nx + Math.max(0, i - 1)], R = Yg[j * nx + Math.min(nx - 1, i + 1)];
    const N = Yg[Math.max(0, j - 1) * nx + i], Sx = Yg[Math.min(ny - 1, j + 1) * nx + i];
    const ax = -(R - L) / d2, az = -(Sx - N) / d2, len = Math.hypot(ax, 1, az);
    const o = ((ny - 1 - j) * nx + i) * 4;
    nrm[o] = ((ax / len) * 0.5 + 0.5) * 255; nrm[o + 1] = ((1 / len) * 0.5 + 0.5) * 255; nrm[o + 2] = ((az / len) * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
  }
  const normalTex = new THREE.DataTexture(nrm, nx, ny);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.magFilter = THREE.LinearFilter;
  normalTex.generateMipmaps = true; normalTex.anisotropy = 4; normalTex.needsUpdate = true;

  const BG = tone(C.storm, 1.0);
  const U = {
    uMasks: { value: dataTexture(masks) }, uWater: { value: dataTexture(wat) }, uFlow: { value: dataTexture(flow) },
    uBg: { value: BG }, uRed: { value: S.red }, uCream: { value: S.cream }, uWaterCol: { value: S.water }, uGreen: { value: S.green }, uStorm: { value: C.storm },
    uCloud: { value: 1 }, uRunoff: { value: 0 }, uGreenK: { value: 0 }, uGrow: { value: 0 }, uPond: { value: 0 }, uDivide: { value: 0 }, uTime: { value: 0 }, uRings: { value: 0 },
  };
  const mat = clay(0xffffff, 0.85, { normalMap: normalTex, normalMapType: THREE.ObjectSpaceNormalMap });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, SKY_U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMapUv; varying float vY; varying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMapUv = uv; vY = position.y; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec2 vMapUv; varying float vY; varying vec3 vWPos;
        uniform sampler2D uMasks, uWater, uFlow;
        uniform vec3 uBg, uRed, uCream, uWaterCol, uGreen, uStorm;
        uniform float uCloud, uRunoff, uGreenK, uGrow, uPond, uDivide, uTime, uRings;
        float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
        float fb(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*vn(p); p=p*2.1+7.3; a*=0.5;} return s; }
        float gWater = 0.0, gEdge = 1.0;
        ${SKY_REFL}`)
      .replace('#include <color_fragment>', /* glsl */ `
        vec3 mk = texture2D(uMasks, vMapUv).rgb;
        vec3 wt = texture2D(uWater, vMapUv).rgb;
        vec3 fl = texture2D(uFlow, vMapUv).rgb;
        float ut = mk.g, gb = mk.b;
        // sandstone: red on the Colorado Plateau, paler desert cream on the Great Basin floors, darker on the heights
        float redness = mix(0.95, 0.5, gb) * smoothstep(0.0, 0.2, vY) + 0.12;
        vec3 land = mix(uCream, uRed, clamp(redness, 0.0, 1.0));
        land *= 0.82 + 0.25 * smoothstep(0.02, 0.5, vY);
        land = mix(land, land * 0.72, smoothstep(0.42, 0.62, vY));
        // imagined greenery where the land can hold it
        float gn = fl.g * uGreenK * smoothstep(0.35, 0.65, fb(vWPos.xz * 1.3) + fl.g * 0.4);
        land = mix(land, mix(uGreen, uGreen * 0.7, fb(vWPos.xz * 3.0)), clamp(gn * 1.4, 0.0, 0.85));
        // the two water worlds
        land = mix(land, mix(land * 0.85, uWaterCol * 0.7, 0.32), uDivide * (1.0 - gb) * ut);
        land = mix(land, mix(land * 0.85, uGreen * 0.7, 0.38), uDivide * gb * ut);
        // neighbouring states sink back towards the storm
        land = mix(mix(land * 0.6, uStorm * 1.1, 0.72), land, ut);
        // runoff threads in the washes (more of them as the rain goes on)
        float thr = mix(0.86, 0.6, uRunoff);
        float thread = smoothstep(thr, thr + 0.05, fl.r) * smoothstep(0.0, 0.05, uRunoff);
        // water: lakes today, the lake's imagined growth over the lowest ground, ponds in closed basins
        float lake = smoothstep(0.4, 0.6, wt.r);
        float grow = (1.0 - smoothstep(uGrow - 0.03, uGrow + 0.01, wt.g + (fb(vWPos.xz * 6.0) - 0.5) * 0.04)) * step(0.001, uGrow) * step(wt.g, 0.995);
        float pond = smoothstep(1.0 - uPond * 0.9, 1.0 - uPond * 0.9 + 0.08, wt.b) * step(0.02, uPond);
        float wet = max(max(lake, grow), max(pond, thread * 0.9));
        vec3 wcol = mix(uWaterCol * 1.05, uWaterCol * 0.8, lake);
        // pale rings where the water has been (the months-later beat)
        float ring = uRings * (1.0 - wet) * max(step(0.01, wt.g) * step(wt.g, 0.98), smoothstep(0.1, 0.4, wt.b)) * 0.55;
        land = mix(land, uCream * 1.05, ring);
        vec3 col = mix(land, wcol, wet);
        gWater = wet;
        // storm cloud shadows drifting over the land
        float cl = uCloud * smoothstep(0.4, 0.75, fb(vWPos.xz * 0.05 + vec2(uTime * 0.04, uTime * 0.015)));
        col *= 1.0 - 0.3 * cl;
        gEdge = smoothstep(0.0, 0.06, min(vMapUv.x, 1.0 - vMapUv.x)) * smoothstep(0.0, 0.06, min(vMapUv.y, 1.0 - vMapUv.y));
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.14, gWater);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), gWater * 0.9));`)
      .replace('#include <opaque_fragment>', `outgoingLight += skyReflect(normal, geometryViewDir, gWater * 0.8);
        outgoingLight = mix(uBg, outgoingLight, gEdge);
        #include <opaque_fragment>`);
  };
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  const scene = new THREE.Scene();
  const sky = backdrop(scene);
  scene.fog = new THREE.Fog(BG.clone(), 160, 520);
  scene.add(terrain);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(WX, 0.6, WZ), new THREE.MeshBasicMaterial({ color: BG }));
  slab.position.y = -0.32;
  scene.add(slab);
  const lights = rig(scene, pipe.renderer, { size: 40, dist: 160, intensity: 2.1 });
  lights.follow(new THREE.Vector3(0, 0, 0), 40);

  // ---------- lines: real rivers, the drainage divide, imagined flow arrows
  const drape = (pts, step = 1500, lift = 0.02) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let k = 0; k < n; k++) {
        const w = new THREE.Vector3((ax + ((bx - ax) * k) / n - cx) / KM, 0, -(ay + ((by - ay) * k) / n - cy) / KM);
        w.y = meshY(w.x, w.z) + lift;
        out.push(w);
      }
    }
    const [lx, ly] = pts[pts.length - 1];
    const w = new THREE.Vector3((lx - cx) / KM, 0, -(ly - cy) / KM);
    w.y = meshY(w.x, w.z) + lift;
    out.push(w);
    return out;
  };
  const mats = [];
  const addLine = (pts, o, group = scene) => {
    const g = ribbonGeometry(drape(pts));
    const m = ribbonMaterial(o);
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 2;
    group.add(mesh);
    mats.push(m);
    return { mesh, mat: m, len: g.userData.length };
  };
  const riverMat = [];
  for (const r of vec.rivers) riverMat.push(addLine(r.pts, { color: tone(C.water, 0.9), px: /Colorado|Green/.test(r.name) ? 4.5 : 3, maxW: 0.25 }));
  const divide = vec.divide.map((d) => addLine(d, { color: new THREE.Color('#D8D2C6'), px: 4, maxW: 0.4, dash: 12, opacity: 0, emissive: 0.2 }));
  // arrows: keep the longer, curving ones (flat filled ground gives ruler-straight runs)
  const arrowsG = new THREE.Group();
  scene.add(arrowsG);
  const straight = (pts) => {
    const a = pts[0], b = pts[pts.length - 1];
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(1, L);
  };
  const arrows = vec.arrows.filter((a, i) => a.pts.length > 10 && i % 2 === 0 && !(a.pts.length > 18 && straight(a.pts) > 0.985)).map((a) => {
    const col = a.basin === 'gb' ? tone(C.green, 1.05) : tone(C.water, 1.1);
    const l = addLine(a.pts, { color: col, px: 3.6, maxW: 0.3, opacity: 0, flow: 0.6, emissive: 0.0 }, arrowsG);
    l.mat.uniforms.uFlowPeriod.value = 1.2;
    let end = null;
    if (a.basin === 'gb') {
      const [ex, ey] = a.pts[a.pts.length - 1];
      end = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.3, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      end.position.set((ex - cx) / KM, 0, -(ey - cy) / KM);
      end.position.y = meshY(end.position.x, end.position.z) + 0.04;
      end.renderOrder = 3;
      arrowsG.add(end);
    }
    return { ...l, end, basin: a.basin };
  });

  // ---------- labels (the brief's places only)
  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  const slc = vec.cities.find((c) => c.name === 'Salt Lake City');
  labels.add('slc', { text: 'Salt Lake City', pos: toW(slc.x, slc.y, 0.05), dot: true, size: 30, priority: 3 });
  labels.add('gsl', { text: 'Great Salt Lake', pos: ll(-112.62, 41.18, 0.1), italic: true, size: 30, priority: 2 });
  labels.add('powell', { text: 'Lake Powell', pos: ll(-110.85, 37.25, 0.1), italic: true, size: 30, priority: 2 });
  labels.add('colorado', { text: 'Colorado River', pos: ll(-109.9, 38.55, 0.1), italic: true, size: 28, priority: 1 });
  labels.add('basin', { text: 'Great Basin', pos: ll(-113.4, 39.2, 0.3), size: 30, priority: 1 });
  labels.add('plateau', { text: 'Colorado River system', pos: ll(-110.6, 38.0, 0.3), size: 30, priority: 1 });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.5, 1500);
  // Beat 7 (780-900): almost top-down over the whole state, slow push-in
  const U7 = ll(-111.6, 39.3);
  const A7 = { pos: U7.clone().add(new THREE.Vector3(2, 132, 52)), target: U7.clone().add(new THREE.Vector3(0, 0, -1)), lens: 35 };
  const B7 = { pos: U7.clone().add(new THREE.Vector3(2, 121, 48)), target: U7.clone().add(new THREE.Vector3(0, 0, -1)), lens: 35 };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = f / FPS;
      const sc = scenario(f);
      applyCam(cam, move(f, 800, 882, A7, B7, { fn: ease.inOutSine }));
      U.uCloud.value = sc.cloud; U.uRunoff.value = sc.runoff; U.uGreenK.value = sc.green; U.uGrow.value = sc.grow; U.uPond.value = sc.pond;
      U.uDivide.value = sc.divide; U.uTime.value = t; U.uRings.value = sc.rings;
      lights.warmth(sc.warmth);
      sky.U.uClear.value = sc.warmth;
      for (const d of divide) { d.mat.uniforms.uOpacity.value = 0.9 * sc.divide; d.mat.uniforms.uReveal.value = d.len * ease.inOutSine(prog(f, 790, 830)); }
      const rev = ease.inOutSine(prog(f, 805, 870));
      for (const a of arrows) {
        a.mat.uniforms.uOpacity.value = 0.95 * sc.divide;
        a.mat.uniforms.uReveal.value = a.len * rev;
        if (a.end) a.end.material.opacity = 0.9 * sc.divide * prog(rev, 0.85, 1);
      }
      mats.forEach((m) => updateRibbon(m, cam, t));
      const lab = sc.divide;
      labels.update(cam, { slc: 0.9, gsl: 0.9, powell: 0.9 * lab, colorado: 0.9 * lab, basin: lab, plateau: lab }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.25, exposure: 1.0, vignette: 0.26 };
    },
  };
}
