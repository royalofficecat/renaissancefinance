// Beat 5: San Francisco. A steep street of row houses rebuilt for cats: plank walkways bridge the rooftops,
// little shelves climb the façades, every sunny bay window has a cat in it (cats are comfiest at 30-38 °C),
// and warm pools of light (sun estates) sit on the roofs. The Golden Gate stands across the water.
import * as THREE from 'three';
import { C, S, backdrop, clay, glossy, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { mesh, rbox, shrub } from '../lib/props.js';
import { basePlate, rowHouse, street } from '../lib/town.js';
import { beatMove, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { rng } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [540, 660];
const slopeY = (z) => Math.min(4.6, Math.max(0, (5.2 - z) * 0.4)); // the hill rises towards -z

/** A plank walkway with terracotta rails between two points (rooftop routes). */
function walkway(a, b, w = 0.5) {
  const g = new THREE.Group();
  const d = b.clone().sub(a), L = d.length();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(d.y / L);
  const inner = new THREE.Group();
  inner.add(mesh(rbox(w, 0.06, L, 0.02), clay(S.wood, 0.65), {}));
  for (const s of [-1, 1]) {
    inner.add(mesh(rbox(0.04, 0.04, L, 0.015), clay(S.terra, 0.6), { pos: [s * w / 2, 0.3, 0] }));
    for (let i = 0; i <= Math.floor(L / 1.1); i++) inner.add(mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), clay(S.terra, 0.6), { pos: [s * w / 2, 0.15, -L / 2 + 0.1 + i * 1.1] }));
  }
  inner.rotation.set(pitch, 0, 0);
  g.add(inner);
  g.position.copy(mid);
  g.rotation.y = yaw;
  return g;
}

/** Soft gold pool of sunlight (a sun estate): additive glow on a surface. */
function sunPool(r = 0.6) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: tone(C.gold, 1.0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uCol * (1.0 - smoothstep(0.3, 1.0, d)) * 0.28, 1.0); }',
  });
  m.toneMapped = false;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), m);
  p.renderOrder = 6;
  return p;
}

/** A toy Golden Gate: two terracotta towers, a deck and swooping cables. */
function goldenGate() {
  const g = new THREE.Group();
  const red = clay(tone(C.terra, 0.95), 0.6);
  for (const x of [-4, 4]) {
    for (const s of [-1, 1]) g.add(mesh(rbox(0.35, 7, 0.35, 0.05), red, { pos: [x, 3.5, s * 0.55] }));
    for (const y of [4.2, 6.2, 6.9]) g.add(mesh(rbox(0.3, 0.3, 1.4, 0.04), red, { pos: [x, y, 0] }));
  }
  g.add(mesh(rbox(18, 0.3, 1.3, 0.05), red, { pos: [0, 2.2, 0] }));
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const x = -9 + (18 * i) / 40; const y = Math.abs(x) <= 4 ? 2.6 + 4.3 * (x / 4) ** 2 : 6.9 - (Math.abs(x) - 4) * 0.9; pts.push(new THREE.Vector3(x, y, s * 0.55)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.05, 6), red, { cast: false }));
  }
  return g;
}

export async function createSF(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.35, horizon: tone(C.blue, 1, 0.3), top: tone(C.blue, 0.9) });
  const R = rng(55);
  const plate = basePlate({ w: 12, d: 13 });
  scene.add(plate);
  // the bay behind the city, the bridge and Marin's hills beyond
  const bay = mesh(new THREE.PlaneGeometry(260, 160).rotateX(-Math.PI / 2), glossy(tone(C.blue, 0.95), { roughness: 0.35, reflect: 0.6 }), { pos: [0, -0.6, -86], cast: false });
  scene.add(bay);
  const gg = goldenGate();
  gg.position.set(-14, -0.6, -30); gg.rotation.y = 0.35; gg.scale.setScalar(1.6);
  scene.add(gg);
  for (const [x, z, sx, sy, sz] of [[-30, -48, 18, 7, 9], [-8, -52, 16, 5, 9], [12, -60, 22, 6, 10]]) {
    const h = mesh(new THREE.SphereGeometry(1, 40, 20), clay(mixc(S.green, tone(C.cream, 0.85), 0.35), 0.9), { pos: [x, -0.8, z], cast: false });
    h.scale.set(sx, sy, sz); scene.add(h);
  }

  // ---------- the hill: terraces stepping up towards the back, the steep street up the middle
  const hillMat = clay(tone(C.cream, 0.8), 0.85);
  const street3 = street(13.2, 1.5);
  const st = new THREE.Group();
  st.add(street3);
  st.rotation.set(0, Math.PI / 2, 0);
  const tilt = new THREE.Group();
  tilt.add(st);
  tilt.rotation.x = Math.atan(0.4);
  tilt.position.set(0, slopeY(0) + 0.02, 0.0);
  scene.add(tilt);
  // the street's own wedge of hill
  {
    const sh = new THREE.Shape();
    sh.moveTo(5.6, 0); sh.lineTo(-5.6, 0); sh.lineTo(-5.6, slopeY(-5.6)); sh.lineTo(5.2, slopeY(5.2)); sh.closePath();
    const wg = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false });
    wg.rotateY(-Math.PI / 2); wg.translate(0.75, 0, 0);
    scene.add(mesh(wg, hillMat, {}));
  }
  const houses = [], sills = [], roofs = [];
  // painted ladies: pastel shades of the palette
  const colors = [mixc(C.cream, C.terra, 0.42), tone(C.blue, 1, 0.38), mixc(C.cream, C.green, 0.5), tone(C.cream, 0.97), mixc(C.cream, C.terra, 0.24), tone(C.blue, 0.9, 0.55), mixc(C.cream, C.green, 0.3)];
  const zs = [4.4, 2.9, 1.4, -0.1, -1.6, -3.1, -4.6];
  zs.forEach((z, i) => {
    const y = slopeY(z + 0.7);
    for (const side of [-1, 1]) {
      const floors = 2 + ((i + (side > 0 ? 1 : 0)) % 2);
      const h = rowHouse({ w: 1.4, d: 2.4, floors, color: colors[(i * 2 + (side > 0 ? 1 : 0)) % colors.length], lit: 0.7, seed: i * 7 + side });
      h.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      h.position.set(side * 2.2, y, z);
      scene.add(h);
      // terrace block underneath
      scene.add(mesh(rbox(2.8, y + 0.02, 1.5, 0.02), hillMat, { pos: [side * 2.4, (y + 0.02) / 2 - 0.01, z] }));
      h.updateMatrixWorld(true);
      for (const sl of h.userData.sills) sills.push({ pos: sl.pos.clone().applyMatrix4(h.matrixWorld), lit: sl.lit, yaw: h.rotation.y });
      roofs.push({ side, z, y: y + h.userData.height, i });
      houses.push(h);
    }
  });
  // ---------- rooftop routes: bridges across the street and ramps from roof to roof up the hill
  for (let i = 0; i < zs.length; i++) {
    const L = roofs.find((r) => r.i === i && r.side < 0), Rr = roofs.find((r) => r.i === i && r.side > 0);
    if (i % 2 === 0) scene.add(walkway(new THREE.Vector3(-2.0, L.y + 0.05, zs[i]), new THREE.Vector3(2.0, Rr.y + 0.05, zs[i])));
    if (i === 1 || i === 4) {
      const side = i % 2 ? 1 : -1;
      const a = roofs.find((r) => r.i === i && r.side === side), b = roofs.find((r) => r.i === i + 1 && r.side === side);
      scene.add(walkway(new THREE.Vector3(side * 2.2, a.y + 0.05, zs[i] - 0.55), new THREE.Vector3(side * 2.2, b.y + 0.05, zs[i + 1] + 0.55), 0.42));
    }
  }
  // little climbing shelves zig-zagging up two façades
  for (const [x, z0, y0] of [[-1.38, 2.9, slopeY(3.6)], [1.38, -0.1, slopeY(0.6)]]) {
    for (let k = 0; k < 4; k++) scene.add(mesh(rbox(0.32, 0.05, 0.42, 0.015), clay(S.wood, 0.65), { pos: [x + Math.sign(x) * 0.0, y0 + 0.5 + k * 0.48, z0 - 0.45 + (k % 2) * 0.9] }));
  }

  // ---------- cats: in the sunny windows, on the bridges, sprawled on the roofs in pools of sun
  const cats = [];
  const addCat = (pose, coat, pos, yaw, scale = 0.42, seed = cats.length + 60) => {
    const c = makeCat({ pose, coat, seed, lod: 'lo' });
    c.group.position.copy(pos);
    c.group.rotation.y = yaw;
    c.group.scale.setScalar(scale);
    scene.add(c.group);
    cats.push(c);
    return c;
  };
  sills.filter((s) => s.lit).forEach((s, i) => addCat(i % 3 === 0 ? 'loaf' : 'sit', i % 2 ? 'cream' : 'ginger', s.pos, s.yaw, 0.36));
  roofs.forEach((r, i) => {
    if (i % 3 === 1) return;
    const p = new THREE.Vector3(r.side * 2.45, r.y + 0.0, r.z + (i % 2 ? 0.3 : -0.3));
    const pool = sunPool(0.55); pool.position.copy(p).add(new THREE.Vector3(0, 0.02, 0)); scene.add(pool);
    addCat(i % 2 ? 'sprawl' : 'curl', i % 3 ? 'ginger' : 'cream', p, R() * 6, 0.5);
  });
  for (let i = 0; i < zs.length; i += 2) {
    const L = roofs.find((r) => r.i === i && r.side < 0);
    addCat(i % 4 ? 'stand' : 'sit', i % 4 ? 'ginger2' : 'cream', new THREE.Vector3(-0.3 + i * 0.1, L.y + 0.08, zs[i]), i % 4 ? Math.PI / 2 : 0.3, 0.45);
  }
  // street trees
  for (const z of [3.6, 0.6, -2.4]) for (const s of [-1, 1]) { const t = shrub({ r: 0.3, stem: 0.4, seed: z * s * 10 }); t.position.set(s * 0.95, slopeY(z) + 0.02, z); scene.add(t); }

  const labels = placeLabels([{ id: 'sf', text: 'San Francisco', pos: [0.0, slopeY(-4.6) + 2.9, -4.6] }]);
  await labels.sync();

  const lights = rig(scene, pipe.renderer, { size: 9, dist: 50, intensity: 5.8, fillK: 0.22, rimK: 0.3, keyDir: [-0.66, 0.52, 0.42] });
  lights.follow(new THREE.Vector3(0, 2.5, 0), 9);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [2.4, 4.6, 12.0], target: [0, 3.0, -0.6], lens: 35 };
  const B = { pos: [4.4, 9.6, 8.4], target: [0, 3.4, -2.4], lens: 28 };
  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B, { via: [4.6, 6.4, 11.2] }));
      cats.forEach((c, i) => { c.look(Math.sin(t * 0.5 + i) * 0.3, 0.05, 0); c.update(t + i * 1.1); });
      labels.update(cam, { sf: Math.min(1, Math.max(0, (t - 0.8) / 0.5)) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.24, exposure: 1.0, vignette: 0.24 };
    },
  };
}
