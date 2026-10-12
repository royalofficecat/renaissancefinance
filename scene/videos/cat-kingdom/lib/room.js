// A cut-away room, like a dolls' house: floor slab with a visible cut edge, a back wall and a left wall
// with tall windows; the front and right are open to the camera. Invisible shadow casters (a ceiling and the
// outside of the building) make sure sunlight only enters through the windows, so it lands in clear pools.
import * as THREE from 'three';
import { C, S, clay, tone } from '../look.js';
import { mesh, rbox } from './props.js';
import { rng } from '../../../src/core/util.js';

const worldPos = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
};

/** Wooden parquet: planks drawn in the shader from world position (no textures). */
export function parquet(color = S.wood) {
  const m = clay(color, 0.62);
  m.onBeforeCompile = (sh) => {
    worldPos(sh);
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

/** Square floor tiles (two shades), e.g. a kitchen or a lab. */
export function tiles(a = tone(C.cream, 0.95), b = tone(C.cream, 0.82), size = 0.4) {
  const m = clay(0xffffff, 0.5);
  m.onBeforeCompile = (sh) => {
    worldPos(sh);
    sh.uniforms.uA = { value: a };
    sh.uniforms.uB = { value: b };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform vec3 uA, uB;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 c = floor(vWP.xz / ${size.toFixed(3)});
        vec2 f = fract(vWP.xz / ${size.toFixed(3)});
        float grout = smoothstep(0.0, 0.025, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
        vec3 col = mod(c.x + c.y, 2.0) < 1.0 ? uA : uB;
        diffuseColor.rgb = col * mix(0.78, 1.0, grout);`);
  };
  return m;
}

/** Cheap ambient occlusion: indirect light darkens softly towards the floor and into the back-left corner. */
export function occluded(mat, R) {
  mat.onBeforeCompile = (sh) => {
    worldPos(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float occ = mix(0.62, 1.0, smoothstep(0.0, 0.9, vWP.y)) * mix(0.7, 1.0, smoothstep(0.0, 1.2, vWP.x - ${R.x0.toFixed(2)})) * mix(0.72, 1.0, smoothstep(0.0, 1.0, vWP.z - ${R.z0.toFixed(2)}));
        reflectedLight.indirectDiffuse *= occ;`);
  };
  return mat;
}

/**
 * Build the room shell.
 * @param {object} R { x0, x1, z0, z1, h } room bounds (floor at y = 0)
 * @param {object} o { windows: [{z0, z1, y0, y1}] on the left wall, floor material, wall tone, pilasters x list, wainscot }
 */
export function buildRoom(R, { windows = [], floor = parquet(), wall = tone(C.cream, 0.9), wainscot = tone(C.cream, 0.8), pilasters = [], panels = true, slab = tone(C.cream, 0.9), ghosts = true } = {}) {
  const g = new THREE.Group();
  const plaster = occluded(clay(wall, 0.85), R), wain = wainscot ? occluded(clay(wainscot, 0.75), R) : null, trim = clay(tone(C.cream, 1, 0.25), 0.6);
  const W = R.x1 - R.x0, D = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  g.add(mesh(new THREE.BoxGeometry(W, 0.02, D), floor, { pos: [cx, -0.01, cz] }));
  g.add(mesh(rbox(W + 0.24, 0.32, D + 0.02, 0.03), clay(slab, 0.8), { pos: [cx - 0.12, -0.18, cz] }));
  // back wall: wainscot, chair rail, crown moulding, skirting, pilasters
  g.add(mesh(new THREE.BoxGeometry(W + 0.24, R.h, 0.24), plaster, { pos: [cx - 0.12, R.h / 2, R.z0 - 0.12] }));
  if (wainscot) {
    g.add(mesh(new THREE.BoxGeometry(W, 1.0, 0.03), wain, { pos: [cx, 0.5, R.z0 + 0.015] }));
    g.add(mesh(rbox(W, 0.07, 0.06, 0.02), trim, { pos: [cx, 1.02, R.z0 + 0.03] }));
  }
  g.add(mesh(rbox(W, 0.16, 0.1, 0.03), trim, { pos: [cx, R.h - 0.08, R.z0 + 0.05] }));
  g.add(mesh(rbox(W, 0.12, 0.05, 0.02), trim, { pos: [cx, 0.06, R.z0 + 0.025] }));
  for (const x of pilasters) g.add(mesh(rbox(0.3, R.h - 0.2, 0.08, 0.02), trim, { pos: [x, (R.h - 0.2) / 2, R.z0 + 0.04] }));
  if (wainscot && panels) for (let x = R.x0 + 0.5; x < R.x1 - 0.4; x += 0.75) g.add(mesh(rbox(0.6, 0.62, 0.02, 0.01), clay(tone(wainscot, 1.12), 0.75), { pos: [x + 0.3, 0.52, R.z0 + 0.04], cast: false }));

  // left wall, with openings for the windows
  const t = 0.24, x = R.x0 - t / 2;
  const box = (z0, z1, y0, y1) => { if (z1 - z0 > 1e-3 && y1 - y0 > 1e-3) g.add(mesh(new THREE.BoxGeometry(t, y1 - y0, z1 - z0), plaster, { pos: [x, (y0 + y1) / 2, (z0 + z1) / 2] })); };
  const ws = [...windows].sort((a, b) => a.z0 - b.z0);
  let z = R.z0;
  for (const w of ws) {
    box(z, w.z0, 0, R.h);
    box(w.z0, w.z1, 0, w.y0);
    box(w.z0, w.z1, w.y1, R.h);
    z = w.z1;
    // frame, sill and mullions (they cast the window-pane shadow into the sun patch)
    const fz = (w.z0 + w.z1) / 2, fw = w.z1 - w.z0, fh = w.y1 - w.y0;
    g.add(mesh(rbox(0.1, 0.08, fw + 0.22, 0.02), trim, { pos: [x + 0.1, w.y0 - 0.02, fz] }));
    for (const s of [-1, 1]) g.add(mesh(rbox(0.06, fh + 0.1, 0.09, 0.015), trim, { pos: [x + 0.07, (w.y0 + w.y1) / 2, fz + s * (fw / 2 + 0.03)] }));
    g.add(mesh(rbox(0.06, 0.09, fw + 0.1, 0.015), trim, { pos: [x + 0.07, w.y1 + 0.03, fz] }));
    g.add(mesh(new THREE.BoxGeometry(0.04, fh, 0.04), trim, { pos: [x, (w.y0 + w.y1) / 2, fz] }));
    for (const y of [w.y0 + fh * 0.36, w.y0 + fh * 0.7]) g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, fw), trim, { pos: [x, y, fz] }));
  }
  box(z, R.z1, 0, R.h);
  if (wainscot) {
    g.add(mesh(new THREE.BoxGeometry(0.03, 1.0, D), wain, { pos: [R.x0 + 0.015, 0.5, cz] }));
    g.add(mesh(rbox(0.06, 0.07, D, 0.02), trim, { pos: [R.x0 + 0.03, 1.02, cz] }));
  }
  g.add(mesh(rbox(0.1, 0.16, D, 0.03), trim, { pos: [R.x0 + 0.05, R.h - 0.08, cz] }));

  // invisible shadow casters: ceiling (not over the outside of the window wall) and the building's outer wall
  const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  if (ghosts) g.add(mesh(new THREE.BoxGeometry(W + 8, 0.2, D + 12), ghost, { pos: [R.x0 - 0.24 + (W + 8) / 2, R.h + 0.1, R.z0 - 0.3 + (D + 12) / 2], receive: false }));
  if (ghosts) g.add(mesh(new THREE.BoxGeometry(0.2, R.h, 10), ghost, { pos: [R.x0 - 0.15, R.h / 2, R.z1 + 5], receive: false }));
  return { group: g, plaster, trim, wain };
}

/** Soft additive shaft of sunlight from a left-wall window to the floor. */
export function lightShaft(R, w, keyDir, k = 0.14) {
  const corners = [[w.z0, w.y0], [w.z1, w.y0], [w.z1, w.y1], [w.z0, w.y1]].map(([z, y]) => new THREE.Vector3(R.x0 - 0.05, y, z));
  const d = keyDir.clone().negate();
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
    uniforms: { uCol: { value: tone(C.gold, 1.0) }, uK: { value: k } },
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

/** Slow dust motes drifting in a window's sunbeam. Returns { points, update(t) }. */
export function dustMotes(R, w, keyDir, dpr, n = 70, seed = 21) {
  const r = rng(seed), seeds = [];
  const dg = new THREE.BufferGeometry(), dp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) seeds.push([r(), r(), r(), r()]);
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: 5.0 * dpr }, uCol: { value: tone(C.gold, 1.0, 0.3) } },
    vertexShader: 'uniform float uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * 3.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol * (1.0 - smoothstep(0.2, 0.5, d)) * 0.35, 1.0); }',
  });
  dm.toneMapped = false;
  const points = new THREE.Points(dg, dm);
  const travel = keyDir.clone().negate(), p = new THREE.Vector3();
  return {
    points,
    update(t) {
      for (let i = 0; i < n; i++) {
        const [a, b, c, d] = seeds[i];
        const y = w.y0 + (w.y1 - w.y0) * b;
        const s = (0.15 + 0.85 * ((a + t * 0.012 * (0.5 + d)) % 1)) * (y / -travel.y);
        p.set(R.x0, y, w.z0 + (w.z1 - w.z0) * c).addScaledVector(travel, s);
        p.y += Math.sin(t * 0.4 + d * 20) * 0.04;
        dp.set([p.x, p.y, p.z], i * 3);
      }
      dg.attributes.position.needsUpdate = true;
    },
  };
}
