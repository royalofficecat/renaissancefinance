// Town kit for the outdoor dioramas: base plates, toy houses, San Francisco row houses, fences, pools.
// Everything is matte and rounded; roofs are terracotta (cats' additions are warm), glass is cool.
import * as THREE from 'three';
import { C, S, clay, glossy, mixc, tone } from '../look.js';
import { mesh, rbox } from './props.js';
import { rng } from '../../../src/core/util.js';

/** Diorama base plate: a ground surface on a rounded slab with a terracotta foot (like the freeway set). */
export function basePlate({ w = 20, d = 20, top = null, ground = tone(C.cream, 0.92), slab = tone(C.cream, 0.78) } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), top || clay(ground, 0.85), {}));
  g.add(mesh(rbox(w + 0.3, 0.7, d + 0.3, 0.12), clay(slab, 0.85), { pos: [0, -0.36, 0] }));
  g.add(mesh(rbox(w + 0.34, 0.12, d + 0.34, 0.05), clay(S.terraDark, 0.7), { pos: [0, -0.62, 0], cast: false }));
  return g;
}

/** Terracotta roof tiles: rows of tiles drawn in the shader along the roof slope. */
export function tileRoof(color = S.terra) {
  const m = clay(color, 0.7);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r = fract(vOP.y * 9.0);
        float c = fract(vOP.x * 7.0 + step(0.5, fract(vOP.y * 4.5)) * 0.5);
        diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 0.35, r) * (0.8 + 0.2 * smoothstep(0.0, 0.2, min(c, 1.0 - c)));`);
  };
  return m;
}

const glassMat = () => glossy(tone(C.blue, 0.45), { roughness: 0.12, reflect: 0.9 });
const litMat = () => new THREE.MeshStandardMaterial({ color: tone(C.gold, 1.0, 0.15), emissive: tone(C.gold, 0.9), emissiveIntensity: 0.9, roughness: 0.5 });

/**
 * A toy house facing +z. Gable roof (terracotta tiles), cream walls, glass windows (some lit warm), a door.
 * @returns {THREE.Group} with userData.windows = [{pos, normal}] (world-ish local positions for window cats)
 */
export function house({ w = 2.2, d = 1.8, h = 1.3, wall = tone(C.cream, 0.97), roof = S.terra, roofType = 'gable', lit = 0, seed = 1, door = true, chimney = false } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  const wallM = clay(wall, 0.82), trim = clay(tone(C.cream, 1, 0.3), 0.6);
  g.add(mesh(rbox(w, h, d, 0.05), wallM, { pos: [0, h / 2, 0] }));
  if (roofType === 'gable') {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 - 0.14, 0); sh.lineTo(w / 2 + 0.14, 0); sh.lineTo(0, h * 0.62); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    rg.translate(0, 0, -(d + 0.24) / 2);
    g.add(mesh(rg, tileRoof(roof), { pos: [0, h, 0] }));
  } else if (roofType === 'hip') {
    const rg = new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, h * 0.55, 4, 1);
    rg.rotateY(Math.PI / 4);
    rg.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
    g.add(mesh(rg, tileRoof(roof), { pos: [0, h + h * 0.275, 0] }));
  } else {
    g.add(mesh(rbox(w + 0.24, 0.14, d + 0.24, 0.05), clay(tone(C.cream, 1, 0.2), 0.7), { pos: [0, h + 0.07, 0] }));
  }
  if (chimney) g.add(mesh(rbox(0.26, 0.6, 0.26, 0.04), clay(tone(C.terra, 0.8), 0.8), { pos: [w * 0.25, h + h * 0.45, -d * 0.15] }));
  const windows = [];
  const nW = Math.max(1, Math.round(w / 0.8));
  for (let i = 0; i < nW; i++) {
    const x = -w / 2 + (w / nW) * (i + 0.5);
    if (door && i === Math.floor(nW / 2)) {
      g.add(mesh(rbox(0.36, 0.66, 0.06, 0.03), clay(S.woodDark, 0.6), { pos: [x, 0.33, d / 2 + 0.01], cast: false }));
      continue;
    }
    const isLit = R() < lit;
    g.add(mesh(rbox(0.42, 0.46, 0.05, 0.02), trim, { pos: [x, h * 0.55, d / 2 + 0.01], cast: false }));
    g.add(mesh(new THREE.PlaneGeometry(0.34, 0.38), isLit ? litMat() : glassMat(), { pos: [x, h * 0.55, d / 2 + 0.04], cast: false }));
    windows.push({ pos: new THREE.Vector3(x, h * 0.55 - 0.22, d / 2 + 0.08), lit: isLit });
  }
  g.userData.windows = windows;
  return g;
}

/**
 * San Francisco row house: tall and narrow, a bay window, a cornice. Faces +z.
 * Sunny windows glow warm; there is a sill in each window for a cat.
 */
export function rowHouse({ w = 1.4, d = 2.2, floors = 3, color = tone(C.cream, 0.97), trimCol = tone(C.cream, 1, 0.35), lit = 0.6, seed = 1 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  const fh = 0.85, h = floors * fh + 0.3;
  const wallM = clay(color, 0.8), trim = clay(trimCol, 0.6);
  g.add(mesh(rbox(w, h, d, 0.04), wallM, { pos: [0, h / 2, 0] }));
  g.add(mesh(rbox(w + 0.16, 0.18, d + 0.1, 0.04), trim, { pos: [0, h + 0.05, 0.02] })); // cornice
  g.add(mesh(rbox(w + 0.06, 0.16, 0.12, 0.03), trim, { pos: [0, h - 0.12, d / 2 + 0.05] }));
  const sills = [];
  for (let f = 0; f < floors; f++) {
    const y = 0.35 + f * fh + fh * 0.45;
    if (f === 0) {
      g.add(mesh(rbox(0.38, 0.62, 0.06, 0.03), clay(S.woodDark, 0.6), { pos: [-w * 0.25, 0.31 + 0.05, d / 2 + 0.01], cast: false }));
      g.add(mesh(rbox(0.5, 0.08, 0.3, 0.02), trim, { pos: [-w * 0.25, 0.04, d / 2 + 0.15] }));
    }
    // bay window on the upper floors, flat windows on the ground floor
    if (f > 0) {
      const bay = new THREE.Group();
      bay.add(mesh(rbox(w * 0.66, fh * 0.78, 0.3, 0.04), wallM, { pos: [0, 0, 0.15] }));
      const isLit = R() < lit;
      bay.add(mesh(new THREE.PlaneGeometry(w * 0.5, fh * 0.52), isLit ? litMat() : glassMat(), { pos: [0, 0.02, 0.305], cast: false }));
      bay.add(mesh(rbox(w * 0.56, 0.06, 0.12, 0.02), trim, { pos: [0, -fh * 0.25, 0.34], cast: false }));
      bay.position.set(0, y, d / 2);
      g.add(bay);
      sills.push({ pos: new THREE.Vector3(0, y - fh * 0.25 + 0.03, d / 2 + 0.36), lit: isLit });
    } else {
      g.add(mesh(new THREE.PlaneGeometry(w * 0.32, fh * 0.45), glassMat(), { pos: [w * 0.22, y, d / 2 + 0.01], cast: false }));
    }
  }
  g.userData.sills = sills;
  g.userData.height = h + 0.14;
  return g;
}

/** A low picket fence along x, length L. */
export function fence(L = 3, color = tone(C.cream, 1, 0.3)) {
  const g = new THREE.Group(), m = clay(color, 0.7);
  const n = Math.max(2, Math.round(L / 0.16));
  for (let i = 0; i <= n; i++) g.add(mesh(rbox(0.06, 0.42, 0.04, 0.015, 1), m, { pos: [-L / 2 + (L * i) / n, 0.21, 0], cast: true }));
  for (const y of [0.14, 0.32]) g.add(mesh(rbox(L, 0.05, 0.03, 0.01, 1), m, { pos: [0, y, -0.03] }));
  return g;
}

/** A backyard pool: blue glossy water in a cream rim. */
export function pool({ w = 1.6, d = 1.0 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w + 0.24, 0.1, d + 0.24, 0.06), clay(tone(C.cream, 1, 0.3), 0.6), { pos: [0, 0.05, 0] }));
  g.add(mesh(rbox(w, 0.03, d, 0.2), glossy(tone(C.blue, 1.05, 0.15), { roughness: 0.08, reflect: 1 }), { pos: [0, 0.09, 0], cast: false }));
  return g;
}

/** A street strip along x with a light-blue dashed centre line (the human service network). */
export function street(L = 10, wdt = 1.2) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(L, 0.02, wdt), clay(mixc(tone(C.blue, 0.42), tone(C.cream, 0.45), 0.35), 0.8), { pos: [0, 0.01, 0], cast: false }));
  const dash = clay(tone(C.blue, 1, 0.55), 0.6);
  for (let x = -L / 2 + 0.3; x < L / 2; x += 0.7) g.add(mesh(new THREE.BoxGeometry(0.35, 0.005, 0.05), dash, { pos: [x, 0.023, 0], cast: false }));
  return g;
}
