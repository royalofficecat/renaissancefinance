// Beat 4: the front door. A person opens it; the cat sits on the threshold looking out, and does not move.
// The person waits, holding the door. Deliveries of pet supplies are stacked on the porch ($158 billion a year).
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { cardboardBox, mesh, plant, rbox, shrub } from '../lib/props.js';
import { basePlate, tileRoof } from '../lib/town.js';
import { beatMove } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { ease, prog, rng } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [420, 540];
const FLOOR = 0.32; // porch level

/** A closed shipping box with a strip of paw-print tape. */
function parcel(w, h, d, seed) {
  const g = new THREE.Group(), R = rng(seed);
  const card = clay(mixc(tone(C.cream, 0.7 + R() * 0.08), C.terra, 0.12), 0.85);
  g.add(mesh(rbox(w, h, d, 0.015), card, { pos: [0, h / 2, 0] }));
  g.add(mesh(new THREE.BoxGeometry(w + 0.004, 0.004, 0.07), clay(S.terra, 0.6), { pos: [0, h + 0.001, 0], cast: false }));
  g.add(mesh(new THREE.BoxGeometry(0.07, h * 0.5, 0.004), clay(S.terra, 0.6), { pos: [0, h * 0.75, d / 2 + 0.002], cast: false }));
  return g;
}

export async function createPorch(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.35, horizon: tone(C.blue, 1, 0.32), top: tone(C.blue, 0.92) });
  const R = rng(4);
  const plateG = basePlate({ w: 9, d: 7 });
  plateG.position.set(0, 0, 1.0);
  scene.add(plateG);
  // lawn either side of a paved path
  for (const s of [-1, 1]) scene.add(mesh(rbox(3.4, 0.04, 3.2, 0.02), clay(S.green, 0.85), { pos: [s * 2.55, 0.02, 3.0], cast: false }));
  for (let i = 0; i < 4; i++) scene.add(mesh(rbox(0.9, 0.04, 0.5, 0.03), clay(tone(C.cream, 0.78), 0.8), { pos: [(R() - 0.5) * 0.1, 0.02, 2.55 + i * 0.62], cast: false }));

  // ---------- the house front: porch slab, steps, wall with a doorway, roof eave
  const wall = clay(tone(C.cream, 0.97), 0.85), trim = clay(tone(C.cream, 1, 0.3), 0.6);
  scene.add(mesh(rbox(5.4, FLOOR, 2.0, 0.03), clay(tone(C.cream, 0.84), 0.8), { pos: [0, FLOOR / 2, 0.85] }));
  for (const [z, y] of [[2.0, 0.21], [2.3, 0.105]]) scene.add(mesh(rbox(1.6, y, 0.34, 0.02), clay(tone(C.cream, 0.86), 0.8), { pos: [0, y / 2, z] }));
  const doorW = 1.05, doorH = 2.15, wallH = 3.3;
  const wz = -0.12;
  const wallPart = (x0, x1, y0, y1) => scene.add(mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.24), wall, { pos: [(x0 + x1) / 2, (y0 + y1) / 2, wz] }));
  wallPart(-2.8, -doorW / 2, 0, wallH);
  wallPart(doorW / 2, 2.8, 0, wallH);
  wallPart(-doorW / 2, doorW / 2, FLOOR + doorH, wallH);
  // door frame and the door itself (hinged on the right, opens inwards)
  scene.add(mesh(rbox(doorW + 0.24, 0.14, 0.32, 0.03), trim, { pos: [0, FLOOR + doorH + 0.07, wz + 0.02] }));
  for (const s of [-1, 1]) scene.add(mesh(rbox(0.12, doorH, 0.3, 0.03), trim, { pos: [s * (doorW / 2 + 0.06), FLOOR + doorH / 2, wz + 0.02] }));
  const hinge = new THREE.Group();
  hinge.position.set(doorW / 2, FLOOR, wz - 0.06);
  const door = new THREE.Group();
  door.add(mesh(rbox(doorW, doorH, 0.07, 0.02), clay(S.woodDark, 0.6), { pos: [-doorW / 2, doorH / 2, 0] }));
  for (const y of [0.55, 1.45]) door.add(mesh(rbox(doorW * 0.7, 0.62, 0.02, 0.01), clay(tone(S.woodDark, 1.18), 0.6), { pos: [-doorW / 2, y, 0.04], cast: false }));
  door.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), clay(tone(C.cream, 1, 0.1), 0.4), { pos: [-doorW + 0.12, 1.0, 0.07] }));
  hinge.add(door);
  scene.add(hinge);
  // the hall inside: warm and a little darker
  scene.add(mesh(new THREE.BoxGeometry(3.0, 0.04, 2.6), clay(S.wood, 0.6), { pos: [0, FLOOR - 0.02, -1.45], cast: false }));
  scene.add(mesh(new THREE.BoxGeometry(3.0, wallH, 0.2), clay(tone(C.cream, 0.82), 0.85), { pos: [0, wallH / 2, -2.75] }));
  for (const s of [-1, 1]) scene.add(mesh(new THREE.BoxGeometry(0.2, wallH, 2.6), clay(tone(C.cream, 0.82), 0.85), { pos: [s * 1.5, wallH / 2, -1.45] }));
  scene.add(mesh(new THREE.BoxGeometry(3.2, 0.2, 2.8), clay(tone(C.cream, 0.82), 0.85), { pos: [0, wallH + 0.1, -1.45] }));
  const hallLamp = new THREE.PointLight(tone(C.lamp, 1.0), 2.2, 5, 1.6);
  hallLamp.position.set(0.3, 2.6, -1.6);
  scene.add(hallLamp);
  // roof eave with terracotta tiles, windows with terracotta shutters, a porch lamp
  const eave = mesh(rbox(6.2, 0.5, 1.8, 0.06), tileRoof(S.terra), { pos: [0, wallH + 0.12, 0.45], rot: [0.32, 0, 0] });
  scene.add(eave);
  for (const s of [-1, 1]) {
    const x = s * 1.85;
    scene.add(mesh(rbox(0.95, 1.15, 0.06, 0.02), trim, { pos: [x, 1.75, wz + 0.13] }));
    scene.add(mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({ color: tone(C.blue, 0.42), roughness: 0.15 }), { pos: [x, 1.75, wz + 0.165], cast: false }));
    for (const k of [-1, 1]) scene.add(mesh(rbox(0.32, 1.15, 0.05, 0.02), clay(S.terra, 0.7), { pos: [x + k * 0.66, 1.75, wz + 0.15] }));
    scene.add(mesh(rbox(1.0, 0.18, 0.26, 0.03), clay(S.terraDark, 0.8), { pos: [x, 1.12, wz + 0.25] }));
    for (let i = 0; i < 4; i++) scene.add(mesh(new THREE.SphereGeometry(0.11, 12, 8), clay(i % 2 ? S.green : S.greenDark, 0.8), { pos: [x - 0.36 + i * 0.24, 1.26, wz + 0.27] }));
  }
  scene.add(mesh(rbox(0.16, 0.3, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: tone(C.gold, 1, 0.3), emissive: tone(C.gold, 0.7), emissiveIntensity: 0.6, roughness: 0.4 }), { pos: [-0.9, 2.05, wz + 0.2] }));
  // doormat with a paw on it, potted plants
  scene.add(mesh(rbox(0.9, 0.025, 0.55, 0.02), clay(S.terraDark, 0.95), { pos: [0, FLOOR + 0.012, 0.42], cast: false }));
  for (const [x, z, h, sd] of [[-1.35, 0.55, 0.9, 3], [1.4, 1.5, 0.7, 5]]) { const p = plant({ h, seed: sd }); p.scale.setScalar(0.85); p.position.set(x, FLOOR, z); scene.add(p); }
  for (const [x, z] of [[-3.6, 1.0], [3.7, 0.6], [-3.2, -0.2]]) { const sh = shrub({ r: 0.5, stem: 0.1, seed: x * 10 }); sh.position.set(x, 0, z); scene.add(sh); }

  // ---------- deliveries: a teetering stack of pet supplies on the porch
  const stack = new THREE.Group();
  let y = FLOOR;
  for (let i = 0; i < 6; i++) {
    const w = 0.75 - i * 0.05 + R() * 0.05, h = 0.32 + R() * 0.12, d = 0.55 - i * 0.03;
    const p = parcel(w, h, d, 10 + i);
    p.position.set((R() - 0.5) * 0.08, y, (R() - 0.5) * 0.06);
    p.rotation.y = (R() - 0.5) * 0.3;
    stack.add(p);
    y += h;
  }
  stack.position.set(1.22, 0, 0.62);
  scene.add(stack);
  const bag = new THREE.Group();
  bag.add(mesh(rbox(0.5, 0.7, 0.24, 0.1), clay(tone(C.cream, 1, 0.2), 0.8), { pos: [0, 0.35, 0] }));
  bag.add(mesh(new THREE.CircleGeometry(0.13, 24), clay(S.terra, 0.7), { pos: [0, 0.42, 0.123], cast: false }));
  bag.position.set(1.95, FLOOR, 1.05); bag.rotation.y = -0.5;
  scene.add(bag);
  const open = cardboardBox({ w: 0.55, h: 0.32, d: 0.45 });
  open.position.set(-1.9, FLOOR, 1.15); open.rotation.y = 0.3;
  scene.add(open);

  // ---------- the cat on the threshold, the person holding the door
  const cat = makeCat({ pose: 'sit', coat: 'ginger', seed: 41 });
  cat.group.scale.setScalar(0.55);
  cat.group.position.set(-0.08, FLOOR, 0.0);
  scene.add(cat.group);
  const person = makeHuman({ pose: 'stand', seed: 42, scale: 1.72, shirt: 1, skin: 2, hair: 2, cut: 2 });
  person.group.position.set(0.32, FLOOR, -0.62);
  scene.add(person.group);

  const lights = rig(scene, pipe.renderer, { size: 6, dist: 40, intensity: 5.8, fillK: 0.22, rimK: 0.3, keyDir: [-0.55, 0.5, 0.67] });
  lights.follow(new THREE.Vector3(0, 1.2, 0.5), 6);

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [1.3, 1.55, 8.6], target: [0.5, 1.3, 0.3], lens: 50 };
  const B = { pos: [0.85, 1.35, 6.8], target: [0.38, 1.08, 0.3], lens: 50 };
  return {
    frame(f) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B));
      // the door swings open; the cat looks out at the world, then back up at the person, then out again
      const open = ease.inOutCubic(prog(t, 0.45, 1.25));
      hinge.rotation.y = -1.75 * open;
      const back = Math.sin(Math.PI * prog(t, 2.2, 3.4));
      cat.look(0.9 * back + 0.08 * Math.sin(t * 0.9), -0.05 - 0.3 * back, 0.05);
      cat.update(t + 4);
      person.state.nod = 0.15 * back;
      person.update(t);
      return { scene, camera: cam, bloom: 0.22, exposure: 1.0, vignette: 0.22 };
    },
  };
}
