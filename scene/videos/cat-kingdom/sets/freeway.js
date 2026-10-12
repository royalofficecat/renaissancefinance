// Beat 6: Los Angeles. A freeway interchange rebuilt as a toy diorama: the decks on top are ribbons of
// gardens with sun-warmed cushions and cats; the columns are wrapped in sisal (scratching posts);
// small blue human cars still run on the freeway below, between two tunnel portals.
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { cushion, mesh, palmTree, rbox, shrub, sisalMaterial, sweepProfile, toyCar } from '../lib/props.js';
import { applyCam, orbit } from '../../../src/core/camera.js';
import { ease, rng } from '../../../src/core/util.js';

const FPS = 30;
const HALF = 11; // the base plate runs from -11 to 11 on both axes
const ROAD = 1.9; // freeway half-width (z)

/** Ground surface: cream earth, soft lawns, the freeway and its light-blue dashed lanes (the human service network). */
function groundMaterial() {
  const m = clay(tone(C.cream, 0.92), 0.85);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP;
        uniform vec3 uRoad, uGrass, uDash, uShoulder;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float z = abs(vWP.z);
        vec3 c = diffuseColor.rgb;
        // lawns: soft-edged patches away from the road
        float lawn = smoothstep(2.6, 3.0, z) * (0.5 + 0.5 * sin(vWP.x * 0.35 + 1.0) * cos(vWP.z * 0.3));
        c = mix(c, uGrass, smoothstep(0.35, 0.45, lawn));
        float road = 1.0 - smoothstep(${ROAD.toFixed(2)} - 0.01, ${ROAD.toFixed(2)} + 0.01, z);
        float shoulder = (1.0 - smoothstep(${(ROAD + 0.3).toFixed(2)} - 0.01, ${(ROAD + 0.3).toFixed(2)} + 0.01, z)) * (1.0 - road);
        c = mix(c, uShoulder, shoulder);
        c = mix(c, uRoad, road);
        // dashed lane lines (light blue) and solid edge lines
        float lane = 1.0 - smoothstep(0.035, 0.05, abs(z - 0.9));
        float dash = step(0.45, fract(vWP.x / 1.6));
        float edge = 1.0 - smoothstep(0.035, 0.05, abs(z - ${(ROAD - 0.12).toFixed(2)}));
        c = mix(c, uDash, (lane * dash + edge) * road);
        diffuseColor.rgb = c;`);
    Object.assign(sh.uniforms, {
      uRoad: { value: mixc(tone(C.blue, 0.42), tone(C.cream, 0.45), 0.35) }, uGrass: { value: tone(C.green, 0.95) },
      uDash: { value: tone(C.blue, 1, 0.55) }, uShoulder: { value: tone(C.cream, 0.8) },
    });
  };
  return m;
}

/** Grass with a little mottling, for the deck gardens. */
function gardenMaterial() {
  const m = clay(S.green, 0.82);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = sin(vWP.x * 7.1 + sin(vWP.z * 5.3)) * sin(vWP.z * 6.7 + sin(vWP.x * 4.1));
        diffuseColor.rgb *= 0.92 + 0.1 * n;`);
  };
  return m;
}

export async function createFreeway(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.35, horizon: tone(C.blue, 1, 0.32), top: tone(C.blue, 0.92) });
  scene.fog = new THREE.Fog(tone(C.blue, 1, 0.5), 40, 160);
  const R = rng(66);

  // ---------- base plate
  const plate = new THREE.Group();
  scene.add(plate);
  plate.add(mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2, 1, 1).rotateX(-Math.PI / 2), groundMaterial(), {}));
  plate.add(mesh(rbox(HALF * 2 + 0.3, 0.7, HALF * 2 + 0.3, 0.12), clay(tone(C.cream, 0.78), 0.85), { pos: [0, -0.36, 0] }));
  plate.add(mesh(rbox(HALF * 2 + 0.34, 0.12, HALF * 2 + 0.34, 0.05), clay(S.terraDark, 0.7), { pos: [0, -0.62, 0], cast: false }));
  // median barrier
  plate.add(mesh(rbox(HALF * 2 - 3.2, 0.22, 0.16, 0.05), clay(tone(C.cream, 1, 0.1), 0.7), { pos: [0, 0.11, 0] }));

  // tunnel portals at both ends: grassy cut-and-cover boxes the cars drive into
  for (const s of [-1, 1]) {
    const tg = new THREE.Group();
    tg.add(mesh(rbox(1.6, 1.5, ROAD * 2 + 1.4, 0.1), clay(tone(C.cream, 0.95), 0.8), { pos: [0, 0.75, 0] }));
    tg.add(mesh(rbox(1.7, 0.25, ROAD * 2 + 1.6, 0.1), gardenMaterial(), { pos: [0, 1.58, 0] }));
    // dark tunnel mouths on the face towards the middle of the plate
    for (const z of [-0.9, 0.9]) tg.add(mesh(rbox(0.06, 0.95, 1.5, 0.02), clay(tone(C.blue, 0.3), 0.9), { pos: [-s * 0.79, 0.5, z], cast: false }));
    tg.position.set(s * (HALF - 0.8), 0, 0);
    plate.add(tg);
  }

  // ---------- cars on the human freeway (they wrap around inside the tunnels)
  const cars = [];
  const carCols = [S.blue, tone(C.blue, 1, 0.35), tone(C.cream, 1, 0.3), tone(C.cream, 1, 0.3), tone(C.blue, 1, 0.55)];
  for (const [lane, dir] of [[-1.35, -1], [-0.45, -1], [0.45, 1], [1.35, 1]]) {
    const n = 8, speed = 2.1 + R() * 0.6;
    for (let i = 0; i < n; i++) {
      const car = toyCar({ color: carCols[Math.floor(R() * carCols.length)], scale: 0.7 });
      car.rotation.y = dir > 0 ? 0 : Math.PI;
      scene.add(car);
      cars.push({ car, lane, dir, speed, x0: (i / n) * (HALF * 2 - 1.6) + R() * 1.2 });
    }
  }
  const L = HALF * 2 - 1.6;
  function updateCars(t) {
    for (const c of cars) {
      const x = (((c.x0 + c.speed * t) % L) + L) % L - L / 2;
      c.car.position.set(c.dir * x, 0, c.lane);
      c.car.visible = Math.abs(x) < L / 2 - 0.2;
    }
  }

  // ---------- the garden decks
  const deckMat = clay(tone(C.cream, 0.97), 0.78), underMat = clay(tone(C.cream, 0.74), 0.85), parapetMat = clay(tone(C.cream, 1, 0.18), 0.7);
  const garden = gardenMaterial(), post = sisalMaterial();
  const W = 2.5, TH = 0.42;
  const deckDefs = [
    { pts: [[-2.4, 2.3, -HALF], [-1.0, 2.3, -4.5], [0.4, 2.3, 0], [1.4, 2.3, 4.5], [2.6, 2.3, HALF]] },
    { pts: [[-HALF, 3.3, 7.5], [-5.5, 3.7, 4.6], [0, 3.8, 1.6], [5.5, 3.7, -2.5], [HALF, 3.3, -5.2]] },
    { pts: [[HALF, 5.1, 6.0], [5.0, 5.3, 4.8], [0.0, 5.3, -3.6], [-5.0, 5.2, -7.2], [-HALF + 1.2, 5.0, -HALF]] },
  ];
  const decks = deckDefs.map((d) => {
    const curve = new THREE.CatmullRomCurve3(d.pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const g = new THREE.Group();
    g.add(mesh(sweepProfile(curve, [[-W / 2, -TH], [W / 2, -TH], [W / 2, 0], [-W / 2, 0]], 160), deckMat, {}));
    g.add(mesh(sweepProfile(curve, [[-W / 2 + 0.05, -TH - 0.06], [W / 2 - 0.05, -TH - 0.06], [W / 2 - 0.05, -TH + 0.02], [-W / 2 + 0.05, -TH + 0.02]], 160), underMat, {}));
    for (const [u0, u1] of [[-W / 2, -W / 2 + 0.16], [W / 2 - 0.16, W / 2]]) g.add(mesh(sweepProfile(curve, [[u0, 0], [u1, 0], [u1, 0.3], [u0, 0.3]], 160), parapetMat, {}));
    g.add(mesh(sweepProfile(curve, [[-0.82, 0], [0.82, 0], [0.82, 0.1], [-0.82, 0.1]], 160), garden, {}));
    scene.add(g);
    // sisal-wrapped columns wherever the deck is clear of the freeway
    const len = curve.getLength(), n = Math.floor(len / 3.4);
    for (let i = 1; i < n; i++) {
      const p = curve.getPointAt(i / n);
      if (Math.abs(p.z) < ROAD + 0.7 || Math.abs(p.x) > HALF - 1 || Math.abs(p.z) > HALF - 1) continue;
      const h = p.y - TH;
      g.add(mesh(new THREE.CylinderGeometry(0.3, 0.34, h, 22), post, { pos: [p.x, h / 2, p.z] }));
      g.add(mesh(rbox(0.9, 0.16, 0.9, 0.05), underMat, { pos: [p.x, h - 0.08, p.z] }));
    }
    return { curve, g, len };
  });

  // Point on a deck: t along it, u across it (-1..1 of the garden), lifted to the garden top
  const onDeck = (d, t, u, lift = 0.1) => {
    const p = d.curve.getPointAt(t), T = d.curve.getTangentAt(t);
    const r = new THREE.Vector3().crossVectors(T, new THREE.Vector3(0, 1, 0)).normalize();
    return { p: p.addScaledVector(r, u).setY(p.y + lift), yaw: Math.atan2(T.x, T.z) };
  };

  // shrubs and little trees along the gardens
  decks.forEach((d, di) => {
    const n = Math.floor(d.len / 1.1);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      if (R() < 0.35) continue;
      const side = i % 2 ? 1 : -1;
      const { p } = onDeck(d, t, side * (0.45 + R() * 0.25));
      if (Math.abs(p.x) > HALF - 0.6 || Math.abs(p.z) > HALF - 0.6) continue;
      const big = R() < 0.25;
      const sh = shrub({ r: big ? 0.42 : 0.22 + R() * 0.12, stem: big ? 0.5 : 0.05, seed: di * 100 + i, dark: R() < 0.4 });
      sh.position.copy(p);
      scene.add(sh);
    }
  });

  // cushions and cats: the resting platforms
  const cats = [];
  const spots = [
    [0, 0.42, 0, 'sprawl', 'ginger'], [0, 0.6, 0, 'loaf', 'cream'], [0, 0.27, 0, 'sit', 'ginger2'],
    [1, 0.48, 0, 'curl', 'ginger'], [1, 0.33, 0, 'sphinx', 'cream'], [1, 0.62, 0, 'sit', 'ginger'], [1, 0.73, 0, 'loaf', 'ginger2'],
    [2, 0.45, 0, 'sprawl', 'cream'], [2, 0.3, 0, 'loaf', 'ginger'], [2, 0.58, 0, 'sit', 'cream'],
  ];
  spots.forEach(([di, t, u, pose, coat], i) => {
    const d = decks[di];
    const { p, yaw } = onDeck(d, t, u, 0.1);
    const cu = cushion({ w: 1.4, d: 1.15, h: 0.17, color: i % 3 === 1 ? tone(C.cream, 1, 0.1) : S.terra, piping: tone(C.cream, 1, 0.2) });
    cu.position.copy(p);
    cu.rotation.y = yaw;
    scene.add(cu);
    const cat = makeCat({ pose, coat, seed: 40 + i, lod: 'lo' });
    cat.group.scale.setScalar(1.05);
    cat.group.position.copy(p).add(new THREE.Vector3(0, 0.17, 0));
    cat.group.rotation.y = yaw + (R() - 0.5) * 1.6 + (i % 2 ? Math.PI : 0);
    scene.add(cat.group);
    cats.push(cat);
  });
  // a cat walking the parapet path, tail up
  {
    const { p, yaw } = onDeck(decks[1], 0.2, 0.0, 0.1);
    const walker = makeCat({ pose: 'stand', coat: 'ginger', seed: 77, lod: 'lo' });
    walker.group.scale.setScalar(1.05);
    walker.group.position.copy(p);
    walker.group.rotation.y = yaw;
    scene.add(walker.group);
    cats.push(walker);
  }

  // two cats on the parapet, watching the traffic below like television
  for (const [t, u, coat, seed] of [[0.47, 1.17, 'ginger', 91], [0.53, 1.17, 'cream', 92]]) {
    const d = decks[0];
    const { p } = onDeck(d, t, u, 0.3);
    const watcher = makeCat({ pose: 'sit', coat, seed, lod: 'lo' });
    watcher.group.scale.setScalar(0.95);
    watcher.group.position.copy(p);
    watcher.group.rotation.y = Math.PI / 2 + (seed % 2 ? 0.5 : -0.4);
    watcher.look(0, 0.45, 0);
    watcher.fixed = true;
    scene.add(watcher.group);
    cats.push(watcher);
  }

  // palm trees
  for (const [x, z, h, s] of [[-8.6, -4.2, 6.2, 3], [-6.2, -8.4, 5.4, 5], [-9.2, 2.6, 6.6, 7], [-8.6, 7.4, 5.2, 9], [4.2, -8.8, 6.0, 13], [8.6, -3.6, 4.6, 15], [9.3, -8.9, 5.6, 17]]) {
    const palm = palmTree({ h, seed: s });
    palm.position.set(x, 0, z);
    scene.add(palm);
  }
  const lights = rig(scene, pipe.renderer, { size: 15, dist: 60, intensity: 5.6, fillK: 0.22, rimK: 0.3 });
  lights.follow(new THREE.Vector3(0, 2, 0), 15);

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.1, 900);
  return {
    frame(f) {
      const t = f / FPS;
      // Beat 6 (660-780): orbit the interchange at 35 mm
      const s = orbit(f, 660, 780, { center: [0, 2.6, 0], a0: 0.52, a1: 0.86, r0: 20.5, r1: 19, h0: 8.6, h1: 7.9, lens0: 35, target: [-0.6, 2.7, 0.4], fn: ease.inOutSine });
      applyCam(cam, s);
      cats.forEach((c, i) => { if (!c.fixed) c.look(Math.sin(t * 0.4 + i) * 0.25, 0.05, 0); else c.look(Math.sin(t * 2.2 + i) * 0.35, 0.45, 0); c.update(t + i * 1.7); });
      updateCars(t);
      return { scene, camera: cam, bloom: 0.2, exposure: 1.0, vignette: 0.24 };
    },
  };
}
