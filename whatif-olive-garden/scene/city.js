// "What if the world could only eat Olive Garden?" — a food-court Main Street built on the shared toolkit.
// Everything is a pure function of time t (seconds), so any frame can be rendered on its own.
import {
  THREE, clamp, lerp, ease, easeOutBack, easeOutBounce, wrap, rng, beatOf, local, inBeat, cyc, at, V,
  scene, camera, M, mesh, box, textPlane, sprite, HOUSE, ROOF, SHIRTS, CARS, SKINS,
  updaters, blockers, onUpdate, tree, cypress, person, walkPose, hopPose, car, cloud,
  lookTarget, setShots, setOverlay, setExtraHide, $, setText, start,
} from './kit.js';
import { BEATS, END, BEAT_LEN } from './beats.js';

// Theme palette: Tuscan creams, terracotta, olive and basil greens, tomato red.
const CREAM = '#fff3dd', TERRA = '#e07a5f', OLIVE = '#8a9a5b', BASIL = '#4f9d69', TOMATO = '#e63946', BREAD = '#e6b877', PASTA = '#ffd98a';

// ---------- ground, roads, lamps, hills ----------
{
  const ground = mesh(new THREE.PlaneGeometry(600, 600), M('#a5d97f'), { cast: false }); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const road = M('#5d6378'), walk = M('#f4e7cf'), line = M('#fff6d6');
  const addRoad = (x, z, w, d) => { const r = box(w, 0.1, d, road); r.castShadow = false; scene.add(at(r, x, 0.05, z)); };
  addRoad(-23, 0, 134, 6); addRoad(-36, 0, 6, 120); addRoad(24, 0, 6, 120);
  for (const z of [-3.7, 3.9]) { const s = box(134, 0.16, z > 0 ? 1.8 : 1.4, walk); s.castShadow = false; scene.add(at(s, -23, 0.08, z)); }
  for (let x = -88; x < 44; x += 4) { if (Math.abs(x + 36) < 5 || Math.abs(x - 24) < 5) continue; const l = box(2, 0.12, 0.25, line); l.castShadow = false; scene.add(at(l, x, 0.06, 0)); }
  for (const cx of [-36, 24]) for (let z = -58; z < 60; z += 4) { if (Math.abs(z) < 5) continue; const l = box(0.25, 0.12, 2, line); l.castShadow = false; scene.add(at(l, cx, 0.06, z)); }
  for (const cx of [-36, 24]) for (const side of [-1, 1]) for (let k = -2; k <= 2; k++) { const zb = box(2.4, 0.13, 0.7, M('#ffffff')); zb.castShadow = false; scene.add(at(zb, cx + side * 4.6, 0.07, k * 1.15)); }
  for (const [x, z, w, d] of [[-10, -12, 60, 16], [-6, 14, 56, 18], [-60, 14, 40, 16]]) { const pad = mesh(new THREE.PlaneGeometry(w, d), M('#b7e38f'), { cast: false }); pad.rotation.x = -Math.PI / 2; scene.add(at(pad, x, 0.02, z)); }
  // the plaza in front of the giant bowl
  const plaza = mesh(new THREE.CircleGeometry(16, 48), M('#f4e7cf'), { cast: false }); plaza.rotation.x = -Math.PI / 2; scene.add(at(plaza, 52, 0.04, 0));
  [[-150, -170, 60, '#8fcd78'], [60, -200, 80, '#9ad584'], [160, -140, 70, '#86c671'], [200, 40, 60, '#94d07c'], [-200, 60, 60, '#8fcd78'], [-120, 150, 70, '#86c671'], [40, 240, 90, '#94d07c']]
    .forEach(([x, z, r, c]) => { const h = mesh(new THREE.SphereGeometry(r, 32, 16), M(c), { cast: false }); h.scale.y = 0.32; scene.add(at(h, x, -4, z)); });
}
for (let x = -78; x <= 40; x += 12) for (const z of [-3.15, 3.25]) {
  if (Math.abs(x + 36) < 5 || Math.abs(x - 24) < 5) continue;
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 10), M('#2f3a66')), 0, 1.6, 0));
  g.add(at(mesh(new THREE.SphereGeometry(0.26, 16, 12), M('#fff4cf', { emissive: '#ffd66b', emissiveIntensity: 0.55 })), 0, 3.3, 0));
  scene.add(at(g, x, 0, z)); g.userData.isStatic = true; blockers.push([g, 4]);
}
for (const cx of [-36, 24]) for (let z = 10; z <= 58; z += 8) for (const side of [-1, 1]) { tree(cx + side * 4.6, z, 0.8); tree(cx + side * 4.6, -z, 0.8); }
for (let x = -78; x <= -42; x += 8) { tree(x + 4, 26, 1.0); cypress(x + 1, 24, 1.0); }
for (let x = -30; x <= 14; x += 8) cypress(x + 4, -16, 1.1);
for (let x = -30; x <= 14; x += 11) cypress(x, 25, 1.0);

// ---------- restaurants (north row, facing the street) ----------
const RESTS = [['TACOS', '#ffd166', '#e63946'], ['SUSHI', '#c6e2ff', '#2f4b8c'], ['BURGERS', '#ffc9a8', '#8a4b2a'], ['DINER', CREAM, '#3c1814'], ['PIZZA', '#ffe28a', '#e63946'], ['NOODLES', '#bfe8d8', '#1d6b5a'], ['BAKERY', '#ffc4d0', '#7a2a4a']];
const rests = [];
function restaurant(i, name, wall, accent) {
  const hero = name === 'DINER';
  const w = hero ? 11 : 6.8, h = hero ? 6 : 4.6, d = 7, x = -30 + i * 8 + (i > 3 ? 2 : 0) + (hero ? 0 : 0);
  const g = new THREE.Group();
  g.add(at(box(w, h, d, M(wall)), 0, h / 2, 0));
  const roof = at(box(w + 0.8, 0.7, d + 0.8, M(TERRA)), 0, h + 0.3, 0); g.add(roof);
  for (let k = -1; k <= 1; k += 2) g.add(at(box(w * 0.3, 0.5, d * 0.5, M('#c8654d')), k * w * 0.25, h + 0.75, -0.5)); // roof tiles ridge
  g.add(at(box(1.4, 2.4, 0.12, M('#6b3e26')), 0, 1.2, d / 2 + 0.02));
  for (const wx of [-w * 0.3, w * 0.3]) { g.add(at(box(1.6, 1.4, 0.1, M('#d7f3ff', { roughness: 0.15 })), wx, 2.0, d / 2 + 0.02)); g.add(at(box(1.9, 0.14, 0.4, M('#8a9a5b')), wx, 1.25, d / 2 + 0.2)); } // windows + planter
  // striped awning
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const cg = c.getContext('2d');
  for (let s = 0; s < 8; s++) { cg.fillStyle = s % 2 ? '#ffffff' : accent; cg.fillRect(s * 32, 0, 32, 64); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const aw = mesh(new THREE.BoxGeometry(w * 0.9, 0.12, 2.0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); aw.rotation.x = 0.35; g.add(at(aw, 0, 3.3, d / 2 + 0.9));
  // flipping sign: a pivot that spins around its vertical axis, front = original name, back = OLIVE GARDEN
  const pivot = at(new THREE.Group(), 0, h + 1.5, d / 2 + 0.3);
  pivot.add(box(w * 0.82, 1.4, 0.3, M('#ffffff')));
  const front = at(textPlane(name, w * 0.78, 1.2, { bg: accent, fg: '#ffffff', font: '900 96px Inter', radius: 20 }), 0, 0, 0.17);
  const back = at(textPlane('OLIVE GARDEN', w * 0.78, 1.2, { bg: '#5b7a2e', fg: '#fff3dd', font: '900 86px Inter', radius: 20 }), 0, 0, -0.17); back.rotation.y = Math.PI;
  pivot.add(front, back); g.add(pivot);
  g.add(at(box(0.3, 1.2, 0.3, M('#2f3a66')), -w * 0.3, h + 0.9, d / 2 + 0.3), at(box(0.3, 1.2, 0.3, M('#2f3a66')), w * 0.3, h + 0.9, d / 2 + 0.3));
  // potted olive trees flank the door
  for (const px of [-1.6, 1.6]) { g.add(at(mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 12), M(TERRA)), px, 0.25, d / 2 + 1.0)); g.add(at(mesh(new THREE.SphereGeometry(0.5, 14, 12), M(OLIVE)), px, 1.0, d / 2 + 1.0)); }
  scene.add(at(g, x, 0, -4 - d / 2));
  const r = { g, pivot, front, back, x, w, h, hero, i, door: V(x, 0, -4) }; rests.push(r); return r;
}
RESTS.forEach(([n, w, a], i) => restaurant(i, n, w, a));
const hero = rests.find(r => r.hero);
// sign flip timing: flipped early in beat 1, flipped back in beat 13 (hero stays Olive Garden)
function flipK(t, i) {
  const b = beatOf(t);
  if (b < 12) return easeOutBack((t - (0.6 + i * 0.32)) / 0.5);
  if (rests[i].hero) return 1;
  return 1 - easeOutBack((local(t, 12) - (0.5 + i * 0.3)) / 0.5);
}
onUpdate(t => rests.forEach((r, i) => { const k = flipK(t, i); r.pivot.rotation.y = Math.PI * k; r.front.visible = k < 0.5; r.back.visible = k >= 0.5; }));

// ---------- south side: stretchy-pants shop, café, houses ----------
function shop(x, z, w, name, wall, accent) {
  const g = new THREE.Group();
  g.add(at(box(w, 4.4, 6, M(wall)), 0, 2.2, 0));
  g.add(at(box(w + 0.6, 0.6, 6.6, M(TERRA)), 0, 4.6, 0));
  g.add(at(box(3.0, 1.8, 0.1, M('#d7f3ff', { roughness: 0.15 })), -1.0, 1.7, -3.02));
  g.add(at(box(1.2, 2.2, 0.1, M('#6b3e26')), w / 2 - 1.4, 1.1, -3.02));
  const pivot = at(new THREE.Group(), 0, 5.6, -3.0);
  pivot.add(box(w * 0.85, 1.2, 0.3, M('#ffffff')));
  const front = at(textPlane(name, w * 0.8, 1.0, { bg: accent, fg: '#ffffff', font: '900 80px Inter', radius: 18 }), 0, 0, -0.17); front.rotation.y = Math.PI;
  const back = at(textPlane('SOLD OUT', w * 0.8, 1.0, { bg: TOMATO, fg: '#ffffff', font: '900 90px Inter', radius: 18 }), 0, 0, 0.17);
  pivot.add(front, back); g.add(pivot);
  scene.add(at(g, x, 0, z)); return { g, pivot, front, back };
}
const pantsShop = shop(6, 8, 9, 'STRETCHY PANTS', '#d9ccff', '#5a63c9');
onUpdate(t => { const k = inBeat(t, 5) ? easeOutBack((local(t, 5) - 2.6) / 0.5) : beatOf(t) > 5 ? 1 : 0; pantsShop.pivot.rotation.y = Math.PI * k; pantsShop.front.visible = k < 0.5; pantsShop.back.visible = k >= 0.5; });
const cafe = shop(-8, 8, 9, 'CAFFÈ', CREAM, '#3c1814');
cafe.back.visible = false; // the café never sells out
// café tables on the sidewalk with breadstick baskets
const baskets = [];
for (const tx of [-11, -8, -5]) {
  const tbl = new THREE.Group();
  tbl.add(at(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24), M('#ffffff')), 0, 0.8, 0), at(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 10), M('#2f3a66')), 0, 0.4, 0));
  const um = at(mesh(new THREE.ConeGeometry(1.5, 0.6, 12), M(cyc([TOMATO, BASIL, '#ffc94a'], tx))), 0, 2.4, 0); tbl.add(um, at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), M('#2f3a66')), 0, 1.6, 0));
  const basket = new THREE.Group(); basket.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.3, 16, 1, true), M('#a9743f', { side: THREE.DoubleSide })));
  basket.position.set(0, 1.0, 0); tbl.add(basket); baskets.push(basket);
  for (const [cx, cz] of [[-1.1, 0], [1.1, 0]]) tbl.add(at(box(0.6, 0.7, 0.6, M('#e8d5b5')), cx, 0.35, cz));
  scene.add(at(tbl, tx, 0, 3.9));
}
const houses = [];
function house(x, z, facing, color, roof) {
  const g = new THREE.Group();
  g.add(at(box(5, 3.2, 4.6, M(color)), 0, 1.6, 0));
  const r = at(mesh(new THREE.ConeGeometry(4.1, 2.4, 4), M(roof)), 0, 4.4, 0); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.82); g.add(r);
  g.add(at(box(1.0, 1.8, 0.1, M('#7a4b2a')), 0, 0.9, 2.32));
  for (const wx of [-1.5, 1.5]) g.add(at(box(0.9, 0.9, 0.1, M('#cfefff')), wx, 2.0, 2.32));
  g.add(at(box(2.2, 0.2, 1.4, M('#e8d5b5')), 0, 0.1, 3.0));
  for (const hx of [-2.0, 2.0]) g.add(at(box(1.6, 0.6, 0.6, M('#5cbf6a')), hx, 0.3, 4.2));
  g.rotation.y = facing; scene.add(at(g, x, 0, z)); houses.push(g); return g;
}
for (const hx of [-30, -22, -14, 16, 24 + 10, 42]) { const n = houses.length; house(hx, 20, Math.PI, cyc(HOUSE, n), cyc(ROOF, n)); }
for (const hx of [-30, -22, -14, -6, 2, 10, 18]) { const n = houses.length; house(hx, -24, 0, cyc(HOUSE, n + 1), cyc(ROOF, n + 2)); }
for (const hx of [-76, -68, -60, -52, -44]) { const n = houses.length; house(hx, 9, Math.PI, cyc(HOUSE, n + 2), cyc(ROOF, n + 1)); house(hx, -9, 0, cyc(HOUSE, n + 4), cyc(ROOF, n + 3)); }

// ---------- walkers and cars ----------
const walkers = [];
for (let i = 0; i < 40; i++) {
  const p = person(); scene.add(p); blockers.push([p, 7]); walkers.push(p);
  const north = i % 2 === 0, dir = i % 4 < 2 ? 1 : -1, speed = 1.0 + (i % 5) * 0.12, x0 = (i * 37) % 130;
  const lane = north ? -3.7 + ((i % 3) - 1) * 0.3 : 3.9 + ((i % 3) - 1) * 0.4;
  onUpdate(t => {
    const b = beatOf(t), cheer = b === 6 || b === 12;
    const x = cheer ? wrap(x0 + dir * speed * (b * BEAT_LEN), -86, 40) : wrap(x0 + dir * speed * t, -86, 40);
    p.position.set(x, 0.16, lane); p.rotation.y = cheer ? 0 : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (cheer) hopPose(p, ((local(t, b) * 1.2 + i * 0.13) % 1)); else walkPose(p, t * speed * 7 + x0);
    p.visible = true;
    if ((b === 1 || b === 3 || b === 10) && north && x > -16 && x < 6) p.visible = false; // clear the stage in front of the hero restaurant
  });
}
const cars = [];
for (let i = 0; i < 12; i++) {
  const c = car(cyc(CARS, i * 3)); scene.add(c); blockers.push([c, 9]); cars.push(c);
  const dir = i % 2 ? 1 : -1, x0 = i * 23, sp = 5 + (i % 3);
  if (i < 8) {
    c.rotation.y = dir > 0 ? 0 : Math.PI;
    onUpdate(t => {
      const b = beatOf(t);
      const x = b === 1 ? wrap(x0 + dir * sp * BEAT_LEN, -86, 40) : wrap(x0 + dir * sp * t, -86, 40);
      const floatY = b === 7 ? 0.75 + Math.sin(t * 3 + i) * 0.12 : 0.1 + Math.abs(Math.sin(t * 9 + i)) * 0.03;
      c.position.set(x, floatY, dir > 0 ? 1.6 : -1.6); c.rotation.z = b === 7 ? Math.sin(t * 2.5 + i) * 0.08 : 0;
      c.userData.wheels.forEach(w => { w.rotation.y = -t * sp * 3.5; });
      c.visible = !((b === 1 || b === 3 || b === 10) && x > -20 && x < 16);
    });
  } else {
    const cx = i % 2 ? -36 : 24; c.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    onUpdate(t => { c.position.set(cx + (dir > 0 ? -1.4 : 1.4), 0.1 + Math.abs(Math.sin(t * 9 + i)) * 0.03, wrap(x0 + dir * sp * t, -60, 60)); c.userData.wheels.forEach(w => { w.rotation.y = -t * sp * 3.5; }); });
  }
}

// ---------- beat 2: money trucks converge on the hero door ----------
const trucks = [];
const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20);
function coin() { const c = mesh(coinGeo, M('#f4c430', { metalness: 0.4, roughness: 0.35 })); c.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(c); scene.add(g); return g; }
for (let i = 0; i < 6; i++) {
  const g = car('#8d99ae'); g.add(at(box(1.6, 1.0, 1.1, M('#5d6378')), -0.4, 1.1, 0)); g.add(at(sprite('$', 0.8, 0.8, { bg: '#f4c430', fg: '#3a2a00', font: '900 120px Inter', radius: 80, w: 160 }), -0.4, 1.3, 0.6));
  scene.add(g); trucks.push(g);
  const starts = [V(-60, 0, 1.6), V(30, 0, -1.6), V(-34.6, 0, -40), V(25.4, 0, 40), V(-34.6, 0, 40), V(25.4, 0, -40)][i];
  const slot = V(-1 + i * 2.4, 0, 1.6);
  onUpdate(t => {
    const on = inBeat(t, 1); g.visible = on; if (!on) return;
    const lt = local(t, 1), k = ease((lt - 0.2 - i * 0.25) / 1.6);
    g.position.lerpVectors(starts, slot, k); g.position.y = 0.1 + Math.abs(Math.sin(t * 9 + i)) * 0.03;
    const dx = slot.x - starts.x, dz = slot.z - starts.z;
    g.rotation.y = k < 0.98 ? Math.atan2(-dz, dx) : Math.PI;
    g.userData.wheels.forEach(w => { w.rotation.y = -t * 12; });
  });
}
const flyCoins = Array.from({ length: 10 }, () => coin());
onUpdate(t => flyCoins.forEach((c, i) => {
  const on = inBeat(t, 1); if (!on) { c.visible = false; return; }
  const lt = (local(t, 1) - 1.6 - i * 0.3); c.visible = lt > 0;
  const k = (lt * 1.2) % 1, from = V(-1 + (i % 6) * 2.4, 1.6, 1.6), to = V(hero.x, 1.2, -3.8);
  c.position.lerpVectors(from, to, k); c.position.y += Math.sin(k * Math.PI) * 4; c.rotation.y = lt * 9;
}));

// ---------- beats 3 & 9: the PARENT CO. lasagna tower ----------
const tower = new THREE.Group(); scene.add(at(tower, 34, 0, -12));
const LAYER = [PASTA, '#e85d4a', '#ffd166'];
const floors = [];
for (let f = 0; f < 22; f++) {
  const fl = new THREE.Group();
  const col = cyc(LAYER, f), hgt = f % 3 === 2 ? 0.9 : 2.0;
  fl.add(at(box(8, hgt, 8, M(col)), 0, hgt / 2, 0));
  if (f % 3 !== 2) for (let wx = -2.6; wx <= 2.6; wx += 1.3) for (const wz of [4.02, -4.02]) fl.add(at(box(0.8, 0.9, 0.1, M('#fff6c8', { emissive: '#ffd66b', emissiveIntensity: 0.3 })), wx, hgt / 2, wz));
  fl.userData.h = hgt; tower.add(fl); floors.push(fl);
}
const towerSign = new THREE.Group(); tower.add(towerSign);
towerSign.add(at(textPlane('PARENT CO.', 7.4, 1.4, { bg: '#3c1814', fg: '#ffd166', font: '900 96px Inter', radius: 24 }), 0, 0, 4.3));
{ const bk = at(textPlane('PARENT CO.', 7.4, 1.4, { bg: '#3c1814', fg: '#ffd166', font: '900 96px Inter', radius: 24 }), 0, 0, -4.3); bk.rotation.y = Math.PI; towerSign.add(bk); }
towerSign.children.forEach(m => { m.material.side = THREE.FrontSide; }); // each face reads only from its own side
const ticker = new THREE.Mesh(new THREE.BufferGeometry(), M('#19c3b1', { emissive: '#0d7d72', emissiveIntensity: 0.4 })); tower.add(ticker);
const tickerHead = sprite('STOCK ↑', 3.4, 1.0, { bg: '#19c3b1', fg: '#00332e', font: '900 96px Inter', radius: 50 }); tower.add(tickerHead);
const bigLabels = [sprite('83× BIGGER', 5.2, 1.2, { bg: '#ffc94a', fg: '#3a2a00', font: '900 96px Inter', radius: 50, w: 700 }), sprite('> WALMART', 5.2, 1.2, { bg: '#ff9f5c', fg: '#3a1a00', font: '900 96px Inter', radius: 50, w: 700 })];
bigLabels.forEach(l => tower.add(l));
const towerCloud = cloud(2.4); towerCloud.position.set(34, 30, -12);
onUpdate(t => {
  const b = beatOf(t);
  let built = 3;
  if (b === 2) built = 3 + ease(local(t, 2) / 3.2) * 6;
  else if (b > 2 && b < 8) built = 9;
  else if (b === 8) built = 9 + ease((local(t, 8) - 0.2) / 3.0) * 12;
  else if (b > 8) built = 21;
  let y = 0;
  floors.forEach((f, i) => {
    const k = clamp(built - i), sy = i < 3 ? 1 : easeOutBounce(k);
    f.visible = k > 0.01; f.position.y = y + (1 - k) * 6; f.scale.set(1 + (1 - sy) * 0.2, Math.max(0.01, sy), 1 + (1 - sy) * 0.2);
    if (f.visible) y += f.userData.h * Math.max(0.01, sy);
  });
  towerSign.position.y = y + 0.9;
  const tk = b === 8 ? clamp((local(t, 8) - 0.4) / 3.4) : 0;
  ticker.visible = tk > 0.02; tickerHead.visible = ticker.visible;
  if (ticker.visible) {
    const pts = []; const n = 60; for (let j = 0; j <= n; j++) { const u = j / n * tk, a = u * Math.PI * 7; pts.push(V(Math.cos(a) * 6.2, 2 + u * 44, Math.sin(a) * 6.2)); }
    ticker.geometry.dispose(); ticker.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.22, 8, false);
    tickerHead.position.copy(pts[pts.length - 1]).add(V(0, 1.4, 0));
  }
  bigLabels.forEach((l, i) => { const lk = b === 8 ? easeOutBack((local(t, 8) - 1.6 - i * 0.9) / 0.4) : 0; l.visible = lk > 0.01; l.scale.set(5.2 * lk, 1.2 * lk, 1); l.position.set(i ? 9 : -9, 22 + i * 8 + (b === 8 ? local(t, 8) * 1.5 : 0), 6); });
});

// ---------- beat 4: chefs trade hats for aprons ----------
const chefs = [];
const HATS = [i => { const h = new THREE.Group(); h.add(at(mesh(new THREE.ConeGeometry(0.55, 0.3, 18), M('#e6b877')), 0, 0.02, 0), at(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.25, 14), M('#e6b877')), 0, 0.15, 0)); return h; }, // sombrero
  () => at(mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 20), M('#ffffff')), 0, -0.02, 0), // headband
  () => at(mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.4, 14), M('#ffffff')), 0, 0.15, 0), // paper hat
  () => at(mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.55, 14), M('#ffffff')), 0, 0.22, 0), // toque
  () => at(mesh(new THREE.SphereGeometry(0.24, 14, 10), M('#2f4b8c')), 0, 0.05, 0), // cap
  () => { const b = mesh(new THREE.SphereGeometry(0.27, 14, 10), M('#e63946')); b.scale.y = 0.4; return at(b, 0, 0.08, 0); }]; // beret
for (let i = 0; i < 6; i++) {
  const p = person({ shirt: cyc(SHIRTS, i * 2 + 1), hat: false }); scene.add(p); chefs.push(p);
  const hat = HATS[i](i); hat.position.y = 1.22; p.add(hat);
  const apron = at(box(0.44, 0.5, 0.1, M('#ffffff')), 0, 0.55, 0.2); p.add(apron);
  const arm = at(mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), M(cyc(SKINS, i))), 0.3, 0.7, 0); p.add(arm);
  p.userData.extra = { hat, apron, arm };
  const x = -15 + i * 2.2;
  onUpdate(t => {
    const on = inBeat(t, 3); p.visible = on; if (!on) return;
    const lt = local(t, 3), st = 0.7 + i * 0.4, k = clamp((lt - st) / 0.5);
    p.position.set(x, 0.16, -3.2); p.rotation.y = 0;
    hat.position.y = 1.22 + easeOutBack(k) * 3.0 + k * k * 2; hat.rotation.z = k * 4; hat.visible = k < 1;
    const ak = easeOutBack((lt - st - 0.15) / 0.4); apron.scale.setScalar(Math.max(0.01, ak)); apron.visible = ak > 0.01;
    const wave = lt > st + 0.6 ? Math.sin((lt - st) * 12) * 0.5 : 0; arm.rotation.z = -2.4 + wave; arm.position.set(0.32, 0.75, 0);
    arm.rotation.z = lt > st + 0.6 ? -2.6 + wave : 0;
    p.userData.body.position.y = 0.6 + (lt > st + 0.6 ? Math.abs(Math.sin((lt - st) * 6)) * 0.08 : 0);
  });
}

// ---------- beat 5: breadstick conveyor belt and raining breadsticks ----------
const belt = new THREE.Group(); scene.add(belt);
{
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#3a3f52'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#5d6378'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 16, 32);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(40, 1);
  const top = mesh(new THREE.PlaneGeometry(74, 1.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); top.rotation.x = -Math.PI / 2; belt.add(at(top, -4, 0.42, 0));
  belt.add(at(box(74, 0.3, 1.5, M('#2f3a66')), -4, 0.25, 0));
  for (let x = -40; x <= 32; x += 6) belt.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8), M('#2f3a66')), x, 0.15, 0));
  belt.userData.tex = tex;
}
const stickGeo = new THREE.CapsuleGeometry(0.14, 0.9, 4, 10), stickMat = M(BREAD, { roughness: 0.75 });
const beltSticks = Array.from({ length: 48 }, (_, i) => { const s = mesh(stickGeo, stickMat); s.rotation.z = Math.PI / 2 + 0.2; belt.add(s); return s; });
const rainSticks = Array.from({ length: 12 }, () => { const s = mesh(stickGeo, stickMat); scene.add(s); return s; });
const refillDing = sprite('REFILL!', 2.2, 0.8, { bg: '#ffc94a', fg: '#3a2a00', font: '900 96px Inter', radius: 50 }); scene.add(refillDing);
onUpdate(t => {
  const b = beatOf(t), on = b >= 4 && b <= 9 && b !== 7;
  belt.visible = on; if (on) { belt.userData.tex.offset.x = -t * 0.9; beltSticks.forEach((s, i) => { s.position.set(wrap(-40 + i * 1.5 + t * 3, -41, 33), 0.6, Math.sin(i) * 0.15); s.rotation.y = i * 0.6; }); }
  const rain = inBeat(t, 4);
  rainSticks.forEach((s, i) => {
    s.visible = rain; if (!rain) return;
    const lt = local(t, 4) - 0.5 - i * 0.3, cycle = 2.2, k = ((lt % cycle) + cycle) % cycle / 1.2;
    const bk = baskets[i % 3], bw = bk.parent.position.clone().add(bk.position);
    s.visible = lt > 0 && k < 1;
    s.position.set(bw.x + Math.sin(i) * 0.25, lerp(9, bw.y + 0.3, easeOutBounce(k)), bw.z + Math.cos(i) * 0.25); s.rotation.set(k * 3, i, 0.3);
  });
  refillDing.visible = rain && local(t, 4) > 3.4; refillDing.position.set(-8, 3.6, 3.9); const rk = easeOutBack((local(t, 4) - 3.4) / 0.3); refillDing.scale.set(2.2 * rk, 0.8 * rk, 1);
});
// breadsticks sitting in the baskets all the time
baskets.forEach(bk => { for (let i = 0; i < 5; i++) { const s = mesh(stickGeo, stickMat); s.scale.setScalar(0.7); s.position.set(Math.sin(i * 1.3) * 0.15, 0.5, Math.cos(i * 1.3) * 0.15); s.rotation.set(0.25 * Math.sin(i), i, 0.25 * Math.cos(i)); bk.add(s); } });

// ---------- beat 6: belt buckles pop off the laundry line ----------
const laundry = new THREE.Group(); scene.add(at(laundry, -22, 0, 14));
laundry.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.14, 4, 10), M('#9a6a45')), -5, 2, 0), at(mesh(new THREE.CylinderGeometry(0.12, 0.14, 4, 10), M('#9a6a45')), 5, 2, 0));
laundry.add(at(box(10, 0.06, 0.06, M('#2f3a66')), 0, 3.9, 0));
const buckles = [];
for (let i = 0; i < 4; i++) {
  const pants = new THREE.Group();
  pants.add(at(box(1.1, 0.9, 0.2, M(cyc(['#3f8fd8', '#2f4b8c', '#7b6cf6', '#5a63c9'], i))), 0, -0.45, 0));
  for (const lx of [-0.3, 0.3]) pants.add(at(box(0.45, 1.3, 0.2, M(cyc(['#3f8fd8', '#2f4b8c', '#7b6cf6', '#5a63c9'], i))), lx, -1.5, 0));
  const buckle = at(box(0.5, 0.4, 0.14, M('#f4c430', { metalness: 0.5, roughness: 0.3 })), 0, -0.2, 0.15); pants.add(buckle);
  laundry.add(at(pants, -3.6 + i * 2.4, 3.9, 0)); buckles.push(buckle);
  onUpdate(t => {
    const on = inBeat(t, 5); const lt = local(t, 5) - 0.5 - i * 0.5;
    pants.rotation.z = Math.sin(t * 1.6 + i) * 0.06;
    if (!on || lt < 0) { buckle.position.set(0, -0.2, 0.15); buckle.rotation.set(0, 0, 0); buckle.scale.setScalar(1); return; }
    const k = clamp(lt / 1.2);
    buckle.position.set(lerp(0, -1 + i * 0.6, k), lerp(-0.2, -3.7, easeOutBounce(k)) + Math.sin(k * Math.PI) * 2.6, lerp(0.15, -6 - i, k));
    buckle.rotation.set(lt * 6, lt * 3, 0);
  });
}

// ---------- beat 7: golden passes fall like confetti ----------
const passes = [];
for (let i = 0; i < 44; i++) {
  const p = new THREE.Group();
  p.add(mesh(new THREE.BoxGeometry(0.9, 0.03, 0.5), M('#f4c430', { metalness: 0.5, roughness: 0.3 })));
  p.add(at(mesh(new THREE.BoxGeometry(0.5, 0.035, 0.08), M('#3c1814')), 0, 0.01, 0.1));
  scene.add(p); passes.push(p);
  const x = -30 + (i * 7.3) % 48, z = -4 + (i * 3.1) % 9, ph = i * 0.7;
  onUpdate(t => {
    const on = inBeat(t, 6); p.visible = on; if (!on) return;
    const lt = local(t, 6) + ph * 0.4, fall = (lt * 0.28) % 1;
    p.position.set(x + Math.sin(lt * 2 + ph) * 0.8, lerp(22, 0.3, fall), z + Math.cos(lt * 1.7 + ph) * 0.6);
    p.rotation.set(Math.sin(lt * 3 + ph) * 0.8, lt * 2, Math.cos(lt * 2.5 + ph) * 0.6);
  });
}

// ---------- beat 8: the giant never-ending bowl and the spaghetti river ----------
const bowl = new THREE.Group(); scene.add(at(bowl, 52, 0, 0));
{
  const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(lerp(2.5, 7.5, Math.sin(u * Math.PI / 2)), u * 6)); }
  const b = mesh(new THREE.LatheGeometry(pts, 48), M(CREAM, { side: THREE.DoubleSide })); bowl.add(b);
  bowl.add(at(mesh(new THREE.TorusGeometry(7.5, 0.45, 12, 48), M(TOMATO)), 0, 6, 0));
  bowl.add(at(mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.6, 32), M(CREAM)), 0, 0.3, 0));
  const pasta = mesh(new THREE.SphereGeometry(7.0, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), M(PASTA, { roughness: 0.6 })); pasta.scale.y = 0.45; bowl.add(at(pasta, 0, 5.6, 0)); bowl.userData.pasta = pasta;
  for (let i = 0; i < 7; i++) bowl.add(at(mesh(new THREE.SphereGeometry(0.9, 16, 12), M('#8a4b2a')), Math.cos(i * 0.9) * 3.5, 8.0, Math.sin(i * 0.9) * 3.5));
  bowl.add(at(textPlane('NEVER ENDING', 9, 1.3, { bg: '#3c1814', fg: '#ffd166', font: '900 90px Inter', radius: 24 }), 0, 3.4, 7.2));
}
const river = new THREE.Mesh(new THREE.BufferGeometry(), M(PASTA, { roughness: 0.55 })); scene.add(river);
const meatballs = Array.from({ length: 6 }, () => { const m = mesh(new THREE.SphereGeometry(0.7, 14, 10), M('#8a4b2a')); scene.add(m); return m; });
onUpdate(t => {
  const b = beatOf(t), on = b === 7 || b === 8 || b === 9;
  const k = b === 7 ? ease((local(t, 7) - 0.3) / 3.2) : b > 7 ? 1 : 0;
  bowl.userData.pasta.position.y = 5.6 + (b === 7 ? Math.sin(local(t, 7) * 6) * 0.3 * (1 - k) + k * 0.5 : b > 7 ? 0.5 : 0);
  river.visible = on && k > 0.02;
  if (river.visible) {
    const len = lerp(0, 96, k), pts = [V(50, 7.5, 0), V(45, 2.5, 0), V(42, 0.6, 0)];
    for (let x = 40; x > 44 - len; x -= 4) pts.push(V(x, 0.55 + Math.sin(x * 0.4 + t * 2) * 0.1, Math.sin(x * 0.25) * 0.7));
    river.geometry.dispose(); river.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 1.1, 12, false);
  }
  meatballs.forEach((m, i) => { m.visible = river.visible; if (!m.visible) return; const x = wrap(40 - (t * 4 + i * 14), 44 - lerp(0, 96, k), 40); m.position.set(x, 1.4 + Math.sin(t * 3 + i) * 0.15, Math.sin(x * 0.25) * 0.7); m.rotation.set(t, i, 0); });
});

// ---------- beat 10: a little Earth with breadstick rings ----------
const earth = new THREE.Group(); scene.add(at(earth, 0, 46, -42));
{
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#5aaef0'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#6fc46a';
  const r2 = (s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; })(11);
  for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(r2() * 512, 40 + r2() * 176, 20 + r2() * 50, 14 + r2() * 30, r2() * 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 14); g.fillRect(0, 242, 512, 14);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const globe = mesh(new THREE.SphereGeometry(7, 48, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); earth.add(globe); earth.userData.globe = globe;
  for (const [r, tilt] of [[10, 0.4], [12.5, -0.3]]) {
    const ring = new THREE.Group(); ring.rotation.x = tilt;
    for (let i = 0; i < 26; i++) { const s = mesh(stickGeo, stickMat); const a = i / 26 * Math.PI * 2; s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); s.rotation.y = -a; s.rotation.z = Math.PI / 2; s.scale.setScalar(1.3); ring.add(s); }
    earth.add(ring); (earth.userData.rings ||= []).push(ring);
  }
}
const moon = mesh(new THREE.SphereGeometry(2.4, 32, 24), M('#e9e4d8', { roughness: 0.95 })); scene.add(at(moon, 15, 56, -50));
for (let i = 0; i < 5; i++) { const cr = mesh(new THREE.CircleGeometry(0.3 + (i % 3) * 0.15, 16), M('#cfc8ba')); cr.position.set(Math.sin(i * 1.9) * 1.6, Math.cos(i * 1.3) * 1.6, 1.4 + (i % 2) * 0.3); cr.lookAt(cr.position.clone().multiplyScalar(2).add(moon.position.clone().negate().add(moon.position))); moon.add(cr); }
const moonLabel = sprite('MOON', 2.4, 0.8, { bg: '#ffffff', fg: '#3c1814', font: '900 100px Inter', radius: 40 }); scene.add(at(moonLabel, 15, 60, -50));
const chain = Array.from({ length: 34 }, () => { const s = mesh(stickGeo, stickMat); s.scale.setScalar(1.2); scene.add(s); return s; });
onUpdate(t => {
  const on = inBeat(t, 9); earth.visible = on; moon.visible = on; moonLabel.visible = on; chain.forEach(c => c.visible = false); if (!on) return;
  const lt = local(t, 9); earth.scale.setScalar(Math.max(0.01, easeOutBack(lt / 0.7)));
  const mk = easeOutBack((lt - 0.8) / 0.5); moon.scale.setScalar(Math.max(0.01, mk)); moonLabel.scale.set(2.4 * mk, 0.8 * mk, 1);
  const reach = clamp((lt - 1.4) / 2.2);
  chain.forEach((c, i) => {
    const u = (i + 0.5) / chain.length; c.visible = u < reach;
    const a = V(0, 46, -42).lerp(V(15, 56, -50), u); a.y += Math.sin(u * Math.PI) * 6 + Math.sin(t * 4 + i) * 0.2;
    c.position.copy(a); c.rotation.set(0, 0, 0); c.lookAt(V(15, 56, -50)); c.rotateX(Math.PI / 2);
  });
  earth.userData.globe.rotation.y = lt * 0.5; earth.userData.rings.forEach((r, i) => { r.rotation.y = lt * (i ? -0.7 : 0.9); });
});

// ---------- beat 11: the price creeps, the inspector knocks ----------
const menuBoard = new THREE.Group(); scene.add(at(menuBoard, hero.x + 5.0, 0, -2.2));
onUpdate(t => { menuBoard.visible = !inBeat(t, 3); });
menuBoard.add(at(box(0.12, 2.6, 0.12, M('#2f3a66')), 0, 1.3, 0));
menuBoard.add(at(textPlane('LIFETIME\nPASTA PASS\n$500', 2.6, 2.0, { bg: CREAM, fg: '#3c1814', font: '900 56px Inter', radius: 18, border: '#3c1814', w: 512, h: 400, pad: 8 }), 0, 2.3, 0.08));
const priceTag = sprite('$', 1.4, 0.9, { bg: TOMATO, fg: '#ffffff', font: '900 110px Inter', radius: 50 }); menuBoard.add(at(priceTag, 0, 4.0, 0.2));
const PRICE_TEX = ['∞ PASTA', '∞ SOUP', '∞ SALAD', '∞ BREADSTICKS', 'FOR LIFE'].map(s => sprite(s, 1.6 + s.length * 0.22, 0.9, { bg: '#f4c430', fg: '#3a2a00', font: '900 100px Inter', radius: 50, w: 900 }));
PRICE_TEX.forEach((s, i) => { menuBoard.add(at(s, 0, 4.0, 0.2)); s.visible = false; s.userData.len = ['∞ PASTA', '∞ SOUP', '∞ SALAD', '∞ BREADSTICKS', 'FOR LIFE'][i].length; });
priceTag.visible = false;
const inspector = person({ shirt: '#ff7aa2', hat: true, hatColor: '#ffc94a' }); scene.add(inspector);
const glass = new THREE.Group(); glass.add(mesh(new THREE.BoxGeometry(0.9, 0.03, 0.5), M('#f4c430', { metalness: 0.5, roughness: 0.3 }))); glass.rotation.x = Math.PI / 2; glass.position.set(0.42, 1.0, 0.2); inspector.add(glass); // the golden pass held up high
onUpdate(t => {
  const on = inBeat(t, 10); inspector.visible = on; PRICE_TEX.forEach(s => s.visible = false); if (!on) return;
  const lt = local(t, 10), idx = Math.min(4, Math.max(0, Math.floor((lt - 1.0) / 0.5) + 1));
  const s = PRICE_TEX[lt < 1.0 ? 0 : idx]; s.visible = lt > 0.4; const pk = easeOutBack(((lt - 1.0) % 0.5) / 0.25), base = 1.6 + s.userData.len * 0.22;
  s.scale.set(base * (lt < 1 ? easeOutBack((lt - 0.4) / 0.4) : 0.9 + 0.1 * pk), 0.9 * (lt < 1 ? easeOutBack((lt - 0.4) / 0.4) : 0.9 + 0.1 * pk), 1);
  const k = ease(lt / 2.2); inspector.position.set(lerp(hero.x + 9, hero.x + 2.4, k), 0.16, -3.0); inspector.rotation.y = k < 0.98 ? -Math.PI / 2 : 0;
  if (k < 0.98) walkPose(inspector, lt * 8); else hopPose(inspector, ((lt - 2.2) * 1.5) % 1);
  glass.rotation.z = k < 0.98 ? 0 : Math.sin(lt * 10) * 0.4;
});

// ---------- beat 12: Italy, the last island of variety ----------
const italy = new THREE.Group(); scene.add(at(italy, -20, 0, -150));
{
  const water = mesh(new THREE.CircleGeometry(62, 64), M('#6fc1f2', { roughness: 0.25 }), { cast: false }); water.rotation.x = -Math.PI / 2; italy.add(at(water, 0, 0.03, 20));
  const shape = new THREE.Shape(); // a friendly boot
  shape.moveTo(-6, 14); shape.lineTo(2, 14); shape.lineTo(4, 4); shape.lineTo(10, -6); shape.lineTo(14, -8); shape.lineTo(12, -12); shape.lineTo(2, -10); shape.lineTo(-2, -2); shape.lineTo(-8, 6); shape.lineTo(-6, 14);
  const land = mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.5, bevelSegments: 3 }), M('#9ad584')); land.rotation.x = -Math.PI / 2; italy.add(at(land, 0, 0.1, 0));
  for (const [x, z] of [[-3, 10], [0, 6], [3, 0], [7, -5], [-5, 3]]) { const c = at(mesh(new THREE.ConeGeometry(0.7, 4, 12), M('#3f8f5a')), x, 3.3, -z); italy.add(c); }
  const tt = car('#ffd166'); tt.add(at(box(1.6, 1.0, 1.1, M('#e63946')), -0.4, 1.1, 0)); tt.add(at(sprite('TACOS', 1.8, 0.6, { bg: '#ffffff', fg: '#e63946', font: '900 96px Inter', radius: 40 }), -0.4, 2.0, 0)); tt.scale.setScalar(1.3); tt.rotation.y = -0.4; italy.add(at(tt, 1, 1.3, -10));
  const sb = new THREE.Group(); sb.add(at(box(3.6, 2.4, 3, M('#c6e2ff')), 0, 1.2, 0), at(box(4, 0.5, 3.4, M(TERRA)), 0, 2.6, 0), at(sprite('SUSHI', 2.2, 0.7, { bg: '#ffffff', fg: '#2f4b8c', font: '900 96px Inter', radius: 40 }), 0, 3.5, 0)); italy.add(at(sb, 7, 1.3, 0));
  const pz = new THREE.Group(); pz.add(at(box(3.2, 2.4, 3, M('#ffe28a')), 0, 1.2, 0), at(box(3.6, 0.5, 3.4, M(TERRA)), 0, 2.6, 0), at(sprite('PIZZA', 2.2, 0.7, { bg: '#ffffff', fg: '#e63946', font: '900 96px Inter', radius: 40 }), 0, 3.5, 0)); italy.add(at(pz, -4, 1.3, -6));
  italy.add(at(sprite('LAST STOP FOR VARIETY', 9, 1.2, { bg: '#3c1814', fg: '#ffd166', font: '900 80px Inter', radius: 50, w: 1200 }), 2, 9, 2));
}
const boats = [];
for (let i = 0; i < 6; i++) {
  const b = new THREE.Group();
  b.add(at(box(2.4, 0.7, 1.1, M(cyc(['#f26b5b', '#3f8fd8', '#ffc94a', '#2bb3a3'], i))), 0, 0.35, 0), at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), M('#9a6a45')), 0, 1.6, 0));
  const sail = mesh(new THREE.PlaneGeometry(1.4, 1.6), M('#ffffff', { side: THREE.DoubleSide })); b.add(at(sail, 0.7, 1.9, 0));
  const rider = person({ hat: false }); rider.scale.setScalar(0.7); b.add(at(rider, -0.5, 0.6, 0)); const rider2 = person({ hat: false }); rider2.scale.setScalar(0.7); b.add(at(rider2, 0.4, 0.6, 0));
  scene.add(b); boats.push(b);
  const sx = -34 + i * 7, sz = -80 - (i % 3) * 8;
  onUpdate(t => {
    const on = inBeat(t, 11); b.visible = on; if (!on) return;
    const lt = local(t, 11), k = lt / 6.0;
    b.position.set(lerp(sx, -20 + (i - 2.5) * 5, k), 0.15 + Math.sin(t * 2.4 + i) * 0.12, lerp(sz, -132, k)); b.rotation.set(Math.sin(t * 2 + i) * 0.06, Math.PI / 2 + (i - 2.5) * 0.1, Math.sin(t * 1.7 + i) * 0.05);
  });
}

// ---------- end card: a fork in the road with mystery signs ----------
const endSet = new THREE.Group(); scene.add(at(endSet, 0, 0, 150));
{
  const roadM = M('#5d6378');
  endSet.add(at(box(6, 0.12, 30, roadM), 0, 0.06, 15));
  for (const s of [-1, 1]) { const r = at(box(6, 0.12, 34, roadM), s * 8, 0.06, -12); r.rotation.y = s * 0.5; endSet.add(r); }
  const arches = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); const col = s < 0 ? '#ffb15c' : '#c9a2ff';
    a.add(at(box(0.5, 7, 0.5, M(col)), -3.4, 3.5, 0), at(box(0.5, 7, 0.5, M(col)), 3.4, 3.5, 0));
    a.add(at(textPlane('?', 7.4, 2.2, { bg: col, fg: '#3c1814', font: '900 130px Inter', radius: 30 }), 0, 7.6, 0.3));
    a.rotation.y = s * 0.5; endSet.add(at(a, s * 8.5, 0, -14)); arches.push(a);
  }
  endSet.userData.arches = arches;
  [[0, -6], [-2.6, -12], [2.6, -12], [0, -18]].forEach(([x, z], i) => {
    const h = new THREE.Group(); h.add(at(box(2.6, 1.8, 2.2, M(cyc(HOUSE, i))), 0, 0.9, 0), at(box(3, 0.4, 2.6, M(TERRA)), 0, 2.0, 0), at(sprite('?', 1, 1, { bg: '#ffffff', fg: '#3c1814', font: '900 120px Inter', radius: 60, w: 160 }), 0, 2.9, 0));
    endSet.add(at(h, x, 0, z));
  });
  for (let i = 0; i < 6; i++) { const s = mesh(stickGeo, stickMat); s.position.set(-2.5 + i, 0.3, 4 + Math.sin(i)); s.rotation.set(0, i, Math.PI / 2); endSet.add(s); }
}
onUpdate(t => {
  const on = beatOf(t) === 13; endSet.visible = on; if (!on) return;
  const lt = t - 13 * BEAT_LEN;
  endSet.userData.arches.forEach((a, i) => { const s = easeOutBack((lt - 0.1 - i * 0.2) / 0.4); a.scale.set(1, Math.max(0.01, s), 1); });
});

// ---------- sky life: balloon, birds, clouds ----------
const balloon = new THREE.Group();
{
  const env = mesh(new THREE.SphereGeometry(2.4, 32, 24), M('#ffc94a', { roughness: 0.6 })); env.scale.set(1, 1.15, 1); balloon.add(env);
  for (let i = 0; i < 6; i++) { const st = mesh(new THREE.SphereGeometry(2.42, 32, 24, i * Math.PI / 3, Math.PI / 12), M(TOMATO, { roughness: 0.6 })); st.scale.set(1, 1.15, 1); balloon.add(st); }
  balloon.add(at(box(1.0, 0.7, 1.0, M('#9a6a45')), 0, -3.6, 0));
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) balloon.add(at(box(0.04, 1.2, 0.04, M('#2f3a66')), x, -2.9, z));
  balloon.add(at(sprite('WHAT IF', 2.6, 0.7, { bg: '#19c3b1', fg: '#00332e', font: '900 100px Inter', radius: 40 }), 0, -4.6, 0));
}
scene.add(balloon);
onUpdate(t => { balloon.position.set(-70 + t * 1.9, 30 + Math.sin(t * 0.6) * 1.5, -46 + Math.sin(t * 0.2) * 6); balloon.rotation.y = t * 0.15; balloon.visible = beatOf(t) < 13 && !inBeat(t, 9); });
for (let f = 0; f < 3; f++) {
  const flock = new THREE.Group();
  for (let b = 0; b < 5; b++) {
    const bird = new THREE.Group();
    const wl = at(box(0.6, 0.05, 0.22, M('#2f3a66')), -0.3, 0, 0), wr = at(box(0.6, 0.05, 0.22, M('#2f3a66')), 0.3, 0, 0);
    bird.add(wl, wr); bird.userData = { wl, wr }; bird.position.set(-Math.abs(b - 2) * 1.0, Math.abs(b - 2) * 0.1, (b - 2) * 0.9); flock.add(bird);
  }
  scene.add(flock);
  onUpdate(t => {
    flock.position.set(wrap(-90 + f * 70 + t * 6, -110, 110), 26 + f * 5 + Math.sin(t + f) * 0.8, -30 + f * 22);
    flock.children.forEach((bd, i) => { const a = Math.sin(t * 10 + i) * 0.5; bd.userData.wl.rotation.z = a; bd.userData.wr.rotation.z = -a; });
    flock.visible = !inBeat(t, 9);
  });
}
for (let i = 0; i < 9; i++) {
  const c = cloud(1.6 + (i % 3) * 0.5), z = -80 + (i % 4) * 16, y = 36 + (i % 3) * 5, x0 = i * 23;
  onUpdate(t => { c.position.set(wrap(x0 + t * 1.2, -100, 100), y, z); c.visible = !inBeat(t, 9); });
}

// ---------- cameras: one new angle per beat ----------
const HX = hero.x;
setShots([
  { p0: V(-10, 42, 52), p1: V(-9, 36, 42), t0: V(-7, 3, -9), t1: V(-7, 3, -9) },                       // 1 wide push-in on Main Street
  { p0: V(1, 30, 1.5), p1: V(4, 26, 1.5), t0: V(1, 0, -0.5), t1: V(4, 0, -0.5), up: V(1, 0, 0) },                            // 2 high angle over the queue of trucks
  { p0: V(58, 4, -38), p1: V(54, 8, -34), t0: V(34, 5, -12), t1: V(34, 14, -12) },                            // 3 tilt up the lasagna tower
  { p0: V(12, 3.2, 2.6), p1: V(4, 2.8, 1.6), t0: V(-8, 1.4, -3.2), t1: V(-10, 1.4, -3.2) },                 // 4 dolly along the chef line
  { p0: V(6, 3.4, 1.0), p1: V(2, 3.0, 1.2), t0: V(-8, 1.4, 2.6), t1: V(-8, 1.4, 2.6) },                   // 5 over-the-shoulder at the café
  { custom: (t, lt) => { // 6 laundry line, then a snap zoom to the shop window
      if (lt < 2.3) { camera.position.set(-27 + lt * 1.5, 3.4, 3.0); lookTarget.set(-22, 2.4, 14); }
      else { const k = easeOutBack((lt - 2.3) / 0.6); camera.position.lerpVectors(V(9, 18, -22), V(6.5, 12, -14), k); lookTarget.set(6, 4.0, 5); }
      camera.lookAt(lookTarget); } },
  { p0: V(-12, 20, 14), p1: V(-4, 17, 12), t0: V(-6, 2, -1), t1: V(-4, 2, -1) },                           // 7 high angle, confetti
  { orbit: { c: V(50, 5, 0), r: 44, h: 18, a0: 2.2, a1: 1.3 } },                                           // 8 orbit the giant bowl
  { p0: V(66, 8, 22), p1: V(66, 44, 22), t0: V(34, 8, -12), t1: V(34, 40, -12) },                          // 9 crane up the tower
  { p0: V(4, 48, 14), p1: V(6, 52, 34), t0: V(5, 49, -45), t1: V(6, 49, -45) },                            // 10 pull out from the little Earth
  { p0: V(HX + 5, 5.6, 15), p1: V(HX + 4.8, 5.0, 12.5), t0: V(HX + 3.8, 2.6, -3.0), t1: V(HX + 3.8, 2.6, -3.0) }, // 11 close on the menu board
  { p0: V(-20, 14, -78), p1: V(-20, 11, -92), t0: V(-20, 3, -150), t1: V(-20, 3, -150) },                 // 12 wide over the water to Italy
  { p0: V(-6, 6, 14), p1: V(0, 52, 92), t0: V(-6, 4, 0), t1: V(-4, 6, -8) },                              // 13 pull back
  { p0: V(0, 15, 190), p1: V(0, 15, 190), t0: V(0, 4, 140), t1: V(0, 4, 140) },                           // end card
]);

// ---------- overlay ----------
setOverlay(t => {
  const b = beatOf(t), isEnd = b === 13;
  document.querySelectorAll('#progress i').forEach((el, i) => { el.className = i < b ? 'on' : i === b ? 'now' : ''; });
  $('stats').classList.toggle('hidden', isEnd); $('badge').classList.toggle('hidden', isEnd);
  $('caption').classList.toggle('hidden', isEnd); $('end').classList.toggle('hidden', !isEnd);
  if (isEnd) {
    const lt = t - 13 * BEAT_LEN;
    $('endQ').innerHTML = 'Which chain should <span class="a">take over the world</span> next?';
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
  if (b === 10 && lt > 1.8) { st.classList.remove('hidden'); st.style.transform = `rotate(-4deg) scale(${easeOutBack((lt - 1.8) / 0.35)})`; }
  else st.classList.add('hidden');
  const tk = $('takeaway');
  if (beat.takeaway && lt > 1.0) { tk.classList.remove('hidden'); setText(tk, beat.takeaway); tk.style.transform = `scale(${easeOutBack((lt - 1.0) / 0.4)})`; }
  else tk.classList.add('hidden');
});

start();
