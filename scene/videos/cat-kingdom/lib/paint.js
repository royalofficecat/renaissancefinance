// "Painted vinyl": one base colour plus up to three painted regions, read from a per-vertex mask
// attribute `pat` (x, y, z). Masks are thresholded per pixel, so paint edges stay crisp at any size.
import * as THREE from 'three';

const cache = new Map();

/**
 * @param {object} cols { base, x, y, z } THREE.Color for the base and each painted region
 * @param {object} o { roughness, kx, ky, kz (paint strength), rim (velvet rim amount), key (cache key) }
 */
export function paintedMaterial(cols, { roughness = 0.62, kx = 1, ky = 1, kz = 1, rim = 0.1, key = null } = {}) {
  if (key && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness: 0 });
  const U = {
    uBase: { value: cols.base }, uX: { value: cols.x || cols.base }, uY: { value: cols.y || cols.base }, uZ: { value: cols.z || cols.base },
    uK: { value: new THREE.Vector3(kx, ky, kz) }, uRim: { value: rim },
  };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 pat; varying vec3 vPat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat = pat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPat; uniform vec3 uBase, uX, uY, uZ, uK; uniform float uRim;
        float paint(float v) { float w = fwidth(v) * 0.8 + 0.02; return smoothstep(0.5 - w, 0.5 + w, v); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 c = mix(uBase, uY, paint(vPat.y) * uK.y);
        c = mix(c, uX, paint(vPat.x) * uK.x);
        c = mix(c, uZ, paint(vPat.z) * uK.z);
        diffuseColor.rgb = c;`)
      // a soft velvet rim: the vinyl looks soft to the touch
      .replace('#include <opaque_fragment>', `outgoingLight += diffuseColor.rgb * pow(1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0), 3.0) * uRim;
        #include <opaque_fragment>`);
  };
  if (key) cache.set(key, m);
  return m;
}
