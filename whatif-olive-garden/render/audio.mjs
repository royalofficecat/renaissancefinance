// Builds the soundtrack from scratch: an original trattoria loop (tremolo mandolin, a wheezy
// accordion, a bouncing upright bass, tambourine) plus cartoon effects timed to the jokes.
// No samples or recordings are used. Output: out/soundtrack.wav (44.1 kHz, 16-bit stereo).
import fs from 'node:fs';
import path from 'node:path';
import { TOTAL, BEAT_LEN, SFX, SOFT_BEATS } from '../scene/beats.js';
import { ROOT } from './serve.mjs';

const SR = 44100;
const N = Math.round(TOTAL * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 13;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

function add(buf, t0, gain = 1, pan = 0) {
  const s = Math.round(t0 * SR), gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < buf.length && s + i < N; i++) { if (s + i < 0) continue; L[s + i] += buf[i] * gl; R[s + i] += buf[i] * gr; }
}

// ---------- instruments ----------
// Karplus–Strong plucked string with a low-passed excitation; mandolin = short, bright, doubled strings.
function pluck(freq, dur = 0.6, bright = 0.7, decay = 0.994) {
  const n = Math.round(dur * SR), out = new Float32Array(n), p = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(p);
  let ex = 0; const k = 0.3 + bright * 0.5;
  for (let i = 0; i < p; i++) { ex += (noise() - ex) * k; line[i] = ex; }
  let mean = 0; for (let i = 0; i < p; i++) mean += line[i] / p; for (let i = 0; i < p; i++) line[i] -= mean;
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx], next = line[(idx + 1) % p];
    const v = decay * 0.5 * (cur + next);
    line[idx] = v; idx = (idx + 1) % p;
    prev = prev * 0.25 + cur * 0.75;
    out[i] = prev * 1.6 * Math.min(1, i / 60) * (i > n - 1500 ? (n - i) / 1500 : 1);
  }
  return out;
}
const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const mandolin = (f, dur = 0.6) => cached(`m${f}|${dur}`, () => { const a = pluck(f, dur, 0.75), b = pluck(f * 1.004, dur, 0.7); const o = new Float32Array(a.length); for (let i = 0; i < o.length; i++) o[i] = (a[i] + b[i]) * 0.5; return o; });

// Accordion: detuned pulse waves with a slow vibrato and a soft bellows attack.
function accordion(freq, dur) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t);
    p1 += 2 * Math.PI * freq * vib / SR; p2 += 2 * Math.PI * freq * 1.006 * vib / SR; p3 += 2 * Math.PI * freq * 2.0 * vib / SR;
    const sq = x => Math.sin(x) + Math.sin(3 * x) / 3 + Math.sin(5 * x) / 5;
    const env = Math.min(1, t / 0.06) * Math.min(1, (dur - t) / 0.08);
    out[i] = (sq(p1) + sq(p2) * 0.8 + Math.sin(p3) * 0.25) * 0.22 * env;
  }
  return out;
}
function bassNote(freq, dur = 0.5) {
  return cached(`b${freq}|${dur}`, () => {
    const n = Math.round(dur * SR), out = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * freq / SR; const env = Math.min(1, t / 0.01) * Math.exp(-t * 5); out[i] = (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)) * env; }
    return out;
  });
}
function tambourine() { const n = Math.round(0.18 * SR), o = new Float32Array(n); let lp = 0, bp = 0; for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp = lp * 0.4 + x * 0.6; bp = bp * 0.95 + (x - lp) * 0.05; o[i] = ((x - lp) * 0.6 + Math.sin(2 * Math.PI * 4800 * t) * 0.2 * Math.exp(-t * 60)) * Math.exp(-t * 22); } return o; }
function woodblock() { const n = Math.round(0.08 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * 1100 / SR; o[i] = Math.sin(ph) * Math.exp(-t * 70); } return o; }
function tone(freq, dur, { attack = 0.005, decay = 3, partials = [[1, 1]] } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / attack) * Math.exp(-t * decay); let v = 0; for (const [m, a] of partials) v += a * Math.sin(2 * Math.PI * freq * m * t); out[i] = v * env; }
  return out;
}

// ---------- sound effects ----------
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t * d);
function fx(kind) {
  const make = (dur, fn) => { const n = Math.round(dur * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const r = fn(t, ph); ph = r[1]; o[i] = r[0]; } return o; };
  const osc = (f, ph) => { ph += 2 * Math.PI * f / SR; return [Math.sin(ph), ph]; };
  switch (kind) {
    case 'pop': return make(0.12, (t, ph) => { const [v, p] = osc(700 * Math.exp(-t * 25) + 180, ph); return [v * env(t, 0.002, 30), p]; });
    case 'boing': return make(0.6, (t, ph) => { const [v, p] = osc(240 * (1 + 0.45 * Math.sin(2 * Math.PI * 11 * t) * Math.exp(-t * 4)), ph); return [v * env(t, 0.004, 5), p]; });
    case 'squish': return make(0.3, (t, ph) => { const [v, p] = osc(180 - 100 * t / 0.3 + 30 * Math.sin(2 * Math.PI * 40 * t), ph); return [v * env(t, 0.01, 9), p]; });
    case 'whistle': return make(1.2, (t, ph) => { const [v, p] = osc(500 + 1400 * t / 1.2 + 25 * Math.sin(2 * Math.PI * 7 * t), ph); return [v * 0.5 * Math.sin(Math.PI * t / 1.2), p]; });
    case 'meep': return make(0.25, (t, ph) => { const on = t < 0.1 || t > 0.14; const [v, p] = osc(620, ph); return [(Math.sign(v) * 0.4 + v * 0.3) * (on ? 1 : 0) * 0.5, p]; });
    case 'plink': return cached('plink', () => pluck(1318.5, 0.5, 0.9));
    case 'thunk': return make(0.12, (t, ph) => { const [v, p] = osc(160 * Math.exp(-t * 20) + 80, ph); return [v * env(t, 0.002, 28), p]; });
    case 'ding': return tone(1318.5, 1.3, { partials: [[1, 0.7], [2.76, 0.25], [5.4, 0.1]], decay: 3.5 });
    case 'chaching': { const a = make(0.1, (t, ph) => { const [v, p] = osc(2200, ph); return [v * env(t, 0.001, 50), p]; }); const b = tone(1760, 0.9, { partials: [[1, 0.6], [2.4, 0.25]], decay: 5 }); const o = new Float32Array(a.length + b.length); o.set(a); for (let i = 0; i < b.length; i++) o[a.length + i] += b[i]; return o; }
    case 'sparkle': { const o = new Float32Array(Math.round(0.9 * SR)); [1568, 1975, 2349, 2637, 3136].forEach((f, k) => { const n = tone(f, 0.5, { partials: [[1, 0.6]], decay: 6 }); const off = Math.round(k * 0.07 * SR); for (let i = 0; i < n.length && off + i < o.length; i++) o[off + i] += n[i]; }); return o; }
    case 'yay': { const o = new Float32Array(Math.round(1.0 * SR)); [523.25, 659.25, 783.99, 1046.5].forEach(f => { const n = accordion(f, 0.9); for (let i = 0; i < n.length; i++) o[i] += n[i] * 0.5; }); return o; }
    case 'slurp': return make(0.5, (t, ph) => { const [v, p] = osc(300 + 900 * t + 60 * Math.sin(2 * Math.PI * 25 * t), ph); return [v * 0.6 * Math.sin(Math.PI * t / 0.5) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 30 * t)), p]; });
    case 'whoosh': { let lp = 0; return make(0.6, t => { const c = 0.05 + 0.4 * Math.sin(Math.PI * t / 0.6); lp += (noise() - lp) * c; return [lp * Math.sin(Math.PI * t / 0.6) * 1.4, 0]; }); }
    case 'tada': { const o = new Float32Array(Math.round(1.4 * SR)); [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36]].forEach(([f, d]) => { const n = accordion(f, 1.0); const off = Math.round(d * SR); for (let i = 0; i < n.length && off + i < o.length; i++) o[off + i] += n[i] * 0.6; }); return o; }
    case 'gull': return make(0.5, (t, ph) => { const [v, p] = osc(1400 + 500 * Math.sin(2 * Math.PI * 6 * t) - 600 * t, ph); return [v * 0.4 * Math.sin(Math.PI * t / 0.5), p]; });
    case 'horn': return make(0.9, (t, ph) => { const [v, p] = osc(110, ph); return [(Math.sign(v) * 0.5 + v * 0.5) * 0.5 * Math.min(1, t / 0.05) * Math.min(1, (0.9 - t) / 0.1), p]; });
    default: throw new Error('unknown fx ' + kind);
  }
}

// ---------- the song: a bouncy 2/4 trattoria tune ----------
const BPM = 136, SPB = 60 / BPM, BAR = 2 * SPB; // two beats per bar, oom-pah feel
// chords (root bass, fifth bass, mandolin voicing, accordion pad)
const CH = {
  Am: { b: [110.0, 164.81], m: [440.0, 523.25, 659.25, 880.0], a: [220.0, 261.63, 329.63] },
  Dm: { b: [146.83, 220.0], m: [587.33, 698.46, 880.0, 1174.7], a: [293.66, 349.23, 440.0] },
  E7: { b: [164.81, 246.94], m: [659.25, 830.61, 987.77, 1318.5], a: [329.63, 415.3, 493.88] },
  C:  { b: [130.81, 196.0], m: [523.25, 659.25, 783.99, 1046.5], a: [261.63, 329.63, 392.0] },
  G:  { b: [98.0, 146.83], m: [587.33, 783.99, 987.77, 1174.7], a: [246.94, 293.66, 392.0] },
};
const PROG = ['Am', 'Am', 'Dm', 'Dm', 'E7', 'E7', 'Am', 'Am', 'C', 'C', 'G', 'G', 'E7', 'E7', 'Am', 'Am'];
// a little mandolin melody, one note per eighth, over 8 bars (A natural minor)
const MEL = [659.25, 659.25, 783.99, 880.0, 659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 880.0, 987.77, 880.0, 783.99, 659.25, 587.33,
             523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 440.0, 493.88, 523.25, 587.33, 659.25, 783.99, 880.0, 880.0];
const soft = t => t < 13 * BEAT_LEN && SOFT_BEATS.includes(Math.floor(t / BEAT_LEN));
const MUSIC_END = 60.4;

for (let bar = 0; bar * BAR < MUSIC_END; bar++) {
  const t0 = bar * BAR, ch = CH[PROG[bar % PROG.length]];
  for (let q = 0; q < 2; q++) {
    const t = t0 + q * SPB; if (t >= MUSIC_END) continue;
    const quiet = soft(t);
    add(bassNote(ch.b[q], 0.45), t, quiet ? 0.2 : 0.34);                               // oom
    const off = t + SPB / 2;                                                             // pah
    if (off < MUSIC_END) ch.m.slice(0, 3).forEach((f, k) => add(mandolin(f, 0.25), off + k * 0.008, (quiet ? 0.05 : 0.09), -0.2 + k * 0.15));
    if (!quiet) { add(tambourine(), off, 0.12, 0.35); if (q === 0) add(woodblock(), t, 0.1, -0.3); }
  }
  // accordion pad holds the chord, with a breath between bars
  if (!soft(t0)) ch.a.forEach((f, k) => add(accordion(f, BAR * 0.92), t0 + 0.01, 0.06, 0.1 - k * 0.1));
  // mandolin tremolo melody: each eighth note is re-plucked rapidly
  for (let e = 0; e < 4; e++) {
    const t = t0 + e * SPB / 2; if (t >= MUSIC_END) continue;
    const f = MEL[(bar * 4 + e) % MEL.length];
    const reps = soft(t) ? 2 : 4;
    for (let r = 0; r < reps; r++) add(mandolin(f, 0.22), t + r * (SPB / 2 / reps), (soft(t) ? 0.05 : 0.08) * (r === 0 ? 1 : 0.7), 0.25);
  }
}
// final chord
CH.Am.m.forEach((f, k) => add(mandolin(f, 1.6), MUSIC_END + k * 0.02, 0.12));
CH.Am.a.forEach(f => add(accordion(f, 1.8), MUSIC_END, 0.08));
add(bassNote(110, 1.6), MUSIC_END, 0.3);

// ---------- effects ----------
const FX_GAIN = { pop: 0.35, boing: 0.35, squish: 0.3, whistle: 0.22, meep: 0.3, plink: 0.3, thunk: 0.3, ding: 0.22, chaching: 0.3, sparkle: 0.28, yay: 0.5, slurp: 0.3, whoosh: 0.35, tada: 0.5, gull: 0.3, horn: 0.35 };
for (const { t, kind } of SFX) add(fx(kind), t, FX_GAIN[kind]);

// ---------- master ----------
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.05) * Math.min(1, (TOTAL - t) / 1.2);
  L[i] = Math.tanh(L[i] * 1.0) * fade; R[i] = Math.tanh(R[i] * 1.0) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.8 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4); }
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'soundtrack.wav'), out);
console.log(`soundtrack.wav: ${TOTAL}s, ${SFX.length} effects, peak normalised from ${peak.toFixed(2)}`);
