// Hillside cut-away (beats 4-5): the soil fills with water storm after storm, then runoff
// sheets downhill into the creek and street, and the slide-prone slope is outlined in amber.
import * as THREE from 'three';
import { C, SKY_REFL, clay, rig, water } from '../core/look.js';
import { applyCam, move, orbit } from '../core/camera.js';
import { clamp, ease, lerp, prog, rng, smoothstep } from '../core/util.js';
import { cloud, heightBlock, house, rain, tree } from '../core/diorama.js';

const SX = 12, SZ = 8, BASE = -2.6;

export function hill(x, z) {
  const slope = 2.7 * smoothstep(1.6, -5.6, x) * (0.88 + 0.12 * Math.sin(z * 0.6 + 0.4));
  const bumps = 0.06 * Math.sin(x * 2.1 + z * 1.3) + 0.04 * Math.sin(x * 3.7 - z * 2.2);
  const creek = -0.32 * Math.exp(-(((x - 2.25) / 0.32) ** 2));
  return 0.42 + slope + bumps * smoothstep(2.4, 0.5, x) + creek;
}

export async function createSoil(pipe) {
  const scene = new THREE.Scene();
  scene.background = C.bg.clone();
  const U = {
    uWetness: { value: 0 }, uRunoff: { value: 0 }, uSlide: { value: 0 }, uTime: { value: 0 },
    uSubject: { value: C.subject.clone() }, uGreenCol: { value: C.green.clone() }, uWaterCol: { value: C.water.clone() }, uAccent: { value: C.accent.clone() },
  };
  const topMat = clay(0xffffff, 0.8);
  topMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; uniform float uWetness, uRunoff, uSlide, uTime; uniform vec3 uSubject, uGreenCol, uWaterCol, uAccent;
        float gRun = 0.0;
        ${SKY_REFL}
        float hh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), u.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', `
        // Grass, a little green after the first rains, darkening as it soaks
        vec3 col = mix(uSubject, uGreenCol, 0.3) * (0.78 + 0.12 * vn(vW.xz * 3.0));
        float street = smoothstep(3.0, 3.1, vW.x) * (1.0 - smoothstep(4.2, 4.3, vW.x));
        col = mix(col, vec3(0.20, 0.21, 0.23), street);
        col *= 1.0 - 0.32 * uWetness;
        // Runoff: thin streams racing downhill (towards +x), gathering in the creek and street
        float lane = smoothstep(0.55, 0.9, vn(vec2(vW.z * 5.0, 0.5)));
        float streak = smoothstep(0.6, 1.0, fract(vW.x * 1.6 - uTime * 2.4 + vn(vW.zz * 3.0) * 2.0));
        float run = uRunoff * lane * (0.45 + 0.55 * streak) * smoothstep(2.6, 0.0, vW.x);
        float sheet = uRunoff * smoothstep(2.0, 3.0, vW.x) * 0.6;
        gRun = clamp(run + sheet, 0.0, 1.0);
        col = mix(col, uWaterCol * 1.1, gRun);
        // Slide-prone slope: amber outline and light hatching
        vec2 c = (vW.xz - vec2(-2.9, -0.9)) / vec2(1.45, 2.0);
        float r = length(c);
        float ring = smoothstep(0.86, 0.93, r) * (1.0 - smoothstep(0.97, 1.04, r));
        float hatch = step(r, 0.95) * step(0.75, fract((vW.x + vW.z) * 4.0)) * 0.45;
        col = mix(col, uAccent, uSlide * max(ring, hatch));
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, uWetness * 0.6); roughnessFactor = mix(roughnessFactor, 0.12, gRun);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uAccent * uSlide * 0.35 * smoothstep(0.86, 0.93, length((vW.xz - vec2(-2.9, -0.9)) / vec2(1.45, 2.0))) * (1.0 - smoothstep(0.97, 1.04, length((vW.xz - vec2(-2.9, -0.9)) / vec2(1.45, 2.0))));')
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, gRun * 0.8 + uWetness * 0.15);\n#include <opaque_fragment>');
  };
  const layers = [
    { depth: 0.4, color: new THREE.Color('#4A4540') },
    { depth: 1.45, color: new THREE.Color('#7A736B') },
    { depth: 99, color: C.subject.clone().multiplyScalar(0.78) },
  ];
  const block = heightBlock({ sx: SX, sz: SZ, nx: 160, nz: 100, height: hill, base: BASE, topMat, layers });
  scene.add(block.group);
  const SU = block.sideMat.userData.U;

  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), clay(C.bg.clone().multiplyScalar(1.15), 0.95));
  table.rotation.x = -Math.PI / 2; table.position.y = BASE - 0.04; table.receiveShadow = true;
  scene.add(table);

  // Creek and street water (rise during beat 5)
  const creek = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, SZ - 0.02), water(C.water, { transparent: true, opacity: 0.92 }));
  creek.position.set(2.25, 0, 0);
  const streetWater = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.02, SZ - 0.02), water(C.water, { transparent: true, opacity: 0.75 }));
  streetWater.position.set(3.65, 0.42, 0);
  scene.add(creek, streetWater);

  // Houses beyond the street, trees on the slope
  const houseMats = { body: clay(new THREE.Color('#C9CED3'), 0.7), roof: clay(C.subject.clone().multiplyScalar(0.55), 0.7), win: clay(new THREE.Color('#2B2E33'), 0.6) };
  [-2.6, -0.2, 2.3].forEach((z, i) => {
    const h = house({ ...houseMats, w: 1.1, h: 0.75, d: 1.0 });
    h.position.set(5.0, 0.42, z);
    h.rotation.y = -Math.PI / 2;
    scene.add(h);
  });
  const r = rng(404);
  const crown = clay(C.subject.clone().lerp(C.green, 0.45), 0.8), trunk = clay(new THREE.Color('#4E4A45'), 0.85);
  for (let i = 0; i < 22; i++) {
    const x = -5.6 + r() * 6.6, z = -3.6 + r() * 7.2;
    if (Math.hypot((x + 2.9) / 1.45, (z + 0.9) / 2) < 1.05) continue; // keep the slide zone clear
    const t = tree(crown, trunk, 0.8 + r() * 0.5);
    t.position.set(x, hill(x, z) - 0.02, z);
    scene.add(t);
  }
  // Storm clouds overhead
  const cloudMat = clay(new THREE.Color('#9AA3AD'), 0.95);
  const clouds = [[-3.5, 6.8, -1.5, 1.4, 11], [1.5, 7.3, 0.5, 1.6, 12], [5.0, 6.6, -2, 1.2, 13], [-0.8, 7.0, 2.6, 1.1, 14]].map(([x, y, z, s, seed]) => {
    const c = cloud(cloudMat, seed, s); c.position.set(x, y, z); scene.add(c); return c;
  });
  const rainSys = rain({ count: 1400, box: [SX, 8, SZ], top: 6.2, seed: 9 });
  scene.add(rainSys.mesh);

  const lights = rig(scene, pipe.renderer, { size: 9, dist: 30, intensity: 2.5 });
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 400);
  const A4 = { pos: [0.2, 4.2, 23.5], target: [-0.2, 0.0, 3.0], lens: 35 };
  const B4 = { pos: [-1.4, 1.9, 15.0], target: [-1.3, -0.2, 4.0], lens: 40 };

  // Nine storm pulses in beat 4 (one per atmospheric river), lighter rain in beat 5
  const storms = (f) => {
    const t = (f - 420) / 120;
    if (t < 0 || t > 1) return 0.35;
    return 0.45 + 0.55 * Math.pow(Math.abs(Math.sin(t * Math.PI * 9)), 0.6);
  };

  function frame(f) {
    const time = f / 30;
    U.uTime.value = time;
    let s;
    if (f < 540) s = move(f, 435, 536, A4, B4);
    else {
      // Beat 5 starts where beat 4 ended, then orbits round to the downhill side
      // Beat 5: hold on beat 4's last framing while the caption lands, then orbit round to the downhill side
      s = orbit(f, 556, 656, { center: [-1.3, 0.2, 4.0], a0: Math.atan2(-0.1, 11.0), a1: 0.92, r0: 11.0, r1: 14.0, h0: 1.7, h1: 6.2, lens0: 40, lens1: 35 });
      s.target = new THREE.Vector3(-1.3, -0.2, 4.0).lerp(new THREE.Vector3(0.2, 0.4, 0.6), s.t);
    }
    applyCam(cam, s);
    lights.follow(new THREE.Vector3(0, 0.5, 0), 9);
    lights.warmth(0);
    // Soil fills step by step with each storm, then the water table rises from below
    const wetFront = lerp(0.05, 2.9, ease.inOutSine(prog(f, 425, 600)));
    SU.uWet.value = wetFront;
    SU.uTable.value = lerp(BASE - 0.1, -1.2, ease.inOutSine(prog(f, 470, 650)));
    U.uWetness.value = smoothstep(430, 520, f);
    U.uRunoff.value = smoothstep(530, 575, f);
    U.uSlide.value = smoothstep(578, 596, f);
    creek.scale.y = lerp(0.35, 1.6, ease.inOutSine(prog(f, 540, 640)));
    creek.position.y = 0.1 + creek.scale.y * 0.15 - 0.15;
    streetWater.visible = f > 580;
    streetWater.scale.y = 1;
    streetWater.material.opacity = 0.75 * smoothstep(580, 620, f);
    rainSys.update(time, storms(f), (x, z) => hill(x, z));
    clouds.forEach((c, i) => { c.position.x += 0; c.rotation.y = Math.sin(time * 0.2 + i) * 0.05; });
    return { scene, camera: cam, labels: null, bloom: 0.2 };
  }
  return { scene, frame };
}
