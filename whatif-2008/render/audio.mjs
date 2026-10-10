// Builds the soundtrack from scratch: an original ukulele loop (plucked-string synthesis),
// soft bass, light percussion, a glockenspiel line, and cartoon sound effects timed to the jokes.
// No samples or recordings are used. Output: out/soundtrack.wav (44.1 kHz, 16-bit stereo).
import fs from 'node:fs';
import path from 'node:path';
import { TOTAL, BEAT_LEN, SFX, SOFT_BEATS } from '../scene/beats.js';
import { ROOT } from './serve.mjs';

const SR = 44100;
const N = Math.round(TOTAL * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 7;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

function add(buf, t0, gain = 1, pan = 0) {
  const s = Math.round(t0 * SR), gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < buf.length && s + i < N; i++) { if (s + i < 0) continue; L[s + i] += buf[i] * gl; R[s + i] += buf[i] * gr; }
}

// ---------- instruments ----------
// Karplus–Strong plucked string: a burst of noise in a short delay line that slowly loses its highs.
function pluck(freq, dur = 1.4, bright = 0.5) {
  const n = Math.round(dur * SR), out = new Float32Array(n), p = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(p);
  // excitation: noise softened by a one-pole low-pass (brighter for downstrokes, darker for upstrokes)
  let ex = 0; const k = 0.25 + bright * 0.4;
  for (let i = 0; i < p; i++) { ex += (noise() - ex) * k; line[i] = ex; }
  let mean = 0; for (let i = 0; i < p; i++) mean += line[i] / p; for (let i = 0; i < p; i++) line[i] -= mean;
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx], next = line[(idx + 1) % p];
    const v = 0.996 * 0.5 * (cur + next);
    line[idx] = v; idx = (idx + 1) % p;
    prev = prev * 0.3 + cur * 0.7;
    out[i] = prev * 1.6 * Math.min(1, i / 90) * (i > n - 2000 ? (n - i) / 2000 : 1);
  }
  return out;
}
const pluckCache = new Map();
const cachedPluck = (f, dur, bright) => { const k = `${f}|${dur}|${bright}`; if (!pluckCache.has(k)) pluckCache.set(k, pluck(f, dur, bright)); return pluckCache.get(k); };

function tone(freq, dur, { type = 'sine', attack = 0.005, decay = 3, partials = null } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, env = Math.min(1, t / attack) * Math.exp(-t * decay);
    let v = 0;
    if (partials) for (const [m, a] of partials) v += a * Math.sin(2 * Math.PI * freq * m * t);
    else if (type === 'tri') v = 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * freq * t));
    else v = Math.sin(2 * Math.PI * freq * t);
    out[i] = v * env;
  }
  return out;
}
function kick() { const n = Math.round(0.35 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = 50 + 90 * Math.exp(-t * 30); ph += 2 * Math.PI * f / SR; o[i] = Math.sin(ph) * Math.exp(-t * 9); } return o; }
function snap() { const n = Math.round(0.12 * SR), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp = lp * 0.6 + x * 0.4; o[i] = (x - lp) * Math.exp(-t * 40); } return o; }
function shaker() { const n = Math.round(0.06 * SR), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp = lp * 0.5 + x * 0.5; o[i] = (x - lp) * Math.sin(Math.PI * t / 0.06); } return o; }

// ---------- sound effects ----------
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t * d);
function fx(kind) {
  const make = (dur, fn) => { const n = Math.round(dur * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const r = fn(t, ph); ph = r[1]; o[i] = r[0]; } return o; };
  const osc = (f, ph) => { ph += 2 * Math.PI * f / SR; return [Math.sin(ph), ph]; };
  switch (kind) {
    case 'pop': return make(0.12, (t, ph) => { const [v, p] = osc(700 * Math.exp(-t * 25) + 180, ph); return [v * env(t, 0.002, 30), p]; });
    case 'boing': return make(0.6, (t, ph) => { const [v, p] = osc(240 * (1 + 0.45 * Math.sin(2 * Math.PI * 11 * t) * Math.exp(-t * 4)), ph); return [v * env(t, 0.004, 5), p]; });
    case 'bigboing': return make(0.95, (t, ph) => { const [v, p] = osc(130 * (1 + 0.55 * Math.sin(2 * Math.PI * 8 * t) * Math.exp(-t * 3)), ph); return [v * env(t, 0.004, 3.2), p]; });
    case 'sproing': return make(0.32, (t, ph) => { const [v, p] = osc(300 + 1500 * t + 80 * Math.sin(2 * Math.PI * 30 * t), ph); return [v * env(t, 0.003, 8), p]; });
    case 'squeak': return make(0.45, (t, ph) => { const [v, p] = osc(1300 - 900 * t / 0.45 + 60 * Math.sin(2 * Math.PI * 14 * t), ph); return [v * 0.6 * env(t, 0.01, 3), p]; });
    case 'wobble': return make(0.7, (t, ph) => { const [v, p] = osc(280 + 50 * Math.sin(2 * Math.PI * 7 * t), ph); return [v * 0.5 * env(t, 0.02, 3), p]; });
    case 'ding': return tone(1318.5, 1.3, { partials: [[1, 0.7], [2.76, 0.25], [5.4, 0.1]], decay: 3.5 });
    case 'plink': return cachedPluck(1046.5, 0.5, 0.8);
    case 'bell': { const a = tone(1318.5, 0.9, { partials: [[1, 0.7], [2.76, 0.2]], decay: 4 }), b = tone(1046.5, 1.0, { partials: [[1, 0.7], [2.76, 0.2]], decay: 4 }); const o = new Float32Array(a.length + 9000); o.set(a); for (let i = 0; i < b.length && i + 9000 < o.length; i++) o[i + 9000] += b[i]; return o; }
    case 'beep': return make(0.3, (t, ph) => { const on = t < 0.1 || (t > 0.15 && t < 0.25); const [v, p] = osc(980, ph); return [Math.sign(v) * 0.25 * (on ? 1 : 0), p]; });
    case 'whoosh': { let lp = 0; return make(0.6, t => { const c = 0.05 + 0.4 * Math.sin(Math.PI * t / 0.6); lp += (noise() - lp) * c; return [lp * Math.sin(Math.PI * t / 0.6) * 1.4, 0]; }); }
    case 'scratch': { let lp = 0; return make(0.35, t => { lp += (noise() - lp) * (0.2 + 0.2 * Math.sin(2 * Math.PI * 9 * t)); return [lp * Math.abs(Math.sin(2 * Math.PI * 6 * t)) * 1.6 * Math.exp(-t * 2), 0]; }); }
    case 'ratchet': return make(0.3, t => { const k = (t % 0.03) / 0.03; return [noise() * (k < 0.15 ? 1 - k / 0.15 : 0) * 0.8, 0]; });
    case 'clack': { let lp = 0; return make(0.05, t => { lp += (noise() - lp) * 0.5; return [lp * Math.exp(-t * 90), 0]; }); }
    case 'flip': { let lp = 0; return make(0.12, t => { const x = noise(); lp += (x - lp) * 0.3; return [(x - lp) * Math.sin(Math.PI * t / 0.12) * 0.8, 0]; }); }
    default: throw new Error('unknown fx ' + kind);
  }
}

// ---------- the song ----------
const BPM = 120, SPB = 60 / BPM, BAR = 4 * SPB;
const CHORDS = [ // re-entrant GCEA ukulele voicings
  { name: 'C', notes: [392.0, 261.63, 329.63, 523.25], root: 65.41, glock: [659.25, 783.99, 1046.5, 783.99] },
  { name: 'G', notes: [293.66, 392.0, 493.88, 587.33], root: 98.0, glock: [587.33, 783.99, 987.77, 783.99] },
  { name: 'Am', notes: [440.0, 261.63, 329.63, 440.0], root: 110.0, glock: [659.25, 880.0, 1046.5, 880.0] },
  { name: 'F', notes: [440.0, 261.63, 349.23, 440.0], root: 87.31, glock: [698.46, 880.0, 1046.5, 880.0] },
];
const soft = t => t < 13 * BEAT_LEN && SOFT_BEATS.includes(Math.floor(t / BEAT_LEN));
const STRUM = [[0, 'D', 1.0], [2, 'D', 0.8], [3, 'U', 0.55], [5, 'U', 0.55], [6, 'D', 0.8], [7, 'U', 0.5]]; // D-DU-UDU in eighths
const MUSIC_END = 60.5;

for (let bar = 0; bar * BAR < MUSIC_END; bar++) {
  const t0 = bar * BAR, ch = CHORDS[bar % 4];
  for (const [slot, dir, vel] of STRUM) {
    const t = t0 + slot * SPB / 2;
    if (t >= MUSIC_END) continue;
    const quiet = soft(t);
    if (quiet && dir === 'U') continue;               // gentle downstrokes only during hardship facts
    const order = dir === 'D' ? [0, 1, 2, 3] : [3, 2, 1, 0];
    order.forEach((s, k) => add(cachedPluck(ch.notes[s], 1.3, dir === 'D' ? 0.55 : 0.35), t + k * 0.013, (quiet ? 0.5 : 1) * vel * 0.16, -0.15 + s * 0.08));
  }
  for (let q = 0; q < 4; q++) {
    const t = t0 + q * SPB;
    if (t >= MUSIC_END) continue;
    const quiet = soft(t);
    if (q % 2 === 0) add(tone(ch.root * 2, 0.45, { type: 'tri', attack: 0.01, decay: 4 }), t, quiet ? 0.12 : 0.22);
    if (!quiet) {
      if (q % 2 === 0) add(kick(), t, 0.32);
      else add(snap(), t, 0.16);
      add(tone(ch.glock[q], 0.8, { partials: [[1, 0.8], [2.76, 0.15]], decay: 5 }), t, 0.06, 0.25);
    }
    for (let e = 0; e < 2; e++) if (!quiet && t + e * SPB / 2 < MUSIC_END) add(shaker(), t + e * SPB / 2, 0.03, 0.3);
  }
}
// final ringing C chord on the end card
CHORDS[0].notes.forEach((f, k) => add(cachedPluck(f, 2.0, 0.5), MUSIC_END + k * 0.02, 0.2));
add(tone(CHORDS[0].root * 2, 1.8, { type: 'tri', decay: 1.5 }), MUSIC_END, 0.2);

// ---------- effects ----------
const FX_GAIN = { pop: 0.35, boing: 0.35, bigboing: 0.45, sproing: 0.25, squeak: 0.25, wobble: 0.25, ding: 0.22, plink: 0.35, bell: 0.22, beep: 0.18, whoosh: 0.35, scratch: 0.3, ratchet: 0.25, clack: 0.4, flip: 0.3 };
for (const { t, kind } of SFX) add(fx(kind), t, FX_GAIN[kind]);

// ---------- master: fade in/out, gentle limiter ----------
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.05) * Math.min(1, (TOTAL - t) / 1.2);
  L[i] = Math.tanh(L[i] * 1.4) * fade; R[i] = Math.tanh(R[i] * 1.4) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4); }
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'soundtrack.wav'), out);
console.log(`soundtrack.wav: ${TOTAL}s, ${SFX.length} effects, peak normalised from ${peak.toFixed(2)}`);
