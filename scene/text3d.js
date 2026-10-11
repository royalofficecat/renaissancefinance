// Sharp distance-field text inside the 3D world (map labels), using the same serif file.
import { Text, preloadFont, configureTextBuilder } from 'troika-three-text';
import * as THREE from 'three';

configureTextBuilder({ useWorker: false });
export const FONTS = { regular: '/fonts/LiberationSerif-Regular.ttf', bold: '/fonts/LiberationSerif-Bold.ttf', italic: '/fonts/LiberationSerif-Italic.ttf' };

export function preloadFonts() {
  return Promise.all(Object.values(FONTS).map(font => new Promise(res => preloadFont({ font, characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 –-’\'.,' }, res))));
}

const all = new Set();
/** A camera-facing label. `size` is in world units (km on the map). */
export function makeLabel(text, { size = 14, style = 'regular', color = 0xF3EFE6, anchorX = 'left', anchorY = 'bottom' } = {}) {
  const t = new Text();
  t.text = text; t.font = FONTS[style]; t.fontSize = size; t.color = color;
  t.anchorX = anchorX; t.anchorY = anchorY; t.depthOffset = -2;
  t.material.transparent = true; t.material.depthWrite = false; t.material.depthTest = false;
  t.outlineWidth = size * 0.06; t.outlineColor = 0x181A1E; t.outlineOpacity = 0.55;
  t.renderOrder = 10; t.userData.billboard = true;
  all.add(t);
  return t;
}
/** Make every label face the camera, then wait for all text geometry to be ready. */
/** Fade a label (fill and outline together); hides it completely at 0. */
export function setLabelOpacity(t, a) { t.fillOpacity = a; t.outlineOpacity = 0.55 * a; t.visible = a > 0.001; }

export function syncLabels(camera) {
  const q = camera.quaternion;
  const jobs = [];
  for (const t of all) {
    if (!t.visible) continue;
    if (t.userData.billboard) t.quaternion.copy(q);
    // troika only invokes the callback when a re-layout is needed, so resolve at once otherwise
    jobs.push(t._needsSync ? new Promise(res => t.sync(res)) : Promise.resolve());
  }
  return Promise.all(jobs);
}
