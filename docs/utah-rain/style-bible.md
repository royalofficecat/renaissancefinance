# Style bible — “What if it rained in Utah for 30 days?”

One page. Every frame follows it. Swatches and type samples: [`style-sheet.png`](style-sheet.png).
Machine-readable colours: [`../../scene/videos/utah-rain/palette.json`](../../scene/videos/utah-rain/palette.json).

## 1. Palette

**Scene colours (the 3d world only; four colours, one job each)**

| Role | Name | Hex | Job |
|---|---|---|---|
| Background | Storm charcoal | `#33383E` | Sky, storm clouds, the space around every diorama, neighbouring states on the map. |
| Main subject | Sandstone red | `#B5533A` | The land: red rock, canyon walls, terrain. Its pale end, **desert cream `#E6D6B8`**, is the same family (salt crust, pale sand, dry lakebeds), not a fifth colour. |
| Accent | Turquoise water | `#33B1AA` | The story's actor and the only accent: runoff, rivers, rising lakes, flooded flats, runoff arrows. |
| Data / highlight | Fresh green | `#7CB84F` | Life and data: temporary greenery, new wetlands, the Great Basin on the divide map. |

Light colours are not paint: **storm daylight `#E3E9F0`** (cool, about 6,500 K) for days 1–29, and **clearing sun `#FFDDB0`** (about 4,500 K) when the clouds break on day 30.

**Neutral text colours.** Chosen once for the whole video: **light text on dark panels**, which suits the storm.

| Role | Name | Hex | Job |
|---|---|---|---|
| Text | Off-white | `#F4F1EA` | Titles, captions, stat numbers, map labels. |
| Secondary text | Warm grey | `#BFB8AC` | Stat labels, asides, “imagined scenario” tags, legend and gauge text. |
| Panel fill | Charcoal | `#1A1917` at 82% | Every caption, stats, legend, gauge and end-card panel, with an 18 px background blur and a soft shadow. |
| Panel edge | Warm grey edge | `#4A4540` | 1.5 px panel outline; the dark halo behind 3d map labels. |

Contrast, checked by `render/qa_contrast.py` on the worst cases: off-white text 16.3:1 and warm-grey 9.4:1 with the see-through panel over black; 8.9:1 and 5.1:1 over white. All pass the 4.5:1 minimum.

## 2. Render style: “premium toy” miniature world

The channel's house look. Utah is a tabletop model: maps are carved relief slabs, places are cut-away dioramas on base plates.
- **Materials:** matte clay for everything solid (roughness 0.60–0.85, no metal). **Water is the one glossy material** (roughness 0.08–0.20) with an analytic sky reflection, so pools and flooded flats mirror the storm clouds.
- **No outlines.** Small rounded bevels; one level of detail. Sandstone gets soft horizontal strata bands (shades of the red), never a photo texture.
- **Plants** are small rounded clay tufts in fresh green that grow with a spring. **People** (hikers) are tiny faceless figures, always safe on high ground.
- **Clouds** are soft storm-charcoal puffs; rain is thin seeded streaks.

## 3. Lighting (same rig in every scene)

- **Key:** overcast storm daylight, upper left, about 40° high, soft shadows (days 1–29).
- **Fill:** sky hemisphere, cool grey above and warm sandstone bounce below, at 35% of the key.
- **Rim:** cool back light at 60%, separating canyon edges and clouds from the background.
- **Environment:** a soft sky gradient computed directly in the water shader (fast, no sampled environment map), with a faint glint from the key.
- **The one story change:** on day 30 the clouds break and the key warms to the low clearing sun; the months-later beat keeps that warm, quiet light.

## 4. Finishing (subtle)

ACES filmic tone mapping · bloom only on the brightest highlights (water glints, the breaking sun) · vignette 0.25 · film grain 2.5%, seeded per frame · 3d rendered at 2× pixel density and scaled down 2:1. **No** chromatic aberration, **no** depth of field.

## 5. Motion

- Every move eases in and out; the camera travels on curved paths, never cuts mid-move, and holds for at least 0.5 s whenever a caption lands.
- Water moves like water: runoff draws along channels from high to low, lakes creep across the lowest ground first, surges arrive with a soft overshoot and settle. Greenery springs up (about 6% overshoot) and later fades back.
- Text: words rise 24 px and fade in with a 40 ms stagger (in 450 ms, out 250 ms). Never spinning, bouncing or letter by letter.
- **Scene changes:** map fly-tos (zoom out, pan, zoom in) between places on the state map, and the soft 0.8 s cloud-shaped dissolve (approved on the earlier videos) into each diorama. Nothing grey or opaque ever covers the frame.

## 6. Type and layout

- **Font:** Liberation Serif, the metric-matched stand-in for Times New Roman (Times New Roman isn't installed on the render machine and can't be bundled). It's loaded from `scene/fonts/` for the web text and the 3d labels, and QA checks every frame uses it.
- **Scale:**

  | Element | Size and weight | Line height |
  |---|---|---|
  | Title | Bold 76 | 1.1 |
  | Caption | Regular 52, key number bold | 1.25 |
  | Stat number | Regular 72, tabular figures | |
  | Stat label | Italic 30 | |
  | Map label | Regular 30 (water names Italic 30) | |
  | Gauges and legend | Regular 28, swatches carry the colour | |
  | End card | Bold 78 | |

- **Captions:** one idea, at most 2 lines of about 36 characters (hard limit 38), sentence case, no full stop, on screen at least (words ÷ 3) seconds.
- **Safe zones:** all text between y = 154 and y = 1536 and left of x = 950. Debug overlay with `?safe=1`.
- **Fixed slots:** title or stats panel top left; day chip top right (“Day 12 · imagined scenario”); gauges or legend under the stats panel; caption panel at the bottom, anchored at y = 1536.
- **Gauges:** three rows (runoff, ground saturation, flood pressure), five pips each, filled pips in off-white, tagged “imagined scenario”. No invented numbers.

## 7. Maps

- **Projection:** NAD83 / UTM zone 12N (EPSG:26912), Utah's standard state projection. The globe is an orthographic view.
- **Globe first, then flat:** a short globe establishing shot, a fly-down into the flat terrain map, tilted 3d views for regions, and cut-away cross-sections for the canyon funnel.
- **Real base:** Utah's terrain at 2× relief with soft hillshading (sandstone red, desert cream on the salt flats and lakebeds), real rivers and lakes in turquoise, neighbouring states dimmed toward storm charcoal, thin borders at 35% opacity, the drainage divide from the USGS Watershed Boundary Dataset.
- **Imagined layers, labelled “imagined scenario” in every legend:** rainfall intensity (darker cloud shadow), runoff arrows, temporary greenery, the growing Great Salt Lake shoreline (computed from the real terrain so it advances unevenly, low ground first), flooded salt flats and valley floors.
- **Labels:** only the brief's places: Utah, Zion, Colorado River, Lake Powell, Wasatch Range, Salt Lake City, Great Salt Lake, Bonneville Salt Flats. City dots with labels up and right; water names in italic; labels never overlap and fade before they reach a panel or a safe-zone edge.

## 8. Sound (summary; details in the beat sheet)

Spacious ambient desert music in a major key at 120 bpm (a slow half-time feel): airy pads and a plucked, echoing guitar-like motif first; deep drums build as the runoff rises; broad, open chords when the clouds clear; a soft button note on the end card.
- Effects are short, frame-accurate accents: thunder, canyon echoes, rushing water, waterfalls, birds, ticks on every count-up, and **a sudden quiet** near the end.
- **Rain is used sparingly:** short rain swells at the storm moments, not a continuous bed. (On the first video you asked me to remove the rain bed; this brief asks for rain, so it's present but brief. Say the word and I'll drop it.)
- **Master:** −14 LUFS, true peak under −1 dB in the encoded file; music sits 8–10 dB under the effects.
