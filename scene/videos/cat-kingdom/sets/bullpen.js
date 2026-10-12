// Beat 2: an open-plan state office. Cats sleep on keyboards and in desk chairs (12-16 hours a day);
// people work around them, one happily typing on the sliver of keyboard the cat has left.
import * as THREE from 'three';
import { C, S, backdrop, clay, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { cardboardBox, mesh, officeChair, paperStack, pawSeal, plant, rbox, workDesk } from '../lib/props.js';
import { buildRoom, dustMotes, lightShaft } from '../lib/room.js';
import { beatOrbit } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';

const FPS = 30;
const BEAT = [180, 300];
const ROOM = { x0: -4.2, x1: 4.6, z0: -3.8, z1: 3.0, h: 3.6 };
const WINS = [{ z0: -2.0, z1: -0.4, y0: 0.6, y1: 3.1 }, { z0: 0.4, z1: 2.0, y0: 0.6, y1: 3.1 }];

export async function createBullpen(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.2 });
  const room = new THREE.Group();
  scene.add(room);
  room.add(buildRoom(ROOM, { windows: WINS, pilasters: [-1.9, 1.6], wall: tone(C.cream, 0.92) }).group);
  // a paw seal on the back wall: this is a government office
  const seal = pawSeal(0.32);
  seal.position.set(0.2, 2.35, ROOM.z0 + 0.04);
  room.add(seal);
  // carpet
  room.add(mesh(rbox(6.4, 0.02, 4.4, 0.01), clay(tone(C.blue, 0.55), 0.95), { pos: [0.2, 0.01, -1.1], cast: false }));

  // ---------- the desk cluster: two rows back to back
  const cats = [], people = [];
  const addCat = (pose, coat, seed, pos, yaw, scale, look = [0, 0, 0], closed = false) => {
    const c = makeCat({ pose, coat, seed });
    c.group.position.set(...pos);
    c.group.rotation.y = yaw;
    c.group.scale.setScalar(scale);
    c.look(...look);
    if (closed) c.state.open = 0;
    room.add(c.group);
    cats.push(c);
    return c;
  };
  const addPerson = (pose, seed, pos, yaw, o = {}) => {
    const h = makeHuman({ pose, seed, scale: 1.72, ...o });
    h.group.position.set(...pos);
    h.group.rotation.y = yaw;
    room.add(h.group);
    people.push(h);
    return h;
  };
  const xs = [-1.55, 0, 1.55];
  const desks = [];
  for (const [row, z, yaw] of [[0, -0.95, 0], [1, -1.72, Math.PI]]) {
    xs.forEach((x, i) => {
      const d = workDesk({ seed: row * 3 + i });
      d.position.set(x, 0, z);
      d.rotation.y = yaw;
      room.add(d);
      desks.push(d);
    });
  }
  // Row 1 (nearest): a cat asleep on the keyboard, its person typing on what's left
  // left desk: a ginger cat asleep on the keyboard; its colleague waits beside the empty chair
  addCat('curl', 'ginger', 21, [-1.55, 0.795, -0.86], 0.3, 0.55, [0, 0, 0], true);
  const ch0 = officeChair(); ch0.position.set(-1.5, 0, -0.25); ch0.rotation.y = 0.15; room.add(ch0);
  addPerson('holdFolder', 32, [-2.35, 0, -0.35], 2.2, { shirt: 2, skin: 3, hair: 0, cut: 0 });
  // middle desk: a cream cat sprawled across the keyboard; the typist happily uses the sliver that's left
  addCat('sprawl', 'cream', 22, [0.14, 0.77, -1.0], 1.9, 0.55, [0, 0, 0], true);
  const typist = addPerson('sitTyping', 31, [-0.3, 0, -0.27], Math.PI, { shirt: 1, skin: 0, hair: 2, cut: 2 });
  const ch1 = officeChair(); ch1.position.set(-0.3, 0, -0.3); ch1.rotation.y = 0; room.add(ch1);
  addPerson('stand', 35, [3.2, 0, -0.6], -1.9, { shirt: 0, skin: 1, hair: 4, cut: 1 });
  // right desk: the chair is taken
  const ch2 = officeChair(); ch2.position.set(1.55, 0, -0.18); ch2.rotation.y = 0.35; room.add(ch2);
  addCat('curl', 'ginger2', 23, [1.55, 0.53, -0.18], 0.4, 0.52, [0, 0, 0], true);

  // Row 2 (far side): one person working normally, one cat on a paper stack, one cat watching a screen
  const ch3 = officeChair(); ch3.position.set(-1.55, 0, -2.5); ch3.rotation.y = Math.PI; room.add(ch3);
  addPerson('sitTyping', 34, [-1.55, 0, -2.5], 0, { shirt: 3, skin: 2, hair: 1, cut: 0 });
  const stack = paperStack(9, 7); stack.position.set(0.2, 0.77, -1.75); room.add(stack);
  addCat('loaf', 'cream', 24, [0.2, 0.84, -1.75], 2.6, 0.52, [0.3, 0, 0], true);
  addCat('sit', 'ginger', 25, [1.2, 0.77, -1.62], 0.5, 0.5, [0.2, 0.15, 0]);
  const ch4 = officeChair(); ch4.position.set(1.55, 0, -2.5); ch4.rotation.y = Math.PI; room.add(ch4);

  // floor: a sunny cardboard box with a cat in it, a plant, a water cooler
  const box = cardboardBox({ w: 0.5, h: 0.28, d: 0.42 });
  box.position.set(-2.7, 0, 0.9); box.rotation.y = 0.4;
  room.add(box);
  const bc = makeCat({ pose: 'loaf', coat: 'ginger', seed: 26 });
  bc.group.scale.setScalar(0.42); bc.group.position.set(0, 0.02, 0.0); bc.look(0.5, 0.1, 0);
  box.add(bc.group); cats.push(bc);
  room.add(plant({ h: 1.3, seed: 3 }).translateX(-3.7).translateZ(-3.3));
  room.add(plant({ h: 1.1, seed: 4 }).translateX(3.9).translateZ(-3.3));
  const cooler = new THREE.Group();
  cooler.add(mesh(rbox(0.36, 1.0, 0.36, 0.05), clay(tone(C.cream, 1, 0.3), 0.6), { pos: [0, 0.5, 0] }));
  cooler.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 20), clay(tone(C.blue, 1, 0.35), 0.2), { pos: [0, 1.2, 0] }));
  cooler.position.set(3.3, 0, -3.2);
  room.add(cooler);

  const keyDir = [-0.7, 0.42, 0.57];
  const lights = rig(scene, pipe.renderer, { size: 6.5, dist: 34, intensity: 8.5, keyDir, fillK: 0.12, rimK: 0.1, rimDir: [0.6, 0.5, 0.6] });
  lights.follow(new THREE.Vector3(0, 1.2, -1.0), 6.5);
  const dusts = WINS.map((w, i) => { const d = dustMotes(ROOM, w, lights.keyDir, pipe.dpr, 40, 30 + i); scene.add(d.points); scene.add(lightShaft(ROOM, w, lights.keyDir, 0.12)); return d; });

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  return {
    frame(f) {
      const t = f / FPS;
      const s = beatOrbit(f, BEAT, { center: [-0.8, 0.0, -1.2], a0: 0.18, a1: 0.58, r0: 3.7, r1: 3.3, h0: 3.6, h1: 3.25, lens0: 35, target: [-0.78, 0.72, -1.12] });
      applyCam(cam, s);
      cats.forEach((c, i) => c.update(t + i * 1.3));
      people.forEach((p) => p.update(t));
      // the typist's head bobs a little as they type around the cat
      typist.state.nod = 0.35 + Math.sin(t * 7) * 0.015;
      dusts.forEach((d) => d.update(t));
      return { scene, camera: cam, bloom: 0.22, exposure: 1.0, vignette: 0.22 };
    },
  };
}
