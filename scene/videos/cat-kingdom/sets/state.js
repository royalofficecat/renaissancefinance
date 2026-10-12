// The statewide tabletop map (beat 3's flat takeover map, the fly-tos, and beat 13's finale).
// Real base: California Albers (EPSG:3310), USGS 3DEP relief at 2x, Natural Earth roads and urban areas.
// Invented layers (all labelled fictional): paw-print territory trails, the human service network on the
// real roads, gold sun estates, green sanctuary domes, and the living-room furniture of the finale.
// 1 world unit = 10 km.
import * as THREE from 'three';
import { albers } from '../../../src/core/albers.js';
import { dataTexture, loadBin, loadJSON, loadPixels, samplePix } from '../../../src/core/data.js';
import { ribbonGeometry, ribbonMaterial, updateRibbon } from '../../../src/core/ribbon.js';
import { Labels } from '../../../src/core/labels.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng } from '../../../src/core/util.js';
import { C, HEX, S, SKY_REFL, SKY_U, clay, glossy, mixc, rig, tone } from '../look.js';
import { catParts, coatMaterial, makeCat } from '../lib/cat.js';
import { beatMove } from '../lib/beat.js';
import { spring } from '../../../src/core/util.js';
import { bowl, catTree, cushion, mesh, rbox, shrub, sisalMaterial, yarnBall } from '../lib/props.js';

const KM = 10000;
const EXAG = 2; // gentle 2x relief (style bible)
const LIFT = 0.04;
const SEG_X = 420, SEG_Z = 462;
const FPS = 30;

// Fictional "sun estates": gold pools of light (lon, lat, radius in world units)
const ESTATES = [[-116.53, 33.82, 4.2], [-119.3, 34.55, 2.8], [-117.75, 33.78, 2.4], [-120.45, 35.45, 2.6], [-121.5, 36.55, 2.3], [-117.2, 34.6, 3.0], [-119.45, 35.55, 2.4]];
// The living room's window light falls across the Central Valley (centre lon/lat, half sizes, angle)
const WINDOW = { lon: -120.35, lat: 37.35, hw: 15, hh: 21, ang: -0.62 };

export async function createState(pipe) {
  const [meta, vec, cats, hbuf, masks, extra, urban] = await Promise.all([
    loadJSON('ca_meta.json'), loadJSON('ca_vectors.json'), loadJSON('cats_vectors.json'), loadBin('ca_height.i16'),
    loadPixels('ca_masks.png'), loadPixels('ca_extra.png'), loadPixels('cats_urban.png'),
  ]);
  const { x0, x1, y0, y1, res, nx, ny } = meta;
  const H = new Int16Array(hbuf);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const WX = (x1 - x0) / KM, WZ = (y1 - y0) / KM;

  // ---------- coordinates
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
  const yOf = (x, y) => (isLand(x, y) ? Math.max(heightAt(x, y), 0) * (EXAG / KM) + LIFT * caSoft(x, y) : 0);
  const toW = (x, y, lift = 0) => new THREE.Vector3((x - cx) / KM, yOf(x, y) + lift, -(y - cy) / KM);
  const ll = (lon, lat, lift = 0) => toW(...albers(lon, lat), lift);

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
  // normal map at the full 600 m data resolution, for crisp soft hillshading
  const nrm = new Uint8Array(nx * ny * 4), Yg = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) Yg[j * nx + i] = yOf(x0 + (i + 0.5) * res, y1 - (j + 0.5) * res);
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

  const winC = ll(WINDOW.lon, WINDOW.lat);
  const estates = ESTATES.map(([lo, la, r]) => { const p = ll(lo, la); return new THREE.Vector4(p.x, p.z, r, 0); });
  const BG = tone(C.blue, 0.86);
  const U = {
    uMasks: { value: dataTexture(masks) }, uExtra: { value: dataTexture(extra) }, uUrban: { value: dataTexture(urban) },
    uBg: { value: BG }, uCream: { value: tone(C.cream, 0.98) }, uGreen: { value: S.green }, uGreen2: { value: mixc(S.green, C.cream, 0.35) },
    uSea: { value: C.blue.clone() }, uShore: { value: tone(C.blue, 1, 0.38) }, uUrbanCol: { value: mixc(tone(C.cream, 0.86), C.terra, 0.12) },
    uDim: { value: 0.78 }, uGold: { value: tone(C.gold, 1.0) }, uWin: { value: new THREE.Vector4(winC.x, winC.z, WINDOW.hw, WINDOW.hh) }, uWinAng: { value: WINDOW.ang },
    uWinK: { value: 0 }, uEstK: { value: 0 }, uEstates: { value: estates }, uFieldK: { value: 1 },
  };
  const terrainMat = clay(0xffffff, 0.85, { normalMap: normalTex, normalMapType: THREE.ObjectSpaceNormalMap });
  terrainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, SKY_U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMapUv; varying float vY; varying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMapUv = uv; vY = position.y; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec2 vMapUv; varying float vY; varying vec3 vWPos;
        uniform sampler2D uMasks, uExtra, uUrban;
        uniform vec3 uBg, uCream, uGreen, uGreen2, uSea, uShore, uUrbanCol, uGold;
        uniform float uDim, uWinAng, uWinK, uEstK, uFieldK; uniform vec4 uWin; uniform vec4 uEstates[${ESTATES.length}];
        float gWater = 0.0, gEdge = 1.0, gLand = 1.0, gCA = 1.0;
        ${SKY_REFL}`)
      .replace('#include <color_fragment>', /* glsl */ `
        vec3 mk = texture2D(uMasks, vMapUv).rgb;
        vec3 ex = texture2D(uExtra, vMapUv).rgb;
        float urb = texture2D(uUrban, vMapUv).r;
        float land = smoothstep(0.4, 0.6, mk.r);
        float ca = mk.g;
        // cream land, a touch lighter on the heights
        vec3 landCol = uCream * (0.86 + 0.16 * smoothstep(0.02, 0.8, vY));
        // Central Valley: rows of fields (catnip and food crops), in two greens
        float rows = 0.5 + 0.5 * sin((vWPos.x * 0.8 + vWPos.z * 0.45) * 9.0);
        float field = ex.b * ca * uFieldK;
        landCol = mix(landCol, mix(uGreen, uGreen2, step(0.5, rows)), smoothstep(0.25, 0.6, field) * 0.9);
        landCol = mix(landCol, uUrbanCol, smoothstep(0.2, 0.6, urb) * ca);
        landCol = mix(mix(landCol * 0.9, uSea * 0.86, 0.8), landCol, ca);
        gCA = ca;
        vec3 seaCol = mix(uShore, uSea * 0.92, smoothstep(0.0, 0.35, ex.g));
        vec3 col = mix(seaCol, landCol, land);
        gWater = 1.0 - land; gLand = land;
        gEdge = smoothstep(0.0, 0.07, min(vMapUv.x, 1.0 - vMapUv.x)) * smoothstep(0.0, 0.07, min(vMapUv.y, 1.0 - vMapUv.y));
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.5, gWater);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), max(gWater, (1.0 - gCA) * 0.85)));`)
      .replace('#include <opaque_fragment>', /* glsl */ `
        outgoingLight += skyReflect(normal, geometryViewDir, gWater * 0.35);
        // The window's sunbeam across the valley: four panes of warm light with soft edges
        vec2 dw = vWPos.xz - uWin.xy;
        float ca2 = cos(uWinAng), sa2 = sin(uWinAng);
        vec2 q = vec2(ca2 * dw.x - sa2 * dw.y, sa2 * dw.x + ca2 * dw.y) / uWin.zw;
        float pane = (1.0 - smoothstep(0.93, 1.0, abs(q.x))) * (1.0 - smoothstep(0.95, 1.0, abs(q.y)));
        pane *= smoothstep(0.035, 0.07, abs(q.x)) * smoothstep(0.025, 0.05, abs(q.y));
        // sun estates: soft round pools of gold light
        float est = 0.0;
        for (int i = 0; i < ${ESTATES.length}; i++) {
          float dd = length(vWPos.xz - uEstates[i].xy) / uEstates[i].z;
          est = max(est, 1.0 - smoothstep(0.55, 1.0, dd));
        }
        vec3 warm = vec3(1.0, 0.86, 0.6);
        outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.62, 1.4, 1.02) + uGold * 0.06, pane * uWinK * gLand * gCA);
        outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.32, 1.12, 0.74) + uGold * 0.13, est * uEstK * gCA * gLand);
        outgoingLight = mix(uBg, outgoingLight, gEdge);
        #include <opaque_fragment>`);
  };
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;

  const scene = new THREE.Scene();
  scene.background = BG.clone();
  scene.fog = new THREE.Fog(BG.clone(), 140, 420);
  scene.add(terrain);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(WX, 0.6, WZ), new THREE.MeshBasicMaterial({ color: BG, fog: false }));
  slab.position.y = -0.62;
  scene.add(slab);
  const lights = rig(scene, pipe.renderer, { size: 75, dist: 260, intensity: 4.2, fillK: 0.3, rimK: 0.3, keyDir: [-0.55, 0.62, 0.55] });
  lights.follow(new THREE.Vector3(0, 0, 5), 75);

  // ---------- lines: the human service network follows the real highways (light-blue dashes)
  const drape = (pts, step = 2500, lift = 0.02) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let k = 0; k < n; k++) {
        const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
        const w = new THREE.Vector3((x - cx) / KM, 0, -(y - cy) / KM);
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
  const lineMats = [];
  const netMat = ribbonMaterial({ color: tone(C.blue, 1, 0.22), px: 4.2, maxW: 0.45, dash: 10, opacity: 1 });
  lineMats.push(netMat);
  const network = new THREE.Group();
  for (const r of cats.roads) {
    const m = new THREE.Mesh(ribbonGeometry(drape(r.pts)), r.major ? netMat : netMat);
    m.renderOrder = 2;
    network.add(m);
  }
  scene.add(network);

  // ---------- paw-print trails along the (fictional) territory borders
  const pawGeo = (() => {
    const parts = [];
    const disc = (x, z, rx, rz) => { const g = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2); g.scale(rx, 1, rz); g.translate(x, 0, z); parts.push(g); };
    disc(0, 0.08, 0.34, 0.28);
    for (const [x, z] of [[-0.32, -0.2], [-0.12, -0.38], [0.12, -0.38], [0.32, -0.2]]) disc(x, z, 0.11, 0.14);
    const merged = new THREE.BufferGeometry();
    const pos = [], idx = [];
    for (const g of parts) {
      const base = pos.length / 3, p = g.attributes.position.array;
      for (let i = 0; i < p.length; i++) pos.push(p[i]);
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i++) idx.push(base + ix[i]);
    }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.setIndex(idx);
    merged.computeVertexNormals();
    return merged;
  })();
  const pawMat = new THREE.MeshStandardMaterial({ color: tone(C.terra, 0.95), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const prints = [];
  for (const b of cats.territories) {
    const pts = drape(b, 1500, 0.03);
    let acc = 0, side = 1;
    for (let i = 1; i < pts.length; i++) {
      const seg = pts[i].distanceTo(pts[i - 1]);
      acc += seg;
      while (acc > 0.95) {
        acc -= 0.95;
        const t = 1 - acc / seg;
        const p = pts[i - 1].clone().lerp(pts[i], t);
        const dir = pts[i].clone().sub(pts[i - 1]).setY(0).normalize();
        const perp = new THREE.Vector3(-dir.z, 0, dir.x);
        p.addScaledVector(perp, side * 0.2);
        p.y = meshY(p.x, p.z) + 0.03;
        prints.push({ p, yaw: Math.atan2(dir.x, dir.z) + Math.PI, s: side });
        side = -side;
      }
    }
  }
  const pawInst = new THREE.InstancedMesh(pawGeo, pawMat, prints.length);
  pawInst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3();
  prints.forEach((pr, i) => {
    q4.setFromEuler(new THREE.Euler(0, pr.yaw, 0));
    s4.setScalar(0.42);
    m4.compose(pr.p, q4, s4);
    pawInst.setMatrixAt(i, m4);
  });
  pawInst.renderOrder = 3;
  scene.add(pawInst);

  // ---------- miniature city blocks inside the real urban areas
  const blockGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const blockInst = new THREE.InstancedMesh(blockGeo, clay(0xffffff, 0.75), cats.blocks.length);
  blockInst.castShadow = blockInst.receiveShadow = true;
  const BR = rng(5);
  const bcols = [tone(C.cream, 1, 0.3), tone(C.cream, 1, 0.15), tone(C.cream, 0.92), mixc(C.cream, C.terra, 0.35), tone(C.cream, 1, 0.3)];
  cats.blocks.forEach(([x, y, k], i) => {
    const p = toW(x, y);
    p.y = meshY(p.x, p.z) - 0.01;
    q4.setFromEuler(new THREE.Euler(0, BR() * 0.4, 0));
    s4.set(0.2 + BR() * 0.06, 0.07 + 0.18 * k * BR(), 0.2 + BR() * 0.06);
    m4.compose(p, q4, s4);
    blockInst.setMatrixAt(i, m4);
    blockInst.setColorAt(i, bcols[Math.floor(BR() * bcols.length)]);
  });
  scene.add(blockInst);

  // ---------- the living room (finale): shelves along the Sierra, cushions down the coast, bowls in the cities
  const room = new THREE.Group();
  scene.add(room);
  const wood = clay(S.wood, 0.6), carpet = clay(tone(C.terra, 0.92), 0.95), post = sisalMaterial();
  const SHELVES = [[-120.25, 39.15, 0], [-119.7, 38.35, 1], [-119.15, 37.55, 2], [-118.62, 36.75, 3], [-118.2, 35.95, 2]];
  const shelfTop = [];
  SHELVES.forEach(([lo, la, step], i) => {
    const base = ll(lo, la);
    const ground = meshY(base.x, base.z);
    const top = ground + 2.6 + step * 1.3;
    const g = new THREE.Group();
    g.add(mesh(rbox(9.0, 0.6, 3.6, 0.18), wood, { pos: [0, top, 0] }));
    g.add(mesh(rbox(8.5, 0.22, 3.2, 0.1), carpet, { pos: [0, top + 0.38, 0] }));
    for (const x of [-3.2, 3.2]) g.add(mesh(new THREE.CylinderGeometry(0.42, 0.5, top - ground + 0.2, 18), post, { pos: [x, (top + ground) / 2 - 0.1, 0] }));
    g.position.set(base.x, 0, base.z);
    g.rotation.y = -0.75 + (i % 2 ? 0.12 : -0.12);
    room.add(g);
    shelfTop.push({ g, top: top + 0.49 });
  });
  const COAST = [[-123.8, 39.45], [-123.05, 38.35], [-122.5, 37.25], [-121.9, 36.3], [-121.15, 35.45], [-120.5, 34.55], [-119.3, 34.15], [-118.35, 33.7], [-117.45, 33.05]];
  const cushCols = [S.terra, tone(C.cream, 1, 0.1), mixc(C.terra, C.cream, 0.45)];
  const cushions = COAST.map(([lo, la], i) => {
    const p = ll(lo, la);
    const cu = cushion({ w: 8.0, d: 5.0, h: 1.5, color: cushCols[i % 3], piping: tone(C.cream, 1, 0.3) });
    cu.position.set(p.x - 2.6, 0.05, p.z + 0.6);
    const next = ll(...(COAST[i + 1] || COAST[i - 1]));
    cu.rotation.y = Math.atan2(next.x - p.x, next.z - p.z) + Math.PI / 2; // long side along the coast
    room.add(cu);
    return cu;
  });
  const bowls = [];
  for (const [lo, la, kind, r] of [[-118.12, 34.08, 'food', 4.6], [-122.12, 37.58, 'water', 3.8], [-121.4, 38.62, 'food', 2.8], [-117.05, 32.8, 'water', 2.6]]) {
    const p = ll(lo, la);
    const b = bowl({ r: 1, h: 0.42, kind });
    b.scale.setScalar(r);
    b.position.set(p.x, meshY(p.x, p.z) + 0.02, p.z);
    room.add(b);
    bowls.push(b);
  }
  // sanctuary domes in the Sierra foothills: green glass over little forests
  const domes = [];
  for (const [lo, la, r] of [[-119.9, 37.45, 3.6], [-118.95, 36.3, 3.2], [-120.85, 38.75, 2.8]]) {
    const p = ll(lo, la);
    const g = new THREE.Group();
    const R2 = rng(Math.round(lo * 100));
    for (let k = 0; k < 9; k++) {
      const a = R2() * Math.PI * 2, rr = Math.sqrt(R2()) * r * 0.7;
      const t = shrub({ r: 0.5 + R2() * 0.35, stem: 0.35, seed: k, dark: k % 2 === 0 });
      t.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      g.add(t);
    }
    const glass = glossy(tone(C.green, 1, 0.55), { roughness: 0.08, transparent: true, opacity: 0.28, reflect: 0.9, depthWrite: false });
    const dome = mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, { cast: false, receive: false });
    dome.renderOrder = 4;
    g.add(dome);
    g.add(mesh(new THREE.TorusGeometry(r, 0.09, 8, 64), clay(tone(C.green, 0.7), 0.6), { rot: [Math.PI / 2, 0, 0], cast: false }));
    g.position.set(p.x, meshY(p.x, p.z) + 0.05, p.z);
    room.add(g);
    domes.push(g);
  }

  // Mount Shasta is a cat tree; a ball of yarn has rolled into the Pacific
  {
    const p = ll(-122.2, 41.38);
    const tree = catTree({ h: 7 });
    tree.position.set(p.x, meshY(p.x, p.z), p.z);
    room.add(tree);
    var shastaTop = tree.position.clone().add(new THREE.Vector3(0, 7.32, 0));
    const y = yarnBall({ r: 2.2, color: S.terra, seed: 4 });
    const q = ll(-124.9, 37.2);
    y.position.set(q.x, 1.6, q.z);
    y.rotation.y = 2.2;
    room.add(y);
  }

  // giant cats at living-room scale
  const giants = [];
  const giant = (pose, coat, seed, pos, yaw, scale, look = [0, 0, 0]) => {
    const c = makeCat({ pose, coat, seed, lod: 'hi' });
    c.group.position.copy(pos);
    c.group.rotation.y = yaw;
    c.group.scale.setScalar(scale);
    c.look(...look);
    room.add(c.group);
    giants.push(c);
    return c;
  };
  const cush = (i) => cushions[i].position.clone().setY(1.55);
  const ground = (lo, la, dx = 0, dz = 0) => { const p = ll(lo, la).add(new THREE.Vector3(dx, 0, dz)); return p.setY(meshY(p.x, p.z) + 0.02); };
  giant('sprawl', 'ginger', 3, cush(3), -0.6, 7.5);
  giant('loaf', 'cream', 4, cush(6), 1.2, 6.8, [0.5, 0, 0]);
  giant('sit', 'ginger', 5, ground(-118.12, 34.08, 5.6, 2.4), 0.2, 8.5, [0.75, 0.2, 0]);
  {
    const st = shelfTop[2];
    giant('loaf', 'ginger2', 6, new THREE.Vector3(st.g.position.x, st.top, st.g.position.z), 0.6, 4.8);
  }
  giant('curl', 'cream', 7, ground(-116.53, 33.82), 0.6, 6.0);
  giant('sit', 'cream', 9, shastaTop, 0.5, 4.0, [0.4, 0.1, 0]);
  giant('sprawl', 'cream', 8, ground(-120.05, 36.95), 2.0, 7.0);

  // ---------- beat 3: tiny terracotta cats appear by doors in every city, then all turn their heads at once
  const doorCats = new THREE.Group();
  scene.add(doorCats);
  const parts = catParts('sit', 'lo');
  const DR = rng(12);
  const sac = ll(-121.49, 38.58);
  // one cat per ~25 km of city, at the centre of the city blocks in that cell
  const cells = new Map();
  for (const [x, y] of cats.blocks) {
    const k = `${Math.floor(x / 34000)},${Math.floor(y / 34000)}`;
    const c = cells.get(k) || { x: 0, y: 0, n: 0 };
    c.x += x; c.y += y; c.n++;
    cells.set(k, c);
  }
  const spots = [...cells.values()].filter((c) => c.n >= 2).map((c) => {
    const p = toW(c.x / c.n, c.y / c.n);
    p.y = meshY(p.x, p.z) + 0.01;
    return { p, yaw: (DR() - 0.5) * 1.0, look: (DR() - 0.5) * 1.8, delay: 0.3 + 1.4 * Math.min(1, p.distanceTo(sac) / 95) + DR() * 0.2, s: 4.6 + DR() * 0.6 };
  });
  const coat = coatMaterial('ginger');
  const bodies = new THREE.InstancedMesh(parts.body, coat, spots.length), heads = new THREE.InstancedMesh(parts.head, coat, spots.length);
  bodies.castShadow = heads.castShadow = true;
  doorCats.add(bodies, heads);
  const mB = new THREE.Matrix4(), mH = new THREE.Matrix4(), mR = new THREE.Matrix4(), qq = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3();
  function updateDoorCats(f, camPos) {
    const t = (f - 300) / FPS;
    const snap = ease.outCubic(prog(t, 2.3, 2.43)); // the one deliberate snap
    spots.forEach((c, i) => {
      const perk = 1 + 0.12 * Math.sin(Math.PI * prog(t, 2.3, 2.6));
      const k = spring(t - c.delay, 0.5) * c.s * perk;
      qq.setFromEuler(new THREE.Euler(0, c.yaw, 0));
      mB.compose(c.p, qq, vS.setScalar(Math.max(1e-4, k)));
      bodies.setMatrixAt(i, mB);
      // head: idle glance, then everyone looks up at the camera
      const toCam = Math.atan2(camPos.x - c.p.x, camPos.z - c.p.z) - c.yaw;
      const yaw = c.look * (1 - snap) + Math.atan2(Math.sin(toCam), Math.cos(toCam)) * snap;
      mR.makeRotationFromEuler(new THREE.Euler(parts.headRot.x - 0.75 * snap, yaw, 0, 'YXZ'));
      mH.makeTranslation(parts.headPos.x, parts.headPos.y, parts.headPos.z).multiply(mR).multiply(new THREE.Matrix4().makeScale(parts.headScale, parts.headScale, parts.headScale));
      heads.setMatrixAt(i, mB.clone().multiply(mH));
    });
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  }

  // ---------- labels (the brief's places only)
  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  const PLACES = [['sac', 'Sacramento', -121.49, 38.58], ['sf', 'San Francisco', -122.42, 37.77], ['la', 'Los Angeles', -118.24, 34.05], ['ps', 'Palm Springs', -116.55, 33.83]];
  for (const [id, text, lo, la] of PLACES) labels.add(id, { text, pos: ll(lo, la, 0.05), dot: true, size: 30, priority: 2 });
  labels.add('cv', { text: 'Central Valley', pos: ll(-119.9, 36.9, 0.3), italic: true, size: 28, priority: 1 });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.5, 1200);
  // Beat 13 (1500-1620): crane up from Southern California and pull back to the whole state, tilted (35 -> 24 mm)
  const A13 = { pos: ll(-116.2, 32.6).add(new THREE.Vector3(18, 26, 22)), target: ll(-118.0, 34.3), lens: 35 };
  const B13 = { pos: new THREE.Vector3(27, 92, 89), target: new THREE.Vector3(0, 0, 10), lens: 24 };

  // Beat 3 (300-420): the flat takeover map, seen from straight above, slow push-in
  const A3 = { pos: new THREE.Vector3(2, 196, 78), target: new THREE.Vector3(2, 0, 5), lens: 35 };
  const B3 = { pos: new THREE.Vector3(1, 172, 69), target: new THREE.Vector3(1, 0, 6), lens: 35 };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = f / FPS;
      const finale = f >= 1460;
      const dbg = new URLSearchParams(location.search).get('debug');
      const s = dbg === 'top' ? { pos: new THREE.Vector3(0, 230, 0.01), target: new THREE.Vector3(0, 0, 0), lens: 35 }
        : finale ? move(f, 1515, 1590, A13, B13, { fn: ease.inOutCubic, via: new THREE.Vector3(30, 52, 80) }) : beatMove(f, [300, 420], A3, B3);
      applyCam(cam, s);
      room.visible = network.visible = pawInst.visible = finale;
      doorCats.visible = !finale;
      if (!finale) updateDoorCats(f, cam.position);
      U.uWinK.value = finale ? 1 : 0;
      U.uEstK.value = finale ? 1 : 0;
      giants.forEach((c, i) => c.update(t + i * 2.1));
      lineMats.forEach((m) => updateRibbon(m, cam, t));
      labels.update(cam, { sac: 1, sf: 1, la: 1, ps: 1, cv: 0.9 }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.22, exposure: 1.0, vignette: 0.24 };
    },
  };
}
