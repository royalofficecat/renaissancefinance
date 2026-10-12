// Beat 9: the Capitol chamber in Sacramento (capital since 1854). A council of cats on ever-taller furniture.
// A person presents a bill; a cat sits on it (approved: the paw stamp comes down). Then, during the petition
// for shorter hours, the council falls asleep one by one.
import * as THREE from 'three';
import { C, S, backdrop, clay, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { mesh, paperStack, pawFlag, pawSeal, rbox, sisalMaterial } from '../lib/props.js';
import { buildRoom, dustMotes, lightShaft, parquet } from '../lib/room.js';
import { beatMove, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { clamp, ease, prog } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [1020, 1140];
const ROOM = { x0: -4.6, x1: 4.8, z0: -5.2, z1: 3.4, h: 5.2 };
const WINS = [{ z0: -4.0, z1: -2.4, y0: 1.0, y1: 4.4 }, { z0: -1.2, z1: 0.4, y0: 1.0, y1: 4.4 }];
const DAIS = 0.42;

export async function createChamber(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.2 });
  const room = new THREE.Group();
  scene.add(room);
  room.add(buildRoom(ROOM, { windows: WINS, pilasters: [-2.9, -1.0, 1.0, 2.9], wall: tone(C.cream, 0.9), floor: parquet(tone(S.wood, 1.05)) }).group);
  const wood = clay(S.woodDark, 0.6), woodL = clay(S.wood, 0.6), blue = clay(tone(C.blue, 0.6), 0.85), cream = clay(tone(C.cream, 1, 0.2), 0.7);
  // carpet down the aisle
  room.add(mesh(rbox(1.3, 0.02, 6.2, 0.01), clay(tone(C.blue, 0.55), 0.95), { pos: [0, 0.01, 0.0], cast: false }));

  // ---------- the dais, the seal and flags
  room.add(mesh(rbox(7.6, DAIS, 2.6, 0.04), woodL, { pos: [0, DAIS / 2, -3.9] }));
  room.add(mesh(rbox(1.4, DAIS * 0.5, 0.5, 0.03), woodL, { pos: [0, DAIS * 0.25, -2.45] }));
  const seal = pawSeal(0.8); seal.position.set(0, 3.9, ROOM.z0 + 0.05); room.add(seal);
  for (const x of [-1.6, 1.6]) { const fl = pawFlag({ h: 3.2 }); fl.position.set(x, DAIS, -4.85); fl.rotation.y = x < 0 ? 0.3 : Math.PI - 0.3; room.add(fl); }

  // ---------- the council: ever-taller pedestals (sisal-wrapped columns with cushion tops)
  const council = [];
  const post = sisalMaterial();
  const heights = [0.8, 1.25, 1.9, 1.25, 0.8, 1.55];
  const xs = [-2.8, -1.45, 0, 1.45, 2.8, 3.9];
  const coats = ['cream', 'ginger2', 'ginger', 'cream', 'ginger2', 'ginger'];
  xs.forEach((x, i) => {
    const h = heights[i], z = -4.05 + (i === 2 ? -0.2 : 0);
    room.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, h, 20), post, { pos: [x, DAIS + h / 2, z] }));
    room.add(mesh(rbox(0.72, 0.1, 0.62, 0.04), wood, { pos: [x, DAIS + h, z] }));
    room.add(mesh(rbox(0.64, 0.1, 0.54, 0.05), clay(i === 2 ? S.terra : tone(C.blue, 0.65), 0.9), { pos: [x, DAIS + h + 0.1, z] }));
    const c = makeCat({ pose: i === 2 ? 'sit' : i % 2 ? 'loaf' : 'sit', coat: coats[i], seed: 90 + i });
    c.group.scale.setScalar(i === 2 ? 0.66 : 0.56);
    c.group.position.set(x, DAIS + h + 0.15, z);
    c.group.rotation.y = -x * 0.08;
    room.add(c.group);
    council.push(c);
  });
  // the speaker's table at the front of the dais, the bill on it, a cat sitting on the bill
  room.add(mesh(rbox(1.6, 0.06, 0.8, 0.02), woodL, { pos: [0, DAIS + 0.5, -2.85] }));
  room.add(mesh(rbox(1.5, 0.5, 0.06, 0.02), wood, { pos: [0, DAIS + 0.25, -2.5] }));
  const bill = paperStack(3, 11); bill.position.set(-0.3, DAIS + 0.53, -2.85); room.add(bill);
  const sitter = makeCat({ pose: 'sit', coat: 'ginger', seed: 99 });
  sitter.group.scale.setScalar(0.5); sitter.group.position.set(-0.3, DAIS + 0.56, -2.85); sitter.group.rotation.y = 0.15;
  room.add(sitter.group);
  // the stamp: a big wooden stamp that comes down on the second sheet and leaves a terracotta paw print
  const sheet = paperStack(1, 12); sheet.position.set(0.42, DAIS + 0.53, -2.82); room.add(sheet);
  const print = new THREE.Group();
  const pm = clay(S.terra, 0.8);
  print.add(mesh(new THREE.CircleGeometry(0.045, 20).rotateX(-Math.PI / 2), pm, { pos: [0, 0, 0.02], cast: false }));
  for (const [dx, dz] of [[-0.045, -0.03], [-0.016, -0.055], [0.016, -0.055], [0.045, -0.03]]) print.add(mesh(new THREE.CircleGeometry(0.015, 12).rotateX(-Math.PI / 2), pm, { pos: [dx, 0, dz], cast: false }));
  print.position.set(0.42, DAIS + 0.545, -2.82);
  room.add(print);
  const stamp = new THREE.Group();
  stamp.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 24), clay(S.terra, 0.6), { pos: [0, 0.04, 0] }));
  stamp.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 14), wood, { pos: [0, 0.2, 0] }));
  stamp.add(mesh(new THREE.SphereGeometry(0.08, 16, 12), wood, { pos: [0, 0.36, 0] }));
  room.add(stamp);

  // ---------- the people: the presenter at the lectern, legislators at their desks either side of the aisle
  room.add(mesh(rbox(0.6, 1.1, 0.45, 0.04), wood, { pos: [-0.35, 0.55, -1.25] }));
  const presenter = makeHuman({ pose: 'holdFolder', seed: 101, scale: 1.72, shirt: 0, skin: 2, hair: 1, cut: 1 });
  presenter.group.position.set(-0.35, 0, -0.75); presenter.group.rotation.y = Math.PI;
  room.add(presenter.group);
  const people = [presenter];
  const deskCats = [];
  let k = 0;
  for (const side of [-1, 1]) for (const z of [-0.4, 0.9, 2.2]) {
    const x = side * 2.0;
    room.add(mesh(rbox(1.6, 0.06, 0.6, 0.02), woodL, { pos: [x, 0.76, z] }));
    room.add(mesh(rbox(1.6, 0.74, 0.06, 0.02), wood, { pos: [x, 0.37, z - 0.27] }));
    if (k % 3 !== 1) {
      const p = makeHuman({ pose: 'sitTyping', seed: 110 + k, scale: 1.68 });
      p.group.position.set(x + (k % 2 ? 0.3 : -0.3), 0, z + 0.62); p.group.rotation.y = Math.PI;
      room.add(p.group); people.push(p);
      room.add(mesh(rbox(0.5, 0.08, 0.46, 0.04), blue, { pos: [x + (k % 2 ? 0.3 : -0.3), 0.46, z + 0.62] }));
    }
    if (k % 2 === 0) {
      const c = makeCat({ pose: 'curl', coat: k % 4 ? 'cream' : 'ginger', seed: 120 + k, lod: 'lo' });
      c.group.scale.setScalar(0.45); c.group.position.set(x + (k % 2 ? -0.35 : 0.35), 0.79, z); c.state.open = 0;
      room.add(c.group); deskCats.push(c);
    }
    k++;
  }
  void cream;

  const labels = placeLabels([{ id: 'sac', text: 'Sacramento', pos: [2.4, 4.6, -5.0], dot: false }]);
  await labels.sync();
  const keyDir = [-0.7, 0.48, 0.52];
  const lights = rig(scene, pipe.renderer, { size: 7.5, dist: 40, intensity: 8.0, keyDir, fillK: 0.13, rimK: 0.1, rimDir: [0.6, 0.5, 0.6] });
  lights.follow(new THREE.Vector3(0, 1.6, -1.5), 7.5);
  const dusts = WINS.map((w, i) => { const d = dustMotes(ROOM, w, lights.keyDir, pipe.dpr, 40, 50 + i); scene.add(d.points, lightShaft(ROOM, w, lights.keyDir, 0.1)); return d; });

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [0.6, 2.3, 4.6], target: [0, 1.9, -3.0], lens: 40 };
  const B = { pos: [0.5, 2.15, 2.7], target: [0, 1.95, -3.4], lens: 40 };
  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B));
      // the stamp comes down at 1.1 s and the paw print appears
      const down = Math.sin(Math.PI * clamp((t - 0.85) / 0.55));
      stamp.position.set(0.42, DAIS + 0.545 + 0.6 * (1 - down), -2.82);
      stamp.visible = t > 0.6 && t < 1.7;
      print.visible = t > 1.12;
      // the petition: the council nods off one by one, heads drooping
      const order = [4, 0, 3, 1, 5, 2];
      council.forEach((c, i) => {
        const s = ease.inOutSine(prog(t, 1.9 + order.indexOf(i) * 0.28, 2.5 + order.indexOf(i) * 0.28));
        c.state.open = 1 - s;
        c.look(Math.sin(t * 0.5 + i) * 0.15 * (1 - s), 0.05 + 0.45 * s, 0.2 * s * (i % 2 ? 1 : -1));
        c.update(t + i);
      });
      sitter.look(0.2, -0.1, 0);
      sitter.update(t + 7);
      deskCats.forEach((c, i) => c.update(t + i * 2));
      people.forEach((p) => p.update(t));
      dusts.forEach((d) => d.update(t));
      labels.update(cam, { sac: clamp((t - 0.8) / 0.5) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.22, exposure: 1.0, vignette: 0.22 };
    },
  };
}
