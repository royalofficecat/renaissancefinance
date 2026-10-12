// Faceless toy people: calm, unhurt, some visibly content with the arrangement. "Cool = human":
// clothes are coastal-blue shades; skin and hair are shades of the warm palette.
// Units: a standing figure is 1 unit tall (scale it when placing). Faces +z, stands on y = 0.
import * as THREE from 'three';
import { C, S, mixc, tone } from '../look.js';
import { capsule, ellipsoid, meshSDF, mirrorX, union } from './sdf.js';
import { paintedMaterial } from './paint.js';
import { rng, smoothstep } from '../../../src/core/util.js';

const ss = smoothstep;

// Arm and leg layouts per pose: shoulder -> elbow -> wrist (right side, x > 0; left side mirrored unless given)
const POSES = {
  stand: { drop: 0, arms: { R: [[0.135, 0.7, 0], [0.155, 0.53, -0.01], [0.16, 0.37, 0.02]] }, legs: 'stand' },
  holdFolder: { drop: 0, arms: { R: [[0.15, 0.71, 0], [0.17, 0.54, 0.04], [0.085, 0.6, 0.15]], L: [[-0.15, 0.71, 0], [-0.17, 0.54, 0.04], [-0.07, 0.59, 0.15]] }, legs: 'stand', prop: 'folder' },
  carry: { drop: 0, arms: { R: [[0.15, 0.71, 0], [0.165, 0.54, 0.03], [0.11, 0.55, 0.2]] }, legs: 'stand', prop: 'bowl' },
  sitTyping: { drop: 0.18, arms: { R: [[0.15, 0.71, 0], [0.16, 0.55, 0.09], [0.1, 0.56, 0.26]] }, legs: 'sit' },
  openCan: { drop: 0, arms: { R: [[0.15, 0.71, 0], [0.18, 0.56, 0.06], [0.07, 0.6, 0.2]], L: [[-0.15, 0.71, 0], [-0.17, 0.55, 0.05], [-0.05, 0.57, 0.19]] }, legs: 'stand', prop: 'can' },
};
export const HUMAN_POSES = Object.keys(POSES);

function bodyField(P) {
  const d = P.drop;
  const y = (v) => v - d;
  const parts = [
    [ellipsoid([0, y(0.655), 0], [0.132, 0.12, 0.085]), 0],
    [ellipsoid([0, y(0.5), 0], [0.118, 0.1, 0.08]), 0.08],
    [mirrorX(ellipsoid([0.1, y(0.71), 0], [0.06, 0.05, 0.058])), 0.07],
    [capsule([0, y(0.74), 0], [0, y(0.84), 0.005], 0.042), 0.04],
  ];
  const arm = (pts, s = 1) => {
    const [sh, el, wr] = pts.map(([a, b, c]) => [a * s, y(b), c]);
    parts.push([capsule(sh, el, 0.042), 0.03], [capsule(el, wr, 0.036), 0.025], [ellipsoid(wr.map((v, i) => v + [0, -0.02, 0.012][i]), [0.032, 0.038, 0.03]), 0.02]);
  };
  arm(P.arms.R);
  if (P.arms.L) arm(P.arms.L); else arm(P.arms.R, -1);
  if (P.legs === 'stand') {
    parts.push(
      [mirrorX(capsule([0.06, 0.45, 0], [0.062, 0.24, 0.01], 0.054)), 0.04],
      [mirrorX(capsule([0.062, 0.24, 0.01], [0.062, 0.055, 0], 0.045)), 0.03],
      [mirrorX(ellipsoid([0.062, 0.027, 0.03], [0.045, 0.028, 0.075])), 0.02],
    );
  } else {
    parts.push(
      [mirrorX(capsule([0.06, y(0.45), 0], [0.065, y(0.46), 0.22], 0.056)), 0.04],
      [mirrorX(capsule([0.065, y(0.46), 0.22], [0.065, 0.055, 0.24], 0.045)), 0.03],
      [mirrorX(ellipsoid([0.065, 0.027, 0.27], [0.045, 0.028, 0.075])), 0.02],
    );
  }
  return union(parts);
}

// Painted regions: x = trousers, y = skin (neck, hands), z = shoes
function bodyPat(P) {
  const d = P.drop;
  return (p) => {
    const skinNeck = ss(0.735 - d, 0.75 - d, p.y) * (1 - ss(0.86 - d, 0.88 - d, p.y));
    let hands = 0;
    const hs = [P.arms.R[2], P.arms.L ? P.arms.L[2] : [-P.arms.R[2][0], P.arms.R[2][1], P.arms.R[2][2]]];
    for (const [x, y, z] of hs) hands = Math.max(hands, 1 - ss(0.04, 0.05, Math.hypot(p.x - x, p.y - (y - d) + 0.02, p.z - z - 0.012)));
    const trousers = P.legs === 'stand' ? 1 - ss(0.44, 0.47, p.y) : 1 - ss(0.44 - d, 0.47 - d, p.y) + (1 - ss(0.2, 0.25, p.y));
    const shoes = 1 - ss(0.05, 0.065, p.y);
    return [Math.min(1, trousers) * (1 - shoes), Math.max(skinNeck, hands), shoes];
  };
}

// Head: a smooth egg with a hair cap (one of three cuts). No face: these are toy figures.
const HAIR = [
  (x, y, z) => ellipsoid([0, 0.1, -0.012], [0.094, 0.098, 0.096])(x, y, z), // short
  (x, y, z) => union([[ellipsoid([0, 0.1, -0.014], [0.096, 0.1, 0.098]), 0], [ellipsoid([0, 0.035, -0.05], [0.09, 0.09, 0.06]), 0.04]])(x, y, z), // bob
  (x, y, z) => union([[ellipsoid([0, 0.1, -0.012], [0.094, 0.098, 0.096]), 0], [ellipsoid([0, 0.17, -0.06], [0.05, 0.05, 0.05]), 0.03]])(x, y, z), // bun
];
const skull = ellipsoid([0, 0.085, 0.006], [0.085, 0.1, 0.09]);
const headCache = new Map();
function headGeo(cut, lod) {
  const key = `${cut}:${lod}`;
  if (!headCache.has(key)) {
    const hair = HAIR[cut];
    // Hair covers the top and back: keep the hair volume only above the hairline
    const hairCut = (x, y, z) => Math.max(hair(x, y, z), 0.11 - y + z * 0.6 - Math.max(0, -z) * 1.2);
    const f = union([[skull, 0], [hairCut, 0.012]]);
    headCache.set(key, meshSDF(f, [-0.13, -0.04, -0.14], [0.13, 0.25, 0.13], lod === 'hi' ? 70 : 32, {
      attrs: { pat: [3, (p) => [ss(-0.008, 0.008, skull(p.x, p.y, p.z) + 0.003 - hairCut(p.x, p.y, p.z)), 0, 0]] },
    }));
  }
  return headCache.get(key);
}
const bodyCache = new Map();
function bodyGeo(pose, lod) {
  const key = `${pose}:${lod}`;
  if (!bodyCache.has(key)) {
    const P = POSES[pose];
    bodyCache.set(key, meshSDF(bodyField(P), [-0.26, -0.01, -0.14], [0.26, 0.9, 0.36], lod === 'hi' ? 110 : 46, { attrs: { pat: [3, bodyPat(P)] } }));
  }
  return bodyCache.get(key);
}

// Wardrobe: clothes in coastal-blue shades; trousers deep blue or tan; skin and hair from warm shades
const SHIRTS = [S.blue, tone(C.blue, 1, 0.18), tone(C.blue, 0.78), tone(C.blue, 0.92, 0.1)];
const TROUSERS = [S.blueDeep, tone(C.cream, 0.55), tone(C.blue, 0.55)];
const SKINS = [tone(C.cream, 0.98), mixc(tone(C.cream, 0.85), C.terra, 0.18), mixc(tone(C.cream, 0.62), C.terra, 0.25), mixc(tone(C.cream, 0.42), C.terra, 0.2)];
const HAIRS = [S.hair, tone(C.cream, 0.22), mixc(tone(C.cream, 0.55), C.terra, 0.3), tone(C.cream, 0.8), tone(C.cream, 0.35)];

// Small props people hold
function prop(kind) {
  const g = new THREE.Group();
  if (kind === 'folder') {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.014), new THREE.MeshStandardMaterial({ color: tone(C.cream, 1, 0.3), roughness: 0.75 }));
    f.rotation.x = -0.35;
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24), new THREE.MeshStandardMaterial({ color: C.terra, roughness: 0.6 }));
    seal.rotation.x = Math.PI / 2 - 0.35;
    seal.position.set(0, 0.03, 0.012);
    f.castShadow = true;
    g.add(f, seal);
    g.position.set(0, 0.6, 0.165);
  }
  return g;
}

/**
 * @param {object} o { pose, seed, lod, shirt, skin, hair, cut, scale }
 */
export function makeHuman({ pose = 'stand', seed = 1, lod = 'hi', shirt, trousers, skin, hair, cut, scale = 1 } = {}) {
  const P = POSES[pose];
  const R = rng(seed * 104729 + 7);
  const pick = (a, v) => (v !== undefined ? (typeof v === 'number' ? a[v] : v) : a[Math.floor(R() * a.length)]);
  const shirtC = pick(SHIRTS, shirt), trouserC = pick(TROUSERS, trousers), skinC = pick(SKINS, skin), hairC = pick(HAIRS, hair);
  const hairCut = cut !== undefined ? cut : Math.floor(R() * HAIR.length);
  const group = new THREE.Group();
  const bodyMat = paintedMaterial({ base: shirtC, x: trouserC, y: skinC, z: tone(C.cream, 0.2) }, { roughness: 0.68, rim: 0.06 });
  const body = new THREE.Mesh(bodyGeo(pose, lod), bodyMat);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.835 - P.drop, 0.004);
  head.scale.setScalar(0.98);
  const headMat = paintedMaterial({ base: skinC, x: hairC }, { roughness: 0.62, rim: 0.06 });
  const headMesh = new THREE.Mesh(headGeo(hairCut, lod), headMat);
  headMesh.castShadow = headMesh.receiveShadow = true;
  head.add(headMesh);
  group.add(head);
  if (P.prop === 'folder') group.add(prop('folder'));
  const ph = R() * 10;
  const state = { nod: 0, turn: 0, tilt: 0 };
  function update(t) {
    // Calm idle: a slow weight shift and a little breathing
    const sway = Math.sin((t + ph) * 0.9) * 0.008;
    body.rotation.z = sway;
    head.rotation.set(state.nod + Math.sin((t + ph) * 0.7) * 0.02, state.turn, state.tilt + sway * 0.8);
    body.scale.y = 1 + Math.sin((t + ph) * 1.6) * 0.004;
  }
  update(0);
  group.scale.setScalar(scale);
  return { group, head, body, state, update };
}
