# Style bible — “What if domestic cats took over California?”

One page. Every frame follows it. Swatches and type samples: [`style-sheet.png`](style-sheet.png).
Machine-readable colours: [`../../scene/videos/cat-kingdom/palette.json`](../../scene/videos/cat-kingdom/palette.json).

## 1. Palette

**Scene colours (the 3d world only; four colours, one job each)**

| Role | Name | Hex | Job |
|---|---|---|---|
| Background | Coastal blue | `#3F86AE` | Sky behind every diorama and the ocean on the maps. A lighter tint marks the humans' service network: **cool = human**. |
| Main subject | Warm cream | `#F1E3C8` | The world itself: land, plaster buildings, furniture, cream-coloured cats. |
| Accent | Terracotta | `#C8623F` | Everything the cats add: territories, rooftop routes, the paw seal, roof tiles, ginger cats. **Warm = cat.** |
| Data / highlight | Leafy green | `#6FA35A` | Living things: freeway gardens, catnip fields, wildlife sanctuaries. |

**Gold sunlight (`#FFD48C`) is light, not paint.** It's the colour of the key light. Where it pools on the map, it marks the cats' "sun estates", their wealth. This keeps the scene to four painted colours while still letting the brief's gold do its job.

**Neutral text colours.** Chosen once for the whole video: **dark text on light panels**, to suit the sunny look.

| Role | Name | Hex | Job |
|---|---|---|---|
| Text | Near-black | `#1D1A17` | Titles, captions, stat numbers, map labels. |
| Secondary text | Warm grey | `#5B544C` | Stat labels, asides, “fictional” tags, legend text. |
| Panel fill | Off-white | `#F8F4EC` at 88% | Every caption, stats, legend and end-card panel, with an 18 px background blur and a soft shadow. |
| Panel edge | Warm grey edge | `#D6CCBD` | 1.5 px panel outline; the light halo behind 3d map labels. |

Contrast, checked by `render/qa_contrast.py`, is tested on the worst case: the see-through panel over pure black. Near-black text scores 12.1:1 and warm-grey text 5.2:1. Both pass the 4.5:1 minimum.

## 2. Render style: “premium toy” diorama

The same house style as the rain video. California is a tabletop model: maps are carved relief slabs, and cities are miniature cut-away dioramas.
- **Materials:** matte clay for everything solid (roughness 0.60–0.85, no metal). Water, glass and the food can are the only glossy things (roughness 0.10–0.25).
- **No outlines.** Small rounded bevels everywhere; one level of detail.
- **Cats are soft vinyl-toy figures that stay recognisably feline:** rounded body, triangular ears, long tail, simple dark eyes. They have only real cat poses: sit, loaf, stretch, curl, tail flick, slow blink. Coats are ginger (terracotta shades) or cream. **No clothes, no talking, no human gestures.**
- **Humans are simple, faceless toy figures**, calm and unhurt. Some are visibly happy with the arrangement.
- **The paw seal** of the fictional government is a terracotta disc with a raised paw print. It's a scene object, never text.

## 3. Lighting (same rig in every scene)

- **Key:** gold late-afternoon sun (about 4,300 K, `#FFD48C`), upper left, 35° high, so shadows are long and soft. Sun patches are part of the story: cats always end up in them.
- **Fill:** sky hemisphere, coastal blue above and warm cream bounce below, at 35% of the key.
- **Rim:** warm back light at 50%, which lifts ears and tails off the background.
- **Environment:** a soft sky gradient generated in code and evaluated directly in the water and glass shaders. This is the same fast technique as the rain video, with no sampled environment map.
- **The one story change:** the final kitchen is evening, lit by a warm lamp (`#FFC98F`). It's home time.

## 4. Finishing (subtle)

ACES filmic tone mapping · bloom only on the brightest highlights (sun glints, the can) · vignette 0.25 · film grain 2.5%, seeded per frame · 3d rendered at 2× pixel density and scaled down 2:1. **No** chromatic aberration. **No** depth of field.

## 5. Motion

- Every move eases in and out. Objects arrive on a damped spring (about 6% overshoot). The camera travels on curved paths, never cuts mid-move, and holds for at least 0.5 s whenever a caption lands.
- **Cats move like cats:** slow blinks, tail sways, ear twitches and loaf-settling. Small, unhurried and frequent, so every shot feels alive. The single deliberate "snap" is comic: the moment every door-sitting cat turns its head at once.
- Text: words rise 24 px and fade in with a 40 ms stagger (in 450 ms, out 250 ms). Never spinning, bouncing or letter by letter.
- **Scene changes:** a map fly-to (zoom out, pan, zoom in) between places on the map, then the soft 0.8 s dissolve into each miniature city, the one approved on the rain video. Nothing grey or opaque ever covers the frame.

## 6. Type and layout

- **Font:** Liberation Serif, the metric-matched stand-in for Times New Roman (not installed and not licensed for bundling). It's loaded from `scene/fonts/` for both the web text and the 3d labels.
- **Scale:**

  | Element | Size and weight | Line height |
  |---|---|---|
  | Title | Bold 76 | 1.1 |
  | Caption | Regular 52, key number bold | 1.25 |
  | Stat number | Regular 72, tabular figures | |
  | Stat label | Italic 30 | |
  | Map label | Regular 30 (water names Italic 30) | |
  | End card | Bold 78 | |

- **Captions:** one idea, at most 2 lines of about 36 characters (hard limit 38), sentence case, no full stop, and on screen for at least (words ÷ 3) seconds.
- **Safe zones:** all text sits between y = 154 and y = 1536 and left of x = 950. Turn on the debug overlay with `?safe=1`.
- **Fixed slots:**
  - Title, or the stats panel, top left.
  - "Day of the reign" chip top right.
  - Legend under the stats panel.
  - Caption panel at the bottom, anchored at y = 1536.

## 7. Maps

- **Projection:** California Albers (EPSG:3310), the equal-area conic California's agencies use.
- **Flat map first:** the takeover is seen from straight above. It then tilts into miniature 3d city scenes, and the finale is a tilted statewide view.
- **Real base:**
  - The California outline, cities and roads (Natural Earth).
  - Mountains as gentle 2× relief with soft hillshading (USGS 3DEP elevation).
  - Farmland shown as Central Valley field texture.
  - Land in warm cream, ocean in coastal blue, and thin borders at 35% opacity.
- **Invented layers, all labelled "fictional" in the legend:**

  | Layer | How it's drawn |
  |---|---|
  | Feline territories | Terracotta borders that spread as trails of paw prints |
  | Rooftop routes | Terracotta dotted lines |
  | Sun estates | Gold pools of light |
  | Wildlife sanctuaries | Green domes |
  | Human service network | Light coastal-blue dashed lines underneath |

- **Labels:** only the brief's six places (Sacramento, San Francisco / Silicon Valley, Los Angeles, Orange County, Central Valley, Palm Springs). City dots have labels offset up and right, water names are italic, and labels never overlap.

## 8. Sound (summary; details in the beat sheet)

Plucked strings first, swelling into a grand orchestral sound as the civilisation grows, then a soft, warm ending with a final button note.
- **Effects are short, frame-accurate accents:** purrs, claws on stone, cardboard rustles, pops, ticks and whooshes, plus one absurdly ceremonial can opening.
- **The music carries the track.** There is **no continuous noise bed** (the lesson from the rain video).
- **Master:** −14 LUFS, true peak under −1 dB.
