// Toy cats: soft vinyl figures that stay recognisably feline. Real cat poses only (sit, loaf, sphinx,
// sunbathing sprawl, curled asleep, stand), no clothes, no human gestures.
// Body and head are each one seamless smooth piece (see sdf.js); the tail is a swept tube.
// Units: a sitting cat is about 1 unit tall to the ear tips. The cat faces +z; y is up; it stands on y = 0.
import * as THREE from 'three';
import { C, S, mixc, tone } from '../look.js';
import { capsule, ellipsoid, meshSDF, mirrorX, roundCone, smax, sphere, union } from './sdf.js';
import { sweepTube, taper } from './sweep.js';
import { paintedMaterial } from './paint.js';
import { clamp, rng, smoothstep } from '../../../src/core/util.js';

const ss = smoothstep;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- coat pattern (per vertex): x = pale patch (muzzle, bib, socks), y = tabby stripes, z = rosy (nose, inner ears)
function stripe(v, width = 0.42) {
  const s = 0.5 + 0.5 * Math.sin(v);
  return ss(1 - width - 0.12, 1 - width + 0.12, s);
}

// ---------- poses: body field, head pivot and tilt, tail rest curve, bounds
const POSES = {
  sit: {
    body: union([
      [roundCone([0, 0.2, -0.1], [0, 0.5, 0.05], 0.19, 0.125), 0],
      [ellipsoid([0, 0.13, -0.08], [0.2, 0.13, 0.22]), 0.08],
      [mirrorX(ellipsoid([0.12, 0.16, -0.06], [0.11, 0.15, 0.18], [0.25, 0, 0])), 0.07],
      [mirrorX(roundCone([0.064, 0.42, 0.09], [0.07, 0.05, 0.14], 0.054, 0.04)), 0.05],
      [mirrorX(ellipsoid([0.07, 0.032, 0.175], [0.048, 0.032, 0.062])), 0.03],
      [mirrorX(ellipsoid([0.15, 0.03, 0.05], [0.048, 0.03, 0.085])), 0.04],
      [roundCone([0, 0.5, 0.05], [0, 0.6, 0.08], 0.12, 0.1), 0.06],
    ]),
    lo: [-0.32, -0.02, -0.36], hi: [0.32, 0.7, 0.3],
    head: { pos: [0, 0.6, 0.07], rot: [0.05, 0, 0] },
    tail: [[0, 0.1, -0.26], [0.1, 0.04, -0.3], [0.23, 0.035, -0.2], [0.27, 0.035, -0.02], [0.21, 0.035, 0.15], [0.1, 0.04, 0.24]],
    tailR: [0.048, 0.03], sway: 'tip',
    pale: (p, n) => Math.max(
      ss(0.1, 0.5, n.z) * (1 - ss(0.8, 1.1, Math.hypot(p.x / 0.085, (p.y - 0.47) / (p.y < 0.47 ? 0.13 : 0.09)))) * ss(0.02, 0.08, p.z),
      1 - ss(0.045, 0.075, p.y),
    ),
    stripes: (p, n) => stripe(p.y * 26 - p.z * 14 + Math.abs(p.x) * 6) * (1 - ss(-0.1, 0.4, n.z)) * ss(0.08, 0.14, p.y),
  },
  loaf: {
    body: union([
      [ellipsoid([0, 0.155, -0.04], [0.2, 0.155, 0.3]), 0],
      [ellipsoid([0, 0.18, 0.17], [0.17, 0.16, 0.15]), 0.08],
      [mirrorX(ellipsoid([0.07, 0.035, 0.27], [0.05, 0.03, 0.05])), 0.05],
      [roundCone([0, 0.22, 0.17], [0, 0.3, 0.24], 0.12, 0.1), 0.06],
    ]),
    lo: [-0.28, -0.02, -0.42], hi: [0.28, 0.42, 0.38],
    head: { pos: [0, 0.3, 0.24], rot: [0.0, 0, 0] },
    tail: [[0, 0.1, -0.33], [0.13, 0.05, -0.32], [0.22, 0.035, -0.17], [0.23, 0.035, 0.03], [0.17, 0.035, 0.2]],
    tailR: [0.046, 0.03], sway: 'tip',
    pale: (p, n) => Math.max(ss(0.4, 0.7, n.z) * (1 - ss(0.1, 0.14, Math.abs(p.x))) * (1 - ss(0.26, 0.3, p.y)), 1 - ss(0.04, 0.07, p.y)),
    stripes: (p, n) => stripe(p.z * 30 + Math.abs(p.x) * 4) * ss(0.0, 0.5, n.y + Math.abs(n.x) * 0.5) * (1 - ss(0.12, 0.3, p.z)),
  },
  sphinx: {
    body: union([
      [ellipsoid([0, 0.15, -0.06], [0.2, 0.15, 0.32]), 0],
      [ellipsoid([0, 0.18, 0.14], [0.16, 0.16, 0.14]), 0.08],
      [mirrorX(capsule([0.075, 0.06, 0.16], [0.075, 0.04, 0.4], 0.045)), 0.05],
      [mirrorX(ellipsoid([0.075, 0.033, 0.42], [0.05, 0.033, 0.06])), 0.03],
      [roundCone([0, 0.22, 0.15], [0, 0.31, 0.22], 0.12, 0.1), 0.06],
    ]),
    lo: [-0.28, -0.02, -0.42], hi: [0.28, 0.44, 0.52],
    head: { pos: [0, 0.31, 0.22], rot: [-0.05, 0, 0] },
    tail: [[0, 0.09, -0.34], [0.12, 0.04, -0.4], [0.24, 0.035, -0.36], [0.33, 0.035, -0.22], [0.36, 0.04, -0.06]],
    tailR: [0.046, 0.03], sway: 'tip',
    pale: (p, n) => Math.max(ss(0.4, 0.7, n.z) * (1 - ss(0.1, 0.14, Math.abs(p.x))) * (1 - ss(0.28, 0.32, p.y)), 1 - ss(0.05, 0.08, p.y) * (1 - ss(0.34, 0.38, p.z) * 0)),
    stripes: (p, n) => stripe(p.z * 30 + Math.abs(p.x) * 4) * ss(0.0, 0.5, n.y + Math.abs(n.x) * 0.5) * (1 - ss(0.1, 0.25, p.z)),
  },
  sprawl: {
    // Sunbathing on its side, legs stretched out, belly to the sun (+x side faces up and out)
    body: union([
      [ellipsoid([0, 0.13, -0.02], [0.17, 0.13, 0.36], [0, 0, 0]), 0],
      [ellipsoid([0.02, 0.13, 0.2], [0.15, 0.12, 0.14]), 0.08],
      [capsule([0.08, 0.1, 0.24], [0.36, 0.05, 0.36], 0.045), 0.05],
      [capsule([0.1, 0.12, 0.17], [0.38, 0.06, 0.2], 0.045), 0.05],
      [capsule([0.08, 0.1, -0.2], [0.38, 0.05, -0.3], 0.05), 0.05],
      [capsule([0.08, 0.14, -0.14], [0.36, 0.1, -0.12], 0.05), 0.05],
      [roundCone([0.02, 0.15, 0.24], [0.02, 0.15, 0.33], 0.11, 0.1), 0.05],
    ]),
    lo: [-0.24, -0.02, -0.42], hi: [0.46, 0.34, 0.44],
    head: { pos: [0.02, 0.14, 0.33], rot: [0.15, 0.25, 1.35] },
    tail: [[0, 0.07, -0.34], [0.05, 0.04, -0.45], [0.16, 0.035, -0.55], [0.3, 0.035, -0.58], [0.42, 0.035, -0.55]],
    tailR: [0.046, 0.03], sway: 'tip',
    pale: (p, n) => Math.max(ss(0.3, 0.7, n.x) * ss(0.06, 0.14, p.y) * (1 - ss(0.22, 0.3, Math.abs(p.z))), ss(0.31, 0.36, p.x)),
    stripes: (p, n) => stripe(p.z * 28 + p.y * 5) * (1 - ss(-0.2, 0.4, n.x)) * ss(0.05, 0.1, p.y),
  },
  curl: {
    // Asleep: a round dome of cat, chin resting on its paws, tail wrapped round the front
    body: union([
      [ellipsoid([0, 0.13, -0.02], [0.24, 0.13, 0.26]), 0],
      [ellipsoid([-0.1, 0.14, -0.08], [0.13, 0.12, 0.15]), 0.08],
      [mirrorX(ellipsoid([0.06, 0.035, 0.22], [0.05, 0.032, 0.06])), 0.05],
      [roundCone([0.03, 0.16, 0.08], [0.07, 0.15, 0.16], 0.12, 0.1), 0.06],
    ]),
    lo: [-0.32, -0.02, -0.34], hi: [0.32, 0.3, 0.32],
    head: { pos: [0.07, 0.13, 0.17], rot: [0.32, 0.35, -0.38], closed: true },
    tail: [[-0.04, 0.06, -0.26], [-0.2, 0.05, -0.2], [-0.27, 0.045, 0.0], [-0.21, 0.045, 0.19], [-0.06, 0.045, 0.28], [0.08, 0.05, 0.3]],
    tailR: [0.05, 0.032], sway: 'none',
    pale: (p, n) => 1 - ss(0.04, 0.07, p.y),
    stripes: (p, n) => stripe(Math.atan2(p.z, p.x) * 9) * ss(0.2, 0.7, n.y + 0.2) * 0.9,
  },
  stand: {
    body: union([
      [roundCone([0, 0.36, -0.2], [0, 0.4, 0.15], 0.15, 0.135), 0],
      [mirrorX(capsule([0.08, 0.3, 0.15], [0.08, 0.04, 0.17], 0.045)), 0.06],
      [mirrorX(roundCone([0.09, 0.32, -0.2], [0.09, 0.04, -0.22], 0.07, 0.04)), 0.06],
      [mirrorX(ellipsoid([0.08, 0.03, 0.19], [0.042, 0.03, 0.055])), 0.03],
      [mirrorX(ellipsoid([0.09, 0.03, -0.2], [0.042, 0.03, 0.055])), 0.03],
      [roundCone([0, 0.42, 0.13], [0, 0.5, 0.22], 0.12, 0.1), 0.06],
    ]),
    lo: [-0.24, -0.02, -0.42], hi: [0.24, 0.62, 0.36],
    head: { pos: [0, 0.5, 0.22], rot: [0.05, 0, 0] },
    tail: [[0, 0.4, -0.33], [0, 0.55, -0.42], [0, 0.72, -0.44], [0.0, 0.82, -0.38], [0.04, 0.84, -0.32]],
    tailR: [0.046, 0.03], sway: 'up',
    pale: (p, n) => Math.max(ss(0.4, 0.8, -n.y) * 0.9, 1 - ss(0.05, 0.08, p.y), ss(0.45, 0.7, n.z) * ss(0.3, 0.36, p.y) * (1 - ss(0.07, 0.11, Math.abs(p.x)))),
    stripes: (p, n) => stripe(p.z * 28 + p.y * 8) * ss(-0.1, 0.4, n.y + Math.abs(n.x) * 0.6) * ss(0.25, 0.32, p.y) * (1 - ss(0.08, 0.2, p.z)),
  },
};

// ---------- head (shared by every pose); origin = neck pivot
const earL = (inset) => {
  const base = [0.085, 0.165, 0.035], tip = [0.13, 0.285, 0.015];
  const f = roundCone(base, tip, 0.06 - inset, 0.012);
  // flatten front-to-back so the ear is a thin rounded triangle
  return (x, y, z) => f(x, y, 0.025 + (z - 0.025) * (inset ? 2.6 : 2.3)) * 0.62;
};
const outerEar = mirrorX(earL(0)), innerEar = mirrorX(earL(0.016));
const HEAD = (() => {
  const shell = union([
    [ellipsoid([0, 0.1, 0.03], [0.155, 0.132, 0.14]), 0],
    [mirrorX(ellipsoid([0.068, 0.058, 0.072], [0.085, 0.068, 0.085])), 0.05],
    [ellipsoid([0, 0.05, 0.135], [0.062, 0.042, 0.05]), 0.05],
    [ellipsoid([0, 0.03, 0.12], [0.036, 0.03, 0.04]), 0.04],
    [ellipsoid([0, 0.078, 0.18], [0.02, 0.014, 0.012]), 0.012],
    [outerEar, 0.035],
  ]);
  // Hollow the front of each ear (carved, then rounded)
  const carve = (x, y, z) => innerEar(x, y, z - 0.022);
  return (x, y, z) => smax(shell(x, y, z), -carve(x, y, z), 0.012);
})();
const headPale = (p, n) => {
  const muzzle = 1 - ss(0.85, 1.15, Math.hypot(p.x / 0.085, (p.y - 0.045) / 0.052, Math.max(0, 0.12 - p.z) / 0.06));
  return clamp(muzzle);
};
const headStripes = (p, n) => {
  let v = 0;
  const front = ss(0.1, 0.4, n.z + n.y * 0.6);
  for (const xi of [-0.034, 0, 0.034]) {
    const w = 0.0035 + 0.011 * ss(0.12, 0.2, p.y); // narrow towards the eyes
    v = Math.max(v, (1 - ss(w - 0.004, w + 0.004, Math.abs(p.x - xi * (1 + (p.y - 0.15) * 2)))) * ss(0.13, 0.15, p.y));
  }
  v *= front * (1 - ss(0.215, 0.235, p.y));
  for (const [y0, k] of [[0.09, 0.3], [0.06, 0.25]]) {
    const ax = Math.abs(p.x), yc = y0 + (ax - 0.1) * k;
    const w = 0.004 + 0.007 * ss(0.1, 0.15, ax);
    v = Math.max(v, (1 - ss(w - 0.003, w + 0.003, Math.abs(p.y - yc))) * ss(0.098, 0.115, ax));
  }
  return clamp(v);
};
const headRosy = (p) => {
  const nose = 1 - ss(0.016, 0.024, Math.hypot(p.x / 1.1, p.y - 0.079, (p.z - 0.18) * 1.4));
  const ear = (1 - ss(-0.004, 0.004, innerEar(p.x, p.y, p.z - 0.012))) * ss(0.19, 0.22, p.y);
  return clamp(nose + ear * 0.85);
};

// ---------- geometry cache (built once per pose and level of detail)
const cache = new Map();
function bodyGeo(pose, lod) {
  const key = `${pose}:${lod}`;
  if (!cache.has(key)) {
    const P = POSES[pose];
    cache.set(key, meshSDF(P.body, P.lo, P.hi, lod === 'hi' ? 120 : 52, {
      attrs: { pat: [3, (p, n) => [clamp(P.pale(p, n)), clamp(P.stripes(p, n)), 0]] },
    }));
  }
  return cache.get(key);
}
function headGeo(lod) {
  const key = `head:${lod}`;
  if (!cache.has(key)) {
    cache.set(key, meshSDF(HEAD, [-0.2, -0.06, -0.14], [0.2, 0.31, 0.22], lod === 'hi' ? 104 : 46, {
      attrs: { pat: [3, (p, n) => { const r = headRosy(p); return [headPale(p, n) * (1 - r), headStripes(p, n) * (1 - r), r]; }] },
    }));
  }
  return cache.get(key);
}

// ---------- materials
export const COATS = {
  ginger: { base: tone(C.terra, 1.06), pale: tone(C.cream, 1.0, 0.15), stripe: tone(C.terra, 0.74), rosy: mixc(C.terra, C.cream, 0.55), stripeK: 0.85 },
  cream: { base: tone(C.cream, 0.95), pale: tone(C.cream, 1.0, 0.35), stripe: mixc(tone(C.cream, 0.8), C.terra, 0.12), rosy: mixc(C.terra, C.cream, 0.6), stripeK: 0.55 },
  ginger2: { base: mixc(C.terra, C.cream, 0.22), pale: tone(C.cream, 1.0, 0.2), stripe: tone(C.terra, 0.86), rosy: mixc(C.terra, C.cream, 0.55), stripeK: 0.7 },
};
export function coatMaterial(name) {
  const c = COATS[name];
  return paintedMaterial({ base: c.base, x: c.pale, y: c.stripe, z: c.rosy }, { roughness: 0.6, ky: c.stripeK, rim: 0.12, key: 'coat:' + name });
}

// Eyes: glossy beads with a green iris, slit pupil and a painted catchlight (a toy-maker's trick: always alive)
const eyeGeo = new THREE.SphereGeometry(1, 28, 20);
function eyeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.14, metalness: 0 });
  const U = { uClose: { value: 0 }, uPupil: { value: 0.22 }, uIris: { value: tone(C.green, 1.0, 0.18) } };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; uniform float uClose, uPupil; uniform vec3 uIris;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r = length(vLoc.xy);
        vec3 c = mix(uIris * 0.55, uIris, smoothstep(0.85, 0.2, r));
        float pupil = 1.0 - smoothstep(0.9, 1.05, length(vLoc.xy / vec2(uPupil, 0.78)));
        c = mix(c, vec3(0.03, 0.025, 0.02), pupil);
        c = mix(c, vec3(0.06, 0.045, 0.035), smoothstep(0.86, 0.95, r)); // dark rim
        c = mix(c, vec3(0.05, 0.04, 0.03), uClose);
        diffuseColor.rgb = c;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float glint = 1.0 - smoothstep(0.1, 0.16, length(vLoc.xy - vec2(-0.3, 0.36)));
        totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * glint * (1.0 - uClose) * step(0.0, vLoc.z) * 1.1;`);
  };
  return m;
}

/**
 * Make a cat.
 * @param {object} o { pose, coat: 'ginger'|'cream'|'ginger2', lod: 'hi'|'lo', seed, scale }
 * @returns {{ group, update(t), look(yaw, pitch, roll), setEyes(open), head, pose }}
 */
export function makeCat({ pose = 'sit', coat = 'ginger', lod = 'hi', seed = 1, scale = 1 } = {}) {
  const P = POSES[pose];
  const R = rng(seed * 7919 + 13);
  const mat = coatMaterial(coat);
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);
  const body = new THREE.Mesh(bodyGeo(pose, lod), mat);
  body.castShadow = body.receiveShadow = true;
  bodyPivot.add(body);

  const head = new THREE.Group();
  head.position.set(...P.head.pos);
  const headRot = new THREE.Group();
  headRot.rotation.set(...P.head.rot, 'YXZ');
  headRot.scale.setScalar(1.08);
  head.add(headRot);
  const look = new THREE.Group();
  headRot.add(look);
  const headMesh = new THREE.Mesh(headGeo(lod), mat);
  headMesh.castShadow = headMesh.receiveShadow = true;
  look.add(headMesh);
  bodyPivot.add(head);

  // Eyes sit in shallow sockets on the front of the head, angled slightly outwards
  const eyeMat = eyeMaterial();
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(s * 0.061, 0.11, 0.149);
    e.rotation.set(-0.12, s * 0.34, 0);
    e.scale.set(0.035, 0.04, 0.022);
    e.userData.sy = 0.04;
    e.castShadow = false;
    look.add(e);
    return e;
  });

  // Tail: control points relax around a rest curve; the tip sways
  const rest = P.tail.map((p) => V(...p));
  const tailT = sweepTube(lod === 'hi' ? 44 : 22, lod === 'hi' ? 14 : 8, taper(P.tailR[0], P.tailR[1], 0.12));
  const tailMesh = new THREE.Mesh(tailT.geo, mat);
  tailMesh.geometry.setAttribute('pat', new THREE.BufferAttribute(new Float32Array(tailT.geo.attributes.position.count * 3), 3));
  tailMesh.castShadow = tailMesh.receiveShadow = true;
  bodyPivot.add(tailMesh);
  // Tail rings: stripes along the length, the very tip pale on cream cats
  {
    const A = tailT.geo.attributes.along.array, pat = tailMesh.geometry.attributes.pat.array;
    for (let i = 0; i < A.length; i++) pat[i * 3 + 1] = stripe(A[i] * 34, 0.45) * ss(0.05, 0.15, A[i]);
  }
  const ctrl = rest.map((p) => p.clone());

  const ph = R() * 100, blinkEvery = 3.2 + R() * 3.5, blinkPh = R() * 10, swayF = 0.35 + R() * 0.3, breatheF = 0.28 + R() * 0.08;
  const state = { yaw: 0, pitch: 0, roll: 0, open: P.head.closed ? 0 : 1, slow: 0, tailAmp: 1, breathe: 1 };

  function update(t) {
    // Breathing: a slow, small swell of the chest
    const b = Math.sin((t + ph) * Math.PI * 2 * breatheF) * 0.012 * state.breathe;
    body.scale.set(1 + b * 0.6, 1 + b, 1 + b * 0.3);
    // Blinks: quick normal blinks, or a long slow blink (the cat "I love you")
    let lid = 1 - state.open;
    const bt = (t + blinkPh) % blinkEvery;
    if (state.open > 0.5 && bt < 0.18) lid = Math.max(lid, Math.sin((bt / 0.18) * Math.PI));
    if (state.slow > 0) lid = Math.max(lid, state.slow);
    for (const e of eyes) e.scale.y = e.userData.sy * (1 - 0.88 * lid);
    eyeMat.userData.U.uClose.value = ss(0.55, 0.85, lid);
    look.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
    // Tail: the tip lifts and curls lazily
    for (let i = 0; i < rest.length; i++) {
      const u = i / (rest.length - 1);
      const w = P.sway === 'none' ? 0 : P.sway === 'up' ? u * u : ss(0.35, 1, u);
      const s1 = Math.sin((t + ph) * Math.PI * 2 * swayF + u * 2.2), s2 = Math.sin((t + ph) * Math.PI * 2 * swayF * 0.53 + 1.7 + u * 1.3);
      ctrl[i].copy(rest[i]);
      if (P.sway === 'up') { ctrl[i].x += w * 0.09 * s1 * state.tailAmp; ctrl[i].z += w * 0.03 * s2 * state.tailAmp; }
      else { ctrl[i].y += w * (0.05 + 0.04 * s2) * state.tailAmp; ctrl[i].x += w * 0.04 * s1 * state.tailAmp; }
    }
    tailT.update(ctrl);
  }
  update(0);
  group.scale.setScalar(scale);
  return {
    group, head: look, eyes, body, pose, state,
    update,
    /** Turn the head (radians): yaw left/right, pitch up/down, roll tilt. */
    look(yaw = 0, pitch = 0, roll = 0) { state.yaw = yaw; state.pitch = pitch; state.roll = roll; },
  };
}

export const CAT_POSES = Object.keys(POSES);

/** Raw parts for instanced crowds: body and head geometry plus where the head sits for a pose. */
export function catParts(pose = 'sit', lod = 'lo') {
  const P = POSES[pose];
  return { body: bodyGeo(pose, lod), head: headGeo(lod), headPos: new THREE.Vector3(...P.head.pos), headRot: new THREE.Euler(...P.head.rot, 'YXZ'), headScale: 1.08 };
}
