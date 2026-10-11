// Set A: the globe. Beats 1-2 (Pacific moisture, fly-to California) and the end card.
import * as THREE from 'three';
import { loadJSON, rings } from '../geo.js';
import { easeInOut, lerp, seeded, span, smooth } from '../easing.js';

export const group = new THREE.Group();
const R = 6371;
let plumeMat, clouds = [], atmosphere, landfall;

/** lon/lat (deg) -> position on the sphere of radius r. Matches the texture mapping below. */
export function lonLatToVec(lon, lat, r = R) {
  const phi = (lon + 180) * Math.PI / 180, th = lat * Math.PI / 180;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.cos(th), r * Math.sin(th), r * Math.sin(phi) * Math.cos(th));
}

function makeTexture(land, states) {
  const W = 4096, H = 2048;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#17395B'; g.fillRect(0, 0, W, H);           // ocean (a touch lighter than the background)
  const path = geom => { for (const ring of rings(geom)) ring.forEach(([lon, lat], i) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); };
  // shoreline gradient: a soft lighter-water stroke under the coast
  g.beginPath(); land.features.forEach(f => path(f.geometry));
  g.strokeStyle = 'rgba(47,127,194,0.45)'; g.lineWidth = 9; g.lineJoin = 'round'; g.stroke();
  g.strokeStyle = 'rgba(47,127,194,0.35)'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#6E7B8A'; g.fill('nonzero');
  g.strokeStyle = 'rgba(160,170,180,0.55)'; g.lineWidth = 1.5; g.stroke();
  // California: the focus region, accent fill at low alpha with a soft glow
  const ca = states.features.find(f => f.properties.name === 'California');
  g.save(); g.beginPath(); path(ca.geometry);
  g.shadowColor = 'rgba(224,166,64,0.9)'; g.shadowBlur = 18;
  g.fillStyle = 'rgba(224,166,64,0.30)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(224,166,64,0.85)'; g.stroke(); g.restore();
  // other state borders, thin and quiet
  g.beginPath(); states.features.forEach(f => f !== ca && path(f.geometry));
  g.strokeStyle = 'rgba(200,205,210,0.25)'; g.lineWidth = 1.2; g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function makePlume() {
  // Ribbon of Pacific moisture from the tropics to the California coast, 40 km above the surface
  const way = [[-172, 16], [-160, 20], [-148, 25], [-138, 30], [-130, 34.5], [-125, 37], [-121.5, 38.8], [-119.5, 39.6]];
  const pts = way.map(([lon, lat]) => lonLatToVec(lon, lat, R + 40));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const N = 160, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const normal = p.clone().normalize();
    const side = new THREE.Vector3().crossVectors(normal, tan).normalize();
    const half = lerp(260, 420, Math.sin(u * Math.PI)) * (1 - 0.55 * smooth(0.85, 1, u));
    const a = p.clone().addScaledVector(side, half), b = p.clone().addScaledVector(side, -half);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(u, 0, u, 1);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  plumeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2F7FC2) }, uStrength: { value: 1 }, uReach: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uStrength, uReach; uniform vec3 uColor; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      void main(){
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float edge = pow(smoothstep(0.0, 1.0, across), 1.6);
        float along = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(uReach - 0.08, uReach, vUv.x));
        float streaks = noise(vec2(vUv.x * 14.0 - uTime * 0.55, vUv.y * 4.0)) * 0.6 + noise(vec2(vUv.x * 40.0 - uTime * 0.9, vUv.y * 9.0 + 3.0)) * 0.4;
        float a = edge * along * (0.35 + 0.65 * streaks) * uStrength;
        float core = pow(across, 4.0) * 0.5;
        gl_FragColor = vec4(uColor * (1.0 + 0.7 * streaks) + vec3(core), (a + core * along * uStrength) * 0.9);
      }`
  });
  const mesh = new THREE.Mesh(geo, plumeMat); mesh.renderOrder = 5;
  // cloud puffs riding the plume
  const cc = document.createElement('canvas'); cc.width = cc.height = 256;
  const cg = cc.getContext('2d'); const grd = cg.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, 'rgba(200,208,216,0.95)'); grd.addColorStop(0.45, 'rgba(180,190,200,0.55)'); grd.addColorStop(1, 'rgba(160,170,180,0)');
  cg.fillStyle = grd; cg.fillRect(0, 0, 256, 256);
  const ctex = new THREE.CanvasTexture(cc); ctex.colorSpace = THREE.SRGBColorSpace;
  const rnd = seeded(7);
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, opacity: 0.3, color: 0xB6BEC6 }));
    const u0 = 0.05 + rnd() * 0.93;
    s.userData = { u0, off: (rnd() - 0.5) * 520 * (0.4 + rnd() * 0.6), size: 220 + rnd() * 380, speed: 0.008 + rnd() * 0.008, curve, a: 0.2 + rnd() * 0.25 };
    s.scale.setScalar(s.userData.size);
    clouds.push(s); mesh.add(s);
  }
  return mesh;
}

export async function build(ctx) {
  const [land, states] = await Promise.all([loadJSON('/data/land50.json'), loadJSON('/data/states.json')]);
  const tex = makeTexture(land, states);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 }));
  group.add(earth);
  atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0x2F7FC2) } },
    vertexShader: `varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uColor * 1.3, f * 0.9); }`
  }));
  group.add(atmosphere);
  group.add(makePlume());
  // a faint landfall glow where the plume meets the coast
  landfall = new THREE.Mesh(new THREE.CircleGeometry(520, 48), new THREE.MeshBasicMaterial({ color: 0x2F7FC2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const lf = lonLatToVec(-122.5, 38.4, R + 20); landfall.position.copy(lf); landfall.lookAt(lf.clone().multiplyScalar(2));
  group.add(landfall);
}

function aim(camera, lon, lat, dist, vfov, lift = 0) {
  const target = lonLatToVec(lon, lat, R);
  const n = target.clone().normalize();
  camera.position.copy(n).multiplyScalar(R + dist);
  camera.position.addScaledVector(new THREE.Vector3(0, 1, 0), lift);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.fov = vfov; camera.near = 50; camera.far = 80000; camera.updateProjectionMatrix();
}

export function update(t, beat, ctx) {
  const { camera, placeLights } = ctx;
  placeLights(new THREE.Vector3(0, 0, 0), R * 1.2);
  // (shadow casting stays on; the globe has no receivers)
  const local = t - beat.start;
  plumeMat.uniforms.uTime.value = t;
  for (const s of clouds) {
    const u = (s.userData.u0 + t * s.userData.speed) % 1;
    const p = s.userData.curve.getPointAt(u), tan = s.userData.curve.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(p.clone().normalize(), tan).normalize();
    s.position.copy(p).addScaledVector(side, s.userData.off).addScaledVector(p.clone().normalize(), 60);
    s.material.opacity = s.userData.a * smooth(0.03, 0.12, u) * (1 - smooth(0.9, 0.99, u)) * plumeMat.uniforms.uStrength.value;
  }
  if (beat.id === 1) {
    // establishing wide drift, 28 mm: hold for the first second (title + caption), then ease across the Pacific
    const k = easeInOut(span(local, 1.0, 4.0));
    aim(camera, lerp(-141, -136, k), lerp(29, 31, k), lerp(5200, 4800, k), 65.5, lerp(-500, -200, k));
    plumeMat.uniforms.uStrength.value = lerp(0.55, 0.9, easeInOut(span(local, 0, 3)));
    plumeMat.uniforms.uReach.value = lerp(0.72, 0.9, easeInOut(span(local, 0.5, 4)));
    landfall.material.opacity = 0;
  } else if (beat.id === 2) {
    // fly-to California: zoom out a touch, pan, zoom in; 35 mm at the end
    const k = easeInOut(span(local, 0.9, 3.7));
    const bump = Math.sin(k * Math.PI) * 900;
    aim(camera, lerp(-136, -121.5, k), lerp(31, 37.3, k), lerp(4800, 2600, k) + bump, lerp(65.5, 54.4, k), lerp(-200, 150, k));
    plumeMat.uniforms.uStrength.value = lerp(0.9, 1.15, k);
    plumeMat.uniforms.uReach.value = lerp(0.9, 1.0, easeInOut(span(local, 0.5, 3)));
    landfall.material.opacity = 0.35 * easeInOut(span(local, 1.5, 3.5));
  } else {
    // end card: calm, slow drift, the plume gone
    const k = easeInOut(span(local, 0, 4));
    aim(camera, lerp(-131, -127, k), 32, 6500, 54.4, 200);
    plumeMat.uniforms.uStrength.value = 0.12;
    plumeMat.uniforms.uReach.value = 0.7;
    landfall.material.opacity = 0;
  }
}
