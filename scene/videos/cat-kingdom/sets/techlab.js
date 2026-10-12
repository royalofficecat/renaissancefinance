// Beat 7: a Silicon Valley lab working for cats. A door-opening machine, perfectly heated beds, a gentle
// robot arm that nudges a glass off a table into a soft net. Behind them, a Hollywood screen plays bird videos
// and a red-dot chase; ultrasonic rings pulse from the speakers (cats hear up to 79 kHz).
import * as THREE from 'three';
import { C, S, backdrop, clay, glossy, mixc, rig, tone } from '../look.js';
import { makeCat } from '../lib/cat.js';
import { makeHuman } from '../lib/human.js';
import { mesh, rbox } from '../lib/props.js';
import { buildRoom, tiles } from '../lib/room.js';
import { beatMove, placeLabels } from '../lib/beat.js';
import { applyCam } from '../../../src/core/camera.js';
import { clamp, ease, prog, rng } from '../../../src/core/util.js';

const FPS = 30;
const BEAT = [780, 900];
const ROOM = { x0: -2.8, x1: 2.8, z0: -3.6, z1: 2.6, h: 4.0 };
const WIN = { z0: -1.6, z1: 0.4, y0: 0.7, y1: 3.4 };
const TX = -0.6, TZ = -0.2; // the robot-arm table
const hex = (c) => '#' + c.getHexString();

/** The screen's picture, drawn into a canvas every frame: sky, clouds, flapping birds and a laser dot. */
function screenPainter() {
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 360;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const R = rng(8);
  const birds = Array.from({ length: 7 }, () => ({ y: 60 + R() * 200, sp: 60 + R() * 70, ph: R() * 640, s: 0.7 + R() * 0.6, fl: 6 + R() * 3 }));
  return {
    tex,
    draw(t) {
      const sky = g.createLinearGradient(0, 0, 0, 360);
      sky.addColorStop(0, hex(tone(C.blue, 1, 0.25))); sky.addColorStop(1, hex(tone(C.cream, 1, 0.35)));
      g.fillStyle = sky; g.fillRect(0, 0, 640, 360);
      g.fillStyle = hex(tone(C.cream, 1, 0.6));
      for (const [x, y, r] of [[120, 90, 40], [170, 80, 55], [220, 95, 38], [470, 140, 46], [520, 128, 60], [570, 142, 40]]) { g.beginPath(); g.ellipse(((x + t * 12) % 760) - 60, y, r, r * 0.55, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = hex(tone(C.green, 0.9)); g.beginPath(); g.moveTo(0, 360); g.quadraticCurveTo(200, 270, 380, 320); g.quadraticCurveTo(520, 290, 640, 330); g.lineTo(640, 360); g.fill();
      g.strokeStyle = hex(tone(C.cream, 0.35)); g.lineCap = 'round'; g.lineJoin = 'round';
      for (const b of birds) {
        const x = ((b.ph + t * b.sp) % 760) - 60, flap = Math.sin(t * b.fl) * 10 * b.s;
        g.lineWidth = 5 * b.s;
        g.beginPath(); g.moveTo(x - 16 * b.s, b.y - flap); g.quadraticCurveTo(x - 7 * b.s, b.y - 8 * b.s, x, b.y); g.quadraticCurveTo(x + 7 * b.s, b.y - 8 * b.s, x + 16 * b.s, b.y - flap); g.stroke();
      }
      // the red dot (terracotta), wandering
      const dx = 320 + Math.sin(t * 1.9) * 220 + Math.sin(t * 4.3) * 30, dy = 250 + Math.sin(t * 2.7 + 1) * 60;
      const glow = g.createRadialGradient(dx, dy, 0, dx, dy, 26);
      glow.addColorStop(0, hex(tone(C.terra, 1.2))); glow.addColorStop(0.35, hex(C.terra)); glow.addColorStop(1, 'rgba(200,98,63,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(dx, dy, 26, 0, Math.PI * 2); g.fill();
      tex.needsUpdate = true;
      return { u: dx / 640, v: dy / 360 };
    },
  };
}

export async function createTechlab(pipe) {
  const scene = new THREE.Scene();
  backdrop(scene, { glowAmt: 0.2 });
  const room = new THREE.Group();
  scene.add(room);
  room.add(buildRoom(ROOM, { windows: [WIN], floor: tiles(tone(C.cream, 1, 0.2), tone(C.cream, 0.9), 0.5), wall: tone(C.cream, 1, 0.1), wainscot: null, pilasters: [] }).group);
  const R = rng(7);
  const white = clay(tone(C.cream, 1, 0.4), 0.55), steel = clay(tone(C.cream, 0.7), 0.4), joint = clay(S.terra, 0.55);

  // ---------- the Hollywood screen on the back wall, speakers with ultrasonic rings
  const painter = screenPainter();
  const SW = 3.4, SH = SW * 9 / 16, SY = 2.25;
  room.add(mesh(rbox(SW + 0.2, SH + 0.2, 0.08, 0.04), clay(tone(C.cream, 0.25), 0.5), { pos: [0, SY, ROOM.z0 + 0.05] }));
  const screen = mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: painter.tex, toneMapped: false }), { pos: [0, SY, ROOM.z0 + 0.095], cast: false, receive: false });
  room.add(screen);
  const rings = [];
  for (const s of [-1, 1]) {
    const sp = new THREE.Group();
    sp.add(mesh(rbox(0.42, 0.9, 0.36, 0.06), clay(tone(C.cream, 0.3), 0.6), { pos: [0, 0.45, 0] }));
    for (const y of [0.28, 0.66]) sp.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), clay(tone(C.cream, 0.55), 0.4), { pos: [0, y, 0.18], rot: [Math.PI / 2, 0, 0] }));
    sp.position.set(s * (SW / 2 + 0.45), 0.9, ROOM.z0 + 0.3);
    room.add(sp);
    room.add(mesh(rbox(0.5, 0.9, 0.4, 0.04), white, { pos: [s * (SW / 2 + 0.45), 0.45, ROOM.z0 + 0.3] }));
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: tone(C.cream, 1, 0.5), transparent: true, depthWrite: false, toneMapped: false }));
      ring.position.set(s * (SW / 2 + 0.45), 1.47, ROOM.z0 + 0.5);
      room.add(ring);
      rings.push({ ring, k });
    }
  }

  // ---------- robot arm and the glass (foreground left)
  const table = new THREE.Group();
  table.add(mesh(rbox(0.9, 0.05, 0.6, 0.02), white, { pos: [0, 0.78, 0] }));
  for (const [x, z] of [[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]]) table.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.78, 8), steel, { pos: [x, 0.39, z] }));
  table.position.set(TX, 0, TZ);
  room.add(table);
  const glass = mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.16, 24, 1, true), glossy(tone(C.blue, 1, 0.55), { roughness: 0.06, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), { cast: false });
  room.add(glass);
  // the soft net below the table edge
  const net = new THREE.Group();
  const netMat = clay(tone(C.terra, 1, 0.25), 0.9, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  net.add(mesh(new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), netMat, {}));
  net.add(mesh(new THREE.TorusGeometry(0.26, 0.015, 6, 32), steel, { rot: [Math.PI / 2, 0, 0] }));
  net.position.set(TX + 0.62, 0.42, TZ + 0.05);
  room.add(net);
  room.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8), steel, { pos: [TX + 0.62 + 0.26, 0.21, TZ + 0.05] }));
  // arm: base, upper and lower segments, a soft rubber fingertip
  const arm = new THREE.Group();
  arm.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 24), white, { pos: [0, 0.04, 0] }));
  const shoulder = new THREE.Group(); shoulder.position.y = 0.1; arm.add(shoulder);
  shoulder.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), joint, {}));
  shoulder.add(mesh(rbox(0.07, 0.36, 0.07, 0.03), white, { pos: [0, 0.18, 0] }));
  const elbow = new THREE.Group(); elbow.position.y = 0.36; shoulder.add(elbow);
  elbow.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), joint, {}));
  elbow.add(mesh(rbox(0.06, 0.3, 0.06, 0.025), white, { pos: [0, 0.15, 0] }));
  elbow.add(mesh(new THREE.SphereGeometry(0.035, 12, 8), joint, { pos: [0, 0.31, 0] }));
  arm.position.set(TX - 0.25, 0.805, TZ);
  room.add(arm);
  // the cat who requested this service, sitting on the table, watching
  const watcher = makeCat({ pose: 'sit', coat: 'cream', seed: 71 });
  watcher.group.scale.setScalar(0.45); watcher.group.position.set(TX - 0.2, 0.805, TZ - 0.17); watcher.group.rotation.y = 0.6;
  room.add(watcher.group);

  // ---------- heated beds (right), each with a sleeping cat in a warm glow
  const beds = [];
  for (const [x, z, coat, seed] of [[0.85, -0.95, 'ginger', 72], [0.45, -1.85, 'ginger2', 73]]) {
    const b = new THREE.Group();
    b.add(mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.22, 32), white, { pos: [0, 0.11, 0] }));
    b.add(mesh(new THREE.TorusGeometry(0.36, 0.08, 12, 40), clay(tone(C.cream, 1, 0.2), 0.8), { pos: [0, 0.24, 0], rot: [Math.PI / 2, 0, 0] }));
    const glow = new THREE.MeshStandardMaterial({ color: tone(C.gold, 1, 0.2), emissive: tone(C.gold, 0.9), emissiveIntensity: 0.7, roughness: 0.5 });
    b.add(mesh(new THREE.TorusGeometry(0.405, 0.012, 6, 48), glow, { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], cast: false }));
    b.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 32), clay(S.terra, 0.9), { pos: [0, 0.22, 0], cast: false }));
    b.position.set(x, 0, z);
    room.add(b);
    const c = makeCat({ pose: 'curl', coat, seed });
    c.group.scale.setScalar(0.5); c.group.position.set(x, 0.23, z); c.group.rotation.y = R() * 6;
    room.add(c.group);
    beds.push(c);
  }
  const bedLight = new THREE.PointLight(tone(C.gold, 1.0), 0.8, 2.2, 2);
  bedLight.position.set(0.7, 0.7, -1.3);
  room.add(bedLight);

  // ---------- door-opening machine (back left): a framed door, a piston arm, a cat waiting in front of it
  const dm = new THREE.Group();
  dm.add(mesh(rbox(0.9, 1.5, 0.12, 0.03), white, { pos: [0, 0.75, 0] }));
  dm.add(mesh(rbox(0.66, 1.25, 0.04, 0.02), clay(tone(C.cream, 0.25), 0.8), { pos: [0, 0.66, 0.05], cast: false }));
  const flap = new THREE.Group(); flap.position.set(-0.33, 0, 0.08);
  flap.add(mesh(rbox(0.66, 1.25, 0.05, 0.02), clay(S.wood, 0.6), { pos: [0.33, 0.66, 0] }));
  dm.add(flap);
  dm.add(mesh(rbox(0.5, 0.06, 0.06, 0.02), joint, { pos: [0.1, 1.32, 0.12] }));
  dm.position.set(-1.15, 0, -2.3); dm.rotation.y = 0.3;
  room.add(dm);
  const doorCat = makeCat({ pose: 'sit', coat: 'ginger', seed: 74 });
  doorCat.group.scale.setScalar(0.45); doorCat.group.position.set(-0.95, 0, -1.75); doorCat.group.rotation.y = 0.3 + Math.PI;
  room.add(doorCat.group);

  // ---------- the screen audience and an engineer
  const fan = makeCat({ pose: 'sit', coat: 'ginger', seed: 75 });
  fan.group.scale.setScalar(0.5); fan.group.position.set(0.05, 0, -2.75); fan.group.rotation.y = Math.PI;
  room.add(fan.group);
  const fan2 = makeCat({ pose: 'loaf', coat: 'cream', seed: 76 });
  fan2.group.scale.setScalar(0.48); fan2.group.position.set(-0.45, 0, -3.0); fan2.group.rotation.y = Math.PI + 0.3;
  room.add(fan2.group);
  const eng = makeHuman({ pose: 'holdFolder', seed: 77, scale: 1.72, shirt: 3, skin: 1, hair: 0, cut: 2 });
  eng.group.position.set(1.35, 0, -2.3); eng.group.rotation.y = -2.2;
  room.add(eng.group);

  const labels = placeLabels([{ id: 'sv', text: 'Silicon Valley', pos: [-1.2, 1.75, -2.3], dot: false }]);
  await labels.sync();

  const keyDir = [-0.7, 0.45, 0.55];
  const lights = rig(scene, pipe.renderer, { size: 5, dist: 30, intensity: 7.0, keyDir, fillK: 0.2, rimK: 0.15, rimDir: [0.6, 0.5, 0.6] });
  lights.follow(new THREE.Vector3(0, 1.4, -1.0), 5);
  const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.05, 900);
  const A = { pos: [0.7, 3.0, 6.3], target: [0.0, 1.25, -1.3], lens: 50 };
  const B = { pos: [0.35, 2.55, 4.0], target: [0.0, 1.45, -2.2], lens: 50 };

  const tmp = new THREE.Vector3();
  return {
    labels,
    frame(f, { avoid = [] } = {}) {
      const t = (f - BEAT[0]) / FPS;
      applyCam(cam, beatMove(f, BEAT, A, B));
      const dot = painter.draw(f / FPS);
      // the audience's heads follow the red dot
      const dotW = tmp.set((dot.u - 0.5) * SW, SY + (0.5 - dot.v) * SH, ROOM.z0 + 0.1);
      for (const c of [fan, fan2]) {
        const p = c.group.position;
        const yaw = Math.atan2(dotW.x - p.x, dotW.z - p.z) - c.group.rotation.y;
        c.look(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 0.8, -0.35, 0);
      }
      // the arm sweeps the glass to the edge; it tips and drops into the net
      const sweep = ease.inOutSine(prog(t, 0.9, 1.7));
      shoulder.rotation.set(0, -0.6 + 0.9 * sweep, -0.5 + 0.25 * sweep);
      elbow.rotation.z = 1.2 - 0.3 * sweep;
      const push = ease.inOutSine(prog(t, 1.2, 1.7));
      const fall = clamp((t - 1.7) / 0.32);
      const gx = TX + 0.05 + 0.38 * push, gy0 = 0.805 + 0.08;
      if (fall <= 0) glass.position.set(gx, gy0, TZ + 0.02), glass.rotation.set(0, 0, -0.25 * prog(t, 1.6, 1.7));
      else {
        const y = gy0 - 0.47 * fall * fall;
        glass.position.set(gx + 0.18 * fall, Math.max(0.55, y), TZ + 0.03);
        glass.rotation.set(0, 0, -0.25 - 1.3 * fall);
      }
      watcher.look(0.5 + 0.4 * ease.inOutSine(prog(t, 1.4, 2.0)), 0.35 + 0.2 * ease.inOutSine(prog(t, 1.6, 2.1)), 0);
      // the door machine opens for the cat, again and again
      flap.rotation.y = -1.3 * Math.max(0, Math.sin(Math.PI * clamp((t - 0.6) / 2.4)));
      rings.forEach(({ ring, k }) => {
        const ph = ((t * 0.9 + k / 3) % 1);
        ring.scale.setScalar(0.15 + ph * 0.9);
        ring.material.opacity = 0.55 * (1 - ph);
      });
      [watcher, doorCat, fan, fan2, ...beds].forEach((c, i) => c.update(t + i * 1.4));
      eng.update(t);
      labels.update(cam, { sv: Math.min(1, Math.max(0, (t - 0.8) / 0.5)) }, avoid);
      return { scene, camera: cam, labels: labels.scene, bloom: 0.25, exposure: 1.0, vignette: 0.22 };
    },
  };
}
