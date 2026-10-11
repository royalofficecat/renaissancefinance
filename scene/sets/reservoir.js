// Set B: a Sierra reservoir whose shoreline climbs as storms stack up. Beat 3.
import * as THREE from 'three';
import { easeInOut, lerp, span, seeded, smooth } from '../easing.js';
import { rain as rainAmount } from '../timeline.js';
import { noise2, fbm, makeClouds, driftClouds, makeRain, makePine } from './common.js';

export const group = new THREE.Group();
let water, rain, clouds, shoreRing;
const DEPTH = 0.42;                    // canyon depth in scene km

// V-shaped canyon running along z, closing at the far (-z) end; the dam closes the near end
function canyonHeight(n, x, z) {
  const v = Math.pow(Math.abs(x) / 1.5, 1.3) * DEPTH * 1.7;
  const ridge = fbm(n, x * 1.1 + 5, z * 0.9 + 3, 4) * 0.4 + fbm(n, x * 4 + 9, z * 4, 3) * 0.08;
  const farEnd = smooth(-1.2, -3.2, z) * DEPTH * 1.4;
  return Math.min(v, DEPTH * 1.4) + ridge * (0.25 + Math.abs(x) * 0.45) + farEnd;
}

export async function build() {
  const n = noise2(3);
  const geo = new THREE.PlaneGeometry(7, 7, 240, 240); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, canyonHeight(n, p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x55606C, roughness: 0.85 })); terrain.receiveShadow = true; terrain.castShadow = true; group.add(terrain);

  // dam: a straight concrete wall across the canyon mouth, with a crest road and a spillway notch
  const damMat = new THREE.MeshStandardMaterial({ color: 0x9AA4AE, roughness: 0.62 });
  const dam = new THREE.Mesh(new THREE.BoxGeometry(2.6, DEPTH * 1.02, 0.16), damMat); dam.position.set(0, DEPTH * 0.51, 2.25); dam.castShadow = dam.receiveShadow = true; group.add(dam);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.012, 0.2), new THREE.MeshStandardMaterial({ color: 0xB9B3A8, roughness: 0.7 })); crest.position.set(0, DEPTH * 1.02, 2.25); group.add(crest);
  const spill = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x2A72B5, roughness: 0.2 })); spill.position.set(0.5, DEPTH * 1.0, 2.25); group.add(spill);
  water = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.7, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2A72B5, roughness: 0.14, metalness: 0 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, DEPTH * 0.3, -0.6); group.add(water);
  shoreRing = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.6, 1, 1), new THREE.MeshBasicMaterial({ color: 0x8FC6F0, transparent: true, opacity: 0.18, depthWrite: false }));
  shoreRing.rotation.x = -Math.PI / 2; shoreRing.position.set(0, DEPTH * 0.3 + 0.004, -0.6); group.add(shoreRing);

  // pines on the slopes above the high-water mark
  const rnd = seeded(5);
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x4F6159, roughness: 0.8 }), trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A4640, roughness: 0.8 });
  for (let i = 0; i < 420; i++) {
    const x = (rnd() - 0.5) * 6.6, z = (rnd() - 0.5) * 6.6; const h = canyonHeight(n, x, z);
    if (h < DEPTH * 0.84 || z > 2.6) continue;
    const tr = makePine(0.1 + rnd() * 0.08, pineMat, trunkMat); tr.position.set(x, h - 0.01, z); tr.rotation.y = rnd() * 6; group.add(tr);
  }
  clouds = makeClouds(group, 31, 10, { x: [-4, 4], z: [-6.5, -4.5], h: [1.2, 1.8], size: [1.8, 3.2], color: 0x9AA4AE });
  rain = makeRain(group, 32, 1600, { x: [-3, 3], z: [-3, 3], h: 1.8, speed: 2.2, len: 0.05, slant: 0.008 });
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(0, 0.2, 0), 4.5); lights.key.castShadow = true; lights.key.intensity = 2.0;
  ctx.scene.fog = new THREE.Fog(0x2E3B4C, 7.5, 15);
  const local = t - beat.start;
  const level = lerp(DEPTH * 0.34, DEPTH * 0.8, easeInOut(span(local, 0.4, 3.8)));
  water.position.y = level; shoreRing.position.y = level + 0.004; shoreRing.material.opacity = 0.12 + 0.08 * Math.sin(t * 2.5);
  rain.update(t, rainAmount(t)); driftClouds(clouds, t, 0.45);
  // slow push-in at 50 mm from high on the canyon rim, looking down the reservoir toward the dam
  const k = easeInOut(span(local, 0.9, 3.8));
  const dist = lerp(5.6, 4.3, k), elev = lerp(30, 26, k) * Math.PI / 180, hd = lerp(-150, -160, k) * Math.PI / 180;
  const target = new THREE.Vector3(0, DEPTH * 0.4, lerp(0.6, 1.0, k));
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(hd) * Math.cos(elev), Math.sin(elev), Math.cos(elev) * Math.cos(hd)).multiplyScalar(dist));
  camera.up.set(0, 1, 0); camera.lookAt(target); camera.fov = 39.6; camera.near = 0.05; camera.far = 100; camera.updateProjectionMatrix();
}
