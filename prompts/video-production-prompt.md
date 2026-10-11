# Video Production Prompt — General Template

Fill in the `[BRACKETS]`, delete any optional lines you don't need, and paste
everything below the line into a new session.

---

You're my producer and technical director for short, high-quality 3D
explainer videos. Build everything in this folder and explain each step in
plain English, as if I'm smart but not a programmer.

## 0. The brief

- **Topic / hook:** [e.g. What if the ocean were made of Jell-O?]
- **Format:** [TikTok/Reels/Shorts vertical 1080x1920 | YouTube 1920x1080 | Square 1080x1080]
- **Length:** [60–65 s]
- **Audience:** [general / finance-curious / kids / students]
- **Tone:** [playful and wholesome | calm and premium | punchy and dramatic]
- **Brand (optional):** [name, logo file, brand colors, brand fonts]
- **Must-include facts or places (optional):** [list]
- **Call to action / end card:** [either/or question | follow prompt | website]

## 1. Look and feel (style bible)

Before building anything, write a one-page **style bible** in `docs/style-bible.md`
and keep every frame consistent with it.

1. **Palette.** 5 colors max, each with a hex code and a job: background,
   main subject, accent (one color only), text, and data/highlight.
   Text must reach a contrast ratio of at least 4.5:1 against what's behind it.
2. **Render style.** Choose one and stick to it. Options: stylized
   "premium toy" 3D with soft shadows, a clean low-poly look, or photoreal-lite.
   Every object uses the same material rules: same roughness range, same
   outline or no-outline choice, same level of detail.
3. **Lighting.** One key light, one fill, and one rim light. Use a soft
   environment map (generated in code or a CC0 HDRI) for reflections. Keep the
   same time of day and color temperature for the whole video unless the story
   needs a change.
4. **Finishing.** Use subtle post-processing only: tone mapping (ACES Filmic),
   gentle bloom on bright highlights, a light vignette, fine film grain at
   about 2–3%, and SMAA anti-aliasing. No chromatic aberration and no heavy
   depth of field on anything that has text.
5. **Motion.** Every move eases in and out. No linear motion, and no snapping
   unless it's a deliberate joke. Objects arrive with a small overshoot
   (back-out or spring easing), and the camera never cuts mid-move.

## 2. Typography and on-screen text

1. **Two font families max.** One display font for titles (e.g. Fraunces,
   Bricolage Grotesque, or the brand font) and one clean sans for captions and
   stats (e.g. Inter or Manrope). Use only open-licence fonts (OFL or Apache),
   saved in the project folder rather than loaded from the internet at render
   time.
2. **Type scale.** Set the sizes for the vertical format and scale them for
   others: title 72–88 px, captions 52–60 px, stat numbers 64–80 px, stat
   labels 28–32 px, map labels 26–34 px. Line height is 1.1 for titles and
   1.25 for body text.
3. **Captions.** One idea per caption, 2 lines max, about 38 characters per
   line max. Each caption stays on screen long enough to read twice (about
   3 words per second). Use sentence case, no full stop at the end, and set
   the key number in bold or the accent color.
4. **Legibility.** Every caption sits on a soft, semi-transparent rounded
   panel with a slight blur or shadow behind it. Text never sits directly on
   a busy 3D background.
5. **Safe zones.** For vertical social video, keep all text out of the bottom
   20% and the right 12% (where the app buttons go) and below the top 8%.
   Draw these zones as a debug overlay that I can turn on.
6. **Numbers.** Numbers count up rather than appearing all at once, use
   tabular (fixed-width) figures so they don't jiggle, include units and
   thousands separators, and round to what a viewer can take in (e.g.
   "1.4 billion", not "1,403,882,117").
7. **Text animation.** Words rise or fade in with a short stagger (about
   40 ms per word) and leave faster than they arrive. Text never spins,
   bounces, or arrives letter by letter.
8. **Rendering method.** Draw the UI text as crisp HTML/CSS layered over the
   three.js canvas, and capture both together. Text that is part of the 3D
   world (signs, map labels) uses SDF text (troika-three-text) so it stays
   sharp at any distance.

## 3. Maps and geography (when the story involves places)

1. **Data.** Use public-domain or open data only: Natural Earth for
   coastlines, borders and cities, and an open elevation dataset if terrain is
   needed. List the sources and their licences in `docs/sources.md`.
2. **Look.** Maps follow the style bible. Land and water are two calm tones
   from the palette, borders are thin and slightly transparent, and the
   highlighted region uses the accent color with a soft glow or a gentle
   extrusion. Coastlines get a subtle bevel or shoreline gradient.
3. **Globe vs flat.** Use a 3D globe for "where in the world" moments and
   flat or tilted maps for comparisons. Pick a projection that fits the
   region (e.g. Equal Earth for world maps, a local conic projection for a
   single country) and say which one you used.
4. **Terrain.** If relief matters, build it from the elevation data with
   gentle vertical exaggeration (no more than 1.5–3x) and soft hillshading.
5. **Labels.** Follow cartographic rules: no overlapping labels, place names
   only where they're needed, city dots with labels offset up and right,
   water names in italic. Labels always face the camera and stay readable.
6. **Data on maps.** Show quantities as extruded bars, proportional circles,
   or animated arcs/flows. Include a small legend or labelled number for every
   visual encoding, and never use a rainbow color scale.
7. **Transitions.** Move between places with a smooth fly-to (zoom out, pan,
   zoom in). No teleporting.

## 4. Story structure

1. The title is on screen from the very first frame, and the main idea or
   change is visible within 3 seconds.
2. Use [12–13] beats of about [4.5] seconds each, building toward a payoff.
   Every beat gets:
   - one short caption with a real fact and a number,
   - a new camera angle or move,
   - a small stats panel that updates (count-up animation), and
   - one sound cue.
3. Give the story an arc: hook → escalate → surprise → bigger scale →
   payoff → end card. Every 3–4 beats, add a visual "reset" (new location,
   color shift, or scale jump) to hold attention.
4. The last [4] seconds are an end card with [an either/or question, e.g.
   "Lime or blue raspberry next?"] in large type, with the brand or logo if
   one was given.
5. **Accuracy.** Every fact needs a source listed in `docs/sources.md`. If a
   number is an estimate, say "about" or "roughly" in the caption.
6. **Wholesome only.** Nobody gets hurt on screen. Any danger goes in the
   captions as a fact.

## 5. Camera language

Make a shot list with a real reason for every move:

- **Establishing wide shot** to open a new location.
- **Slow push-in** to build tension or reveal a detail.
- **Orbit** to show something in 3D or show scale.
- **Crane or tilt up** for "it keeps going" moments.
- **Top-down** for maps and comparisons.
- **Low hero angle** for the payoff.

Use realistic lenses (24–35 mm for wide shots, 50–85 mm for close-ups), keep
the horizon level unless a tilt is the point, and move the camera along
smooth spline paths. Hold the camera still for at least 0.5 s whenever a new
caption appears so it can be read.

## 6. Sound

All music and sound effects are generated with code, with no copyrighted or
downloaded audio.

1. **Music:** a [happy ukulele | warm lo-fi | light orchestral pluck] loop at
   [100–120] BPM, in a major key, with a simple chord loop. Beat changes land
   on the downbeat of a bar.
2. **Sound effects:** a pop, boing, whoosh, or tick for every joke, reveal,
   camera move, or number count-up, matched to the exact frame.
3. **Mix:** music sits about 8–10 dB under the sound effects. Add a gentle
   fade-in and fade-out and a final "button" note on the end card. Master to
   about −14 LUFS with peaks under −1 dBTP.
4. **Voiceover (optional):** [none | script only | generated TTS], with
   captions matching the spoken words.

## 7. Technical pipeline

1. **Scene:** three.js in a browser page, using a fixed virtual clock so that
   frame N always looks identical (no real-time timers, and all randomness
   comes from a fixed seed).
2. **Capture:** Playwright steps the virtual clock one frame at a time and
   saves a lossless PNG of every frame, with the HTML text overlay included.
3. **Encode:** ffmpeg joins the frames and audio into an MP4: H.264 high
   profile, yuv420p, CRF 16–18, the `-movflags +faststart` flag, and AAC audio
   at 192 kbps or more. Output at [1080x1920] and [30] fps, [60–65] s long.
4. **Render settings:** device pixel ratio 2 for supersampling (then scaled
   down) or high-quality anti-aliasing, high-resolution shadow maps, and no
   visible flicker or z-fighting.
5. **Project layout:** keep it tidy and explain it.
   - `scene/`: the three.js code
   - `audio/`: sound generation code
   - `render/`: capture and encode scripts
   - `docs/`: style bible, beat sheet, sources
   - `out/`: frames, contact sheets, and final videos (out of git)

   Provide one command to render everything.

## 8. Quality checklist (run before every hand-off)

- [ ] Title visible on frame 1, and the change is visible by 3 s
- [ ] Every caption readable, inside the safe zones, on screen for 1.5 s or more
- [ ] No overlapping text or labels, and no text cut off at the edges
- [ ] Palette, fonts and lighting consistent across all beats
- [ ] Every fact has a source, and the numbers in the captions match the stats panel
- [ ] Map labels correct and spelled right, legend present for data
- [ ] No flicker, jitter, popping objects, or camera snaps
- [ ] Audio synced to the frame, no clipping, loudness in range
- [ ] Final file: correct resolution, frame rate and duration, plays in a browser

## 9. Workflow — stop after each step so I can check it

- **A. Plan.** Write the style bible (palette swatches, fonts, render
  style) and the beat sheet as a table with these columns: time, caption,
  stat, camera, sound, and source.
- **B. Look development.** Render 2–3 polished "style frames" at full
  resolution so I can approve the look before anything is animated.
- **C. Contact sheet.** Build the full scene and render about 14 still frames
  spread across the video, with the safe-zone overlay as an option. Put them
  on one labelled contact sheet image (timestamp under each frame) and show
  me.
- **D. Fixes.** Fix what I point out and show a new contact sheet of only
  the frames that changed.
- **E. Final render.** Render the full video with sound, run the quality
  checklist, and report the file size, duration, and anything you weren't
  sure about.
