// Beat 6: inside a slot canyon like the Narrows. Tall sculpted walls a stride apart, an empty sandy floor,
// then a turquoise surge rolls down the slot and fills it. Two tiny hikers watch from a bench high on
// the rim, well back from the edge (safe, and the scale of the walls).
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone } from '../look.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { ease, prog, rng, smoothstep } from '../../../src/core/util.js';
import { cloudBank, flowSheet, hiker, rainField, sandstone } from '../lib/rock.js';

const FPS = 30;
const B0 = 660;
const H = 9, Z0 = -40, Z1 = 6;
const cx = (z) => 0.9 * Math.sin(z * 0.11) + 0.3 * Math.sin(z * 0.29 + 1.0);
const hw = (y, z) => 0.7 + 0.045 * y + 0.16 * Math.sin(y * 1.6 + z * 0.55) + 0.08 * Math.sin(y * 3.7 - z * 0.3);

export async function createSlot(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene);
  scene.fog = new THREE.Fog(tone(C.storm, 1.3), 18, 48);
  const R = rng(21);

  // ---------- the two walls, each rising from the floor, rolling over the rim and running out as plateau
  const NZ = 420, NV = 200, VMAX = H + 7;
  const rock = sandstone({ capFrom: 8.3, capTo: 9.1, bands: 4.2 });
  for (const side of [-1, 1]) {
    const pos = [], idx = [];
    for (let j = 0; j <= NV; j++) {
      const v = (VMAX * j) / NV;
      for (let i = 0; i <= NZ; i++) {
        const z = Z0 + ((Z1 - Z0) * i) / NZ;
        let x, y;
        if (v <= H) { x = cx(z) + side * hw(v, z); y = v; }
        else {
          const b = v - H;
          x = cx(z) + side * (hw(H, z) + b * 1.6);
          y = H + 0.35 * (1 - Math.exp(-b * 2.5)) + 0.4 * Math.max(0, Math.sin(z * 0.45 + side) * Math.sin(b * 0.8)) * smoothstep(1, 3, b);
        }
        pos.push(x, y, z);
      }
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NZ; i++) {
      const a = j * (NZ + 1) + i, b = a + 1, c = a + NZ + 1, d = c + 1;
      if (side < 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, rock);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, Z1 - Z0).rotateX(-Math.PI / 2), clay(mixc(S.cream, S.red, 0.45), 0.9));
  floor.position.set(0, 0, (Z0 + Z1) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- the surge: a strip that runs down the slot towards the camera and rises
  const SEG = 300;
  const wpos = new Float32Array((SEG + 1) * 6), wuv = new Float32Array((SEG + 1) * 4), widx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2; widx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  wgeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
  wgeo.setIndex(widx);
  const wmat = flowSheet({ color: tone(C.water, 0.8), speed: 3.4, streakScale: [4, 40], opacity: 0.97, reflect: 0.8 });
  const surge = new THREE.Mesh(wgeo, wmat);
  surge.renderOrder = 2;
  scene.add(surge);
  function setLevel(level) {
    for (let i = 0; i <= SEG; i++) {
      const z = Z0 + ((Z1 - Z0) * i) / SEG;
      const w = hw(level, z) - 0.03;
      for (const [k, s] of [[0, -1], [1, 1]]) {
        const o = (i * 2 + k) * 3;
        wpos[o] = cx(z) + s * w; wpos[o + 1] = level; wpos[o + 2] = z;
        wuv[(i * 2 + k) * 2] = k; wuv[(i * 2 + k) * 2 + 1] = i / SEG;
      }
    }
    wgeo.attributes.position.needsUpdate = true;
    wgeo.attributes.uv.needsUpdate = true;
    wgeo.computeVertexNormals();
    wgeo.computeBoundingSphere();
  }

  // ---------- two hikers on the right-hand rim, well back from the edge, looking down at the water
  const zh = -11;
  const hikers = new THREE.Group();
  const h1 = hiker(S.green, S.cream), h2 = hiker(S.cream, S.greenDark);
  h1.position.set(0, 0, 0); h2.position.set(0.32, 0, 0.28);
  h2.scale.setScalar(0.92);
  hikers.add(h1, h2);
  hikers.scale.setScalar(1.1);
  hikers.position.set(cx(zh) + hw(H, zh) + 1.0, H + 0.34, zh);
  hikers.rotation.y = -Math.PI / 2 - 0.25; // facing the slot (-x), a little towards the camera
  scene.add(hikers);

  // a few plants on the rim
  for (let i = 0; i < 70; i++) {
    const side = R() < 0.5 ? -1 : 1, z = Z0 + 6 + R() * 40, b = 0.5 + R() * 4.5;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + R() * 0.12, 1), clay(R() < 0.5 ? S.green : S.greenDark, 0.8));
    m.position.set(cx(z) + side * (hw(H, z) + b * 1.6), H + 0.38, z);
    m.scale.y = 0.75;
    scene.add(m);
  }

  const clouds = cloudBank(R, { count: 24, spread: [30, 2, 40], at: [0, 17, -14], size: [1.6, 3.4] });
  scene.add(clouds);
  const rain = rainField(scene, R, { n: 1800, w: 10, h: 12, d: 22, len: 0.4, opacity: 0.24 });

  const lights = rig(scene, pipe.renderer, { size: 14, dist: 40, intensity: 2.6, keyDir: [-0.35, 0.9, -0.25], rimDir: [0.3, 0.5, -1], fillK: 0.5 });
  lights.follow(new THREE.Vector3(0, 4, -10), 16);

  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.05, 300);
  // Slow push-in down the slot from just under the rim; it ends framing the hikers above the water
  const A = { pos: [cx(8) - 0.6, 11.6, 8], target: [cx(-14) + 0.7, 4.4, -14], lens: 50 };
  const B = { pos: [cx(4) - 0.6, 11.0, 4], target: [cx(-13) + 1.0, 5.2, -13], lens: 50 };

  return {
    frame(f) {
      const t = f / FPS, bt = (f - B0) / FPS;
      applyCam(cam, move(f, B0 + 16, B0 + 104, A, B, { fn: ease.inOutSine }));
      rock.userData.U.uWet.value = 0.7;
      // the surge front comes down the slot from the far end and the level rises behind it
      const lvl = 0.06 + 1.7 * ease.inOutSine(prog(bt, 0.8, 3.6));
      setLevel(lvl);
      wmat.userData.U.uProgress.value = ease.inOutSine(prog(bt, 0.2, 2.4)) * 1.03;
      wmat.userData.U.uT.value = t;
      // the hikers shift their weight a little
      h1.rotation.y = 0.08 * Math.sin(t * 1.3);
      h2.rotation.y = -0.1 + 0.06 * Math.sin(t * 1.1 + 1);
      clouds.position.x = t * 0.12;
      rain.update(t, 1, { x: cam.position.x, z: cam.position.z - 12 }, 2);
      return { scene, camera: cam, bloom: 0.25, exposure: 1.0, vignette: 0.3 };
    },
  };
}
