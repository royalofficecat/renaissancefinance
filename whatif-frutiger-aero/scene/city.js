// "What if the world went full Frutiger Aero?" — a glossy glass-and-grass city on the shared toolkit.
// Everything is a pure function of time t (seconds), so any frame can be rendered on its own.
import {
  THREE, clamp, lerp, ease, easeOutBack, easeOutBounce, wrap, rng, beatOf, local, inBeat, cyc, at, V,
  scene, camera, renderer, M, mesh, box, textPlane, sprite, SHIRTS, CARS, SKINS,
  updaters, blockers, onUpdate, tree, person, walkPose, hopPose, car, cloud,
  lookTarget, setShots, setOverlay, setExtraHide, $, setText, start,
} from './kit.js';
import { BEATS, END, BEAT_LEN } from './beats.js';

// ---------- the Frutiger Aero palette ----------
const SKY = '#4fb3ff', AQUA = '#39d0e0', LIME = '#9be838', GRASS = '#7fd82f', WHITE = '#f6fcff', ORANGE = '#ff9a2e', GLASS = '#8fd8ff', DEEP = '#1468c9', KOI = '#ff7a1f';
const GREY = '#9aa3ad', GREYDARK = '#6c757d', GREYGRASS = '#a8b0a0';

// ---------- gloss sweep: every themed surface starts grey and turns glossy in beat 1 ----------
// A themed mesh keeps its own material so it can blend from the grey "before" to the glossy "after".
const themed = [];
let glossOverride = null; // set during the beat-12 flicker
function theme(m, color, { rough = 0.18, grey = GREY, clearcoat = 1, emissive = null, opacity = 1, metal = 0 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color: grey, roughness: 0.85, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.15, transparent: opacity < 1, opacity: 1 });
  m.material = mat;
  m.userData.theme = { from: new THREE.Color(grey), to: new THREE.Color(color), rough, clearcoat, emissive: emissive ? new THREE.Color(emissive) : null, opacity, metal };
  themed.push(m); return m;
}
function sweepK(t, x) { // the wave of gloss runs west to east and is complete by 2.5 s
  if (beatOf(t) > 0) return glossOverride ?? 1;
  return ease((t * 1.15 - (x + 70) / 150 * 1.6 - 0.1) / 0.5);
}
onUpdate(t => {
  const p = new THREE.Vector3();
  for (const m of themed) {
    const th = m.userData.theme; m.getWorldPosition(p); const k = sweepK(t, p.x);
    m.material.color.copy(th.from).lerp(th.to, k);
    m.material.roughness = lerp(0.85, th.rough, k); m.material.clearcoat = th.clearcoat * k; m.material.metalness = th.metal * k;
    m.material.opacity = lerp(1, th.opacity, k); m.material.transparent = th.opacity < 1 && k > 0.01;
    if (th.emissive) m.material.emissive.copy(th.emissive).multiplyScalar(k * 0.5);
  }
});
const glossBox = (w, h, d, color, opts) => theme(box(w, h, d, M(GREY)), color, opts);

// ---------- ground: grass strips (so the sweep crosses them), roads, water channel ----------
{
  for (let x = -100; x < 100; x += 10) { const g = mesh(new THREE.BoxGeometry(10, 0.2, 320), M(GREY), { cast: false }); theme(g, GRASS, { rough: 0.6, grey: GREYGRASS, clearcoat: 0.3 }); scene.add(at(g, x + 5, -0.1, 0)); }
  const far = mesh(new THREE.PlaneGeometry(800, 800), M('#7fd82f'), { cast: false }); far.rotation.x = -Math.PI / 2; scene.add(at(far, 0, -0.2, 0)); theme(far, GRASS, { rough: 0.7, grey: GREYGRASS, clearcoat: 0 });
  const road = M('#56607a'), walk = M('#e9f3f8'), line = M('#ffffff');
  const addRoad = (x, z, w, d) => { const r = box(w, 0.1, d, road); r.castShadow = false; scene.add(at(r, x, 0.05, z)); };
  addRoad(0, 0, 200, 6); addRoad(-36, 0, 6, 120); addRoad(24, 0, 6, 120);
  for (const z of [-3.7, 3.9]) { const s = box(200, 0.16, z > 0 ? 1.8 : 1.4, walk); s.castShadow = false; scene.add(at(s, 0, 0.08, z)); }
  for (let x = -98; x < 100; x += 4) { if (Math.abs(x + 36) < 5 || Math.abs(x - 24) < 5) continue; const l = box(2, 0.12, 0.25, line); l.castShadow = false; scene.add(at(l, x, 0.06, 0)); }
  for (const cx of [-36, 24]) for (let z = -58; z < 60; z += 4) { if (Math.abs(z) < 5) continue; const l = box(0.25, 0.12, 2, line); l.castShadow = false; scene.add(at(l, cx, 0.06, z)); }
  for (const cx of [-36, 24]) for (const side of [-1, 1]) for (let k = -2; k <= 2; k++) { const zb = box(2.4, 0.13, 0.7, M('#ffffff')); zb.castShadow = false; scene.add(at(zb, cx + side * 4.6, 0.07, k * 1.15)); }
  // horizon hills
  [[-150, -170, 60], [60, -200, 80], [160, -140, 70], [200, 40, 60], [-200, 60, 60], [-120, 150, 70], [40, 240, 90]]
    .forEach(([x, z, r]) => { const h = mesh(new THREE.SphereGeometry(r, 32, 16), M(GREY), { cast: false }); h.scale.y = 0.32; theme(h, '#8fdc3a', { rough: 0.7, grey: GREYGRASS, clearcoat: 0 }); scene.add(at(h, x, -4, z)); });
}
// a winding water channel behind the south row, plus the plaza pond
const waterMat = new THREE.MeshPhysicalMaterial({ color: '#58c8f5', roughness: 0.06, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.85 });
const channel = (() => {
  const pts = []; for (let x = -100; x <= 100; x += 8) pts.push(V(x, 0.05, 16 + Math.sin(x * 0.12) * 3));
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 1.6, 10, false), waterMat); m.scale.y = 0.12; m.receiveShadow = true; scene.add(m);
  const bed = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 1.9, 10, false), M('#c7e9f5')); bed.scale.y = 0.08; bed.position.y = -0.02; scene.add(bed); return m;
})();
const pond = new THREE.Group(); scene.add(at(pond, 52, 0, 8));
{ const w = mesh(new THREE.CircleGeometry(9, 48), waterMat, { cast: false }); w.rotation.x = -Math.PI / 2; pond.add(at(w, 0, 0.09, 0)); const rim = mesh(new THREE.TorusGeometry(9.2, 0.5, 10, 48), M(WHITE)); rim.rotation.x = Math.PI / 2; pond.add(at(rim, 0, 0.1, 0)); }
const plaza = mesh(new THREE.CircleGeometry(20, 56), M('#eef6fa'), { cast: false }); plaza.rotation.x = -Math.PI / 2; scene.add(at(plaza, 52, 0.04, 0));

// ---------- koi ----------
const koiList = [];
function koi(len = 1.2) {
  const g = new THREE.Group(), col = cyc([KOI, '#ffffff', '#ff4f1f', '#ffc46b'], koiList.length);
  const body = mesh(new THREE.SphereGeometry(0.3 * len, 14, 10), M(col, { roughness: 0.4 })); body.scale.set(1.6, 0.6, 0.8); g.add(body);
  if (koiList.length % 2) { const spot = mesh(new THREE.SphereGeometry(0.16 * len, 10, 8), M(KOI)); spot.scale.set(1.2, 0.5, 0.8); g.add(at(spot, 0.1 * len, 0.1, 0.1)); }
  const tail = mesh(new THREE.ConeGeometry(0.22 * len, 0.5 * len, 8), M(col, { roughness: 0.4 })); tail.rotation.z = Math.PI / 2; tail.scale.y = 0.5; g.add(at(tail, -0.6 * len, 0, 0));
  g.userData.tail = tail; scene.add(g); koiList.push(g); return g;
}
for (let i = 0; i < 8; i++) { const k = koi(1.1); const ph = i * 0.8, r = 3 + (i % 3) * 1.6; onUpdate(t => { const a = t * 0.5 + ph; k.position.set(52 + Math.cos(a) * r, 0.1, 8 + Math.sin(a) * r * 0.8); k.rotation.y = -a + Math.PI / 2; k.userData.tail.rotation.y = Math.sin(t * 8 + ph) * 0.5; k.visible = beatOf(t) > 0; }); }
for (let i = 0; i < 10; i++) { const k = koi(0.9); const x0 = -90 + i * 19, sp = 1.2 + (i % 3) * 0.3; onUpdate(t => { const x = wrap(x0 + t * sp, -98, 98); k.position.set(x, 0.1, 16 + Math.sin(x * 0.12) * 3 + Math.sin(t + i) * 0.4); k.rotation.y = 0; k.userData.tail.rotation.y = Math.sin(t * 8 + i) * 0.5; k.visible = beatOf(t) > 0; }); }

// ---------- glass towers (north row) with window grids and rooftop gardens ----------
const towers = [];
function tower(x, w, h, d, tint, i) {
  const g = new THREE.Group();
  const body = glossBox(w, h, d, tint, { rough: 0.08, opacity: 0.9, clearcoat: 1 }); g.add(at(body, 0, h / 2, 0));
  const cap = glossBox(w + 0.6, 0.5, d + 0.6, WHITE, { rough: 0.12 }); g.add(at(cap, 0, h + 0.25, 0));
  // window grid: thin white mullions plus a glass-highlight plane that "pings" on in beat 2
  for (let y = 1.2; y < h - 0.5; y += 1.4) { const bar = box(w + 0.05, 0.08, 0.05, M('#ffffff')); bar.castShadow = false; g.add(at(bar, 0, y, d / 2 + 0.02)); }
  for (let wx = -w / 2 + 1.2; wx < w / 2; wx += 1.6) { const bar = box(0.08, h - 0.6, 0.05, M('#ffffff')); bar.castShadow = false; g.add(at(bar, wx, h / 2, d / 2 + 0.02)); }
  const shine = mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.42), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false })); g.add(at(shine, 0, h * 0.72, d / 2 + 0.06)); shine.rotation.z = 0.0;
  const door = box(1.6, 2.4, 0.1, M(DEEP)); g.add(at(door, 0, 1.2, d / 2 + 0.05));
  // rooftop garden strip (beat 9 unrolls it) and solar leaves (beat 3)
  const garden = new THREE.Group(); garden.position.set(-w / 2 + 0.4, h + 0.5, 0);
  const soil = mesh(new THREE.BoxGeometry(w - 0.8, 0.3, d - 0.8), M('#6b4a2b')); garden.add(at(soil, (w - 0.8) / 2, 0.15, 0));
  for (let r = -1; r <= 1; r++) for (let c = 0; c < 5; c++) { const veg = mesh(new THREE.SphereGeometry(0.32, 10, 8), M(cyc(['#5cd43c', '#ff6b4a', '#ffd23c', '#8ae04e'], r + c))); garden.add(at(veg, 0.8 + c * ((w - 1.6) / 4), 0.5, r * (d - 1.2) / 2.2)); }
  garden.scale.x = 0.001; g.add(garden);
  const leaves = [];
  for (let k = 0; k < 4; k++) {
    const leaf = new THREE.Group();
    leaf.add(at(mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 8), M('#3a8a2a')), 0, 1.1, 0));
    const panel = mesh(new THREE.BoxGeometry(2.2, 0.08, 1.4), M('#1a3a7a', { roughness: 0.15, metalness: 0.4 })); panel.rotation.x = -0.6; leaf.add(at(panel, 0, 2.2, 0.3));
    const grid = mesh(new THREE.PlaneGeometry(2.0, 1.2), new THREE.MeshBasicMaterial({ color: '#4f9fff', transparent: true, opacity: 0.35 })); grid.rotation.x = -Math.PI / 2 - 0.6; leaf.add(at(grid, 0, 2.27, 0.33));
    leaf.position.set(-w / 2 + 1.2 + k * ((w - 2.4) / 3), h + 0.5, -d / 2 + 0.9); leaf.scale.setScalar(0.001); g.add(leaf); leaves.push(leaf);
  }
  scene.add(at(g, x, 0, -12));
  const tw = { g, x, w, h, d, shine, garden, leaves, i }; towers.push(tw); return tw;
}
[[-60, 8, 10], [-50, 7, 16], [-41, 6, 12], [-28, 10, 20], [-16, 8, 14], [-5, 9, 24], [6, 7, 15], [15, 8, 11], [34, 10, 18], [44, 7, 13]].forEach(([x, w, h], i) => tower(x, w, h, 8, cyc([GLASS, '#a4ecff', '#8ef0e6', '#b8e4ff'], i), i));
onUpdate(t => towers.forEach((tw, i) => {
  // beat 2: window shine pings on, then stays as a soft highlight
  const b = beatOf(t);
  let s = 0;
  if (b === 1) { const lt = local(t, 1) - 0.6 - i * 0.35; s = lt < 0 ? 0 : lt < 0.25 ? easeOutBack(lt / 0.25) * 0.9 : 0.9 - 0.55 * ease((lt - 0.25) / 0.6); }
  else if (b > 1) s = 0.35;
  tw.shine.material.opacity = s * (glossOverride ?? 1);
  // beat 3: solar leaves sprout and turn toward the sun
  tw.leaves.forEach((leaf, k) => { const lk = b < 2 ? 0 : b === 2 ? easeOutBack((local(t, 2) - 0.6 - k * 0.25 - i * 0.12) / 0.5) : 1; leaf.scale.setScalar(Math.max(0.001, lk)); leaf.rotation.y = b >= 2 ? Math.sin(t * 0.6 + k) * 0.25 + 0.4 : 0; });
  // beat 9: gardens unroll
  const gk = b < 8 ? 0 : b === 8 ? ease((local(t, 8) - 0.4 - i * 0.18) / 0.9) : 1; tw.garden.scale.x = Math.max(0.001, gk);
}));

// ---------- south row: houses with porches, the community roof, the workshop, the dome hub ----------
const houses = [];
function house(x, z, facing, color, i) {
  const g = new THREE.Group();
  g.add(at(glossBox(5, 3.2, 4.6, color, { rough: 0.2 }), 0, 1.6, 0));
  const r = mesh(new THREE.ConeGeometry(4.1, 2.2, 4), M(GREY)); theme(r, cyc([WHITE, '#bfe9ff', '#d7ffb0'], i), { rough: 0.15 }); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.82); g.add(at(r, 0, 4.3, 0));
  g.add(at(box(1.0, 1.8, 0.1, M(DEEP)), 0, 0.9, 2.32));
  for (const wx of [-1.5, 1.5]) g.add(at(theme(box(0.9, 0.9, 0.1, M(GREY)), '#dff6ff', { rough: 0.05, emissive: '#9fdcff' }), wx, 2.0, 2.32));
  g.add(at(box(2.2, 0.2, 1.4, M(WHITE)), 0, 0.1, 3.0));
  for (const hx of [-2.0, 2.0]) g.add(at(theme(box(1.6, 0.6, 0.6, M(GREY)), LIME, { rough: 0.5, grey: GREYGRASS }), hx, 0.3, 4.2));
  g.rotation.y = facing; scene.add(at(g, x, 0, z)); houses.push(g); return g;
}
[-60, -52, -44, -24, 16].forEach((hx, i) => house(hx, 9, Math.PI, cyc(['#dff6ff', '#fff6d6', '#e4ffd0', '#dbe9ff'], i), i));
const meterHouse = houses[3]; // (-24, 9): the porch meter lives here
// community roof: a long low hall with a tile grid on top
const hall = new THREE.Group(); scene.add(at(hall, -5, 0, 10));
hall.add(at(glossBox(18, 3.6, 9, '#c9f2ff', { rough: 0.1, opacity: 0.92 }), 0, 1.8, 0));
hall.add(at(textPlane('COMMUNITY HALL', 9, 1.1, { bg: DEEP, fg: '#ffffff', font: '900 90px Inter', radius: 24 }), 0, 2.4, -4.56));
const tiles = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { const tl = mesh(new THREE.BoxGeometry(1.8, 0.14, 2.2), M('#1a3a7a', { roughness: 0.15, metalness: 0.4, emissive: '#2a7bff', emissiveIntensity: 0 })); hall.add(at(tl, -7.5 + c * 2.1, 3.8, -2.6 + r * 2.6)); tl.visible = false; tiles.push(tl); }
const ramp = box(2.2, 0.3, 7, M(WHITE)); ramp.rotation.x = 0.5; hall.add(at(ramp, 10.5, 1.9, 1.4));
// workshop: glass box with a bench, for beat 7
const shop = new THREE.Group(); scene.add(at(shop, 34, 0, 10));
shop.add(at(glossBox(10, 4.4, 8, '#dff6ff', { rough: 0.06, opacity: 0.55 }), 0, 2.2, 0));
shop.add(at(textPlane('REPAIR CAFÉ', 7, 1.0, { bg: ORANGE, fg: '#ffffff', font: '900 90px Inter', radius: 24 }), 0, 5.1, -4.0));
shop.add(at(box(6, 0.3, 2, M('#b08a5a')), 0, 1.3, 0), at(box(0.3, 1.2, 1.8, M('#7a5a3a')), -2.6, 0.6, 0), at(box(0.3, 1.2, 1.8, M('#7a5a3a')), 2.6, 0.6, 0));
const fixer = person({ shirt: ORANGE, hat: false }); shop.add(at(fixer, 0, 0.16, -1.6));
// dome hub (library / share hub) on the plaza
const dome = new THREE.Group(); scene.add(at(dome, 66, 0, -6));
{ const d = mesh(new THREE.SphereGeometry(5, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), M(GREY)); theme(d, '#a4ecff', { rough: 0.05, opacity: 0.7 }); dome.add(d); dome.add(at(box(1.6, 2.4, 0.2, M(DEEP)), 0, 1.2, 4.9)); dome.add(at(textPlane('SHARE HUB', 5, 0.9, { bg: DEEP, fg: '#ffffff', font: '900 90px Inter', radius: 24 }), 0, 3.6, 4.2)); }
// old power plant with smokestack, by the plaza (beat 10)
const plant = new THREE.Group(); scene.add(at(plant, 56, 0, -22));
plant.add(at(box(10, 5, 8, M('#8d99ae')), 0, 2.5, 0));
const stack = mesh(new THREE.CylinderGeometry(1.2, 1.5, 18, 20), M('#aab4c0')); plant.add(at(stack, 3, 9, -2)); plant.add(at(mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.6, 20), M('#e63946')), 3, 18, -2));
const smoke = []; for (let i = 0; i < 6; i++) { const s = mesh(new THREE.SphereGeometry(0.8, 10, 8), M('#cfd6dc', { transparent: true, opacity: 0.7 }), { cast: false }); plant.add(s); smoke.push(s); }
const slide = new THREE.Mesh(new THREE.BufferGeometry(), M(ORANGE, { roughness: 0.15, clearcoat: 1 })); plant.add(slide);
const kids = Array.from({ length: 3 }, (_, i) => { const p = person({ shirt: cyc(SHIRTS, i * 2), hat: false }); p.scale.setScalar(0.7); scene.add(p); return p; });
const helix = u => V(56 + 3 + Math.cos(u * Math.PI * 5) * 2.6, 17 - u * 15.5, -22 - 2 + Math.sin(u * Math.PI * 5) * 2.6);
onUpdate(t => {
  const b = beatOf(t), lt = local(t, 9);
  smoke.forEach((s, i) => { const k = ((t * 0.35 + i * 0.17) % 1); s.position.set(3 + Math.sin(k * 6 + i) * 0.6, 18.5 + k * 7, -2); s.scale.setScalar(0.5 + k * 1.4); s.material.opacity = (b < 9 ? 0.6 : b === 9 ? 0.6 * (1 - clamp(lt / 1.0)) : 0) * (1 - k); });
  const sk = b < 9 ? 0 : b === 9 ? ease((lt - 0.3) / 1.4) : 1;
  slide.visible = sk > 0.02;
  if (slide.visible) { const pts = []; for (let j = 0; j <= 60; j++) { const u = j / 60 * sk; const p = helix(u); pts.push(V(p.x - 56, p.y, p.z + 22)); } slide.geometry.dispose(); slide.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.45, 10, false); }
  kids.forEach((p, i) => { const on = b === 9 && lt > 1.6 + i * 0.5; p.visible = on; if (!on) return; const u = clamp((lt - 1.6 - i * 0.5) / 2.0); const pos = helix(u); p.position.copy(pos).add(V(0, 0.5, 0)); p.rotation.y = u * Math.PI * 5 + Math.PI; p.userData.legL.rotation.x = -1.2; p.userData.legR.rotation.x = -1.2; if (u >= 1) p.position.set(52 + (i - 1) * 2, 0.3, 8 - 4 + i); });
});

// ---------- street life: walkers, cars, lamps, trees ----------
for (let x = -78; x <= 78; x += 12) for (const z of [-3.15, 3.25]) { if (Math.abs(x + 36) < 5 || Math.abs(x - 24) < 5) continue; const g = new THREE.Group(); g.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 10), M(WHITE)), 0, 1.6, 0)); g.add(at(mesh(new THREE.SphereGeometry(0.3, 16, 12), M('#eaffff', { emissive: '#8fe8ff', emissiveIntensity: 0.6 })), 0, 3.3, 0)); scene.add(at(g, x, 0, z)); g.userData.isStatic = true; blockers.push([g, 4]); }
for (const cx of [-36, 24]) for (let z = 10; z <= 58; z += 8) for (const side of [-1, 1]) { tree(cx + side * 4.6, z, 0.8); tree(cx + side * 4.6, -z - 20, 0.8); }
for (let x = -70; x <= 20; x += 9) tree(x + 2, 24, 1.0);
const walkers = [];
for (let i = 0; i < 40; i++) {
  const p = person(); scene.add(p); blockers.push([p, 7]); walkers.push(p);
  const north = i % 2 === 0, dir = i % 4 < 2 ? 1 : -1, speed = 1.0 + (i % 5) * 0.12, x0 = (i * 37) % 160;
  const lane = north ? -3.7 + ((i % 3) - 1) * 0.3 : 3.9 + ((i % 3) - 1) * 0.4;
  onUpdate(t => {
    const b = beatOf(t), cheer = b === 5 || b === 12;
    const x = cheer ? wrap(x0 + dir * speed * (b * BEAT_LEN), -86, 80) : wrap(x0 + dir * speed * t, -86, 80);
    p.position.set(x, 0.16, lane); p.rotation.y = cheer ? 0 : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (cheer) hopPose(p, ((local(t, b) * 1.2 + i * 0.13) % 1)); else walkPose(p, t * speed * 7 + x0);
    p.visible = !((b === 4 || b === 3) && !north && x > -20 && x < 8);
  });
}
for (let i = 0; i < 12; i++) {
  const c = car(cyc([WHITE, SKY, LIME, ORANGE, AQUA, '#ffffff'], i)); scene.add(c); blockers.push([c, 9]);
  const dir = i % 2 ? 1 : -1, x0 = i * 23, sp = 5 + (i % 3);
  if (i < 8) { c.rotation.y = dir > 0 ? 0 : Math.PI; onUpdate(t => { c.position.set(wrap(x0 + dir * sp * t, -90, 90), 0.1 + Math.abs(Math.sin(t * 9 + i)) * 0.03, dir > 0 ? 1.6 : -1.6); c.userData.wheels.forEach(w => { w.rotation.y = -t * sp * 3.5; }); }); }
  else { const cx = i % 2 ? -36 : 24; c.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; onUpdate(t => { c.position.set(cx + (dir > 0 ? -1.4 : 1.4), 0.1, wrap(x0 + dir * sp * t, -60, 60)); c.userData.wheels.forEach(w => { w.rotation.y = -t * sp * 3.5; }); }); }
}

// ---------- wind flowers in the park (beat 3 onward) ----------
const flowers = [];
for (let i = 0; i < 7; i++) {
  const f = new THREE.Group(); f.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 8), M(WHITE)), 0, 2.5, 0));
  const rotor = new THREE.Group(); for (let k = 0; k < 3; k++) { const petal = mesh(new THREE.SphereGeometry(0.5, 10, 8), M(cyc([ORANGE, '#ff5fa0', LIME], i))); petal.scale.set(0.5, 2.2, 0.15); petal.position.y = 1.1; const arm = new THREE.Group(); arm.rotation.z = k * Math.PI * 2 / 3; arm.add(petal); rotor.add(arm); }
  rotor.position.set(0, 5.2, 0.2); f.add(rotor); f.add(at(mesh(new THREE.SphereGeometry(0.35, 10, 8), M('#ffffff')), 0, 5.2, 0.3));
  f.userData.rotor = rotor; f.scale.setScalar(0.001); scene.add(at(f, -20 + i * 6, 0, 28)); flowers.push(f);
  onUpdate(t => { const b = beatOf(t); const k = b < 2 ? 0 : b === 2 ? easeOutBack((local(t, 2) - 2.2 - i * 0.15) / 0.5) : 1; f.scale.setScalar(Math.max(0.001, k)); rotor.rotation.z = t * (2 + i * 0.2); });
}

// ---------- beat 4: the power bill shrinks into a bubble; the meter spins backwards ----------
const meter = new THREE.Group(); meterHouse.add(at(meter, 2.9, 1.6, 0.8));
meter.add(mesh(new THREE.BoxGeometry(0.9, 1.1, 0.4), M('#f4f8fa')));
const dial = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.05), M(DEEP)); meter.add(at(dial, 0, 0.0, 0.23)); dial.geometry.translate(0, 0.2, 0);
meter.add(at(textPlane('kWh', 0.7, 0.3, { bg: null, fg: DEEP, font: '900 110px Inter' }), 0, 0.42, 0.22));
const bill = textPlane('POWER\nBILL\n$$$$', 3.4, 4.2, { bg: '#ffffff', fg: '#c0392b', font: '900 110px Inter', radius: 20, border: '#c0392b', w: 512, h: 640, pad: 8 }); scene.add(bill);
const billBubble = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), new THREE.MeshPhysicalMaterial({ color: '#dff6ff', roughness: 0.02, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1 })); scene.add(billBubble);
onUpdate(t => {
  const b = beatOf(t), on = b === 3; bill.visible = on; billBubble.visible = on; dial.rotation.z = on ? local(t, 3) * -5 : -t * 0.4;
  if (!on) return; const lt = local(t, 3);
  const shrink = ease((lt - 0.8) / 1.4), hx = meterHouse.position.x + 0.5, hz = meterHouse.position.z - 5.0;
  bill.position.set(hx, 3.2 + lt * 0.2, hz); bill.rotation.y = Math.PI; bill.scale.setScalar(Math.max(0.001, 1 - shrink)); bill.visible = shrink < 0.98;
  billBubble.visible = shrink > 0.6; billBubble.position.set(hx, 3.2 + lt * 0.2 + (lt - 2.2) * (lt > 2.2 ? 1.6 : 0), hz); billBubble.scale.setScalar(easeOutBack((shrink - 0.6) / 0.4) * (lt > 3.4 ? 1 - clamp((lt - 3.4) / 0.15) : 1));
});

// ---------- beat 5: bucket brigade carries glowing tiles onto the community roof ----------
const carriers = [];
for (let i = 0; i < 8; i++) {
  const p = person({ shirt: cyc(SHIRTS, i * 3 + 1), hat: false }); scene.add(p); carriers.push(p);
  const tile = mesh(new THREE.BoxGeometry(0.9, 0.08, 1.0), M('#1a3a7a', { emissive: '#2a7bff', emissiveIntensity: 0.9, roughness: 0.2 })); p.add(at(tile, 0, 0.95, 0.3));
  onUpdate(t => {
    const on = inBeat(t, 4); p.visible = on; if (!on) return;
    const lt = local(t, 4), k = ((lt * 0.35 + i * 0.125) % 1); // a loop from the street, up the ramp, across the roof
    const x = lerp(14, -7, k), z = k < 0.3 ? lerp(4, 12 + 1.4, k / 0.3) : 12 + 1.4 - (k - 0.3) * 2, y = k < 0.3 ? 0.16 : k < 0.5 ? lerp(0.16, 3.9, (k - 0.3) / 0.2) : 3.9;
    p.position.set(x, y, z); p.rotation.y = -Math.PI / 2; walkPose(p, lt * 9 + i);
  });
}
const tileChord = sprite('✓ SHARED ROOF ONLINE', 7, 1.1, { bg: LIME, fg: '#163300', font: '900 90px Inter', radius: 50, w: 1000 }); scene.add(at(tileChord, -5, 7.5, 10));
onUpdate(t => { const b = beatOf(t); tiles.forEach((tl, i) => { const k = b < 4 ? 0 : b === 4 ? clamp((local(t, 4) - 0.6 - i * 0.14) / 0.2) : 1; tl.visible = k > 0; tl.material.emissiveIntensity = 0.9 * k * (0.75 + 0.25 * Math.sin(t * 4 + i)); }); tileChord.visible = b === 4 && local(t, 4) > 3.6; const ck = easeOutBack((local(t, 4) - 3.6) / 0.3); tileChord.scale.set(7 * ck, 1.1 * ck, 1); });

// ---------- beat 6: glass share-boxes on corners ----------
const shareBoxes = [];
[[-38.5, 5.2, 'BOOKS', '#ffb347'], [-33.5, -5.2, 'TOOLS', '#8fe8ff'], [21.5, 5.2, 'SEEDS', LIME], [26.5, -5.2, 'TOYS', '#ff7ab3'], [-10, 5.2, 'GAMES', '#c9a2ff'], [8, -5.2, 'BOOKS', '#ffb347']].forEach(([x, z, label, col], i) => {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.5, 10), M(WHITE)), 0, 0.75, 0));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.1), new THREE.MeshPhysicalMaterial({ color: '#dff6ff', roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.45 })); g.add(at(glass, 0, 2.2, 0));
  g.add(at(box(1.7, 0.2, 1.2, M(col)), 0, 2.95, 0)); g.add(at(box(1.7, 0.12, 1.2, M(WHITE)), 0, 1.5, 0));
  for (let k = 0; k < 3; k++) g.add(at(box(0.3, 0.7, 0.5, M(cyc([ORANGE, DEEP, LIME, '#ff5fa0'], i + k))), -0.45 + k * 0.45, 1.95, 0));
  g.add(at(sprite(label, 1.9, 0.6, { bg: col, fg: '#163300', font: '900 100px Inter', radius: 40 }), 0, 3.6, 0));
  g.scale.setScalar(0.001); scene.add(at(g, x, 0, z)); shareBoxes.push(g);
  onUpdate(t => { const b = beatOf(t); const k = b < 5 ? 0 : b === 5 ? easeOutBack((local(t, 5) - 0.5 - i * 0.5) / 0.4) : 1; g.scale.setScalar(Math.max(0.001, k)); });
});

// ---------- beat 7: broken things roll into the workshop and come out shiny ----------
const fixItems = [];
{
  const toaster = new THREE.Group(); toaster.add(box(1.2, 0.9, 0.8, M('#8d99ae', { metalness: 0.5, roughness: 0.4 }))); for (const sx of [-0.25, 0.25]) toaster.add(at(box(0.3, 0.1, 0.5, M('#333')), sx, 0.5, 0)); fixItems.push(toaster);
  const lamp = new THREE.Group(); lamp.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), M('#8d99ae')), 0, 0.7, 0), at(mesh(new THREE.ConeGeometry(0.6, 0.6, 14, 1, true), M('#ffd166', { side: THREE.DoubleSide })), 0, 1.5, 0), at(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 14), M('#8d99ae')), 0, 0.05, 0)); fixItems.push(lamp);
  const bike = new THREE.Group(); for (const bx of [-0.7, 0.7]) { const wh = mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 20), M('#333')); bike.add(at(wh, bx, 0.45, 0)); } bike.add(at(box(1.2, 0.08, 0.08, M('#e63946')), 0, 0.7, 0), at(box(0.08, 0.6, 0.08, M('#e63946')), 0.3, 0.95, 0)); fixItems.push(bike);
  fixItems.forEach(it => { it.visible = false; scene.add(it); });
}
const sparkles = Array.from({ length: 12 }, () => { const s = sprite('✦', 0.6, 0.6, { bg: null, fg: '#ffffff', font: '900 120px Inter', w: 160 }); scene.add(s); s.visible = false; return s; });
onUpdate(t => {
  const on = inBeat(t, 6); fixItems.forEach(it => it.visible = on); sparkles.forEach(s => s.visible = false); if (!on) return;
  const lt = local(t, 6);
  fixItems.forEach((it, i) => {
    const st = 0.4 + i * 1.1, k = clamp((lt - st) / 1.6); // roll in from the left, pause at the bench, roll out right
    const x = k < 0.35 ? lerp(24, 32, k / 0.35) : k < 0.65 ? 32 : lerp(32, 42, (k - 0.65) / 0.35);
    it.position.set(x, 1.5, 10 - 0.4); it.rotation.y = (k < 0.35 || k > 0.65) ? lt * 4 : 0; it.rotation.z = (k < 0.35 || k > 0.65) ? Math.sin(lt * 10) * 0.15 : 0;
    it.visible = k > 0 && k < 1;
    it.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(k > 0.65 ? '#5fd0ff' : '#000000'); o.material.emissiveIntensity = k > 0.65 ? 0.5 : 0; } });
    if (k > 0.35 && k < 0.65) fixer.userData.body.rotation.x = Math.sin(lt * 20) * 0.1;
  });
  sparkles.forEach((s, i) => { const it = fixItems[i % 3], st = 0.4 + (i % 3) * 1.1, k = clamp((lt - st) / 1.6); s.visible = k > 0.6 && k < 1; const ph = lt * 6 + i; s.position.set(it.position.x + Math.cos(ph) * 1.1, 1.5 + Math.sin(ph * 1.3) * 0.9 + 0.3, it.position.z + Math.sin(ph) * 0.8); s.scale.setScalar(0.4 + 0.3 * Math.sin(lt * 12 + i)); });
});

// ---------- beat 8: market stalls bloom; glossy fruit bounces into baskets ----------
const stalls = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group(), a = (i / 6) * Math.PI * 2 + 0.3, r = 14;
  g.add(at(box(3.0, 0.9, 1.4, M('#b08a5a')), 0, 0.45, 0));
  for (const px of [-1.4, 1.4]) g.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), M(WHITE)), px, 1.3, 0.6));
  const awn = mesh(new THREE.ConeGeometry(2.2, 0.9, 4), M(cyc([ORANGE, LIME, AQUA, '#ff5fa0'], i), { roughness: 0.3 })); awn.rotation.y = Math.PI / 4; g.add(at(awn, 0, 2.9, 0.2));
  const basket = mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.5, 16, 1, true), M('#a9743f', { side: THREE.DoubleSide })); g.add(at(basket, 0, 1.15, 0.3));
  g.position.set(52 + Math.cos(a) * r, 0, Math.sin(a) * r); g.rotation.y = -a + Math.PI / 2; g.scale.setScalar(0.001); scene.add(g); stalls.push(g);
}
const fruits = Array.from({ length: 6 }, (_, i) => { const f = mesh(i % 3 === 0 ? new THREE.SphereGeometry(0.55, 20, 16) : i % 3 === 1 ? new THREE.ConeGeometry(0.45, 0.8, 16) : new THREE.SphereGeometry(0.5, 20, 16), M(cyc([ORANGE, '#ff3b5c', '#7ce83a'], i), { roughness: 0.15, clearcoat: 1 })); scene.add(f); f.visible = false; return f; });
onUpdate(t => {
  const b = beatOf(t); stalls.forEach((g, i) => { const k = b < 7 ? 0 : b === 7 ? easeOutBack((local(t, 7) - 0.3 - i * 0.3) / 0.5) : 1; g.scale.setScalar(Math.max(0.001, k)); });
  fruits.forEach((f, i) => { const on = inBeat(t, 7); f.visible = on; if (!on) return; const lt = local(t, 7) - 0.8 - i * 0.5, st = stalls[i], target = st.position.clone().add(V(0, 1.6, 0)); if (lt < 0) { f.visible = false; return; } const k = clamp(lt / 1.2); f.position.lerpVectors(V(52, 12, 0), target, k); f.position.y += Math.sin(k * Math.PI) * 5 + (k >= 1 ? Math.abs(Math.sin((lt - 1.2) * 8)) * 0.6 * Math.exp(-(lt - 1.2)) : 0); f.rotation.set(lt * 3, lt * 2, 0); });
  pond.scale.setScalar(b < 7 ? 0.35 : b === 7 ? lerp(0.35, 1, easeOutBack((local(t, 7) - 2.4) / 0.8)) : 1);
});

// ---------- beat 9: watering drones ----------
const drones = [];
for (let i = 0; i < 3; i++) {
  const d = new THREE.Group(); d.add(box(0.8, 0.3, 0.8, M(WHITE))); for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const r = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12), M(AQUA, { transparent: true, opacity: 0.6 })); d.add(at(r, x, 0.2, z)); }
  d.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.4, 10), M(SKY)), 0, -0.3, 0)); scene.add(d); drones.push(d);
  const drops = Array.from({ length: 8 }, () => { const s = mesh(new THREE.SphereGeometry(0.1, 8, 6), M('#8fe8ff', { emissive: '#5fd0ff', emissiveIntensity: 0.4 })); scene.add(s); return s; });
  onUpdate(t => {
    const on = inBeat(t, 8); d.visible = on; drops.forEach(s => s.visible = on); if (!on) return;
    const lt = local(t, 8), tw = towers[(i * 3 + 1) % towers.length]; const x = tw.x + Math.sin(lt * 1.2 + i) * 2.5, y = tw.h + 4 + Math.sin(lt * 3 + i) * 0.3, z = -12 + Math.cos(lt * 0.9 + i) * 1.5;
    d.position.set(x, y, z); d.rotation.y = lt * 0.5; d.children.slice(1, 5).forEach(r => r.rotation.y = t * 40);
    drops.forEach((s, k) => { const dk = ((lt * 1.5 + k * 0.125) % 1); s.position.set(x + Math.sin(k * 2.1) * 0.6, y - 0.5 - dk * 3.2, z + Math.cos(k * 1.7) * 0.6); s.visible = lt > 1.4 + i * 0.8; });
  });
}

// ---------- beat 11: the e-waste mountain and a sorting bot ----------
const pile = new THREE.Group(); scene.add(at(pile, -10, 0, -44));
{
  const r2 = (sd => () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; })(5);
  for (let i = 0; i < 160; i++) {
    const kind = i % 4, g = new THREE.Group();
    if (kind === 0) { g.add(box(0.9, 1.6, 0.25, M(cyc(['#e8eef2', '#2f3a4a', '#9ad7ff'], i)))); g.add(at(mesh(new THREE.PlaneGeometry(0.6, 0.5), M('#1a1f2b')), 0, 0.35, 0.14)); g.add(at(mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), M('#dde')), 0, -0.4, 0.14)); } // music player
    else if (kind === 1) { g.add(box(0.7, 1.4, 0.3, M(cyc(['#c9d3dc', '#ff5fa0', '#2f3a4a'], i)))); g.add(at(mesh(new THREE.PlaneGeometry(0.5, 0.5), M('#1a1f2b')), 0, 0.3, 0.16)); } // flip phone
    else if (kind === 2) { g.add(box(2.0, 1.3, 0.2, M('#2f3a4a'))); g.add(at(mesh(new THREE.PlaneGeometry(1.7, 1.0), M('#1a1f2b')), 0, 0, 0.11)); } // monitor
    else { g.add(box(1.4, 0.4, 1.0, M('#aab4c0'))); } // old console
    const a = r2() * Math.PI * 2, rad = r2() * 11, h = Math.max(0, 7 - rad * 0.6) * r2() + 0.3;
    g.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad * 0.7); g.rotation.set(r2() * 1.5, r2() * 6, r2() * 1.5); pile.add(g);
  }
  const mound = mesh(new THREE.SphereGeometry(11, 24, 16), M('#6c757d')); mound.scale.set(1, 0.6, 0.7); pile.add(at(mound, 0, -1, 0));
}
const bot = new THREE.Group(); scene.add(bot);
bot.add(at(box(1.6, 1.4, 1.4, M(WHITE)), 0, 1.2, 0), at(mesh(new THREE.SphereGeometry(0.55, 16, 12), M(AQUA)), 0, 2.3, 0), at(box(1.8, 0.5, 1.6, M('#2f3a4a')), 0, 0.3, 0));
for (const sx of [-1.0, 1.0]) { const arm = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), M('#8d99ae')); arm.rotation.z = sx * 0.8; bot.add(at(arm, sx, 1.4, 0.4)); }
bot.add(at(sprite('♻', 0.9, 0.9, { bg: LIME, fg: '#163300', font: '900 120px Inter', radius: 70, w: 160 }), 0, 1.2, 0.8));
const bins = ['#7ce83a', '#5fd0ff', ORANGE].map((c, i) => { const bn = mesh(new THREE.CylinderGeometry(1.0, 0.8, 1.6, 16, 1, true), M(c, { side: THREE.DoubleSide })); scene.add(at(bn, -24 + i * 2.6, 0.8, -36)); return bn; });
const carried = box(0.9, 1.6, 0.25, M('#e8eef2')); scene.add(carried);
onUpdate(t => {
  const b = beatOf(t), on = b >= 10;
  pile.visible = on; bot.visible = on; bins.forEach(bn => bn.visible = on); carried.visible = on; if (!on) return;
  const lt = b === 10 ? local(t, 10) : 4.5 + (t - 11 * BEAT_LEN);
  pile.position.y = b === 10 ? lerp(-14, 0, easeOutBounce(clamp(lt / 1.2))) : 0;
  const k = (lt * 0.4) % 1, x = k < 0.5 ? lerp(-4, -21, k / 0.5) : lerp(-21, -4, (k - 0.5) / 0.5);
  bot.position.set(x, 0, -38); bot.rotation.y = k < 0.5 ? -Math.PI / 2 : Math.PI / 2; bot.position.y = Math.abs(Math.sin(lt * 12)) * 0.08;
  carried.visible = k < 0.5; carried.position.set(x - 1.2, 1.9, -37.6); carried.rotation.y = lt * 2;
});

// ---------- beat 12: gloss flicker, then people polish it back ----------
const polishers = [];
for (let i = 0; i < 4; i++) {
  const p = person({ shirt: cyc([ORANGE, AQUA, LIME, '#ff5fa0'], i), hat: false }); scene.add(p); polishers.push(p);
  const tool = new THREE.Group(); tool.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), M('#8d99ae')), 0, 0.8, 0), at(box(0.9, 0.12, 0.12, M('#2f3a4a')), 0, 1.6, 0)); tool.rotation.x = -0.9; p.add(at(tool, 0.35, 0.6, 0.2));
  const tw = towers[3 + i];
  onUpdate(t => {
    const on = inBeat(t, 11); p.visible = on; if (!on) return; const lt = local(t, 11);
    p.position.set(tw.x - 2 + (i % 2) * 4, 0.16, -12 + tw.d / 2 + 0.9); p.rotation.y = Math.PI; tool.rotation.z = lt > 1.0 ? Math.sin(lt * 9 + i) * 0.5 : 0; p.userData.body.position.y = 0.6 + (lt > 1.0 ? Math.abs(Math.sin(lt * 9 + i)) * 0.06 : 0);
  });
}
onUpdate(t => { glossOverride = null; if (inBeat(t, 11)) { const lt = local(t, 11); if (lt < 1.0) glossOverride = lt < 0.3 ? (Math.floor(lt * 40) % 2 ? 0.35 : 0.8) : lerp(0.35, 1, ease((lt - 0.3) / 0.7)); } });

// ---------- bubbles, lens flare, clouds, birds ----------
const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#e8fbff', roughness: 0.02, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
const bubbleGeo = new THREE.SphereGeometry(1, 20, 14);
const bubbles = [];
for (let i = 0; i < 70; i++) {
  const g = new THREE.Group(); const sph = new THREE.Mesh(bubbleGeo, bubbleMat); g.add(sph);
  const hi = sprite('●', 0.5, 0.5, { bg: null, fg: '#ffffff', font: '900 120px Inter', w: 160 }); hi.material.opacity = 0.8; g.add(at(hi, -0.35, 0.35, 0.6)); g.userData.hi = hi;
  scene.add(g); bubbles.push(g);
  const x0 = -90 + (i * 53) % 180, z0 = -50 + (i * 29) % 90, s = 0.5 + (i % 5) * 0.3, ph = i * 0.7;
  onUpdate(t => {
    const b = beatOf(t), k = b === 0 ? clamp((t - 1.0 - i * 0.02) / 0.6) : 1;
    const rise = ((t * 0.8 + ph) % 24); g.position.set(x0 + Math.sin(t * 0.7 + ph) * 1.5, 1 + rise, z0 + Math.cos(t * 0.5 + ph) * 1.2);
    const burst = b === 12 ? 1 + easeOutBack((local(t, 12) - 0.5) / 0.6) * 0.6 : 1;
    g.scale.setScalar(s * k * burst); hi.scale.setScalar(0.5 / s); g.visible = k > 0.01 && b < 13;
  });
}
const flare = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.15, 'rgba(255,255,240,0.6)'); gr.addColorStop(0.5, 'rgba(200,240,255,0.18)'); gr.addColorStop(1, 'rgba(200,240,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false })); s.scale.set(40, 40, 1); scene.add(s); return s;
})();
onUpdate(t => { const k = beatOf(t) === 0 ? clamp((t - 1.6) / 0.8) : 1; flare.material.opacity = 0.85 * k * (glossOverride ?? 1); flare.position.set(camera.position.x + 40, camera.position.y + 48, camera.position.z - 60); });
for (let i = 0; i < 8; i++) { const c = cloud(1.6 + (i % 3) * 0.5), z = -90 + (i % 4) * 18, y = 38 + (i % 3) * 5, x0 = i * 25; onUpdate(t => c.position.set(wrap(x0 + t * 1.2, -100, 100), y, z)); }
for (let f = 0; f < 3; f++) {
  const flock = new THREE.Group();
  for (let b = 0; b < 5; b++) { const bird = new THREE.Group(); const wl = at(box(0.6, 0.05, 0.22, M('#ffffff')), -0.3, 0, 0), wr = at(box(0.6, 0.05, 0.22, M('#ffffff')), 0.3, 0, 0); bird.add(wl, wr); bird.userData = { wl, wr }; bird.position.set(-Math.abs(b - 2) * 1.0, Math.abs(b - 2) * 0.1, (b - 2) * 0.9); flock.add(bird); }
  scene.add(flock);
  onUpdate(t => { flock.position.set(wrap(-90 + f * 70 + t * 6, -110, 110), 28 + f * 5 + Math.sin(t + f) * 0.8, -40 + f * 22); flock.children.forEach((bd, i) => { const a = Math.sin(t * 10 + i) * 0.5; bd.userData.wl.rotation.z = a; bd.userData.wr.rotation.z = -a; }); });
}
// a glossy "WHAT IF" blimp instead of a balloon
const blimp = new THREE.Group();
{ const env = mesh(new THREE.SphereGeometry(2.6, 32, 20), M(WHITE, { roughness: 0.15, clearcoat: 1 })); env.scale.set(2.2, 1, 1); blimp.add(env); blimp.add(at(box(2.4, 0.7, 0.9, M(DEEP)), 0, -1.3, 0)); blimp.add(at(textPlane('WHAT IF', 4.2, 1.1, { bg: null, fg: DEEP, font: '900 110px Inter' }), 0, 0, 2.7)); const fin = box(0.1, 1.6, 1.4, M(AQUA)); blimp.add(at(fin, -5.2, 0.6, 0)); }
scene.add(blimp);
onUpdate(t => { blimp.position.set(-80 + t * 2.2, 32 + Math.sin(t * 0.6) * 1.2, -50 + Math.sin(t * 0.2) * 6); blimp.visible = beatOf(t) < 13; });

// ---------- end card: three bubble icons ----------
const endSet = new THREE.Group(); scene.add(at(endSet, 0, 0, 150));
{
  const roadM = M('#56607a'); endSet.add(at(box(8, 0.12, 40, roadM), 0, 0.06, 6));
  const items = [['FLYING CARS', (() => { const c = car(ORANGE); for (const sx of [-1, 1]) c.add(at(box(0.15, 0.08, 1.8, M(WHITE)), sx * 0.2, 0.9, sx * 1.4)); return c; })()],
    ['HOVERBOARDS', (() => { const g = new THREE.Group(); g.add(at(mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 24), M('#ff5fa0', { roughness: 0.15 })), 0, 0.4, 0)); const p = person({ shirt: LIME, hat: false }); g.add(at(p, 0, 0.5, 0)); return g; })()],
    ['VIDEO CALLS\nTHAT WORK', (() => { const g = new THREE.Group(); g.add(at(box(1.2, 2.2, 0.3, M(WHITE)), 0, 1.1, 0)); g.add(at(mesh(new THREE.PlaneGeometry(0.9, 1.5), M(AQUA, { emissive: '#5fd0ff', emissiveIntensity: 0.6 })), 0, 1.2, 0.16)); return g; })()]];
  items.forEach(([label, obj], i) => {
    const g = new THREE.Group(); const sph = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 24), bubbleMat); g.add(sph); g.add(at(obj, 0, -1.4, 0));
    g.add(at(sprite(label, 5.4, 1.4, { bg: WHITE, fg: DEEP, font: '900 76px Inter', radius: 40, w: 640, h: 170 }), 0, -4.4, 0));
    g.position.set((i - 1) * 7.5, 5.5 + (i % 2) * 1.5, -6 - i * 1.5); endSet.add(g); (endSet.userData.icons ||= []).push(g);
  });
}
onUpdate(t => { const on = beatOf(t) === 13; endSet.visible = on; if (!on) return; const lt = t - 13 * BEAT_LEN; endSet.userData.icons.forEach((g, i) => { const s = easeOutBack((lt - 0.1 - i * 0.2) / 0.5); g.scale.setScalar(Math.max(0.001, s)); g.position.y = 5.5 + (i % 2) * 1.5 + Math.sin(lt * 1.5 + i) * 0.3; }); });

// ---------- cameras ----------
setShots([
  { p0: V(-10, 62, 98), p1: V(-8, 54, 82), t0: V(-6, 8, -10), t1: V(-6, 8, -10) },                                // 1 wide push-in as the gloss sweeps
  { p0: V(-70, 6, 14), p1: V(-20, 6, 14), t0: V(-50, 8, -12), t1: V(0, 9, -12) },                                // 2 dolly past the glass row
  { p0: V(-30, 4, 16), p1: V(-26, 26, 14), t0: V(-28, 6, -12), t1: V(-26, 21, -12) },                             // 3 crane up to the rooftops
  { p0: V(-18.5, 3.4, 10.5), p1: V(-19.5, 3.0, 9.5), t0: V(-23.5, 2.6, 3.9), t1: V(-23.5, 3.0, 3.9) },           // 4 porch meter and the bill
  { p0: V(2, 26, 12), p1: V(-6, 22, 11), t0: V(0, 2, 10), t1: V(-5, 3, 10), up: V(1, 0, 0) },                     // 5 top-down over the hall roof
  { p0: V(-46, 3.0, -1.5), p1: V(-30, 3.0, -1.5), t0: V(-38.5, 2.4, 5.2), t1: V(-33.5, 2.4, -5.2) },             // 6 share-boxes on the corner
  { p0: V(30, 3.4, 2.5), p1: V(34, 3.6, 2.0), t0: V(32, 1.6, 10), t1: V(33, 1.6, 10) },                           // 7 across the street into the workshop
  { orbit: { c: V(52, 3, 2), r: 34, h: 16, a0: 1.9, a1: 1.1 } },                                                 // 8 orbit the plaza market
  { p0: V(-48, 20, 2), p1: V(10, 26, -2), t0: V(-30, 14, -12), t1: V(10, 18, -12) },                             // 9 low pass over the rooftops
  { snap: true, p0: V(40, 30, 30), p1: V(44, 12, 2), t0: V(59, 9, -24), t1: V(57, 8, -22) },                      // 10 snap to the smokestack slide
  { p0: V(-6, 6, 2), p1: V(-8, 20, 30), t0: V(-8, 4, -20), t1: V(-10, 5, -40) },                                 // 11 pull back to reveal the pile
  { p0: V(-14, 3.2, 0.5), p1: V(-4, 3.0, 0.5), t0: V(-10, 2.4, -7.5), t1: V(0, 2.4, -7.5) },                      // 12 close on the polishers
  { p0: V(-6, 8, 16), p1: V(0, 60, 100), t0: V(-6, 6, 0), t1: V(0, 8, -10) },                                     // 13 pull back
  { p0: V(0, 6, 174), p1: V(0, 6, 174), t0: V(0, 4, 144), t1: V(0, 4, 144) },                                     // end card
]);

// ---------- overlay ----------
setOverlay(t => {
  const b = beatOf(t), isEnd = b === 13;
  document.querySelectorAll('#progress i').forEach((el, i) => { el.className = i < b ? 'on' : i === b ? 'now' : ''; });
  $('stats').classList.toggle('hidden', isEnd); $('badge').classList.toggle('hidden', isEnd);
  $('caption').classList.toggle('hidden', isEnd); $('end').classList.toggle('hidden', !isEnd);
  if (isEnd) {
    const lt = t - 13 * BEAT_LEN;
    $('endQ').innerHTML = 'Which <span class="a">2000s future</span> should come true next?';
    setText($('endCta'), END.cta); setText($('endSrc'), END.sources);
    $('end').style.transform = `scale(${easeOutBack(lt / 0.45)})`;
    $('takeaway').classList.add('hidden'); $('sticker').classList.add('hidden');
    return;
  }
  const beat = BEATS[b], lt = local(t, b);
  setText($('statReal'), beat.real); setText($('statWhatIf'), beat.whatif);
  const rt = $('realTag'); setText(rt, beat.napkin ? 'NAPKIN MATH' : 'REAL'); rt.className = 'tag ' + (beat.napkin ? 'napkin' : 'gold');
  setText($('capText'), beat.cap); setText($('capSrc'), 'Source: ' + beat.src);
  $('twist').classList.toggle('hidden', !beat.twist);
  const pop = b === 0 ? 1 : easeOutBack(lt / 0.35);
  $('caption').style.transform = `translateY(${(1 - pop) * 60}px) scale(${0.94 + 0.06 * pop})`; $('caption').style.opacity = String(clamp(b === 0 ? 1 : lt / 0.15));
  $('stats').style.transform = `scale(${b === 0 ? 1 : 0.8 + 0.2 * easeOutBack((lt - 0.1) / 0.35)})`;
  const st = $('sticker');
  if (b === 10 && lt > 2.0) { st.classList.remove('hidden'); st.style.transform = `rotate(-4deg) scale(${easeOutBack((lt - 2.0) / 0.35)})`; } else st.classList.add('hidden');
  const tk = $('takeaway');
  if (beat.takeaway && lt > 1.0) { tk.classList.remove('hidden'); setText(tk, beat.takeaway); tk.style.transform = `scale(${easeOutBack((lt - 1.0) / 0.4)})`; } else tk.classList.add('hidden');
});

start();
