// Easing and small math helpers. Every motion in the video goes through these.
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = t => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = t => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = t => { t = clamp01(t); return t * t * t; };
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Spring arrival with a small overshoot (damping ratio ~0.72). 0 -> 1 over [0, 1]. */
export function spring(t) {
  t = clamp01(t);
  const z = 0.72, w = 9.5;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
/** Deterministic random numbers from a fixed seed (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Progress 0..1 of time t within [a, b]. */
export const span = (t, a, b) => clamp01((t - a) / (b - a));
