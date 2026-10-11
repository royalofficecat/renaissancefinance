// Set B: a Sierra reservoir whose shoreline climbs as storms stack up. Beat 3.
import * as THREE from 'three';
import { easeInOut, easeOut, lerp, span, seeded, smooth } from '../easing.js';
import { rain as rainAmount } from '../timeline.js';
import { noise2, fbm, makeClouds, driftClouds, makeRain, makePine } from './common.js';

export const group = new THREE.Group();
let water, rain, clouds, shoreRing;
const DEPTH = 0.42;                    // canyon depth (km, with 2x look)

function canyonHeight(n, x, z) {       // V-shaped canyon along z with rolling noise; x in [-3, 3]
  const v = Math.pow(Math.abs(x) / 1.4, 1.35) * DEPTH * 1.6;
  const ridge = fbm(n, x * 1.1 + 5, z * 0.9 + 3, 4) * 0.35 + fbm(n, x * 4 + 9, z * 4, 3) * 0.06;
  return Math.min(v, DEPTH * 1.3) + ridge * (0.3 + Math.abs(x) * 0.5);
}

export async function build() {
  const n = noise2(3);
  const geo = new THREE.PlaneGeometry(6, 6, 220, 220); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, canyonHeight(n, p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6E7B8A, roughness: 0.74 })); terrain.receiveShadow = true; terrain.castShadow = true; group.add(terrain);

  // dam: a curved wall across the canyon mouth
  const dam = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, DEPTH * 1.05, 48, 1, true, -0.55, 1.1), new THREE.MeshStandardMaterial({ color: 0x8E9AA6, roughness: 0.6, side: THREE.DoubleSide }));
  dam.position.set(0, DEPTH * 0.52, 2.35); dam.rotation.y = Math.PI; dam.castShadow = dam.receiveShadow = true; group.add(dam);

  water = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.17, metalness: 0 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, DEPTH * 0.3, -0.5); group.add(water);
  shoreRing = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.2, 1, 1), new THREE.MeshBasicMaterial({ color: 0x8FC6F0, transparent: true, opacity: 0.18, depthWrite: false }));
  shoreRing.rotation.x = -Math.PI / 2; shoreRing.position.set(0, DEPTH * 0.3 + 0.004, -0.5); group.add(shoreRing);

  // pines on the slopes above the high-water mark
  const rnd = seeded(5);
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x5C6E66, roughness: 0.75 }), trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A4640, roughness: 0.8 });
  for (let i = 0; i < 260; i++) {
    const x = (rnd() - 0.5) * 5.6, z = (rnd() - 0.5) * 5.6; const h = canyonHeight(n, x, z);
    if (h < DEPTH * 0.62 || Math.abs(x) < 0.6) continue;
    const tr = makePine(0.09 + rnd() * 0.07, pineMat, trunkMat); tr.position.set(x, h - 0.01, z); tr.rotation.y = rnd() * 6; group.add(tr);
  }
  clouds = makeClouds(group, 31, 12, { x: [-3, 3], z: [-3, 2], h: [1.1, 1.5], size: [1.4, 2.6] });
  rain = makeRain(group, 32, 1400, { x: [-2.5, 2.5], z: [-2.5, 2.5], h: 1.6, speed: 2.2, len: 0.05, slant: 0.008 });
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(0, 0.2, 0), 4.2); lights.key.castShadow = true;
  const local = t - beat.start;
  const level = lerp(DEPTH * 0.32, DEPTH * 0.78, easeInOut(span(local, 0.4, 3.8)));
  water.position.y = level; shoreRing.position.y = level + 0.004; shoreRing.material.opacity = 0.12 + 0.1 * Math.sin(t * 2.5);
  rain.update(t, rainAmount(t)); driftClouds(clouds, t, 0.7);
  // slow push-in at 50 mm from a three-quarter view
  const k = easeInOut(span(local, 0.9, 3.8));
  const dist = lerp(5.2, 3.6, k), elev = lerp(24, 20, k) * Math.PI / 180, hd = lerp(28, 18, k) * Math.PI / 180;
  const target = new THREE.Vector3(0, DEPTH * 0.45, -0.3);
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(hd) * Math.cos(elev), Math.sin(elev), Math.cos(elev) * Math.cos(hd)).multiplyScalar(dist));
  camera.up.set(0, 1, 0); camera.lookAt(target); camera.fov = 39.6; camera.near = 0.05; camera.far = 100; camera.updateProjectionMatrix();
}
