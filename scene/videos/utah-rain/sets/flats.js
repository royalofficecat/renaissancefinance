// Beat 10: the Bonneville Salt Flats under a thin sheet of water. A low camera skims the white crust;
// the shallow water turns it into a mirror of the storm sky, with the Silver Island Mountains on the
// horizon. Salt-polygon ridges poke through near the camera; drizzle rings dot the mirror.
// The reflection is a mirrored copy of the mountains and a sky that is symmetric about the horizon.
import * as THREE from 'three';
import { C, HEX, S, clay, mixc, rig, tone } from '../look.js';
import { applyCam, move } from '../../../src/core/camera.js';
import { ease, prog, rng, smoothstep } from '../../../src/core/util.js';
import { Labels } from '../../../src/core/labels.js';
import { rainField, splashRings } from '../lib/rock.js';

const FPS = 30;
const B0 = 1140;
const NOISE = /* glsl */ `
  float sh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sn2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(sh1(i), sh1(i+vec2(1,0)), u.x), mix(sh1(i+vec2(0,1)), sh1(i+vec2(1,1)), u.x), u.y); }
  float sfb(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * sn2(p); p = p * 2.03 + 3.7; a *= 0.5; } return s; }`;

export async function createFlats(pipe) {
  const scene = new THREE.Scene();
  const R = rng(33);

  // ---------- storm sky, symmetric about the horizon so the mirror below shows the same clouds
  const SU = { uTop: { value: tone(C.storm, 0.8) }, uHor: { value: tone(C.storm, 1.9) }, uCloudD: { value: tone(C.storm, 0.7) }, uCloudL: { value: tone(C.storm, 2.3) }, uT: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: SU,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHor, uCloudD, uCloudL; uniform float uT; varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir); float y = abs(d.y);
        vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.5, y));
        // cloud deck: project onto a plane above the flats
        vec2 q = d.xz / max(y, 0.04) * 0.9 + vec2(uT * 0.02, 0.0);
        float n = sfb(q * 0.6);
        float cl = smoothstep(0.38, 0.7, n) * smoothstep(0.02, 0.12, y);
        vec3 cc = mix(uCloudL, uCloudD, smoothstep(0.45, 0.8, sfb(q * 1.3 + 4.0)));
        c = mix(c, cc, cl * 0.85);
        // a pale band of light low on the horizon
        c += vec3(0.1, 0.1, 0.11) * exp(-y * 18.0);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---------- the Silver Island Mountains: a jagged ridge on the horizon, and its reflection
  const ridgeGeo = new THREE.PlaneGeometry(220, 12, 440, 24);
  const RP = ridgeGeo.attributes.position;
  for (let i = 0; i < RP.count; i++) {
    const x = RP.getX(i), v = RP.getY(i) / 12 + 0.5;
    const prof = Math.max(0, 3.2 + 2.4 * Math.sin(x * 0.07 + 1) + 1.4 * Math.sin(x * 0.19) + 0.8 * Math.sin(x * 0.53 + 2) + 0.35 * Math.sin(x * 1.3)) * smoothstep(-95, -40, x) * (1 - smoothstep(30, 100, x));
    RP.setXYZ(i, x, prof * v, -0.4 * (1 - v) * prof);
  }
  ridgeGeo.computeVertexNormals();
  const ridgeMat = clay(mixc(tone(C.storm, 1.5), S.redDark, 0.32), 0.9, { fog: true });
  const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
  ridge.position.set(10, 0, -85);
  scene.add(ridge);
  const ridgeM = ridge.clone();
  ridgeM.scale.y = -1;
  scene.add(ridgeM);
  scene.fog = new THREE.Fog(tone(C.storm, 1.9), 40, 160);

  // ---------- salt crust under a thin sheet of water: mostly mirror, salt-polygon ridges near the camera
  const GU = { uSalt: { value: tone(C.cream, 1.06) }, uWater: { value: C.water }, uT: { value: 0 }, uSheet: { value: 0 } };
  const gmat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, depthWrite: true });
  gmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, GU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGP; uniform vec3 uSalt, uWater; uniform float uT, uSheet;
        ${NOISE}
        // distance to the nearest edge of a jittered polygon cell (the salt's natural polygons)
        float cellEdge(vec2 p){
          vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y)); vec2 o = vec2(sh1(i + g), sh1(i + g + 17.3));
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          return d2 - d1;
        }
        float gDry = 0.0;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p = vGP.xz;
        float edge = (1.0 - smoothstep(0.015, 0.06, cellEdge(p * 0.7))) * (0.55 + 0.45 * sfb(p * 1.7));
        float far = smoothstep(4.0, 30.0, -vGP.z + 2.0);
        // ridges stand above the sheet near the camera; further out the sheet covers everything
        float dry = edge * (1.0 - far) * mix(1.0, 0.55, uSheet);
        dry = max(dry, (1.0 - uSheet) * (0.6 + 0.4 * sfb(p * 0.3)));
        vec3 salt = uSalt * (0.9 + 0.1 * sfb(p * 2.0));
        vec3 sheet = mix(uSalt * 0.6, uWater * 0.8, 0.4);
        diffuseColor.rgb = mix(sheet, salt, dry);
        // the sheet is see-through: the mirrored world shows through it, more so at a grazing angle
        float graze = smoothstep(0.0, 1.0, far);
        diffuseColor.a = mix(mix(0.16, 0.05, graze), 1.0, dry);
        gDry = dry;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.08, roughnessFactor, gDry);');
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 300, 1, 1).rotateX(-Math.PI / 2), gmat);
  ground.position.z = -120;
  ground.renderOrder = 5;
  scene.add(ground);

  const rings = splashRings(scene, R, 70, () => [(R() - 0.5) * 7, 0.004, 3 - R() * 12], { color: tone(C.cream, 1, 0.6), r0: 0.03, r1: 0.045 });
  const rain = rainField(scene, R, { n: 900, w: 10, h: 5, d: 16, len: 0.28, opacity: 0.18 });

  const lights = rig(scene, pipe.renderer, { size: 20, dist: 60, intensity: 2.3, keyDir: [-0.5, 0.55, -0.6], rimDir: [0.4, 0.4, 0.8] });
  lights.follow(new THREE.Vector3(0, 0, -10), 20);

  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  labels.add('silver', { text: 'Silver Island Mountains', pos: new THREE.Vector3(-14, 7.5, -85), italic: true, size: 28, priority: 2 });
  await labels.sync();

  const cam = new THREE.PerspectiveCamera(24, 1080 / 1920, 0.05, 900);
  // Low wide shot, slow lateral track across the mirror (24 mm)
  const A = { pos: [-1.5, 0.55, 6], target: [-3.5, 2.6, -40], lens: 24 };
  const B = { pos: [1.8, 0.5, 5.2], target: [-0.5, 2.6, -40], lens: 24 };

  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = f / FPS, bt = (f - B0) / FPS;
      applyCam(cam, move(f, B0 - 10, B0 + 112, A, B, { fn: ease.inOutSine }));
      SU.uT.value = t;
      GU.uT.value = t;
      GU.uSheet.value = 0.75 + 0.25 * ease.inOutSine(prog(bt, 0, 2));
      rings(t, 1);
      rain.update(t, 1, { x: cam.position.x, z: cam.position.z - 8 }, 0);
      labels.update(cam, { silver: 0.9 * smoothstep(B0 + 30, B0 + 42, f) * (1 - smoothstep(B0 + 106, B0 + 118, f)) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.25, exposure: 1.0, vignette: 0.28 };
    },
  };
}
