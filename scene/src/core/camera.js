// Camera moves: smooth curved paths, eased in and out, lens in millimetres.
import * as THREE from 'three';
import { ease, fovForLens, lerp, prog } from './util.js';

const v = (a) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(...a));

/** Quadratic Bezier through an optional control point, for gently curved camera paths. */
function bez(a, c, b, t) {
  if (!c) return a.clone().lerp(b, t);
  const u = 1 - t;
  return a.clone().multiplyScalar(u * u).addScaledVector(c, 2 * u * t).addScaledVector(b, t * t);
}

/**
 * A move from shot A to shot B between frames f0 and f1 (holds before and after).
 * A shot is { pos, target, lens }. `via` bends the position path; `viaT` bends the look target.
 */
export function move(frame, f0, f1, A, B, { via = null, viaT = null, fn = ease.inOutCubic } = {}) {
  const t = fn(prog(frame, f0, f1));
  return {
    pos: bez(v(A.pos), via && v(via), v(B.pos), t),
    target: bez(v(A.target), viaT && v(viaT), v(B.target), t),
    lens: lerp(A.lens, B.lens, t),
    t,
  };
}

/** Orbit around a centre: angle a0 -> a1 (radians), radius and height can change along the way. */
export function orbit(frame, f0, f1, { center, a0, a1, r0, r1 = r0, h0, h1 = h0, lens0, lens1 = lens0, target = center, fn = ease.inOutSine }) {
  const t = fn(prog(frame, f0, f1));
  const a = lerp(a0, a1, t), r = lerp(r0, r1, t), h = lerp(h0, h1, t);
  const c = v(center);
  return { pos: new THREE.Vector3(c.x + Math.sin(a) * r, c.y + h, c.z + Math.cos(a) * r), target: v(target), lens: lerp(lens0, lens1, t), t };
}

export function applyCam(cam, s) {
  cam.position.copy(s.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(s.target);
  const fov = fovForLens(s.lens);
  if (Math.abs(cam.fov - fov) > 1e-6) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  cam.updateMatrixWorld();
}
