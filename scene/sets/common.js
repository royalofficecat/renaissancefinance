// Shared bits for the small "premium toy" sets: seeded noise, cloud sprites, rain, pine trees.
import * as THREE from 'three';
import { seeded } from '../easing.js';

export function noise2(seed) {       // smooth value noise from a seeded table
  const rnd = seeded(seed), N = 64, tab = Float32Array.from({ length: N * N }, rnd);
  const at = (i, j) => tab[((j % N + N) % N) * N + ((i % N + N) % N)];
  return (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sy) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sy; };
}
export function fbm(n, x, y, oct = 4) { let a = 0, w = 0.5, s = 0; for (let o = 0; o < oct; o++) { a += n(x, y) * w; s += w; x *= 2.03; y *= 1.97; w *= 0.5; } return a / s; }

let cloudTex;
export function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128); grd.addColorStop(0, 'rgba(200,208,216,0.95)'); grd.addColorStop(0.5, 'rgba(178,188,198,0.5)'); grd.addColorStop(1, 'rgba(160,170,180,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  cloudTex = new THREE.CanvasTexture(c); cloudTex.colorSpace = THREE.SRGBColorSpace; return cloudTex;
}
export function makeClouds(group, seed, n, { x = [-2, 2], z = [-2, 2], h = [0.3, 0.45], size = [0.6, 1.2], color = 0xAEB6BE } = {}) {
  const rnd = seeded(seed), out = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, opacity: 0.7, color }));
    s.userData = { x: x[0] + rnd() * (x[1] - x[0]), z: z[0] + rnd() * (z[1] - z[0]), h: h[0] + rnd() * (h[1] - h[0]), size: size[0] + rnd() * (size[1] - size[0]), phase: rnd() * 6 };
    s.scale.setScalar(s.userData.size); s.position.set(s.userData.x, s.userData.h, s.userData.z); group.add(s); out.push(s);
  }
  return out;
}
export function driftClouds(clouds, t, opacity) { for (const s of clouds) { s.position.x = s.userData.x + Math.sin(t * 0.12 + s.userData.phase) * 0.04; s.material.opacity = opacity; } }

/** Rain: a cloud of short vertical streaks that fall and wrap, deterministic in t. */
export function makeRain(group, seed, n, box) {
  const rnd = seeded(seed);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 6), base = [];
  for (let i = 0; i < n; i++) base.push({ x: box.x[0] + rnd() * (box.x[1] - box.x[0]), z: box.z[0] + rnd() * (box.z[1] - box.z[0]), y0: rnd() * box.h, speed: box.speed * (0.8 + rnd() * 0.4), len: box.len * (0.7 + rnd() * 0.6) });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x9FC4E8, transparent: true, opacity: 0.35, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; group.add(lines);
  return { lines, update(t, intensity) {
    mat.opacity = 0.4 * intensity; lines.visible = intensity > 0.01;
    for (let i = 0; i < n; i++) { const b = base[i]; const y = box.h - ((b.y0 + t * b.speed) % box.h); const k = i * 6;
      pos[k] = b.x; pos[k + 1] = y; pos[k + 2] = b.z; pos[k + 3] = b.x + box.slant; pos[k + 4] = y + b.len; pos[k + 5] = b.z; }
    geo.attributes.position.needsUpdate = true;
  } };
}
export function makePine(scale, mat, trunkMat) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6), trunkMat); trunk.position.y = 0.25; g.add(trunk);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.42 - i * 0.1, 0.65, 8), mat); c.position.y = 0.55 + i * 0.32; c.castShadow = true; g.add(c); }
  g.scale.setScalar(scale); return g;
}
