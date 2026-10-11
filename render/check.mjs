// Quality checks that can be measured in the page: fonts, caption line counts, safe zones, panel overlap.
//   node render/check.mjs      (renders one frame per beat at 1x, prints a report; exit code 1 on failures)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

execFileSync('node', ['render/build.mjs'], { stdio: 'ignore' });
const { server, port } = await serve();
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/scene/index.html?pr=1`);
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });

// one moment per caption, chosen when the caption is fully on screen
const MOMENTS = [2.0, 6.0, 10.5, 14.5, 18.5, 24.0, 30.0, 35.0, 39.0, 43.0, 47.0, 52.0, 56.0, 59.0, 63.0];
const SAFE = { top: 154, bottom: 1536, right: 950 };
const fails = [], notes = [];
for (const t of MOMENTS) {
  await page.evaluate(n => window.__render(n), Math.round(t * 30));
  const r = await page.evaluate(() => {
    const out = { fonts: new Set(), panels: [] };
    for (const id of ['day', 'title', 'stat', 'caption', 'legend', 'endcard']) {
      const el = document.getElementById(id); if (!el || Number(el.style.opacity || 1) < 0.5) continue;
      const b = el.getBoundingClientRect(); if (b.width === 0) continue;
      const lh = parseFloat(getComputedStyle(id === 'stat' ? el.querySelector('.num') : el).lineHeight);
      const words = [...el.querySelectorAll('.word')];
      const lines = words.length ? new Set(words.map(w => Math.round(w.getBoundingClientRect().top))).size : 1;
      out.panels.push({ id, top: b.top, bottom: b.bottom, left: b.left, right: b.right, lines, text: el.textContent.trim().slice(0, 60) });
      for (const n of [el, ...el.querySelectorAll('*')]) out.fonts.add(getComputedStyle(n).fontFamily);
    }
    out.fonts = [...out.fonts];
    out.loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style);
    return out;
  });
  for (const p of r.panels) {
    if (p.top < SAFE.top || p.bottom > SAFE.bottom || p.right > SAFE.right) fails.push(`${t}s ${p.id}: outside safe zone (top ${p.top.toFixed(0)}, bottom ${p.bottom.toFixed(0)}, right ${p.right.toFixed(0)})`);
    if ((p.id === 'caption') && p.lines > 2) fails.push(`${t}s caption has ${p.lines} lines: "${p.text}"`);
    if (p.id === 'title' && p.lines > 3) fails.push(`${t}s title has ${p.lines} lines`);
  }
  for (let i = 0; i < r.panels.length; i++) for (let j = i + 1; j < r.panels.length; j++) {
    const a = r.panels[i], b = r.panels[j];
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) fails.push(`${t}s panels overlap: ${a.id} and ${b.id}`);
  }
  for (const f of r.fonts) if (!/^"?Video Serif"?/.test(f)) fails.push(`${t}s non-serif font in use: ${f}`);
  notes.push(`${String(t).padStart(4)} s  panels: ${r.panels.map(p => `${p.id}(${p.lines}L)`).join(' ')}`);
  if (t === MOMENTS[0]) notes.push(`loaded font faces: ${r.loaded.join(', ')}`);
}
await browser.close(); server.close();
console.log(notes.join('\n'));
console.log(fails.length ? '\nFAILURES:\n' + fails.join('\n') : '\nall text checks passed: fonts, line counts, safe zones, no overlapping panels');
process.exit(fails.length ? 1 : 0);
