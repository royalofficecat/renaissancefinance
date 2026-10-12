// Look-development lab (not in the video): every cat pose and coat, and the human figures, on a plain floor.
// Render with: node render/stills.mjs out/cat-kingdom/lab 0 1 2 3 --video=cat-kingdom --q=lab=1 --dpr=1
import * as THREE from 'three';
import { C, S, backdrop, clay, rig, tone } from '../look.js';
import { makeCat, CAT_POSES } from '../lib/cat.js';
import { applyCam } from '../../../src/core/camera.js';

export async function createLab(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), clay(tone(C.cream, 0.9), 0.8));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const lights = rig(scene, pipe.renderer, { size: 4, dist: 20 });
  lights.follow(new THREE.Vector3(0, 0, 0), 4);

  const cats = [];
  CAT_POSES.forEach((pose, i) => {
    const coat = ['ginger', 'cream', 'ginger2'][i % 3];
    const c = makeCat({ pose, coat, seed: i + 1 });
    c.group.position.set((i % 3 - 1) * 1.25, 0, Math.floor(i / 3) * -1.4 + 0.6);
    scene.add(c.group);
    cats.push(c);
  });
  let humans = [];
  try {
    const { makeHuman, HUMAN_POSES } = await import('../lib/human.js');
    HUMAN_POSES.forEach((pose, i) => {
      const h = makeHuman({ pose, seed: i + 3, scale: 2.6 });
      h.group.position.set(2.4 + (i % 3) * 0.9, 0, Math.floor(i / 3) * -1.3);
      scene.add(h.group);
      humans.push(h);
    });
  } catch (e) { console.warn('humans not ready', e.message); }

  const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 900);
  const views = [
    { pos: [0.4, 2.2, 5.0], target: [0, 0.3, -0.2], lens: 32 },
    { pos: [-2.2, 1.4, 3.4], target: [-0.2, 0.3, -0.4], lens: 40 },
    { pos: [-0.6, 0.95, 2.1], target: [-1.25, 0.62, 0.6], lens: 85 },
    { pos: [3.0, 2.0, 4.2], target: [3.3, 1.1, -0.6], lens: 30 },
  ];
  return {
    frame(f) {
      const v = views[f % views.length];
      applyCam(cam, { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target), lens: v.lens });
      cats.forEach((c, i) => { c.look(i === 0 ? 0.25 : 0, 0, 0); c.update(1.3 + i); });
      humans.forEach((h) => h.update && h.update(1));
      return { scene, camera: cam, bloom: 0.2, exposure: 1.0 };
    },
  };
}
