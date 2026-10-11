// On-screen text layer (web text over the 3d canvas). Everything is driven by the frame number,
// never by CSS transitions or timers, so a given frame always looks the same.
import { clamp, ease, prog } from './core/util.js';
import { HEX } from './core/look.js';

const FPS = 30;
const STAGGER = 0.04; // seconds between words
const WORD_IN = 0.45; // seconds for one word to arrive
const OUT = 0.25; // seconds to leave (faster than arriving)
const RISE = 24; // px

const SAFE = { top: 154, bottom: 1536, right: 950 };

function wordsHTML(text) {
  // "**bold**" marks the key number; "\n" separates lines.
  return text
    .split('\n')
    .map((line) => {
      const out = [];
      let bold = false;
      for (const part of line.split('**')) {
        for (const w of part.split(' ').filter(Boolean)) out.push({ w, bold });
        bold = !bold;
      }
      return `<span class="line">${out
        .map((o, i) => `<span class="w">${o.bold ? `<b>${o.w}</b>` : o.w}${i < out.length - 1 ? ' ' : ''}</span>`)
        .join('')}</span>`;
    })
    .join('');
}

function fmtNumber(v, decimals) {
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export class Overlay {
  constructor(beatsDoc) {
    this.beats = beatsDoc.beats;
    this.total = beatsDoc.totalFrames;
    this.el = Object.fromEntries(['title', 'stat', 'day', 'legend', 'caption', 'endcard'].map((k) => [k, document.getElementById(k)]));
    this.current = null;
    this.layout = {};
  }

  beatAt(frame) {
    return this.beats.find((b) => frame >= b.start && frame < b.end) || this.beats[this.beats.length - 1];
  }

  /** Rebuild the DOM content for a beat and measure where every panel goes. */
  setBeat(b) {
    if (this.current === b) return;
    this.current = b;
    const { title, stat, day, legend, caption, endcard } = this.el;
    title.innerHTML = b.title ? wordsHTML(b.title) : '';
    caption.innerHTML = b.caption ? wordsHTML(b.caption) : '';
    endcard.innerHTML = b.endCard ? wordsHTML(b.endCard) : '';
    stat.querySelector('.lab').textContent = b.stat ? b.stat.label : '';
    legend.innerHTML = (b.legend || [])
      .map((r) => {
        const col = { water: HEX.water, accent: HEX.accent, highlight: HEX.green, outline: '#C9D0D6', 'outline-highlight': HEX.green }[r.swatch];
        const isOutline = r.swatch.startsWith('outline');
        const cls = isOutline ? 'sw outline' : 'sw';
        const style = isOutline ? `border-color:${col}` : `background:${col}`;
        return `<div class="row"><span class="${cls}" style="${style}"></span><span>${r.text}</span></div>`;
      })
      .join('') + (b.tag ? `<div class="tag">${b.tag}</div>` : '');

    // Layout: title on top, then stats (left) + day chip (right), legend under the stats panel.
    const top = b.title ? SAFE.top + title.offsetHeight + 18 : SAFE.top;
    stat.style.top = `${top}px`;
    day.style.top = `${top}px`;
    this.setStatText(b, 1);
    legend.style.top = `${top + stat.offsetHeight + 16}px`;
    if (b.endCard) {
      const h = endcard.offsetHeight;
      endcard.style.top = `${Math.round((SAFE.top + SAFE.bottom) / 2 - h / 2)}px`;
    }
    this.layout = {};
    for (const [k, e] of Object.entries(this.el)) {
      this.layout[k] = { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight };
    }
  }

  setStatText(b, p) {
    const s = b.stat;
    const num = this.el.stat.querySelector('.num');
    if (!s) return (num.textContent = '');
    let out = s.template;
    s.parts.forEach((v, i) => {
      out = out.replace(`{${i}}`, fmtNumber(v * p, s.decimals));
    });
    num.textContent = out;
  }

  /** Word-by-word entrance and quick exit for a text panel. Returns panel opacity. */
  animateWords(panel, t, tIn, tOut, { instant = false } = {}) {
    const words = panel.querySelectorAll('.w');
    const outP = ease.inCubic(prog(t, tOut, tOut + OUT));
    words.forEach((w, i) => {
      const p = instant ? 1 : ease.outCubic(prog(t, tIn + i * STAGGER, tIn + i * STAGGER + WORD_IN));
      w.style.opacity = (p * (1 - outP)).toFixed(4);
      w.style.transform = `translateY(${((1 - p) * RISE - outP * 10).toFixed(2)}px)`;
    });
    const pin = instant ? 1 : ease.outCubic(prog(t, tIn - 0.05, tIn + 0.3));
    return clamp(pin * (1 - outP));
  }

  setPanel(panel, opacity, rise = 0) {
    panel.style.opacity = opacity.toFixed(4);
    panel.style.transform = `translateY(${rise.toFixed(2)}px)`;
  }

  update(frame) {
    const b = this.beatAt(frame);
    this.setBeat(b);
    const t = (frame - b.start) / FPS;
    const dur = (b.end - b.start) / FPS;
    const tOut = dur - 0.3;
    const idx = this.beats.indexOf(b);
    const prev = this.beats[idx - 1], next = this.beats[idx + 1];
    const { title, stat, day, legend, caption, endcard } = this.el;
    const isLast = b.id === 'end';

    // Title: on beat 1 it is fully on screen from the very first frame (the hook).
    if (b.title) {
      const o = this.animateWords(title, t, 0.1, tOut, { instant: b.id === 1 });
      this.setPanel(title, o);
    } else this.setPanel(title, 0);

    // Caption arrives just after the title (or right away), one idea per beat.
    if (b.caption) {
      const tIn = b.title && b.id !== 1 ? 0.55 : 0.13;
      this.setPanel(caption, this.animateWords(caption, t, tIn, tOut));
    } else this.setPanel(caption, 0);

    // Stats panel: fades in, then the number counts up (fixed-width figures, so nothing jiggles).
    if (b.stat) {
      const pin = ease.outCubic(prog(t, 0.2, 0.55));
      const pout = ease.inCubic(prog(t, tOut, tOut + OUT));
      this.setPanel(stat, pin * (1 - pout), (1 - pin) * 14);
      const tc = b.id === 12 || b.id === 13 ? 1.0 : 0.8;
      this.setStatText(b, ease.outCubic(prog(t, tc, tc + 0.9)));
    } else this.setPanel(stat, 0);

    // Day chip: continuous across beats, ticks forward through the beat.
    const hasDay = (x) => x && (x.day || x.dayText);
    if (hasDay(b)) {
      const pin = hasDay(prev) ? 1 : ease.outCubic(prog(t, 0.2, 0.55));
      const pout = hasDay(next) ? 0 : ease.inCubic(prog(t, tOut, tOut + OUT));
      this.setPanel(day, pin * (1 - pout));
      if (b.day) {
        const [d0, d1] = b.day;
        const p = ease.inOutSine(prog(t, 0.6, dur - 0.4));
        const d = Math.min(d1, Math.floor(d0 + (d1 - d0 + 0.999) * p));
        day.querySelector('.d').textContent = `Day ${d} / 30`;
        day.querySelector('.s').textContent = 'illustrative scenario';
      } else {
        const [a, s] = b.dayText.split(' · ');
        day.querySelector('.d').textContent = a;
        day.querySelector('.s').textContent = s || 'illustrative scenario';
      }
    } else this.setPanel(day, 0);

    // Legend: neutral panel, colour only in the swatches.
    if (b.legend) {
      const same = (x) => x && JSON.stringify(x.legend) === JSON.stringify(b.legend) && x.tag === b.tag;
      const pin = same(prev) ? 1 : ease.outCubic(prog(t, 0.35, 0.7));
      const pout = same(next) ? 0 : ease.inCubic(prog(t, tOut, tOut + OUT));
      this.setPanel(legend, pin * (1 - pout));
    } else this.setPanel(legend, 0);

    if (b.endCard) {
      this.setPanel(endcard, this.animateWords(endcard, t, 0.2, isLast ? 99 : tOut));
    } else this.setPanel(endcard, 0);
  }

  /** Rectangles of the visible panels, so 3d labels can keep clear of them. */
  rects() {
    return Object.entries(this.layout)
      .filter(([k]) => parseFloat(this.el[k].style.opacity || 0) > 0.02)
      .map(([, r]) => r);
  }
}
