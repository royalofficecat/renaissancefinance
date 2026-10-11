# 3d explainer videos

This folder holds the production pipeline for short vertical (1080 × 1920, 30 fps) 3d explainer videos.
The current video is **“What if California got 30 days of extreme rain?”**

The original website files (`index.html`, `style.css`, `script.js`, `background.jpg`) are untouched and unrelated to the video.

## Where things live

| Folder | What's in it |
|---|---|
| `docs/` | The plan: style bible, beat sheet, sources and licences, style sheet image |
| `scene/` | The 3d world (three.js), the on-screen text layer, fonts and colours |
| `audio/` | Code that generates the music and sound effects |
| `render/` | Scripts that capture frames, build contact sheets, encode the video and run quality checks |
| `data/` | Map data prepared for the scene (raw downloads go in `data/raw/`, not in git) |
| `out/` | Frames, contact sheets and finished videos (not in git) |

## Status

- [x] Step 1: plan (style bible, beat sheet, sources)
- [ ] Step 2: look development (style frames)
- [ ] Step 3: contact sheet
- [ ] Step 4: fixes
- [ ] Step 5: final render

The one-command render (`npm run render`) arrives in Step 3.
