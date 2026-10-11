// Set E: a stylized Sacramento street block in heavy rain; lights flicker and dim. Beat 9.
import * as THREE from 'three';
import { easeInOut, lerp, span, seeded } from '../easing.js';
import { rain as rainAmount } from '../timeline.js';
import { makeClouds, driftClouds, makeRain, cloudTexture } from './common.js';

export const group = new THREE.Group();
let windows = [], lamps = [], rain, clouds, pylon, flood;
const m = v => v / 1000;

export async function build() {
  const rnd = seeded(17);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x2F3842, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 4), new THREE.MeshStandardMaterial({ color: 0x262D36, roughness: 0.8 })); street.rotation.x = -Math.PI / 2; street.position.y = m(0.3); group.add(street);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.09), street.material); cross.rotation.x = -Math.PI / 2; cross.position.set(0, m(0.3), -0.55); group.add(cross);
  flood = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 4), new THREE.MeshStandardMaterial({ color: 0x12304F, roughness: 0.45, transparent: true, opacity: 0.45, envMapIntensity: 0.2 })); flood.rotation.x = -Math.PI / 2; flood.position.y = m(0.5); group.add(flood);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8A96A2, roughness: 0.72 }), trimMat = new THREE.MeshStandardMaterial({ color: 0xA7B0B9, roughness: 0.7 });
  const winGeo = new THREE.PlaneGeometry(m(3.2), m(4));
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 9; i++) {
    if (i === 4) continue;                                     // the cross street
    const w = m(24 + rnd() * 14), h = m(22 + rnd() * 60), d = m(22 + rnd() * 10);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); b.position.set(side * (0.075 + w / 2), h / 2, -1.55 + i * 0.25 + rnd() * 0.04); b.castShadow = b.receiveShadow = true; group.add(b);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + m(1.5), m(1.5), d + m(1.5)), trimMat); trim.position.set(b.position.x, h, b.position.z); trim.castShadow = true; group.add(trim);
    const rows = Math.floor(h / m(7)), cols = Math.floor(d / m(6));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x1A1E24, emissive: 0xF3E4C0, emissiveIntensity: 1.8, roughness: 0.4 });
      const win = new THREE.Mesh(winGeo, mat); win.position.set(b.position.x - side * (w / 2 + m(0.3)), m(4.5) + r * m(7), b.position.z - d / 2 + m(4) + c * m(6)); win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      win.userData = { seed: rnd(), seed2: rnd() }; windows.push(win); group.add(win);
    }
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9AA3AC, roughness: 0.6 });
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1; const z = -1.5 + i * 0.22;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(m(0.3), m(0.35), m(10), 8), poleMat); pole.position.set(side * 0.062, m(5), z); pole.castShadow = true; group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(m(0.9), 10, 8), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xF5E6C8, emissiveIntensity: 2.5 })); bulb.position.set(side * 0.056, m(10), z); bulb.userData = { seed: rnd() }; lamps.push(bulb); group.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), color: 0xF5E6C8, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(m(26)); halo.position.copy(bulb.position); bulb.userData.halo = halo; group.add(halo);
  }
  pylon = new THREE.Group();
  const latt = new THREE.MeshStandardMaterial({ color: 0x8E97A1, roughness: 0.6 });
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(m(0.3), m(0.4), m(48), 6), latt); leg.position.set(x * m(5), m(24), z * m(5)); leg.rotation.z = -x * 0.06; leg.rotation.x = z * 0.06; leg.castShadow = true; pylon.add(leg); }
  for (const y of [16, 30, 42]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(m(26), m(0.8), m(0.8)), latt); arm.position.y = m(y); pylon.add(arm); }
  pylon.position.set(0.0, 0, -2.2); group.add(pylon);
  clouds = makeClouds(group, 41, 12, { x: [-1.4, 1.4], z: [-3, 0.4], h: [0.55, 0.75], size: [0.9, 1.6], color: 0x7F8993 });
  rain = makeRain(group, 42, 2600, { x: [-0.9, 0.9], z: [-2.6, 0.8], h: 0.75, speed: 1.6, len: 0.03, slant: 0.006 });
}

function flicker(seed, t) {            // deterministic flicker: mostly on, dropping out as the beat goes on
  const a = Math.sin(t * 23 * (0.7 + seed) + seed * 40) * 0.5 + 0.5, b = Math.sin(t * 7 + seed * 90) * 0.5 + 0.5;
  return a * 0.6 + b * 0.4;
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(0, 0.05, -0.7), 2.4); lights.key.castShadow = true; lights.key.intensity = 1.5; lights.hemi.intensity = 0.9; lights.fill.intensity = 1.3;
  ctx.scene.fog = new THREE.Fog(0x1F2A3A, 0.6, 2.6);
  const local = t - beat.start;
  rain.update(t, rainAmount(t)); driftClouds(clouds, t, 0.75);
  const outage = easeInOut(span(local, 1.2, 3.4));            // more windows and lamps drop out over the beat
  for (const w of windows) { const on = w.userData.seed > outage * 0.85 ? 1 : (flicker(w.userData.seed2, t) > 0.93 ? 0.5 : 0); const fl = w.userData.seed2 > 0.8 ? 0.6 + 0.4 * flicker(w.userData.seed, t) : 1; w.material.emissiveIntensity = 1.2 * on * fl; }
  for (const l of lamps) { const on = l.userData.seed > outage * 0.8 ? (0.7 + 0.3 * flicker(l.userData.seed, t)) : 0.06; l.material.emissiveIntensity = 2.5 * on; l.userData.halo.material.opacity = 0.5 * on; }
  flood.position.y = m(0.5) + m(1.2) * easeInOut(span(local, 0, 4)); flood.scale.x = 1 + 0.35 * easeInOut(span(local, 0, 4));
  pylon.rotation.z = -0.03 * easeInOut(span(local, 0.8, 3.5)) + Math.sin(t * 1.3) * 0.004;
  // push-in at 28 mm from street level, down the middle of the block toward the pylon
  const k = easeInOut(span(local, 0.9, 3.7));
  const target = new THREE.Vector3(0.0, lerp(0.02, 0.03, k), -1.3);
  camera.position.set(lerp(0.012, 0.0, k), lerp(0.034, 0.04, k), lerp(0.3, 0.02, k));
  camera.up.set(0, 1, 0); camera.lookAt(target); camera.fov = 65.5; camera.near = 0.01; camera.far = 60; camera.updateProjectionMatrix();
}
