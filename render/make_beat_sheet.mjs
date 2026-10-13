// Generates docs/beat-sheet.md from scene/beats.json so the plan and the video never disagree.
// Run: node render/make_beat_sheet.mjs [beats.json] [out.md] ["Video title"]   (defaults: the first video)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEATS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'scene/beats.json');
const OUTMD = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'docs/beat-sheet.md');
const TITLE = process.argv[4] || 'What if California got 30 days of extreme rain?';
const doc = JSON.parse(fs.readFileSync(BEATS, 'utf8'));
const { fps, bpm, totalFrames, beats } = doc;
const hasPlace = beats.some((b) => b.place);

const tc = (f) => {
  const s = f / fps;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
const flat = (s) => (s || '').replace(/\n/g, ' ');
const fmtStat = (st) => {
  if (!st) return '';
  let out = st.template;
  st.parts.forEach((p, i) => {
    out = out.replace(`{${i}}`, p.toLocaleString('en-US', { minimumFractionDigits: st.decimals, maximumFractionDigits: st.decimals, useGrouping: st.grouping !== false }));
  });
  return `**${out}** ${flat(st.label)}`;
};
// Qualitative gauges (1-5) for beats without a sourced number, e.g. { runoff: 3, saturation: 2, flood: 1 }
const GAUGE_NAMES = { runoff: 'runoff', saturation: 'ground saturation', flood: 'flood pressure' };
const fmtGauges = (g) => (g ? `_Gauges (imagined):_ ${Object.entries(g).map(([k, v]) => `${GAUGE_NAMES[k] || k} ${'●'.repeat(v)}${'○'.repeat(5 - v)}`).join(' · ')}` : '');

const rows = beats.map((b) => {
  const text = [b.title && `**Title:** ${flat(b.title)}`, b.caption && flat(b.caption), b.endCard && `**End card:** ${flat(b.endCard)}`, b.tag && `_Tag: ${b.tag}_`]
    .filter(Boolean)
    .join('<br>');
  const cam = `${b.camera.shot} (${b.camera.lens}). _Why:_ ${b.camera.reason}`;
  const sound = b.sound.map((s) => `${s.cue} @${tc(b.start + s.at)}`).join(', ');
  return `| ${b.id} | ${tc(b.start)}–${tc(b.end)} |${hasPlace ? ` ${b.place || ''} |` : ''} ${text} | ${[fmtStat(b.stat), fmtGauges(b.gauges)].filter(Boolean).join('<br>')} | ${cam} | ${sound} | ${b.sources.join(', ')} |`;
});

const md = `# Beat sheet — "${TITLE}"

_Generated from \`${path.relative(root, BEATS)}\` by \`render/make_beat_sheet.mjs\`; edit the JSON, not this file._

**Length:** ${(totalFrames / fps).toFixed(1)} s (${totalFrames} frames at ${fps} fps) · **Music:** ${bpm} bpm, so one bar = 2 s = 60 frames, and every beat change lands on the first beat of a bar.
Beats are 2 bars (4 s) or 3 bars (6 s) when a title and a caption share the screen or the visual needs room (average 4.6 s). The end card is the last 4 s.
${doc.intro || 'The day counter (“Day 12 / 30 · illustrative scenario”) is an imagined timeline, never a forecast. Source codes (F1…) point to \`docs/sources.md\`.'}

| # | Time |${hasPlace ? ' Place |' : ''} On-screen text (caption, key number in bold) | Stat panel (counts up) | Camera | Sound | Source |
|---|---|${hasPlace ? '---|' : ''}---|---|---|---|---|
${rows.join('\n')}

## What each beat shows

${beats.map((b) => `- **${b.id} · ${b.point}:** ${b.visual}`).join('\n')}

## Visual resets (every 3–4 beats)

${doc.resets || 'Globe → state map (beat 2) · scale jump into Shasta Lake (3) · new place: hillside cut-away (4) · back out to the state map (6) · new location: the delivery route (9) · colour shift to warm light and green (11) · jump back in time to 1862 (12) · Southern California and the whole state (13).'}
`;

fs.writeFileSync(OUTMD, md);
console.log('wrote', path.relative(root, OUTMD));
