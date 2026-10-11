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

That fetches data, builds the audio, captures all 1,920 frames (`render/render-all.sh` is the restartable form), and encodes `out/final.mp4` (h.264 high, yuv420p, crf 17, faststart, AAC 192 kbps).

Intermediate steps, in workflow order:

- `npm run styleframes` renders the three look-development frames to `out/styleframes/`.
- `npm run contact` renders 14 stills to `out/contact/`; then `node render/preview.mjs out/contact` makes 1080 × 1920 viewing copies and `node render/contact-sheet.mjs out/contact/preview` assembles the labelled sheet. Add `--safe` to the capture to draw the safe-zone overlay.
- `node render/capture.mjs --times 29.5,46.4 --out out/fixes` re-renders just the frames you point at.
- `node render/check.mjs` measures the text layer in the browser: fonts in use, caption line counts, safe zones, overlapping panels.
- `render/render-all.sh` is what `npm run frames` should be read as in practice: it renders all 1,920 frames in chunks of 240, each in a fresh browser, and skips frames already on disk, so it can be restarted.
- `npm run encode` joins `out/frames/` and `out/audio.wav` into `out/final.mp4` and prints size, length and stream details.

How a frame is made: the page draws the 3D scene at 2× (2160 × 3840) with soft shadows, bloom, SMAA, vignette and grain, and lays the HTML captions over it. Playwright asks for frame N, waits until every 3D label is laid out, and screenshots the page. ffmpeg scales the frames down to 1080 × 1920 with a Lanczos filter during the encode. This machine has no GPU, so each frame takes 10 to 15 seconds in software rendering.

Audio: `audio/synth.mjs` is a tiny synthesizer (oscillators, noise, biquad filters, ADSR envelopes, a Schroeder reverb). `audio/build-audio.mjs` plays the beat sheet's cue list through it (120 bpm, D major, bar = 2 s), mixes music about 9 dB under the effect hits with the rain bed lower still, and masters with ffmpeg's two-pass loudnorm to −14 LUFS, −1 dBTP.
