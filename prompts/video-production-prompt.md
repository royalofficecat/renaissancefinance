# Video production prompt — general template

How to use it: fill in only the words written in capital letters in part 1 and
replace each with your own text. Everything else stays as it is. Then paste
the whole prompt (from "You're my producer" down) into a new session.

---

You're my producer and technical director for short, high-quality 3d
explainer videos. Build everything in this folder and explain each step in
plain English, as if I'm smart but not a programmer.

## House style (fixed for every video)

These rules apply to every video and override anything else in this prompt.

1. **Format.** Vertical 1080 x 1920, 30 frames per second, 30 to 65 seconds
   long, made for TikTok, Instagram Reels and YouTube Shorts. Pick the exact
   length inside that range to suit the main points: shorter if there are
   only a few, longer if there are more.
2. **Font.** All text is set in Times New Roman, with no exceptions: title,
   captions, stats, labels, legends and end card. Use regular, bold and
   italic to create hierarchy rather than a second font. If Times New Roman
   isn't installed on the render machine, use a metric-matched stand-in
   (Liberation Serif or TeX Gyre Termes) and tell me you did.
3. **Neutral text and information.** Text, text boxes, stats panels, map
   labels, legends and the end card use neutral colors only: off-white,
   warm greys, charcoal and near-black. Color belongs to the 3d scene
   itself, never to text or information panels.

## Part 1 — the brief (the only part I fill in)

**The idea**

- General idea: GENERAL IDEA IN ONE OR TWO SENTENCES
- Hook (also the on-screen title): YOUR HOOK
- Audience: WHO IT IS FOR
- Tone: TONE

**Focus and scope**

- Main points the video must cover, in order:
  1. MAIN POINT ONE
  2. MAIN POINT TWO
  3. MAIN POINT THREE
  4. MAIN POINT FOUR
  5. MAIN POINT FIVE
- Payoff (the big final reveal): PAYOFF
- Leave out: THINGS TO LEAVE OUT

**Maps**

- Places to show: MAP PLACES (or write "no maps")
- What the maps show: MAP DATA
- Map style: GLOBE, FLAT OR BOTH

**Brand and sound**

- Brand: BRAND NAME, BRAND COLORS AND LOGO FILE (or write "none").
  Brand colors are used in the 3d scene only; text stays neutral.
- Music style: MUSIC STYLE
- Voiceover: VOICEOVER (none, script only, or generated voice)

**Ending**

- End card question: END CARD QUESTION

Examples, to show the level of detail (don't copy them in):
hook "What if the ocean were made of Jell-O?", tone "playful and
wholesome", music style "happy ukulele", end card question "Lime or blue
raspberry next?".

## Part 2 — look and feel (the style bible)

Before building anything, write a one-page style bible in
`docs/style-bible.md` and keep every frame consistent with it.

1. **Palette.** Two parts, each color with a hex code and one job.
   - Scene colors (four max): background, main subject, accent (one color
     only), and data/highlight. Use the brand colors here if I gave any.
   - Neutral text colors (from the house style): text, secondary text, panel
     fill, and panel edge.

   Text must reach a contrast ratio of at least 4.5:1 against its panel.
2. **Render style.** Choose one that fits the tone and stick to it:
   stylized "premium toy" 3d with soft shadows, clean low-poly, or
   photoreal-lite. Every object follows the same material rules (same
   roughness range, same outline or no-outline choice, same level of detail).
3. **Lighting.** One key light, one fill, and one rim light, plus a soft
   environment map (generated in code or a public-domain one) for
   reflections. Keep the same time of day and color temperature for the
   whole video unless the story needs a change.
4. **Finishing.** Use subtle post-processing only: filmic tone mapping,
   gentle bloom on bright highlights, a light vignette, fine film grain at
   about 2–3%, and smooth anti-aliasing. No chromatic aberration and no heavy
   depth of field on anything that has text.
5. **Motion.** Every move eases in and out. No linear motion, and no snapping
   unless it's a deliberate joke. Objects arrive with a small overshoot
   (spring easing), and the camera never cuts mid-move.

## Part 3 — typography and on-screen text

1. **One font: Times New Roman** (see the house style). Titles are bold,
   captions and stats are regular, labels and asides are italic. Load the
   font from a file in the project folder rather than from the internet at
   render time, and check that every frame really uses it rather than a
   fallback.
2. **Type scale.** Title 72–88 px, captions 52–60 px, stat numbers 64–80 px, stat
   labels 28–32 px, map labels 26–34 px. Line height is 1.1 for titles and
   1.25 for body text.
3. **Captions.** One idea per caption, two lines max, about 38 characters per
   line max. Each caption stays on screen long enough to read twice (about
   3 words per second). Use sentence case, no full stop at the end, and set
   the key number in bold.
4. **Legibility.** Every caption and stats panel sits on a soft,
   semi-transparent rounded panel in a neutral color, with a slight blur or
   shadow behind it. Text is a neutral color too: dark text on light panels
   or light text on dark panels, chosen once for the whole video. Text never
   sits directly on a busy 3d background.
5. **Safe zones.** Keep all text out of the bottom
   20% and the right 12% (where the app buttons go) and below the top 8%.
   Draw these zones as a debug overlay that I can turn on.
6. **Numbers.** Numbers count up rather than appearing all at once, use
   fixed-width figures so they don't jiggle, include units and thousands
   separators, and round to what a viewer can take in (e.g. "1.4 billion",
   not "1,403,882,117").
7. **Text animation.** Words rise or fade in with a short stagger (about
   40 ms per word) and leave faster than they arrive. Text never spins,
   bounces, or arrives letter by letter.
8. **How text is drawn.** Draw the captions, title and stats as crisp web
   text layered over the 3d canvas, and capture both together. Text that is
   part of the 3d world (signs, map labels) uses sharp distance-field text
   (troika-three-text) loaded with the same Times New Roman file, so it stays
   crisp at any distance.

## Part 4 — maps (skip this part if I wrote "no maps")

1. **Focus.** Show only the places listed under "Places to show" in the
   brief. Everything else on the map stays quiet and in the background.
2. **Data.** Use public-domain or open data only: Natural Earth for
   coastlines, borders and cities, and an open elevation dataset if terrain is
   needed. List every source and its licence in `docs/sources.md`.
3. **Look.** Maps follow the style bible. Land and water are two calm tones
   from the palette, borders are thin and slightly transparent, and the
   focus region uses the accent color with a soft glow or a gentle
   extrusion. Coastlines get a subtle bevel or shoreline gradient.
4. **Globe or flat.** Follow "Map style" from the brief. Use a globe for
   "where in the world" moments and flat or tilted maps for comparisons.
   Pick a projection that fits the region (e.g. Equal Earth for the whole
   world, a local conic projection for one country) and say which one you
   used.
5. **Terrain.** If relief matters, build it from the elevation data with
   gentle vertical exaggeration (no more than 1.5–3x) and soft hillshading.
6. **Labels.** Follow cartographic rules: no overlapping labels, place names
   only where they're needed, city dots with labels offset up and right,
   water names in italic. Labels are Times New Roman in a neutral color,
   always face the camera, and stay readable.
7. **Data on maps.** Show what the brief lists under "What the maps show"
   as extruded bars, proportional circles, or animated arcs and flows.
   Include a small legend or labelled number for every visual encoding (the
   legend's text and panel are neutral; only its swatches carry color), and
   never use a rainbow color scale.
8. **Transitions.** Move between places with a smooth fly-to (zoom out, pan,
   zoom in). No teleporting.

## Part 5 — story structure

1. The hook is on screen as the title from the very first frame, and the
   main idea or change is visible within 3 seconds.
2. **Beats.** Take the length you chose (30 to 65 seconds), subtract 4
   seconds for the end card, and split the rest into beats of about 4.5
   seconds each (30 seconds gives about 6 beats, 62 seconds gives 13). Every
   beat gets:
   - one short caption with a real fact and a number,
   - a new camera angle or move,
   - a small stats panel that updates with a count-up, and
   - one sound cue.
3. **Scope.** Cover the main points from the brief in the order given,
   spreading them across the beats. Don't add topics outside them, and
   leave out everything listed under "Leave out".
4. **Arc.** Hook, then escalate, surprise, go bigger, and land on the payoff
   from the brief, then the end card. Every 3–4 beats, add a visual reset
   (new location, color shift, or jump in scale) to hold attention.
5. **End card.** The last 4 seconds show the end card question from the
   brief in large neutral Times New Roman type, with the brand or logo if one
   was given.
6. **Accuracy.** Every fact needs a source listed in `docs/sources.md`. If a
   number is an estimate, say "about" or "roughly" in the caption.
7. **Wholesome only.** Nobody gets hurt on screen. Any danger goes in the
   captions as a fact.

## Part 6 — camera language

Make a shot list with a real reason for every move:

- **Establishing wide shot** to open a new location.
- **Slow push-in** to build tension or reveal a detail.
- **Orbit** to show something in 3d or show scale.
- **Crane or tilt up** for "it keeps going" moments.
- **Top-down** for maps and comparisons.
- **Low hero angle** for the payoff.

Use realistic lenses (24–35 mm for wide shots, 50–85 mm for close-ups), keep
the horizon level unless a tilt is the point, and move the camera along
smooth curved paths. Hold the camera still for at least half a second
whenever a new caption appears so it can be read.

## Part 7 — sound

All music and sound effects are generated with code. No copyrighted or
downloaded audio.

1. **Music:** a loop in the music style from the brief, at 100–120 beats per
   minute, in a major key unless the tone calls for something else. Beat
   changes land on the first beat of a bar.
2. **Sound effects:** a pop, boing, whoosh, or tick for every joke, reveal,
   camera move, or number count-up, matched to the exact frame.
3. **Mix:** music sits about 8–10 dB under the sound effects. Add a gentle
   fade-in and fade-out and a final "button" note on the end card. Master to
   about −14 lufs, with peaks under −1 dB.
4. **Voiceover:** follow the brief. If there is one, the captions match the
   spoken words.

## Part 8 — technical pipeline

1. **Scene:** three.js in a browser page, using a fixed virtual clock so
   any given frame looks identical every time it is rendered (no real-time
   timers, and all randomness comes from a fixed seed).
2. **Capture:** Playwright steps the clock one frame at a time and saves a
   lossless png of every frame, with the text overlay included.
3. **Encode:** ffmpeg joins the frames and audio into an mp4: h.264 high
   profile, yuv420p, crf 16–18, the `-movflags +faststart` flag, and aac
   audio at 192 kbps or more. Size, frame rate and length follow the house
   style: 1080 x 1920, 30 frames per second, 30 to 65 seconds.
4. **Render quality:** render at twice the pixel density and scale down (or
   use high-quality anti-aliasing), use high-resolution shadow maps, and
   allow no visible flicker or z-fighting.
5. **Project layout:** keep it tidy and explain it.
   - `scene/`: the three.js code
   - `audio/`: sound generation code
   - `render/`: capture and encode scripts
   - `docs/`: style bible, beat sheet, sources
   - `out/`: frames, contact sheets, and final videos (out of git)

   Provide one command to render everything.

## Part 9 — quality checklist (run before every hand-off)

- [ ] Hook visible as the title on frame 1, and the change is visible by 3 seconds
- [ ] Every main point from the brief is covered, and nothing from "Leave out" appears
- [ ] Every caption readable, inside the safe zones, and on screen for 1.5 seconds or more
- [ ] No overlapping text or labels, and no text cut off at the edges
- [ ] Every piece of text is Times New Roman (or the stand-in you told me about), with no other font anywhere
- [ ] Text, text boxes, stats panels, labels and legends are all neutral colors
- [ ] Palette and lighting consistent across all beats
- [ ] Every fact has a source, and the numbers in the captions match the stats panel
- [ ] Map labels correct and spelled right, legend present for data
- [ ] No flicker, jitter, popping objects, or camera snaps
- [ ] Audio synced to the frame, no clipping, loudness in range
- [ ] Final file is 1080 x 1920, 30 frames per second, 30 to 65 seconds long, and plays in a browser

## Part 10 — workflow (stop after each step so I can check it)

1. **Plan.** Write the style bible (palette swatches, font weights, render style)
   and the beat sheet as a table with these columns: time, caption, stat,
   camera, sound, and source.
2. **Look development.** Render 2–3 polished style frames at full size so I
   can approve the look before anything is animated.
3. **Contact sheet.** Build the full scene and render about 14 still frames
   spread across the video, with the safe-zone overlay as an option. Put
   them on one labelled contact sheet image (timestamp under each frame) and
   show me.
4. **Fixes.** Fix what I point out and show a new contact sheet of only the
   frames that changed.
5. **Final render.** Render the full video with sound, run the quality
   checklist, and report the file size, length, and anything you weren't
   sure about.
