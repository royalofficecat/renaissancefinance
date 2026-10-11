// Two legacies (beat 11): a muddy town mid-cleanup on the left; on the right a gate sends floodwater
// into a recharge basin and the groundwater below fills (recovery green). Clouds part, light warms.
import * as THREE from 'three';
import { C, clay, rig, water } from '../core/look.js';
import { applyCam, move } from '../core/camera.js';
import { ease, lerp, prog, smoothstep, spring } from '../core/util.js';
import { cloud, heightBlock, house, tree } from '../core/diorama.js';
import { rng } from '../core/util.js';

const SX = 12, SZ = 8, BASE = -3.0;
const BASIN = { x0: 0.4, x1: 4.6, z0: -1.4, z1: 2.6, depth: 0.32 };

function ground(x, z) {
  let h = 0.5 + 0.03 * Math.sin(x * 1.7 + z) + 0.02 * Math.sin(x * 4.1 - z * 2.3);
  h -= 0.55 * Math.exp(-(((z + 2.9) / 0.45) ** 2)); // river channel along the back
  const inB = smoothstep(BASIN.x0, BASIN.x0 + 0.25, x) * (1 - smoothstep(BASIN.x1 - 0.25, BASIN.x1, x)) * smoothstep(BASIN.z0, BASIN.z0 + 0.25, z) * (1 - smoothstep(BASIN.z1 - 0.25, BASIN.z1, z));
  h -= BASIN.depth * inB;
  const canal = Math.exp(-(((x - 1.4) / 0.16) ** 2)) * smoothstep(-2.5, -2.2, z) * (1 - smoothstep(BASIN.z0 + 0.1, BASIN.z0 + 0.3, z));
  h -= 0.18 * canal;
  return h;
}

export async function createRecharge(pipe) {
  const scene = new THREE.Scene();
  scene.background = C.bg.clone();
  const topMat = clay(C.subject.clone().lerp(C.green, 0.32), 0.82);
  const layers = [
    { depth: 0.35, color: new THREE.Color('#4A4540') },
    { depth: 1.2, color: new THREE.Color('#7A736B') },
    { depth: 99, color: C.subject.clone().multiplyScalar(0.7) },
  ];
  const block = heightBlock({ sx: SX, sz: SZ, nx: 150, nz: 100, height: ground, base: BASE, topMat, layers });
  const SU = block.sideMat.userData.U;
  scene.add(block.group);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), clay(C.bg.clone().multiplyScalar(1.15), 0.95));
  table.rotation.x = -Math.PI / 2; table.position.y = BASE - 0.04; table.receiveShadow = true;
  scene.add(table);

  // River (high water), headgate, canal and the recharge basin
  const riverW = new THREE.Mesh(new THREE.BoxGeometry(SX - 0.02, 0.5, 0.95), water());
  riverW.position.set(0, 0.2, -2.9);
  const gateMat = clay(new THREE.Color('#D3D6D9'), 0.6);
  const gate = new THREE.Group();
  const gl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.45), gateMat); gl.position.set(-0.28, 0.5, 0);
  const gr = gl.clone(); gr.position.x = 0.28;
  const gtop = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.5), gateMat); gtop.position.y = 0.82;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.06), clay(new THREE.Color('#5A6068'), 0.6));
  gate.add(gl, gr, gtop, door);
  gate.position.set(1.4, 0, -2.25);
  gate.children.forEach((c) => (c.castShadow = true));
  const canalW = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, BASIN.z0 + 2.3), water());
  canalW.position.set(1.4, 0.36, (-2.2 + BASIN.z0 + 0.1) / 2);
  const basinW = new THREE.Mesh(new THREE.BoxGeometry(BASIN.x1 - BASIN.x0 - 0.3, 0.04, BASIN.z1 - BASIN.z0 - 0.3), water(C.water.clone().lerp(C.green, 0.25)));
  basinW.position.set((BASIN.x0 + BASIN.x1) / 2, 0.2, (BASIN.z0 + BASIN.z1) / 2);
  scene.add(riverW, gate, canalW, basinW);

  // Town mid-cleanup: mud lines, sandbags, a dumpster (no people)
  const mats = { body: clay(new THREE.Color('#C9CED3'), 0.7), roof: clay(C.subject.clone().multiplyScalar(0.55), 0.7), win: clay(new THREE.Color('#2B2E33'), 0.6), mud: clay(new THREE.Color('#6B655D'), 0.9) };
  [[-4.6, -0.6], [-3.0, 1.2], [-4.9, 2.4]].forEach(([x, z], i) => {
    const h = house({ ...mats, w: 1.1, h: 0.8, d: 1.0, mudH: 0.22 });
    h.position.set(x, ground(x, z), z);
    h.rotation.y = i === 1 ? -0.3 : 0.2;
    scene.add(h);
  });
  const bagMat = clay(new THREE.Color('#A39D92'), 0.9);
  const bagGeo = new THREE.CapsuleGeometry(0.06, 0.16, 4, 8);
  for (let k = 0; k < 14; k++) {
    const b = new THREE.Mesh(bagGeo, bagMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(-3.8 + (k % 7) * 0.2, ground(-3.4, 0.4) + 0.07 + Math.floor(k / 7) * 0.11, 0.35);
    b.castShadow = true;
    scene.add(b);
  }
  const dumpster = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), clay(new THREE.Color('#5A6068'), 0.7));
  dumpster.position.set(-2.1, ground(-2.1, -0.2) + 0.18, -0.2);
  dumpster.castShadow = true;
  scene.add(dumpster);
  const r = rng(77);
  const crown = clay(C.subject.clone().lerp(C.green, 0.55), 0.8), trunk = clay(new THREE.Color('#4E4A45'), 0.85);
  for (let i = 0; i < 12; i++) {
    const x = -5.6 + r() * 11, z = -1.8 + r() * 0.5 + (r() < 0.5 ? 0 : 5.0);
    if (x > BASIN.x0 - 0.3 && x < BASIN.x1 + 0.3 && z > BASIN.z0 - 0.3) continue;
    const t = tree(crown, trunk, 0.8 + r() * 0.4);
    t.position.set(x, ground(x, z), z);
    scene.add(t);
  }
  // Clouds part to either side
  const cloudMat = clay(new THREE.Color('#AEB6BF'), 0.95);
  const clouds = [[-1.5, 6.0, -1, 1.5, 21, -1], [1.8, 6.4, 0.5, 1.6, 22, 1], [-0.2, 6.8, 2.5, 1.2, 23, -1]].map(([x, y, z, s, seed, dir]) => {
    const c = cloud(cloudMat, seed, s); c.position.set(x, y, z); c.userData = { x, dir }; scene.add(c); return c;
  });

  const lights = rig(scene, pipe.renderer, { size: 9, dist: 30, intensity: 2.5 });
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 400);
  const A = { pos: [-0.8, 10.5, 17.0], target: [-0.3, 0.0, 0.4], lens: 35 };
  const B = { pos: [2.4, 0.9, 12.0], target: [2.5, -0.9, 4.0], lens: 50 };

  function frame(f) {
    const s = move(f, 1370, 1436, A, B, { via: [1.6, 6.5, 16.0] });
    applyCam(cam, s);
    const warm = ease.inOutSine(prog(f, 1322, 1370));
    lights.follow(new THREE.Vector3(0, 0, 0.5), 9);
    lights.warmth(warm);
    // Gate opens, canal and basin fill, then the groundwater plume spreads below
    door.position.y = lerp(0.5, 0.95, ease.inOutCubic(prog(f, 1328, 1350)));
    canalW.scale.y = smoothstep(1340, 1352, f) + 1e-3;
    basinW.position.y = lerp(0.2 - BASIN.depth + 0.05, 0.48, ease.inOutSine(prog(f, 1345, 1400)));
    const plume = ease.inOutSine(prog(f, 1372, 1434));
    SU.uPlume.value.set((BASIN.x0 + BASIN.x1) / 2, ground(2.5, 3.9) - 0.35 - plume * 0.55, 0, lerp(0.01, 1.25, plume));
    SU.uWet.value = 0.0;
    SU.uTable.value = lerp(BASE + 0.25, -2.0, ease.inOutSine(prog(f, 1380, 1436)));
    SU.uPoreCol.value.copy(C.water).lerp(C.green, 0.5);
    clouds.forEach((c) => {
      const t = ease.inOutSine(prog(f, 1322, 1420));
      c.position.x = c.userData.x + c.userData.dir * t * 6;
      c.scale.setScalar(c.scale.x);
    });
    return { scene, camera: cam, labels: null, bloom: 0.25, exposure: lerp(1.0, 1.06, warm) };
  }
  return { scene, frame };
}
