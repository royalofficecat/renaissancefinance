// Beat 12: Palm Springs. Shaded courtyards and misting cooling towers; a crowded sunny wall where dozens of
// cats refuse to share, beside a vast, empty estate where a single cat sleeps in its own pool of sun.
// (A pet cat's home range averages about 3.6 hectares: Kays et al. 2020.) The camera pans from one to the other.
import * as THREE from 'three';
import { C, S, backdrop, clay, glossy, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { mesh, palmTree, rbox, shrub } from '../lib/props.js';
import { basePlate, pool } from '../lib/town.js';
import { beatMove, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { clamp, rng } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [1380, 1500];

/** Soft additive pool of gold sunlight on the ground (a sun estate). */
function sunPool(w, d) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: tone(C.gold, 1.0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; varying vec2 vUv; void main(){ vec2 q = (vUv - 0.5) * 2.0; float d = length(q); gl_FragColor = vec4(uCol * (1.0 - smoothstep(0.35, 1.0, d)) * 0.26, 1.0); }',
  });
  m.toneMapped = false;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), m);
  p.renderOrder = 6;
  return p;
}

/** A mid-century house: flat roof with a deep overhang, glass wall, a breeze-block screen. */
function modernHouse({ w = 4, d = 2.4, h = 1.2 } = {}) {
  const g = new THREE.Group();
  const wall = clay(tone(C.cream, 1, 0.2), 0.8);
  g.add(mesh(rbox(w, h, d, 0.03), wall, { pos: [0, h / 2, 0] }));
  g.add(mesh(rbox(w + 0.8, 0.12, d + 0.8, 0.03), clay(tone(C.cream, 1, 0.35), 0.7), { pos: [0, h + 0.06, 0.15] }));
  g.add(mesh(new THREE.PlaneGeometry(w * 0.6, h * 0.75), glossy(tone(C.blue, 0.5), { roughness: 0.1 }), { pos: [w * 0.12, h * 0.42, d / 2 + 0.01], cast: false }));
  const screen = clay(S.terra, 0.7);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) g.add(mesh(rbox(0.16, 0.16, 0.08, 0.02), screen, { pos: [-w / 2 + 0.25 + i * 0.2, 0.2 + j * 0.24, d / 2 + 0.04], cast: false }));
  return g;
}

export async function createPalms(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.4, horizon: tone(C.blue, 1, 0.34), top: tone(C.blue, 0.9) });
  scene.fog = new THREE.Fog(tone(C.blue, 1, 0.42), 30, 130);
  const R = rng(12);
  const sand = mixc(tone(C.cream, 0.88), C.terra, 0.1);
  scene.add(basePlate({ w: 20, d: 12, ground: sand }));
  // San Jacinto behind, hazy
  for (const [x, z, sx, sy, sz] of [[-30, -95, 40, 14, 12], [12, -110, 50, 19, 14], [52, -90, 34, 11, 11]]) {
    const m = mesh(new THREE.SphereGeometry(1, 40, 20), clay(mixc(tone(C.cream, 0.8), C.terra, 0.15), 0.9), { pos: [x, -1, z], cast: false });
    m.scale.set(sx, sy, sz); scene.add(m);
  }

  // ---------- left: the crowded sunny wall, cats packed shoulder to shoulder in the one strip of sun
  const wallM = clay(tone(C.cream, 0.97), 0.85);
  scene.add(mesh(rbox(6.0, 0.9, 0.5, 0.05), wallM, { pos: [-5.0, 0.45, -0.9] }));
  scene.add(mesh(rbox(6.2, 0.1, 0.62, 0.04), clay(S.terra, 0.75), { pos: [-5.0, 0.95, -0.9] }));
  const strip = sunPool(6.8, 1.6); strip.position.set(-5.0, 0.03, -0.1); scene.add(strip);
  const top = sunPool(6.4, 0.9); top.position.set(-5.0, 1.02, -0.9); scene.add(top);
  const crowd = [];
  const coats = ['ginger', 'cream', 'ginger2'];
  for (let i = 0; i < 14; i++) {
    const c = makeCat({ pose: i % 4 === 3 ? 'loaf' : 'sit', coat: coats[(i * 7) % 3], seed: 160 + i, lod: 'lo' });
    c.group.scale.setScalar(0.5); c.group.position.set(-7.75 + i * 0.4 + (R() - 0.5) * 0.06, 1.0, -0.9 + (R() - 0.5) * 0.08); c.group.rotation.y = (R() - 0.5) * 0.6;
    scene.add(c.group); crowd.push(c);
  }
  for (let i = 0; i < 16; i++) {
    const c = makeCat({ pose: ['sit', 'loaf', 'sprawl', 'sit'][i % 4], coat: coats[(i * 5 + 1) % 3], seed: 180 + i, lod: 'lo' });
    c.group.scale.setScalar(0.52); c.group.position.set(-7.8 + i * 0.37 + (R() - 0.5) * 0.1, 0.02, -0.1 + (R() - 0.5) * 0.7); c.group.rotation.y = (R() - 0.5) * 1.4;
    scene.add(c.group); crowd.push(c);
  }
  // a shaded courtyard with a sail, a misting cooling tower, the neighbours' house
  const house1 = modernHouse({ w: 3.6, d: 2.2 }); house1.position.set(-5.4, 0, -3.4); scene.add(house1);
  const sail = mesh(new THREE.PlaneGeometry(3.0, 2.2).rotateX(-Math.PI / 2 + 0.12), clay(tone(C.cream, 1, 0.4), 0.8, { side: THREE.DoubleSide }), { pos: [-1.9, 2.0, -2.6] });
  scene.add(sail);
  for (const [x, z] of [[-3.3, -3.6], [-0.5, -3.6], [-3.3, -1.6], [-0.5, -1.6]]) scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.05, 8), clay(S.woodDark, 0.6), { pos: [x, 1.02, z] }));
  const tower = new THREE.Group();
  tower.add(mesh(new THREE.CylinderGeometry(0.42, 0.52, 2.2, 28), clay(tone(C.cream, 1, 0.25), 0.7), { pos: [0, 1.1, 0] }));
  for (const y of [0.6, 1.3, 2.0]) tower.add(mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 28), clay(S.terra, 0.6), { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] }));
  tower.position.set(-1.0, 0, -4.4);
  scene.add(tower);
  const mist = [];
  const mistMat = new THREE.MeshStandardMaterial({ color: tone(C.cream, 1, 0.6), transparent: true, opacity: 0.35, roughness: 1, depthWrite: false });
  for (let i = 0; i < 6; i++) { const m = mesh(new THREE.SphereGeometry(0.3, 14, 10), mistMat.clone(), { cast: false }); scene.add(m); mist.push(m); }

  // ---------- right: the vast empty estate, a single cat asleep in the middle of its own sun
  const estate = new THREE.Group();
  estate.position.set(5.0, 0, -0.6);
  scene.add(estate);
  estate.add(mesh(rbox(8.4, 0.05, 6.4, 0.03), clay(S.green, 0.85), { pos: [0, 0.03, 0], cast: false }));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const hedge = shrub({ r: 0.22, stem: 0, seed: i, dark: true });
    hedge.position.set(Math.cos(a) * 4.0 * 1.0, 0.04, Math.sin(a) * 3.0);
    estate.add(hedge);
  }
  const big = pool({ w: 2.6, d: 1.3 }); big.position.set(2.2, 0.04, -1.6); estate.add(big);
  const villa = modernHouse({ w: 4.6, d: 2.4, h: 1.3 }); villa.position.set(-0.8, 0, -4.4); estate.add(villa);
  const gold = sunPool(3.2, 2.6); gold.position.set(-0.4, 0.07, 0.6); estate.add(gold);
  const loner = makeCat({ pose: 'curl', coat: 'ginger', seed: 199 });
  loner.group.scale.setScalar(0.7); loner.group.position.set(-0.4, 0.06, 0.6); loner.state.open = 0;
  estate.add(loner.group);
  for (const [x, z, h, sd] of [[-7.6, 2.4, 4.6, 3], [-9.0, -2.4, 5.4, 5], [9.0, 2.2, 5.0, 7], [8.6, -3.8, 4.4, 9], [0.6, 3.6, 4.2, 11]]) { const p = palmTree({ h, seed: sd }); p.scale.setScalar(0.85); p.position.set(x, 0, z); scene.add(p); }
  // a gardener (human) tending the estate's edge, for the one cat
  const gardener = makeHuman({ pose: 'stand', seed: 200, scale: 1.65, shirt: 2, skin: 3, hair: 1, cut: 0 });
  gardener.group.position.set(8.4, 0, 1.2); gardener.group.rotation.y = -1.8;
  scene.add(gardener.group);

  const labels = placeLabels([{ id: 'ps', text: 'Palm Springs', pos: [-1.6, 3.2, -4.4] }]);
  await labels.sync();
  const lights = rig(scene, pipe.renderer, { size: 12, dist: 50, intensity: 6.0, fillK: 0.22, rimK: 0.3 });
  lights.follow(new THREE.Vector3(0, 0, 0), 12);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [-3.7, 4.8, 9.6], target: [-4.0, 0.7, -0.4], lens: 35 };
  const B = { pos: [3.9, 5.4, 9.6], target: [4.3, 0.3, -0.4], lens: 35 };
  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B, { via: [0, 5.6, 10.4] }));
      // the crowd jostles: heads turn to glare at neighbours
      crowd.forEach((c, i) => { c.look(Math.sin(t * 1.3 + i * 1.7) * 0.7, 0.05, Math.sin(t * 0.9 + i) * 0.1); c.update(t + i * 0.7); });
      loner.update(t);
      gardener.update(t);
      mist.forEach((m, i) => {
        const ph = ((t * 0.35 + i / mist.length) % 1);
        m.position.set(-1.0 + Math.sin(i * 2.1) * 0.25 * ph, 2.3 + ph * 1.6, -4.4 + Math.cos(i * 1.3) * 0.25 * ph);
        m.scale.setScalar(0.6 + ph * 1.4);
        m.material.opacity = 0.3 * (1 - ph);
      });
      labels.update(cam, { ps: clamp((t - 0.8) / 0.5) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.24, exposure: 1.0, vignette: 0.24 };
    },
  };
}
