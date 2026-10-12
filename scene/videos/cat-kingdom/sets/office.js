// Beat 1 (and the room for beat 2): the governor's office in the Capitol, cut away like a dolls' house.
// The only sunlight comes through one tall window and lands on the governor's chair, where a ginger cat sits.
// A staffer waits patiently with a folder. The paw seal hangs on the wall.
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { bookshelf, cardboardBox, deskLamp, desk, framedPicture, governorChair, mesh, paperStack, pawFlag, pawSeal, plant, rbox, rubberStamp } from '../lib/props.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { ease, prog, rng, smoothstep } from '../../../src/core/util.js';

const FPS = 30;
const ROOM = { x0: -3.2, x1: 3.4, z0: -3.0, z1: 2.4, h: 3.7 };
const WIN = { z0: 0.1, z1: 2.1, y0: 0.55, y1: 3.25 };

/** Wooden parquet floor: planks drawn in the shader from world position (no textures). */
function parquet() {
  const m = clay(S.wood, 0.62);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP;
        float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float row = floor(vWP.z / 0.16);
        float off = h1(row) * 1.3;
        float col = floor((vWP.x + off) / 1.3);
        float k = 0.9 + 0.16 * h1(row * 17.0 + col * 3.1);
        vec2 f = vec2(fract((vWP.x + off) / 1.3) * 1.3, fract(vWP.z / 0.16) * 0.16);
        float gap = min(min(f.x, 1.3 - f.x), min(f.y, 0.16 - f.y));
        float line = smoothstep(0.0025, 0.006, gap);
        float grain = 0.97 + 0.03 * sin(vWP.x * 60.0 + h1(row) * 9.0);
        diffuseColor.rgb *= k * grain * mix(0.72, 1.0, line);`);
  };
  return m;
}

/** A wall with a rectangular opening, built from boxes, plus a moulded window frame. */
function wallWithWindow(mat, frameMat) {
  const g = new THREE.Group();
  const t = 0.24, x = ROOM.x0 - t / 2, zLen = ROOM.z1 - ROOM.z0;
  const box = (z0, z1, y0, y1) => g.add(mesh(new THREE.BoxGeometry(t, y1 - y0, z1 - z0), mat, { pos: [x, (y0 + y1) / 2, (z0 + z1) / 2] }));
  box(ROOM.z0, WIN.z0, 0, ROOM.h);
  box(WIN.z1, ROOM.z1, 0, ROOM.h);
  box(WIN.z0, WIN.z1, 0, WIN.y0);
  box(WIN.z0, WIN.z1, WIN.y1, ROOM.h);
  // frame, sill and mullions (they cast the window-pane shadow into the sun patch)
  const fz = (WIN.z0 + WIN.z1) / 2, fw = WIN.z1 - WIN.z0, fh = WIN.y1 - WIN.y0;
  g.add(mesh(rbox(0.1, 0.08, fw + 0.22, 0.02), frameMat, { pos: [x + 0.1, WIN.y0 - 0.02, fz] }));
  for (const s of [-1, 1]) g.add(mesh(rbox(0.06, fh + 0.1, 0.09, 0.015), frameMat, { pos: [x + 0.07, (WIN.y0 + WIN.y1) / 2, fz + s * (fw / 2 + 0.03)] }));
  g.add(mesh(rbox(0.06, 0.09, fw + 0.1, 0.015), frameMat, { pos: [x + 0.07, WIN.y1 + 0.03, fz] }));
  g.add(mesh(new THREE.BoxGeometry(0.04, fh, 0.04), frameMat, { pos: [x, (WIN.y0 + WIN.y1) / 2, fz] }));
  for (const y of [WIN.y0 + fh * 0.36, WIN.y0 + fh * 0.7]) g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, fw), frameMat, { pos: [x, y, fz] }));
  void zLen;
  return g;
}

/** Soft additive shaft of sunlight from the window to the floor, with a few slow dust motes. */
function lightShaft(dir) {
  const corners = [[WIN.z0, WIN.y0], [WIN.z1, WIN.y0], [WIN.z1, WIN.y1], [WIN.z0, WIN.y1]].map(([z, y]) => new THREE.Vector3(ROOM.x0 - 0.05, y, z));
  const d = dir.clone().negate(); // direction the light travels
  const far = corners.map((c) => c.clone().addScaledVector(d, c.y / -d.y));
  const pos = [], uv = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], a2 = far[i], b2 = far[(i + 1) % 4];
    pos.push(...a.toArray(), ...b.toArray(), ...b2.toArray(), ...a.toArray(), ...b2.toArray(), ...a2.toArray());
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: tone(C.gold, 1.0) }, uK: { value: 0.14 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uK; varying vec2 vUv;
      void main(){ float a = pow(sin(3.14159 * vUv.x), 1.5) * (1.0 - 0.75 * vUv.y) * smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(uCol * a * uK, 1.0); }`,
  });
  mat.toneMapped = false;
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 5;
  return m;
}

/** Cheap ambient occlusion for the room: surfaces darken softly towards the floor and into the back-left corner. */
function occluded(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float occ = mix(0.62, 1.0, smoothstep(0.0, 0.9, vWP.y)) * mix(0.7, 1.0, smoothstep(0.0, 1.2, vWP.x - ${ROOM.x0.toFixed(2)})) * mix(0.72, 1.0, smoothstep(0.0, 1.0, vWP.z - ${ROOM.z0.toFixed(2)}));
        reflectedLight.indirectDiffuse *= occ;`);
  };
  return mat;
}

export async function createOffice(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.2 });
  const plaster = occluded(clay(tone(C.cream, 0.9), 0.85)), wainscot = occluded(clay(tone(C.cream, 0.8), 0.75)), trim = clay(tone(C.cream, 1, 0.25), 0.6);

  // ---------- the room shell (floor slab with a visible cut edge, two walls; front and right open)
  const room = new THREE.Group();
  scene.add(room);
  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, cx = (ROOM.x0 + ROOM.x1) / 2, cz = (ROOM.z0 + ROOM.z1) / 2;
  room.add(mesh(new THREE.BoxGeometry(W, 0.02, D), parquet(), { pos: [cx, -0.01, cz] }));
  room.add(mesh(rbox(W + 0.24, 0.32, D + 0.02, 0.03), clay(tone(C.cream, 0.9), 0.8), { pos: [cx - 0.12, -0.18, cz] }));
  // back wall with wainscot, chair rail, crown moulding and pilasters
  room.add(mesh(new THREE.BoxGeometry(W + 0.24, ROOM.h, 0.24), plaster, { pos: [cx - 0.12, ROOM.h / 2, ROOM.z0 - 0.12] }));
  room.add(mesh(new THREE.BoxGeometry(W, 1.0, 0.03), wainscot, { pos: [cx, 0.5, ROOM.z0 + 0.015] }));
  room.add(mesh(rbox(W, 0.07, 0.06, 0.02), trim, { pos: [cx, 1.02, ROOM.z0 + 0.03] }));
  room.add(mesh(rbox(W, 0.16, 0.1, 0.03), trim, { pos: [cx, ROOM.h - 0.08, ROOM.z0 + 0.05] }));
  room.add(mesh(rbox(W, 0.12, 0.05, 0.02), trim, { pos: [cx, 0.06, ROOM.z0 + 0.025] }));
  for (const x of [-1.55, 1.25]) room.add(mesh(rbox(0.3, ROOM.h - 0.2, 0.08, 0.02), trim, { pos: [x, (ROOM.h - 0.2) / 2, ROOM.z0 + 0.04] }));
  // wainscot panels
  for (let x = ROOM.x0 + 0.5; x < ROOM.x1 - 0.4; x += 0.75) room.add(mesh(rbox(0.6, 0.62, 0.02, 0.01), clay(tone(C.cream, 0.9), 0.75), { pos: [x + 0.3, 0.52, ROOM.z0 + 0.04], cast: false }));
  // left wall with the window
  room.add(wallWithWindow(plaster, trim));
  room.add(mesh(new THREE.BoxGeometry(0.03, 1.0, D), wainscot, { pos: [ROOM.x0 + 0.015, 0.5, cz] }));
  room.add(mesh(rbox(0.06, 0.07, D, 0.02), trim, { pos: [ROOM.x0 + 0.03, 1.02, cz] }));
  room.add(mesh(rbox(0.1, 0.16, D, 0.03), trim, { pos: [ROOM.x0 + 0.05, ROOM.h - 0.08, cz] }));

  // Invisible shadow casters: a ceiling and the outside of the building, so sun only enters by the window
  const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  room.add(mesh(new THREE.BoxGeometry(8, 0.2, 14), ghost, { pos: [ROOM.x0 - 0.24 + 4, ROOM.h + 0.1, 2], receive: false }));
  room.add(mesh(new THREE.BoxGeometry(0.2, ROOM.h, 8), ghost, { pos: [ROOM.x0 - 0.15, ROOM.h / 2, ROOM.z1 + 4], receive: false }));

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
  napper.group.position.set(2.3, 2.3 * 5 / 5 - 0.0 + 0.0, ROOM.z0 + 0.22);
  napper.group.position.y = 0.05 + (5 * (2.3 - 0.1)) / 5 + 0.02;
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
  const shaft = lightShaft(lights.keyDir);
  scene.add(shaft);

  // dust motes drifting in the beam
  const R = rng(21), N = 70, seeds = [];
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) seeds.push([R(), R(), R(), R()]);
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: 5.0 * pipe.dpr }, uCol: { value: tone(C.gold, 1.0, 0.3) } },
    vertexShader: 'uniform float uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * 3.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol * (1.0 - smoothstep(0.2, 0.5, d)) * 0.35, 1.0); }',
  });
  dm.toneMapped = false;
  const dust = new THREE.Points(dg, dm);
  scene.add(dust);
  const travel = lights.keyDir.clone().negate();
  function updateDust(t) {
    for (let i = 0; i < N; i++) {
      const [a, b, c, d] = seeds[i];
      const y = WIN.y0 + (WIN.y1 - WIN.y0) * b;
      const s = (0.15 + 0.85 * ((a + t * 0.012 * (0.5 + d)) % 1)) * (y / -travel.y);
      const p = new THREE.Vector3(ROOM.x0, y, WIN.z0 + (WIN.z1 - WIN.z0) * c).addScaledVector(travel, s);
      p.y += Math.sin(t * 0.4 + d * 20) * 0.04;
      dp.set([p.x, p.y, p.z], i * 3);
    }
    dg.attributes.position.needsUpdate = true;
  }

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
      updateDust(t);
      return { scene, camera: cam, bloom: 0.22, exposure: 1.0, vignette: 0.22 };
    },
  };
}
