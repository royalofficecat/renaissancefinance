// Entry point. Exposes window.__video.renderFrame(n): draws frame n deterministically
// (fixed virtual clock: no timers, no real time, all randomness seeded).
import * as THREE from 'three';
import beatsDoc from '../beats.json';
import { Pipeline } from './core/pipeline.js';
import { Overlay } from './overlay.js';
import { smoothstep } from './core/util.js';
import { createGlobe } from './sets/globe.js';
import { createMap } from './sets/camap.js';

const params = new URLSearchParams(location.search);
const DPR = parseFloat(params.get('dpr') || '2');
if (params.get('safe') === '1') document.getElementById('safe').hidden = false;

// Which set is on screen, by frame. Every change of set happens behind a cloud-bank wipe.
const SCHEDULE = [
  [0, 228, 'globe'], [228, 300, 'map'], [300, 420, 'shasta'], [420, 660, 'soil'],
  [660, 1320, 'map'], [1320, 1440, 'recharge'], [1440, 1620, 'town'], [1620, 1920, 'map'],
];
const CUTS = SCHEDULE.slice(1).map((s) => s[0]);

function wipe(f) {
  let cover = 0, t = 0;
  for (const c of CUTS) {
    const d = Math.abs(f - (c - 0.5));
    const k = 1 - smoothstep(3.5, 15, d);
    if (k > cover) { cover = k; t = (f - c) / 30; }
  }
  return { cover, t };
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
    const name = (SCHEDULE.find(([a, b]) => f >= a && f < b) || SCHEDULE[SCHEDULE.length - 1])[2];
    const set = sets[name] || sets.map;
    const avoid = overlay.rects();
    const out = set.frame(f, { avoid });
    const w = wipe(f);
    pipe.render({ ...out, frame: f, cover: w.cover, wipeTime: w.t });
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // wait for the GPU to finish
    last = { frame: f, set: name, cover: +w.cover.toFixed(3), labels: set.labels && set.labels.visible ? set.labels.visible() : [], panels: avoid };
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
