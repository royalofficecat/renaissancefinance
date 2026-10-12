// A round tube swept along a smooth curve, rebuilt in place every frame (tails, palm fronds, cables).
import * as THREE from 'three';

/**
 * @param {number} seg  rings along the tube
 * @param {number} rad  vertices around each ring
 * @param {(u:number)=>number} radius  radius along the tube (u = 0..1)
 */
export function sweepTube(seg = 40, rad = 12, radius = () => 0.05) {
  const count = (seg + 1) * rad + 2;
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3), A = new Float32Array(count);
  const idx = [];
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = i * rad + ((j + 1) % rad), c = a + rad, d = b + rad;
    idx.push(a, c, b, b, c, d);
  }
  const c0 = (seg + 1) * rad, c1 = c0 + 1; // end caps
  for (let j = 0; j < rad; j++) {
    idx.push(c0, j, (j + 1) % rad);
    idx.push(c1, seg * rad + ((j + 1) % rad), seg * rad + j);
  }
  for (let i = 0; i <= seg; i++) for (let j = 0; j < rad; j++) A[i * rad + j] = i / seg;
  A[c1] = 1;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('along', new THREE.BufferAttribute(A, 1));
  geo.setIndex(idx);

  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], false, 'centripetal');
  const pt = new THREE.Vector3(), tan = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3(), tmp = new THREE.Vector3();
  const pts = [], tans = [];
  for (let i = 0; i <= seg; i++) { pts.push(new THREE.Vector3()); tans.push(new THREE.Vector3()); }

  /** Rebuild the tube along control points (array of Vector3). */
  function update(ctrl) {
    curve.points = ctrl;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      curve.getPointAt(u, pts[i]);
      curve.getTangentAt(u, tans[i]).normalize();
    }
    // Parallel-transport frames: no sudden twists along the tube
    tan.copy(tans[0]);
    nrm.set(0, 1, 0);
    if (Math.abs(nrm.dot(tan)) > 0.9) nrm.set(1, 0, 0);
    nrm.addScaledVector(tan, -nrm.dot(tan)).normalize();
    for (let i = 0; i <= seg; i++) {
      if (i > 0) {
        tmp.crossVectors(tans[i - 1], tans[i]);
        const s = tmp.length();
        if (s > 1e-6) nrm.applyAxisAngle(tmp.normalize(), Math.asin(Math.min(1, s)));
        nrm.addScaledVector(tans[i], -nrm.dot(tans[i])).normalize();
      }
      bin.crossVectors(tans[i], nrm);
      const r = radius(i / seg);
      for (let j = 0; j < rad; j++) {
        const a = (j / rad) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const o = (i * rad + j) * 3;
        const nx = nrm.x * ca + bin.x * sa, ny = nrm.y * ca + bin.y * sa, nz = nrm.z * ca + bin.z * sa;
        P[o] = pts[i].x + nx * r; P[o + 1] = pts[i].y + ny * r; P[o + 2] = pts[i].z + nz * r;
        N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
      }
    }
    P.set([pts[0].x, pts[0].y, pts[0].z], c0 * 3); N.set([-tans[0].x, -tans[0].y, -tans[0].z], c0 * 3);
    P.set([pts[seg].x, pts[seg].y, pts[seg].z], c1 * 3); N.set([tans[seg].x, tans[seg].y, tans[seg].z], c1 * 3);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  }
  return { geo, update };
}

/** Radius profile with a rounded tip: r0 at the base easing to r1, closing over the last `cap` of the length. */
export const taper = (r0, r1, cap = 0.08) => (u) => {
  const r = r0 + (r1 - r0) * u;
  return u > 1 - cap ? r * Math.sqrt(Math.max(0, 1 - ((u - (1 - cap)) / cap) ** 2)) : r;
};
