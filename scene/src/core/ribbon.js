// Draped map lines (rivers, outlines, routes) with a constant on-screen width,
// optional flowing pulses, dashes, amber "levee" edges and draw-on reveal.
import * as THREE from 'three';

export function ribbonGeometry(points) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2 * 3), along = new Float32Array(n * 2), edge = new Float32Array(n * 2);
  let d = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (i > 0) d += p.distanceTo(points[i - 1]);
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const s = new THREE.Vector3(-t.z, 0, t.x);
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos.set([p.x, p.y, p.z], j * 3);
      side.set([s.x, s.y, s.z], j * 3);
      along[j] = d;
      edge[j] = k ? 1 : -1;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('side', new THREE.BufferAttribute(side, 3));
  g.setAttribute('along', new THREE.BufferAttribute(along, 1));
  g.setAttribute('edge', new THREE.BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.userData.length = d;
  return g;
}

export function ribbonMaterial({ color, px = 4, maxW = 0.15, opacity = 1, dash = 0, flow = 0, edgeColor = new THREE.Color(0, 0, 0), emissive = 0.0 }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uColor: { value: color.clone() }, uEdgeColor: { value: edgeColor.clone() }, uPx: { value: px }, uMaxW: { value: maxW },
      uTanHalf: { value: 0.5 }, uOpacity: { value: opacity }, uDash: { value: dash }, uFlow: { value: flow }, uTime: { value: 0 },
      uReveal: { value: 1e9 }, uRevealFrom: { value: 0 }, uEdge: { value: 0 }, uEmissive: { value: emissive }, uFlowPeriod: { value: 1.6 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 side; attribute float along; attribute float edge;
      uniform float uPx, uTanHalf, uMaxW;
      varying float vAlong, vEdge, vWpp;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float dist = length(cameraPosition - wp.xyz);
        float wpp = 2.0 * dist * uTanHalf / 1920.0;
        wp.xyz += side * edge * min(uPx * wpp, uMaxW) * 0.5;
        vAlong = along; vEdge = edge; vWpp = wpp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uEdgeColor; uniform float uOpacity, uDash, uFlow, uTime, uReveal, uRevealFrom, uEdge, uEmissive, uFlowPeriod;
      varying float vAlong, vEdge, vWpp;
      void main() {
        if (vAlong > uReveal || vAlong < uRevealFrom) discard;
        float e = abs(vEdge);
        float a = 1.0 - smoothstep(0.65, 1.0, e);
        if (uDash > 0.0) a *= step(fract(vAlong / (uDash * vWpp)), 0.58);
        // Flow pulses travel downstream (lines are stored source -> mouth).
        float s = fract(vAlong / uFlowPeriod - uTime * 0.55);
        float pulse = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.12, 0.42, s));
        vec3 col = uColor * (1.0 + uEmissive + uFlow * pulse * 0.9);
        // Levee edges glow amber along both banks.
        float lev = uEdge * smoothstep(0.35, 0.8, e);
        col = mix(col, uEdgeColor * 2.2, lev);
        a = max(a, lev * 0.9 * (1.0 - smoothstep(0.95, 1.0, e)));
        gl_FragColor = vec4(col, a * uOpacity);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
}

/** Per-frame: keep the on-screen width constant for the current lens. */
export function updateRibbon(mat, cam, time) {
  mat.uniforms.uTanHalf.value = Math.tan((cam.fov * Math.PI) / 360);
  mat.uniforms.uTime.value = time;
}
