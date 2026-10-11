// Quality checklist (Part 9). Run after the final render: node render/qa.mjs
// Writes out/qa-report.md and exits non-zero if a hard check fails.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { OUT, ROOT, bundle, openPage, serve } from './lib.mjs';

const beatsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'scene/beats.json'), 'utf8'));
const MP4 = path.join(OUT, 'california-30-days-of-rain.mp4');
const SAFE = { x0: 0, x1: 950, y0: 154, y1: 1536 };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const inside = (r) => r.x >= SAFE.x0 - 0.5 && r.x + r.w <= SAFE.x1 + 0.5 && r.y >= SAFE.y0 - 0.5 && r.y + r.h <= SAFE.y1 + 0.5;
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

if (fs.existsSync(MP4)) {
  // ---------- 1. File format
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', MP4]).toString());
  const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
  const dur = parseFloat(probe.format.duration);
  check('video is 1080 x 1920', v.width === 1080 && v.height === 1920, `${v.width}x${v.height}`);
  check('30 frames per second', v.r_frame_rate === '30/1', v.r_frame_rate);
  check('length 30-65 s', dur >= 30 && dur <= 65, `${dur.toFixed(2)} s, ${v.nb_frames} frames`);
  check('h.264 High, yuv420p', v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p', `${v.codec_name} ${v.profile} ${v.pix_fmt}`);
  check('AAC audio >= 192 kbps', a && a.codec_name === 'aac' && parseInt(a.bit_rate, 10) >= 190000, a ? `${a.codec_name} ${Math.round(a.bit_rate / 1000)} kbps ${a.sample_rate} Hz` : 'no audio');
  const head = fs.readFileSync(MP4).subarray(0, 4096).toString('latin1');
  check('faststart (moov before mdat)', head.indexOf('moov') > 0 && (head.indexOf('mdat') < 0 || head.indexOf('moov') < head.indexOf('mdat')));
  check('plays in a browser (H.264 + AAC in MP4)', v.codec_name === 'h264' && a.codec_name === 'aac' && probe.format.format_name.includes('mp4'));

  // ---------- 2. Loudness of the encoded audio
  const ebText = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${MP4}" -af ebur128=peak=true -f null - 2>&1`]).toString();
  const I = parseFloat((ebText.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
  const TP = parseFloat((ebText.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
  check('loudness about -14 LUFS', Math.abs(I + 14) <= 1, `${I} LUFS`);
  check('true peak under -1 dBTP', TP < -1, `${TP} dBTP`);
} else check('final video exists', false, 'run render/render_all.mjs first');

// ---------- 3. Text layer, every frame (overlay only, no 3d needed)
await bundle();
const { server, port } = await serve();
const { browser, page } = await openPage(port, { dpr: 1 });
const textReport = await page.evaluate(() => {
  const o = window.__video.overlay;
  const out = { outside: [], overlapping: [], tooWide: [], longLines: [], visible: {} };
  const names = ['title', 'stat', 'day', 'legend', 'caption', 'endcard'];
  for (let f = 0; f < window.__video.totalFrames; f++) {
    o.update(f);
    const b = o.beatAt(f);
    const rects = [];
    for (const k of names) {
      const el = o.el[k];
      const op = parseFloat(el.style.opacity || 0);
      if (op <= 0.02) continue;
      const r = el.getBoundingClientRect();
      rects.push({ k, x: r.x, y: r.y, w: r.width, h: r.height });
      if (k === 'caption' && op > 0.5) (out.visible[b.id] ||= []).push(f);
      // lines must fit inside the panel's content box
      el.querySelectorAll('.line, .num, .lab, .d, .s, .row').forEach((ln) => {
        if (ln.scrollWidth > el.clientWidth - 40 + 1 && ln.scrollWidth > ln.clientWidth + 1) out.tooWide.push([f, k, ln.textContent]);
      });
    }
    for (const r of rects) {
      // CSS transform (rise) can move a panel a few px while it animates in; allow 26 px
      if (!(r.x >= 0 && r.x + r.w <= 950.5 && r.y >= 154 - 26 && r.y + r.h <= 1536.5 + 26)) out.outside.push([f, r.k, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const A = rects[i], B = rects[j];
      if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) out.overlapping.push([f, A.k, B.k]);
    }
  }
  for (const b of o.beats) for (const ln of (b.caption || '').replace(/\*\*/g, '').split('\n')) if (ln.length > 38) out.longLines.push([b.id, ln]);
  return out;
});
const uniq = (arr) => [...new Map(arr.map((x) => [JSON.stringify(x.slice(1)), x])).values()];
check('all text inside the safe zones (every frame)', textReport.outside.length === 0, textReport.outside.length ? JSON.stringify(uniq(textReport.outside).slice(0, 5)) : '1920 frames checked');
check('no overlapping text panels (every frame)', textReport.overlapping.length === 0, textReport.overlapping.length ? JSON.stringify(uniq(textReport.overlapping).slice(0, 5)) : '');
check('no text wider than its panel', textReport.tooWide.length === 0, textReport.tooWide.length ? JSON.stringify(uniq(textReport.tooWide).slice(0, 5)) : '');
check('caption lines at most 38 characters', textReport.longLines.length === 0, JSON.stringify(textReport.longLines));
// Caption reading time: on screen >= 1.5 s and >= words / 3 s
const short = [];
for (const b of beatsDoc.beats.filter((x) => x.caption)) {
  const frames = textReport.visible[b.id] || [];
  const secs = frames.length / 30;
  const words = b.caption.replace(/\*\*/g, '').split(/\s+/).filter(Boolean).length;
  if (secs < Math.max(1.5, words / 3)) short.push(`beat ${b.id}: ${secs.toFixed(2)} s for ${words} words`);
}
check('every caption readable twice (>= 1.5 s and 3 words/s)', short.length === 0, short.join('; ') || 'all captions pass');
// Key number in each caption matches the stats panel
const mism = [];
for (const b of beatsDoc.beats.filter((x) => x.stat && x.caption && x.caption.includes('**'))) {
  const bold = b.caption.match(/\*\*(.+?)\*\*/)[1];
  let stat = b.stat.template;
  b.stat.parts.forEach((p, i) => (stat = stat.replace(`{${i}}`, p.toLocaleString('en-US', { minimumFractionDigits: b.stat.decimals, maximumFractionDigits: b.stat.decimals }))));
  const norm = (s) => s.replace(/[^\d.%–+,]/g, '');
  if (!norm(stat).startsWith(norm(bold).replace(/,$/, ''))) mism.push(`beat ${b.id}: caption "${bold}" vs stat "${stat}"`);
}
check('caption numbers match the stats panel', mism.length === 0, mism.join('; ') || 'all match');
// Every fact has a source listed in docs/sources.md
const sourcesMd = fs.readFileSync(path.join(ROOT, 'docs/sources.md'), 'utf8');
const missing = beatsDoc.beats.flatMap((b) => b.sources).filter((id) => !sourcesMd.includes(`| ${id} |`));
check('every fact has a source in docs/sources.md', missing.length === 0 && beatsDoc.beats.filter((b) => b.stat).every((b) => b.sources.length), missing.join(', '));

// ---------- 4. Fonts actually used (Chrome DevTools: platform fonts per node), one frame per beat
const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const fonts = new Map();
for (const b of beatsDoc.beats) {
  await page.evaluate((f) => window.__video.overlay.update(f), Math.min(b.end - 12, b.start + 50));
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '#overlay *' });
  for (const id of nodeIds) {
    const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id }).catch(() => ({ fonts: [] }));
    for (const fnt of r.fonts) fonts.set(`${fnt.familyName}${fnt.isCustomFont ? ' (loaded from project file)' : ' (SYSTEM)'}`, (fonts.get(fnt.familyName) || 0) + fnt.glyphCount);
  }
}
const fontNames = [...fonts.keys()];
check('every piece of text uses the one font (Liberation Serif stand-in, from the project folder)', fontNames.length > 0 && fontNames.every((n) => n.startsWith('Liberation Serif') && n.includes('project file')), fontNames.join(', '));
await browser.close();
server.close();

// ---------- 5. Map labels (logged during the final render)
const logFile = path.join(OUT, 'frames/log.jsonl');
if (fs.existsSync(logFile)) {
  // keep the latest entry per frame (frames can be re-rendered)
  const byFrame = new Map();
  for (const l of fs.readFileSync(logFile, 'utf8').trim().split('\n')) { const e = JSON.parse(l); byFrame.set(e.frame, e); }
  const log = [...byFrame.values()];
  const bad = [], clash = [];
  for (const e of log) {
    const vis = (e.labels || []).filter((l) => l.opacity > 0.3);
    for (const l of vis) if (!inside(l.rect)) bad.push([e.frame, l.id]);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) if (overlaps(vis[i].rect, vis[j].rect)) clash.push([e.frame, vis[i].id, vis[j].id]);
    for (const l of vis) for (const p of e.panels || []) if (overlaps(l.rect, p)) clash.push([e.frame, l.id, 'panel']);
  }
  check('map labels inside safe zones', bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 5)) : `${log.length} frames logged`);
  check('no overlapping labels (or labels over panels)', clash.length === 0, clash.length ? JSON.stringify(clash.slice(0, 5)) : '');
}

const md = ['# QA report', '', `Video: \`${path.relative(ROOT, MP4)}\``, '', '| Check | Result | Detail |', '|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${String(r.detail).replace(/\|/g, '/')} |`)].join('\n');
fs.writeFileSync(path.join(OUT, 'qa-report.md'), md + '\n');
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed -> out/qa-report.md`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
