// Beat 1 (the hook): rain hits red sandstone and a dry wash becomes a rushing channel.
// A miniature canyon in Zion-like country: stair-step sandstone ledges (red below, a pale cream cap above),
// a sandy wash winding down the middle. The rock darkens as it gets wet; a turquoise sheet of water races
// down the wash towards the camera, then swells into a channel with streaks of foam.
import * as THREE from 'three';
import { C, S, backdrop, clay, mixc, rig, tone, water } from '../look.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng, smoothstep } from '../../../src/core/util.js';

const FPS = 30;
const Z0 = -22, Z1 = 7; // canyon runs along z; the camera looks up-canyon (towards -z)
const center = (z) => 1.1 * Math.sin(z * 0.33) + 0.45 * Math.sin(z * 0.81 + 1.3);
const halfFloor = (z) => 1.25 + 0.35 * Math.sin(z * 0.47 + 0.6);

function rockHeight(x, z) {
  const d = Math.abs(x - center(z)) - halfFloor(z);
  // the wash floor dips gently towards a central channel
  const dc = Math.abs(x - center(z));
  if (d <= 0) return -0.08 * (1 - smoothstep(0, 0.6, dc)) + 0.015 * Math.sin(x * 9 + z * 3);
  // stair-step ledges: three tiers with steep risers and soft rounded lips
  const tiers = [[0.0, 1.1], [1.2, 0.95], [2.5, 1.15]];
  let h = 0;
  for (const [at, th] of tiers) {
    const wob = 0.12 * Math.sin(z * 1.3 + at * 5) + 0.06 * Math.sin(z * 3.7 + at);
    const u = smoothstep(at, at + 0.42, d + wob);
    h += th * (u * u * (3 - 2 * u));
  }
  // rounded sandstone domes on top
  h += 0.35 * Math.max(0, Math.sin(x * 0.9 + 0.5) * Math.sin(z * 0.7)) * smoothstep(2.6, 3.4, d);
  return h;
}

export async function createCanyon(pipe) {
  const scene = new THREE.Scene();
  const sky = backdrop(scene);
  scene.fog = new THREE.Fog(tone(C.storm, 1.5), 14, 46);
  const R = rng(1);

  // ---------- sandstone: banded strata (red, darker red, a cream cap), darkening when wet
  const NX = 380, NZ = 820, W = 16;
  const geo = new THREE.PlaneGeometry(W, Z1 - Z0, NX, NZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, (Z0 + Z1) / 2);
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, rockHeight(P.getX(i), P.getZ(i)));
  geo.computeVertexNormals();
  const RU = { uWet: { value: 0 }, uRed: { value: S.red }, uRedDark: { value: S.redDark }, uCream: { value: S.cream }, uSand: { value: mixc(S.cream, S.red, 0.35) } };
  const rock = clay(0xffffff, 0.82);
  rock.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, RU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz; vN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vN; uniform float uWet; uniform vec3 uRed, uRedDark, uCream, uSand;
        float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float y = vWP.y + 0.05 * sin(vWP.x * 1.3 + vWP.z * 0.7);
        float band = 0.5 + 0.5 * sin(y * 7.0);
        vec3 c = mix(uRed, uRedDark, smoothstep(0.3, 0.7, band) * 0.35);
        c = mix(c, uCream, smoothstep(2.55, 2.9, y));           // the pale cap layer
        c = mix(c, uRed * 1.08, smoothstep(0.8, 1.0, vN.y) * (1.0 - smoothstep(2.55, 2.9, y)) * 0.35);
        c = mix(uSand, c, smoothstep(0.04, 0.16, vWP.y));       // sandy wash floor
        c *= 0.94 + 0.08 * h1(floor(vWP.xz * 18.0));
        c *= 1.0 - 0.28 * uWet;                                   // wet rock goes darker
        diffuseColor.rgb = c;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.45, uWet);');
  };
  const rockMesh = new THREE.Mesh(geo, rock);
  rockMesh.castShadow = rockMesh.receiveShadow = true;
  scene.add(rockMesh);
  // the diorama base underneath (cut edges read as a solid block)
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, Z1 - Z0), clay(S.redDeep, 0.85));
  base.position.set(0, -0.56, (Z0 + Z1) / 2);
  scene.add(base);

  // ---------- the flood: a strip of water along the wash, advancing down-canyon and swelling
  const SEG = 360;
  const wpos = new Float32Array((SEG + 1) * 2 * 3), wuv = new Float32Array((SEG + 1) * 2 * 2), widx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2; widx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  wgeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
  wgeo.setIndex(widx);
  const WU = { uFront: { value: Z0 }, uTime: { value: 0 }, uFoam: { value: tone(C.cream, 1.0, 0.4) }, uSpeed: { value: 1 } };
  const wmat = water(tone(C.water, 0.72), { roughness: 0.08, transparent: true, reflect: 1.2 });
  const prevCompile = wmat.onBeforeCompile;
  wmat.onBeforeCompile = (sh) => {
    prevCompile(sh);
    Object.assign(sh.uniforms, WU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2; varying vec3 vWP2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv; vWP2 = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vUv2; varying vec3 vWP2; uniform float uFront, uTime, uSpeed; uniform vec3 uFoam;
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          float a = fract(sin(dot(i, vec2(127.1,311.7)))*43758.5), b = fract(sin(dot(i+vec2(1,0), vec2(127.1,311.7)))*43758.5);
          float c = fract(sin(dot(i+vec2(0,1), vec2(127.1,311.7)))*43758.5), d = fract(sin(dot(i+vec2(1,1), vec2(127.1,311.7)))*43758.5);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // foam streaks flow down-canyon (+z), stronger at the edges and at the advancing front
        vec2 q = vec2(vUv2.x * 14.0, vWP2.z * 0.9 - uTime * 2.2 * uSpeed);
        float streak = smoothstep(0.66, 0.9, n2(q) * 0.65 + n2(q * vec2(2.3, 1.4)) * 0.35);
        float deep = 1.0 - smoothstep(0.0, 0.32, abs(vUv2.x - 0.5));
        diffuseColor.rgb *= mix(1.0, 0.72, deep);
        float edge = smoothstep(0.32, 0.5, abs(vUv2.x - 0.5));
        float front = 1.0 - smoothstep(0.0, 0.9, uFront - vWP2.z);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, clamp(streak * 0.4 + edge * 0.35 + front * 0.55, 0.0, 0.75));
        diffuseColor.a = smoothstep(-0.05, 0.25, uFront - vWP2.z) * (1.0 - smoothstep(0.46, 0.5, abs(vUv2.x - 0.5)));`);
  };
  const wmesh = new THREE.Mesh(wgeo, wmat);
  wmesh.renderOrder = 2;
  scene.add(wmesh);
  function updateWater(level, spread) {
    for (let i = 0; i <= SEG; i++) {
      const z = Z0 + ((Z1 - Z0) * i) / SEG, xc = center(z), hw = 0.35 + 0.75 * spread * halfFloor(z) * 0.6;
      for (const [k, s] of [[0, -1], [1, 1]]) {
        const o = (i * 2 + k) * 3;
        wpos[o] = xc + s * hw; wpos[o + 1] = level; wpos[o + 2] = z;
        wuv[(i * 2 + k) * 2] = k; wuv[(i * 2 + k) * 2 + 1] = i / SEG;
      }
    }
    wgeo.attributes.position.needsUpdate = true;
    wgeo.computeVertexNormals();
    wgeo.computeBoundingSphere();
  }

  // ---------- rain: thin seeded streaks in a box around the view
  const N = 2200;
  const rgeo = new THREE.BoxGeometry(0.006, 0.3, 0.006);
  const rmat = new THREE.MeshBasicMaterial({ color: tone(C.water, 1, 0.65), transparent: true, opacity: 0.32, depthWrite: false });
  const rain = new THREE.InstancedMesh(rgeo, rmat, N);
  rain.frustumCulled = false;
  scene.add(rain);
  const seeds = Array.from({ length: N }, () => [R() - 0.5, R(), R() - 0.5, 0.8 + R() * 0.4]);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0.06)), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  function updateRain(t, k, around) {
    const top = 6;
    for (let i = 0; i < N; i++) {
      const [x, ph, z, sp] = seeds[i];
      const y = top - ((ph * top + t * 11 * sp) % top);
      v3.set(around.x + x * 12, y, around.z - 3 - (z + 0.5) * 15);
      m4.compose(v3, q, i / N < k ? one : v3.clone().set(0, 0, 0));
      rain.setMatrixAt(i, m4);
    }
    rain.instanceMatrix.needsUpdate = true;
  }
  // splash rings on the rock near the camera
  const splashes = Array.from({ length: 90 }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.035, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: tone(C.cream, 1, 0.5), transparent: true, depthWrite: false }));
    m.renderOrder = 3;
    scene.add(m);
    return { m, x: (R() - 0.5) * 7, z: Z1 - 1 - R() * 9, ph: R(), sp: 1.4 + R() };
  });

  // ---------- storm clouds over the canyon
  const cloudMat = clay(S.cloud, 0.95, { emissive: tone(C.storm, 0.45) });
  const clouds = new THREE.Group();
  const cgeo = new THREE.SphereGeometry(1, 20, 14);
  for (let i = 0; i < 26; i++) {
    const s = 1.2 + R() * 1.6;
    const c = new THREE.Mesh(cgeo, cloudMat);
    c.scale.set(s * 1.5, s * 0.6, s);
    c.position.set((R() - 0.5) * 22, 7.5 + R() * 1.5, Z0 + R() * 24);
    clouds.add(c);
  }
  scene.add(clouds);

  // ---------- a few tufts of green that spring from cracks as the beat ends
  const tufts = [];
  const tg = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < 16; i++) {
    const z = Z1 - 2 - R() * 14, side = R() < 0.5 ? -1 : 1;
    const d = halfFloor(z) + 0.1 + R() * 1.6;
    const x = center(z) + side * d;
    const t = new THREE.Mesh(tg, clay(R() < 0.5 ? S.green : S.greenDark, 0.8));
    t.position.set(x, rockHeight(x, z) + 0.02, z);
    t.userData = { s: 0.07 + R() * 0.06, d: 3.6 + R() * 1.8 };
    t.castShadow = true;
    scene.add(t);
    tufts.push(t);
  }

  const lights = rig(scene, pipe.renderer, { size: 12, dist: 40, intensity: 2.6, keyDir: [-0.5, 0.75, -0.42], rimDir: [0.3, 0.4, 1] });
  lights.follow(new THREE.Vector3(0, 0, -4), 12);
  const flash = new THREE.DirectionalLight('#E9EEF6', 0);
  flash.position.set(-3, 10, -10);
  scene.add(flash);

  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 300);
  // Low wide shot from the downstream end, looking up the wash; slow push-in (28 mm)
  const A = { pos: [center(6.5) + 0.6, 2.55, 6.5], target: [center(-5) - 0.3, 0.55, -5], lens: 28 };
  const B = { pos: [center(4.6) + 0.5, 2.2, 4.6], target: [center(-6) - 0.3, 0.5, -6], lens: 28 };

  return {
    frame(f) {
      const t = f / FPS;
      applyCam(cam, move(f, 0, 178, A, B, { fn: ease.inOutSine }));
      // rain arrives at once (it's the hook), the rock darkens over 2 s
      const rainK = 0.35 + 0.65 * ease.outCubic(prog(t, 0, 1.2));
      updateRain(t, rainK, cam.position);
      RU.uWet.value = ease.inOutSine(prog(t, 0.1, 2.2));
      // the water front comes down-canyon from 0.6 s and reaches the camera at about 2.4 s; then the channel swells
      const front = Z0 + (Z1 + 2 - Z0) * ease.inOutSine(prog(t, 0.5, 2.6));
      WU.uFront.value = front;
      WU.uTime.value = t;
      WU.uSpeed.value = 0.6 + 0.8 * prog(t, 1.5, 3.5);
      updateWater(0.035 + 0.22 * ease.inOutSine(prog(t, 1.6, 4.6)), 0.7 + 0.38 * ease.inOutSine(prog(t, 1.2, 4.2)));
      for (const s of splashes) {
        const p = ((t * s.sp + s.ph) % 1);
        s.m.position.set(cam.position.x + s.x, 0, s.z);
        s.m.position.y = rockHeight(s.m.position.x, s.z) + 0.01;
        s.m.scale.setScalar(0.4 + p * 2.2);
        s.m.material.opacity = 0.5 * (1 - p) * rainK;
      }
      for (const tf of tufts) tf.scale.setScalar(Math.max(1e-4, tf.userData.s * (t > tf.userData.d ? 1 - Math.exp(-(t - tf.userData.d) * 5) * Math.cos((t - tf.userData.d) * 9) : 0)));
      clouds.position.x = t * 0.15;
      // a soft lightning flicker behind the clouds at 0.5 s
      flash.intensity = 2.2 * Math.max(0, Math.sin(Math.PI * prog(t, 0.45, 0.62))) + 1.2 * Math.max(0, Math.sin(Math.PI * prog(t, 0.68, 0.78)));
      return { scene, camera: cam, bloom: 0.25, exposure: 1.0, vignette: 0.3 };
    },
  };
}
