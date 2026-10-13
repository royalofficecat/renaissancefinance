// Beat 11: Salt Lake City on transparent ground. The street grid and the toy city sit on a glass skin that follows
// the real terrain (USGS 3DEP, 30 m). Under the glass lies the land itself, contoured: the natural creeks the city
// built over (traced downhill on the real terrain) glow turquoise as mountain runoff arrives, and the lowest ground
// starts to hold water. 1 world unit = 1 km; heights x2.
import * as THREE from 'three';
import { dataTexture, loadBin, loadJSON, loadPixels } from '../../../src/core/data.js';
import { Labels } from '../../../src/core/labels.js';
import { applyCam, orbit } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng } from '../../../src/core/util.js';
import { C, HEX, S, SKY_REFL, SKY_U, backdrop, clay, mixc, rig, tone } from '../look.js';

const FPS = 30;
const BEAT = [1260, 1380];
const EX = 2.0;
const GAP = 0.32; // how far the land sits below the glass street skin

export async function createCity(pipe) {
  const [meta, hb, flow] = await Promise.all([loadJSON('slc_meta.json'), loadBin('slc_height.f32'), loadPixels('slc_flow.png')]);
  const { n, half, res } = meta;
  const H = new Float32Array(hb);
  const SIZE = (2 * half) / 1000;
  const h0 = meta.minH;
  const hAt = (u, v) => {
    // u, v in 0..1 (u east, v south)
    const x = clamp(u * n - 0.5, 0, n - 1.001), y = clamp(v * n - 0.5, 0, n - 1.001);
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const g = (a, b) => H[b * n + a];
    return (g(ix, iy) * (1 - fx) + g(ix + 1, iy) * fx) * (1 - fy) + (g(ix, iy + 1) * (1 - fx) + g(ix + 1, iy + 1) * fx) * fy;
  };
  const yAt = (wx, wz) => ((hAt(wx / SIZE + 0.5, wz / SIZE + 0.5) - h0) / 1000) * EX;
  const scene = new THREE.Scene();
  const sky = backdrop(scene);
  scene.fog = new THREE.Fog(tone(C.storm, 1.4), 18, 60);
  const R = rng(11);

  const makeSurface = (lift, seg = 240) => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, yAt(P.getX(i), P.getZ(i)) + lift);
    g.computeVertexNormals();
    return g;
  };
  const U = { uFlow: { value: dataTexture(flow) }, uTime: { value: 0 }, uRun: { value: 0 }, uPool: { value: 0 }, uWater: { value: tone(C.water, 1.1) }, uLand: { value: mixc(S.storm, S.red, 0.45) }, uH0: { value: 0 } };

  // ---------- the land under the city: contoured, creeks glowing as runoff arrives
  const land = clay(0xffffff, 0.8);
  land.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, SKY_U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2; varying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv; vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vUv2; varying vec3 vWP; uniform sampler2D uFlow; uniform float uTime, uRun, uPool; uniform vec3 uWater, uLand;
        float gW = 0.0;
        ${SKY_REFL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 fl = texture2D(uFlow, vUv2).rgb;
        vec3 c = uLand * (0.82 + 0.3 * smoothstep(0.0, 1.4, vWP.y));
        // contour lines every 20 m (x2 exaggeration -> 0.04 units)
        float cl = abs(fract((vWP.y + ${GAP.toFixed(2)}) / 0.04) - 0.5);
        c = mix(c * 1.5, c, smoothstep(0.0, 0.07, cl));
        // the natural creeks, pulsing downhill
        float creek = smoothstep(0.44, 0.5, fl.r);
        float pulse = 0.6 + 0.4 * sin(vWP.y * 40.0 + uTime * 6.0);
        float wet = creek * uRun;
        float pool = smoothstep(1.0 - uPool, 1.0 - uPool + 0.1, fl.g) * step(0.01, uPool);
        gW = max(wet, pool);
        c = mix(c, uWater * (1.0 + 0.35 * pulse * creek), gW);
        diffuseColor.rgb = c;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uWater * 1.1 * gW * (0.75 + 0.25 * sin(vWP.y * 40.0 + uTime * 6.0));`)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, gW * 0.5);\n#include <opaque_fragment>');
  };
  const landMesh = new THREE.Mesh(makeSurface(-GAP), land);
  landMesh.receiveShadow = true;
  scene.add(landMesh);

  // ---------- the cut-away block: soil walls below the land, glass walls between land and street skin
  const soil = clay(S.redDark, 0.85), soilPale = clay(mixc(S.cream, S.red, 0.5), 0.85);
  const glassSide = new THREE.MeshStandardMaterial({ color: tone(C.water, 1, 0.75), roughness: 0.15, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  for (const [ax, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
    const segs = 120, pos = [], idx = [], gpos = [];
    for (let i = 0; i <= segs; i++) {
      const s = -SIZE / 2 + (SIZE * i) / segs;
      const wx = ax === 'x' ? sgn * SIZE / 2 : s, wz = ax === 'z' ? sgn * SIZE / 2 : s;
      const y = yAt(clamp(wx, -SIZE / 2 + 1e-3, SIZE / 2 - 1e-3), clamp(wz, -SIZE / 2 + 1e-3, SIZE / 2 - 1e-3));
      pos.push(wx, y - GAP, wz, wx, -1.2, wz);
      gpos.push(wx, y, wz, wx, y - GAP, wz);
      if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, ax === 'x' ? soil : soilPale);
    m.material.side = THREE.DoubleSide;
    scene.add(m);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    gg.setIndex(idx); gg.computeVertexNormals();
    const gm = new THREE.Mesh(gg, glassSide);
    gm.renderOrder = 6;
    scene.add(gm);
  }

  // ---------- the toy city on the glass: blocks of the famous wide grid, taller downtown
  const BLOCK = 0.2, STREET = 0.028;
  const dt = { x: -0.9, z: 0.15 }; // downtown, west of the foothills
  const boxes = [];
  for (let bx = -SIZE / 2 + 0.3; bx < SIZE / 2 - 0.3; bx += BLOCK) for (let bz = -SIZE / 2 + 0.3; bz < SIZE / 2 - 0.3; bz += BLOCK) {
    const cxb = bx + BLOCK / 2, czb = bz + BLOCK / 2;
    const hgt = (hAt(cxb / SIZE + 0.5, czb / SIZE + 0.5) - h0);
    if (hgt > 300) continue; // the foothills and canyons stay open land
    const d = Math.hypot(cxb - dt.x, czb - dt.z);
    const tall = Math.exp(-(d * d) / 0.6);
    const k = 1 + Math.floor(R() * 3);
    for (let i = 0; i < k; i++) {
      const w = (BLOCK - STREET) * (k === 1 ? 0.8 : 0.42), dd = w * (0.7 + R() * 0.3);
      const ox = k === 1 ? 0 : (i % 2 ? 1 : -1) * (BLOCK - STREET) * 0.24, oz = k === 1 ? 0 : (i > 1 ? 1 : -1) * (BLOCK - STREET) * 0.24 * (k > 2 ? 1 : 0);
      const ht = (tall < 0.2 ? 0.025 + 0.02 * R() : 0.035 + 0.035 * R()) + tall * (0.2 + 0.55 * R() * R());
      if (R() < (tall < 0.2 ? 0.55 : 0.1)) continue;
      boxes.push({ x: cxb + ox, z: czb + oz, w, d: dd, h: ht, c: tall > 0.4 ? (R() < 0.5 ? 0 : 1) : 2 + Math.floor(R() * 2) });
    }
  }
  const bcols = [tone(C.cream, 1, 0.25), mixc(S.cream, S.storm, 0.35), tone(C.cream, 0.95), mixc(S.cream, S.red, 0.3)];
  const bgeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const binst = new THREE.InstancedMesh(bgeo, clay(0xffffff, 0.7), boxes.length);
  binst.castShadow = binst.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  boxes.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, yAt(b.x, b.z) - 0.005, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    binst.setMatrixAt(i, m4);
    binst.setColorAt(i, bcols[b.c]);
  });
  scene.add(binst);

  // ---------- the glass street skin: streets in charcoal, the rest see-through; water collects on the low streets
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  glass.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, SKY_U, { uStreet: { value: mixc(S.storm, S.cream, 0.3) }, uGlass: { value: tone(C.water, 1, 0.85) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2; varying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv; vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vUv2; varying vec3 vWP; uniform sampler2D uFlow; uniform float uTime, uPool; uniform vec3 uWater, uStreet, uGlass;
        float gW = 0.0;
        ${SKY_REFL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 g = abs(fract((vWP.xz + ${(SIZE / 2 - 0.3).toFixed(3)}) / ${BLOCK.toFixed(3)}) - 0.0);
        vec2 e = min(g, 1.0 - g) * ${BLOCK.toFixed(3)};
        float street = 1.0 - smoothstep(${(STREET / 2 - 0.003).toFixed(4)}, ${(STREET / 2 + 0.003).toFixed(4)}, min(e.x, e.y));
        street *= 1.0 - smoothstep(${(0.26 * EX).toFixed(3)}, ${(0.32 * EX).toFixed(3)}, vWP.y);   // no streets on the foothills
        vec3 fl = texture2D(uFlow, vUv2).rgb;
        float flood = smoothstep(1.0 - uPool * 0.8, 1.0 - uPool * 0.8 + 0.08, fl.g) * street * step(0.01, uPool);
        gW = flood;
        vec3 c = mix(uGlass, uStreet, street);
        c = mix(c, uWater * 1.1, flood);
        diffuseColor.rgb = c;
        diffuseColor.a = mix(0.12, 0.7, street);
        diffuseColor.a = max(diffuseColor.a, flood * 0.95);`)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, 0.25 + gW * 0.6);\n#include <opaque_fragment>');
  };
  const glassMesh = new THREE.Mesh(makeSurface(0.002, 300), glass);
  glassMesh.renderOrder = 5;
  scene.add(glassMesh);

  // ---------- rain
  const N = 1400;
  const rain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.28, 0.006), new THREE.MeshBasicMaterial({ color: tone(C.water, 1, 0.65), transparent: true, opacity: 0.3, depthWrite: false }), N);
  rain.frustumCulled = false;
  scene.add(rain);
  const seeds = Array.from({ length: N }, () => [R() - 0.5, R(), R() - 0.5, 0.8 + R() * 0.4]);

  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  labels.add('slc', { text: 'Salt Lake City', pos: new THREE.Vector3(dt.x, yAt(dt.x, dt.z) + 0.55, dt.z), dot: true, size: 30, priority: 2 });
  labels.add('wasatch', { text: 'Wasatch Range', pos: new THREE.Vector3(3.2, yAt(3.2, -3.2) + 0.25, -3.2), size: 30, priority: 1 });
  await labels.sync();

  const lights = rig(scene, pipe.renderer, { size: 7, dist: 30, intensity: 2.6 });
  lights.follow(new THREE.Vector3(0, 0, 0), 7);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 300);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0.05)), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3();
  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, orbit(f, BEAT[0] + 20, BEAT[1] - 18, { center: [-0.4, 0.2, 0.6], a0: -0.82, a1: -0.42, r0: 10.6, r1: 9.8, h0: 6.4, h1: 5.8, lens0: 35, target: [-0.1, 0.15, -0.6], fn: ease.inOutSine }));
      U.uTime.value = f / FPS;
      U.uRun.value = 0.55 + 0.45 * ease.inOutSine(prog(t, 0.3, 2.0));
      U.uPool.value = 0.18 + 0.36 * ease.inOutSine(prog(t, 0.6, 3.2));
      for (let i = 0; i < N; i++) {
        const [x, ph, z, sp] = seeds[i];
        v.set(x * 11, 5 - ((ph * 5 + (f / FPS) * 9 * sp) % 5), z * 11);
        m4.compose(v, q, one);
        rain.setMatrixAt(i, m4);
      }
      rain.instanceMatrix.needsUpdate = true;
      void zero;
      labels.update(cam, { slc: clamp((t - 0.7) / 0.5), wasatch: clamp((t - 0.9) / 0.5) * 0.95 }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.25, exposure: 1.0, vignette: 0.26 };
    },
  };
}
