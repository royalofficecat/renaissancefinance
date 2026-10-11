// A small deterministic synthesizer: tones, noise, filters, envelopes, a light reverb, WAV output.
export const SR = 48000;

export class Mix {
  constructor(seconds) { this.n = Math.ceil(seconds * SR); this.L = new Float32Array(this.n); this.R = new Float32Array(this.n); }
  /** Add a mono signal callback f(i) -> sample, starting at time t for dur seconds, with gain and pan (-1..1). */
  add(t, dur, f, gain = 1, pan = 0) {
    const s0 = Math.floor(t * SR), len = Math.min(this.n - s0, Math.ceil(dur * SR));
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < len; i++) { const v = f(i); this.L[s0 + i] += v * gl; this.R[s0 + i] += v * gr; }
  }
  addStereo(t, other, gain = 1) {
    const s0 = Math.floor(t * SR), len = Math.min(this.n - s0, other.n);
    for (let i = 0; i < len; i++) { this.L[s0 + i] += other.L[i] * gain; this.R[s0 + i] += other.R[i] * gain; }
  }
  peak() { let p = 0; for (let i = 0; i < this.n; i++) p = Math.max(p, Math.abs(this.L[i]), Math.abs(this.R[i])); return p; }
  scale(g) { for (let i = 0; i < this.n; i++) { this.L[i] *= g; this.R[i] *= g; } }
}

/** ADSR envelope in seconds, returns e(i) for sample index i within a note of length dur. */
export function adsr(a, d, s, r, dur) {
  const A = a * SR, D = d * SR, R = r * SR, N = dur * SR;
  return i => {
    if (i < A) return i / A;
    if (i < A + D) return 1 - (1 - s) * (i - A) / D;
    if (i < N - R) return s;
    return Math.max(0, s * (N - i) / R);
  };
}
export const sine = (f, i, ph = 0) => Math.sin(2 * Math.PI * f * i / SR + ph);
export const tri = (f, i) => 2 * Math.abs(2 * ((f * i / SR) % 1) - 1) - 1;
export const saw = (f, i) => 2 * ((f * i / SR) % 1) - 1;

/** Deterministic white noise generator. */
export function noiseGen(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1; }; }

/** Biquad filter (RBJ). type: 'lp' | 'hp' | 'bp'. Call set(freq, q) then process(x). */
export class Biquad {
  constructor(type, f, q) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q) {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  process(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

/** Light Schroeder reverb applied to a whole Mix (returns a new wet Mix). */
export function reverb(mix, { decay = 0.75, wet = 1 } = {}) {
  const out = new Mix(mix.n / SR);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d, bufL: new Float32Array(d), bufR: new Float32Array(d), i: 0 }));
  const aps = [225, 556].map(d => ({ d, bufL: new Float32Array(d), bufR: new Float32Array(d), i: 0 }));
  for (let n = 0; n < mix.n; n++) {
    let l = 0, r = 0;
    for (const c of combs) { const yl = c.bufL[c.i], yr = c.bufR[c.i]; c.bufL[c.i] = mix.L[n] + yl * decay; c.bufR[c.i] = mix.R[n] + yr * decay; c.i = (c.i + 1) % c.d; l += yl; r += yr; }
    l /= combs.length; r /= combs.length;
    for (const a of aps) { const bl = a.bufL[a.i], br = a.bufR[a.i]; const ol = -l + bl, or = -r + br; a.bufL[a.i] = l + bl * 0.5; a.bufR[a.i] = r + br * 0.5; a.i = (a.i + 1) % a.d; l = ol; r = or; }
    out.L[n] = l * wet; out.R[n] = r * wet;
  }
  return out;
}

export function toWav(mix) {
  const n = mix.n, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix.L[i] * 32767))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix.R[i] * 32767))), 46 + i * 4); }
  return buf;
}
