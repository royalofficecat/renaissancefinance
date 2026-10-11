// The HTML text layer: title, captions, stats, day counter, legend, end card, safe zones.
// Everything is driven by the virtual time `t` (seconds); there are no CSS transitions.
import { BEATS, beatAt } from './timeline.js';
import { easeOut, easeIn, lerp, span } from './easing.js';

const $ = id => document.getElementById(id);
const el = { day: $('day'), title: $('title'), stat: $('stat'), statNum: $('stat').querySelector('.num'), statLab: $('stat').querySelector('.lab'), caption: $('caption'), legend: $('legend'), endcard: $('endcard'), safe: $('safe') };

const WORD_STAGGER = 0.04, WORD_IN = 0.32, OUT = 0.18;

/** "a **b** c" -> one span per word, bold where marked. Returns the word elements. */
function setWords(node, lines) {
  node.innerHTML = '';
  const words = [];
  lines.forEach((line, li) => {
    if (li) node.appendChild(document.createElement('br'));
    // mark every character with its bold state, then split into words on spaces
    const chars = []; let bold = false;
    line.split(/(\*\*)/).forEach(part => { if (part === '**') { bold = !bold; return; } for (const ch of part) chars.push({ ch, bold }); });
    let cur = null;
    for (const c of chars) {
      if (!cur) { cur = { text: '', bold: c.bold }; }
      cur.text += c.ch;
      if (c.ch === ' ') { words.push(cur); cur = null; }
    }
    if (cur) words.push(cur);
    for (const w of words.splice(0).map(w => w)) {
      if (w.text === undefined) continue;
      const s = document.createElement('span');
      s.className = 'word'; s.textContent = w.text; if (w.bold) s.style.fontWeight = '700';
      node.appendChild(s); words.push(s);
    }
  });
  return words;
}

/** Animate words: rise and fade in with a stagger; leave faster than they arrive. */
function animateWords(node, words, tIn, tOut, t) {
  if (t < tIn || t > tOut + 0.01) { node.style.opacity = '0'; return; }
  node.style.opacity = '1';
  const leaving = t > tOut - OUT;
  const panelIn = easeOut(span(t, tIn, tIn + 0.25));
  const panelOut = leaving ? 1 - easeIn(span(t, tOut - OUT, tOut)) : 1;
  node.style.opacity = String(panelIn * panelOut);
  words.forEach((w, i) => {
    const a = easeOut(span(t, tIn + i * WORD_STAGGER, tIn + i * WORD_STAGGER + WORD_IN));
    const o = leaving ? 1 - easeIn(span(t, tOut - OUT + i * 0.008, tOut)) : 1;
    w.style.opacity = String(a * o);
    w.style.transform = `translateY(${lerp(18, 0, a) + lerp(0, -10, 1 - o)}px)`;
  });
}

const cache = new Map();
function words(node, key, lines) {
  if (cache.get(node) !== key) { cache.set(node, key); node._words = setWords(node, lines); }
  return node._words;
}

export function initOverlay(opts = {}) {
  el.safe.classList.toggle('on', !!opts.safe);
  el.legend.innerHTML = `<div class="row"><span class="sw" style="background:#2F7FC2"></span>Flooded area</div>
    <div class="row"><span class="sw" style="background:#E0A640"></span>Flood edge / closed route</div>
    <div class="tag">Illustrative scenario, not a forecast</div>`;
  el.endcard.innerHTML = `<div class="q"></div><div class="sub">Thirty days of rain could change California</div>`;
}

export function updateOverlay(t) {
  const b = beatAt(t);
  const local = t - b.start;

  // Day counter
  let dayText = '';
  if (typeof b.day === 'string') dayText = b.day;
  else if (b.day) { const d = Math.round(lerp(b.day[0], b.day[1], span(local, 0.2, b.end - b.start - 0.4))); dayText = `Day ${d}`; }
  const dayW = words(el.day, dayText, [dayText]);
  animateWords(el.day, dayW, b.start === 0 ? 0 : b.start + 0.15, b.endcard ? b.start : b.end - 0.05, t);
  if (b.endcard) el.day.style.opacity = '0';

  // Title (hook on beat 1, payoff on beats 12-13) - stays up across adjacent beats that share it
  if (b.title) {
    const first = BEATS.find(x => x.title === b.title), last = [...BEATS].reverse().find(x => x.title === b.title);
    const w = words(el.title, b.title, [b.title]);
    animateWords(el.title, w, first.start === 0 ? -1 : first.start + 0.4, last.end - 0.1, t);
  } else el.title.style.opacity = '0';

  // Captions
  const caps = b.captions || (b.caption ? [{ at: b.caption.at ?? 0.5, until: b.end - b.start, lines: b.caption.lines }] : []);
  let shown = false;
  for (const c of caps) {
    const tIn = b.start + c.at, tOut = b.start + c.until - 0.05;
    if (t >= tIn && t <= tOut) { const w = words(el.caption, c.lines.join('|'), c.lines); animateWords(el.caption, w, tIn, tOut, t); shown = true; break; }
  }
  if (!shown) el.caption.style.opacity = '0';

  // Stat panel with count-up (fixed-width figures via CSS)
  if (b.stat) {
    const tIn = b.start + 0.4, tOut = b.end - 0.05;
    const v = lerp(b.stat.count[0], b.stat.count[1], easeOut(span(t, tIn, tIn + 0.9)));
    el.statNum.innerHTML = b.stat.text(v);
    el.statLab.textContent = b.stat.label;
    const a = easeOut(span(t, tIn, tIn + 0.3)) * (t > tOut - OUT ? 1 - easeIn(span(t, tOut - OUT, tOut)) : 1);
    el.stat.style.opacity = String(a);
    el.stat.style.transform = `translateY(${lerp(16, 0, a)}px)`;
  } else el.stat.style.opacity = '0';

  // Legend on map beats
  const legendOn = !!b.legend;
  el.legend.style.opacity = legendOn ? String(easeOut(span(local, 0.3, 0.7)) * (local > b.end - b.start - OUT && !beatAt(b.end + 0.01).legend ? 1 - easeIn(span(local, b.end - b.start - OUT, b.end - b.start)) : 1)) : '0';

  // End card
  if (b.endcard) {
    const q = el.endcard.querySelector('.q');
    const w = words(q, 'end', ['California’s next big investment: more water storage—or more room for rivers?']);
    animateWords(q, w, b.start + 0.2, b.end + 1, t);
    el.endcard.style.opacity = String(easeOut(span(t, b.start, b.start + 0.4)));
  } else el.endcard.style.opacity = '0';
}
