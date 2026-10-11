# Style bible — "What if California got 30 days of extreme rain?"

Vertical 1080 × 1920, 30 fps, 64 seconds (13 beats + 4 s end card). Every frame follows this page.

## 1. Palette

**Scene colors** (the 3D world only; four jobs, four swatches)

| Job | Hex | Where it lives |
|---|---|---|
| Background | `#0E1B2E` deep blue | sky, ocean depth, globe backdrop, fog |
| Main subject | `#6E7B8A` storm grey | land, terrain, buildings, clouds, soil |
| Accent (one only) | `#E0A640` amber | warnings and emphasis: closed route, flood-edge glow, levee strain, rim light tint |
| Data / highlight | `#2F7FC2` water blue | rivers, reservoirs, rain, flood coverage, atmospheric-river plume |

Story-driven state change: in the recovery act (beats 11–13) the **main subject** tint eases from storm grey toward recovery green `#5E9E5A` as the clouds clear. Green is not a fifth permanent swatch; it is the land's "after" state, as the brief asks. Nothing else changes color.

**Neutral text colors** (overlay, panels, map labels, legend, end card; never tinted)

| Job | Hex / alpha | Notes |
|---|---|---|
| Text | `#F3EFE6` off-white | all primary text |
| Secondary text | `#D2CBBF` warm grey | stat labels, asides, legend text, source line |
| Panel fill | `#181A1E` at 80 % | charcoal, with 14 px backdrop blur |
| Panel edge | `#8A847A` at 35 % | 1 px hairline, 22 px corner radius |

Contrast (checked in code against the panel blended over the darkest and the brightest possible frame): off-white 15.2 : 1 over a dark frame and 8.4 : 1 over a near-white frame; warm grey 10.8 : 1 and 6.0 : 1. Both pass 4.5 : 1 in every case. Light text on dark panels is chosen once, for the whole video.

## 2. Render style

**Stylized "premium toy" 3D**: chunky, clean geometry, soft shadows, no outlines, no textures with photographic detail. Rules for every object:

- Materials: `MeshStandardMaterial`, roughness 0.60–0.80, metalness 0. One stated exception: **water** (rivers, lake, reservoirs, flood) uses roughness 0.15–0.25 with a faint normal ripple so it reads as water.
- Level of detail: forms are readable at thumbnail size. Buildings are boxes with bevelled edges, trees are spheres on sticks, trucks are two boxes. Terrain is smoothed mesh with vertical exaggeration 2× (within the 1.5–3× limit).
- No outlines, no toon ramp, no emissive except the amber flood-edge glow and city dots.

## 3. Lighting

Fixed "late afternoon under a storm deck" for the whole video, the one planned change being the clouds clearing in beats 11–13 (same sun angle, warmer and brighter).

| Light | Colour | Intensity | Position (relative to subject) |
|---|---|---|---|
| Key (directional, casts shadow) | `#DCE6F2` cool white, about 6000 K | 2.6 | upper left, 45° elevation |
| Fill (directional, no shadow) | `#5F7391` blue-grey | 0.9 | lower right, 20° elevation |
| Rim (directional) | `#F5E6C8` pale warm | 1.4 | behind and above, opposite the key |
| Environment | code-generated gradient sky (deep blue to grey-white horizon) through PMREM | 0.6 | reflections only |

Shadows: 4096² shadow map, PCF-soft, bias tuned so nothing flickers. In the recovery act the key warms to `#F7E9D2` and rises to 3.2; the fill brightens; the fog thins.

## 4. Finishing (post-processing)

ACES filmic tone mapping, exposure 1.05. Bloom: threshold 0.85, strength 0.22, radius 0.4 (highlights only). Vignette: offset 0.95, darkness 0.35. Film grain: 2.5 % monochrome, seeded by frame number. Anti-aliasing: render at 2× (2160 × 3840) and downscale with area filtering, plus SMAA. No chromatic aberration. No depth of field anywhere (all beats carry text).

## 5. Motion

- Every move eases: cubic in-out for camera and value changes; spring (damping ratio 0.72, small overshoot) for objects arriving. Nothing linear, nothing snaps.
- Camera travels on Catmull-Rom curves. It never cuts in the middle of a move, and it holds still for at least 0.5 s whenever a new caption appears.
- Lenses: 24–35 mm equivalent for wides, 50–85 mm for close-ups. Horizon stays level unless a tilt is the point.
- Numbers count up over 0.9 s with fixed-width figures. Words rise and fade in with a 40 ms stagger and leave in 180 ms.

## 6. Typography

One family: **Times New Roman**. It is not installed on this render machine, so the metric-matched stand-in **Liberation Serif** (fonts/LiberationSerif-*.ttf) is used everywhere, loaded from the project folder, never from the internet. Bold for titles, regular for captions and stats, italic for labels, asides and water names.

| Role | Size | Weight | Line height |
|---|---|---|---|
| Title (hook, end card) | 80 px | bold | 1.1 |
| Caption | 56 px | regular, key number bold | 1.25 |
| Stat number | 72 px | regular, tabular figures | 1.1 |
| Stat label | 30 px | regular | 1.25 |
| Map label | 30 px (cities), 28 px italic (water) | regular / italic | 1.2 |
| Day counter | 34 px | italic | 1.2 |

Safe zones: nothing textual below the top 8 % (154 px), inside the bottom 20 % (384 px) or the right 12 % (130 px). A debug overlay (`?safe=1`) draws them.
