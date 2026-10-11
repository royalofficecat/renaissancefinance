// Globe (beats 1-2): where the water comes from. Natural Earth land, orthographic-style view.
import * as THREE from 'three';
import { C, rig } from '../core/look.js';
import { applyCam, move, orbit } from '../core/camera.js';
import { clamp, ease, lerp, prog, smoothstep } from '../core/util.js';
import { dataTexture, loadPixels } from '../core/data.js';
import { Labels } from '../core/labels.js';

const R = 10;
/** lon/lat (deg) -> point on a sphere of radius r (three.js: +Y north, lon 0 at +Z... rotated so lon -120 faces +Z) */
export function onSphere(lon, lat, r = R) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).multiplyScalar(r);
}

export async function createGlobe(pipe) {
  const land = await loadPixels('globe_land.png');
  const landTex = dataTexture(land);
  const scene = new THREE.Scene();
  scene.background = C.bg.clone();

  const U = { uLand: { value: landTex }, uSubject: { value: C.subject.clone() }, uWater: { value: C.water.clone() }, uBg: { value: C.bg.clone() }, uFocus: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = normalize(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; uniform sampler2D uLand; uniform vec3 uSubject, uWater, uBg; uniform float uFocus; float gSea = 0.0;`)
      .replace('#include <color_fragment>', `
        float lon = atan(vObj.x, vObj.z); float lat = asin(clamp(vObj.y, -1.0, 1.0));
        vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
        vec3 t = texture2D(uLand, uv).rgb;
        float landM = smoothstep(0.3, 0.7, t.r);
        vec3 sea = mix(uBg * 1.9, uWater * 0.55, 0.35);
        vec3 col = mix(sea, uSubject * 0.78, landM);
        col = mix(col, uSubject * 1.18, t.g * uFocus);
        gSea = 1.0 - landM;
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62, gSea);`);
  };
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), mat);
  globe.receiveShadow = true;
  scene.add(globe);

  // Atmosphere rim glow (soft blue haze around the limb)
  const atm = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.035, 96, 64),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCol: { value: C.water.clone().multiplyScalar(0.9) } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(clamp(1.0 + dot(vN, vV) * 1.0, 0.0, 1.0), 3.0); gl_FragColor = vec4(uCol * f * 0.9, f); }`,
    }),
  );
  scene.add(atm);

  // Storm clouds: a soft procedural shell, thicker over the North Pacific
  const NOISE = `
    float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h31(i+vec3(0,0,0)), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }`;
  const cloudMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#B4BCC4'), roughness: 1, transparent: true, depthWrite: false });
  const CU = { uTime: { value: 0 } };
  cloudMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = normalize(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj; uniform float uTime;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 q = vObj * 4.6 + vec3(uTime * 0.03, 0.0, uTime * 0.02);
        float d = fbm3(q + fbm3(q * 1.7) * 0.8);
        float lat = vObj.y;
        float band = smoothstep(0.15, 0.45, lat) * (1.0 - smoothstep(0.75, 0.95, lat));
        float a = smoothstep(0.58 - band * 0.08, 0.76, d) * (0.45 + 0.3 * band);
        diffuseColor.a *= a;`);
  };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 128, 96), cloudMat);
  scene.add(clouds);

  // The atmospheric river: a glowing moisture plume from near Hawaii to Northern California
  const pathLL = [[-166, 15], [-155, 21], [-145, 27.5], [-136, 33], [-128.5, 37.2], [-123.2, 38.9]];
  const curve = new THREE.CatmullRomCurve3(pathLL.map(([lo, la]) => onSphere(lo, la, R * 1.03)), false, 'centripetal');
  const tube = new THREE.TubeGeometry(curve, 240, 0.62, 24, false);
  const plumeU = { uReveal: { value: 0 }, uTime: { value: 0 }, uCol: { value: C.water.clone().multiplyScalar(1.6) }, uCore: { value: new THREE.Color('#BFD8EE') } };
  const plume = new THREE.Mesh(
    tube,
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: plumeU,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uReveal, uTime; uniform vec3 uCol, uCore; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        ${NOISE}
        void main(){
          float x = vUv.x;
          if (x > uReveal) discard;
          float head = smoothstep(uReveal, uReveal - 0.08, x);
          float taper = smoothstep(0.0, 0.18, x) * (0.65 + 0.35 * smoothstep(1.0, 0.7, x));
          float facing = pow(clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 1.4);
          float n = fbm3(vec3(x * 26.0 - uTime * 2.2, vUv.y * 6.0, uTime * 0.3));
          float a = pow(facing, 0.7) * taper * head * smoothstep(0.15, 0.7, n + 0.3);
          vec3 col = mix(uCol, uCore, facing * n);
          gl_FragColor = vec4(col * (0.9 + 0.8 * n) * a * 1.4, a);
        }`,
    }),
  );
  plume.renderOrder = 3;
  scene.add(plume);

  const lights = rig(scene, pipe.renderer, { size: 14, dist: 60, intensity: 2.5, keyDir: [-0.85, 0.6, -0.35], rimDir: [0.7, 0.35, 0.6] });

  const labels = new Labels();
  labels.add('pacific', { text: 'Pacific Ocean', pos: onSphere(-150, 30, R * 1.02), italic: true, size: 32, priority: 3 });
  labels.add('california', { text: 'California', pos: onSphere(-119.5, 37.0, R * 1.02), size: 32, priority: 4, dot: false });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.05, 500);
  const caPt = onSphere(-120.5, 37.5, R);
  const want = {};

  function frame(f, ctx) {
    const time = f / 30;
    CU.uTime.value = time;
    plumeU.uTime.value = time;
    plumeU.uReveal.value = ease.inOutSine(prog(f, 4, 56));
    U.uFocus.value = smoothstep(40, 80, f);
    let s;
    if (f < 180) {
      // Beat 1: establishing wide, slow orbit east across the North Pacific
      s = orbit(f, 0, 180, { center: [0, 0, 0], a0: -2.5, a1: -2.25, r0: 33, r1: 30, h0: 17, h1: 16, lens0: 35, target: onSphere(-138, 30, 3.5) });
    } else {
      // Beat 2: hold for the caption, then dive toward California (match-cut into the clouds)
      const A = orbit(180, 0, 180, { center: [0, 0, 0], a0: -2.5, a1: -2.25, r0: 33, r1: 30, h0: 17, h1: 16, lens0: 35, target: onSphere(-138, 30, 3.5) });
      const B = { pos: caPt.clone().multiplyScalar(1.22), target: caPt.clone(), lens: 50 };
      s = move(f, 195, 234, A, B, { fn: ease.inCubic, via: onSphere(-132, 37, 30) });
    }
    applyCam(cam, s);
    lights.follow(new THREE.Vector3(), 14);
    for (const k in want) delete want[k];
    want.pacific = smoothstep(20, 34, f) * (1 - smoothstep(196, 206, f));
    want.california = smoothstep(52, 66, f) * (1 - smoothstep(205, 214, f));
    labels.update(cam, want, ctx.avoid);
    return { scene, camera: cam, labels: labels.scene, bloom: 0.3 };
  }
  return { scene, frame };
}
