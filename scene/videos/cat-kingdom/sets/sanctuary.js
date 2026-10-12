// Beat 11: a wildlife sanctuary in the Sierra foothills. A great glass dome over a forested hill full of birds,
// all safe (US cats kill about 2.4 billion birds a year). Next door, a supervised hunting simulation:
// a feather wand and a red dot, for the cats.
import * as THREE from 'three';
import { C, S, backdrop, clay, glossy, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { mesh, rbox, shrub } from '../lib/props.js';
import { basePlate, fence } from '../lib/town.js';
import { beatOrbit, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { clamp, rng } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [1260, 1380];
const DOME = { x: -1.4, z: -1.2, r: 4.2 };

function conifer(h = 1.6, seed = 1) {
  const g = new THREE.Group(), R = rng(seed);
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, h * 0.3, 8), clay(S.woodDark, 0.7), { pos: [0, h * 0.15, 0] }));
  const m = clay(R() < 0.5 ? S.greenDark : tone(C.green, 0.8), 0.8);
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(h * (0.32 - i * 0.07), h * 0.42, 14), m, { pos: [0, h * (0.32 + i * 0.22), 0] }));
  return g;
}

function bird(color) {
  const g = new THREE.Group();
  const m = clay(color, 0.6);
  g.add(mesh(new THREE.SphereGeometry(0.09, 12, 8).scale(1.6, 0.8, 0.8), m, {}));
  g.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), m, { pos: [0.13, 0.04, 0] }));
  g.add(mesh(new THREE.ConeGeometry(0.02, 0.06, 6).rotateZ(-Math.PI / 2), clay(S.terra, 0.6), { pos: [0.19, 0.035, 0] }));
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.08, 0.0); shape.lineTo(-0.02, 0.22); shape.closePath();
    w.add(mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2 * s), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }), { cast: false }));
    w.scale.z = s;
    g.add(w);
    return w;
  });
  g.userData.wings = wings;
  return g;
}

export async function createSanctuary(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.35, horizon: tone(C.blue, 1, 0.32), top: tone(C.blue, 0.92) });
  const R = rng(11);
  scene.fog = new THREE.Fog(tone(C.blue, 1, 0.42), 30, 230);
  scene.add(basePlate({ w: 16, d: 15, ground: mixc(tone(C.cream, 0.88), C.green, 0.35) }));
  // rolling foothills: soft green mounds; granite peaks behind
  for (const [x, z, sx, sy, sz] of [[-1.4, -1.2, 3.6, 1.2, 3.4], [4.6, -4.8, 2.6, 0.8, 2.2], [-5.6, 3.8, 2.4, 0.6, 2.0]]) {
    const h = mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), clay(mixc(S.green, tone(C.cream, 0.9), 0.15), 0.9), { pos: [x, 0, z] });
    h.scale.set(sx, sy, sz); scene.add(h);
  }
  const granite = clay(tone(C.cream, 0.86), 0.85), snow = clay(tone(C.cream, 1, 0.55), 0.7);
  for (const [x, z, r, h] of [[-60, -150, 34, 30], [0, -170, 44, 42], [64, -155, 34, 28], [-120, -120, 28, 20]]) {
    scene.add(mesh(new THREE.ConeGeometry(r, h, 7, 1), granite, { pos: [x, h / 2 - 0.7, z], rot: [0, R() * 2, 0], cast: false }));
    scene.add(mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 7, 1), snow, { pos: [x, h * 0.84 - 0.7, z], rot: [0, R() * 2, 0], cast: false }));
  }

  // ---------- the dome: forest and a pond inside, ribs outside, birds flying free
  const inside = new THREE.Group();
  inside.position.set(DOME.x, 0, DOME.z);
  scene.add(inside);
  const hillY = (x, z) => 1.2 * Math.sqrt(Math.max(0, 1 - (x / 3.6) ** 2 - (z / 3.4) ** 2));
  for (let i = 0; i < 18; i++) {
    const a = R() * Math.PI * 2, rr = 0.5 + Math.sqrt(R()) * 3.0;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const t = i % 3 ? conifer(1.1 + R() * 0.9, i) : shrub({ r: 0.4 + R() * 0.2, stem: 0.4, seed: i });
    t.position.set(x, hillY(x, z) - 0.05, z);
    inside.add(t);
  }
  const pond = mesh(new THREE.CircleGeometry(0.8, 32).rotateX(-Math.PI / 2), glossy(tone(C.blue, 1.0, 0.1), { roughness: 0.08 }), { pos: [1.9, hillY(1.9, 1.2) + 0.03, 1.2], cast: false });
  pond.scale.set(1.3, 1, 0.8);
  inside.add(pond);
  const glass = glossy(tone(C.green, 1, 0.6), { roughness: 0.06, transparent: true, opacity: 0.2, reflect: 1.0, depthWrite: false, side: THREE.DoubleSide });
  const dome = mesh(new THREE.SphereGeometry(DOME.r, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), glass, { cast: false, receive: false });
  dome.renderOrder = 4;
  inside.add(dome);
  const rib = clay(tone(C.cream, 1, 0.3), 0.5);
  for (let i = 0; i < 8; i++) inside.add(mesh(new THREE.TorusGeometry(DOME.r, 0.035, 6, 64, Math.PI), rib, { rot: [0, (i / 8) * Math.PI, 0], cast: false }));
  for (const lat of [0.35, 0.7, 1.05]) inside.add(mesh(new THREE.TorusGeometry(DOME.r * Math.cos(lat), 0.03, 6, 64), rib, { pos: [0, DOME.r * Math.sin(lat), 0], rot: [Math.PI / 2, 0, 0], cast: false }));
  inside.add(mesh(new THREE.TorusGeometry(DOME.r, 0.09, 8, 64), clay(tone(C.green, 0.7), 0.6), { rot: [Math.PI / 2, 0, 0] }));
  const birds = Array.from({ length: 12 }, (_, i) => {
    const b = bird(i % 3 ? tone(C.blue, 1, 0.35) : tone(C.cream, 1, 0.3));
    b.scale.setScalar(1.3);
    inside.add(b);
    return { b, r: 1.0 + R() * 2.2, h: 1.6 + R() * 1.6, sp: (0.35 + R() * 0.3) * (R() < 0.5 ? 1 : -1), ph: R() * 6.3, fl: 9 + R() * 4 };
  });

  // ---------- next door: the supervised hunting simulation
  const pen = new THREE.Group();
  pen.position.set(3.0, 0, 2.7);
  pen.scale.setScalar(1.0);
  scene.add(pen);
  pen.add(mesh(new THREE.BoxGeometry(3.8, 0.03, 3.0), clay(tone(C.cream, 0.95), 0.8), { pos: [0, 0.015, 0], cast: false }));
  for (const [x, z, L, ry] of [[0, -1.5, 3.8, 0], [0, 1.5, 3.8, 0], [-1.9, 0, 3, Math.PI / 2], [1.9, 0, 3, Math.PI / 2]]) { const f = fence(L); f.position.set(x, 0, z); f.rotation.y = ry; pen.add(f); }
  const keeper = makeHuman({ pose: 'stand', seed: 150, scale: 1.65, shirt: 2, skin: 2, hair: 0, cut: 2 });
  keeper.group.position.set(1.25, 0, -0.55); keeper.group.rotation.y = -2.3;
  pen.add(keeper.group);
  // the feather wand: a rod from the keeper's hand, a string, a terracotta-and-cream feather
  const wand = new THREE.Group();
  wand.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), clay(S.woodDark, 0.6), { pos: [0, 0.65, 0] }));
  wand.position.set(0.98, 0.95, -0.35); wand.rotation.set(0, 0, 0.9);
  pen.add(wand);
  const feather = new THREE.Group();
  feather.add(mesh(new THREE.SphereGeometry(0.06, 12, 8).scale(1, 2.6, 0.4), clay(S.terra, 0.8), { pos: [0, -0.12, 0] }));
  feather.add(mesh(new THREE.SphereGeometry(0.05, 12, 8).scale(1, 2.2, 0.4), clay(tone(C.cream, 1, 0.3), 0.8), { pos: [0.05, -0.1, 0.02], rot: [0, 0, 0.5] }));
  pen.add(feather);
  const string = mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), clay(tone(C.cream, 0.3), 0.6), { cast: false });
  pen.add(string);
  const hunter = makeCat({ pose: 'sphinx', coat: 'ginger', seed: 151 });
  hunter.group.scale.setScalar(0.78); hunter.group.position.set(-0.45, 0, 0.1); hunter.group.rotation.y = 1.1;
  pen.add(hunter.group);
  // the red dot and its chaser
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: tone(C.terra, 1.3), toneMapped: false }));
  pen.add(dot);
  const chaser = makeCat({ pose: 'stand', coat: 'cream', seed: 152 });
  chaser.group.scale.setScalar(0.75);
  pen.add(chaser.group);
  const watcher = makeCat({ pose: 'sit', coat: 'ginger2', seed: 153 });
  watcher.group.scale.setScalar(0.72); watcher.group.position.set(-1.3, 0, -0.9); watcher.group.rotation.y = 0.9;
  pen.add(watcher.group);

  const labels = placeLabels([{ id: 'sn', text: 'Sierra Nevada', pos: [0, 30, -170], dot: false, italic: true }]);
  await labels.sync();
  const lights = rig(scene, pipe.renderer, { size: 10, dist: 50, intensity: 5.8, fillK: 0.24, rimK: 0.3 });
  lights.follow(new THREE.Vector3(0.5, 0.5, 0.5), 10);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const tmp = new THREE.Vector3();
  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatOrbit(f, BEAT, { center: [0.6, 0, 0.6], a0: 0.62, a1: 1.1, r0: 13.5, r1: 12.5, h0: 6.4, h1: 5.8, lens0: 35, target: [0.6, 1.4, 0.4] }));
      birds.forEach(({ b, r, h, sp, ph, fl }) => {
        const a = ph + (f / FPS) * sp;
        b.position.set(Math.cos(a) * r, h + Math.sin(a * 2.3) * 0.25, Math.sin(a) * r);
        b.rotation.y = -a + (sp > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI / 2;
        const flap = Math.sin((f / FPS) * fl) * 0.7;
        b.userData.wings[0].rotation.x = flap; b.userData.wings[1].rotation.x = -flap;
      });
      // the feather swings on its string; the hunter's head follows it
      const sw = Math.sin(t * 3.1) * 0.45 + Math.sin(t * 5.3) * 0.12;
      wand.updateMatrixWorld(true);
      const tip = new THREE.Vector3(0, 1.3, 0).applyMatrix4(wand.matrix);
      const fp = tip.clone().add(new THREE.Vector3(Math.sin(sw) * 0.7, -0.75 + Math.abs(Math.sin(sw)) * 0.2, Math.cos(t * 2.2) * 0.25));
      feather.position.copy(fp);
      feather.rotation.z = sw;
      string.position.copy(tip).add(fp).multiplyScalar(0.5);
      string.scale.y = tip.distanceTo(fp);
      string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.copy(tip).sub(fp).normalize());
      const hp = hunter.group.position, toF = Math.atan2(fp.x - hp.x, fp.z - hp.z) - hunter.group.rotation.y;
      hunter.look(Math.atan2(Math.sin(toF), Math.cos(toF)) * 0.8, -0.25, 0);
      // the red dot zig-zags; the chaser trots after it
      const dx = -0.5 + Math.sin(t * 1.7) * 0.8, dz = 0.7 + Math.sin(t * 2.9 + 1) * 0.35;
      dot.position.set(dx, 0.035, dz);
      const cx = -0.5 + Math.sin((t - 0.35) * 1.7) * 0.8, cz = 0.7 + Math.sin((t - 0.35) * 2.9 + 1) * 0.35;
      chaser.group.position.set(cx - 0.35, 0, cz + 0.2);
      chaser.group.rotation.y = Math.atan2(dx - cx + 0.35, dz - cz - 0.2);
      watcher.look(0.4 + Math.sin(t * 1.7) * 0.4, 0.1, 0);
      [hunter, chaser, watcher].forEach((c, i) => c.update(t + i));
      keeper.update(t);
      labels.update(cam, { sn: clamp((t - 0.8) / 0.5) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.24, exposure: 1.0, vignette: 0.24 };
    },
  };
}
