// Building blocks for the "premium toy" dioramas: a terrain block with layered, cut-away sides
// (which can fill with water), lollipop trees, toy houses, cloud puffs and seeded rain.
import * as THREE from 'three';
import { C, clay } from './look.js';
import { rng } from './util.js';

/**
 * Terrain block: heightfield top plus four side walls showing soil layers.
 * @param {object} o {sx, sz, nx, nz, height(x,z), base, topMat, layers: [{depth, color}], uniforms}
 */
export function heightBlock({ sx, sz, nx, nz, height, base = -1, topMat, layers, sideUniforms = {} }) {
  const group = new THREE.Group();
  const top = new THREE.PlaneGeometry(sx, sz, nx, nz);
  top.rotateX(-Math.PI / 2);
  const P = top.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, height(P.getX(i), P.getZ(i)));
  top.computeVertexNormals();
  const topMesh = new THREE.Mesh(top, topMat);
  topMesh.receiveShadow = true;
  topMesh.castShadow = true;
  group.add(topMesh);

  // Side walls: one strip per edge; `surf` = ground height above each vertex
  const pos = [], surf = [], idx = [], nrm = [];
  const edge = (x0, z0, x1, z1, n, nx_, nz_) => {
    const start = pos.length / 3;
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n, h = height(x, z);
      pos.push(x, h, z, x, base, z);
      surf.push(h, h);
      nrm.push(nx_, 0, nz_, nx_, 0, nz_);
    }
    for (let k = 0; k < n; k++) {
      const a = start + k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  const hx = sx / 2, hz = sz / 2;
  edge(-hx, hz, hx, hz, nx, 0, 1); // front (+z)
  edge(hx, -hz, -hx, -hz, nx, 0, -1); // back
  edge(hx, hz, hx, -hz, nz, 1, 0); // right
  edge(-hx, -hz, -hx, hz, nz, -1, 0); // left
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('surf', new THREE.Float32BufferAttribute(surf, 1));
  g.setIndex(idx);
  const sideMat = layeredMaterial(layers, sideUniforms);
  const sides = new THREE.Mesh(g, sideMat);
  sides.castShadow = true;
  sides.receiveShadow = true;
  group.add(sides);
  // Base plate edge so the block reads as a solid object
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.04, sz), clay(C.subject.clone().multiplyScalar(0.35), 0.8));
  bottom.position.y = base - 0.02;
  group.add(bottom);
  return { group, topMesh, sides, sideMat, positions: P };
}

/**
 * Cut-away soil layers. Optional water: uWet (depth of the wetting front below the surface),
 * uTable (water-table height, world y), uPlume (centre/radius of a recharge plume, xyz + r),
 * uPoreCol (colour of filled pores).
 */
export function layeredMaterial(layers, extra = {}) {
  const m = clay(0xffffff, 0.86);
  const U = {
    uWet: { value: 0 }, uTable: { value: -99 }, uPlume: { value: new THREE.Vector4(0, 0, 0, 0) },
    uPoreCol: { value: C.water.clone() }, uPlumeCol: { value: C.green.clone() },
    ...extra,
  };
  m.userData.U = U;
  const cols = layers.map((l) => `vec3(${l.color.r.toFixed(4)}, ${l.color.g.toFixed(4)}, ${l.color.b.toFixed(4)})`);
  const depths = layers.map((l) => l.depth.toFixed(3));
  let chain = `vec3 lc = ${cols[cols.length - 1]};\n`;
  for (let i = layers.length - 2; i >= 0; i--) chain += `if (d < ${depths[i]} + wob) lc = ${cols[i]};\n`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float surf; varying float vSurf; varying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = surf; vW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vSurf; varying vec3 vW;
        uniform float uWet, uTable; uniform vec4 uPlume; uniform vec3 uPoreCol, uPlumeCol;
        float hh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float d = vSurf - vW.y;
        vec2 q = vec2(vW.x + vW.z, vW.y);
        float wob = 0.04 * sin(q.x * 3.1) + 0.03 * sin(q.x * 7.3 + 1.0);
        ${chain}
        // Grains / pores: a soft dot pattern that fills with water
        vec2 cell = floor(q * 11.0); vec2 f = fract(q * 11.0) - 0.5;
        vec2 o = vec2(hh(cell), hh(cell + 7.1)) - 0.5;
        float dotM = 1.0 - smoothstep(0.16, 0.26, length(f - o * 0.4));
        float wet = step(d, uWet) + step(vW.y, uTable);
        float plume = 0.0;
        if (uPlume.w > 0.0) { vec2 pd = (vW.xy - uPlume.xy) / vec2(uPlume.w * 1.6, uPlume.w); plume = 1.0 - smoothstep(0.85, 1.0, length(pd)); plume *= step(d, 99.0); }
        float filled = clamp(wet, 0.0, 1.0);
        vec3 pore = mix(uPoreCol, uPlumeCol, plume);
        float soak = max(filled, plume);
        lc = mix(lc, mix(lc * 0.8, pore * 0.8, 0.22), soak);
        lc = mix(lc, pore * 1.35, dotM * soak * 0.9);
        lc = mix(lc, lc * 0.78, dotM * (1.0 - soak) * 0.6);
        // a thin bright line marks the wetting front and the water table
        lc = mix(lc, pore * 1.6, (1.0 - smoothstep(0.0, 0.035, abs(d - uWet))) * step(0.02, uWet) * 0.8);
        lc = mix(lc, pore * 1.6, (1.0 - smoothstep(0.0, 0.03, abs(vW.y - uTable))) * 0.8);
        diffuseColor.rgb = lc;`);
  };
  return m;
}

const treeGeo = { trunk: new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8), crown: new THREE.SphereGeometry(0.26, 18, 12) };
export function tree(crownMat, trunkMat, s = 1) {
  const t = new THREE.Group();
  const tr = new THREE.Mesh(treeGeo.trunk, trunkMat); tr.position.y = 0.2;
  const cr = new THREE.Mesh(treeGeo.crown, crownMat); cr.position.y = 0.55; cr.scale.set(1, 1.15, 1);
  tr.castShadow = cr.castShadow = true;
  t.add(tr, cr);
  t.scale.setScalar(s);
  return t;
}

/** Toy house: body, gable roof, dark windows and door. Faces +z. */
export function house({ w = 1, h = 0.7, d = 0.9, body, roof, win, mud = null, mudH = 0.18 }) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), body); b.position.y = h / 2;
  b.castShadow = b.receiveShadow = true;
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.06, 0); sh.lineTo(w / 2 + 0.06, 0); sh.lineTo(0, h * 0.62); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.12, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.12) / 2);
  const r = new THREE.Mesh(rg, roof); r.position.y = h; r.castShadow = true;
  g.add(b, r);
  const wg = new THREE.BoxGeometry(0.18, 0.18, 0.02);
  for (const x of [-w * 0.27, w * 0.27]) { const wi = new THREE.Mesh(wg, win); wi.position.set(x, h * 0.6, d / 2 + 0.005); g.add(wi); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.02), win); door.position.set(0, 0.15, d / 2 + 0.005); g.add(door);
  if (mud) { const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, mudH, d + 0.012), mud); m.position.y = mudH / 2; g.add(m); }
  return g;
}

/** A soft cloud puff cluster (storm grey). */
export function cloud(mat, seed, scale = 1) {
  if (!mat.userData.lit) { mat.emissive = mat.color.clone().multiplyScalar(0.32); mat.userData.lit = true; }
  const r = rng(seed);
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 20, 14);
  for (let i = 0; i < 7; i++) {
    const s = 0.5 + r() * 0.6;
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(s * 1.2, s * 0.8, s);
    m.position.set((r() - 0.5) * 2.6, (r() - 0.3) * 0.5, (r() - 0.5) * 1.2);
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Seeded rain: streaks fall in a box; intensity 0..1 scales how many are visible. */
export function rain({ count = 1200, box = [12, 9, 8], top = 7, seed = 7 }) {
  const r = rng(seed);
  const geo = new THREE.BoxGeometry(0.012, 0.32, 0.012);
  const mat = new THREE.MeshBasicMaterial({ color: C.water.clone().lerp(new THREE.Color('#D9E6F2'), 0.6), transparent: true, opacity: 0.55, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const seeds = Array.from({ length: count }, () => [r() - 0.5, r(), r() - 0.5, 0.75 + r() * 0.5, r()]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.08)), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    mesh,
    update(time, intensity, ground = () => 0) {
      for (let i = 0; i < count; i++) {
        const [x, ph, z, sp, k] = seeds[i];
        const X = x * box[0], Z = z * box[2];
        const g = ground(X, Z);
        const fall = top - g;
        const y = top - ((ph * fall + time * 9 * sp) % fall);
        const on = k < intensity ? 1 : 0;
        p.set(X + (top - y) * 0.08, y, Z);
        s.setScalar(on);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
