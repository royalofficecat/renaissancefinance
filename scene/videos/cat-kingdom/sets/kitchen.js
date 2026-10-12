// Beat 14 and the end card: one ordinary kitchen, in warm evening lamplight (the story's one lighting change).
// The feline governor nudges a can it cannot open. Its person opens it, absurdly ceremonially. The cat rubs
// against their leg. (Cats and people: together for about 9,500 years.) Then the kitchen dims behind the end card.
import * as THREE from 'three';
import { C, S, clay, glossy, mixc, tone } from '../look.js';
import { rig as baseRig } from '../../../src/core/look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { mesh, plant, rbox } from '../lib/props.js';
import { buildRoom, tiles } from '../lib/room.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng } from '../../../src/core/util.js';

const FPS = 30;
const ROOM = { x0: -3.0, x1: 3.2, z0: -1.9, z1: 2.8, h: 2.9 };
const T0 = 1620;

/** The window at dusk: a sky gradient from deep coastal blue to a warm horizon (light, not a texture). */
function duskWindow(w, h) {
  const g = new THREE.Group();
  const sky = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: tone(C.blue, 0.42) }, uMid: { value: tone(C.blue, 0.75) }, uLow: { value: mixc(C.gold, C.terra, 0.35) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uMid, uLow; varying vec2 vUv;
      void main(){ vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.45, vUv.y)); c = mix(c, uTop, smoothstep(0.45, 1.0, vUv.y));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  sky.toneMapped = true;
  g.add(mesh(new THREE.PlaneGeometry(w, h), sky, { cast: false, receive: false }));
  const trim = clay(tone(C.cream, 1, 0.3), 0.6);
  for (const [x, y, ww, hh] of [[0, h / 2 + 0.04, w + 0.16, 0.08], [0, -h / 2 - 0.05, w + 0.3, 0.1], [-w / 2 - 0.04, 0, 0.08, h], [w / 2 + 0.04, 0, 0.08, h], [0, 0, 0.04, h], [0, 0, w, 0.04]]) g.add(mesh(rbox(ww, hh, 0.06, 0.015), trim, { pos: [x, y, 0.02] }));
  return g;
}

export async function createKitchen(pipe) {
  const scene = new THREE.Scene();
  scene.background = tone(C.blue, 0.3);
  const room = new THREE.Group();
  scene.add(room);
  room.add(buildRoom(ROOM, { windows: [], floor: tiles(tone(C.cream, 0.95), mixc(tone(C.cream, 0.8), C.terra, 0.2), 0.42), wall: tone(C.cream, 0.95), wainscot: null, ghosts: false }).group);
  const R = rng(14);
  const cab = clay(tone(C.cream, 1, 0.25), 0.7), wood = clay(S.wood, 0.55), knob = clay(S.terra, 0.5);

  // ---------- the counter along the back wall, upper cabinets, the window over the sink
  const cz = ROOM.z0 + 0.33;
  room.add(mesh(rbox(5.6, 0.86, 0.62, 0.02), cab, { pos: [0.1, 0.43, cz] }));
  room.add(mesh(rbox(5.7, 0.05, 0.68, 0.015), wood, { pos: [0.1, 0.885, cz + 0.02] }));
  for (let i = 0; i < 7; i++) {
    const x = -2.45 + i * 0.8;
    room.add(mesh(rbox(0.74, 0.7, 0.02, 0.01), clay(tone(C.cream, 1, 0.35), 0.7), { pos: [x, 0.42, cz + 0.315], cast: false }));
    room.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), knob, { pos: [x + 0.27, 0.62, cz + 0.34], cast: false }));
  }
  for (const x of [-1.9, -1.1, 1.3, 2.1]) {
    room.add(mesh(rbox(0.76, 0.7, 0.36, 0.02), cab, { pos: [x, 2.05, ROOM.z0 + 0.18] }));
    room.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), knob, { pos: [x + 0.28, 1.8, ROOM.z0 + 0.37], cast: false }));
  }
  const win = duskWindow(1.1, 0.95);
  win.position.set(0.1, 1.55, ROOM.z0 + 0.01);
  room.add(win);
  room.add(mesh(rbox(0.7, 0.04, 0.42, 0.06), clay(tone(C.cream, 0.7), 0.3), { pos: [0.1, 0.9, cz + 0.02], cast: false }));
  room.add(mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI), clay(tone(C.cream, 0.75), 0.3), { pos: [0.1, 1.0, cz - 0.17] }));
  // counter things: kettle, fruit bowl, herbs
  room.add(mesh(new THREE.SphereGeometry(0.14, 20, 14).scale(1, 0.9, 1), clay(tone(C.blue, 1, 0.3), 0.4), { pos: [-1.4, 1.03, cz] }));
  const fruitBowl = new THREE.Group();
  fruitBowl.add(mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), clay(S.terra, 0.6, { side: THREE.DoubleSide }), { pos: [0, 0.2, 0] }));
  for (let i = 0; i < 5; i++) fruitBowl.add(mesh(new THREE.SphereGeometry(0.065, 14, 10), clay(i % 2 ? S.green : tone(C.terra, 1.1), 0.5), { pos: [(R() - 0.5) * 0.2, 0.2 + R() * 0.05, (R() - 0.5) * 0.2] }));
  fruitBowl.position.set(1.4, 0.71, cz);
  room.add(fruitBowl);
  const herbs = plant({ h: 0.6, seed: 4 }); herbs.scale.setScalar(0.45); herbs.position.set(0.85, 0.91, cz - 0.1); room.add(herbs);
  // the pendant lamp: a warm glowing shade
  const shade = new THREE.MeshStandardMaterial({ color: tone(C.lamp, 1, 0.2), emissive: tone(C.lamp, 1.0), emissiveIntensity: 1.0, roughness: 0.5, side: THREE.DoubleSide });
  room.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 4), clay(tone(C.cream, 0.3), 0.5), { pos: [0.5, 2.55, 0.3], cast: false }));
  room.add(mesh(new THREE.ConeGeometry(0.22, 0.2, 28, 1, true), shade, { pos: [0.5, 2.1, 0.3], cast: false }));
  const lamp = new THREE.PointLight(tone(C.lamp, 1.0), 3.2, 6, 1.4);
  lamp.position.set(0.5, 1.95, 0.3);
  scene.add(lamp);
  // a cat bed by the wall, empty; the food bowl waiting on the floor
  room.add(mesh(rbox(0.7, 0.16, 0.55, 0.08), clay(S.terra, 0.9), { pos: [-2.2, 0.08, -0.6] }));
  const dish = new THREE.Group();
  dish.add(mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.06, 28), clay(tone(C.cream, 1, 0.3), 0.4), { pos: [0, 0.03, 0] }));
  dish.position.set(-0.75, 0, 0.6);
  room.add(dish);

  // ---------- the can: glossy, with a terracotta label band, a lid that pops open, a ceremonial glow
  const can = new THREE.Group();
  can.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.11, 32), glossy(tone(C.cream, 0.85), { roughness: 0.2, reflect: 1.2 }), { pos: [0, 0.055, 0] }));
  can.add(mesh(new THREE.CylinderGeometry(0.0765, 0.0765, 0.06, 32, 1, true), clay(S.terra, 0.6), { pos: [0, 0.055, 0], cast: false }));
  const lid = new THREE.Group();
  lid.position.set(-0.07, 0.112, 0);
  lid.add(mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.008, 32), glossy(tone(C.cream, 0.95), { roughness: 0.15, reflect: 1.4 }), { pos: [0.07, 0, 0], cast: false }));
  lid.add(mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16), glossy(tone(C.cream, 0.9), { roughness: 0.15 }), { pos: [0.1, 0.006, 0], rot: [Math.PI / 2, 0, 0], cast: false }));
  can.add(lid);
  room.add(can);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: tone(C.gold, 1.0, 0.2) }, uK: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float rays = 0.6 + 0.4 * pow(abs(cos(atan(vUv.y - 0.5, vUv.x - 0.5) * 6.0)), 8.0); gl_FragColor = vec4(uCol * (1.0 - smoothstep(0.0, 1.0, d)) * rays * uK * 1.5, 1.0); }',
  });
  glowMat.toneMapped = false;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
  glow.renderOrder = 8;
  room.add(glow);
  const sparkles = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: tone(C.gold, 1.4, 0.3), transparent: true, toneMapped: false }));
    room.add(m);
    return { m, a: (i / 10) * Math.PI * 2 + R() * 0.4, up: 0.3 + R() * 0.5, sp: 0.35 + R() * 0.3 };
  });

  // ---------- the person and the governor (the same ginger cat as in the office)
  const person = makeHuman({ pose: 'openCan', seed: 210, scale: 1.72, shirt: 1, skin: 2, hair: 2, cut: 2 });
  person.group.position.set(0.8, 0, -0.25); person.group.rotation.y = -0.75;
  room.add(person.group);
  const gov = makeCat({ pose: 'stand', coat: 'ginger', seed: 1 });
  gov.group.scale.setScalar(0.6);
  room.add(gov.group);

  // evening light: a warm lamp key from above, dusky blue fill, warm rim
  const lights = baseRig(scene, pipe.renderer, { size: 3.6, dist: 20, intensity: 3.6, keyColor: tone(C.lamp, 1.0), keyDir: [-0.3, 0.85, 0.45], fillSky: '#557795', fillGround: '#6E5842', fillK: 0.28, rimColor: '#FFD2A0', rimK: 0.45, rimDir: [0.5, 0.4, -0.8] });
  lights.follow(new THREE.Vector3(0.2, 0.6, 0.4), 3.6);

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.02, 200);
  // Low hero angle at cat height, slow push-in (35 mm); then a slow drift behind the end card
  const A = { pos: [-0.5, 0.5, 3.3], target: [0.3, 0.7, -0.1], lens: 35 };
  const B = { pos: [-0.32, 0.46, 2.4], target: [0.35, 0.68, -0.1], lens: 35 };
  const E = { pos: [-0.22, 0.52, 2.2], target: [0.35, 0.74, -0.1], lens: 35 };
  const handPos = new THREE.Vector3(), floorCan = new THREE.Vector3(0.12, 0, 0.32);

  return {
    frame(f) {
      const t = (f - T0) / FPS;
      applyCam(cam, f < 1800 ? move(f, T0 + 20, 1790, A, B, { fn: ease.inOutSine }) : move(f, 1800, 1915, B, E, { fn: ease.inOutSine }));
      // 0-1.3 s: the cat nudges the can on the floor; it wobbles but stays shut
      const nudge = t < 1.4 ? Math.max(0, Math.sin(t * 7.5)) * (1 - prog(t, 1.1, 1.4)) : 0;
      // 1.3-2.0 s: the can rises into the person's hands
      person.group.updateMatrixWorld(true);
      handPos.set(-0.005, 0.585, 0.2).applyMatrix4(person.group.matrixWorld);
      const lift = ease.inOutCubic(prog(t, 1.35, 2.05));
      can.position.lerpVectors(floorCan, handPos, lift);
      can.position.y += Math.sin(Math.PI * lift) * 0.12;
      can.rotation.set(0, 0.4, nudge * 0.12 * (1 - lift));
      // 2.4 s: the lid pops, with a ceremonial golden glow and sparkles
      const pop = ease.outCubic(prog(t, 2.35, 2.7));
      lid.rotation.z = 1.9 * pop;
      const g = Math.sin(Math.PI * clamp((t - 2.3) / 1.4));
      glowMat.uniforms.uK.value = g;
      glow.position.copy(can.position).add(new THREE.Vector3(0, 0.14, 0));
      glow.quaternion.copy(cam.quaternion);
      glow.scale.setScalar(0.25 + 0.75 * ease.outCubic(clamp((t - 2.3) / 1.0)));
      sparkles.forEach(({ m, a, up, sp }) => {
        const k = clamp((t - 2.4) / 1.2);
        m.visible = k > 0 && k < 1;
        m.position.copy(can.position).add(new THREE.Vector3(Math.cos(a) * sp * k, 0.14 + up * k - 0.25 * k * k, Math.sin(a) * sp * k * 0.6));
        m.material.opacity = 1 - k;
      });
      // the cat: nudging at the can, looking up at the pop, then rubbing along the person's leg, tail up
      const walk = ease.inOutSine(prog(t, 3.0, 4.6));
      const p0 = new THREE.Vector3(-0.22, 0, 0.42), p1 = new THREE.Vector3(0.56, 0, 0.02);
      const rub = Math.sin(Math.max(0, t - 4.6) * 2.2) * 0.05;
      gov.group.position.lerpVectors(p0, p1, walk).add(new THREE.Vector3(rub * 0.6, 0, -rub));
      gov.group.rotation.y = 1.5 - 0.95 * walk + rub * 2;
      gov.group.rotation.z = 0.06 * walk * Math.sin(Math.max(0, t - 4.6) * 2.2);
      const lookUp = Math.sin(Math.PI * clamp((t - 2.2) / 1.2));
      gov.look(0.35 * walk + 0.2 * lookUp, 0.45 * nudge * (1 - walk) - 0.55 * lookUp + 0.35 * (1 - walk) * (1 - lookUp) * (t < 1.4 ? 1 : 0) - 0.2 * walk, 0.35 * walk);
      gov.state.slow = walk * Math.sin(Math.PI * clamp((t - 4.8) / 1.0)) ** 2; // a slow blink: "I love you"
      gov.state.tailAmp = 1 + walk;
      gov.update(t);
      person.state.nod = 0.25 + 0.15 * walk;
      person.update(t);
      // behind the end card the kitchen dims, warm and soft
      const dim = ease.inOutSine(prog(f, 1800, 1860));
      return { scene, camera: cam, bloom: 0.28 + 0.14 * g, exposure: 1.0 - 0.38 * dim, vignette: 0.26 + 0.14 * dim };
    },
  };
}
