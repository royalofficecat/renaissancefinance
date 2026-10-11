// Set C: a soil cross-section cube at the foot of a hillside. Beat 4 (pores fill), beat 5 (runoff, slide risk).
import * as THREE from 'three';
import { easeInOut, easeOut, lerp, span, seeded, smooth, spring } from '../easing.js';
import { rain as rainAmount } from '../timeline.js';
import { noise2, fbm, makeClouds, driftClouds, makeRain, makePine } from './common.js';

export const group = new THREE.Group();
let cube, poreMat, runoff = [], riskBand, creek, rain, clouds, slideBlocks = [];
const CUBE = 0.6;                       // 600 m cube, exaggerated for readability

function hillHeight(n, x, z) {          // hill rising toward -z, creek along z = +1.2
  const slope = smooth(1.3, -2.2, z) * 1.1;
  return slope + fbm(n, x * 0.8 + 2, z * 0.8 + 7, 4) * 0.22 - 0.1 - smooth(1.6, 1.2, Math.abs(z - 1.2)) * 0.06;
}

export async function build() {
  const n = noise2(9);
  const geo = new THREE.PlaneGeometry(7, 7, 200, 200); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, hillHeight(n, p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const hill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x55606C, roughness: 0.85 })); hill.receiveShadow = hill.castShadow = true; group.add(hill);

  // the cross-section cube: three layers on the sides, a shader "pore" face in front
  cube = new THREE.Group(); cube.position.set(0.9, 0.02, 1.0);
  const layers = [[0x3F3A33, 0.22], [0x5B544A, 0.45], [0x6F7784, 0.33]];
  let y = 0;
  for (const [c, h] of layers) { const b = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE * h, CUBE), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); b.position.y = (y + h / 2) * CUBE; b.castShadow = b.receiveShadow = true; cube.add(b); y += h; }
  poreMat = new THREE.ShaderMaterial({
    uniforms: { uFill: { value: 0 }, uWater: { value: new THREE.Color(0x24609A) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uFill; uniform vec3 uWater; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        // soil grains: a jittered grid of rounded blobs; the gaps are the pores
        vec2 g = vUv * vec2(30.0, 30.0); vec2 cell = floor(g); vec2 f = fract(g);
        float d = 1.0;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
          vec2 o = vec2(float(i), float(j)); vec2 c = cell + o; vec2 jit = vec2(hash(c), hash(c + 7.0)) * 0.6 + 0.2;
          d = min(d, length(f - o - jit) / (0.5 + 0.22 * hash(c + 3.0)));
        }
        float grain = 1.0 - smoothstep(0.7, 0.88, d);
        float depthTone = mix(0.62, 0.95, vUv.y);
        vec3 soil = mix(vec3(0.36, 0.30, 0.24), vec3(0.47, 0.42, 0.36), 1.0 - vUv.y) * depthTone * 0.85;
        vec3 pore = vec3(0.16, 0.14, 0.12);
        float wet = step(1.0 - uFill, vUv.y) * (1.0 - grain);           // pores fill from the top down
        vec3 col = mix(pore, soil, grain); col = mix(col, uWater, wet * 0.85); col = mix(col, soil * 0.75, step(1.0 - uFill, vUv.y) * grain * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(CUBE * 0.985, CUBE * 0.985), poreMat); face.position.set(0, CUBE / 2, CUBE / 2 + 0.002); cube.add(face);
  group.add(cube);

  // runoff: blue ribbons down the slope into the creek, grow in beat 5
  const n2 = noise2(9);
  for (let s = 0; s < 5; s++) {
    const x0 = -2.2 + s * 0.9; const pts = [];
    for (let i = 0; i <= 30; i++) { const z = -1.6 + i / 30 * 2.8; const x = x0 + Math.sin(z * 2.2 + s) * 0.18; pts.push(new THREE.Vector3(x, hillHeight(n2, x, z) + 0.012, z)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.028, 8, false), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.2, transparent: true, opacity: 0.9 }));
    tube.userData.pts = pts; runoff.push(tube); group.add(tube);
  }
  creek = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.32), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.18 }));
  creek.rotation.x = -Math.PI / 2; creek.position.set(0, hillHeight(n2, 0, 1.2) + 0.008, 1.25); group.add(creek);
  // amber "slide risk" band on the steep part of the slope (emissive accent, scene element only)
  riskBand = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9, 60, 12), new THREE.MeshStandardMaterial({ color: 0xE0A640, emissive: 0xE0A640, emissiveIntensity: 0.35, transparent: true, opacity: 0, roughness: 0.6, depthWrite: false }));
  const rp = riskBand.geometry.attributes.position; riskBand.geometry.rotateX(-Math.PI / 2);
  for (let i = 0; i < rp.count; i++) { const x = rp.getX(i) - 0.6, z = rp.getZ(i) - 0.9; rp.setX(i, x); rp.setZ(i, z); rp.setY(i, hillHeight(n2, x, z) + 0.006); }
  riskBand.geometry.computeVertexNormals(); group.add(riskBand);
  // a few blocks on the slope that creep downhill (a hillside starting to give, nobody near it)
  const rnd = seeded(12);
  for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16 + rnd() * 0.1, 0.07, 0.12 + rnd() * 0.08), new THREE.MeshStandardMaterial({ color: 0x5B544A, roughness: 0.85 })); b.userData = { x: -1.8 + rnd() * 2.4, z: -1.5 + rnd() * 0.8, n: n2, rot: rnd() * 6, d: rnd() }; b.castShadow = true; slideBlocks.push(b); group.add(b); }
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x5C6E66, roughness: 0.75 }), trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A4640, roughness: 0.8 });
  for (let i = 0; i < 90; i++) { const x = (rnd() - 0.5) * 6.4, z = -3.2 + rnd() * 3.6; if (z > -0.3 && Math.abs(x) < 2.6 && z < 0.9) continue; const tr = makePine(0.08 + rnd() * 0.06, pineMat, trunkMat); tr.position.set(x, hillHeight(n2, x, z) - 0.01, z); group.add(tr); }
  clouds = makeClouds(group, 33, 8, { x: [-4, 4], z: [-6, -4.2], h: [1.4, 2.0], size: [1.8, 3.0] });
  rain = makeRain(group, 34, 1200, { x: [-3, 3], z: [-2.5, 2.5], h: 2.2, speed: 2.4, len: 0.05, slant: 0.01 });
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(0, 0.3, 0), 4.5); lights.key.castShadow = true; lights.key.intensity = 1.9;
  ctx.scene.fog = new THREE.Fog(0x2E3B4C, 6.5, 13);
  const local = t - beat.start;
  rain.update(t, rainAmount(t)); driftClouds(clouds, t, 0.45);
  const target = new THREE.Vector3(), from = new THREE.Vector3();
  if (beat.id === 4) {
    // orbit 40 degrees around the cube while the pores fill from the top down
    poreMat.uniforms.uFill.value = easeInOut(span(local, 0.6, 3.6));
    for (const r of runoff) r.scale.set(1, 0.001, 1), r.visible = false;
    riskBand.material.opacity = 0;
    const k = easeInOut(span(local, 0.9, 3.9));
    const hd = lerp(-32, 8, k) * Math.PI / 180, elev = 17 * Math.PI / 180, dist = 2.15;
    target.set(0.9, 0.3, 1.0);
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(hd) * Math.cos(elev), Math.sin(elev), Math.cos(elev) * Math.cos(hd)).multiplyScalar(dist));
    camera.fov = 39.6;
  } else {
    // crane up and tilt to follow runoff sheeting into the creek; the amber band glows
    poreMat.uniforms.uFill.value = 1;
    const grow = easeOut(span(local, 0.4, 2.6));
    for (const r of runoff) { r.visible = true; r.scale.set(1, 1, 1); r.material.opacity = 0.9 * grow; }
    riskBand.material.opacity = 0.55 * easeInOut(span(local, 1.2, 2.6)) * (0.8 + 0.2 * Math.sin(t * 3));
    for (const b of slideBlocks) { const slip = easeIn2(span(local, 1.8 + b.userData.d, 4.0)) * 0.25; const z = b.userData.z + slip; b.position.set(b.userData.x, hillHeight(b.userData.n, b.userData.x, z) + 0.03, z); b.rotation.y = b.userData.rot; }
    const k = easeInOut(span(local, 0.9, 3.8));
    const hd = lerp(8, 2, k) * Math.PI / 180, elev = lerp(16, 30, k) * Math.PI / 180, dist = lerp(1.9, 4.6, k);
    target.set(lerp(0.9, 0.1, k), lerp(0.3, 0.45, k), lerp(1.0, -0.2, k));
    camera.position.copy(target).add(new THREE.Vector3(Math.sin(hd) * Math.cos(elev), Math.sin(elev), Math.cos(elev) * Math.cos(hd)).multiplyScalar(dist));
    camera.fov = lerp(39.6, 54.4, k);
  }
  camera.up.set(0, 1, 0); camera.lookAt(target); camera.near = 0.05; camera.far = 100; camera.updateProjectionMatrix();
}
const easeIn2 = x => x * x;
