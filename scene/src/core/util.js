// Small deterministic helpers: easing, springs, seeded randomness, timing.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Normalised progress of x through [a, b], clamped. */
export const prog = (x, a, b) => clamp((x - a) / (b - a));

export const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
};

/** Damped spring from 0 to 1 with a small overshoot (~6%). t in seconds since start. */
export function spring(t, dur = 0.7) {
  if (t <= 0) return 0;
  const x = t / dur;
  if (x >= 2.2) return 1;
  const zeta = 0.66, w = 7.2;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + ((zeta * w) / wd) * Math.sin(wd * x));
}

/** mulberry32: tiny seeded PRNG, so every "random" thing is identical on every render. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vertical field of view (degrees) for a lens on a 36 mm long side (our frame is portrait). */
export const fovForLens = (mm) => (2 * Math.atan(18 / mm) * 180) / Math.PI;

export const FPS = 30;
