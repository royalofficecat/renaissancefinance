// Beat 5 (canyons become funnels): a cut-away block of sandstone plateau. Rain falls across the whole
// top; shallow side channels light up one after another and all run into a single slot canyon that
// deepens and narrows towards the front, where the gathered water bursts out of the cut face.
// The cut faces show the rock layers; the slot's notch is visible in the front face.
import * as THREE from 'three';
import { C, HEX, S, backdrop, clay, rig, tone } from '../look.js';
import { applyCam, orbit } from '../../../src/core/camera.js';
import { ease, prog, rng, smoothstep } from '../../../src/core/util.js';
import { Labels } from '../../../src/core/labels.js';
import { cloudBank, flowSheet, rainField, sandstone, splashRings } from '../lib/rock.js';

const FPS = 30;
const B0 = 540;
const HALF = 5, TOP = 2.6, BOT = -0.7;
const sx = (z) => 0.6 * Math.sin(z * 0.5 + 0.4) + 0.25 * Math.sin(z * 1.3);
const depthAt = (z) => 0.35 + 2.1 * smoothstep(-4.5, 4.6, z);
const halfW = (z) => 0.42 - 0.2 * smoothstep(-4, 4, z);

// side channels: each starts on the plateau and curves into the slot at a junction
function tributaries(R) {
  const list = [];
  const starts = [[-4.6, -4.4], [4.4, -4.6], [-4.7, -1.4], [4.6, -1.8], [-4.6, 1.6], [4.7, 1.2], [-2.0, -4.8], [2.2, -4.7], [-4.2, 3.8], [4.2, 3.6]];
  starts.forEach(([x0, z0], i) => {
    const zj = Math.max(-4.2, Math.min(3.6, z0 + 1.6 + R() * 1.4));
    const xj = sx(zj);
    const pts = [];
    const bendK = (R() - 0.5) * 1.6;
    for (let k = 0; k <= 40; k++) {
      const u = k / 40;
      const x = x0 + (xj - x0) * u + bendK * Math.sin(u * Math.PI) * 0.6;
      const z = z0 + (zj - z0) * (u * u * 0.4 + u * 0.6) + 0.25 * Math.sin(u * 5 + i);
      pts.push([x, z]);
    }
    list.push({ pts, d: 0.08 + i * 0.09 + R() * 0.12 });
  });
  return list;
}

function segDist(px, pz, pts) {
  let best = 1e9, bu = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
    const d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
    if (d < best) { best = d; bu = (i + t) / (pts.length - 1); }
  }
  return [best, bu];
}

export async function createBlock(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene);
  scene.fog = new THREE.Fog(tone(C.storm, 1.5), 30, 70);
  const R = rng(9);
  const tribs = tributaries(R);

  function height(x, z) {
    let h = TOP + 0.08 * Math.sin(x * 0.9 + z * 0.4) + 0.06 * Math.sin(z * 1.7 - x);
    for (const tr of tribs) {
      const [d, u] = segDist(x, z, tr.pts);
      const dep = 0.12 + 0.25 * u;
      h -= dep * (1 - smoothstep(0.08, 0.32 + 0.1 * u, d));
    }
    const dz = Math.abs(x - sx(z));
    const w = halfW(z);
    h -= depthAt(z) * (1 - smoothstep(w * 0.55, w * 1.35, dz));
    h -= 0.25 * (1 - smoothstep(w, w * 3.2, dz));
    return h;
  }

  // ---------- top surface
  const N = 260;
  const geo = new THREE.PlaneGeometry(2 * HALF, 2 * HALF, N, N);
  geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, height(P.getX(i), P.getZ(i)));
  geo.computeVertexNormals();
  const rock = sandstone({ capFrom: 2.32, capTo: 2.55, bands: 9, sandBelow: 0.9 });
  const top = new THREE.Mesh(geo, rock);
  top.castShadow = top.receiveShadow = true;
  scene.add(top);

  // ---------- cut faces (the cross-section), following the top's edge profile
  const faceMat = sandstone({ capFrom: 2.32, capTo: 2.55, bands: 9 });
  const SEG = 260;
  for (const [ax, az, bx, bz] of [[-HALF, HALF, HALF, HALF], [HALF, HALF, HALF, -HALF], [HALF, -HALF, -HALF, -HALF], [-HALF, -HALF, -HALF, HALF]]) {
    const pos = [], idx = [];
    for (let k = 0; k <= SEG; k++) {
      const u = k / SEG, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
      pos.push(x, height(x, z), z, x, BOT, z);
      if (k < SEG) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, faceMat);
    m.material.side = THREE.DoubleSide;
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF + 0.5, 0.25, 2 * HALF + 2.6), clay(tone(C.storm, 0.8), 0.9));
  plinth.position.set(0, BOT - 0.125, 1.05);
  plinth.receiveShadow = true;
  scene.add(plinth);

  // ---------- water: flowing strips down every side channel, then the slot, then out of the front face
  const strip = (pts3, hw) => {
    const pos = [], uv = [], idx = [];
    let L = 0;
    const lens = [0];
    for (let i = 1; i < pts3.length; i++) { L += pts3[i].distanceTo(pts3[i - 1]); lens.push(L); }
    for (let i = 0; i < pts3.length; i++) {
      const a = pts3[Math.max(0, i - 1)], b = pts3[Math.min(pts3.length - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl, nz = tx / tl;
      const w = typeof hw === 'function' ? hw(i / (pts3.length - 1)) : hw;
      const p = pts3[i];
      pos.push(p.x + nx * w, p.y, p.z + nz * w, p.x - nx * w, p.y, p.z - nz * w);
      uv.push(0, lens[i] / L, 1, lens[i] / L);
      if (i < pts3.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const flows = [];
  for (const tr of tribs) {
    const pts3 = tr.pts.map(([x, z]) => new THREE.Vector3(x, height(x, z) + 0.035, z));
    const m = flowSheet({ color: tone(C.water, 1.05), speed: 1.6, streakScale: [3, 14], opacity: 1, reflect: 0.5 });
    const mesh = new THREE.Mesh(strip(pts3, (u) => 0.07 + 0.09 * u), m);
    mesh.renderOrder = 2;
    scene.add(mesh);
    flows.push({ m, a: tr.d, b: tr.d + 1.3 });
  }
  // the slot: water rises inside it as the side channels arrive
  const slotPts = [];
  for (let k = 0; k <= 120; k++) { const z = -4.6 + (HALF + 0.02 + 4.6) * (k / 120); slotPts.push(z); }
  const slotGeo = (level) => strip(slotPts.map((z) => new THREE.Vector3(sx(z), TOP - depthAt(z) + 0.02 + level * depthAt(z) * 0.5, z)), (u) => halfW(-4.6 + 9.6 * u) * (0.45 + 0.5 * level));
  const slotMat = flowSheet({ speed: 3.0, streakScale: [3, 22], opacity: 0.97, reflect: 0.4 });
  const slot = new THREE.Mesh(slotGeo(0.2), slotMat);
  slot.renderOrder = 2;
  scene.add(slot);
  // the burst out of the front face, falling to the plinth
  const yExit = TOP - depthAt(HALF);
  const gushPts = [];
  for (let k = 0; k <= 30; k++) {
    const u = k / 30;
    gushPts.push(new THREE.Vector3(sx(HALF), yExit + 0.1 - (yExit + 0.1 - BOT) * u * u, HALF + 0.05 + 0.9 * u));
  }
  const gushMat = flowSheet({ speed: 3.6, streakScale: [3, 8], opacity: 0.95 });
  const gushG = new THREE.Group();
  const gush = new THREE.Mesh(strip(gushPts, (u) => 0.16 + 0.22 * u), gushMat);
  gush.renderOrder = 3;
  gushG.add(gush);
  scene.add(gushG);
  const spread = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), flowSheet({ speed: 0.6, streakScale: [8, 8], opacity: 0.85 }));
  spread.position.set(sx(HALF), BOT + 0.01, HALF + 1.05);
  spread.renderOrder = 2;
  scene.add(spread);

  const rain = rainField(scene, R, { n: 2600, w: 12, h: 7, d: 12, len: 0.32, opacity: 0.3 });
  const rings = splashRings(scene, R, 70, () => { const x = (R() - 0.5) * 9, z = (R() - 0.5) * 9; return [x, height(x, z) + 0.01, z]; }, { r0: 0.03, r1: 0.05 });
  const clouds = cloudBank(R, { count: 22, spread: [26, 1.5, 20], at: [0, 16, -6], size: [1.8, 3.4] });
  scene.add(clouds);

  const lights = rig(scene, pipe.renderer, { size: 9, dist: 30, intensity: 2.6, keyDir: [-0.6, 0.66, 0.45], rimDir: [0.5, 0.4, -0.8] });
  lights.follow(new THREE.Vector3(0, 1, 0), 9);

  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  labels.add('slot', { text: 'Slot canyon', pos: new THREE.Vector3(sx(3.2) + 0.7, TOP + 0.35, 3.2), size: 30, priority: 3 });
  labels.add('plateau', { text: 'Rain on the plateau', pos: new THREE.Vector3(-2.6, TOP + 0.5, -3.0), italic: true, size: 28, priority: 2 });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.05, 300);
  const ORB = { center: [0, 0.6, 0.6], a0: 0.62, a1: -0.18, r0: 21, r1: 19.5, h0: 13.5, h1: 11.5, lens0: 35, target: [0, 0.4, 0.9] };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = f / FPS, bt = (f - B0) / FPS;
      applyCam(cam, orbit(f, B0 + 12, B0 + 110, ORB));
      rock.userData.U.uWet.value = faceMat.userData.U.uWet.value = 0.4 + 0.6 * prog(bt, 0, 2);
      for (const fl of flows) { fl.m.userData.U.uProgress.value = ease.inOutSine(prog(bt, fl.a, fl.b)) * 1.05; fl.m.userData.U.uT.value = t; }
      const lvl = ease.inOutSine(prog(bt, 1.2, 3.4));
      slot.geometry.dispose();
      slot.geometry = slotGeo(0.15 + 0.85 * lvl);
      slotMat.userData.U.uProgress.value = ease.inOutSine(prog(bt, 0.9, 2.4)) * 1.05;
      slotMat.userData.U.uT.value = t;
      slotMat.userData.U.uSpeed.value = 2.0 + 2.5 * lvl;
      gushMat.userData.U.uProgress.value = prog(bt, 2.3, 2.8) * 1.05;
      gushMat.userData.U.uT.value = t;
      gushG.visible = bt > 2.25;
      const sp = ease.outCubic(prog(bt, 2.6, 3.8));
      spread.scale.set(0.05 + 1.3 * sp, 1, 0.05 + 0.5 * sp);
      spread.visible = sp > 0;
      spread.material.userData.U.uT.value = t;
      rain.update(t, 1, { x: 0, z: 0 }, 0);
      rings(t, 1);
      clouds.position.x = t * 0.12;
      const w = (a, b) => smoothstep(a, a + 12, f) * (1 - smoothstep(b - 12, b, f));
      labels.update(cam, { plateau: 0.95 * w(B0 + 14, B0 + 64), slot: 0.95 * w(B0 + 58, B0 + 118) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.25, exposure: 1.0, vignette: 0.3 };
    },
  };
}
