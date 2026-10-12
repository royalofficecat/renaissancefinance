// Beat 8: the Central Valley. Catnip rows beside food crops; a cardboard plant where a press puts one perfect
// dent in every box. At the end of the line cats sit in the boxes; the actual products lie ignored.
// (Boxes really do calm shelter cats: by day 3 in Vinke et al. 2014.)
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { cardboardBox, cushion, mesh, rbox, shrub, toyCar } from '../lib/props.js';
import { basePlate, tileRoof } from '../lib/town.js';
import { beatMove, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [900, 1020];
const BELT_Y = 0.62, X0 = -4.6, X_PRESS = -0.5, X_END = 2.6, SPEED = 0.75, GAP = 1.05;

/** Rows of plants on the field: catnip (light green, cream flower tips) or food crops (dark green, terracotta fruit). */
function fieldRows({ w = 5, d = 4, rows = 7, kind = 'catnip', seed = 1 }) {
  const g = new THREE.Group(), R = rng(seed);
  g.add(mesh(new THREE.BoxGeometry(w, 0.04, d), clay(mixc(tone(C.cream, 0.6), C.terra, 0.25), 0.95), { pos: [0, 0.02, 0], cast: false }));
  const leaf = clay(kind === 'catnip' ? tone(C.green, 1, 0.22) : S.greenDark, 0.8);
  const tip = clay(kind === 'catnip' ? tone(C.cream, 1, 0.4) : S.terra, 0.6);
  const n = Math.floor(w / 0.32);
  const geo = new THREE.SphereGeometry(1, 12, 8), tipGeo = new THREE.SphereGeometry(1, 8, 6);
  const plants = new THREE.InstancedMesh(geo, leaf, rows * n), tips = new THREE.InstancedMesh(tipGeo, tip, rows * n);
  plants.castShadow = plants.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const s = 0.13 + R() * 0.05;
    p.set(-w / 2 + 0.2 + i * 0.32 + (R() - 0.5) * 0.05, s * 0.8, -d / 2 + 0.3 + r * ((d - 0.6) / (rows - 1)));
    m.compose(p, q, sv.set(s, s * (kind === 'catnip' ? 1.5 : 1.1), s));
    plants.setMatrixAt(k, m);
    p.y += s * (kind === 'catnip' ? 1.3 : 0.6); p.x += (R() - 0.5) * 0.08;
    m.compose(p, q, sv.setScalar(kind === 'catnip' ? 0.035 : 0.05));
    tips.setMatrixAt(k, m);
    k++;
  }
  g.add(plants, tips);
  return g;
}

/** A closed box travelling on the belt; `dent` shows the one perfect dent on its lid. */
function beltBox(seed) {
  const g = new THREE.Group(), R = rng(seed);
  const card = clay(mixc(tone(C.cream, 0.72 + R() * 0.06), C.terra, 0.12), 0.85);
  g.add(mesh(rbox(0.5, 0.34, 0.42, 0.015), card, { pos: [0, 0.17, 0] }));
  const dent = mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1), clay(mixc(tone(C.cream, 0.5), C.terra, 0.15), 0.9), { pos: [0, 0.343, 0], rot: [Math.PI, 0, 0], cast: false });
  g.add(dent);
  g.userData.dent = dent;
  return g;
}

export async function createValley(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.35, horizon: tone(C.blue, 1, 0.32), top: tone(C.blue, 0.92) });
  const plate = basePlate({ w: 17, d: 14, ground: mixc(tone(C.cream, 0.9), C.green, 0.12) });
  plate.position.set(0, 0, -1);
  scene.add(plate);
  // fields behind the plant: catnip on the left, food crops on the right
  const cat1 = fieldRows({ w: 7.5, d: 3.4, rows: 8, kind: 'catnip', seed: 2 }); cat1.position.set(-3.2, 0, -4.4); scene.add(cat1);
  const crop = fieldRows({ w: 6.0, d: 3.4, rows: 8, kind: 'crop', seed: 3 }); crop.position.set(4.6, 0, -4.4); scene.add(crop);
  const cat2 = fieldRows({ w: 3.6, d: 3.0, rows: 6, kind: 'catnip', seed: 4 }); cat2.position.set(-6.4, 0, 3.6); scene.add(cat2);
  for (const [x, z] of [[-7.6, -2.6], [7.6, -2.0], [7.3, 3.9], [-0.4, -7.2]]) { const t = shrub({ r: 0.55, stem: 0.6, seed: x * 3 }); t.position.set(x, 0, z); scene.add(t); }

  // ---------- the cardboard plant: an open shed with a saw-tooth terracotta roof, a belt and a press
  const shed = new THREE.Group();
  const wall = clay(tone(C.cream, 0.95), 0.85);
  shed.add(mesh(rbox(4.2, 2.4, 0.2, 0.04), wall, { pos: [-4.0, 1.2, -1.7] }));
  shed.add(mesh(rbox(0.2, 2.4, 3.2, 0.04), wall, { pos: [-6.0, 1.2, 0] }));
  for (let i = 0; i < 3; i++) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.4, 0); sh.lineTo(1.4, 0.75); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 3.4, bevelEnabled: false }); rg.translate(0, 0, -1.7);
    shed.add(mesh(rg, tileRoof(S.terra), { pos: [-6.1 + i * 1.4, 2.4, 0] }));
  }
  for (const [x, z] of [[-2.0, 1.6], [-2.0, -1.6]]) shed.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 12), wall, { pos: [x, 1.2, z] }));
  scene.add(shed);
  // the belt
  const beltMat = clay(tone(C.cream, 0.3), 0.7);
  scene.add(mesh(rbox(X_END - X0 + 0.6, 0.12, 0.62, 0.05), beltMat, { pos: [(X0 + X_END) / 2, BELT_Y - 0.06, 0] }));
  for (let x = X0; x <= X_END; x += 0.9) scene.add(mesh(rbox(0.08, BELT_Y - 0.12, 0.5, 0.02), clay(tone(C.cream, 0.6), 0.6), { pos: [x, (BELT_Y - 0.12) / 2, 0] }));
  // the press: a frame over the belt and a head that comes down once per box
  const pressMat = clay(tone(C.blue, 0.75), 0.5);
  for (const s of [-1, 1]) scene.add(mesh(rbox(0.16, 2.0, 0.16, 0.04), pressMat, { pos: [X_PRESS, 1.0, s * 0.45] }));
  scene.add(mesh(rbox(0.5, 0.25, 1.06, 0.06), pressMat, { pos: [X_PRESS, 2.0, 0] }));
  const head = new THREE.Group();
  head.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 12), clay(tone(C.cream, 0.7), 0.4), { pos: [0, 0.35, 0] }));
  head.add(mesh(new THREE.SphereGeometry(0.1, 20, 12).scale(1, 0.6, 1), clay(S.terra, 0.5), { pos: [0, 0, 0] }));
  scene.add(head);
  const worker = makeHuman({ pose: 'stand', seed: 81, scale: 1.72, shirt: 0, skin: 3, hair: 4, cut: 0 });
  worker.group.position.set(X_PRESS + 0.15, 0, -1.0); worker.group.rotation.y = 0.25;
  scene.add(worker.group);

  // ---------- boxes on the belt
  const boxes = Array.from({ length: Math.ceil((X_END - X0) / GAP) + 2 }, (_, i) => { const b = beltBox(i + 3); scene.add(b); return b; });

  // ---------- the end of the line: boxes with cats in them, products lying ignored
  const cats = [];
  const R = rng(9);
  const catSpots = [[3.6, 0.9, 'ginger'], [4.4, 0.2, 'cream'], [3.9, -0.8, 'ginger2'], [5.2, 1.2, 'ginger'], [5.3, -0.4, 'cream'], [4.6, 2.1, 'ginger2']];
  catSpots.forEach(([x, z, coat], i) => {
    const b = cardboardBox({ w: 0.62, h: 0.24, d: 0.52, flaps: i % 2 === 0 });
    b.position.set(x, 0, z); b.rotation.y = R() * 1.2 - 0.6;
    scene.add(b);
    const c = makeCat({ pose: i % 3 === 1 ? 'loaf' : 'sit', coat, seed: 82 + i, lod: 'lo' });
    c.group.scale.setScalar(0.66); c.group.position.set(0, 0.02, 0); c.group.rotation.y = -0.4 + R() * 0.8;
    b.add(c.group);
    cats.push(c);
  });
  // the ignored products: a plush bed, a toy mouse, a ball
  const bed = cushion({ w: 0.9, d: 0.75, h: 0.22, color: tone(C.blue, 1, 0.3), piping: tone(C.cream, 1, 0.3) });
  bed.position.set(3.0, 0, 2.3); scene.add(bed);
  const mouseToy = new THREE.Group();
  mouseToy.add(mesh(new THREE.SphereGeometry(0.12, 16, 10).scale(1.4, 0.9, 1), clay(tone(C.cream, 0.6), 0.8), {}));
  mouseToy.add(mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20, Math.PI), clay(tone(C.cream, 0.4), 0.8), { pos: [-0.25, 0, 0], rot: [Math.PI / 2, 0, 0] }));
  mouseToy.position.set(2.4, 0.1, 1.6); scene.add(mouseToy);
  scene.add(mesh(new THREE.SphereGeometry(0.13, 20, 14), clay(S.terra, 0.6), { pos: [2.6, 0.13, 2.9] }));
  // a delivery van (human) waiting
  const van = toyCar({ color: tone(C.blue, 1, 0.3), scale: 1.6 });
  van.position.set(6.4, 0, -1.8); van.rotation.y = 2.4; scene.add(van);

  const labels = placeLabels([{ id: 'cv', text: 'Central Valley', pos: [-1.0, 0.9, -4.4], dot: false, italic: true }]);
  await labels.sync();
  const lights = rig(scene, pipe.renderer, { size: 10, dist: 50, intensity: 5.8, fillK: 0.22, rimK: 0.3 });
  lights.follow(new THREE.Vector3(0, 1, -1), 10);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [-1.6, 7.6, 10.8], target: [0.8, 0.3, -0.8], lens: 35 };
  const B = { pos: [2.9, 4.6, 6.6], target: [3.9, 0.35, 0.1], lens: 35 };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B));
      // boxes travel the belt; the press dents each one as it passes
      let pressDown = 0;
      boxes.forEach((b, i) => {
        const x = X0 + ((t * SPEED + i * GAP) % (boxes.length * GAP));
        const on = x <= X_END;
        b.visible = on;
        if (!on) return;
        b.position.set(x, BELT_Y, 0);
        b.userData.dent.visible = x > X_PRESS + 0.05;
        const d = Math.abs(x - X_PRESS);
        if (d < 0.18) pressDown = Math.max(pressDown, 1 - d / 0.18);
        b.scale.y = 1 - 0.05 * Math.max(0, 1 - d / 0.12);
      });
      head.position.set(X_PRESS, BELT_Y + 0.42 + 0.45 * (1 - ease.inOutSine(pressDown)), 0);
      cats.forEach((c, i) => { c.look(Math.sin(t * 0.6 + i * 2) * 0.4, 0.05, 0); c.update(t + i); });
      worker.update(t);
      labels.update(cam, { cv: clamp((t - 0.8) / 0.5) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.22, exposure: 1.0, vignette: 0.24 };
    },
  };
}
