# QA report

Video: `out/cat-kingdom/what-if-cats-took-over-california.mp4`

| Check | Result | Detail |
|---|---|---|
| video is 1080 x 1920 | PASS | 1080x1920 |
| 30 frames per second | PASS | 30/1 |
| length 30-65 s | PASS | 64.00 s, 1920 frames |
| h.264 High, yuv420p | PASS | h264 High yuv420p |
| AAC audio >= 192 kbps | PASS | aac 258 kbps 48000 Hz |
| faststart (moov before mdat) | PASS |  |
| plays in a browser (H.264 + AAC in MP4) | PASS |  |
| loudness about -14 LUFS | PASS | -14.1 LUFS |
| true peak under -1 dBTP | PASS | -1.6 dBTP |
| all text inside the safe zones (every frame) | PASS | 1920 frames checked |
| no overlapping text panels (every frame) | PASS |  |
| no text wider than its panel | PASS |  |
| caption lines at most 38 characters | PASS | [] |
| every caption readable twice (>= 1.5 s and 3 words/s) | PASS | all captions pass |
| caption numbers match the stats panel | PASS | all match |
| every fact has a source in docs/cat-kingdom/sources.md | PASS |  |
| every piece of text uses the one font (Liberation Serif stand-in, from the project folder) | PASS | Liberation Serif (loaded from project file) |
| map labels inside safe zones | PASS | 1920 frames logged |
| no overlapping labels (or labels over panels) | PASS |  |
| text contrast >= 4.5:1 (worst case: see-through panel over black) | PASS | lowest 5.19:1 |
| no camera snaps, pops or flicker (frame-to-frame change) | PASS | only the end card appearing; scene changes are dissolves |
| music sits 8-10 dB under the effects | PASS | effects 9 dB above the music (median of 25 effects; 10-90%: 7.5 to 9 dB) |
