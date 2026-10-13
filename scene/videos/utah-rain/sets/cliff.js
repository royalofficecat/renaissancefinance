// Beat 4: a miniature Zion cliff, a curved alcove like the Emerald Pools. Ribbon waterfalls pour off the sandstone rim, tiny plants push out of
// the ledges, and a still pool at the foot mirrors the wall and the storm clouds above it.
// The wall is red below and pale cream above (like Zion's Kayenta and Navajo sandstone), about 13 units
// tall (1 unit = about 60 m, so the wall reads as half a mile). The reflection is a mirrored copy of the
// set seen through the pool's surface (no extra render pass, identical on every frame).
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone, water } from '../look.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { ease, prog, rng, smoothstep } from '../../../src/core/util.js';
import { cloudBank, flowSheet, growTuft, rainField, sandstone, splashRings, tuft } from '../lib/rock.js';

const FPS = 30;
const B0 = 420; // beat start
const RIM = 12.6;
const FALLS = [{ x: -3.4, w: 0.5, d: 0.2 }, { x: 0.4, w: 0.75, d: 0.0 }, { x: 3.6, w: 0.42, d: 0.45 }, { x: 6.6, w: 0.3, d: 0.7 }];

// The cliff face: z (towards the camera) as a function of x and height y
function wallZ(x, y) {
  let z = Math.max(0, 1.6 - y) * 0.9; // talus at the foot
  for (const [ly, k] of [[3.1, 0.38], [6.2, 0.3], [9.4, 0.22]]) z -= k * smoothstep(ly, ly + 0.18, y); // ledges
  z += 0.05 * Math.sin(x * 1.1 + 0.6 * Math.sin(y * 0.5)) + 0.04 * Math.sin(x * 2.9 + y * 1.7) + 0.05 * Math.sin(y * 3.3 + x);
  for (const bx of [-5.3, -1.6, 2.0, 5.1]) z += 0.75 * Math.exp(-(((x - bx) / 1.0) ** 2)) * smoothstep(0.4, 1.6, y) * (1 - 0.3 * smoothstep(9, 12.6, y)); // buttresses
  for (const f of FALLS) z -= 0.9 * Math.exp(-(((x - f.x) / 0.7) ** 2)) * smoothstep(0.5, 2.5, y); // an alcove behind each fall
  return z;
}

// The wall curves round the pool: u runs along the wall, `out` is the distance in front of the face.
const CZ = 3.2, RAD = 8.5;
const bend = (u, y, out) => {
  const a = u / RAD, r = RAD - out;
  return new THREE.Vector3(Math.sin(a) * r, y, CZ - Math.cos(a) * r);
};

export async function createCliff(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { mirror: true });
  scene.fog = new THREE.Fog(tone(C.storm, 1.5), 22, 60);
  const R = rng(4);
  const world = new THREE.Group(); // everything that the pool reflects
  scene.add(world);

  // ---------- the wall: a sheet that rises up the cliff, rounds over the rim and runs back as the plateau
  const W = 18, NU = 240, NV = 260, VMAX = 19;
  const geo = new THREE.PlaneGeometry(W, VMAX, NU, NV);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), v = P.getY(i) + VMAX / 2;
    if (v <= RIM) P.setXYZ(i, ...bend(x, v, wallZ(x, v)).toArray());
    else {
      const b = v - RIM;
      const dome = 0.9 * Math.max(0, Math.sin(x * 0.7 + 0.4) * Math.sin(b * 0.6)) * smoothstep(1.5, 3.5, b);
      // the fall notches cut into the lip
      let notch = 0;
      for (const f of FALLS) notch += 0.35 * Math.exp(-(((x - f.x) / (f.w + 0.3)) ** 2)) * Math.exp(-b * 0.8);
      P.setXYZ(i, ...bend(x, RIM + 0.55 * (1 - Math.exp(-b * 2.2)) + dome - notch, wallZ(x, RIM) - b * 2.0).toArray());
    }
  }
  geo.computeVertexNormals();
  const rock = sandstone({ capFrom: 6.6, capTo: 7.4, bands: 5.5 });
  const wall = new THREE.Mesh(geo, rock);
  wall.castShadow = wall.receiveShadow = true;
  world.add(wall);

  // ---------- waterfalls: free-hanging sheets from the rim notches to the talus
  const falls = FALLS.map((f) => {
    let zmax = -1e9;
    for (let y = 1.2; y < RIM; y += 0.1) for (let dx = -f.w; dx <= f.w; dx += 0.05) zmax = Math.max(zmax, wallZ(f.x + dx, y));
    const g = new THREE.PlaneGeometry(f.w, RIM + 0.3, 1, 60);
    const gp = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < gp.count; i++) {
      const y = gp.getY(i) + (RIM + 0.3) / 2 + 0.6;
      const lip = smoothstep(RIM - 0.6, RIM + 0.3, y);
      const sway = 0.06 * Math.sin(y * 0.9 + f.x);
      gp.setXYZ(i, ...bend(f.x + gp.getX(i) * (1 + 0.5 * (1 - y / RIM)) + sway, y, zmax + 0.16 + 0.12 * (1 - lip) - lip * 0.5).toArray());
      uv.setY(i, 1 - uv.getY(i)); // v = 0 at the top: the sheet reveals downwards
    }
    const m = flowSheet({ speed: 3.2, streakScale: [6, 9], opacity: 0.95 });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 2;
    world.add(mesh);
    // cascade down the talus into the pool
    const cg = new THREE.PlaneGeometry(f.w * 1.8, 1, 1, 20);
    const cp = cg.attributes.position, cuv = cg.attributes.uv;
    for (let i = 0; i < cp.count; i++) {
      const s = 0.5 - cp.getY(i); // 0 at the top
      const y = 1.25 * (1 - s) + 0.02, z = zmax + 0.2 + s * 1.9;
      cp.setXYZ(i, ...bend(f.x + cp.getX(i) * (1 + s), y, z).toArray());
      cuv.setY(i, s);
    }
    const cm = flowSheet({ speed: 2.0, streakScale: [5, 4], opacity: 0.9 });
    const cmesh = new THREE.Mesh(cg, cm);
    cmesh.renderOrder = 2;
    world.add(cmesh);
    return { ...f, m, cm, zmax };
  });

  // ---------- green on the ledges and the talus
  const tufts = [];
  for (let i = 0; i < 34; i++) {
    const ledge = [3.1, 6.2, 9.4, 0.4][i % 4];
    const x = (R() - 0.5) * 12;
    const y = ledge === 0.4 ? 0.2 + R() * 1.1 : ledge + 0.2;
    const t = tuft(R, bend(x, y, wallZ(x, y) + 0.06), 0.07 + R() * 0.08);
    t.userData.d = 2.0 + R() * 1.8;
    world.add(t);
    tufts.push(t);
  }

  // ---------- storm clouds: a low bank and a towering head behind the rim
  const clouds = cloudBank(R, { count: 22, spread: [34, 2, 14], at: [0, 17.5, -10], size: [1.6, 3.4] });
  const tower = cloudBank(R, { count: 9, spread: [8, 6, 4], at: [-3, 22, -16], size: [3, 5] });
  world.add(clouds, tower);

  // ---------- the mirrored world under the pool, and the ground with the pool cut out of it
  const mirror = world.clone();
  mirror.scale.y = -1;
  scene.add(mirror);
  const POOL = { x: 0.3, z: 0.4, rx: 5.2, rz: 2.6 };
  const GU = { uPool: { value: new THREE.Vector4(POOL.x, POOL.z, POOL.rx, POOL.rz) }, uSand: { value: mixc(S.cream, S.red, 0.4) }, uWet: { value: 0 } };
  const gmat = clay(0xffffff, 0.9);
  gmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGP; uniform vec4 uPool; uniform vec3 uSand; uniform float uWet;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float e = length((vGP.xz - uPool.xy) / uPool.zw);
        if (e < 1.0) discard;
        float rim = 1.0 - smoothstep(1.0, 1.12, e);
        vec3 c = uSand * (0.9 + 0.1 * fract(sin(dot(floor(vGP.xz * 14.0), vec2(12.9898, 78.233))) * 43758.5));
        c *= 1.0 - 0.25 * uWet - 0.25 * rim;
        diffuseColor.rgb = c;`);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2), gmat);
  ground.position.z = 10;
  ground.receiveShadow = true;
  scene.add(ground);
  const pmat = water(tone(C.water, 0.5), { roughness: 0.06, transparent: true, opacity: 0.42, reflect: 0.5, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), pmat);
  pool.scale.set(POOL.rx, 1, POOL.rz);
  pool.position.set(POOL.x, 0.003, POOL.z);
  pool.renderOrder = 5;
  scene.add(pool);
  const rings = splashRings(scene, R, 40, () => {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.9;
    return [POOL.x + Math.cos(a) * r * POOL.rx, 0.006, POOL.z + Math.sin(a) * r * POOL.rz];
  }, { r0: 0.05, r1: 0.075 });

  const rain = rainField(scene, R, { n: 2000, w: 14, h: 12, d: 16, len: 0.4, opacity: 0.26 });
  const lights = rig(scene, pipe.renderer, { size: 16, dist: 40, intensity: 2.6, keyDir: [-0.72, 0.5, 0.48], rimDir: [0.6, 0.5, -0.8], fillK: 0.55 });
  lights.follow(new THREE.Vector3(0, 6, 0), 14);

  const cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.05, 400);
  // Crane up the cliff: from the pool and the foot of the falls to the rim where they pour over
  const A = { pos: [-4.8, 3.6, 15.5], target: [0.3, 4.6, -2.5], lens: 35 };
  const B = { pos: [-5.0, 9.6, 22.5], target: [0.4, 10.6, -3.0], lens: 35 };

  return {
    frame(f) {
      const t = f / FPS, bt = (f - B0) / FPS;
      applyCam(cam, move(f, B0 + 20, B0 + 102, A, B, { fn: ease.inOutSine }));
      rock.userData.U.uWet.value = 1;
      GU.uWet.value = 1;
      for (const fl of falls) {
        const p = ease.inOutSine(prog(bt, fl.d - 0.1, fl.d + 1.2));
        fl.m.userData.U.uProgress.value = 0.08 + 1.0 * p;
        fl.m.userData.U.uT.value = t;
        fl.cm.userData.U.uProgress.value = prog(bt, fl.d + 0.9, fl.d + 1.6) * 1.05;
        fl.cm.userData.U.uT.value = t;
      }
      tufts.forEach((tf, i) => { growTuft(tf, bt, tf.userData.d); mirror.children[world.children.indexOf(tf)].scale.copy(tf.scale); void i; });
      clouds.position.x = tower.position.x = t * 0.12;
      mirror.children[world.children.indexOf(clouds)].position.x = clouds.position.x;
      mirror.children[world.children.indexOf(tower)].position.x = tower.position.x;
      rain.update(t, 1, { x: cam.position.x * 0.5, z: cam.position.z - 12 }, Math.max(0, cam.position.y - 6));
      rings(t, 1);
      return { scene, camera: cam, bloom: 0.25, exposure: 1.0, vignette: 0.3 };
    },
  };
}
