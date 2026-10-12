// Smooth "vinyl toy" shapes: describe a figure as blended primitives (a signed distance field),
// then turn it into a mesh once at load time (surface nets + projection onto the surface,
// normals from the field's gradient), so every figure is one seamless, softly rounded piece.
import * as THREE from 'three';

// ---------- primitives (all take a point x, y, z; return signed distance)
export function sphere(cx, cy, cz, r) {
  return (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r;
}

/** Ellipsoid (approximate distance, good near the surface). rot: optional [rx, ry, rz] Euler radians. */
export function ellipsoid(c, r, rot = null) {
  const m = rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert().elements : null;
  const [cx, cy, cz] = c, [a, b, d] = r;
  return (x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    if (m) {
      const qx = m[0] * px + m[4] * py + m[8] * pz, qy = m[1] * px + m[5] * py + m[9] * pz, qz = m[2] * px + m[6] * py + m[10] * pz;
      px = qx; py = qy; pz = qz;
    }
    const k0 = Math.hypot(px / a, py / b, pz / d);
    const k1 = Math.hypot(px / (a * a), py / (b * b), pz / (d * d));
    return k1 < 1e-9 ? -Math.min(a, b, d) : (k0 * (k0 - 1)) / k1;
  };
}

/** Round cone (a tapered capsule) from point a (radius r1) to point b (radius r2). After Inigo Quilez. */
export function roundCone(a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}
export const capsule = (a, b, r) => roundCone(a, b, r, r);

/** Rounded box centred at c with half sizes h and corner radius r. */
export function roundBox(c, h, r, rot = null) {
  const m = rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).invert().elements : null;
  return (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    if (m) {
      const qx = m[0] * px + m[4] * py + m[8] * pz, qy = m[1] * px + m[5] * py + m[9] * pz, qz = m[2] * px + m[6] * py + m[10] * pz;
      px = qx; py = qy; pz = qz;
    }
    const qx = Math.abs(px) - h[0] + r, qy = Math.abs(py) - h[1] + r, qz = Math.abs(pz) - h[2] + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}

/** Torus in the xz plane (around the y axis), centred at c. Optional angular cut: keep |angle| < span. */
export function torus(c, R, r) {
  return (x, y, z) => {
    const px = x - c[0], py = y - c[1], pz = z - c[2];
    return Math.hypot(Math.hypot(px, pz) - R, py) - r;
  };
}

/** A smooth tube through a list of [x,y,z,radius] points (chain of round cones). */
export function tube(pts) {
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) parts.push(roundCone(pts[i].slice(0, 3), pts[i + 1].slice(0, 3), pts[i][3], pts[i + 1][3]));
  return (x, y, z) => {
    let d = 1e9;
    for (const f of parts) d = Math.min(d, f(x, y, z));
    return d;
  };
}

// ---------- blending
export const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

/** Smooth union of many shapes: [[fn, k], ...]; k is the blend radius with everything before it. */
export function union(list) {
  return (x, y, z) => {
    let d = list[0][0](x, y, z);
    for (let i = 1; i < list.length; i++) d = smin(d, list[i][0](x, y, z), list[i][1]);
    return d;
  };
}

/** Mirror a shape across the x = 0 plane (left/right pairs). */
export const mirrorX = (f) => (x, y, z) => f(Math.abs(x), y, z);

/**
 * Mesh a distance field with surface nets.
 * @param {function} f  (x,y,z) => distance
 * @param {number[]} lo, hi  bounds (must enclose the shape with a margin)
 * @param {number} res  cells along the longest side
 * @param {object} o  { attrs: {name: [itemSize, (p, n) => value(s)]} } per-vertex extras (e.g. coat pattern masks)
 */
export function meshSDF(f, lo, hi, res, { attrs = {}, project = 2 } = {}) {
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  const h = Math.max(...size) / res;
  const nx = Math.ceil(size[0] / h) + 1, ny = Math.ceil(size[1] / h) + 1, nz = Math.ceil(size[2] / h) + 1;
  const V = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) V[id(i, j, k)] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);

  // One vertex per cell that the surface passes through: the average of its edge crossings
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      cv[c] = V[id(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
      if (cv[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += (a & 1) + (((b & 1) - (a & 1)) * t);
      sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t);
      sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t);
      n++;
    }
    cellV[cid(i, j, k)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }

  // Quads across every grid edge where the sign changes
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, b, c, a, c, d);
    else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = V[id(i, j, k)], b = V[id(i + 1, j, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellV[cid(i, j - 1, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i, j - 1, k)], a < 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = V[id(i, j, k)], b = V[id(i, j + 1, k)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellV[cid(i - 1, j, k - 1)], cellV[cid(i - 1, j, k)], cellV[cid(i, j, k)], cellV[cid(i, j, k - 1)], a < 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = V[id(i, j, k)], b = V[id(i, j, k + 1)];
    if ((a < 0) === (b < 0)) continue;
    quad(cellV[cid(i - 1, j - 1, k)], cellV[cid(i, j - 1, k)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], a < 0);
  }

  // Snap vertices onto the true surface and take normals from the field's gradient (very smooth shading)
  const count = pos.length / 3;
  const P = new Float32Array(pos), N = new Float32Array(count * 3);
  const e = h * 0.35;
  const grad = (x, y, z) => {
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  };
  for (let v = 0; v < count; v++) {
    let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    for (let it = 0; it < project; it++) {
      const d = f(x, y, z);
      if (Math.abs(d) > h * 1.5) break;
      const g = grad(x, y, z);
      x -= g[0] * d; y -= g[1] * d; z -= g[2] * d;
    }
    const g = grad(x, y, z);
    P.set([x, y, z], v * 3);
    N.set(g, v * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  for (const [name, [size, fn]] of Object.entries(attrs)) {
    const A = new Float32Array(count * size);
    const p = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let v = 0; v < count; v++) {
      p.fromArray(P, v * 3); nn.fromArray(N, v * 3);
      const val = fn(p, nn);
      if (size === 1) A[v] = val;
      else A.set(val, v * size);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(A, size));
  }
  geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
