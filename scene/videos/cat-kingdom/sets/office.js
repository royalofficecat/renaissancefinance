// Beat 1 (and the room for beat 2): the governor's office in the Capitol, cut away like a dolls' house.
// The only sunlight comes through one tall window and lands on the governor's chair, where a ginger cat sits.
// A staffer waits patiently with a folder. The paw seal hangs on the wall.
import * as THREE from 'three';
import { C, S, backdrop, clay, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { bookshelf, cardboardBox, deskLamp, desk, framedPicture, governorChair, mesh, paperStack, pawFlag, pawSeal, plant, rbox, rubberStamp } from '../lib/props.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { ease, prog } from '../../../src/core/util.js';
import { buildRoom, dustMotes, lightShaft } from '../lib/room.js';

const FPS = 30;
const ROOM = { x0: -3.2, x1: 3.4, z0: -3.0, z1: 2.4, h: 3.7 };
const WIN = { z0: 0.1, z1: 2.1, y0: 0.55, y1: 3.25 };

export async function createOffice(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.2 });
  // ---------- the room shell (floor slab with a visible cut edge, two walls; front and right open)
  const room = new THREE.Group();
  scene.add(room);
  room.add(buildRoom(ROOM, { windows: [WIN], pilasters: [-1.55, 1.25] }).group);

  // ---------- rug (institution blue with a cream border)
  room.add(mesh(rbox(3.9, 0.02, 2.9, 0.008), clay(tone(C.cream, 0.92), 0.9), { pos: [-0.2, 0.01, -1.2] }));
  room.add(mesh(rbox(3.6, 0.024, 2.6, 0.008), clay(S.blueDark, 0.92), { pos: [-0.2, 0.012, -1.2] }));
  room.add(mesh(rbox(3.2, 0.026, 2.2, 0.008), clay(tone(C.blue, 0.72), 0.92), { pos: [-0.2, 0.013, -1.2], cast: false }));

  // ---------- furniture
  const theDesk = desk();
  theDesk.position.set(-1.35, 0, -1.75);
  theDesk.rotation.y = 0.12;
  room.add(theDesk);
  const onDesk = (obj, x, z, ry = 0) => { obj.position.set(x, 0.78, z); obj.rotation.y = ry; theDesk.add(obj); return obj; };
  onDesk(paperStack(7, 2), 0.35, 0.1, 0.1);
  onDesk(paperStack(4, 5), 0.62, -0.15, -0.2);
  onDesk(deskLamp(), -0.65, -0.25);
  onDesk(rubberStamp(), 0.1, 0.22);
  onDesk(plant({ h: 0.55, seed: 2 }), -0.3, -0.28).scale.setScalar(0.45);

  const chair = governorChair({ fabric: tone(C.cream, 1.0, 0.12) });
  chair.position.set(0.05, 0, -1.4);
  chair.rotation.y = 0.32;
  room.add(chair);

  const seal = pawSeal(0.38);
  seal.position.set(0.32, 2.12, ROOM.z0 + 0.04);
  room.add(seal);

  const flag = pawFlag({ h: 2.5 });
  flag.position.set(-2.3, 0, ROOM.z0 + 0.45);
  flag.rotation.y = 0.2;
  room.add(flag);
  const pic1 = framedPicture({ w: 0.52, h: 0.4, kind: 0 });
  pic1.position.set(1.42, 1.98, ROOM.z0 + 0.01);
  room.add(pic1);
  const pic2 = framedPicture({ w: 0.36, h: 0.46, kind: 1 });
  pic2.position.set(1.42, 1.4, ROOM.z0 + 0.01);
  room.add(pic2);

  const shelf = bookshelf({ w: 1.3, h: 2.3, seed: 4 });
  shelf.position.set(2.35, 0, ROOM.z0 + 0.2);
  room.add(shelf);
  room.add(Object.assign(plant({ h: 1.3, seed: 7 }), {}).translateX(-2.55).translateZ(-2.55));

  // ---------- characters
  const gov = makeCat({ pose: 'sit', coat: 'ginger', seed: 1 });
  gov.group.scale.setScalar(0.72);
  gov.group.position.set(0.05 + Math.sin(0.32) * 0.03, 0.555, -1.4 + Math.cos(0.32) * 0.03);
  gov.group.rotation.y = 0.32;
  room.add(gov.group);

  const napper = makeCat({ pose: 'curl', coat: 'cream', seed: 6 });
  napper.group.scale.setScalar(0.5);
  napper.group.position.set(2.3, 2.27, ROOM.z0 + 0.22); // asleep on top of the bookshelf
  room.add(napper.group);

  const boxCat = makeCat({ pose: 'loaf', coat: 'cream', seed: 3 });
  const box = cardboardBox({ w: 0.56, h: 0.3, d: 0.46 });
  box.position.set(-0.95, 0, -0.55);
  box.rotation.y = 0.45;
  room.add(box);
  boxCat.group.scale.setScalar(0.62);
  boxCat.group.position.set(0, 0.02, 0.02);
  box.add(boxCat.group);

  const staffer = makeHuman({ pose: 'holdFolder', seed: 11, shirt: 0, trousers: 0, skin: 2, hair: 1, cut: 1, scale: 1.72 });
  staffer.group.position.set(1.12, 0, -1.55);
  staffer.group.rotation.y = -1.62;
  room.add(staffer.group);

  // ---------- light: gold sun through the window only, cool sky fill inside
  const keyDir = [-0.7, 0.42, 0.57];
  const lights = rig(scene, pipe.renderer, { size: 5.2, dist: 30, intensity: 8.5, keyDir, fillK: 0.115, rimK: 0.1, rimDir: [0.6, 0.5, 0.6] });
  lights.follow(new THREE.Vector3(0, 1.4, -0.4), 5.2);
  scene.add(lightShaft(ROOM, WIN, lights.keyDir));
  const dust = dustMotes(ROOM, WIN, lights.keyDir, pipe.dpr);
  scene.add(dust.points);

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  // Beat 1: establishing wide, then a slow push-in on the chair (35 -> 40 mm)
  const A = { pos: [1.15, 1.72, 3.05], target: [0.32, 1.3, -1.35], lens: 35 };
  const B = { pos: [0.95, 1.62, 2.25], target: [0.3, 1.24, -1.4], lens: 40 };

  const dbg = new URLSearchParams(location.search).get('debug');
  if (dbg) { lights.fill.intensity = 0; lights.rim.intensity = 0; }
  return {
    frame(f) {
      const t = f / FPS;
      const s = dbg === 'top' ? { pos: new THREE.Vector3(0.3, 14, 0.2), target: new THREE.Vector3(0, 0, -0.8), lens: 24 } : move(f, 6, 175, A, B, { fn: ease.inOutSine });
      applyCam(cam, s);
      // The governor: a slow blink at 1.3 s, then looks from the staffer to us
      const turn = ease.inOutCubic(prog(t, 2.0, 2.7));
      gov.look(0.55 * (1 - turn) - 0.32 * turn + 0.05, -0.04, 0.06 * turn);
      gov.state.slow = Math.sin(Math.PI * prog(t, 1.15, 2.0)) ** 2;
      gov.update(t);
      napper.update(t);
      boxCat.look(0.35 + Math.sin(t * 0.7) * 0.05, 0.05, 0);
      boxCat.update(t + 3);
      staffer.state.nod = 0.12 + 0.06 * ease.inOutSine(prog(t, 3.2, 4.0));
      staffer.update(t);
      dust.update(t);
      return { scene, camera: cam, bloom: 0.22, exposure: 1.0, vignette: 0.22 };
    },
  };
}
