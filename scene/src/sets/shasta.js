// Shasta Lake (beat 3): real USGS terrain as a cut-away block; the reservoir refills and the
// dry hills green up. 1 world unit = 1 km, heights x1.5.
import * as THREE from 'three';
import { C, SKY_REFL, clay, rig } from '../core/look.js';
import { applyCam, move } from '../core/camera.js';
import { ease, lerp, prog, smoothstep } from '../core/util.js';
import { dataTexture, loadBin, loadJSON, loadPixels } from '../core/data.js';
import { heightBlock } from '../core/diorama.js';
import { Labels } from '../core/labels.js';

const EX = 1.5;

export async function createShasta(pipe) {
  const [meta, hb, basin] = await Promise.all([loadJSON('shasta_meta.json'), loadBin('shasta_height.f32'), loadPixels('shasta_basin.png')]);
  const { nx, ny, res } = meta;
  const Hm = new Float32Array(hb);
  const sx = (nx * res) / 1000, sz = (ny * res) / 1000;
  const base0 = 150; // metres at y = 0
  const yOfM = (m) => ((m - base0) / 1000) * EX;
  const hAt = (x, z) => {
    let gx = (x / sx + 0.5) * nx - 0.5, gz = (z / sz + 0.5) * ny - 0.5;
    gx = Math.min(nx - 1.001, Math.max(0, gx)); gz = Math.min(ny - 1.001, Math.max(0, gz));
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const g = (a, b) => Hm[b * nx + a];
    return (g(ix, iz) * (1 - fx) + g(ix + 1, iz) * fx) * (1 - fz) + (g(ix, iz + 1) * (1 - fx) + g(ix + 1, iz + 1) * fx) * fz;
  };
  const height = (x, z) => yOfM(hAt(x, z));

  const U = { uLevel: { value: 0 }, uFull: { value: yOfM(meta.levelHigh) }, uGreen: { value: 0 }, uSubject: { value: C.subject.clone() }, uGreenCol: { value: C.green.clone() } };
  const topMat = clay(0xffffff, 0.8);
  topMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vNw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz; vNw = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; varying vec3 vNw; uniform float uLevel, uFull, uGreen; uniform vec3 uSubject, uGreenCol;
        float hh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), u.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <color_fragment>', `
        vec3 col = uSubject * 0.95;
        float flat_ = smoothstep(0.55, 0.9, vNw.y);
        // Vegetation patches green up over the beat (recovery green, mixed with grey so it stays calm)
        float veg = smoothstep(0.35, 0.65, vn(vW.xz * 1.6) * 0.7 + vn(vW.xz * 5.0) * 0.3) * (0.4 + 0.6 * flat_);
        col = mix(col, mix(uSubject, uGreenCol, 0.75), veg * uGreen * 0.85);
        // Bare "bathtub ring" between today's water line and full pool, with faint old waterlines
        float ring = step(vW.y, uFull + 0.004) * step(uLevel - 0.004, vW.y);
        float lines = 0.5 + 0.5 * sin(vW.y * 900.0);
        col = mix(col, vec3(0.62, 0.62, 0.60) * (0.92 + 0.08 * lines), ring * 0.85);
        diffuseColor.rgb = col;`);
  };
  const layers = [
    { depth: 0.06, color: C.subject.clone().multiplyScalar(0.55) },
    { depth: 0.35, color: C.subject.clone().multiplyScalar(0.72) },
    { depth: 9, color: C.subject.clone().multiplyScalar(0.9) },
  ];
  const block = heightBlock({ sx, sz, nx: Math.round(nx / 2), nz: Math.round(ny / 2), height, base: -0.6, topMat, layers });

  // Water: a glossy plane masked to the reservoir basin (so it never appears below the dam)
  const basinTex = dataTexture(basin, { mip: false });
  const waterMat = new THREE.MeshStandardMaterial({ color: C.water.clone().multiplyScalar(0.9), roughness: 0.2, alphaMap: basinTex, alphaTest: 0.5 });
  waterMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + SKY_REFL)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, 1.0);\n#include <opaque_fragment>');
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;

  // Shasta Dam: a curved concrete wall across the canyon
  const [[ax, ay], [bx, by]] = meta.dam;
  const gp = (i, j) => new THREE.Vector3(((i + 0.5) / nx - 0.5) * sx, 0, ((j + 0.5) / ny - 0.5) * sz);
  const A = gp(ax, ay), B = gp(bx, by);
  const mid = A.clone().lerp(B, 0.5), dir = B.clone().sub(A), len = dir.length();
  const crest = yOfM(meta.damCrest);
  // Built by hand: a curved wall, thicker at the base, from the canyon floor up to the crest
  const arc = new THREE.QuadraticBezierCurve3(A.clone(), mid.clone().add(new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(-len * 0.18)), B.clone());
  const N = 40, vpos = [], vidx = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, P = arc.getPoint(t), T = arc.getTangent(t).setY(0).normalize();
    const side = new THREE.Vector3(-T.z, 0, T.x);
    const floorY = Math.min(height(P.x, P.z), crest) - 0.3;
    for (const [w, y] of [[0.09, floorY], [0.03, crest], [-0.03, crest], [-0.09, floorY]]) {
      const v = P.clone().addScaledVector(side, w); vpos.push(v.x, y, v.z);
    }
    if (k < N) for (let q = 0; q < 3; q++) {
      const a = k * 4 + q, b = a + 1, c = a + 4, d = a + 5;
      vidx.push(a, c, b, b, c, d);
    }
  }
  const damGeo = new THREE.BufferGeometry();
  damGeo.setAttribute('position', new THREE.Float32BufferAttribute(vpos, 3));
  damGeo.setIndex(vidx);
  damGeo.computeVertexNormals();
  const damMat = clay(new THREE.Color('#D3D6D9'), 0.65, { side: THREE.DoubleSide });
  const dam = new THREE.Mesh(damGeo, damMat);
  dam.castShadow = dam.receiveShadow = true;

  const scene = new THREE.Scene();
  scene.background = C.bg.clone();
  const table = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), clay(C.bg.clone().multiplyScalar(1.15), 0.95));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.62; table.receiveShadow = true;
  scene.add(table, block.group, water, dam);
  const lights = rig(scene, pipe.renderer, { size: 22, dist: 60, intensity: 2.5, keyDir: [-0.6, 0.62, 0.35] });

  const labels = new Labels();
  const L = meta.labels;
  const lakeP = gp(L.lake[0], L.lake[1]); lakeP.y = yOfM(meta.levelHigh) + 0.05;
  const damP = mid.clone(); damP.y = crest + 0.05;
  labels.add('lake', { text: 'Shasta Lake', pos: lakeP, italic: true, size: 32, priority: 3 });
  labels.add('dam', { text: 'Shasta Dam', pos: damP, dot: true, size: 28, priority: 4 });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 600);
  const SA = { pos: new THREE.Vector3(-21, 15, 30), target: new THREE.Vector3(-1.5, 0.2, 1), lens: 50 };
  const SB = { pos: mid.clone().add(new THREE.Vector3(-3.6, 3.4, 6.2)), target: mid.clone().add(new THREE.Vector3(1.8, 0.0, -3.2)), lens: 50 };
  const want = {};

  function frame(f, ctx) {
    const s = move(f, 315, 416, SA, SB, { fn: ease.inOutCubic });
    applyCam(cam, s);
    lights.follow(s.target, 18);
    lights.warmth(0);
    const p = ease.inOutSine(prog(f, 306, 414));
    const level = lerp(meta.levelLow, meta.levelHigh, p);
    U.uLevel.value = yOfM(level);
    U.uGreen.value = smoothstep(318, 410, f);
    water.position.y = yOfM(level);
    want.lake = smoothstep(318, 332, f) * (1 - smoothstep(406, 414, f));
    want.dam = smoothstep(340, 354, f) * (1 - smoothstep(406, 414, f));
    labels.update(cam, want, ctx.avoid);
    return { scene, camera: cam, labels: labels.scene, bloom: 0.2 };
  }
  return { scene, frame };
}
