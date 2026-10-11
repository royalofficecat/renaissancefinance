# Sources

Every number in a caption or stats panel, every dataset on a map, and every font file, with its licence.

## Facts (by beat)

| Beat | Claim in the video | Source | Note |
|---|---|---|---|
| 2 | Atmospheric rivers deliver roughly 30–50 % of the state's annual precipitation | NOAA Climate.gov, "Atmospheric rivers: what are they and how does NOAA study them?" https://climate.gov/news-features/feed/atmospheric-rivers-what-are-they-and-how-does-noaa-study-them | NOAA's figure is 30–50 % for West Coast states; the brief said 40–60 %. A DOE/CalWater summary gives 40–50 % for northern California. The caption uses NOAA's range and says "roughly". |
| 3 | Nine atmospheric rivers hit in about three weeks (27 Dec 2022 – 17 Jan 2023) | NOAA Climate.gov, "Atmospheric rivers take a chunk out of California drought" https://www.climate.gov/news-features/event-tracker/atmospheric-rivers-take-chunk-out-california-drought ; CW3E / Scripps story map https://cw3e.ucsd.edu/dec2022-jan2023_arstorymap/ | |
| 4 | Healthy soil is roughly 50 % pore space (45 % mineral, 5 % organic matter, 25 % water, 25 % air) | USDA NRCS, "Basic soil properties" training deck (2023) https://nrcs-prod.azureedge.us/sites/default/files/2023-03/Soils2023_Day1_BasicSoilProperties.pdf ; Oregon State Extension EM 9544 https://extension.oregonstate.edu/sites/extd8/files/catalog/auto/EM9544.pdf | Idealized surface soil; varies by soil type. Caption says "roughly". |
| 5 | Debris flows usually move about 10 mph but can exceed 35 mph | USGS Fact Sheet FS-176-97, "Debris-flow hazards in the United States" https://pubs.usgs.gov/fs/fs-176-97/fs-176-97.html ; USGS FAQ "What is a debris flow?" https://www.usgs.gov/faqs/what-debris-flow | |
| 6 | The Central Valley is about 400 miles long | USGS California Water Science Center, Central Valley regional overview https://www.usgs.gov/centers/california-water-science-center/central-valley-regional-overview | Some sources say 450 miles; the caption says "about". |
| 7 | In the ARkStorm scenario the Central Valley sees hypothetical flooding 300 miles long and 20 or more miles wide | Porter, K. et al. (2011), "Overview of the ARkStorm scenario", USGS Open-File Report 2010-1312 https://pubs.usgs.gov/publication/ofr20101312 ; USGS ARkStorm programme page https://www.usgs.gov/programs/science-application-for-risk-reduction/science/arkstorm-scenario | A modeled scenario, not a forecast. The map's flood layer is labelled "illustrative scenario" and is drawn from terrain lows, not from the ARkStorm inundation model. |
| 8 | The Central Valley produces about a quarter of the nation's food | USGS California Water Science Center, "California's Central Valley" https://ca.water.usgs.gov/projects/central-valley/about-central-valley.html | |
| 9 | One storm on 8 Jan 2023 left more than 350,000 SMUD customers without power | Associated Press, "Storm-battered California gets more wind, rain and snow", 14 Jan 2023, via Click2Houston https://www.click2houston.com/news/national/2023/01/14/storm-battered-california-gets-more-wind-rain-and-snow/ | Utility-specific figure (Sacramento Municipal Utility District), not a statewide peak. |
| 10 | Tulare Lake refilled in 2023 and experts expected it to take at least a year to recede | NBC News, "A dormant California lake that reappeared isn't going anywhere fast", July 2023 https://www.nbcnews.com/science/science-news/dormant-california-lake-reappeared-isnt-going-anywhere-fast-rcna92452 | Caption says "about a year". |
| 11 | About 390,000 acre-feet (390,817) of floodwater was recharged under the 2023 executive orders | California DWR, "DWR releases Semi-Annual Groundwater Conditions Report with look back at 2023 water year", Oct 2023 https://water.ca.gov/News/Blog/2023/Oct-23/DWR-releases-Semi-Annual-Groundwater-Conditions-Report-with-Look-Back-at-2023-Water-Year | Total managed recharge for the water year was larger (about 3.8–4.1 million acre-feet); the caption uses the floodwater-order figure because it matches the "give floodwater somewhere to go" point. |
| 12 | The 1861–62 storms lasted 45 days, flooded the Sacramento Valley and forced the capital to move temporarily to San Francisco | USGS Pacific Coastal and Marine Science Center, "ARkStorm: California's other Big One" https://www.usgs.gov/centers/pcmsc/news/arkstorm-californias-other-big-one | Caption says "about 45 days". |

Not shown: damage totals (USGS publishes scenario estimates, but the brief asks to leave money figures out), casualties, dam failure, or any claim that the rain ends drought.

## Map and terrain data

| Data | Source | Licence |
|---|---|---|
| Coastlines, land, state borders, lakes and reservoirs, rivers, populated places | Natural Earth 1:10m vector (via the natural-earth-vector GitHub mirror) https://github.com/nvkelso/natural-earth-vector | Public domain |
| Elevation (terrain relief for California and the Sierra) | Terrain Tiles on AWS Open Data (Terrarium PNG encoding), compiled by Mapzen from SRTM, USGS 3DEP/NED and GMTED https://registry.opendata.aws/terrain-tiles/ | Open; attribution "Terrain Tiles was compiled by Mapzen from SRTM, NED/3DEP, GMTED and other sources" |
| Atmospheric-river plume shape and landfall position | Stylized from NOAA/CW3E imagery of the Dec 2022–Jan 2023 events (not a data overlay) | n/a (illustration) |
| Flood extent on maps | Illustrative: drawn from terrain lows in the Sacramento Valley, Delta, San Joaquin Valley and Tulare Lake basin; labelled "illustrative scenario" | n/a (illustration) |
| Watersheds (Sacramento–San Joaquin, Santa Ana) | Approximated from Natural Earth river networks and terrain divides; USGS Watershed Boundary Dataset is not reachable from this render machine | n/a (illustration) |
| Projection for flat maps | California Albers equal-area conic (standard parallels 34° N and 40.5° N, central meridian 120° W), the state's standard projection (EPSG 3310), implemented in code | n/a |

## Fonts

| Font | Use | Licence |
|---|---|---|
| Liberation Serif (Regular, Bold, Italic, Bold Italic), files in `fonts/` | Metric-matched stand-in for Times New Roman, which is not installed on the render machine; used for every piece of text, overlay and in-world | SIL Open Font License 1.1 |

## Audio

All music and sound effects are synthesized in code (`audio/`). No downloaded or copyrighted audio.
