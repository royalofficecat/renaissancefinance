// 1861-62 (beat 12): a flooded 1860s river town, low hero angle up the street to a columned
// courthouse (the legislature soon left Sacramento for San Francisco). No people, an empty boat.
import * as THREE from 'three';
import { C, SKY_REFL, clay, rig } from '../core/look.js';
import { applyCam, move } from '../core/camera.js';
import { ease, lerp, prog, rng } from '../core/util.js';
import { cloud } from '../core/diorama.js';

const WATER_Y = 0.42;

export async function createTown(pipe) {
  const scene = new THREE.Scene();
  scene.background = C.bg.clone();
  const r = rng(1862);
  const shades = ['#C9CED3', '#B4BBC2', '#A5ADB5', '#D3D6D9', '#BCC2C8'].map((h) => clay(new THREE.Color(h), 0.75));
  const trim = clay(C.subject.clone().multiplyScalar(0.55), 0.7);
  const winMat = clay(new THREE.Color('#2B2E33'), 0.6);
  const wood = clay(new THREE.Color('#7A746B'), 0.85);

  // Street bed (under water) and the flood itself
  const bed = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 40), clay(new THREE.Color('#5E5A55'), 0.9));
  bed.position.set(0, -0.1, -8);
  bed.receiveShadow = true;
  scene.add(bed);
  const WU = { uTime: { value: 0 } };
  const waterMat = new THREE.MeshStandardMaterial({ color: C.water.clone().multiplyScalar(0.85), roughness: 0.2, transparent: true, opacity: 0.94 });
  waterMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW2 = (modelMatrix * vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vW2; uniform float uTime;\n${SKY_REFL}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // Gentle ripples
        vec2 p = vW2.xz;
        vec3 rip = vec3(sin(p.x * 3.1 + uTime * 1.3) * 0.5 + sin(p.y * 4.3 - uTime * 1.1) * 0.3, 0.0, cos(p.y * 3.7 + uTime * 1.2) * 0.5 + sin((p.x + p.y) * 5.0 + uTime) * 0.25);
        normal = normalize(normal + (viewMatrix * vec4(rip * 0.05, 0.0)).xyz);`)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, 0.55);\n#include <opaque_fragment>');
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, WATER_Y, -8);
  water.receiveShadow = true;
  scene.add(water);

  // False-front buildings on both sides of the street
  const building = (w, h, d, mat) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true;
    const front = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.5, 0.08), mat); front.position.set(0, h + 0.2, d / 2); front.castShadow = true;
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.08, 0.16), trim); cornice.position.set(0, h + 0.47, d / 2 + 0.02);
    g.add(b, front, cornice);
    for (const fy of [0.75, 1.65]) for (let k = 0; k < 3; k++) {
      const wi = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.04), winMat);
      wi.position.set(-w / 2 + w * (0.22 + k * 0.28), fy, d / 2 + 0.01);
      g.add(wi);
    }
    // Porch roof on posts over the plank sidewalk (now under water)
    const porch = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.7), trim); porch.position.set(0, 1.18, d / 2 + 0.35); porch.castShadow = true;
    g.add(porch);
    for (const px of [-w / 2 + 0.08, w / 2 - 0.08]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.18, 0.07), wood); post.position.set(px, 0.59, d / 2 + 0.66); post.castShadow = true; g.add(post); }
    const walk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.7), wood); walk.position.set(0, 0.25, d / 2 + 0.35); g.add(walk);
    return g;
  };
  for (const side of [-1, 1]) {
    let z = 4.5;
    while (z > -14) {
      const w = 1.5 + r() * 0.9, h = 1.9 + r() * 0.7;
      const b = building(w, h, 2.2, shades[Math.floor(r() * shades.length)]);
      b.position.set(side * 2.9, 0, z - w / 2);
      b.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(b);
      z -= w + 0.08;
    }
  }
  // The courthouse at the end of the street: portico, columns, pediment
  const ch = new THREE.Group();
  const chMat = clay(new THREE.Color('#D9DCDF'), 0.7);
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 3), chMat); body.position.y = 1.6; body.castShadow = body.receiveShadow = true;
  const steps = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 1.2), chMat); steps.position.set(0, 0.25, 2.0);
  ch.add(body, steps);
  for (let k = 0; k < 6; k++) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.6, 16), chMat); col.position.set(-1.75 + k * 0.7, 1.8, 2.2); col.castShadow = true; ch.add(col); }
  const ent = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 1.4), chMat); ent.position.set(0, 3.25, 2.0); ch.add(ent);
  const ps = new THREE.Shape(); ps.moveTo(-2.3, 0); ps.lineTo(2.3, 0); ps.lineTo(0, 0.9); ps.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 1.4, bevelEnabled: false }), chMat); ped.position.set(0, 3.4, 1.3); ped.castShadow = true; ch.add(ped);
  for (let k = 0; k < 4; k++) { const wi = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.04), winMat); wi.position.set(-1.05 + k * 0.7, 2.2, 1.51); ch.add(wi); }
  ch.position.set(0, 0, -18);
  scene.add(ch);
  // An empty rowboat tied to a porch post
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 12), wood);
  hull.rotation.z = Math.PI / 2; hull.scale.set(0.55, 1, 1.25);
  const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.8, 6, 12), clay(new THREE.Color('#55504A'), 0.9));
  inner.rotation.z = Math.PI / 2; inner.scale.set(0.5, 1, 1.15); inner.position.y = 0.06;
  boat.add(hull, inner);
  boat.rotation.y = Math.PI / 2 + 0.25;
  boat.position.set(0.9, WATER_Y + 0.02, -1.6);
  hull.castShadow = true;
  scene.add(boat);
  const cloudMat = clay(new THREE.Color('#AEB6BF'), 0.95);
  [[-6, 9, -22, 3, 31], [5, 10, -26, 3.4, 32], [0, 11.5, -30, 2.6, 33]].forEach(([x, y, z, s, seed]) => { const c = cloud(cloudMat, seed, s); c.position.set(x, y, z); scene.add(c); });

  const lights = rig(scene, pipe.renderer, { size: 14, dist: 40, intensity: 2.6, keyDir: [-0.6, 0.55, 0.45] });
  scene.fog = new THREE.Fog(C.bg.clone().lerp(new THREE.Color('#8A8F96'), 0.25), 18, 46);
  const cam = new THREE.PerspectiveCamera(60, 1080 / 1920, 0.05, 300);
  const A = { pos: [0.7, 0.72, 7.6], target: [0, 2.9, -12], lens: 24 };
  const B = { pos: [0.5, 1.75, 5.4], target: [0, 2.6, -12], lens: 24 };

  function frame(f) {
    WU.uTime.value = f / 30;
    const s = move(f, 1472, 1616, A, B, { fn: ease.inOutSine }); // holds while title and caption land
    applyCam(cam, s);
    lights.follow(new THREE.Vector3(0, 0, -6), 14);
    lights.warmth(0.85);
    boat.rotation.z = Math.sin(f / 30 * 1.4) * 0.03;
    boat.position.y = WATER_Y + 0.02 + Math.sin(f / 30 * 1.1) * 0.012;
    boat.rotation.y = Math.PI / 2 + 0.25 + Math.sin(f / 30 * 0.7) * 0.04;
    return { scene, camera: cam, labels: null, bloom: 0.22 };
  }
  return { scene, frame };
}
