// Palette, materials and light for the Utah video (see docs/utah-rain/style-bible.md).
// Four painted scene colours (storm charcoal, sandstone red with its pale desert-cream end, turquoise water,
// fresh green); storm daylight and the clearing sun are light colours, never paint.
import * as THREE from 'three';
import palette from './palette.json';
import { rig as baseRig } from '../../src/core/look.js';

const col = (h) => new THREE.Color(h);
export const HEX = {
  storm: palette.scene.background.hex, red: palette.scene.subject.hex, water: palette.scene.accent.hex, green: palette.scene.highlight.hex,
  cream: palette.extra.cream.hex, stormLight: palette.light.storm.hex, sun: palette.light.clearing.hex,
  text: palette.text.text.hex, text2: palette.text.secondary.hex, panel: palette.text.panelFill.hex, edge: palette.text.panelEdge.hex,
};
export const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, col(v)]));

export const tone = (c, k, lift = 0) => c.clone().multiplyScalar(k).lerp(new THREE.Color(1, 1, 1), lift);
export const mixc = (a, b, t) => a.clone().lerp(b, t);

// Named shades, so every set paints from the same few pots
export const S = {
  red: C.red, redDark: tone(C.red, 0.68), redDeep: tone(C.red, 0.48), redLight: mixc(C.red, C.cream, 0.35), cream: C.cream, creamDark: tone(C.cream, 0.82),
  storm: C.storm, stormLight: tone(C.storm, 1.6), stormDark: tone(C.storm, 0.6), cloud: tone(C.storm, 1.9),
  water: C.water, waterDeep: tone(C.water, 0.62), waterLight: tone(C.water, 1, 0.35),
  green: C.green, greenDark: tone(C.green, 0.66), greenLight: tone(C.green, 1, 0.25),
};

export function clay(color, roughness = 0.75, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

// Analytic sky reflection for water: a storm-grey sky gradient with a soft bright patch where the light is.
export const SKY_REFL = /* glsl */ `
  uniform vec3 uSkyHi, uSkyLo, uSunDir; uniform float uGlint;
  vec3 skyReflect(vec3 nView, vec3 vView, float amount) {
    vec3 rW = inverseTransformDirection(reflect(-vView, nView), viewMatrix);
    float y = clamp(rW.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sky = mix(uSkyLo, uSkyHi, smoothstep(0.35, 1.0, y));
    float glint = pow(max(dot(rW, uSunDir), 0.0), 120.0);
    float fres = 0.05 + 0.95 * pow(1.0 - clamp(dot(nView, vView), 0.0, 1.0), 5.0);
    return (sky * fres + vec3(1.3, 1.25, 1.15) * glint * uGlint) * amount;
  }`;
export const SKY_U = {
  uSkyHi: { value: tone(C.storm, 2.4) }, uSkyLo: { value: tone(C.storm, 1.2) },
  uSunDir: { value: new THREE.Vector3(-0.55, 0.62, 0.5).normalize() }, uGlint: { value: 0.25 },
};

/** Water: the one glossy material (roughness 0.08-0.20) with the analytic sky reflection. */
export function water(color = C.water, { roughness = 0.12, reflect = 1, ...extra } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  m.userData.reflect = { value: reflect };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SKY_U, { uReflect: m.userData.reflect });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReflect;\n' + SKY_REFL)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, uReflect);\n#include <opaque_fragment>');
  };
  return m;
}

const STORM_KEY = col(palette.light.storm.hex), SUN_KEY = col(palette.light.clearing.hex);

/**
 * Light rig: overcast storm key (upper left, about 40 degrees high), cool sky fill with a warm sandstone bounce,
 * cool rim. warmth(0..1) turns it into the clearing sun of day 30 (the one lighting change).
 */
export function rig(scene, renderer, o = {}) {
  const r = baseRig(scene, renderer, {
    keyColor: STORM_KEY, fillSky: '#9AA8B8', fillGround: '#8A5A48', fillK: 0.35, rimColor: '#D8E2EC', rimK: 0.6,
    keyDir: [-0.55, 0.64, 0.54], ...o,
  });
  SKY_U.uSunDir.value.copy(r.keyDir);
  const base = r.key.intensity;
  r.warmth = (w) => {
    r.key.color.copy(STORM_KEY).lerp(SUN_KEY, w);
    r.key.intensity = base * (1 + 0.35 * w);
    r.fill.color.set('#9AA8B8').lerp(col('#C8B8A4'), w * 0.6);
    SKY_U.uGlint.value = 0.25 + 0.9 * w;
  };
  return r;
}

/** Storm sky backdrop: charcoal at the top, a lighter grey horizon; `clear` (0..1) opens a warm gap. */
export function backdrop(scene, { radius = 600 } = {}) {
  const U = { uTop: { value: tone(C.storm, 0.75) }, uHor: { value: tone(C.storm, 1.55) }, uWarm: { value: tone(C.sun, 1.0) }, uClear: { value: 0 }, uSun: { value: SKY_U.uSunDir.value } };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: U,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHor, uWarm, uSun; uniform float uClear; varying vec3 vDir;
      void main(){
        float y = clamp(vDir.y, -1.0, 1.0);
        vec3 c = mix(uHor, uTop, smoothstep(-0.05, 0.7, y));
        float s = pow(max(dot(normalize(vDir), uSun), 0.0), 4.0);
        c = mix(c, uWarm, s * uClear * 0.8);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  scene.add(m);
  return { mesh: m, U };
}
