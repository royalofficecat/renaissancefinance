# Style bible — “What if California got 30 days of extreme rain?”

One page. Every frame follows it. Swatches and type samples: [`style-sheet.png`](style-sheet.png).
Machine-readable colours: [`../scene/palette.json`](../scene/palette.json).

## 1. Palette

**Scene colours (the 3d world only; four colours, one job each)**

| Role | Name | Hex | Job |
|---|---|---|---|
| Background | Deep blue | `#0B1E33` | Sky, ocean, the space around the diorama. All water is a lighter **tint of this same blue** (`#3A80BF`), so water never adds a fifth colour. |
| Main subject | Storm gray | `#8D97A2` | Land, terrain, clouds, roads, buildings. |
| Accent | Amber | `#F2A33A` | Warnings only: stressed levees, slide-prone slopes, the broken route, outages. Never used for text. |
| Data / highlight | Recovery green | `#6DBE85` | Hills greening in beat 3, then recharge basins and refilled groundwater in the ending. |

**Neutral text colours (all text, panels, legends, the end card)**

| Role | Name | Hex | Job |
|---|---|---|---|
| Text | Off-white | `#F4F1EA` | Titles, captions, stat numbers, map labels. |
| Secondary text | Warm grey | `#BFB8AC` | Stat labels, asides, “illustrative scenario” tags, legend text. |
| Panel fill | Charcoal | `#1A1816` at 82% | Every caption, stats and legend panel, with an 18 px background blur and a soft shadow. |
| Panel edge | Warm grey edge | `#4A4540` | 1.5 px panel outline; the halo behind 3d map labels. |

Chosen once for the whole video: **light text on dark panels.** Contrast is checked by `render/qa_contrast.py`. The worst case, with the see-through panel over pure white, is 8.9:1 for off-white text and 5.1:1 for warm-grey text. Both pass 4.5:1.

## 2. Render style: “premium toy” diorama

The world is a tabletop model: California as a carved relief slab, close-ups as cut-away blocks of earth.
- **Materials:** matte clay for everything solid (roughness 0.60–0.85, metalness 0). Water is the one glossy material (roughness 0.08–0.20, light clearcoat), so it always catches the eye.
- **No outlines.** Edges get a small rounded bevel (about 2% of object size), with no hard corners.
- **One level of detail:** simple rounded primitives (lollipop trees, capsule trucks, rounded-box buildings) and real terrain at about 1 vertex per 2 screen pixels. No photo textures. Hillshade comes from the terrain itself.
- **People and animals never appear.** Danger is told in captions; the scene shows only landscapes and infrastructure.

## 3. Lighting (same rig in every scene)

- **Key:** directional, upper left, about 40° high, overcast daylight (about 6,500 K, `#E9EEF4`), 4096 px shadow map with soft filtering.
- **Fill:** a sky/ground hemisphere light, cool blue above and warm grey below, at 35% of the key.
- **Rim:** directional from behind, 60% of the key, which separates the terrain edges and clouds from the dark background.
- **Environment:** a soft gradient sky (deep-blue zenith to storm-grey horizon, with a faint key-light glint) generated in code and evaluated directly in the water shaders. A pre-filtered environment map looked the same but cost about 4 s a frame on this GPU-less render machine. Matte land doesn't need it, so only water reflects the sky.
- **The one story change:** from beat 11 (“two legacies”) the clouds part and the key warms to about 5,000 K (`#FFE7C7`) to mark the recovery. Nothing else changes temperature.

## 4. Finishing (subtle)

ACES filmic tone mapping · bloom only on the brightest highlights (threshold 1.6, strength 0.2–0.3, computed at quarter resolution) · vignette 0.25 · film grain 2.5%, one grain per output pixel, re-seeded every frame but identical on every re-render · the 3d scene is rendered at 2× pixel density (2160 × 3840) and scaled down 2:1, which gives 4 samples per pixel of anti-aliasing. **No** chromatic aberration. **No** depth of field.

## 5. Motion

- Every move eases in and out (cubic or sine). Nothing moves linearly.
- Objects arrive on a damped spring with about 6% overshoot (reservoir rises, pins, panels).
- The camera travels on smooth curved paths and **never cuts mid-move**. Scene changes are either a map fly-to (zoom out, pan, zoom in) or a 0.8 s dissolve: the outgoing shot, already at rest, pushes in about 8% while the next shot blooms in from the centre through soft cloud-shaped openings. Nothing opaque covers the frame, and a soft whoosh plays.
- The camera holds still for at least 0.5 s whenever a new caption lands.
- Text: words rise 24 px and fade in with a 40 ms stagger (in 450 ms, out 250 ms). No spins, bounces or letter-by-letter reveals.

## 6. Type and layout

- **Font:** Times New Roman isn't installed and can't legally be bundled, so we use **Liberation Serif**, its metric-matched open-licence twin (identical letter widths). It is loaded from `scene/fonts/` for both the web text and the 3d labels. Drop a licensed `TimesNewRoman*.ttf` into that folder and the pipeline will use it instead.
- **Scale:** title Bold 76 / line height 1.1 · caption Regular 52 / 1.25 with the key number Bold · stat number Regular 72 (tabular figures) · stat label Italic 30 · map labels Regular 30 (water names Italic 30) · end card Bold 78.
- **Captions:** one idea, at most 2 lines of about 36 characters (hard limit 38), sentence case, no full stop at the end, and on screen for at least (words ÷ 3) seconds.
- **Safe zones (1080 × 1920):** all text sits between y = 154 and y = 1536 and left of x = 950. Panels run from x = 48 to x = 948. A debug overlay (`?safe=1`) draws these zones.
- **Fixed slots:** title or stats panel at the top left, scenario day-chip at the top right, legend under the stats panel, caption panel bottom-anchored at y = 1536. The middle of the frame is kept clear for the 3d scene.

## 7. Maps

- **Globe:** orthographic, centred on the North Pacific, Natural Earth land, used once (beats 1–2).
- **Flat map:** **California Albers** (EPSG:3310, equal-area conic, standard parallels 34° N and 40.5° N), the projection California agencies use, shown as a tilted relief slab.
- **Terrain:** open elevation tiles (from USGS 3DEP / SRTM / ETOPO data) with 2× vertical exaggeration on the state map and 1.5× on close-ups, plus soft hillshading.
- **Quiet background:** land is storm gray, the ocean is deep blue, and borders are thin at 35% opacity. The place in focus gets a soft glow, not a new colour.
- **Labels:** city dot with the label offset up and right, water names in italic, no overlaps, and only the places in the brief.
- **Flood coverage** is labelled “illustrative scenario” on screen and in its legend.
