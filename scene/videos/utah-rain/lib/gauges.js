// Qualitative gauges for the imagined scenario (runoff, ground saturation, flood pressure): five pips each,
// neutral colours only, no invented numbers. Driven by the frame number like the rest of the text layer.
import { clamp, ease, prog } from '../../../src/core/util.js';

const NAMES = [['runoff', 'Runoff'], ['saturation', 'Ground saturation'], ['flood', 'Flood pressure']];
const FPS = 30;

export class Gauges {
  constructor(overlay) {
    this.overlay = overlay;
    this.el = document.getElementById('gauges');
    this.el.innerHTML = NAMES.map(([k, n]) => `<div class="g" data-k="${k}"><span class="name">${n}</span><span class="pips">${'<span class="pip"></span>'.repeat(5)}</span></div>`).join('') + '<div class="tag">Imagined scenario</div>';
    this.rect = null;
  }

  update(frame) {
    const o = this.overlay;
    const b = o.beatAt(frame);
    const beats = o.beats;
    const i = beats.indexOf(b);
    const g = b.gauges;
    if (!g) { this.el.style.opacity = '0'; this.rect = null; return; }
    const prev = beats[i - 1] && beats[i - 1].gauges, next = beats[i + 1] && beats[i + 1].gauges;
    const t = (frame - b.start) / FPS, dur = (b.end - b.start) / FPS;
    // Pips fill one by one from the previous beat's level (if it had gauges) to this beat's level
    for (const [k] of NAMES) {
      const from = prev ? prev[k] : 0, to = g[k];
      const level = from + (to - from) * ease.inOutSine(prog(t, 0.5, 1.5));
      this.el.querySelectorAll(`.g[data-k="${k}"] .pip`).forEach((p, j) => {
        const on = clamp(level - j);
        p.classList.toggle('on', on > 0.5);
      });
    }
    // Place under the lowest left-hand panel that is showing in this beat
    const L = o.layout;
    let top = 154;
    for (const k of ['title', 'stat', 'legend']) {
      const r = L[k];
      const has = k === 'title' ? b.title : k === 'stat' ? b.stat : b.legend;
      if (r && has) top = Math.max(top, r.y + r.h + 16);
    }
    this.el.style.top = `${top}px`;
    const pin = prev ? 1 : ease.outCubic(prog(t, 0.4, 0.75));
    const pout = next ? 0 : ease.inCubic(prog(t, dur - 0.3, dur - 0.05));
    const op = pin * (1 - pout);
    this.el.style.opacity = op.toFixed(4);
    this.rect = op > 0.02 ? { x: this.el.offsetLeft, y: this.el.offsetTop, w: this.el.offsetWidth, h: this.el.offsetHeight } : null;
  }
}
