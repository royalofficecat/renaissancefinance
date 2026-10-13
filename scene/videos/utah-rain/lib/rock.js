// Shared pieces for the sandstone dioramas: banded rock, falling rain, splash rings, flowing-water sheets.
// All painted from the video's palette (look.js); strata use object-space height so a mirrored copy
// (for still-water reflections) is painted exactly like the original.
import * as THREE from 'three';
import { C, S, clay, mixc, tone, water } from '../look.js';

/**
 * Sandstone: horizontal bands of red and darker red, a pale cream layer from `capFrom` to `capTo`
 * (object-space height), optional sand where it is flat and low, darkening with `wet` (0..1).
 */
export function sandstone({ capFrom = 1e3, capTo = 1e3 + 1, bands = 7, sandBelow = -1e3, scale = 1, roughness = 0.82 } = {}) {
  const U = {
    uWet: { value: 0 }, uRed: { value: S.red }, uRedDark: { value: S.redDark }, uCream: { value: S.cream }, uSand: { value: mixc(S.cream, S.red, 0.35) },
    uCap: { value: new THREE.Vector2(capFrom, capTo) }, uBands: { value: bands }, uSandBelow: { value: sandBelow }, uScale: { value: scale },
  };
  const m = clay(0xffffff, roughness);
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON; uniform float uWet, uBands, uSandBelow, uScale; uniform vec3 uRed, uRedDark, uCream, uSand; uniform vec2 uCap;
        float rh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(rh1(i), rh1(i+vec2(1,0)), u.x), mix(rh1(i+vec2(0,1)), rh1(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 p = vOP / uScale;
        float y = p.y + 0.06 * sin(p.x * 1.3 + p.z * 0.7) + 0.04 * rn2(p.xz * 2.0);
        float band = 0.5 + 0.5 * sin(y * uBands);
        vec3 c = mix(uRed, uRedDark, smoothstep(0.3, 0.7, band) * 0.4);
        float cap = smoothstep(uCap.x, uCap.y, y);
        c = mix(c, uCream * (0.92 + 0.08 * band), cap);
        c = mix(c, mix(uRed, uCream, cap) * 1.06, smoothstep(0.8, 1.0, vON.y) * 0.3);
        c = mix(c, uSand, smoothstep(0.8, 0.95, vON.y) * (1.0 - smoothstep(uSandBelow - 0.05, uSandBelow + 0.1, p.y)));
        c *= 0.93 + 0.1 * rh1(floor(p.xz * 16.0 + p.y * 7.0));
        c *= 1.0 - 0.28 * uWet;
        diffuseColor.rgb = c;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.45, uWet);');
  };
  return m;
}

/** Rain: thin streaks falling through a box that can follow the camera. */
export function rainField(scene, R, { n = 1800, w = 12, h = 7, d = 14, speed = 11, opacity = 0.32, len = 0.3, tilt = [0.12, 0, 0.06] } = {}) {
  const geo = new THREE.BoxGeometry(0.006, len, 0.006);
  const mat = new THREE.MeshBasicMaterial({ color: tone(C.water, 1, 0.65), transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const seeds = Array.from({ length: n }, () => [R() - 0.5, R(), R() - 0.5, 0.8 + R() * 0.4]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...tilt)), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  return {
    mesh,
    /** k: share of drops falling (0..1); box centred on `c` (x, z) from y = base to base + h */
    update(t, k, c, base = 0) {
      for (let i = 0; i < n; i++) {
        const [x, ph, z, sp] = seeds[i];
        v.set(c.x + x * w, base + h - ((ph * h + t * speed * sp) % h), c.z + z * d);
        m4.compose(v, q, i / n < k ? one : zero);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Expanding rings where drops land; `place(i)` returns [x, y, z] for ring i. */
export function splashRings(scene, R, count, place, { color = tone(C.cream, 1, 0.5), r0 = 0.02, r1 = 0.035 } = {}) {
  const rings = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.renderOrder = 3;
    scene.add(m);
    const p = place(i);
    m.position.set(...p);
    return { m, ph: R(), sp: 1.3 + R() };
  });
  return (t, k, grow = 2.2) => {
    for (const s of rings) {
      const p = (t * s.sp + s.ph) % 1;
      s.m.scale.setScalar(0.4 + p * grow);
      s.m.material.opacity = 0.5 * (1 - p) * k;
    }
  };
}

/**
 * A sheet of moving water (a waterfall or a surge front): turquoise with cream streaks that run along
 * the sheet's v direction. `uv.x` across, `uv.y` along the flow; `uProgress` reveals it along v.
 */
export function flowSheet({ color = tone(C.water, 0.85), foam = tone(C.cream, 1, 0.45), speed = 1.6, streakScale = [10, 3], opacity = 0.92, reflect = 0.6 } = {}) {
  const U = { uT: { value: 0 }, uProgress: { value: 1 }, uFoam: { value: foam.clone() }, uSpeed: { value: speed }, uStreak: { value: new THREE.Vector2(...streakScale) }, uOpacity: { value: opacity } };
  const m = water(color, { roughness: 0.12, transparent: true, reflect, side: THREE.DoubleSide, depthWrite: false });
  const prev = m.onBeforeCompile;
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    prev(sh);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFUv; uniform float uT, uProgress, uSpeed, uOpacity; uniform vec3 uFoam; uniform vec2 uStreak;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(fh(i), fh(i+vec2(1,0)), u.x), mix(fh(i+vec2(0,1)), fh(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vec2(vFUv.x * uStreak.x, vFUv.y * uStreak.y - uT * uSpeed);
        float streak = smoothstep(0.55, 0.85, fn2(q) * 0.6 + fn2(q * vec2(2.1, 1.7)) * 0.4);
        float edge = smoothstep(0.25, 0.5, abs(vFUv.x - 0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, clamp(streak * 0.6 + edge * 0.12, 0.0, 0.8));
        float head = 1.0 - smoothstep(uProgress - 0.04, uProgress, vFUv.y);
        float ragged = 0.42 - 0.1 * fn2(vec2(vFUv.y * uStreak.y * 0.7 - uT * uSpeed, vFUv.x * 3.0));
        diffuseColor.a = uOpacity * head * (1.0 - smoothstep(ragged - 0.06, ragged + 0.04, abs(vFUv.x - 0.5))) * (0.55 + 0.45 * streak);`);
  };
  return m;
}

/** Tiny hiker: body, head, backpack, legs; facing +z by default. */
export function hiker(jacket = S.green, pack = S.cream) {
  const g = new THREE.Group();
  const skin = clay(mixc(S.cream, S.red, 0.25), 0.7);
  const legs = clay(tone(C.storm, 1.2), 0.8);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 4, 10), clay(jacket, 0.7));
  body.position.y = 0.27;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), skin);
  head.position.y = 0.43;
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.07), clay(pack, 0.8));
  bag.position.set(0, 0.29, -0.08);
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 3, 8), legs);
    l.position.set(0.035 * s, 0.1, 0);
    g.add(l);
  }
  g.add(body, head, bag);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Soft storm clouds: a group of squashed spheres. */
export function cloudBank(R, { count = 24, spread = [24, 2, 24], at = [0, 8, 0], size = [1.2, 2.8] } = {}) {
  const mat = clay(S.cloud, 0.95, { emissive: tone(C.storm, 0.45) });
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const s = size[0] + R() * (size[1] - size[0]);
    const c = new THREE.Mesh(geo, mat);
    c.scale.set(s * 1.5, s * 0.6, s);
    c.position.set(at[0] + (R() - 0.5) * spread[0], at[1] + (R() - 0.5) * spread[1], at[2] + (R() - 0.5) * spread[2]);
    g.add(c);
  }
  return g;
}

/** Green tufts that spring up with a small overshoot after time `d` (seconds). */
export function tuft(R, pos, s = 0.08) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), clay(R() < 0.5 ? S.green : S.greenDark, 0.8));
  m.position.copy(pos);
  m.scale.set(1e-4, 1e-4, 1e-4);
  m.castShadow = true;
  m.userData.s = s;
  return m;
}
export function growTuft(m, t, d) {
  const k = t > d ? 1 - Math.exp(-(t - d) * 5) * Math.cos((t - d) * 9) : 0;
  const s = Math.max(1e-4, m.userData.s * k);
  m.scale.set(s, s * 0.8, s);
}
