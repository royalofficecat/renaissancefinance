// Beat 10: Orange County. Immaculate lounging suburbs and grooming districts (cats groom 30-50% of their day).
// Territory borders spread along the property lines as trails of paw prints; two cats hold a staring
// contest across a fence; a person happily carries a food bowl down the quiet, shady street.
import * as THREE from 'three';
import { C, S, backdrop, clay, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { mesh, rbox, shrub, palmTree } from '../lib/props.js';
import { basePlate, fence, house, pool, street } from '../lib/town.js';
import { beatMove, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng, spring } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [1140, 1260];

/** A single paw print (pad + four toes), flat, for trails. */
function pawGeometry() {
  const parts = [];
  const disc = (x, z, rx, rz) => { const g = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2); g.scale(rx, 1, rz); g.translate(x, 0, z); parts.push(g); };
  disc(0, 0.08, 0.34, 0.28);
  for (const [x, z] of [[-0.32, -0.2], [-0.12, -0.38], [0.12, -0.38], [0.32, -0.2]]) disc(x, z, 0.11, 0.14);
  const pos = [], idx = [];
  for (const g of parts) {
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array);
    idx.push(...Array.from(g.index.array, (i) => i + base));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export async function createOC(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.35, horizon: tone(C.blue, 1, 0.32), top: tone(C.blue, 0.92) });
  const R = rng(10);
  scene.add(basePlate({ w: 16, d: 15 }));
  // the street along x and two short cross streets
  scene.add(street(16, 1.5));
  for (const x of [-6.3, 6.3]) { const s2 = street(15, 1.2); s2.rotation.y = Math.PI / 2; s2.position.set(x, 0.001, 0); scene.add(s2); }
  // sidewalks
  for (const z of [-1.0, 1.0]) scene.add(mesh(new THREE.BoxGeometry(16, 0.03, 0.4), clay(tone(C.cream, 1, 0.1), 0.8), { pos: [0, 0.015, z], cast: false }));

  // ---------- six lots: lawn, house (hip or gable roof), pool, fences along the lot lines
  const lots = [];
  const lawnMat = clay(S.green, 0.85), lawnMat2 = clay(tone(C.green, 1.05, 0.08), 0.85);
  for (const side of [-1, 1]) for (const [i, x] of [[0, -3.6], [1, 0], [2, 3.6]].map(([a, b]) => [a, b])) {
    const zc = side * 3.9;
    scene.add(mesh(new THREE.BoxGeometry(3.4, 0.04, 5.2), (i + side) % 2 ? lawnMat : lawnMat2, { pos: [x, 0.02, zc], cast: false }));
    const h = house({ w: 2.0, d: 1.6, h: 0.95, roofType: (i + (side > 0 ? 1 : 0)) % 2 ? 'hip' : 'gable', seed: i * 3 + side, roof: S.terra });
    h.position.set(x, 0.04, side * 2.6);
    h.rotation.y = side > 0 ? Math.PI : 0; // face the street
    scene.add(h);
    const p = pool({ w: 1.5, d: 0.9 });
    p.position.set(x + (i % 2 ? 0.6 : -0.6), 0.04, side * 5.2);
    scene.add(p);
    const t = shrub({ r: 0.42, stem: 0.5, seed: i * 7 + side * 3, dark: i % 2 === 0 });
    t.position.set(x - 1.1, 0.04, side * 1.65);
    scene.add(t);
    lots.push({ x, zc, side, i });
  }
  // fences along the lot lines (between neighbours and along the back)
  const fences = [];
  for (const side of [-1, 1]) {
    for (const x of [-1.8, 1.8]) { const f = fence(3.6); f.rotation.y = Math.PI / 2; f.position.set(x, 0.04, side * 4.6); scene.add(f); fences.push(f); }
    const back = fence(10.6); back.position.set(0, 0.04, side * 6.45); scene.add(back);
  }
  // palms along the street
  for (const [x, z] of [[-7.3, 1.4], [7.3, -1.4], [-7.3, -5.5]]) { const pt = palmTree({ h: 3.6, seed: Math.round(x * 10 + z) }); pt.scale.setScalar(0.75); pt.position.set(x, 0, z); scene.add(pt); }

  // ---------- territory trails: paw prints walking along the lot lines, appearing step by step
  const trails = [
    [[-5.4, 1.55], [-2.05, 1.55], [-2.05, 6.2]], [[2.05, 6.2], [2.05, 4.3], [1.55, 4.3]],
    [[-5.4, -1.55], [-2.05, -1.55], [-2.05, -6.2]], [[2.05, -6.2], [2.05, -1.55], [5.4, -1.55]],
  ];
  const prints = [];
  trails.forEach((pts, ti) => {
    let side = 1, n = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector2(...pts[i]), b = new THREE.Vector2(...pts[i + 1]);
      const L = a.distanceTo(b), dir = b.clone().sub(a).normalize();
      for (let d = 0.15; d < L; d += 0.32) {
        const p = a.clone().addScaledVector(dir, d);
        prints.push({ x: p.x - dir.y * side * 0.12, z: p.y + dir.x * side * 0.12, yaw: Math.atan2(dir.x, dir.y) + Math.PI, delay: 0.6 + n * 0.045 + ti * 0.08 });
        side = -side; n++;
      }
    }
  });
  const pawInst = new THREE.InstancedMesh(pawGeometry(), new THREE.MeshStandardMaterial({ color: tone(C.terra, 0.95), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), prints.length);
  pawInst.receiveShadow = true;
  scene.add(pawInst);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();

  // ---------- cats: the staring contest across the fence, groomers on the lawns, loungers by the pools
  const cats = [];
  const addCat = (pose, coat, pos, yaw, scale = 0.62, seed = 130 + cats.length) => {
    const c = makeCat({ pose, coat, seed, lod: 'lo' });
    c.group.position.set(pos[0], 0.04, pos[1]); c.group.rotation.y = yaw; c.group.scale.setScalar(scale);
    scene.add(c.group); cats.push(c); return c;
  };
  const starerA = addCat('sit', 'ginger', [1.35, 3.6], Math.PI / 2, 0.72);
  const starerB = addCat('sit', 'cream', [2.25, 3.6], -Math.PI / 2, 0.72);
  const groomers = [addCat('sit', 'ginger2', [-3.2, 4.2], 0.5), addCat('sit', 'cream', [3.9, -4.0], -2.4), addCat('sit', 'ginger', [-0.5, -4.6], 2.8)];
  addCat('sprawl', 'ginger', [-3.0, 5.6], 1.2, 0.6);
  addCat('loaf', 'cream', [0.6, -5.6], 0.4, 0.6);
  addCat('curl', 'ginger2', [4.3, 5.5], 0.0, 0.6);
  // the person with the food bowl, walking along the sidewalk
  const walker = makeHuman({ pose: 'carry', seed: 140, scale: 1.6, shirt: 1, skin: 1, hair: 3, cut: 2 });
  walker.group.rotation.y = Math.PI / 2;
  scene.add(walker.group);
  const follower = addCat('stand', 'ginger', [0, 0], Math.PI / 2, 0.6);

  const labels = placeLabels([{ id: 'oc', text: 'Orange County', pos: [-4.6, 1.2, -2.6] }]);
  await labels.sync();
  const lights = rig(scene, pipe.renderer, { size: 10, dist: 50, intensity: 5.8, fillK: 0.22, rimK: 0.3 });
  lights.follow(new THREE.Vector3(0, 0, 0), 10);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [3.2, 7.5, 14.0], target: [0.6, 0, 1.2], lens: 35 };
  const B = { pos: [1.6, 14.2, 5.6], target: [1.2, 0, 1.6], lens: 35 };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B));
      prints.forEach((p, i) => {
        const k = spring(t - p.delay, 0.35) * 0.3;
        q4.setFromEuler(new THREE.Euler(0, p.yaw, 0));
        m4.compose(v4.set(p.x, 0.05, p.z), q4, s4.set(Math.max(1e-4, k), 1, Math.max(1e-4, k)));
        pawInst.setMatrixAt(i, m4);
      });
      pawInst.instanceMatrix.needsUpdate = true;
      // the staring contest: perfectly still, unblinking, then a tiny simultaneous ear-flat lean
      starerA.state.breathe = starerB.state.breathe = 0.3;
      starerA.look(0, 0.05, 0); starerB.look(0, 0.05, 0);
      starerA.state.open = starerB.state.open = 1;
      // groomers: head turned to the flank, bobbing as they lick
      groomers.forEach((c, i) => c.look(1.25 * (i % 2 ? -1 : 1), 0.55 + 0.08 * Math.sin(t * 9 + i), 0.3));
      cats.forEach((c, i) => { if (c !== starerA && c !== starerB) c.update(t + i); });
      starerA.update(0.3); starerB.update(0.6); // no blinking in a staring contest
      const wx = -6.5 + 3.4 * ease.inOutSine(prog(t, 0, 4));
      walker.group.position.set(wx, 0.03, -1.0);
      walker.group.rotation.z = Math.sin(t * 8) * 0.02;
      walker.update(t);
      follower.group.position.set(wx - 0.75, 0.03, -1.0);
      follower.update(t);
      labels.update(cam, { oc: clamp((t - 0.8) / 0.5) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.22, exposure: 1.0, vignette: 0.24 };
    },
  };
}
