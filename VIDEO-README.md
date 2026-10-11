# "What if California got 30 days of extreme rain?" — video project

A 64-second vertical (1080 × 1920, 30 fps) 3D explainer built with three.js, captured frame by frame with Playwright, and encoded with ffmpeg. The existing Renaissance Finance site files (index.html, style.css, script.js, background.jpg) are untouched; the video lives in the folders below.

## Folder layout (what each part does)

- `docs/` — the plan. `style-bible.md` (colors, materials, lighting, type), `beat-sheet.md` (the 13 beats with captions, stats, camera, sound, sources), `sources.md` (every fact and dataset with its licence).
- `fonts/` — Liberation Serif, the metric-matched stand-in for Times New Roman (not installed on this machine). Loaded from here, never from the internet.
- `data/` — map data downloaded by `npm run data` (Natural Earth vectors, terrain tiles), trimmed to California.
- `scene/` — the three.js page: terrain, globe, maps, the 3D sets for each beat, the caption overlay, and a fixed virtual clock so frame N always looks the same.
- `audio/` — code that synthesizes the music loop and every sound effect into one .wav, timed to the beat sheet.
- `render/` — Playwright capture (steps the clock one frame at a time, saves lossless PNGs) and the ffmpeg encode step.
- `out/` — frames, style frames, contact sheets and the final mp4 (ignored by git).

## One command

```
npm install
npm run render
```

That fetches data, builds the audio, captures all 1,920 frames, and encodes `out/final.mp4` (h.264 high, yuv420p, crf 17, faststart, AAC 192 kbps).

Intermediate steps, in workflow order: `npm run styleframes` (2–3 full-size look-development frames), `npm run contact` (14 stills on one labelled sheet; add `--safe` to draw the safe-zone overlay).
