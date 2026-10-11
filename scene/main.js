// Entry point. Builds the renderer, lights, post-processing and all sets, then exposes
// window.__render(frame) which draws exactly that frame from the fixed virtual clock.
import * as THREE from 'three';
import { FPS, TOTAL_FRAMES, beatAt, recovery } from './timeline.js';
import { initOverlay, updateOverlay } from './overlay.js';
import { preloadFonts, syncLabels } from './text3d.js';
import { makeComposer } from './post.js';
import { lerp } from './easing.js';
import * as globe from './sets/globe.js';
import * as map from './sets/map.js';
import * as recharge from './sets/recharge.js';
import * as reservoir from './sets/reservoir.js';
import * as soil from './sets/soil.js';
import * as city from './sets/city.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const PR = Number(params.get('pr') || 2);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(PR); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0E1B2E);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.5, 60000);

// Environment: a code-generated gradient sky, deep blue to grey-white horizon, through PMREM
function makeEnvironment() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#0E1B2E'); grad.addColorStop(0.45, '#4F5E70'); grad.addColorStop(0.55, '#B8BFC6'); grad.addColorStop(0.62, '#5A6878'); grad.addColorStop(1, '#1A2230');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(tex).texture;
  scene.environmentIntensity = 0.6;
}
makeEnvironment();

// Three lights per the style bible
const key = new THREE.DirectionalLight(0xDCE6F2, 2.6); key.castShadow = true;
key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 4;
const fill = new THREE.DirectionalLight(0x5F7391, 0.9);
const rim = new THREE.DirectionalLight(0xF5E6C8, 1.4);
const hemi = new THREE.HemisphereLight(0x3E5470, 0x1A1E22, 0.35);
scene.add(key, key.target, fill, rim, hemi);
const lights = { key, fill, rim, hemi };

const KEY_COOL = new THREE.Color(0xDCE6F2), KEY_WARM = new THREE.Color(0xF7E9D2);
function placeLights(center, radius) {
  // key upper-left, fill lower-right, rim behind, all aimed at the set's centre
  key.position.copy(center).add(new THREE.Vector3(-0.7, 1.0, 0.5).multiplyScalar(radius * 2));
  fill.position.copy(center).add(new THREE.Vector3(0.8, 0.35, 0.4).multiplyScalar(radius * 2));
  rim.position.copy(center).add(new THREE.Vector3(0.2, 0.8, -1.0).multiplyScalar(radius * 2));
  key.target.position.copy(center); fill.target.position.copy(center); rim.target.position.copy(center);
  fill.target.updateMatrixWorld(); rim.target.updateMatrixWorld(); key.target.updateMatrixWorld();
  const s = key.shadow.camera; s.left = -radius; s.right = radius; s.top = radius; s.bottom = -radius; s.near = radius * 0.2; s.far = radius * 5; s.updateProjectionMatrix();
}

const { composer, grain } = makeComposer(renderer, scene, camera, W, H, PR);

const sets = { globe, map, recharge, reservoir, soil, city };
const ctx = { scene, camera, renderer, lights, placeLights, W, H };
let ready = false;
async function init() {
  initOverlay({ safe: params.get('safe') === '1' });
  await preloadFonts();
  for (const s of Object.values(sets)) { await s.build(ctx); s.group.visible = false; scene.add(s.group); }
  ready = true;
  window.__ready = true;
}

/** Render frame n (0-based). Returns a promise that resolves when the frame is fully drawn. */
window.__render = async function (n) {
  if (!ready) throw new Error('not ready');
  const t = n / FPS;
  const beat = beatAt(t);
  const active = sets[beat.set];
  for (const s of Object.values(sets)) s.group.visible = s === active;
  const r = recovery(t);
  key.color.copy(KEY_COOL).lerp(KEY_WARM, r); key.intensity = lerp(2.6, 3.2, r);
  fill.intensity = lerp(0.9, 1.15, r); hemi.intensity = lerp(0.35, 0.5, r);
  scene.background.set(0x0E1B2E).lerp(new THREE.Color(0x2A3C55), r * 0.6);
  scene.fog = null;                      // sets may add their own distance fog
  active.update(t, beat, ctx);
  updateOverlay(t);
  await syncLabels(camera);
  grain.uniforms.uFrame.value = n;
  composer.render();
};
window.__totalFrames = TOTAL_FRAMES;
init().catch(e => { console.error(e); window.__error = String(e.stack || e); });

// Interactive preview when opened in a normal browser: ?t=12.5 shows that second.
if (params.has('t')) { const tick = () => { if (window.__ready) window.__render(Math.round(Number(params.get('t')) * FPS)); else setTimeout(tick, 100); }; tick(); }
