// Map labels: sharp distance-field text (troika-three-text) in the same font file as the web text.
// Labels always face the camera, keep a constant on-screen size, sit up-and-right of their dot,
// and fade out (never overlap) when they would collide, leave the safe zone, or touch a text panel.
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { HEX } from './look.js';
import { clamp } from './util.js';

const FONT = {
  regular: new URL('/scene/fonts/LiberationSerif-Regular.ttf', location.origin).href,
  italic: new URL('/scene/fonts/LiberationSerif-Italic.ttf', location.origin).href,
};
const SAFE = { x0: 28, x1: 950, y0: 154, y1: 1536 };
const W = 1080, H = 1920;

export class Labels {
  /** @param {object} colors  { text, halo } (defaults: the first video's light text on a dark halo) */
  constructor(colors = {}) {
    this.colors = { text: HEX.text, halo: HEX.panel, ...colors };
    this.scene = new THREE.Scene();
    this.items = new Map();
    this._v = new THREE.Vector3();
  }

  /**
   * @param {string} id
   * @param {object} o {text, pos: Vector3, italic, dot, size(px), priority, anchor: 'dot'|'center'}
   */
  add(id, { text, pos, italic = false, dot = false, size = 30, priority = 1, anchor = dot ? 'dot' : 'center' }) {
    const t = new Text();
    t.text = text;
    t.font = italic ? FONT.italic : FONT.regular;
    t.fontSize = 1;
    t.color = this.colors.text;
    t.anchorX = anchor === 'dot' ? 'left' : 'center';
    t.anchorY = anchor === 'dot' ? 'bottom' : 'middle';
    t.outlineWidth = '9%';
    t.outlineBlur = '22%';
    t.outlineColor = this.colors.halo;
    t.outlineOpacity = 0.92;
    t.material = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    t.renderOrder = 10;
    this.scene.add(t);
    let dotMesh = null;
    if (dot) {
      dotMesh = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: this.colors.halo, transparent: true, depthTest: false, toneMapped: false }));
      const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: this.colors.text, transparent: true, depthTest: false, toneMapped: false }));
      fill.position.z = 0.01;
      ring.renderOrder = fill.renderOrder = 9;
      dotMesh.add(ring, fill);
      this.scene.add(dotMesh);
    }
    const item = { id, t, dot: dotMesh, pos: pos.clone(), size, priority, anchor, opacity: 0 };
    this.items.set(id, item);
    return item;
  }

  sync() {
    return Promise.all([...this.items.values()].map((it) => new Promise((res) => it.t.sync(res))));
  }

  /**
   * @param {THREE.PerspectiveCamera} cam
   * @param {Object<string, number>} want  label id -> desired opacity (0..1) from the shot schedule
   * @param {Array<{x,y,w,h}>} avoid  on-screen panels to keep clear of
   */
  update(cam, want, avoid = []) {
    cam.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 2).negate();
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    const placed = [];
    const order = [...this.items.values()].sort((a, b) => b.priority - a.priority);
    for (const it of order) {
      const target = want[it.id] || 0;
      const rel = this._v.copy(it.pos).sub(cam.position);
      const depth = rel.dot(fwd);
      if (target <= 0.001 || depth <= 0) {
        this.hide(it);
        continue;
      }
      const wpp = (2 * depth * tanHalf) / H; // world units per output pixel at this depth
      it.t.quaternion.copy(cam.quaternion);
      it.t.scale.setScalar(it.size * wpp);
      const bb = it.t.textRenderInfo ? it.t.textRenderInfo.blockBounds : [0, 0, 4, 1];
      const tw = (bb[2] - bb[0]) * it.size, th = (bb[3] - bb[1]) * it.size;
      const p = it.pos.clone().project(cam);
      const sx = (p.x * 0.5 + 0.5) * W, sy = (1 - (p.y * 0.5 + 0.5)) * H;
      let rect;
      if (it.anchor === 'dot') {
        const dx = 12, dy = 6;
        it.t.position.copy(it.pos).addScaledVector(right, dx * wpp).addScaledVector(up, dy * wpp);
        it.dot.position.copy(it.pos);
        it.dot.quaternion.copy(cam.quaternion);
        it.dot.scale.setScalar(6 * wpp);
        rect = { x: sx - 9, y: sy - dy - th, w: dx + tw + 9, h: th + dy + 9 };
      } else {
        it.t.position.copy(it.pos);
        rect = { x: sx - tw / 2, y: sy - th / 2, w: tw, h: th };
      }
      // Fade out smoothly as any edge approaches the safe-zone border: fully gone by the time it touches it.
      const over = Math.max(SAFE.x0 - rect.x, rect.x + rect.w - SAFE.x1, SAFE.y0 - rect.y, rect.y + rect.h - SAFE.y1);
      let o = target * clamp(-over / 28);
      for (const r of avoid) o *= clamp(1 - overlap(rect, r, 10) / 14);
      for (const q of placed) o *= clamp(1 - overlap(rect, q, 6) / 10);
      it.opacity = o;
      it.rect = rect;
      if (o > 0.02) placed.push(rect);
      this.apply(it, o);
    }
  }

  apply(it, o) {
    it.t.visible = o > 0.003;
    it.t.fillOpacity = o;
    it.t.outlineOpacity = 0.92 * o;
    if (it.dot) {
      it.dot.visible = it.t.visible;
      it.dot.children.forEach((m) => (m.material.opacity = o));
    }
  }

  hide(it) {
    it.opacity = 0;
    this.apply(it, 0);
  }

  /** Current on-screen rectangles of visible labels (for QA). */
  visible() {
    return [...this.items.values()].filter((i) => i.opacity > 0.02).map((i) => ({ id: i.id, opacity: +i.opacity.toFixed(3), rect: Object.fromEntries(Object.entries(i.rect).map(([k, v]) => [k, Math.round(v)])) }));
  }
}

function overlap(a, b, pad) {
  const x = Math.min(a.x + a.w, b.x + b.w + pad) - Math.max(a.x, b.x - pad);
  const y = Math.min(a.y + a.h, b.y + b.h + pad) - Math.max(a.y, b.y - pad);
  return x > 0 && y > 0 ? Math.min(x, y) : 0;
}
