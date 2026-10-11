// Palette, materials and the lighting rig shared by every set (see docs/style-bible.md).
import * as THREE from 'three';
import palette from '../../palette.json';

export const C = {
  bg: new THREE.Color(palette.scene.background.hex),
  water: new THREE.Color(palette.scene.water.hex),
  subject: new THREE.Color(palette.scene.subject.hex),
  accent: new THREE.Color(palette.scene.accent.hex),
  green: new THREE.Color(palette.scene.highlight.hex),
  text: new THREE.Color(palette.text.text.hex),
  text2: new THREE.Color(palette.text.secondary.hex),
  panel: new THREE.Color(palette.text.panelFill.hex),
  edge: new THREE.Color(palette.text.panelEdge.hex),
};
export const HEX = {
  bg: palette.scene.background.hex, water: palette.scene.water.hex, subject: palette.scene.subject.hex,
  accent: palette.scene.accent.hex, green: palette.scene.highlight.hex, text: palette.text.text.hex,
  text2: palette.text.secondary.hex, panel: palette.text.panelFill.hex, edge: palette.text.panelEdge.hex,
};

/** Shades of a palette colour (same hue, lighter/darker), e.g. tone(C.subject, 0.7). */
export const tone = (c, k) => c.clone().multiplyScalar(k);
export const mixc = (a, b, t) => a.clone().lerp(b, t);

// Matte clay: roughness 0.60-0.85, no metal, no outlines.
export function clay(color, roughness = 0.72, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}
// Cheap analytic sky reflection for water (a soft sky gradient + key-light glint), used instead of
// a sampled environment map: in software rendering an environment map costs seconds per frame.
export const SKY_REFL = /* glsl */ `
  vec3 skyReflect(vec3 nView, vec3 vView, float amount) {
    vec3 rW = inverseTransformDirection(reflect(-vView, nView), viewMatrix);
    float y = clamp(rW.y, 0.0, 1.0);
    vec3 sky = mix(vec3(0.40, 0.45, 0.52), vec3(0.07, 0.11, 0.19), pow(y, 0.55));
    float glint = pow(max(dot(rW, normalize(vec3(-0.55, 0.62, -0.2))), 0.0), 220.0);
    float fres = 0.05 + 0.95 * pow(1.0 - clamp(dot(nView, vView), 0.0, 1.0), 5.0);
    return (sky * fres + vec3(1.4, 1.38, 1.32) * glint * 0.18) * amount;
  }`;

// Water: the one glossy material (roughness 0.08-0.20).
export function water(color = C.water, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.14, metalness: 0, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SKY_REFL)
      .replace('#include <opaque_fragment>', 'outgoingLight += skyReflect(normal, geometryViewDir, 1.0);\n#include <opaque_fragment>');
  };
  return m;
}

// Overcast daylight (about 6,500 K) and the warmer recovery light (about 5,000 K).
const KEY_COOL = new THREE.Color('#E9EEF4');
const KEY_WARM = new THREE.Color('#FFE7C7');

let envCache = null;
/** Soft generated sky for reflections: deep blue zenith, storm-grey horizon, soft bright patch. */
export function environment(renderer) {
  if (envCache) return envCache;
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir; void main(){
      float y = vDir.y;
      vec3 zen = vec3(0.10, 0.16, 0.26), hor = vec3(0.55, 0.60, 0.66), gnd = vec3(0.16, 0.16, 0.16);
      vec3 c = y > 0.0 ? mix(hor, zen, pow(y, 0.6)) : mix(hor, gnd, pow(-y, 0.5));
      float sun = pow(max(dot(vDir, normalize(vec3(-0.5, 0.6, 0.45))), 0.0), 24.0);
      c += vec3(1.6, 1.6, 1.55) * sun;
      gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  envCache = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return envCache;
}

/**
 * One key, one fill, one rim. Same rig everywhere; only the shadow box and scale change.
 * @param {THREE.Scene} scene
 * @param {object} o  { size: shadow half-extent, dist: light distance, target: Vector3 }
 */
export function rig(scene, renderer, { size = 10, dist = 30, target = new THREE.Vector3(), intensity = 2.6, env = false, envIntensity = 0.45, keyDir = [-0.55, 0.64, 0.54], rimDir = [0.35, 0.45, -1] } = {}) {
  const key = new THREE.DirectionalLight(KEY_COOL, intensity);
  keyDir = new THREE.Vector3(...keyDir).normalize(); // default: upper left, about 40 degrees high
  rimDir = new THREE.Vector3(...rimDir).normalize();
  key.position.copy(target).addScaledVector(keyDir, dist);
  key.target.position.copy(target);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.1, far: dist * 2.5 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02 * size / 10;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const fill = new THREE.HemisphereLight('#A9BCD3', '#5C5650', intensity * 0.35);
  scene.add(fill);

  const rim = new THREE.DirectionalLight('#DDE6F0', intensity * 0.6);
  rim.position.copy(target).addScaledVector(rimDir, dist);
  rim.target.position.copy(target);
  scene.add(rim, rim.target);

  // The sampled environment map is optional (expensive in software); water uses SKY_REFL instead.
  if (env) {
    scene.environment = environment(renderer);
    scene.environmentIntensity = envIntensity;
  }

  return {
    key, fill, rim, keyDir, rimDir,
    /** Move the shadow box to follow what the camera looks at. */
    follow(t, sz = size) {
      key.position.copy(t).addScaledVector(keyDir, dist);
      key.target.position.copy(t);
      rim.position.copy(t).addScaledVector(rimDir, dist);
      rim.target.position.copy(t);
      Object.assign(key.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz });
      key.shadow.normalBias = (sz * 2 / 4096) * 1.5;
      key.shadow.bias = -0.0006;
      key.shadow.camera.updateProjectionMatrix();
    },
    /** 0 = overcast storm light, 1 = warm recovery light (the one story change). */
    warmth(w) {
      key.color.copy(KEY_COOL).lerp(KEY_WARM, w);
      key.intensity = intensity;
      fill.color.set('#A9BCD3').lerp(new THREE.Color('#C9C3B8'), w * 0.6);
    },
  };
}
