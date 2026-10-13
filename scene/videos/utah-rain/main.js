// Entry point for "What if it rained in Utah for 30 days?".
// Exposes window.__video.renderFrame(n): draws frame n deterministically
// (fixed virtual clock: no timers, no real time, all randomness seeded).
import * as THREE from 'three';
import beatsDoc from './beats.json';
import { Pipeline } from '../../src/core/pipeline.js';
import { Overlay } from '../../src/overlay.js';
import { ease, prog } from '../../src/core/util.js';
import { HEX } from './look.js';
import { Gauges } from './lib/gauges.js';

const params = new URLSearchParams(location.search);
const DPR = parseFloat(params.get('dpr') || '2');
if (params.get('safe') === '1') document.getElementById('safe').hidden = false;

// Which set is on screen, by frame. Every change of set is a short dissolve (see transitionAt).
const SCHEDULE = [
  [0, 180, 'canyon'], [180, 264, 'globe'], [264, 420, 'utmap'], [420, 540, 'cliff'], [540, 660, 'block'], [660, 780, 'slot'],
  [780, 1140, 'utmap'], [1140, 1260, 'flats'], [1260, 1380, 'city'], [1380, 1920, 'utmap'],
];
const CUTS = SCHEDULE.map((s) => s[0]).filter((f, i) => i > 0 && SCHEDULE[i - 1][2] !== SCHEDULE[i][2]);

// Each change of set is a 0.8 s dissolve: 16 frames before the cut to 8 frames after (as in the first video).
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

const LOADERS = {
  canyon: () => import('./sets/canyon.js').then((m) => m.createCanyon),
  globe: () => import('./sets/globe.js').then((m) => m.createGlobe),
  cliff: () => import('./sets/cliff.js').then((m) => m.createCliff),
  block: () => import('./sets/block.js').then((m) => m.createBlock),
  slot: () => import('./sets/slot.js').then((m) => m.createSlot),
  flats: () => import('./sets/flats.js').then((m) => m.createFlats),
  utmap: () => import('./sets/utmap.js').then((m) => m.createUtahMap),
  city: () => import('./sets/city.js').then((m) => m.createCity),
};

// Free the shadow maps of sets that are off screen (they are rebuilt automatically when needed again),
// so thirteen sets fit in the software renderer's memory.
const scenesOf = new Map();
function releaseShadows(activeNames, sets) {
  for (const [name, scene] of scenesOf) {
    if (activeNames.includes(name)) continue;
    scene.traverse((o) => { if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } });
  }
  void sets;
}

async function boot() {
  await fontsReady();
  const pipe = new Pipeline(document.getElementById('gl'), { dpr: DPR });
  const overlay = new Overlay(beatsDoc, {
    swatches: { water: HEX.water, highlight: HEX.green, accent: HEX.red, outline: '#D8D2C6' },
    lateCount: [],
  });
  const gauges = new Gauges(overlay);
  const lab = null;
  const sets = {};
  const wanted = lab ? ['lab'] : [...new Set(SCHEDULE.map((s) => s[2]))];
  for (const k of wanted) {
    try { sets[k] = await (await LOADERS[k]())(pipe, { lab }); } catch (e) { console.warn('set missing:', k, e.message); if (lab) throw e; }
  }
  const fallback = sets[wanted.find((k) => sets[k])];

  const gl = pipe.renderer.getContext();
  const px = new Uint8Array(4);
  let last = null;

  function renderFrame(f) {
    if (lab) {
      const out = sets.lab.frame(f, { avoid: [] });
      pipe.render({ ...out, frame: f });
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return (last = { frame: f, set: 'lab' });
    }
    overlay.update(f);
    gauges.update(f);
    const avoid = overlay.rects().concat(gauges.rect ? [gauges.rect] : []);
    const tr = transitionAt(f);
    let name, labels;
    if (!tr) {
      name = setNameAt(f);
      const set = sets[name] || fallback;
      const out = set.frame(f, { avoid });
      scenesOf.set(name, out.scene);
      releaseShadows([name], sets);
      pipe.render({ ...out, frame: f });
      labels = set.labels && set.labels.visible ? set.labels.visible() : [];
    } else {
      const nA = setNameAt(tr.c - 1), nB = setNameAt(tr.c);
      const A = sets[nA] || fallback, B = sets[nB] || fallback;
      const outA = A.frame(Math.min(f, tr.c - 1), { avoid });
      const labA = A.labels && A.labels.visible ? A.labels.visible().map((l) => ({ ...l, opacity: l.opacity * (1 - tr.p) })) : [];
      scenesOf.set(nA, outA.scene);
      const outB = B.frame(Math.max(f, tr.c), { avoid });
      scenesOf.set(nB, outB.scene);
      releaseShadows([nA, nB], sets);
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
