// Set G: a groundwater recharge basin beside an orchard. Beat 11 (the hopeful turn).
// Units are km like everything else, so a 10 m tree is 0.010. Scaled like a model ("premium toy").
import * as THREE from 'three';
import { easeInOut, easeOut, lerp, span, spring, seeded, smooth } from '../easing.js';
import { recovery } from '../timeline.js';
import { makeClouds, driftClouds } from './common.js';

export const group = new THREE.Group();
const m = v => v / 1000;
let ground, cellWater = [], stream, gate, clouds, treeMats = [], stripeMat;
const GREY = new THREE.Color(0x6E7B8A), GREEN = new THREE.Color(0x5E9E5A), LEAF_GREY = new THREE.Color(0x7E8A95), LEAF_GREEN = new THREE.Color(0x4F8F4C);
const CELL_W = m(70), CELL_D = m(50), CELLS = [];
for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) CELLS.push({ x: -0.075 + i * (CELL_W + m(8)), z: 0.085 + j * (CELL_D + m(8)), order: j * 2 + i });

export async function build() {
  const rnd = seeded(11);
  const gg = new THREE.PlaneGeometry(3, 3, 120, 120); gg.rotateX(-Math.PI / 2);
  const p = gg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const far = smooth(0.25, 0.9, Math.hypot(x, z - 0.1)); p.setY(i, far * (m(6) * Math.sin(x * 5.1) * Math.cos(z * 4.3) + m(3) * Math.sin(x * 13 + z * 9))); }
  gg.computeVertexNormals();
  ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: GREY.clone(), roughness: 0.78 })); ground.receiveShadow = true; group.add(ground);

  // ploughed field stripes beyond the orchard
  stripeMat = new THREE.MeshStandardMaterial({ color: 0x66727F, roughness: 0.8 });
  for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, m(3.5)), stripeMat); s.rotation.x = -Math.PI / 2; s.position.set(-0.02, m(0.4), -0.16 - i * m(9)); s.receiveShadow = true; group.add(s); }

  // orchard on the far side of the canal: canopy spheres on trunks, in rows
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A4640, roughness: 0.8 });
  const canopyGeo = new THREE.SphereGeometry(m(3.4), 16, 12), trunkGeo = new THREE.CylinderGeometry(m(0.45), m(0.55), m(3), 8);
  for (let r = 0; r < 11; r++) for (let c = 0; c < 30; c++) {
    const mat = new THREE.MeshStandardMaterial({ color: LEAF_GREY.clone(), roughness: 0.7 }); treeMats.push(mat);
    const tr = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = m(1.5); trunk.castShadow = true;
    const can = new THREE.Mesh(canopyGeo, mat); can.position.y = m(5.4); can.castShadow = true; can.scale.y = 0.88;
    tr.add(trunk, can); tr.position.set(-0.155 + c * m(9) + (rnd() - 0.5) * m(1.2), 0, -0.022 - r * m(9) + (rnd() - 0.5) * m(1.2));
    tr.scale.setScalar(0.85 + rnd() * 0.3); group.add(tr);
  }

  // canal with water, running along x, with low berms
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x59646F, roughness: 0.8 }), bermMat = new THREE.MeshStandardMaterial({ color: 0x7C8793, roughness: 0.8 });
  const canalBed = new THREE.Mesh(new THREE.BoxGeometry(2, m(2), m(12)), bedMat); canalBed.position.set(0, m(0.6), 0); canalBed.receiveShadow = true; group.add(canalBed);
  const canalWater = new THREE.Mesh(new THREE.PlaneGeometry(2, m(10)), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.18 })); canalWater.rotation.x = -Math.PI / 2; canalWater.position.set(0, m(1.7), 0); group.add(canalWater);
  for (const dz of [-m(7.5), m(7.5)]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2, m(2.6), m(3)), bermMat); b.position.set(0, m(1.3), dz); b.castShadow = b.receiveShadow = true; group.add(b); }

  // the diversion gate: a concrete frame and an amber slab that lifts
  gate = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xB9B3A8, roughness: 0.7 });
  for (const dx of [-m(5), m(5)]) { const post = new THREE.Mesh(new THREE.BoxGeometry(m(1.4), m(9), m(1.4)), frameMat); post.position.set(dx, m(4.5), 0); post.castShadow = true; gate.add(post); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(m(11.5), m(1.4), m(1.6)), frameMat); beam.position.y = m(9); beam.castShadow = true; gate.add(beam);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(m(8.8), m(6), m(0.8)), new THREE.MeshStandardMaterial({ color: 0xE0A640, roughness: 0.55 })); slab.name = 'slab'; slab.position.y = m(3); slab.castShadow = true; gate.add(slab);
  gate.position.set(-0.035, 0, m(7.5)); group.add(gate);

  // stream from the gate into the cells (grows), and the cells themselves
  stream = new THREE.Mesh(new THREE.PlaneGeometry(m(7), 1), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.18 }));
  stream.rotation.x = -Math.PI / 2; stream.geometry.translate(0, 0.5, 0); stream.position.set(-0.035, m(0.9), m(9.5)); group.add(stream);
  const feeder = new THREE.Mesh(new THREE.PlaneGeometry(0.24, m(6)), new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.18 })); feeder.name = 'feeder';
  feeder.rotation.x = -Math.PI / 2; feeder.position.set(0.0, m(0.9), 0.055); group.add(feeder);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0x2F7FC2, roughness: 0.18, transparent: true, opacity: 0.95 });
  const cellFloor = new THREE.MeshStandardMaterial({ color: 0x5A6470, roughness: 0.85 });
  for (const c of CELLS) {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W, CELL_D), cellFloor); fl.rotation.x = -Math.PI / 2; fl.position.set(c.x, m(0.3), c.z); fl.receiveShadow = true; group.add(fl);
    for (const [w, d, ox, oz] of [[CELL_W + m(3), m(3), 0, -CELL_D / 2], [CELL_W + m(3), m(3), 0, CELL_D / 2], [m(3), CELL_D, -CELL_W / 2, 0], [m(3), CELL_D, CELL_W / 2, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, m(2.4), d), bermMat); b.position.set(c.x + ox, m(1.2), c.z + oz); b.castShadow = b.receiveShadow = true; group.add(b);
    }
    const w = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W - m(2), CELL_D - m(2)), cellMat.clone()); w.rotation.x = -Math.PI / 2; w.position.set(c.x, m(0.5), c.z); w.userData.order = c.order; cellWater.push(w); group.add(w);
  }
  clouds = makeClouds(group, 51, 9, { x: [-0.6, 0.6], z: [-0.7, 0.3], h: [0.16, 0.24], size: [0.28, 0.5] });
}

export function update(t, beat, ctx) {
  const { camera, placeLights, lights } = ctx;
  placeLights(new THREE.Vector3(-0.02, 0, 0.05), 0.75); lights.key.castShadow = true;
  const local = t - beat.start, r = recovery(t);
  ctx.scene.fog = new THREE.Fog(ctx.scene.background.clone().lerp(new THREE.Color(0x8FA3B3), 0.35), 0.45, 1.6);
  const green = smooth(0.3, 1.0, r);
  ground.material.color.copy(GREY).lerp(GREEN, green * 0.7);
  stripeMat.color.set(0x66727F).lerp(new THREE.Color(0x4E7F4A), green * 0.6);
  for (const mat of treeMats) mat.color.copy(LEAF_GREY).lerp(LEAF_GREEN, green);
  // gate lifts with a spring, the stream grows, cells fill one after another
  const open = spring(span(local, 0.5, 1.6));
  gate.getObjectByName('slab').position.y = m(3) + m(5.2) * open;
  stream.scale.y = Math.max(0.001, 0.042 * spring(span(local, 0.7, 1.9)));
  group.getObjectByName('feeder').visible = local > 1.6;
  for (const w of cellWater) { const k = easeOut(span(local, 1.4 + w.userData.order * 0.3, 2.6 + w.userData.order * 0.3)); w.material.opacity = 0.95 * Math.min(1, k * 1.3); w.position.y = m(0.5) + m(1.5) * k; }
  driftClouds(clouds, t, 0.65 * (1 - easeInOut(span(local, 0.4, 3.8))));
  // push-in at 50 mm from about 30 degrees elevation: cells in front, canal and gate mid, orchard behind
  const k = easeInOut(span(local, 0.8, 3.8));
  const dist = lerp(0.56, 0.43, k), elev = lerp(22, 18, k) * Math.PI / 180, hd = lerp(14, 5, k) * Math.PI / 180;
  const target = new THREE.Vector3(lerp(-0.03, -0.035, k), m(8), lerp(0.05, 0.07, k));
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(hd) * Math.cos(elev), Math.sin(elev), Math.cos(elev) * Math.cos(hd)).multiplyScalar(dist));
  camera.up.set(0, 1, 0); camera.lookAt(target); camera.fov = 39.6; camera.near = 0.01; camera.far = 50; camera.updateProjectionMatrix();
}
