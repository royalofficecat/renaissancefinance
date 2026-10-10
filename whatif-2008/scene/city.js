// Miniature "WHAT IF" city. Everything is a pure function of time t (seconds),
// so the recorder can ask for any frame in any order and get the same picture.
import * as THREE from 'three';
import { BEATS, END, BEAT_LEN, TOTAL } from './beats.js';

const W = 1080, H = 1920;

// ---------- small helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = x => { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const easeOutBack = x => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeOutBounce = x => {
  x = clamp(x); const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};
const wrap = (x, a, b) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));
function rngFrom(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = rngFrom(2008);
const pick = arr => arr[Math.floor(rng() * arr.length)];
const beatOf = t => Math.min(13, Math.floor(t / BEAT_LEN)); // 0..12 beats, 13 = end card
const local = (t, i) => t - i * BEAT_LEN;                    // seconds into beat i
const inBeat = (t, i) => beatOf(t) === i;

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#5ab8ff'); gr.addColorStop(0.55, '#a8dcff'); gr.addColorStop(1, '#ffe6c7');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
scene.fog = new THREE.Fog(0xcfe9ff, 120, 260);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 600);

scene.add(new THREE.HemisphereLight(0xdff3ff, 0x8fc77a, 1.4));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(40, 70, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 220 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const matCache = new Map();
function M(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.0, ...extra }));
  return matCache.get(key);
}
function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m;
}
const box = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);
function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

// Text drawn onto a canvas, used for signs, tags and floating labels.
function textCanvas(text, { w = 512, h = 160, bg = '#ffffff', fg = '#1b2240', font = '900 88px Inter', radius = 36, border = null, pad = 0 } = {}) {
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
function textPlane(text, w, h, opts = {}) {
  const tex = textCanvas(text, { w: Math.round(512 * (w / h) * (opts.res || 1) / (512 / 160)) || 512, ...opts });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  return m;
}
function sprite(text, w, h, opts = {}) {
  const tex = textCanvas(text, { w: Math.round(160 * w / h), h: 160, ...opts });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false, depthTest: opts.depthTest ?? true }));
  s.scale.set(w, h, 1); return s;
}

// ---------- palettes ----------
const HOUSE = ['#ff8fa3', '#ffd166', '#8ecae6', '#b5e48c', '#cdb4db', '#ffb703', '#90e0ef', '#f4a261'];
const ROOF = ['#e63946', '#3a86ff', '#8338ec', '#2a9d8f', '#fb5607', '#6d597a'];
const SHIRTS = ['#e63946', '#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0', '#fb5607', '#ff006e', '#118ab2'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a5694f'];

const updaters = [];
const blockers = []; // objects hidden when they get too close to the camera
const onUpdate = fn => updaters.push(fn);

// ---------- ground & roads ----------
{
  const ground = mesh(new THREE.PlaneGeometry(400, 400), M('#86d46b'), { cast: false });
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const road = M('#4a4f63'), walk = M('#efe3c8'), line = M('#ffffff');
  const addRoad = (x, z, w, d) => { const r = box(w, 0.1, d, road); r.castShadow = false; scene.add(at(r, x, 0.05, z)); };
  addRoad(0, 0, 200, 6);                       // Main Street
  addRoad(-36, 0, 6, 120); addRoad(24, 0, 6, 120); // cross streets
  for (const z of [-3.7, 3.9]) { const s = box(200, 0.16, z > 0 ? 1.8 : 1.4, walk); s.castShadow = false; scene.add(at(s, 0, 0.08, z)); }
  for (let x = -98; x < 100; x += 4) { const l = box(2, 0.12, 0.25, line); l.castShadow = false; scene.add(at(l, x, 0.06, 0)); }
  for (const cx of [-36, 24]) for (let z = -58; z < 60; z += 4) { const l = box(0.25, 0.12, 2, line); l.castShadow = false; scene.add(at(l, cx, 0.06, z)); }
}

// ---------- trees ----------
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(0.18 * s, 0.25 * s, 1.4 * s, 8), M('#8b5a2b')), 0, 0.7 * s, 0));
  g.add(at(mesh(new THREE.SphereGeometry(1.1 * s, 12, 10), M(pick(['#2a9d50', '#43aa8b', '#52b788', '#38b000']))), 0, 2.0 * s, 0));
  scene.add(at(g, x, 0, z)); g.userData.isTree = true; blockers.push([g, 9]); return g;
}

// ---------- people ----------
function person({ shirt = pick(SHIRTS), skin = pick(SKINS), hat = rng() < 0.3, lunch = false } = {}) {
  const g = new THREE.Group();
  const body = at(mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 10), M(shirt)), 0, 0.6, 0);
  const head = at(mesh(new THREE.SphereGeometry(0.2, 14, 12), M(skin)), 0, 1.07, 0);
  const legL = at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), M('#2b2d42')), -0.09, 0.15, 0);
  const legR = at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), M('#2b2d42')), 0.09, 0.15, 0);
  g.add(body, head, legL, legR);
  if (hat) g.add(at(mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 12), M(pick(['#ffbe0b', '#e63946', '#3a86ff']))), 0, 1.24, 0));
  if (lunch) g.add(at(box(0.22, 0.16, 0.12, M('#ff006e')), 0.3, 0.42, 0));
  g.userData = { legL, legR, body, head };
  return g;
}
function walkPose(p, phase) {
  const s = Math.sin(phase);
  p.userData.legL.rotation.x = s * 0.6; p.userData.legR.rotation.x = -s * 0.6;
  p.userData.body.position.y = 0.6 + Math.abs(Math.cos(phase)) * 0.05;
  p.userData.head.position.y = 1.07 + Math.abs(Math.cos(phase)) * 0.05;
}

// Sidewalk walkers that keep the city alive the whole video.
for (let i = 0; i < 46; i++) {
  const p = person(); scene.add(p); blockers.push([p, 7]);
  const north = rng() < 0.5, dir = rng() < 0.5 ? 1 : -1, speed = 1.0 + rng() * 0.6, x0 = rng() * 160;
  const lane = north ? -3.7 + (rng() - 0.5) * 0.8 : 3.9 + (rng() - 0.5) * 1.2;
  p.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  onUpdate(t => {
    const x = wrap(x0 + dir * speed * t, -80, 80);
    p.position.set(x, 0.16, lane); walkPose(p, t * speed * 7 + x0);
    p.visible = beatOf(t) !== 6 || !north; // beat 7 uses its own commuters on the north sidewalk
    if (beatOf(t) === 1 && Math.abs(x + 6) < 9) p.visible = false; // keep the spaghetti scene clear
  });
}

// ---------- cars ----------
function car(color) {
  const g = new THREE.Group();
  g.add(at(box(2.2, 0.6, 1.1, M(color)), 0, 0.55, 0));
  g.add(at(box(1.2, 0.5, 1.0, M('#dff6ff', { roughness: 0.2 })), -0.1, 1.05, 0));
  for (const [x, z] of [[-0.7, 0.55], [0.7, 0.55], [-0.7, -0.55], [0.7, -0.55]]) {
    const w = at(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), M('#222')), x, 0.28, z); w.rotation.x = Math.PI / 2; g.add(w);
  }
  return g;
}
for (let i = 0; i < 14; i++) {
  const c = car(pick(['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#9b5de5', '#ffffff']));
  scene.add(c); blockers.push([c, 9]);
  const dir = i % 2 ? 1 : -1, x0 = i * 23, sp = 5 + (i % 3);
  if (i < 10) {
    c.rotation.y = dir > 0 ? 0 : Math.PI;
    onUpdate(t => c.position.set(wrap(x0 + dir * sp * t, -90, 90), 0.1, dir > 0 ? 1.4 : -1.4));
  } else {
    const cx = i % 2 ? -36 : 24; c.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    onUpdate(t => c.position.set(cx + (dir > 0 ? -1.4 : 1.4), 0.1, wrap(x0 + dir * sp * t, -60, 60)));
  }
}

// ---------- houses ----------
function house(x, z, facing, color, roof) {
  const g = new THREE.Group();
  g.add(at(box(5, 3.2, 4.6, M(color)), 0, 1.6, 0));
  const r = at(mesh(new THREE.ConeGeometry(4.1, 2.4, 4), M(roof)), 0, 4.4, 0); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.82); g.add(r);
  g.add(at(box(1.0, 1.8, 0.1, M('#7a4b2a')), 0, 0.9, 2.32));
  for (const wx of [-1.5, 1.5]) g.add(at(box(0.9, 0.9, 0.1, M('#cfefff', { emissive: '#000000' })), wx, 2.0, 2.32));
  g.add(at(box(2.2, 0.2, 1.4, M('#d9c7a7')), 0, 0.1, 3.0)); // porch
  g.rotation.y = facing; g.userData.roof = r;
  scene.add(at(g, x, 0, z)); return g;
}
const houses = [];
for (const hx of [-44, -52, -60, -68, -76]) {
  houses.push(house(hx, -9, 0, pick(HOUSE), pick(ROOF)));
  houses.push(house(hx, 9, Math.PI, pick(HOUSE), pick(ROOF)));
  houses.push(house(hx, -19, 0, pick(HOUSE), pick(ROOF)));
  houses.push(house(hx, 19, Math.PI, pick(HOUSE), pick(ROOF)));
}
for (const hx of [52, 60, 68]) { houses.push(house(hx, 9, Math.PI, pick(HOUSE), pick(ROOF))); houses.push(house(hx, 19, Math.PI, pick(HOUSE), pick(ROOF))); }
const hero = houses[1]; // (-44, 9), faces the street

for (let i = 0; i < 40; i++) {
  const x = -90 + rng() * 180, z = (rng() < 0.5 ? -1 : 1) * (26 + rng() * 30);
  if (Math.abs(x - 24) < 5 || Math.abs(x + 36) < 5) continue;
  tree(x, z, 0.8 + rng() * 0.6);
}
for (const x of [-40, -32, 20, 28, 48]) { tree(x, -6, 0.7); tree(x, 6.5, 0.7); }

// ---------- banks ----------
function classicalBank(x, z, w, label) {
  const g = new THREE.Group();
  g.add(at(box(w, 5, 7, M('#f6efe2')), 0, 2.5, 0));
  g.add(at(box(w + 0.6, 0.4, 2.2, M('#e3d8c3')), 0, 0.2, 4.4));
  g.add(at(box(w + 0.2, 0.3, 1.6, M('#e3d8c3')), 0, 0.5, 4.2));
  const cols = Math.round(w / 2);
  for (let i = 0; i < cols; i++) {
    g.add(at(mesh(new THREE.CylinderGeometry(0.32, 0.36, 4.4, 14), M('#ffffff')), -w / 2 + 1 + i * ((w - 2) / (cols - 1)), 2.8, 3.8));
  }
  g.add(at(box(w + 0.4, 0.5, 1.4, M('#fffaf0')), 0, 5.2, 3.8));
  const ped = at(mesh(new THREE.CylinderGeometry(1, 1, w + 0.4, 3), M('#fffaf0')), 0, 6.0, 3.8);
  ped.rotation.z = Math.PI / 2; ped.scale.set(1.4, 1, 0.55); g.add(ped);
  const sign = at(textPlane(label, w * 0.62, 1.0, { bg: '#1d3557', fg: '#ffd166', font: '900 100px Inter', radius: 20 }), 0, 5.2, 4.52); g.add(sign);
  g.add(at(box(1.6, 2.4, 0.1, M('#7a4b2a')), 0, 1.6, 3.55));
  scene.add(at(g, x, 0, z)); return g;
}
const mainBank = classicalBank(-6, -8.3, 12, 'BANK');
const savingsBank = classicalBank(-27, -8.3, 8, 'SAVINGS');
function openSign(x, y, z) {
  const s = textPlane('OPEN', 1.6, 0.6, { bg: '#ff006e', fg: '#ffffff', font: '900 110px Inter', radius: 30 });
  scene.add(at(s, x, y, z)); return s;
}
const openMain = openSign(-3.2, 1.9, -4.5);
const openSavings = openSign(-25, 1.9, -4.5);
onUpdate(t => { // banks keep their OPEN signs glowing, with a little pulse during beat 6
  const k = inBeat(t, 5) ? 1 + 0.08 * Math.sin(local(t, 5) * 10) : 1;
  openMain.scale.setScalar(k); openSavings.scale.setScalar(k);
});

// Big bank tower (beat 5 wobble + scaffolding)
const tower = new THREE.Group();
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
  const g = c.getContext('2d'); g.fillStyle = '#5c7cfa'; g.fillRect(0, 0, 256, 1024);
  for (let y = 20; y < 1000; y += 48) for (let x = 20; x < 240; x += 56) { g.fillStyle = (x * y) % 7 < 3 ? '#fff6b3' : '#cfe8ff'; g.fillRect(x, y, 36, 30); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const body = at(mesh(new THREE.BoxGeometry(7, 26, 7), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })), 0, 13, 0);
  tower.add(body);
  tower.add(at(box(7.6, 0.8, 7.6, M('#ffd166')), 0, 26.4, 0));
  const sg = at(textPlane('BIG BANK', 6.4, 1.4, { bg: '#ffd166', fg: '#1d3557', font: '900 96px Inter', radius: 18 }), 0, 24.6, 3.56); tower.add(sg);
  tower.add(at(box(1.8, 2.4, 0.1, M('#7a4b2a')), 0, 1.2, 3.55));
}
scene.add(at(tower, 10, 0, -12));
const towerOpen = openSign(12.2, 2.0, -8.4);
const scaffold = new THREE.Group();
{
  const pole = M('#ff9f1c');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let lvl = 0; lvl < 6; lvl++) {
    scaffold.add(at(box(0.18, 4.4, 0.18, pole), sx * 4.2, 2.2 + lvl * 4.4, sz * 4.2));
  }
  for (let lvl = 1; lvl <= 6; lvl++) for (const r of [0, 1, 2, 3]) {
    const b = box(8.6, 0.16, 0.16, pole); b.rotation.y = r * Math.PI / 2;
    const off = 4.2; b.position.set(r === 1 ? off : r === 3 ? -off : 0, lvl * 4.4, r === 0 ? off : r === 2 ? -off : 0);
    scaffold.add(b);
  }
}
scene.add(at(scaffold, 10, 0, -12));
onUpdate(t => {
  const b = beatOf(t);
  if (b < 4) { tower.rotation.z = 0; scaffold.scale.y = 0.0001; scaffold.visible = false; towerOpen.visible = true; return; }
  scaffold.visible = true;
  if (b === 4) {
    const lt = local(t, 4);
    const wob = lt < 2.2 ? Math.sin(lt * 9) * 0.05 * (1 - clamp((lt - 1.4) / 0.8)) * clamp(lt / 0.3) : 0;
    tower.rotation.z = wob;
    scaffold.scale.y = Math.max(0.0001, ease((lt - 0.9) / 1.4));
    towerOpen.visible = lt > 2.6 ? (lt > 3.0 || Math.floor(lt * 20) % 2 === 0) : false;
  } else { tower.rotation.z = 0; scaffold.scale.y = 1; towerOpen.visible = true; }
});

// ---------- shops (south side, facing the street) ----------
const SHOPS = [['BAKERY', '#ff8fab', '#ffffff'], ['BOOKS', '#80ed99', '#ffffff'], ['DINER', '#ffd166', '#ef476f'], ['TOYS', '#a0c4ff', '#ffffff'], ['FLOWERS', '#ffadad', '#ffffff'], ['TOOLS', '#fdffb6', '#3a86ff']];
const awnings = [];
const shopDoors = [];
SHOPS.forEach(([name, wall, stripe], i) => {
  const x = -28 + i * 7, g = new THREE.Group();
  g.add(at(box(6.4, 4.4, 6, M(wall)), 0, 2.2, 0));
  g.add(at(box(6.6, 0.4, 6.2, M('#ffffff')), 0, 4.5, 0));
  g.add(at(box(1.4, 0.8, 1.2, M('#adb5bd')), 1.5, 5.1, 1.2));
  for (const wx of [-1.8, 0.2]) g.add(at(box(1.2, 1.0, 0.1, M('#d7f3ff', { roughness: 0.15 })), wx, 2.6, 3.02));
  g.add(at(box(1.0, 2.0, 0.1, M('#6b3e26')), 2.0, 1.0, 3.02));
  g.add(at(box(2.6, 1.6, 0.1, M('#d7f3ff', { roughness: 0.15 })), -1.4, 1.6, -3.02));
  g.add(at(box(1.2, 2.2, 0.1, M('#6b3e26')), 1.6, 1.1, -3.02));
  const sg = at(textPlane(name, 5.2, 1.0, { bg: '#ffffff', fg: '#1d3557', font: '900 92px Inter', radius: 16 }), 0, 3.85, -3.06);
  sg.rotation.y = Math.PI; g.add(sg);
  // striped awning that rolls open in beat 10
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const cg = c.getContext('2d');
  for (let s = 0; s < 8; s++) { cg.fillStyle = s % 2 ? stripe : (i % 2 ? '#ef476f' : '#118ab2'); cg.fillRect(s * 32, 0, 32, 64); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pivot = at(new THREE.Group(), 0, 3.2, -3.0);
  const aw = at(mesh(new THREE.BoxGeometry(6.2, 0.12, 2.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })), 0, 0, -1.0);
  pivot.add(aw); pivot.rotation.x = -0.35; g.add(pivot); awnings.push(pivot);
  scene.add(at(g, x, 0, 8)); shopDoors.push(new THREE.Vector3(x + 1.6, 0, 5));
});
onUpdate(t => {
  awnings.forEach((p, i) => {
    let k = 1;
    if (inBeat(t, 9)) k = easeOutBack((local(t, 9) - 0.2 - i * 0.12) / 0.6);
    p.scale.z = Math.max(0.05, k);
  });
});
// Bakery sign spinner (beat 10)
const spinner = at(textPlane('FRESH\nBREAD', 1.8, 1.8, { bg: '#ffd166', fg: '#6b3e26', font: '900 70px Inter', radius: 90, res: 1 }), -26.5, 5.6, 4.6);
scene.add(spinner);
onUpdate(t => { spinner.rotation.y = inBeat(t, 9) ? local(t, 9) * 5 : t * 0.6; });
// Shopping bags hopping out of doors (beat 10)
const bags = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  g.add(at(box(0.6, 0.7, 0.35, M(pick(['#ff006e', '#ffbe0b', '#3a86ff', '#06d6a0']))), 0, 0.35, 0));
  const hnd = at(mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 12, Math.PI), M('#333')), 0, 0.7, 0); g.add(hnd);
  scene.add(g); bags.push(g);
}
onUpdate(t => {
  bags.forEach((g, i) => {
    if (!inBeat(t, 9)) { g.visible = false; return; }
    const lt = local(t, 9) - 1.2 - i * 0.35; g.visible = lt > 0;
    const d = shopDoors[i]; const hop = (lt * 1.6) % 1;
    g.position.set(d.x + Math.sin(i) * 0.5, Math.sin(hop * Math.PI) * 1.4, d.z - 0.2 - lt * 1.6);
    g.rotation.y = lt * 2;
  });
});

// ---------- office & factory (beat 7) ----------
{
  const off = new THREE.Group();
  off.add(at(box(9, 12, 8, M('#9bf6ff')), 0, 6, 0));
  for (let y = 2; y < 12; y += 2.2) for (let x = -3; x <= 3; x += 2) off.add(at(box(1.2, 1.2, 0.1, M('#ffffff', { roughness: 0.2 })), x, y, 4.02));
  off.add(at(textPlane('OFFICE', 6, 1.2, { bg: '#3a86ff', fg: '#ffffff', font: '900 96px Inter', radius: 16 }), 0, 12.9, 3.0));
  scene.add(at(off, 33, 0, -10));
  const fac = new THREE.Group();
  fac.add(at(box(10, 6, 9, M('#ffd6a5')), 0, 3, 0));
  for (const x of [-3, 0, 3]) fac.add(at(mesh(new THREE.CylinderGeometry(0.6, 0.8, 5, 12), M('#e76f51')), x, 8.5, -2));
  fac.add(at(textPlane('FACTORY', 6.5, 1.2, { bg: '#e76f51', fg: '#ffffff', font: '900 96px Inter', radius: 16 }), 0, 6.8, 4.0));
  scene.add(at(fac, 46, 0, -10));
}
// commuters with lunchboxes + job badges
const commuters = [];
for (let i = 0; i < 16; i++) {
  const p = person({ lunch: true }); scene.add(p);
  const badge = sprite('JOB ✓', 1.6, 0.7, { bg: '#06d6a0', fg: '#ffffff', font: '900 96px Inter', radius: 60 });
  scene.add(badge);
  const dest = i % 2 ? 46 : 33, start = -2 - (i % 8) * 2.6 - Math.floor(i / 8) * 1.3, lane = -3.2 - (i % 3) * 0.35;
  commuters.push(p);
  onUpdate(t => {
    const vis = inBeat(t, 6); p.visible = vis; badge.visible = false;
    if (!vis) return;
    const lt = local(t, 6), sp = 6.5;
    let x = start + lt * sp, z = lane, enter = 0;
    if (x > dest) { enter = x - dest; x = dest; z = lane - enter; }
    p.position.set(x, 0.16, z);
    p.rotation.y = enter > 0 ? Math.PI : Math.PI / 2;
    walkPose(p, lt * 9 + i);
    p.visible = z > -5.6;
    const bt = 0.8 + (i % 8) * 0.25;
    if (lt > bt && p.visible) { badge.visible = true; const s = easeOutBack((lt - bt) / 0.3); badge.scale.set(1.6 * s, 0.7 * s, 1); badge.position.set(x, 2.1, z); }
  });
}

// ---------- construction site (beat 9) ----------
const site = new THREE.Group();
site.add(at(box(18, 0.12, 16, M('#c8a165')), 0, 0.06, 0));
const floors = [];
for (let f = 0; f < 6; f++) {
  const fl = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) fl.add(at(box(0.3, 2.6, 0.3, M('#ff9f1c')), sx * 3, 1.3, sz * 3));
  fl.add(at(box(6.6, 0.25, 6.6, M('#d9d9d9')), 0, 2.6, 0));
  fl.position.y = f * 2.6; site.add(fl); floors.push(fl);
}
const crane = new THREE.Group();
crane.add(at(box(1, 24, 1, M('#ffbe0b')), 0, 12, 0));
const jib = new THREE.Group(); jib.position.y = 24;
jib.add(at(box(20, 0.7, 0.7, M('#ffbe0b')), 6, 0, 0));
jib.add(at(box(2, 1.4, 1.4, M('#5c677d')), -4, 0, 0));
jib.add(at(box(1.6, 1.4, 1.4, M('#e63946')), 0, 1.0, 0));
const cable = at(box(0.06, 1, 0.06, M('#222')), 12, -0.5, 0); jib.add(cable);
const load = at(box(4, 0.4, 0.5, M('#e63946')), 12, -6, 0); jib.add(load);
crane.add(jib);
site.add(at(crane, 6, 0, 5));
const slowSign = new THREE.Group();
slowSign.add(at(box(0.2, 2.5, 0.2, M('#555')), 0, 1.25, 0));
const signFront = at(textPlane('FULL\nSPEED!', 3.2, 2.2, { bg: '#ef476f', fg: '#fff', font: '900 64px Inter', radius: 24 }), 0, 3.4, 0.01);
const signBack = at(textPlane('SLOW &\nSTEADY', 3.2, 2.2, { bg: '#06d6a0', fg: '#fff', font: '900 64px Inter', radius: 24 }), 0, 3.4, -0.01);
signBack.rotation.y = Math.PI; slowSign.add(signFront, signBack);
site.add(at(slowSign, -6, 0, 6));
for (const [x, z] of [[-7, -6], [-4, -6.5], [7, -5]]) site.add(at(mesh(new THREE.ConeGeometry(0.35, 0.9, 10), M('#fb5607')), x, 0.45, z));
scene.add(at(site, 34, 0, 20));
const siteWorkers = [person({ shirt: '#ffbe0b', hat: true }), person({ shirt: '#fb5607', hat: true })];
siteWorkers.forEach((p, i) => { site.add(p); p.position.set(-2 + i * 4, 0.16, 4.5); p.rotation.y = Math.PI; });
onUpdate(t => {
  const b = beatOf(t);
  const speed = b === 8 ? lerp(1.0, 0.45, ease(local(t, 8) / 2)) : 1.0;
  const ph = b < 8 ? t * 0.5 : b === 8 ? 8 * BEAT_LEN * 0.5 + local(t, 8) * 0.5 * speed : t * 0.25;
  jib.rotation.y = Math.sin(ph) * 0.9;
  const lift = (Math.sin(ph * 2) + 1) / 2;
  load.position.y = -10 + lift * 7; cable.scale.y = 10 - lift * 7 - 0.4; cable.position.y = -(10 - lift * 7) / 2;
  const built = b < 8 ? 3 : b === 8 ? 3 + ease(local(t, 8) / 4) * 2 : 5;
  floors.forEach((f, i) => { const k = clamp(built - i); f.visible = k > 0.01; f.scale.set(1, Math.max(0.01, easeOutBack(k)), 1); });
  slowSign.rotation.y = b === 8 ? Math.PI * ease((local(t, 8) - 2.0) / 0.5) : b > 8 ? Math.PI : 0;
  siteWorkers.forEach((p, i) => walkPose(p, t * 4 + i));
});

// ---------- floating money symbols over the banks ----------
const coinTex = textCanvas('$', { w: 128, h: 128, bg: '#ffd166', fg: '#b07d00', font: '900 96px Inter', radius: 64 });
const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24);
const coinMats = [M('#f4c430', { metalness: 0.4, roughness: 0.35 }), new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.3, roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: coinTex, metalness: 0.3, roughness: 0.4 })];
function coin() { const c = mesh(coinGeo, coinMats); c.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(c); scene.add(g); return g; }
for (let i = 0; i < 10; i++) {
  const c = coin(), bx = i < 5 ? -6 : 10, bz = i < 5 ? -6 : -10, ph = i * 1.3;
  onUpdate(t => {
    const k = (t * 0.25 + i * 0.2) % 1;
    c.position.set(bx + Math.sin(ph + t) * 3, (i < 5 ? 7 : 28) + k * 6, bz + Math.cos(ph) * 2);
    c.rotation.y = t * 3 + ph; c.scale.setScalar(Math.sin(k * Math.PI));
  });
}

// ---------- piggy banks ----------
function piggy(s = 1) {
  const g = new THREE.Group(), pink = M('#ff8fab', { roughness: 0.45 });
  const body = mesh(new THREE.SphereGeometry(0.6, 20, 16), pink); body.scale.set(1.25, 1, 1); g.add(at(body, 0, 0.75, 0));
  const snout = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.2, 16), M('#ff6f91')); snout.rotation.z = Math.PI / 2; g.add(at(snout, 0.8, 0.78, 0));
  for (const z of [-0.25, 0.25]) { const e = mesh(new THREE.ConeGeometry(0.14, 0.3, 8), pink); g.add(at(e, 0.35, 1.32, z)); }
  for (const [x, z] of [[-0.4, -0.3], [-0.4, 0.3], [0.4, -0.3], [0.4, 0.3]]) g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), pink), x, 0.15, z));
  g.add(at(box(0.36, 0.05, 0.08, M('#5a2a3a')), 0, 1.35, 0));
  for (const z of [-0.18, 0.18]) g.add(at(mesh(new THREE.SphereGeometry(0.05, 8, 6), M('#222')), 0.62, 0.98, z));
  g.scale.setScalar(s); scene.add(g); return g;
}
const porchPiggies = [];
[[-44, 9], [-52, 9], [-60, 9], [-44, -9], [-52, -9], [-68, 9]].forEach(([x, z], i) => {
  const p = piggy(1.1); const zz = z > 0 ? z - 3.0 : z + 3.0;
  p.position.set(x + 1.3, 0, zz); p.rotation.y = z > 0 ? Math.PI / 2 : -Math.PI / 2; porchPiggies.push(p);
  onUpdate(t => {
    let y = 0, sq = 1;
    if (inBeat(t, 7)) {
      const lt = local(t, 7), ph = (lt * 1.35 + i * 0.17) % 1;
      y = Math.sin(ph * Math.PI) * 1.4; sq = ph < 0.1 ? 1 - (0.1 - ph) * 2.5 : 1;
    } else y = Math.abs(Math.sin(t * 2 + i)) * 0.15;
    p.position.y = y + 0.16; p.scale.set(1.1 / Math.sqrt(sq), 1.1 * sq, 1.1 / Math.sqrt(sq));
  });
});
// Main Street piggies feeding coins to the bank (beat 6)
const streetPiggies = [-14, -10, -2, 2].map(x => { const p = piggy(0.9); p.position.set(x, 0.16, -3.2); p.rotation.y = -Math.PI / 2; return p; });
const flyCoins = Array.from({ length: 8 }, () => coin());
const envelopes = Array.from({ length: 6 }, () => {
  const e = new THREE.Group();
  e.add(box(0.9, 0.08, 0.6, M('#ffffff')));
  e.add(at(textPlane('LOAN', 0.8, 0.3, { bg: null, fg: '#e63946', font: '900 110px Inter' }), 0, 0.05, 0));
  e.children[1].rotation.x = -Math.PI / 2; scene.add(e); return e;
});
onUpdate(t => {
  const on = inBeat(t, 5);
  streetPiggies.forEach((p, i) => { p.visible = on || beatOf(t) < 5; p.position.y = 0.16 + (on ? Math.abs(Math.sin(local(t, 5) * 5 + i)) * 0.3 : 0); });
  flyCoins.forEach((c, i) => {
    if (!on) { c.visible = false; return; }
    const lt = local(t, 5) - 0.3 - i * 0.45; c.visible = lt > 0 && lt < 0.9;
    const k = clamp(lt / 0.9), from = streetPiggies[i % 4].position;
    c.position.set(lerp(from.x, -6, k), 1.2 + Math.sin(k * Math.PI) * 3.5, lerp(-3.2, -5, k)); c.rotation.y = lt * 8; c.scale.setScalar(0.8);
  });
  envelopes.forEach((e, i) => {
    if (!on) { e.visible = false; return; }
    const lt = local(t, 5) - 1.0 - i * 0.5; e.visible = lt > 0 && lt < 1.1;
    const k = clamp(lt / 1.1), to = shopDoors[i];
    e.position.set(lerp(-6, to.x, k), 1.5 + Math.sin(k * Math.PI) * 5, lerp(-4.6, to.z, k)); e.rotation.set(Math.sin(lt * 6) * 0.3, lt * 4, 0);
  });
});

// ---------- beat 2: mortgage spaghetti ----------
const spaghetti = [];
const clerks = [];
for (let i = 0; i < 6; i++) {
  const s = new THREE.Mesh(new THREE.BufferGeometry(), M('#ffd166', { roughness: 0.5 }));
  s.castShadow = true; scene.add(s); spaghetti.push(s);
  const c = person({ shirt: '#1d3557', hat: false }); scene.add(c); clerks.push(c);
}
const spagLabel = sprite('MORTGAGE SPAGHETTI', 6, 1, { bg: '#ffffff', fg: '#e63946', font: '900 90px Inter', radius: 50, w: 960 });
scene.add(spagLabel);
const tmpPts = [];
onUpdate(t => {
  const on = inBeat(t, 1);
  spagLabel.visible = on && local(t, 1) < 1.6; spagLabel.position.set(-6, 5.6, -1.5);
  spaghetti.forEach((s, i) => {
    s.visible = on; clerks[i].visible = on; if (!on) return;
    const lt = local(t, 1);
    const k = 1 - ease((lt - 1.0 - i * 0.5) / 0.45); // 1 = tangled, 0 = straight
    const ex = -6 + (i - 2.5) * 1.6, ez = 0.2;
    tmpPts.length = 0;
    for (let j = 0; j <= 10; j++) {
      const u = j / 10;
      const bx = lerp(-6 + (i - 2.5) * 0.25, ex, u), bz = lerp(-4.4, ez, u), by = 0.5 + Math.sin(u * Math.PI) * 0.3;
      const n = Math.sin(u * 19 + i * 2.1 + lt * 3) * 1.4, m = Math.cos(u * 23 + i * 1.3 + lt * 2.5) * 1.1;
      tmpPts.push(new THREE.Vector3(bx + n * k, by + Math.abs(m) * k * 0.9, bz + m * k * 0.8));
    }
    s.geometry.dispose();
    s.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tmpPts), 80, 0.12, 8, false);
    const c = clerks[i]; c.position.set(ex, 0.16, ez + 0.5 + (k < 0.5 ? 0.3 : 0)); c.rotation.y = Math.PI;
    c.rotation.x = k < 0.99 && k > 0.01 ? 0.25 : 0; // leaning back while pulling
  });
});

// ---------- beat 3: loan desk, calendar flip, stamps ----------
const desk = new THREE.Group();
desk.add(at(box(3.2, 1.0, 1.4, M('#c08552')), 0, 0.5, 0));
desk.add(at(textPlane('LOANS', 2.4, 0.6, { bg: '#1d3557', fg: '#ffffff', font: '900 100px Inter', radius: 16 }), 0, 0.55, 0.72));
const folders = [];
for (let i = 0; i < 4; i++) {
  const f = at(box(0.8, 0.08, 0.6, M(['#ffbe0b', '#3a86ff', '#ff006e', '#06d6a0'][i])), -1.1 + i * 0.73, 1.05, 0.1); desk.add(f); folders.push(f);
}
const stamps = folders.map(f => { const s = sprite('✓', 0.7, 0.7, { bg: '#06d6a0', fg: '#fff', font: '900 120px Inter', radius: 80 }); desk.add(s); return s; });
const repayTag = sprite('CAN YOU REPAY?', 3.2, 0.7, { bg: '#ffffff', fg: '#1d3557', font: '900 90px Inter', radius: 50, w: 900 });
desk.add(at(repayTag, 0, 2.9, 0));
const clerk = person({ shirt: '#06d6a0' }); desk.add(at(clerk, 0, 0, -1.1));
const customer = person({ shirt: '#ff006e', hat: true }); desk.add(at(customer, 1.3, 0, 1.6)); customer.rotation.y = Math.PI;
scene.add(at(desk, -16.5, 0, -4.3));
const calBoard = new THREE.Group();
calBoard.add(at(box(0.15, 3, 0.15, M('#555')), 0, 1.5, 0));
const calPages = ['2008', '2007', '2006', '2005'].map((y, i) => {
  const p = new THREE.Group();
  const pl = textPlane('YEAR\n' + y, 2.0, 2.0, { bg: '#ffffff', fg: i === 3 ? '#06a77d' : '#e63946', font: '900 120px Inter', radius: 20, border: '#1d3557', w: 512, h: 512, pad: 8 });
  pl.position.y = -1.0; p.add(pl); p.position.set(0, 4.2, 0.1 + (3 - i) * 0.01); calBoard.add(p); return p;
});
scene.add(at(calBoard, -19.5, 0, -4.0));
onUpdate(t => {
  const b = beatOf(t), lt = local(t, 2);
  desk.visible = b <= 2 || b >= 5; calBoard.visible = b === 2;
  calPages.forEach((p, i) => {
    const flipAt = 0.3 + i * 0.5; // pages 0..2 flip away
    p.rotation.x = b === 2 && i < 3 ? -Math.PI * 0.95 * ease((lt - flipAt) / 0.35) : 0;
    p.visible = b === 2 && (i === 3 || lt < flipAt + 0.4);
  });
  stamps.forEach((s, i) => {
    const st = 2.0 + i * 0.5;
    s.visible = b === 2 ? lt > st : b > 2;
    const k = b === 2 ? easeOutBack((lt - st) / 0.25) : 1;
    s.scale.set(0.7 * k, 0.7 * k, 1); s.position.set(folders[i].position.x, 1.5, 0.1);
  });
  repayTag.visible = b === 2; repayTag.scale.set(2.6 * (1 + 0.04 * Math.sin(lt * 8)), 0.56, 1);
  clerk.rotation.y = 0; customer.visible = b === 2;
});

// ---------- price tags (beats 4 and 11) ----------
function priceTag(text, color) {
  const g = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(-1.6, -1); sh.lineTo(1.0, -1); sh.lineTo(1.8, 0); sh.lineTo(1.0, 1); sh.lineTo(-1.6, 1); sh.lineTo(-1.6, -1);
  const hole = new THREE.Path(); hole.absarc(1.15, 0, 0.18, 0, Math.PI * 2, true); sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  g.add(mesh(geo, M(color, { roughness: 0.5 })));
  const label = at(textPlane(text, 2.4, 1.3, { bg: null, fg: '#1d3557', font: '900 120px Inter' }), -0.3, 0, 0.32);
  g.add(label);
  scene.add(g); return g;
}
const tag4 = priceTag('$$$', '#ffd166');
const line4 = new THREE.Group(); // gentle "price line" billboard
{
  line4.add(at(box(0.2, 3, 0.2, M('#555')), 0, 1.5, 0));
  const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(0, 0, 512, 320, 30); g.fill();
  g.fillStyle = '#1d3557'; g.font = '900 40px Inter'; g.textAlign = 'center'; g.fillText('HOME PRICES (WHAT IF)', 256, 52);
  g.lineWidth = 8; g.setLineDash([18, 14]); g.strokeStyle = '#e63946'; g.beginPath(); g.moveTo(40, 250); g.lineTo(240, 90); g.lineTo(280, 290); g.stroke();
  g.setLineDash([]); g.lineWidth = 14; g.strokeStyle = '#06a77d'; g.beginPath(); g.moveTo(40, 250); g.lineTo(240, 90); g.quadraticCurveTo(360, 110, 480, 140); g.stroke();
  g.fillStyle = '#e63946'; g.font = '800 26px Inter'; g.fillText('crash', 330, 290); g.fillStyle = '#06a77d'; g.fillText('gentle cool-down', 380, 185);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  line4.add(at(new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })), 0, 4.2, 0.12));
}
scene.add(at(line4, -39.5, 0, 6.5)); line4.rotation.y = Math.PI * 0.85;
const tag11 = priceTag('STILL\n$$$', '#ff5d8f');
const tag11Label = sprite('NO CRASH ≠ CHEAP HOMES', 6.5, 1.0, { bg: '#1d3557', fg: '#ffd166', font: '900 80px Inter', radius: 50, w: 1100 });
scene.add(tag11Label);
onUpdate(t => {
  const b = beatOf(t);
  const hx = hero.position.x, hz = hero.position.z;
  // beat 4: tag deflates gently like a balloon
  tag4.visible = b === 3; line4.visible = b === 3;
  if (b === 3) {
    const lt = local(t, 3), d = ease((lt - 0.4) / 3.0), wob = Math.sin(lt * 7) * 0.05 * (1 - d);
    const s = lerp(1.6, 0.95, d) + wob; tag4.scale.set(s, s, s);
    tag4.position.set(hx, 8.4 - d * 0.6 + Math.sin(lt * 2) * 0.2, hz); tag4.rotation.set(0, Math.PI + 0.3 * Math.sin(lt), Math.sin(lt * 3) * 0.08);
  }
  // beat 11: giant tag drops and squashes the roof, which springs back
  const roof = hero.userData.roof;
  tag11.visible = b === 10; tag11Label.visible = false; // shown as an overlay sticker instead
  if (b === 10) {
    const lt = local(t, 10), fall = easeOutBounce((lt - 0.6) / 0.8);
    tag11.scale.setScalar(1.5);
    tag11.position.set(hx - 0.3, lerp(26, 6.9, fall), hz + 0.4); tag11.rotation.set(-0.25, Math.PI + 0.2, 0.1);
    const hit = lt - 1.25; const squash = hit > 0 ? 1 - 0.4 * Math.exp(-hit * 4) * Math.cos(hit * 14) : 1;
    roof.scale.set(1, clamp(squash, 0.5, 1.3), 0.82);
    tag11Label.position.set(hx, 10.4, hz - 1); tag11Label.scale.set(6.5 * easeOutBack((lt - 1.6) / 0.3), 1.0, 1);
  } else roof.scale.set(1, 1, 0.82);
});

// ---------- beat 1: the economic path that bends ----------
const pathGroup = new THREE.Group(); scene.add(pathGroup);
const crashPts = u => new THREE.Vector3(lerp(-15, 15, u), u < 0.62 ? 16 + u * 14 : u < 0.72 ? 24.7 - (u - 0.62) * 140 : 10.7 - (u - 0.72) * 4, 0);
const gentlePts = u => new THREE.Vector3(lerp(-15, 15, u), u < 0.62 ? 16 + u * 14 : 24.7 + Math.sin((u - 0.62) * 4) * 1.4 - (u - 0.62) * 3, 0);
const pathMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#e63946', emissive: '#e63946', emissiveIntensity: 0.5 }));
const ghostMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#e63946', transparent: true, opacity: 0.45 }));
pathGroup.add(pathMesh, ghostMesh);
const pathBoard = at(box(36, 20, 0.6, M('#fff8e7')), 0, 20, -1.2); pathGroup.add(pathBoard);
pathGroup.add(at(box(37.2, 21.2, 0.4, M('#1d3557')), 0, 20, -1.6));
for (const x of [-12, 12]) pathGroup.add(at(box(0.8, 10, 0.8, M('#8d99ae')), x, 5, -1.6));
pathGroup.add(at(textPlane('THE ECONOMY’S PATH', 14, 1.6, { bg: '#1d3557', fg: '#ffffff', font: '900 92px Inter', radius: 30 }), 0, 28.6, -0.8));
const lblCrash = sprite('2008 CRASH', 6.5, 1.3, { bg: '#e63946', fg: '#ffffff', font: '900 96px Inter', radius: 50 });
const lblWhatIf = sprite('WHAT IF ROUTE', 7.2, 1.3, { bg: '#19c3b1', fg: '#00332e', font: '900 96px Inter', radius: 50, w: 900 });
const runner = coin(); // a coin rides the path
pathGroup.add(lblCrash, lblWhatIf);
pathGroup.position.set(-4, 4, -34);
function tubeAlong(fn, u1, morph, u0 = 0) {
  const pts = [];
  for (let j = 0; j <= 60; j++) { const u = u0 + (j / 60) * (u1 - u0); pts.push(morph == null ? fn(u) : crashPts(u).lerp(gentlePts(u), morph)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.45, 10, false);
}
onUpdate(t => {
  const on = beatOf(t) === 0; pathGroup.visible = on; runner.visible = on; if (!on) return;
  const grow = lerp(0.5, 1.0, ease(t / 1.2));          // the line is already heading for the cliff at frame 1
  const morph = ease((t - 1.1) / 1.3);                   // fully bent by ~2.4 s
  pathMesh.geometry.dispose(); pathMesh.geometry = tubeAlong(null, grow, morph);
  const col = new THREE.Color('#e63946').lerp(new THREE.Color('#06d6a0'), morph);
  pathMesh.material.color.copy(col); pathMesh.material.emissive.copy(col);
  ghostMesh.visible = morph > 0.05;
  if (ghostMesh.visible) { ghostMesh.geometry.dispose(); ghostMesh.geometry = tubeAlong(crashPts, 1.0, null, 0.63); ghostMesh.scale.setScalar(1); }
  lblCrash.position.copy(crashPts(0.8)).add(new THREE.Vector3(2.5, -1.5, 1)); lblCrash.material.opacity = 1 - morph * 0.35;
  lblWhatIf.visible = morph > 0.5; lblWhatIf.position.copy(gentlePts(0.88)).add(new THREE.Vector3(-1, 2.6, 1));
  const ws = easeOutBack((morph - 0.5) / 0.4); lblWhatIf.scale.set(7.2 * ws, 1.3 * ws, 1);
  const u = Math.min(grow, 0.98); const p = crashPts(u).lerp(gentlePts(u), morph);
  runner.position.copy(p).add(pathGroup.position).add(new THREE.Vector3(0, 1.1, 0.6)); runner.rotation.y = t * 6; runner.scale.setScalar(2);
});

// ---------- beat 12: interest-rate rollercoaster ----------
const coaster = new THREE.Group(); scene.add(coaster);
const realRate = u => new THREE.Vector3(lerp(-26, 26, u), u < 0.25 ? 22 : u < 0.4 ? 22 - (u - 0.25) / 0.15 * 18 : 4 + Math.max(0, u - 0.85) * 10, 0);
const whatRate = u => new THREE.Vector3(lerp(-26, 26, u), u < 0.25 ? 22 : 22 - Math.sin(clamp((u - 0.25) / 0.75) * Math.PI) * 5 - (u - 0.25) * 2, 0);
const realTrack = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffc93c', transparent: true, opacity: 0.6 }));
const whatTrack = new THREE.Mesh(new THREE.BufferGeometry(), M('#19c3b1', { emissive: '#0d7d72', emissiveIntensity: 0.4 }));
coaster.add(realTrack, whatTrack);
for (let i = 0; i <= 12; i++) { const x = lerp(-26, 26, i / 12); coaster.add(at(box(0.3, 1, 0.3, M('#8d99ae')), x, 0, -0.6)); }
const supports = coaster.children.slice(2);
const cart = new THREE.Group();
cart.add(at(box(2.2, 1, 1.4, M('#ff006e')), 0, 0.7, 0));
const rider1 = person({ shirt: '#ffbe0b' }), rider2 = person({ shirt: '#3a86ff' });
cart.add(at(rider1, -0.5, 0.5, 0), at(rider2, 0.5, 0.5, 0)); coaster.add(cart);
const lblReal = sprite('REAL: rates near 0%', 7.5, 1.2, { bg: '#ffc93c', fg: '#3a2a00', font: '900 80px Inter', radius: 50, w: 1000 });
const lblWhat = sprite('WHAT IF: stays higher', 7.5, 1.2, { bg: '#19c3b1', fg: '#00332e', font: '900 80px Inter', radius: 50, w: 1000 });
coaster.add(lblReal, lblWhat);
coaster.position.set(0, 0, -30);
onUpdate(t => {
  const on = beatOf(t) === 11; coaster.visible = on; if (!on) return;
  const lt = local(t, 11), m = ease((lt - 0.2) / 1.6);
  const rt = []; const wt = [];
  for (let j = 0; j <= 80; j++) { const u = j / 80; rt.push(realRate(u)); wt.push(realRate(u).lerp(whatRate(u), m)); }
  realTrack.geometry.dispose(); realTrack.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rt), 200, 0.25, 8, false);
  whatTrack.geometry.dispose(); whatTrack.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wt), 200, 0.4, 8, false);
  supports.forEach((s, i) => { const y = realRate(i / 12).lerp(whatRate(i / 12), m).y; s.scale.y = y; s.position.y = y / 2; });
  const u = clamp(lt / 4.4) * 0.95; const p = realRate(u).lerp(whatRate(u), m), p2 = realRate(u + 0.01).lerp(whatRate(u + 0.01), m);
  cart.position.copy(p).add(new THREE.Vector3(0, 0.2, 0)); cart.rotation.z = Math.atan2(p2.y - p.y, p2.x - p.x);
  const cx = cart.position.x * 0.6, cu = clamp((cx + 26) / 52);
  lblReal.position.set(cx, 9, 0.5);
  lblWhat.position.set(cx, realRate(cu).lerp(whatRate(cu), m).y + 3.4, 0.5);
  lblWhat.visible = m > 0.4;
});

// ---------- clouds (always) and "?" clouds (beat 13) ----------
function cloud(s, color = '#ffffff') {
  const g = new THREE.Group(), mat = M(color, { roughness: 1 });
  for (const [x, y, r] of [[0, 0, 1.6], [1.6, -0.2, 1.2], [-1.6, -0.3, 1.1], [0.7, 0.8, 1.1], [-0.6, 0.7, 1.0]]) g.add(at(mesh(new THREE.SphereGeometry(r, 14, 12), mat, { cast: false }), x, y, 0));
  g.scale.setScalar(s); scene.add(g); return g;
}
for (let i = 0; i < 9; i++) {
  const c = cloud(1.4 + rng() * 1.4), z = -70 + rng() * 60, y = 34 + rng() * 14, x0 = rng() * 200;
  onUpdate(t => c.position.set(wrap(x0 + t * 1.2, -100, 100), y, z));
}
const qClouds = [];
for (let i = 0; i < 4; i++) {
  const c = cloud(1.6, '#d9d4f0'); const q = sprite('?', 2.2, 2.2, { bg: '#7b6cf6', fg: '#ffffff', font: '900 120px Inter', radius: 80, w: 160 });
  c.add(at(q, 0, 0.3, 2.0)); q.scale.set(1.4, 1.4, 1); qClouds.push(c);
}
onUpdate(t => {
  const on = beatOf(t) === 12;
  qClouds.forEach((c, i) => {
    c.visible = on; if (!on) return;
    const lt = local(t, 12);
    c.position.set(-30 + i * 18 + lt * 2.2, 16 + (i % 2) * 5 + Math.sin(lt * 1.5 + i) * 0.6, -14 + (i % 2) * 8);
  });
  // porch lights glow on
  const glow = on ? clamp(local(t, 12) / 1.0) : 0;
  houses.forEach(h => h.children.forEach(ch => { if (ch.material && ch.material.color && ch.material.emissive && ch.material.color.getHexString() === 'cfefff') ch.material.emissive.set(glow > 0 ? '#ffcf5c' : '#000000'); }));
});
// families walking to work in beat 13
const families = [];
for (let f = 0; f < 4; f++) for (let k = 0; k < 3; k++) {
  const p = person({ shirt: pick(SHIRTS) }); const s = k === 2 ? 0.65 : 1; p.scale.setScalar(s); scene.add(p); families.push(p);
  onUpdate(t => {
    const on = beatOf(t) === 12; p.visible = on; if (!on) return;
    const lt = local(t, 12); p.position.set(-34 + f * 9 + lt * 1.8 + k * 0.7, 0.16, f % 2 ? 3.6 + k * 0.3 : -3.4 - k * 0.2);
    p.rotation.y = Math.PI / 2; walkPose(p, lt * 8 + k);
  });
}

// ---------- end card set: a fork in the road ----------
const endSet = new THREE.Group(); scene.add(endSet);
{
  const roadM = M('#4a4f63');
  endSet.add(at(box(6, 0.12, 30, roadM), 0, 0.06, 15));
  const left = at(box(6, 0.12, 34, roadM), -8, 0.06, -12); left.rotation.y = -0.5; endSet.add(left);
  const right = at(box(6, 0.12, 34, roadM), 8, 0.06, -12); right.rotation.y = 0.5; endSet.add(right);
  const glowL = at(box(0.5, 0.2, 34, M('#c9a2ff', { emissive: '#9b5de5', emissiveIntensity: 1.2 })), -8, 0.14, -12); glowL.rotation.y = -0.5; endSet.add(glowL);
  const glowR = at(box(0.5, 0.2, 34, M('#ffb15c', { emissive: '#ff8800', emissiveIntensity: 1.2 })), 8, 0.14, -12); glowR.rotation.y = 0.5; endSet.add(glowR);
  function arch(x, z, rot, label, color) {
    const a = new THREE.Group();
    a.add(at(box(0.5, 7, 0.5, M(color)), -3.4, 3.5, 0), at(box(0.5, 7, 0.5, M(color)), 3.4, 3.5, 0));
    a.add(at(textPlane(label, 7.4, 2.2, { bg: color, fg: '#1d1240', font: '900 130px Inter', radius: 30 }), 0, 7.6, 0.3));
    a.rotation.y = rot; endSet.add(at(a, x, 0, z)); return a;
  }
  endSet.userData.arches = [arch(-8.5, -14, -0.5, '2000', '#c9a2ff'), arch(8.5, -14, 0.5, '2020', '#ffb15c')];
  const mini = [[0, -6], [-2.6, -12], [2.6, -12], [0, -18]];
  mini.forEach(([x, z], i) => {
    const h = new THREE.Group(); h.add(at(box(2.2, 1.6, 2, M(HOUSE[i])), 0, 0.8, 0));
    const r = at(mesh(new THREE.ConeGeometry(1.8, 1.2, 4), M(ROOF[i])), 0, 2.2, 0); r.rotation.y = Math.PI / 4; h.add(r);
    endSet.add(at(h, x, 0, z));
  });
  endSet.add(at(piggy(1.2), 0, 0.1, 4));
}
endSet.position.set(0, 0, 150);
onUpdate(t => {
  const on = beatOf(t) === 13; endSet.visible = on; if (!on) return;
  const lt = t - 13 * BEAT_LEN;
  endSet.userData.arches.forEach((a, i) => { const s = easeOutBack((lt - 0.1 - i * 0.2) / 0.4); a.scale.set(1, Math.max(0.01, s), 1); });
});

// ---------- cameras: one new angle per beat ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const HX = hero.position.x, HZ = hero.position.z;
const SHOTS = [
  { p0: V(-10, 30, 62), p1: V(-8, 27, 52), t0: V(-4, 20, -30), t1: V(-4, 20, -30) },              // 1 wide push-in
  { p0: V(-3.0, 9.0, 4.6), p1: V(-9.0, 9.4, 4.6), t0: V(-6, 0.6, -1.8), t1: V(-6, 0.8, -1.8) },    // 2 low angle bank steps
  { p0: V(-11.5, 6.2, 4.6), p1: V(-12.5, 6.0, 4.4), t0: V(-17.4, 2.4, -4.3), t1: V(-17.6, 2.4, -4.3) }, // 3 over-the-shoulder
  { orbit: { c: V(HX, 6, HZ), r: 19, h: 9.5, a0: -2.0, a1: -1.2 } },                             // 4 orbit house (street side)
  { p0: V(46, 4, 7), p1: V(44, 6, 7), t0: V(10, 10, -12), t1: V(10, 14, -12) },           // 5 tilt up tower
  { p0: V(-46, 5.5, 2.0), p1: V(-26, 5.5, 2.0), t0: V(-24, 2.5, -6), t1: V(-4, 2.5, -6) },        // 6 tracking Main St
  { p0: V(-10, 25, -1.0), p1: V(16, 25, -1.0), t0: V(-2, 0, -3.8), t1: V(24, 0, -3.8), up: V(1, 0, 0) }, // 7 top-down map
  { p0: V(-43.5, 4.0, -2.8), p1: V(-46.5, 3.8, -2.8), t0: V(-51, 1.4, 6), t1: V(-55, 1.4, 6) },    // 8 porch close-up
  { p0: V(20, 30, 46), p1: V(23, 27, 46), t0: V(34, 6, 20), t1: V(34, 8, 20) },                    // 9 crane's-eye
  { p0: V(-40, 3.0, -2.0), p1: V(-24, 3.0, -2.0), t0: V(-24, 2.6, 6), t1: V(-8, 2.6, 6) },        // 10 street dolly
  { snap: true, p0: V(HX + 14, 24, HZ - 34), p1: V(HX + 7, 10, HZ - 19), t0: V(HX, 6, HZ), t1: V(HX, 8.5, HZ) }, // 11 snap zoom
  { follow: true },                                                                                 // 12 side-on coaster
  { p0: V(-10, 6, 18), p1: V(0, 70, 105), t0: V(-8, 4, 0), t1: V(0, 4, -6) },                     // 13 pull back
  { p0: V(0, 15, 190), p1: V(0, 15, 190), t0: V(0, 4, 140), t1: V(0, 4, 140) },                   // end card
];
function placeCamera(t) {
  const b = beatOf(t), lt = b < 13 ? local(t, b) : t - 13 * BEAT_LEN, len = b < 13 ? BEAT_LEN : 4, k = ease(lt / len);
  const s = SHOTS[b];
  camera.up.set(0, 1, 0);
  if (s.orbit) {
    const a = lerp(s.orbit.a0, s.orbit.a1, k);
    camera.position.set(s.orbit.c.x + Math.cos(a) * s.orbit.r, s.orbit.h, s.orbit.c.z + Math.sin(a) * s.orbit.r);
    camera.lookAt(s.orbit.c); return;
  }
  if (s.follow) {
    const cx = cart.position.x;
    camera.position.set(cx * 0.6 + 2, 17, 6); camera.lookAt(cx * 0.6, 15, -30); return;
  }
  const kk = s.snap ? easeOutBack(lt / 0.7) : k;
  camera.position.lerpVectors(s.p0, s.p1, kk);
  if (s.up) camera.up.copy(s.up);
  camera.lookAt(new THREE.Vector3().lerpVectors(s.t0, s.t1, s.snap ? k : k));
}

// ---------- overlay ----------
const $ = id => document.getElementById(id);
function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }
function updateOverlay(t) {
  const b = beatOf(t);
  const isEnd = b === 13;
  $('stats').classList.toggle('hidden', isEnd); $('badge').classList.toggle('hidden', isEnd);
  $('caption').classList.toggle('hidden', isEnd); $('end').classList.toggle('hidden', !isEnd);
  if (isEnd) {
    const lt = t - 13 * BEAT_LEN;
    $('endQ').innerHTML = 'No <span class="a">dot-com crash</span>—or no <span class="b">2020 crash</span> next?';
    setText($('endCta'), END.cta); setText($('endSrc'), END.sources);
    $('end').style.transform = `scale(${easeOutBack(lt / 0.45)})`;
    $('takeaway').classList.add('hidden'); $('sticker').classList.add('hidden');
    return;
  }
  const beat = BEATS[b], lt = local(t, b);
  setText($('statReal'), beat.real); setText($('statWhatIf'), beat.whatif);
  setText($('capText'), beat.cap); setText($('capSrc'), 'Source: ' + beat.src);
  $('twist').classList.toggle('hidden', !beat.twist);
  const pop = b === 0 ? 1 : easeOutBack(lt / 0.35);
  $('caption').style.transform = `scale(${0.85 + 0.15 * pop})`; $('caption').style.opacity = String(clamp(b === 0 ? 1 : lt / 0.15));
  $('stats').style.transform = `scale(${b === 0 ? 1 : 0.8 + 0.2 * easeOutBack((lt - 0.1) / 0.35)})`;
  const st = $('sticker');
  if (b === 10 && lt > 1.5) { st.classList.remove('hidden'); st.style.transform = `rotate(-4deg) scale(${easeOutBack((lt - 1.5) / 0.35)})`; }
  else st.classList.add('hidden');
  const tk = $('takeaway');
  if (beat.takeaway && lt > 1.0) { tk.classList.remove('hidden'); setText(tk, beat.takeaway); tk.style.transform = `scale(${easeOutBack((lt - 1.0) / 0.4)})`; }
  else tk.classList.add('hidden');
}

// ---------- public API for the recorder ----------
function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-6);
  for (const fn of updaters) fn(t);
  placeCamera(t);
  for (const [o, d] of blockers) {
    if (o.userData.isTree) o.visible = true;
    if (o.visible && new THREE.Vector3(o.position.x, camera.position.y, o.position.z).distanceTo(camera.position) < d) o.visible = false;
  }
  // cars stay off the stretch of Main Street where beats 2-3 happen on the road
  if (beatOf(t) === 1 || beatOf(t) === 2) for (const [o] of blockers) if (o.position.y < 0.2 && o.position.x > -24 && o.position.x < 4 && Math.abs(o.position.z) < 2) o.visible = false;
  updateOverlay(t);
  renderer.render(scene, camera);
}
window.renderAt = renderAt;
window.TOTAL = TOTAL;
document.fonts.load('900 40px Inter').then(() => { renderAt(0); window.sceneReady = true; });
