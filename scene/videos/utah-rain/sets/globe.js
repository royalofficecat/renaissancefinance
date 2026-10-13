// Beat 2 (where): the American West on the globe, Utah outlined, storm clouds gathering over it;
// then a dive towards the state that dissolves into the flat map (the camera keeps moving through the change).
// Land from Natural Earth (globe_land.png); Utah's outline is its real border (37-42 N, 109.05-114.05 W,
// with the north-east notch above 41 N, east of 111.05 W).
import * as THREE from 'three';
import { C, S, backdrop, rig, tone } from '../look.js';
import { applyCam, move, orbit } from '../../../src/core/camera.js';
import { ease, smoothstep } from '../../../src/core/util.js';
import { dataTexture, loadPixels } from '../../../src/core/data.js';
import { Labels } from '../../../src/core/labels.js';
import { HEX } from '../look.js';

const R = 10;
export function onSphere(lon, lat, r = R) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).multiplyScalar(r);
}

const NOISE = /* glsl */ `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i+vec3(0,0,0)), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
  vec2 lonlat(vec3 o){ return vec2(degrees(atan(o.x, o.z)), degrees(asin(clamp(o.y, -1.0, 1.0)))); }
  // signed distance (degrees, negative inside) to Utah's border
  float utahD(vec2 ll){
    vec2 c = vec2(-111.55, 39.5), h = vec2(2.5, 2.5);
    vec2 d = abs(ll - c) - h;
    float box = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    vec2 nc = vec2(-110.05, 41.5), nh = vec2(1.0, 0.5);           // the north-east notch (Wyoming)
    vec2 nd = abs(ll - nc) - nh;
    float notch = length(max(nd, 0.0)) + min(max(nd.x, nd.y), 0.0);
    return max(box, -notch);
  }`;

export async function createGlobe(pipe) {
  const land = await loadPixels('globe_land.png');
  const scene = new THREE.Scene();
  backdrop(scene);

  const U = { uLand: { value: dataTexture(land) }, uRed: { value: S.red }, uCream: { value: S.cream }, uSea: { value: tone(C.storm, 1.25) }, uWater: { value: C.water }, uLine: { value: new THREE.Color('#D8D2C6') }, uFocus: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = normalize(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; uniform sampler2D uLand; uniform vec3 uRed, uCream, uSea, uWater, uLine; uniform float uFocus; float gSea = 0.0;
        ${NOISE}`)
      .replace('#include <color_fragment>', `
        vec2 ll = lonlat(vObj);
        vec2 uv = vec2(ll.x / 360.0 + 0.5, ll.y / 180.0 + 0.5);
        float landM = smoothstep(0.3, 0.7, texture2D(uLand, uv).r);
        vec3 sea = mix(uSea, uWater * 0.45, 0.12);
        vec3 ground = mix(uCream * 0.62, uCream * 0.5, smoothstep(0.3, 0.7, fbm3(vObj * 14.0)));
        vec3 col = mix(sea, ground, landM);
        float d = utahD(ll);
        float inside = 1.0 - smoothstep(-0.03, 0.03, d);
        col = mix(col, uRed * 1.05, inside * uFocus);
        float line = 1.0 - smoothstep(0.03, 0.09, abs(d));
        col = mix(col, uLine, line * uFocus);
        gSea = 1.0 - landM;
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, gSea);');
  };
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), mat);
  scene.add(globe);

  // thin atmosphere rim
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: tone(C.stormLight, 0.35) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 + dot(vN, vV), 0.0, 1.0), 3.0); gl_FragColor = vec4(uCol * f, f); }`,
    }),
  ));

  // storm clouds: a light procedural shell everywhere, a dark storm gathering over Utah
  const CU = { uTime: { value: 0 }, uStorm: { value: 0 }, uDark: { value: tone(C.storm, 0.75) }, uLight: { value: tone(C.storm, 3.0) } };
  const cloudMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false });
  cloudMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = normalize(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj; uniform float uTime, uStorm; uniform vec3 uDark, uLight;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 q = vObj * 5.0 + vec3(uTime * 0.04, 0.0, uTime * 0.025);
        float n = fbm3(q + fbm3(q * 1.7) * 0.8);
        vec2 ll = lonlat(vObj);
        float near = exp(-pow(length((ll - vec2(-111.4, 39.6)) / vec2(12.0, 9.0)), 2.0));
        // the storm spirals in over the state, leaving the border readable through a gap
        float dc = length(ll - vec2(-111.4, 39.6));
        float swirl = n + 0.22 * sin(atan(ll.y - 39.6, ll.x + 111.4) * 2.0 + dc * 0.45 - uTime * 0.8);
        float storm = uStorm * near * smoothstep(0.3, 0.5, swirl) * (0.5 + 0.5 * smoothstep(1.5, 4.0, dc));
        float wisp = smoothstep(0.52, 0.7, n) * 0.35;
        float a = max(wisp, storm * 0.85);
        diffuseColor.rgb = mix(uLight, uDark, smoothstep(0.15, 0.6, storm));
        diffuseColor.a *= clamp(a, 0.0, 0.85);`);
  };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.014, 128, 96), cloudMat));

  const lights = rig(scene, pipe.renderer, { size: 14, dist: 60, intensity: 2.5, keyDir: [-0.7, 0.6, 0.4], rimDir: [0.7, 0.35, -0.6] });
  lights.follow(new THREE.Vector3(), 14);

  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  labels.add('utah', { text: 'Utah', pos: onSphere(-111.6, 39.5, R * 1.03), size: 34, priority: 4 });
  labels.add('pacific', { text: 'Pacific Ocean', pos: onSphere(-128, 33, R * 1.02), italic: true, size: 30, priority: 2 });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(35, 1080 / 1920, 0.05, 900);
  const ut = onSphere(-111.6, 39.4, R);
  // Wide over North America, a slow orbit east, then a dive straight down onto Utah
  const ORB = { center: [0, 0, 0], a0: -2.15, a1: -1.98, r0: 29, r1: 27, h0: 16, h1: 15.5, lens0: 35, target: onSphere(-112, 36, 4) };
  const DIVE = { pos: ut.clone().multiplyScalar(1.16), target: ut.clone(), lens: 35 };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = f / 30;
      CU.uTime.value = t;
      CU.uStorm.value = ease.inOutSine(smoothstep(186, 236, f));
      U.uFocus.value = smoothstep(190, 212, f);
      const s = f < 232 ? orbit(f, 180, 232, ORB) : move(f, 232, 272, orbit(232, 180, 232, ORB), DIVE, { fn: ease.inCubic });
      applyCam(cam, s);
      labels.update(cam, { utah: smoothstep(198, 210, f) * (1 - smoothstep(236, 246, f)), pacific: smoothstep(190, 204, f) * (1 - smoothstep(228, 238, f)) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.25, exposure: 1.0, vignette: 0.28 };
    },
  };
}
