// Builds the soundtrack from scratch: a soft "2000s startup chime" track with electric-piano chords,
// a bubbly synth arpeggio, a warm pad, a gentle beat, and glassy effects timed to the jokes.
// No samples or recordings are used. Output: out/soundtrack.wav (44.1 kHz, 16-bit stereo).
import fs from 'node:fs';
import path from 'node:path';
import { TOTAL, BEAT_LEN, SFX, SOFT_BEATS } from '../scene/beats.js';
import { ROOT } from './serve.mjs';

const SR = 44100;
const N = Math.round(TOTAL * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 2007;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

function add(buf, t0, gain = 1, pan = 0) {
  const s = Math.round(t0 * SR), gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < buf.length && s + i < N; i++) { if (s + i < 0) continue; L[s + i] += buf[i] * gl; R[s + i] += buf[i] * gr; }
}
const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// ---------- instruments ----------
// Electric piano: FM-style sine with a bright overtone that decays faster than the fundamental.
function epiano(freq, dur = 1.6) {
  return cached(`ep${freq}|${dur}`, () => {
    const n = Math.round(dur * SR), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR, env = Math.min(1, t / 0.004) * Math.exp(-t * 2.2), bright = Math.exp(-t * 9);
      const mod = Math.sin(2 * Math.PI * freq * 14 * t) * 0.35 * bright;
      out[i] = (Math.sin(2 * Math.PI * freq * t + mod) + 0.3 * Math.sin(2 * Math.PI * freq * 2 * t) * bright) * env * (i > n - 2000 ? (n - i) / 2000 : 1);
    }
    return out;
  });
}
// Bubbly arpeggio voice: a soft square with a quick pitch "bloop" at the start.
function bloopNote(freq, dur = 0.22) {
  return cached(`bl${freq}|${dur}`, () => {
    const n = Math.round(dur * SR), out = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = freq * (1 + 0.25 * Math.exp(-t * 60)); ph += 2 * Math.PI * f / SR; const env = Math.min(1, t / 0.003) * Math.exp(-t * 14); out[i] = (Math.sin(ph) + 0.25 * Math.sin(3 * ph)) * env; }
    return out;
  });
}
// Warm pad: three detuned saws through a slow low-pass, with a soft swell.
function pad(freqs, dur) {
  const n = Math.round(dur * SR), out = new Float32Array(n), ph = freqs.flatMap(f => [0, 0, 0]);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; let v = 0;
    freqs.forEach((f, k) => { for (let d = 0; d < 3; d++) { const det = 1 + (d - 1) * 0.004; ph[k * 3 + d] = (ph[k * 3 + d] + f * det / SR) % 1; v += (ph[k * 3 + d] * 2 - 1) * 0.08; } });
    const cut = 0.02 + 0.03 * Math.sin(Math.PI * t / dur); lp += (v - lp) * cut;
    out[i] = lp * Math.min(1, t / 0.6) * Math.min(1, (dur - t) / 0.6);
  }
  return out;
}
function bass(freq, dur = 0.6) { return cached(`bs${freq}`, () => { const n = Math.round(dur * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * freq / SR; o[i] = (Math.sin(ph) + 0.4 * Math.sin(2 * ph)) * Math.min(1, t / 0.01) * Math.exp(-t * 4); } return o; }); }
function kick() { const n = Math.round(0.3 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = 48 + 80 * Math.exp(-t * 35); ph += 2 * Math.PI * f / SR; o[i] = Math.sin(ph) * Math.exp(-t * 10); } return o; }
function hat() { const n = Math.round(0.07 * SR), o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { const t = i / SR, x = noise(); lp = lp * 0.5 + x * 0.5; o[i] = (x - lp) * Math.exp(-t * 60); } return o; }
function tone(freq, dur, { attack = 0.005, decay = 3, partials = [[1, 1]] } = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(1, t / attack) * Math.exp(-t * decay); let v = 0; for (const [m, a] of partials) v += a * Math.sin(2 * Math.PI * freq * m * t); out[i] = v * env; }
  return out;
}

// ---------- sound effects ----------
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t * d);
function fx(kind, note = 0) {
  const make = (dur, fn) => { const n = Math.round(dur * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const r = fn(t, ph); ph = r[1]; o[i] = r[0]; } return o; };
  const osc = (f, ph) => { ph += 2 * Math.PI * f / SR; return [Math.sin(ph), ph]; };
  const bell = (f, dur = 1.2) => tone(f, dur, { partials: [[1, 0.7], [2.76, 0.2], [5.4, 0.06]], decay: 3.2 });
  switch (kind) {
    case 'chime': { const o = new Float32Array(Math.round(2.0 * SR)); [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42]].forEach(([f, d]) => { const n = bell(f, 1.5); const off = Math.round(d * SR); for (let i = 0; i < n.length && off + i < o.length; i++) o[off + i] += n[i] * 0.7; }); return o; }
    case 'bloop': return make(0.18, (t, ph) => { const [v, p] = osc(500 + 700 * Math.exp(-t * 18), ph); return [v * env(t, 0.003, 22), p]; });
    case 'pop': return make(0.12, (t, ph) => { const [v, p] = osc(700 * Math.exp(-t * 25) + 180, ph); return [v * env(t, 0.002, 30), p]; });
    case 'ping': return bell(1975.5, 0.7);
    case 'sprout': return make(0.3, (t, ph) => { const [v, p] = osc(300 + 900 * t, ph); return [v * env(t, 0.004, 9), p]; });
    case 'whir': return make(1.4, (t, ph) => { const [v, p] = osc(180 + 40 * Math.sin(2 * Math.PI * 3 * t), ph); return [v * 0.3 * Math.sin(Math.PI * t / 1.4) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 18 * t)), p]; });
    case 'zip': return make(0.5, (t, ph) => { const [v, p] = osc(1400 - 1000 * t / 0.5, ph); return [v * 0.5 * Math.sin(Math.PI * t / 0.5), p]; });
    case 'clink': return bell([523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5][note % 8], 0.9);
    case 'flutter': { let lp = 0; return make(0.5, t => { const x = noise(); lp += (x - lp) * 0.3; return [(x - lp) * Math.abs(Math.sin(2 * Math.PI * 14 * t)) * 0.9 * Math.sin(Math.PI * t / 0.5), 0]; }); }
    case 'ratchet': return make(0.35, t => { const k = (t % 0.035) / 0.035; return [noise() * (k < 0.15 ? 1 - k / 0.15 : 0) * 0.8, 0]; });
    case 'tada': { const o = new Float32Array(Math.round(1.4 * SR)); [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.3]].forEach(([f, d]) => { const n = epiano(f, 1.1); const off = Math.round(d * SR); for (let i = 0; i < n.length && off + i < o.length; i++) o[off + i] += n[i] * 0.7; }); return o; }
    case 'boing': return make(0.6, (t, ph) => { const [v, p] = osc(240 * (1 + 0.45 * Math.sin(2 * Math.PI * 11 * t) * Math.exp(-t * 4)), ph); return [v * env(t, 0.004, 5), p]; });
    case 'splash': { let lp = 0; return make(0.7, t => { const c = 0.08 + 0.3 * Math.exp(-t * 6); lp += (noise() - lp) * c; return [lp * 1.6 * Math.exp(-t * 4) * Math.min(1, t / 0.01), 0]; }); }
    case 'whoosh': { let lp = 0; return make(0.6, t => { const c = 0.05 + 0.4 * Math.sin(Math.PI * t / 0.6); lp += (noise() - lp) * c; return [lp * Math.sin(Math.PI * t / 0.6) * 1.4, 0]; }); }
    case 'sprinkle': { const o = new Float32Array(Math.round(0.6 * SR)); for (let k = 0; k < 6; k++) { const n = bell(2000 + k * 230, 0.3); const off = Math.round(k * 0.07 * SR); for (let i = 0; i < n.length && off + i < o.length; i++) o[off + i] += n[i] * 0.5; } return o; }
    case 'zoom': return make(0.4, (t, ph) => { const [v, p] = osc(200 + 1800 * t / 0.4, ph); return [v * 0.5 * Math.sin(Math.PI * t / 0.4), p]; });
    case 'wheee': return make(1.3, (t, ph) => { const [v, p] = osc(400 + 900 * Math.sin(Math.PI * t / 1.3) + 30 * Math.sin(2 * Math.PI * 9 * t), ph); return [v * 0.45 * Math.sin(Math.PI * t / 1.3), p]; });
    case 'scratch': { let lp = 0; return make(0.35, t => { lp += (noise() - lp) * (0.2 + 0.2 * Math.sin(2 * Math.PI * 9 * t)); return [lp * Math.abs(Math.sin(2 * Math.PI * 6 * t)) * 1.6 * Math.exp(-t * 2), 0]; }); }
    case 'tick': return make(0.06, (t, ph) => { const [v, p] = osc(1800, ph); return [v * env(t, 0.001, 70), p]; });
    case 'flicker': return make(0.5, (t, ph) => { const on = Math.floor(t * 30) % 2 === 0; const [v, p] = osc(110, ph); return [Math.sign(v) * 0.25 * (on ? 1 : 0) * Math.exp(-t * 2), p]; });
    case 'squeak': return make(0.3, (t, ph) => { const [v, p] = osc(2200 + 600 * Math.sin(2 * Math.PI * 7 * t) - 800 * t, ph); return [v * 0.35 * Math.sin(Math.PI * t / 0.3), p]; });
    case 'swell': return pad([261.63, 329.63, 392.0, 523.25], 2.4);
    default: throw new Error('unknown fx ' + kind);
  }
}

// ---------- the song: gentle, hopeful, 100 BPM ----------
const BPM = 100, SPB = 60 / BPM, BAR = 4 * SPB;
const CH = [ // C – G/B – Am – F in a bright voicing, then the same with a lift
  { ep: [261.63, 329.63, 392.0, 523.25], bass: 130.81, arp: [523.25, 659.25, 783.99, 1046.5] },
  { ep: [246.94, 293.66, 392.0, 493.88], bass: 123.47, arp: [493.88, 587.33, 783.99, 987.77] },
  { ep: [220.0, 261.63, 329.63, 440.0], bass: 110.0, arp: [440.0, 523.25, 659.25, 880.0] },
  { ep: [174.61, 261.63, 349.23, 440.0], bass: 87.31, arp: [349.23, 440.0, 523.25, 698.46] },
];
const soft = t => t < 13 * BEAT_LEN && SOFT_BEATS.includes(Math.floor(t / BEAT_LEN));
const MUSIC_END = 60.4;

for (let bar = 0; bar * BAR < MUSIC_END; bar++) {
  const t0 = bar * BAR, ch = CH[bar % 4], quiet = soft(t0);
  ch.ep.forEach((f, k) => add(epiano(f, 2.2), t0 + k * 0.012, quiet ? 0.08 : 0.13, -0.2 + k * 0.13));             // chord on the downbeat
  if (!quiet) ch.ep.slice(1).forEach((f, k) => add(epiano(f, 1.2), t0 + 2 * SPB + k * 0.012, 0.07, 0.1));          // soft answer on beat 3
  add(pad(ch.ep.map(f => f / 2), BAR * 1.02), t0, quiet ? 0.5 : 0.35);
  for (let q = 0; q < 4; q++) {
    const t = t0 + q * SPB; if (t >= MUSIC_END) continue;
    if (q % 2 === 0) add(bass(ch.bass, 0.7), t, quiet ? 0.18 : 0.28);
    if (!quiet) { if (q % 2 === 0) add(kick(), t, 0.22); add(hat(), t + SPB / 2, 0.06, 0.3); }
  }
  // the bubbly arpeggio: sixteenth-note bloops cycling up the chord
  if (!quiet) for (let s = 0; s < 16; s++) { const t = t0 + s * SPB / 4; if (t >= MUSIC_END) continue; const f = ch.arp[[0, 1, 2, 3, 2, 1][s % 6]]; add(bloopNote(f), t, 0.07 * (s % 4 === 0 ? 1.1 : 0.8), 0.35 - (s % 4) * 0.2); }
}
// final resolve: a C major chime like a boot-up sound
[523.25, 659.25, 783.99, 1046.5].forEach((f, k) => add(tone(f, 2.2, { partials: [[1, 0.7], [2.76, 0.15]], decay: 1.6 }), MUSIC_END + k * 0.12, 0.2));
add(pad([130.81, 196.0, 261.63, 329.63], 2.0), MUSIC_END, 0.5);

// ---------- effects ----------
const FX_GAIN = { chime: 0.35, bloop: 0.3, pop: 0.32, ping: 0.22, sprout: 0.26, whir: 0.25, zip: 0.3, clink: 0.26, flutter: 0.3, ratchet: 0.25, tada: 0.5, boing: 0.32, splash: 0.3, whoosh: 0.32, sprinkle: 0.25, zoom: 0.3, wheee: 0.35, scratch: 0.3, tick: 0.35, flicker: 0.4, squeak: 0.28, swell: 0.6 };
for (const { t, kind, note } of SFX) add(fx(kind, note || 0), t, FX_GAIN[kind]);

// ---------- master ----------
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.05) * Math.min(1, (TOTAL - t) / 1.2);
  L[i] = Math.tanh(L[i] * 1.1) * fade; R[i] = Math.tanh(R[i] * 1.1) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.82 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4); }
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'soundtrack.wav'), out);
console.log(`soundtrack.wav: ${TOTAL}s, ${SFX.length} effects, peak normalised from ${peak.toFixed(2)}`);
