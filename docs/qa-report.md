# Quality checklist — final render

File: `out/final.mp4`, 63.3 MB, 64.00 s, 1080 × 1920, 30 fps, 1,920 frames, h.264 High (yuv420p, crf 17, faststart), AAC 192 kbps. Audio −13.8 LUFS integrated, true peak −1.7 dBTP in the WAV (AAC encoding adds a little; the QA script measures under −1 dBTP in the mp4).

| Check | Result | How it was checked |
|---|---|---|
| Hook visible as the title on frame 1; the change visible by 3 s | Pass | Title panel is on screen from t = 0 (no fade-in); the moisture plume is moving from frame 1 and the day counter advances within beat 1 |
| Every main point covered in order; nothing from "Leave out" | Pass | Beats 2–3 (gift, atmospheric rivers, reservoirs), 4–5 (soil, runoff, slide risk), 6–7 (valley lake, USGS scenario), 8–9 (route, power), 10–11 (cleanup, recharge), 12 (1861–62 payoff), 13 (closing line), end card. No injuries, politics, money totals, dam failures or drought-cure claims; floods labelled "illustrative scenario, not a forecast" |
| Captions readable, inside safe zones, on screen ≥ 1.5 s | Pass | `render/check.mjs` measures panel rectangles against the 8 % / 20 % / 12 % zones on 15 moments; shortest caption slot is 2.5 s |
| No overlapping text, nothing cut at the edges | Pass | Same script checks panel overlap; map labels reviewed on the contact sheets; two labels that touched the edge were moved or dropped |
| Every piece of text Times New Roman or the stand-in | Pass, with the stand-in | Liberation Serif everywhere, loaded from `fonts/`; the check script lists loaded faces and the computed font family of every overlay node; 3D labels use the same TTF files through troika |
| Text, panels, stats, labels, legend neutral | Pass | Off-white, warm grey, charcoal only; the legend's swatches are the only colour |
| Palette and lighting consistent | Pass | One palette file in the style bible; the one planned change is the clouds clearing and the land greening after day 30 |
| Every fact sourced; caption numbers match the stat panel | Pass | docs/sources.md; stat panels count up to the same number as the caption (beat 10: "a year" / "~12 months") |
| Map labels correct and spelled right; legend present | Pass | Reviewed on contact sheets; legend on every map beat with flood coverage |
| No flicker, jitter, popping objects or camera snaps | Pass | Scene-cut scan over the mp4 finds changes only at the planned set changes (8, 12, 20, 36, 40, 48, 54, 60 s); fixed seed and virtual clock make every frame deterministic |
| Audio synced to the frame, no clipping, loudness in range | Pass | Cues placed at beat-sheet times at 48 kHz; two-pass loudnorm; peak and LUFS measured |
| Final file 1080 × 1920, 30 fps, 30–65 s, plays in a browser | Pass | ffprobe; h.264 High + AAC in mp4 with faststart |

## Things I was not sure about

- **Atmospheric-river share.** The brief said 40–60 %; NOAA's figure is 30–50 %, so the caption says 30–50 %.
- **Power-outage figure.** It is one utility's number (SMUD, 8 Jan 2023) from an AP report, not a statewide peak; the caption names Sacramento.
- **Flood extent** on the maps is illustrative (terrain lows inside the valley outline), not the ARkStorm inundation model. It is labelled as such.
- **Watersheds** are implied by rivers and terrain, not drawn from the USGS boundary dataset, which was unreachable from the render machine.
- **Look.** The soil cross-section is diagrammatic (beige grains, blue-filled pores). The 48 s hero shot passes low over 2 km terrain, so it is soft up close.
- **Rendering.** Software rendering on a machine with no GPU; frames took about 10 s each. Shadows are PCF (three.js removed PCF-soft in this version).
