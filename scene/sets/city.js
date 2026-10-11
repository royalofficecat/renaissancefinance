// Set E: a stylized Sacramento street block in heavy rain; lights flicker and dim. Beat 9.
import * as THREE from 'three';
import { easeInOut, lerp, span, seeded, smooth } from '../easing.js';
import { rain as rainAmount } from '../timeline.js';
import { makeClouds, driftClouds, makeRain } from './common.js';

export const group = new THREE.Group();
let windows = [], lamps = [], rain, clouds, street, pylon, flood;
const m = v => v / 1000;

export async function build() {
  const rnd = seeded(17);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ color: 0x59636E, roughness: 0.85 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  street = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 3), new THREE.MeshStandardMaterial({ color: 0x3E4650, roughness: 0.7 })); street.rotation.x = -Math.PI / 2; street.position.y = m(0.3); group.add(street);
  const cross = street.clone(); cross.rotation.z = Math.PI / 2; cross.position.set(0, m(0.3), 0.18); group.add(cross);
  flood = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 3), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.15, transparent: true, opacity: 0.85 })); flood.rotation.x = -Math.PI / 2; flood.position.y = m(0.5); group.add(flood);
  const bevel = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1); return g; };
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7A8591, roughness: 0.7 });
  const winGeo = new THREE.PlaneGeometry(m(2.2), m(3));
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 6; i++) {
    const w = m(22 + rnd() * 14), h = m(18 + rnd() * 50), d = m(20 + rnd() * 10);
    const b = new THREE.Mesh(bevel(w, h, d), wallMat); b.position.set(side * (0.07 + w / 2 + rnd() * 0.02), h / 2, -1.2 + i * 0.3 + rnd() * 0.08); b.castShadow = b.receiveShadow = true; group.add(b);
    // windows facing the street
    const rows = Math.floor(h / m(6)), cols = Math.floor(d / m(5));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x1A1E24, emissive: 0xF3E4C0, emissiveIntensity: 0.9, roughness: 0.4 });
      const win = new THREE.Mesh(winGeo, mat); win.position.set(b.position.x - side * (w / 2 + m(0.2)), m(4) + r * m(6), b.position.z - d / 2 + m(3) + c * m(5)); win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      win.userData = { seed: rnd(), seed2: rnd() }; windows.push(win); group.add(win);
    }
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9AA3AC, roughness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1; const pole = new THREE.Mesh(new THREE.CylinderGeometry(m(0.25), m(0.3), m(9), 8), poleMat); pole.position.set(side * 0.058, m(4.5), -1.1 + i * 0.3); pole.castShadow = true; group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(m(0.8), 10, 8), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xF5E6C8, emissiveIntensity: 2.2 })); bulb.position.set(side * 0.052, m(9), -1.1 + i * 0.3); bulb.userData = { seed: rnd() }; lamps.push(bulb); group.add(bulb);
    const glow = new THREE.PointLight(0xF5E6C8, 0.0, 0.12, 2); glow.position.copy(bulb.position); bulb.userData.light = glow; group.add(glow);
  }
  // a transmission pylon at the end of the street, leaning slightly in the wind
  pylon = new THREE.Group();
  const latt = new THREE.MeshStandardMaterial({ color: 0x8E97A1, roughness: 0.6 });
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.25), m(0.35), m(40), 6), latt); leg.position.set(x * m(4), m(20), z * m(4)); leg.rotation.z = -x * 0.06; leg.rotation.x = z * 0.06; leg.castShadow = true; pylon.add(leg); }
  for (const y of [14, 26, 36]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(m(22), m(0.6), m(0.6)), latt); arm.position.y = m(y); pylon.add(arm); }
  pylon.position.set(0.02, 0, -1.9); group.add(pylon);
  clouds = makeClouds(group, 41, 10, { x: [-1.2, 1.2], z: [-2.4, 0.6], h: [0.5, 0.7], size: [0.8, 1.4], color: 0x8F99A3 });
  rain = makeRain(group, 42, 2200, { x: [-0.9, 0.9], z: [-2.4, 0.8], h: 0.7, speed: 1.6, len: 0.03, slant: 0.006 });
}

function flicker(seed, t) {            // deterministic flicker: mostly on, dropping out as the beat goes on
  const a = Math.sin(t * 23 * (0.7 + seed) + seed * 40) * 0.5 + 0.5, b = Math.sin(t * 7 + seed * 90) * 0.5 + 0.5;
  return a * 0.6 + b * 0.4;
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(0, 0.05, -0.5), 2.2); lights.key.castShadow = true; lights.key.intensity = 1.6;
  const local = t - beat.start;
  rain.update(t, rainAmount(t)); driftClouds(clouds, t, 0.75);
  const outage = easeInOut(span(local, 1.2, 3.4));            // more windows and lamps drop out over the beat
  for (const w of windows) { const on = w.userData.seed > outage * 0.85 ? 1 : (flicker(w.userData.seed2, t) > 0.93 ? 0.5 : 0); const fl = w.userData.seed2 > 0.8 ? 0.6 + 0.4 * flicker(w.userData.seed, t) : 1; w.material.emissiveIntensity = 0.9 * on * fl; }
  for (const l of lamps) { const on = l.userData.seed > outage * 0.8 ? (0.7 + 0.3 * flicker(l.userData.seed, t)) : 0.08; l.material.emissiveIntensity = 2.2 * on; l.userData.light.intensity = 0.02 * on; }
  flood.position.y = m(0.5) + m(1.5) * easeInOut(span(local, 0, 4)); flood.scale.x = 1 + 0.8 * easeInOut(span(local, 0, 4));
  pylon.rotation.z = -0.03 * easeInOut(span(local, 0.8, 3.5)) + Math.sin(t * 1.3) * 0.004;
  // low push-in, 50 mm, looking up the street toward the pylon
  const k = easeInOut(span(local, 0.9, 3.7));
  const target = new THREE.Vector3(0.01, lerp(0.05, 0.08, k), lerp(-0.6, -1.0, k));
  camera.position.set(lerp(0.09, 0.05, k), lerp(0.035, 0.05, k), lerp(0.55, 0.25, k));
  camera.up.set(0, 1, 0); camera.lookAt(target); camera.fov = 39.6; camera.near = 0.01; camera.far = 60; camera.updateProjectionMatrix();
}
