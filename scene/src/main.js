// Entry point. Exposes window.__video.renderFrame(n): draws frame n deterministically
// (fixed virtual clock: no timers, no real time, all randomness seeded).
import * as THREE from 'three';
import beatsDoc from '../beats.json';
import { Pipeline } from './core/pipeline.js';
import { Overlay } from './overlay.js';
import { ease, prog } from './core/util.js';
import { createGlobe } from './sets/globe.js';
import { createMap } from './sets/camap.js';

const params = new URLSearchParams(location.search);
const DPR = parseFloat(params.get('dpr') || '2');
if (params.get('safe') === '1') document.getElementById('safe').hidden = false;

// Which set is on screen, by frame. Every change of set is a short dissolve (see transitionAt).
const SCHEDULE = [
  [0, 228, 'globe'], [228, 300, 'map'], [300, 420, 'shasta'], [420, 660, 'soil'],
  [660, 1320, 'map'], [1320, 1440, 'recharge'], [1440, 1620, 'town'], [1620, 1920, 'map'],
];
const CUTS = SCHEDULE.slice(1).map((s) => s[0]);

// Each change of set is a 0.8 s dissolve: 16 frames before the cut to 8 frames after.
// The outgoing set is held on its last frame (its camera is already at rest) and pushes in a little;
// the incoming set is held on its first frame, so its camera is still when the caption lands.
const T_BEFORE = 16, T_AFTER = 8;
const setNameAt = (f) => (SCHEDULE.find(([a, b]) => f >= a && f < b) || SCHEDULE[SCHEDULE.length - 1])[2];
function transitionAt(f) {
  for (const c of CUTS) if (f >= c - T_BEFORE && f < c + T_AFTER) return { c, p: prog(f, c - T_BEFORE - 1, c + T_AFTER) };
  return null;
}

async function fontsReady() {
  const faces = ['400 52px VideoSerif', '700 52px VideoSerif', 'italic 400 30px VideoSerif', 'italic 700 30px VideoSerif'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'Aa1')));
  await document.fonts.ready;
}

async function boot() {
  await fontsReady();
  const pipe = new Pipeline(document.getElementById('gl'), { dpr: DPR });
  const overlay = new Overlay(beatsDoc);
  const sets = {};
  sets.globe = await createGlobe(pipe);
  sets.map = await createMap(pipe);
  // Sets still to be built fall back to the map so the timeline always renders
  const loaders = {
    shasta: () => import('./sets/shasta.js').then((m) => m.createShasta(pipe)),
    soil: () => import('./sets/soil.js').then((m) => m.createSoil(pipe)),
    recharge: () => import('./sets/recharge.js').then((m) => m.createRecharge(pipe)),
    town: () => import('./sets/town.js').then((m) => m.createTown(pipe)),
  };
  for (const [k, fn] of Object.entries(loaders)) {
    try { sets[k] = await fn(); } catch (e) { console.warn('set missing:', k, e.message); }
  }

  const gl = pipe.renderer.getContext();
  const px = new Uint8Array(4);
  let last = null;

  function renderFrame(f) {
    overlay.update(f);
    const avoid = overlay.rects();
    const tr = transitionAt(f);
    let name, labels;
    if (!tr) {
      name = setNameAt(f);
      const set = sets[name] || sets.map;
      const out = set.frame(f, { avoid });
      pipe.render({ ...out, frame: f });
      labels = set.labels && set.labels.visible ? set.labels.visible() : [];
    } else {
      const nA = setNameAt(tr.c - 1), nB = setNameAt(tr.c);
      const A = sets[nA] || sets.map, B = sets[nB] || sets.map;
      const outA = A.frame(Math.min(f, tr.c - 1), { avoid });
      const labA = A.labels && A.labels.visible ? A.labels.visible().map((l) => ({ ...l, opacity: l.opacity * (1 - tr.p) })) : [];
      const outB = B.frame(Math.max(f, tr.c), { avoid });
      const labB = B.labels && B.labels.visible ? B.labels.visible().map((l) => ({ ...l, opacity: l.opacity * tr.p })) : [];
      pipe.blend(outA, outB, { frame: f, p: tr.p, zoomA: 1 + 0.08 * ease.inOutSine(tr.p) });
      name = `${nA}>${nB}`;
      labels = [...labA, ...labB];
    }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // wait for the GPU to finish
    last = { frame: f, set: name, transition: tr ? +tr.p.toFixed(3) : 0, labels, panels: avoid };
    return last;
  }

  window.__video = {
    totalFrames: beatsDoc.totalFrames,
    fps: beatsDoc.fps,
    renderFrame: (f) => renderFrame(f),
    info: () => last,
    overlay,
    debug: { pipe, sets, THREE },
  };
  const start = params.get('frame');
  if (start !== null) renderFrame(parseInt(start, 10));
  window.__videoReady = true;
}

boot().catch((e) => {
  console.error(e);
  window.__videoError = String(e && e.stack ? e.stack : e);
});
