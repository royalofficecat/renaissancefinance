# Sources and licences

Every number on screen traces to a row in **Facts**. Every map layer traces to a row in **Map data**.
All code-generated audio and visuals are original to this project.

## Facts

_(filled in from the fact-check, see below)_

## Map data

| Layer | Used for | Source | Licence |
|---|---|---|---|
| Land (1:110m) | Globe (beats 1–2) | [Natural Earth](https://www.naturalearthdata.com/) via [natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) | Public domain |
| Coastline, state borders (1:10m) | California map | Natural Earth | Public domain |
| Rivers: Sacramento, San Joaquin, Feather, Stanislaus (`rivers_lake_centerlines`); American, Yuba, Mokelumne, Tuolumne, Merced, Kings, Kern (`rivers_north_america`) | River flows (beats 6–8) | Natural Earth 1:10m | Public domain |
| Reservoirs: Shasta Lake, Lake Oroville, Millerton Lake, Isabella Lake, San Luis Reservoir | Reservoir rise (beat 3), map | Natural Earth 1:10m lakes | Public domain |
| Cities: Sacramento, Stockton, Fresno, Bakersfield, Redding, Los Angeles, Riverside | City dots and labels | Natural Earth populated places | Public domain |
| Watershed boundaries: Sacramento (HU4 1802), San Joaquin (1804), Tulare–Buena Vista Lakes (1803), Santa Ana (HU8 18070203) | Watershed outlines, Tulare Lake basin, Santa Ana River watershed | [USGS Watershed Boundary Dataset](https://www.usgs.gov/national-hydrography/watershed-boundary-dataset), Region 18 | Public domain (U.S. Government work) |
| Elevation | Terrain relief | [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (Mapzen/Tilezen “Terrarium” encoding) | Open data with attribution (below) |

**Elevation attribution (shown in the video description and here):** United States 3DEP (formerly NED) and SRTM terrain data courtesy of the U.S. Geological Survey · Global ETOPO1 terrain data, U.S. National Oceanic and Atmospheric Administration · Mexico terrain data source: INEGI, Continental relief, 2016 · tiles by Mapzen.

## Fonts

| Font | Used for | Licence |
|---|---|---|
| Liberation Serif 2.x (Regular, Bold, Italic, Bold Italic) | All text: a metric-matched stand-in for Times New Roman | SIL Open Font License 1.1 |

## Software

three.js (MIT) · troika-three-text (MIT) · Playwright (Apache 2.0) · ffmpeg (LGPL/GPL) · NumPy (BSD).
