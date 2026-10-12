// Shared timing for every beat: the camera holds while the caption lands (0.67 s), moves on an eased
// curve, and is at rest again before the next dissolve begins (0.6 s before the cut).
import * as THREE from 'three';
import { move, orbit } from '../../../src/core/camera.js';
import { ease } from '../../../src/core/util.js';
import { Labels } from '../../../src/core/labels.js';
import { HEX } from '../look.js';

export const HOLD = 20, SETTLE = 18;
export const beatMove = (f, [s, e], A, B, o = {}) => move(f, s + HOLD, e - SETTLE, A, B, { fn: ease.inOutSine, ...o });
export const beatOrbit = (f, [s, e], o) => orbit(f, s + HOLD, e - SETTLE, { fn: ease.inOutSine, ...o });

/** In-world place names: dark text on a light halo, like the map labels. */
export function placeLabels(list) {
  const labels = new Labels({ text: HEX.text, halo: HEX.panel });
  for (const { id, text, pos, dot = true, italic = false, size = 30 } of list) labels.add(id, { text, pos: pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...pos), dot, italic, size, priority: 2 });
  return labels;
}
