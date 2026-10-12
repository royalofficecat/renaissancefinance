// Palette, materials and light for the cat video (see docs/cat-kingdom/style-bible.md).
// Four painted scene colours (coastal blue, warm cream, terracotta, leafy green) and their shades;
// gold is only ever light.
import * as THREE from 'three';
import palette from './palette.json';
import { rig as baseRig } from '../../src/core/look.js';

const col = (h) => new THREE.Color(h);
export const HEX = {
  blue: palette.scene.background.hex, cream: palette.scene.subject.hex, terra: palette.scene.accent.hex, green: palette.scene.highlight.hex,
  gold: palette.light.key.hex, lamp: palette.light.evening.hex,
  text: palette.text.text.hex, text2: palette.text.secondary.hex, panel: palette.text.panelFill.hex, edge: palette.text.panelEdge.hex,
};
export const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, col(v)]));

/** Shade of a palette colour: k < 1 darker, k > 1 lighter (towards white by `lift`). */
export const tone = (c, k, lift = 0) => c.clone().multiplyScalar(k).lerp(new THREE.Color(1, 1, 1), lift);
export const mixc = (a, b, t) => a.clone().lerp(b, t);

// Named shades used across sets, so every set paints from the same few pots
export const S = {
  cream: C.cream, creamLight: tone(C.cream, 1, 0.45), creamDark: tone(C.cream, 0.82), tan: tone(C.cream, 0.62), wood: mixc(tone(C.cream, 0.64), C.terra, 0.3),
  woodDark: mixc(tone(C.cream, 0.32), C.terra, 0.22), hair: mixc(tone(C.cream, 0.24), C.terra, 0.2),
  terra: C.terra, terraLight: tone(C.terra, 1, 0.35), terraDark: tone(C.terra, 0.7), rosy: mixc(C.terra, C.cream, 0.45),
  blue: C.blue, blueLight: tone(C.blue, 1, 0.5), blueDark: tone(C.blue, 0.62), blueDeep: tone(C.blue, 0.42),
  green: C.green, greenDark: tone(C.green, 0.68), greenLight: tone(C.green, 1, 0.3),
};

// Matte clay for everything solid (roughness 0.60-0.85, no metal, no outlines)
export function clay(color, roughness = 0.72, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

// Analytic sky reflection for the few glossy things (glass, water, eyes, the can): a coastal-blue sky
// gradient plus a gold sun glint. Evaluated in the shader: no environment map (too slow in software).
export const SKY_REFL = /* glsl */ `
  uniform vec3 uSkyHi, uSkyLo, uSunDir;
  vec3 skyReflect(vec3 nView, vec3 vView, float amount) {
    vec3 rW = inverseTransformDirection(reflect(-vView, nView), viewMatrix);
    float y = clamp(rW.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sky = mix(uSkyLo, uSkyHi, smoothstep(0.35, 1.0, y));
    float glint = pow(max(dot(rW, uSunDir), 0.0), 180.0);
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(nView, vView), 0.0, 1.0), 5.0);
    return (sky * fres + vec3(1.5, 1.32, 1.0) * glint * 0.5) * amount;
  }`;
export const SKY_U = {
  uSkyHi: { value: tone(C.blue, 1.0, 0.25) }, uSkyLo: { value: tone(C.cream, 0.9) },
  uSunDir: { value: new THREE.Vector3(-0.55, 0.6, 0.45).normalize() },
};

/** Glossy material (glass, water, eyes, the can): roughness 0.10-0.25 plus the analytic sky reflection. */
export function glossy(color, { roughness = 0.16, reflect = 1, transparent = false, opacity = 1, ...extra } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, transparent, opacity, ...extra });
  m.userData.reflect = { value: reflect };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SKY_U, { uReflect: m.userData.reflect });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReflect;\n' + SKY_REFL)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, uReflect);\n#include <opaque_fragment>');
  };
  return m;
}

/**
 * Light rig: gold late-afternoon key (upper left, about 35 degrees high), coastal-blue sky fill with a
 * warm cream bounce, warm rim. Same rig in every scene; only the shadow box and direction change.
 */
export function rig(scene, renderer, o = {}) {
  const r = baseRig(scene, renderer, {
    keyColor: C.gold, fillSky: '#9FC4DE', fillGround: '#E6D3B0', fillK: 0.42, rimColor: '#FFE3BC', rimK: 0.5,
    keyDir: [-0.62, 0.57, 0.54], ...o,
  });
  SKY_U.uSunDir.value.copy(r.keyDir);
  return r;
}

/** Sky backdrop: a soft vertical gradient in coastal blue (lighter and warmer towards the horizon). */
export function backdrop(scene, { top = tone(C.blue, 0.86), horizon = tone(C.blue, 1.0, 0.42), glow = tone(C.gold, 1.0, 0.25), glowAmt = 0.25, radius = 400 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uTop: { value: top }, uHor: { value: horizon }, uGlow: { value: glow }, uGlowAmt: { value: glowAmt }, uSun: { value: SKY_U.uSunDir.value } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHor, uGlow, uSun; uniform float uGlowAmt; varying vec3 vDir;
      void main(){
        float y = clamp(vDir.y, -1.0, 1.0);
        vec3 c = mix(uHor, uTop, smoothstep(-0.05, 0.75, y));
        float s = pow(max(dot(normalize(vDir), uSun), 0.0), 3.0);
        c = mix(c, uGlow, s * uGlowAmt);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mat.toneMapped = true;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
