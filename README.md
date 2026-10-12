# 3d explainer videos

This folder holds the production pipeline for short vertical 3d explainer videos (1080 × 1920, 30 fps).

| Video | Status | Lives in |
|---|---|---|
| "What if California got 30 days of extreme rain?" (64 s) | Finished | `scene/src/`, `scene/beats.json`, `docs/` |
| "What if domestic cats took over California?" (64 s) | Step 5: final render | `scene/videos/cat-kingdom/`, `docs/cat-kingdom/`, `audio/cat_kingdom.py` |

Both videos share the engine: the render pipeline, the text layer, map helpers and capture scripts.

The original website files (`index.html`, `style.css`, `script.js`, `background.jpg`) are untouched and unrelated to the video.

## Render everything with one command

```
npm install
npm run render
```

The first run builds a Python environment, downloads the open map data and prepares it. It then renders all 1,920 frames, generates the soundtrack, encodes the MP4 and runs the quality checks.
The result is `out/california-30-days-of-rain.mp4` plus `out/qa-report.md`.
On a machine without a graphics card the frames take about 1.5–2 hours. The render can be resumed: run it again and it continues where it stopped.

Other useful commands:

| Command | What it does |
|---|---|
| `npm run contact` | Renders about 15 stills across the video and builds `out/contact/contact-sheet.png` (plus a version with the safe zones drawn) |
| `node render/stills.mjs out/stills 300 1050` | Renders any frames you name as full-size PNGs (add `--safe` for the safe-zone overlay) |
| `npm run audio` | Rebuilds the soundtrack only (`out/audio/soundtrack.wav`) |
| `npm run beatsheet` | Regenerates `docs/beat-sheet.md` from `scene/beats.json` |
| `npm run qa` | Runs the quality checklist against the finished video |

**The cat video** renders end to end with `node render/render_all.mjs --video=cat-kingdom && node render/qa.mjs --video=cat-kingdom` (frames, soundtrack from `audio/cat_kingdom.py`, MP4 and QA report in `out/cat-kingdom/`). The other commands take `--video=cat-kingdom` too. For example, `node render/stills.mjs out/cat-kingdom/style 90 720 1590 --video=cat-kingdom` renders its style frames. Its extra map data comes from `.venv/bin/python data/prep_cats.py`, which runs after `data/prep_map.py`.
`--q=lab=1` renders the character look-dev lab instead of the video. `node render/contact.mjs --video=cat-kingdom` builds its contact sheet, and `node render/preview.mjs --video=cat-kingdom` a quick low-resolution motion preview (no sound).

To preview in a browser, serve this folder and open `scene/index.html?frame=1050`, or `scene/videos/cat-kingdom/index.html?frame=90` for the cat video. Add `&safe=1` to show the app-safe zones, and `&dpr=1` for a faster, lower-quality preview.

## Where things live

| Folder | What's in it |
|---|---|
| `docs/` | The plan: style bible, beat sheet, sources and licences, style sheet image |
| `scene/` | The 3d world (three.js), the on-screen text layer, fonts, colours, and `beats.json`, the single source of truth for timing, text, stats, camera and sound |
| `scene/src/sets/` | One file per set: globe, California relief map, Shasta Lake, hillside cut-away, recharge basin, 1862 town |
| `audio/` | `generate.py` synthesises the music and sound effects and masters them to −14 LUFS |
| `render/` | Capture (Playwright), contact sheets, encode (ffmpeg) and quality checks |
| `data/` | Scripts that turn open data into what the scene needs (downloads go in `data/raw/`, results in `data/build/`; neither is in git) |
| `out/` | Frames, contact sheets, audio and the finished video (not in git) |

## How a frame is made

1. `scene/index.html` loads the 3d scene and the text layer. Nothing moves on its own: `window.__video.renderFrame(n)` draws frame *n*. All randomness is seeded, so a frame looks identical every time.
2. Playwright (headless Chromium) calls it for each frame and saves a lossless PNG. The 3d is rendered at 2× size and scaled down, and the crisp web text is captured in the same screenshot.
3. ffmpeg joins the frames and the generated soundtrack into an H.264 High / AAC MP4 with `+faststart`.

## Status

- [x] Step 1: plan (style bible, beat sheet, sources)
- [x] Step 2: look development (style frames)
- [x] Step 3: contact sheet
- [x] Step 4: fixes
- [x] Step 5: final render (`out/california-30-days-of-rain.mp4`, QA 19/19 in `out/qa-report.md`)
