// Assembles the PNG stills in a folder into one labelled contact sheet (timestamp under each frame).
//   node render/contact-sheet.mjs out/contact [--cols 7] [--title "Contact sheet"]
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { serve } from './serve.mjs';

const dir = process.argv[2];
const argv = process.argv.slice(3);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const cols = Number(opt('cols', 7)), title = opt('title', 'Contact sheet');
const files = readdirSync(dir).filter(f => /^t[\d_]+\.png$/.test(f)).sort((a, b) => parseFloat(a.slice(1).replace('_', '.')) - parseFloat(b.slice(1).replace('_', '.')));
const beats = [[0, 4, 1], [4, 8, 2], [8, 12, 3], [12, 16, 4], [16, 20, 5], [20, 26, 6], [26, 32, 7], [32, 36, 8], [36, 40, 9], [40, 44, 10], [44, 48, 11], [48, 54, 12], [54, 60, 13], [60, 64, 'end card']];
const label = f => { const s = parseFloat(f.slice(1).replace('_', '.')); const b = beats.find(([a, z]) => s >= a && s < z); const mm = Math.floor(s / 60), ss = (s % 60).toFixed(2).padStart(5, '0'); return `${mm}:${ss}  ·  frame ${Math.round(s * 30)}  ·  beat ${b ? b[2] : '?'}`; };
const W = 300, H = Math.round(W * 1920 / 1080);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Video Serif"; src: url(/fonts/LiberationSerif-Regular.ttf); }
  body { margin: 0; background: #181A1E; color: #F3EFE6; font-family: "Video Serif", serif; }
  #sheet { display: inline-block; padding: 28px 32px 24px; }
  h1 { font-size: 30px; font-weight: 400; margin: 0 0 18px; } h1 span { color: #D2CBBF; font-style: italic; font-size: 22px; margin-left: 18px; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, ${W}px); gap: 22px 18px; }
  .cell img { width: ${W}px; height: ${H}px; display: block; border-radius: 6px; border: 1px solid rgba(138,132,122,0.35); }
  .cell div { font-size: 17px; color: #D2CBBF; margin-top: 7px; text-align: center; font-variant-numeric: tabular-nums; }
</style></head><body><div id="sheet"><h1>${title}<span>${files.length} frames · 1080 × 1920 · 30 fps</span></h1><div class="grid">
${files.map(f => `<div class="cell"><img src="/${dir}/${f}"><div>${label(f)}</div></div>`).join('\n')}
</div></div></body></html>`;
writeFileSync(`${dir}/_sheet.html`, html);
const { server, port } = await serve();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: cols * (W + 18) + 80, height: 2000 }, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/${dir}/_sheet.html`);
await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready);
await page.locator('#sheet').screenshot({ path: `${dir}/contact-sheet.png`, type: 'png' });
await browser.close(); server.close();
console.log('wrote', `${dir}/contact-sheet.png`);
