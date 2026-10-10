// Shared toy-city toolkit: renderer, miniature look, materials, text, people, cars, trees, clouds,
// camera system and the on-screen overlay. Lifted from the 2008 project so new videos reuse it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { BEAT_LEN, TOTAL } from './beats.js';

export { THREE };
export const W = 1080, H = 1920;

// ---------- small helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); }; // smootherstep
export const easeOutBack = x => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const easeOutBounce = x => {
  x = clamp(x); const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};
export const wrap = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));
export function rngFrom(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const rng = rngFrom(1982);
export const beatOf = t => Math.min(13, Math.floor(t / BEAT_LEN)); // 0..12 beats, 13 = end card
export const local = (t, i) => t - i * BEAT_LEN;                    // seconds into beat i
export const inBeat = (t, i) => beatOf(t) === i;
export const cyc = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
export function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps the pastel palette saturated
renderer.toneMappingExposure = 0.95;

export const scene = new THREE.Scene();
export function skyGradient(stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  stops.forEach(([k, col]) => gr.addColorStop(k, col));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
skyGradient([[0, '#6cc4ff'], [0.5, '#b4e2ff'], [0.85, '#e9f4ff'], [1, '#fff0dc']]);
scene.fog = new THREE.Fog(0xe6f2ff, 110, 280);

export const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 600);
// Shift the frame so the point the camera looks at lands in the open band between the stats panel and the caption.
const FRAME_SHIFT = 70;
camera.setViewOffset(W, H, 0, FRAME_SHIFT, W, H);
const FOCUS = (H - (H / 2 - FRAME_SHIFT)) / H;

// Miniature look: a tilt-shift blur that keeps the subject sharp and softens the top and bottom.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType }));
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const hts = new ShaderPass(HorizontalTiltShiftShader); hts.uniforms.h.value = 3.2 / W; hts.uniforms.r.value = FOCUS;
const vts = new ShaderPass(VerticalTiltShiftShader); vts.uniforms.v.value = 3.2 / H; vts.uniforms.r.value = FOCUS;
composer.addPass(hts); composer.addPass(vts); composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0xe3f2ff, 0xa6d88a, 1.35));
export const sun = new THREE.DirectionalLight(0xffeccc, 2.6);
const SUN_OFFSET = new THREE.Vector3(38, 62, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 200 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xc9dcff, 0.5); fill.position.set(-40, 25, -30); scene.add(fill);

// ---------- materials & geometry ----------
const matCache = new Map();
export function M(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.0, ...extra }));
  return matCache.get(key);
}
export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}
// Chunky parts get softly rounded edges so the city reads like a toy model.
const geoCache = new Map();
export function box(w, h, d, mat) {
  const key = [w, h, d].join(',');
  if (!geoCache.has(key)) {
    const m = Math.min(w, h, d);
    geoCache.set(key, m >= 0.45 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(0.28, m * 0.2)) : new THREE.BoxGeometry(w, h, d));
  }
  return mesh(geoCache.get(key), mat);
}

// ---------- text ----------
export function textCanvas(text, { w = 512, h = 160, bg = '#ffffff', fg = '#1b2240', font = '900 88px Inter', radius = 36, border = null, pad = 0 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg; g.beginPath(); g.roundRect(pad, pad, w - 2 * pad, h - 2 * pad, radius); g.fill();
    if (border) { g.lineWidth = 10; g.strokeStyle = border; g.stroke(); }
  }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = h / (lines.length + 0.4);
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
export function textPlane(text, w, h, opts = {}) {
  const tex = textCanvas(text, { w: Math.round(512 * (w / h) * (opts.res || 1) / (512 / 160)) || 512, ...opts });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
}
export function sprite(text, w, h, opts = {}) {
  const tex = textCanvas(text, { w: Math.round(160 * w / h), h: 160, ...opts });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false, depthTest: opts.depthTest ?? true }));
  s.scale.set(w, h, 1); return s;
}

// ---------- palettes ----------
export const HOUSE = ['#fff1dc', '#ffc9a8', '#bfe8d8', '#c6e2ff', '#ffe28a', '#ffc4d0', '#d9ccff'];
export const ROOF = ['#f26b5b', '#3f8fd8', '#2bb3a3', '#5a63c9', '#f2945b'];
export const SHIRTS = ['#f26b5b', '#3f8fd8', '#ffc94a', '#7b6cf6', '#2bb3a3', '#f2945b', '#ff7aa2', '#2f4b8c'];
export const CARS = ['#f26b5b', '#ffc94a', '#2bb3a3', '#3f8fd8', '#fff1dc', '#7b6cf6', '#ff9f80'];
export const LEAVES = ['#5cbf6a', '#4fae7c', '#79c95c'];
export const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a5694f'];

export const updaters = [];
export const blockers = []; // [object, distance]: hidden when they get too close to the camera
export const onUpdate = fn => updaters.push(fn);

// ---------- trees ----------
export function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const leaf = M(cyc(LEAVES, Math.round(x * 7 + z * 3)));
  g.add(at(mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.4 * s, 12), M('#9a6a45')), 0, 0.7 * s, 0));
  const crown = new THREE.Group(); crown.position.y = 1.4 * s;
  crown.add(at(mesh(new THREE.SphereGeometry(1.0 * s, 20, 16), leaf), 0, 0.7 * s, 0));
  crown.add(at(mesh(new THREE.SphereGeometry(0.7 * s, 18, 14), leaf), 0.35 * s, 1.45 * s, 0.1 * s));
  g.add(crown);
  const ph = x * 0.37 + z * 0.21;
  onUpdate(t => { crown.rotation.z = Math.sin(t * 1.3 + ph) * 0.035; crown.rotation.x = Math.cos(t * 1.1 + ph) * 0.025; });
  scene.add(at(g, x, 0, z)); g.userData.isStatic = true; blockers.push([g, 9]); return g;
}
// Cypress for an Italian flavour.
export function cypress(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 0.8 * s, 10), M('#9a6a45')), 0, 0.4 * s, 0));
  const crown = at(mesh(new THREE.ConeGeometry(0.8 * s, 4.4 * s, 14), M('#3f8f5a')), 0, 2.8 * s, 0); g.add(crown);
  const ph = x * 0.3 + z * 0.2;
  onUpdate(t => { crown.rotation.z = Math.sin(t * 1.5 + ph) * 0.03; });
  scene.add(at(g, x, 0, z)); g.userData.isStatic = true; blockers.push([g, 7]); return g;
}

// ---------- people ----------
let personCount = 0;
export function person({ shirt = cyc(SHIRTS, personCount * 3), skin = cyc(SKINS, personCount * 5 + 1), hat = personCount % 4 === 0, hatColor = null } = {}) {
  personCount++;
  const g = new THREE.Group();
  const body = at(mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 10), M(shirt)), 0, 0.6, 0);
  const head = at(mesh(new THREE.SphereGeometry(0.2, 18, 14), M(skin)), 0, 1.07, 0);
  const legL = at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), M('#2b2d42')), -0.09, 0.15, 0);
  const legR = at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), M('#2b2d42')), 0.09, 0.15, 0);
  g.add(body, head, legL, legR);
  let hatMesh = null;
  if (hat) { hatMesh = at(mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 16), M(hatColor || cyc(['#ffc94a', '#f26b5b', '#3f8fd8'], personCount))), 0, 1.24, 0); g.add(hatMesh); }
  g.userData = { legL, legR, body, head, hat: hatMesh };
  return g;
}
export function walkPose(p, phase) {
  const s = Math.sin(phase);
  p.userData.legL.rotation.x = s * 0.6; p.userData.legR.rotation.x = -s * 0.6;
  p.userData.body.position.y = 0.6 + Math.abs(Math.cos(phase)) * 0.05;
  p.userData.head.position.y = 1.07 + Math.abs(Math.cos(phase)) * 0.05;
}
export function hopPose(p, k) { // k in 0..1, a happy little jump
  const y = Math.sin(clamp(k) * Math.PI) * 0.6;
  p.position.y = 0.16 + y; p.userData.legL.rotation.x = -0.4 * Math.sin(k * Math.PI); p.userData.legR.rotation.x = -0.4 * Math.sin(k * Math.PI);
}

// ---------- cars ----------
export function car(color) {
  const g = new THREE.Group();
  g.add(at(box(2.2, 0.6, 1.1, M(color)), 0, 0.55, 0));
  g.add(at(box(1.2, 0.5, 1.0, M('#dff6ff', { roughness: 0.2 })), -0.1, 1.05, 0));
  for (const [x, z] of [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.55], [0.7, -0.55]]) {
    const w = at(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 18), M('#2b2f3f')), x, 0.28, z); w.rotation.x = Math.PI / 2; g.add(w);
    (g.userData.wheels ||= []).push(w);
  }
  g.add(at(mesh(new THREE.SphereGeometry(0.1, 10, 8), M('#fff6c8', { emissive: '#ffe08a', emissiveIntensity: 0.6 })), 1.1, 0.6, 0.35));
  g.add(at(mesh(new THREE.SphereGeometry(0.1, 10, 8), M('#fff6c8', { emissive: '#ffe08a', emissiveIntensity: 0.6 })), 1.1, 0.6, -0.35));
  return g;
}

// ---------- clouds ----------
export function cloud(s, color = '#ffffff') {
  const g = new THREE.Group(), mat = M(color, { roughness: 1 });
  for (const [x, y, r] of [[0, 0, 1.6], [1.6, -0.2, 1.2], [-1.6, -0.3, 1.1], [0.7, 0.8, 1.1], [-0.6, 0.7, 1.0]]) g.add(at(mesh(new THREE.SphereGeometry(r, 14, 12), mat, { cast: false }), x, y, 0));
  g.scale.setScalar(s); scene.add(g); return g;
}

// ---------- camera system: one shot per beat ----------
export const lookTarget = new THREE.Vector3();
let SHOTS = [];
export function setShots(s) { SHOTS = s; }
export function placeCamera(t) {
  const b = beatOf(t), lt = b < 13 ? local(t, b) : t - 13 * BEAT_LEN, len = b < 13 ? BEAT_LEN : 4, k = ease(lt / len);
  const s = SHOTS[b];
  camera.up.set(0, 1, 0);
  if (s.custom) { s.custom(t, lt, k); return; }
  if (s.orbit) {
    const a = lerp(s.orbit.a0, s.orbit.a1, k);
    camera.position.set(s.orbit.c.x + Math.cos(a) * s.orbit.r, s.orbit.h, s.orbit.c.z + Math.sin(a) * s.orbit.r);
    lookTarget.copy(s.orbit.c); camera.lookAt(lookTarget); return;
  }
  const kk = s.snap ? easeOutBack(lt / 0.7) : k;
  camera.position.lerpVectors(s.p0, s.p1, kk);
  if (b < 13) camera.position.add(new THREE.Vector3(Math.sin(t * 0.9) * 0.12, Math.sin(t * 1.3) * 0.08, Math.cos(t * 0.7) * 0.12)); // soft handheld float
  if (s.up) camera.up.copy(s.up);
  lookTarget.lerpVectors(s.t0, s.t1, k);
  camera.lookAt(lookTarget);
}

// ---------- overlay ----------
export const $ = id => document.getElementById(id);
export function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }

// ---------- frame driver ----------
let overlayFn = () => {}, extraHide = () => {};
export function setOverlay(fn) { overlayFn = fn; }
export function setExtraHide(fn) { extraHide = fn; }
export function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-6);
  for (const fn of updaters) fn(t);
  placeCamera(t);
  for (const [o, d] of blockers) {
    if (o.userData.isStatic) o.visible = true;
    if (o.visible && new THREE.Vector3(o.position.x, camera.position.y, o.position.z).distanceTo(camera.position) < d) o.visible = false;
  }
  extraHide(t);
  overlayFn(t);
  // keep the sharp part of the shadow map centred on whatever the shot is looking at
  const st = new THREE.Vector3(lookTarget.x, 0, lookTarget.z);
  sun.target.position.copy(st); sun.position.copy(st).add(SUN_OFFSET); sun.target.updateMatrixWorld();
  composer.render();
}
export function start() {
  window.renderAt = renderAt; window.TOTAL = TOTAL;
  document.fonts.load('900 40px Inter').then(() => { renderAt(0); window.sceneReady = true; });
}
