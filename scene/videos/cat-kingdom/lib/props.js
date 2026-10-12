// Furniture and props for the dioramas: all rounded, matte, toy-like. Units are metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { C, S, clay, glossy, mixc, tone } from '../look.js';
import { ellipsoid, meshSDF, union } from './sdf.js';
import { paintedMaterial } from './paint.js';
import { rng, smoothstep } from '../../../src/core/util.js';

const ss = smoothstep;
export const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
export function mesh(geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// ---------- the paw seal: a cast medallion with a raised paw print (terracotta, cream paint on the raised parts)
let sealGeo = null;
function pawField() {
  const toes = [[-0.2, 0.15, 0.085, 0.1], [-0.075, 0.27, 0.085, 0.105], [0.075, 0.27, 0.085, 0.105], [0.2, 0.15, 0.085, 0.1]];
  const parts = [[ellipsoid([0, -0.08, 0], [0.2, 0.15, 0.06]), 0], [ellipsoid([-0.1, -0.13, 0], [0.13, 0.11, 0.06]), 0.06], [ellipsoid([0.1, -0.13, 0], [0.13, 0.11, 0.06]), 0.06]];
  for (const [x, y, rx, ry] of toes) parts.push([ellipsoid([x, y, 0], [rx * 0.8, ry * 0.85, 0.06]), 0]);
  return union(parts);
}
export function pawSeal(radius = 0.5) {
  if (!sealGeo) {
    const paw = pawField();
    const discR = (x, y, z) => Math.max(Math.hypot(x, y) - 0.96, Math.abs(z + 0.02) - 0.045);
    const rim = (x, y, z) => Math.hypot(Math.hypot(x, y) - 0.86, z - 0.03) - 0.035;
    const raised = (x, y, z) => Math.max(paw(x * 1.25, y * 1.25 - 0.02, (z - 0.02) * 1.5) / 1.25, -z + 0.0);
    const f = union([[discR, 0], [rim, 0.02], [raised, 0.025]]);
    sealGeo = meshSDF((x, y, z) => f(x, y, z) - 0.004, [-1.05, -1.05, -0.12], [1.05, 1.05, 0.14], 150, {
      attrs: { pat: [3, (p) => [ss(0.03, 0.045, p.z), 0, 0]] },
    });
  }
  const m = new THREE.Mesh(sealGeo, paintedMaterial({ base: tone(C.terra, 0.95), x: tone(C.cream, 1, 0.2) }, { roughness: 0.55, rim: 0.05, key: 'seal' }));
  m.scale.setScalar(radius);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------- governor's chair: tall upholstered back, rolled arms, dark wood frame (faces +z, seat at y = 0.5)
export function governorChair({ fabric = S.blueDark, wood = S.woodDark } = {}) {
  const g = new THREE.Group();
  const up = clay(fabric, 0.78), wd = clay(wood, 0.6);
  g.add(mesh(rbox(0.72, 0.16, 0.66, 0.07), up, { pos: [0, 0.48, 0.02] })); // seat cushion
  g.add(mesh(rbox(0.74, 0.12, 0.7, 0.03), wd, { pos: [0, 0.38, 0.0] })); // seat frame
  g.add(mesh(rbox(0.76, 1.12, 0.18, 0.08), up, { pos: [0, 1.0, -0.3], rot: [-0.08, 0, 0] })); // back
  g.add(mesh(rbox(0.6, 0.86, 0.06, 0.03), clay(tone(fabric, 0.85), 0.8), { pos: [0, 1.02, -0.2], rot: [-0.08, 0, 0] })); // tufted panel
  for (const s of [-1, 1]) {
    g.add(mesh(rbox(0.12, 0.26, 0.62, 0.05), up, { pos: [s * 0.37, 0.66, 0.0] }));
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 20), up, { pos: [s * 0.37, 0.8, 0.0], rot: [Math.PI / 2, 0, 0] }));
    for (const z of [-0.28, 0.28]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.34, 12), wd, { pos: [s * 0.32, 0.17, z] }));
  }
  // buttons on the tufted back
  const btn = new THREE.SphereGeometry(0.018, 10, 8), bm = clay(tone(fabric, 0.7), 0.6);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) g.add(mesh(btn, bm, { pos: [(i - 1) * 0.18, 0.78 + j * 0.2, -0.165 - j * 0.016], cast: false }));
  return g;
}

// ---------- desk: dark wood, lighter top, drawers with brass-coloured (cream) knobs (faces +z)
export function desk({ w = 1.8, d = 0.86, h = 0.78 } = {}) {
  const g = new THREE.Group();
  const wd = clay(S.woodDark, 0.62), top = clay(S.wood, 0.55), knob = clay(tone(C.cream, 1, 0.1), 0.5);
  g.add(mesh(rbox(w + 0.08, 0.06, d + 0.08, 0.02), top, { pos: [0, h - 0.03, 0] }));
  for (const s of [-1, 1]) {
    g.add(mesh(rbox(0.5, h - 0.08, d, 0.02), wd, { pos: [s * (w / 2 - 0.25), (h - 0.06) / 2, 0] }));
    for (let i = 0; i < 3; i++) {
      g.add(mesh(rbox(0.42, 0.18, 0.02, 0.008), clay(tone(S.woodDark, 1.15), 0.6), { pos: [s * (w / 2 - 0.25), 0.14 + i * 0.21, d / 2 + 0.005], cast: false }));
      g.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), knob, { pos: [s * (w / 2 - 0.25), 0.14 + i * 0.21, d / 2 + 0.025], cast: false }));
    }
  }
  g.add(mesh(rbox(w - 1.0, 0.5, 0.04, 0.01), wd, { pos: [0, h - 0.3, -d / 2 + 0.05] })); // modesty panel
  return g;
}

// ---------- small desk things
export function paperStack(n = 6, seed = 3) {
  const g = new THREE.Group(), R = rng(seed);
  const m = clay(tone(C.cream, 1, 0.45), 0.8);
  for (let i = 0; i < n; i++) g.add(mesh(new THREE.BoxGeometry(0.22, 0.006, 0.3), m, { pos: [(R() - 0.5) * 0.02, 0.003 + i * 0.007, (R() - 0.5) * 0.02], rot: [0, (R() - 0.5) * 0.12, 0] }));
  return g;
}
export function deskLamp() {
  const g = new THREE.Group();
  const base = clay(S.woodDark, 0.5), shade = clay(tone(C.cream, 1, 0.2), 0.7);
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 24), base, { pos: [0, 0.015, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10), base, { pos: [0, 0.2, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.15, 0.14, 28, 1, true), shade, { pos: [0, 0.4, 0] }));
  return g;
}
export function rubberStamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 20), clay(S.terra, 0.6), { pos: [0, 0.02, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 14), clay(S.woodDark, 0.6), { pos: [0, 0.075, 0] }));
  g.add(mesh(new THREE.SphereGeometry(0.035, 16, 12), clay(S.woodDark, 0.6), { pos: [0, 0.12, 0] }));
  return g;
}

/** Potted plant: terracotta pot, round leafy crown (leafy green = living things). */
export function plant({ h = 1.0, seed = 5 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.36, 24), clay(S.terraDark, 0.8), { pos: [0, 0.18, 0] }));
  g.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), clay(S.terraDark, 0.8), { pos: [0, 0.36, 0], rot: [Math.PI / 2, 0, 0] }));
  const leaf = clay(S.green, 0.75), leaf2 = clay(S.greenDark, 0.75);
  const geo = new THREE.SphereGeometry(1, 20, 14);
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2, r = 0.05 + R() * 0.16, y = 0.42 + (h - 0.5) * (0.35 + R() * 0.6);
    const s = 0.14 + R() * 0.1;
    const m = mesh(geo, i % 3 ? leaf : leaf2, { pos: [Math.cos(a) * r, y, Math.sin(a) * r] });
    m.scale.set(s, s * 0.9, s);
    g.add(m);
  }
  return g;
}

/** Bookshelf with rows of books in palette shades. */
export function bookshelf({ w = 1.4, h = 2.2, d = 0.36, seed = 9, shelves = 5 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  const wd = clay(S.wood, 0.65);
  g.add(mesh(rbox(w, h, 0.03, 0.01), clay(tone(S.wood, 0.8), 0.7), { pos: [0, h / 2, -d / 2 + 0.015] }));
  for (const s of [-1, 1]) g.add(mesh(rbox(0.04, h, d, 0.012), wd, { pos: [s * (w / 2 - 0.02), h / 2, 0] }));
  const cols = [S.blueDark, S.terraDark, tone(C.cream, 0.85), S.greenDark, S.blue, tone(C.cream, 0.6), S.terra];
  for (let i = 0; i <= shelves; i++) {
    const y = 0.05 + (i * (h - 0.1)) / shelves;
    g.add(mesh(rbox(w - 0.06, 0.035, d - 0.02, 0.01), wd, { pos: [0, y, 0] }));
    if (i === shelves) break;
    let x = -w / 2 + 0.07;
    while (x < w / 2 - 0.12) {
      const bw = 0.035 + R() * 0.03, bh = (h / shelves) * (0.55 + R() * 0.3);
      if (R() < 0.08) { x += 0.12; continue; }
      const lean = R() < 0.1 ? 0.18 : 0;
      g.add(mesh(rbox(bw, bh, d * 0.7, 0.006, 1), clay(cols[Math.floor(R() * cols.length)], 0.75), { pos: [x + bw / 2, y + 0.02 + bh / 2, 0.02], rot: [0, 0, lean], cast: false }));
      x += bw + 0.004;
    }
  }
  return g;
}

/** Open cardboard box (the cats' favourite thing). Cardboard = a tan shade of cream. */
export function cardboardBox({ w = 0.5, h = 0.32, d = 0.4, flaps = true } = {}) {
  const g = new THREE.Group();
  const card = clay(mixc(tone(C.cream, 0.72), C.terra, 0.12), 0.85), inside = clay(mixc(tone(C.cream, 0.55), C.terra, 0.12), 0.9);
  const t = 0.012;
  g.add(mesh(new THREE.BoxGeometry(w, t, d), inside, { pos: [0, t / 2, 0] }));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.BoxGeometry(w, h, t), card, { pos: [0, h / 2, s * (d / 2 - t / 2)] }));
    g.add(mesh(new THREE.BoxGeometry(t, h, d), card, { pos: [s * (w / 2 - t / 2), h / 2, 0] }));
    if (flaps) {
      const f1 = mesh(new THREE.BoxGeometry(w, t, d * 0.48), card, { pos: [0, h, s * (d / 2 + d * 0.2)], rot: [s * 0.5, 0, 0] });
      const f2 = mesh(new THREE.BoxGeometry(w * 0.48, t, d), card, { pos: [s * (w / 2 + w * 0.2), h, 0], rot: [0, 0, -s * 0.6] });
      g.add(f1, f2);
    }
  }
  // a strip of tape
  g.add(mesh(new THREE.BoxGeometry(0.06, h * 0.6, 0.002), clay(tone(C.cream, 0.9), 0.4), { pos: [0, h * 0.7, d / 2 + 0.002], cast: false }));
  return g;
}

/** A soft round cushion / cat bed. */
export function cushion({ w = 0.6, d = 0.5, h = 0.14, color = S.terra, piping = null } = {}) {
  const g = new THREE.Group();
  const m = mesh(rbox(w, h, d, h * 0.48, 4), clay(color, 0.85), {});
  m.position.y = h / 2;
  g.add(m);
  if (piping) {
    const p = mesh(new THREE.TorusGeometry(1, 0.02, 6, 48), clay(piping, 0.7), { pos: [0, h / 2, 0], rot: [Math.PI / 2, 0, 0], cast: false });
    p.scale.set(w / 2 - 0.01, d / 2 - 0.01, 1);
    g.add(p);
  }
  return g;
}

/** A pet bowl: rounded terracotta (food) or blue-glazed (water). */
export function bowl({ r = 0.2, h = 0.09, kind = 'food' } = {}) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(r * (0.72 + 0.28 * Math.sin((t * Math.PI) / 2)), h * t)); }
  for (let i = 12; i >= 0; i--) { const t = i / 12; pts.push(new THREE.Vector2(r * (0.6 + 0.28 * Math.sin((t * Math.PI) / 2)), h * 0.2 + h * 0.75 * t)); }
  const outer = kind === 'food' ? clay(S.terra, 0.6) : clay(tone(C.blue, 1, 0.25), 0.4);
  g.add(mesh(new THREE.LatheGeometry(pts, 48), outer, {}));
  if (kind === 'food') {
    const kib = clay(mixc(tone(C.cream, 0.5), C.terra, 0.35), 0.8), R = rng(4), geo = new THREE.SphereGeometry(1, 8, 6);
    const n = 60;
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * r * 0.62;
      const k = mesh(geo, kib, { pos: [Math.cos(a) * rr, h * (0.55 + 0.35 * (1 - rr / (r * 0.62))) , Math.sin(a) * rr], cast: false });
      k.scale.set(r * 0.08, r * 0.06, r * 0.08);
      g.add(k);
    }
  } else {
    const w = new THREE.Mesh(new THREE.CircleGeometry(r * 0.8, 40), glossy(tone(C.blue, 0.9, 0.2), { roughness: 0.1, reflect: 1 }));
    w.rotation.x = -Math.PI / 2;
    w.position.y = h * 0.78;
    g.add(w);
  }
  return g;
}

/** A sisal-wrapped scratching post / column (terracotta-tan bands). */
export function sisalMaterial(base = mixc(tone(C.cream, 0.7), C.terra, 0.2)) {
  const m = clay(base, 0.9);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float band = 0.5 + 0.5 * sin(vOP.y * 260.0 + atan(vOP.z, vOP.x) * 1.0);
        diffuseColor.rgb *= 0.86 + 0.18 * band;`);
  };
  return m;
}

/** A flag on a pole: draped cream cloth with the terracotta paw seal (the realm's flag). */
export function pawFlag({ h = 2.4 } = {}) {
  const g = new THREE.Group();
  const wd = clay(S.woodDark, 0.5), brass = clay(tone(C.cream, 1, 0.1), 0.45);
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 28), wd, { pos: [0, 0.03, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.022, h, 12), wd, { pos: [0, h / 2, 0] }));
  g.add(mesh(new THREE.SphereGeometry(0.045, 16, 12), brass, { pos: [0, h + 0.03, 0] }));
  // cloth: hangs from the top of the pole in soft vertical folds
  const cw = 0.62, ch = 1.0;
  const geo = new THREE.PlaneGeometry(cw, ch, 40, 30);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) + cw / 2, y = P.getY(i);
    const hang = (ch / 2 - y) / ch; // 0 at the top, 1 at the bottom
    P.setZ(i, Math.sin(x * 15) * 0.035 * (0.4 + hang) + Math.sin(x * 6.3 + 1) * 0.02);
    P.setX(i, P.getX(i) * (1 - 0.18 * hang) - 0.04 * hang);
  }
  geo.computeVertexNormals();
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 400;
  const x2 = cv.getContext('2d');
  x2.fillStyle = '#' + tone(C.cream, 1, 0.15).getHexString(); x2.fillRect(0, 0, 256, 400);
  x2.fillStyle = '#' + C.terra.getHexString(); x2.fillRect(0, 360, 256, 40);
  x2.beginPath(); x2.arc(128, 180, 78, 0, Math.PI * 2); x2.fill();
  x2.fillStyle = '#' + tone(C.cream, 1, 0.15).getHexString();
  x2.beginPath(); x2.ellipse(128, 200, 30, 24, 0, 0, Math.PI * 2); x2.fill();
  for (const [dx, dy] of [[-34, -16], [-12, -38], [12, -38], [34, -16]]) { x2.beginPath(); x2.ellipse(128 + dx, 180 + dy, 11, 14, 0, 0, Math.PI * 2); x2.fill(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const cloth = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }), { pos: [cw / 2 + 0.02, h - ch / 2 - 0.05, 0] });
  g.add(cloth);
  return g;
}

/** A small framed painting (simple California landscapes drawn in palette colours). */
export function framedPicture({ w = 0.5, h = 0.4, kind = 0 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(rbox(w + 0.08, h + 0.08, 0.04, 0.012), clay(S.woodDark, 0.55), { pos: [0, 0, 0.02] }));
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = Math.round((256 * h) / w);
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const hex = (col) => '#' + col.getHexString();
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, hex(tone(C.blue, 1, 0.3))); sky.addColorStop(1, hex(tone(C.cream, 1, 0.3)));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  if (kind === 0) {
    c.fillStyle = hex(tone(C.green, 0.85)); c.beginPath(); c.moveTo(0, H * 0.7); c.quadraticCurveTo(W * 0.3, H * 0.45, W * 0.6, H * 0.62); c.quadraticCurveTo(W * 0.85, H * 0.5, W, H * 0.6); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = hex(tone(C.green, 0.65)); c.beginPath(); c.moveTo(0, H * 0.85); c.quadraticCurveTo(W * 0.5, H * 0.7, W, H * 0.82); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  } else {
    c.fillStyle = hex(tone(C.blue, 0.85)); c.fillRect(0, H * 0.62, W, H * 0.38);
    c.fillStyle = hex(tone(C.cream, 0.8)); c.beginPath(); c.moveTo(0, H * 0.62); c.lineTo(W * 0.25, H * 0.3); c.lineTo(W * 0.45, H * 0.62); c.fill();
    c.fillStyle = hex(C.terra); c.fillRect(W * 0.62, H * 0.5, W * 0.05, H * 0.14);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), { pos: [0, 0, 0.042], cast: false }));
  return g;
}

/** Palm tree: a gently curved ringed trunk and a crown of arching fronds (Los Angeles, Palm Springs). */
export function palmTree({ h = 5, seed = 1, lean = 0.25 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  const dir = R() * Math.PI * 2;
  const top = new THREE.Vector3(Math.cos(dir) * lean * h * 0.3, h, Math.sin(dir) * lean * h * 0.3);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(top.x * 0.2, h * 0.5, top.z * 0.2), top);
  const trunkGeo = new THREE.TubeGeometry(curve, 24, 1, 10, false);
  // taper the tube: radius from 0.16 at the base to 0.1 at the crown
  const P = trunkGeo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const seg = Math.floor(i / 11) / 24;
    const c = curve.getPointAt(Math.min(1, seg));
    const r = 0.17 - 0.07 * seg;
    P.setXYZ(i, c.x + (P.getX(i) - c.x) * r, c.y + (P.getY(i) - c.y) * r, c.z + (P.getZ(i) - c.z) * r);
  }
  trunkGeo.computeVertexNormals();
  const trunk = mesh(trunkGeo, sisalMaterial(mixc(tone(C.cream, 0.66), C.terra, 0.18)), {});
  g.add(trunk);
  const leafMat = clay(S.green, 0.7, { side: THREE.DoubleSide }), leafMat2 = clay(S.greenDark, 0.7, { side: THREE.DoubleSide });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.3, len = 1.7 + R() * 0.5, droop = 0.6 + R() * 0.5;
    const pts = [], seg = 14, geo = new THREE.BufferGeometry(), pos = [], idx = [];
    for (let k = 0; k <= seg; k++) {
      const u = k / seg, w = 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 0.02;
      const x = u * len, y = 0.35 * u - droop * u * u;
      pts.push([x, y, w]);
      pos.push(x, y + w * 0.25, -w, x, y + w * 0.25, w, x, y, 0);
    }
    for (let k = 0; k < seg; k++) {
      const b = k * 3;
      idx.push(b + 2, b + 5, b, b, b + 5, b + 3, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const leaf = mesh(geo, i % 2 ? leafMat : leafMat2, { pos: [top.x, top.y, top.z], rot: [0, a, 0] });
    g.add(leaf);
  }
  g.add(mesh(new THREE.SphereGeometry(0.16, 14, 10), clay(mixc(tone(C.cream, 0.5), C.terra, 0.3), 0.7), { pos: [top.x, top.y - 0.08, top.z] }));
  return g;
}

/** A small toy car in coastal-blue shades or cream (cool = human). Faces +x. */
export function toyCar({ color = S.blue, scale = 1 } = {}) {
  const g = new THREE.Group();
  const body = clay(color, 0.5), glass = clay(tone(C.blue, 0.35), 0.25), tyre = clay(tone(C.cream, 0.18), 0.8);
  g.add(mesh(rbox(1.0, 0.28, 0.5, 0.1), body, { pos: [0, 0.24, 0] }));
  g.add(mesh(rbox(0.56, 0.24, 0.44, 0.1), body, { pos: [-0.06, 0.44, 0] }));
  g.add(mesh(rbox(0.5, 0.17, 0.46, 0.06), glass, { pos: [-0.06, 0.45, 0], cast: false }));
  const wg = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14);
  for (const x of [-0.3, 0.3]) for (const z of [-0.24, 0.24]) g.add(mesh(wg, tyre, { pos: [x, 0.11, z], rot: [Math.PI / 2, 0, 0], cast: false }));
  g.scale.setScalar(scale);
  return g;
}

/**
 * Sweep a 2d profile (array of [u, v] around the cross-section, counter-clockwise) along a 3d curve.
 * Flat across the profile, smooth along the path. Returns a BufferGeometry with a `along` attribute (0..1).
 */
export function sweepProfile(curve, profile, samples = 80, closed = true) {
  const pos = [], nrm = [], along = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), Rv = new THREE.Vector3(), U = new THREE.Vector3(), Pt = new THREE.Vector3();
  const nE = closed ? profile.length : profile.length - 1;
  const frames = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    curve.getPointAt(t, Pt);
    curve.getTangentAt(t, T);
    Rv.crossVectors(T, up).normalize();
    U.crossVectors(Rv, T).normalize();
    frames.push([Pt.clone(), Rv.clone(), U.clone()]);
  }
  for (let e = 0; e < nE; e++) {
    const [u0, v0] = profile[e], [u1, v1] = profile[(e + 1) % profile.length];
    const du = u1 - u0, dv = v1 - v0, l = Math.hypot(du, dv);
    const nu = dv / l, nv = -du / l; // outward for a counter-clockwise profile
    const base = pos.length / 3;
    for (let i = 0; i <= samples; i++) {
      const [P0, R0, U0] = frames[i];
      for (const [u, v] of [[u0, v0], [u1, v1]]) {
        pos.push(P0.x + R0.x * u + U0.x * v, P0.y + R0.y * u + U0.y * v, P0.z + R0.z * u + U0.z * v);
        nrm.push(R0.x * nu + U0.x * nv, R0.y * nu + U0.y * nv, R0.z * nu + U0.z * nv);
        along.push(i / samples);
      }
    }
    for (let i = 0; i < samples; i++) {
      const a = base + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
  g.setIndex(idx);
  return g;
}

/** Lollipop shrub / small tree (leafy green). */
export function shrub({ r = 0.3, stem = 0.15, seed = 1, dark = false } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  if (stem > 0) g.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, stem + r * 0.5, 8), clay(S.woodDark, 0.7), { pos: [0, (stem + r * 0.5) / 2, 0] }));
  const m = mesh(new THREE.SphereGeometry(r, 18, 12), clay(dark ? S.greenDark : S.green, 0.78), { pos: [0, stem + r * 0.8, 0] });
  m.scale.set(1, 0.9 + R() * 0.2, 1);
  g.add(m);
  return g;
}
