"""Builds the extra map data for the cat video ("What if domestic cats took over California?").

Inputs (downloaded into data/raw/naturalearth/, not in git):
  - Natural Earth 1:10m roads           -> the real road network the human service network follows
  - Natural Earth 1:10m urban areas     -> where the miniature city blocks stand
  - Natural Earth 1:10m states          -> the California outline (for clipping)

Outputs (data/build/):
  - cats_vectors.json  roads (major / secondary), city blocks, and the invented territory borders,
                       all in California Albers (EPSG:3310) metres
  - cats_urban.png     urban-area mask on the same 600 m grid as ca_height.i16 (R channel)

The territory borders are FICTIONAL: a Voronoi split of California around invented "feline capitals"
near real cities. They are drawn over real geography and labelled fictional in the video.

Run:  .venv/bin/python data/prep_cats.py   (after data/prep_map.py)
"""

import json

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import Voronoi
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.ops import unary_union

from prep_map import BUILD, NX, NY, RAW, RES, X0, Y1, bbox_hit, curl_many, load_ne, proj_geom, rasterize, to_albers

LAYERS = ["ne_10m_roads", "ne_10m_urban_areas"]

# Invented territory seats (lon, lat): near real cities and regions, purely for the fictional layer
SEATS = [
    (-121.49, 38.58), (-122.42, 37.77), (-121.89, 37.34), (-118.24, 34.05), (-117.83, 33.69), (-116.55, 33.83),
    (-119.79, 36.74), (-117.16, 32.72), (-122.3, 40.6), (-123.9, 40.8), (-120.7, 35.3), (-119.0, 35.37),
    (-117.3, 34.1), (-115.6, 33.1), (-118.4, 37.4), (-120.9, 39.3), (-122.7, 38.45), (-116.2, 35.4),
]


def lines_of(g):
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, MultiLineString):
        return list(g.geoms)
    return [x for x in getattr(g, "geoms", []) if isinstance(x, LineString)]


def main():
    curl_many([(f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{n}.geojson", RAW / "naturalearth" / f"{n}.geojson") for n in LAYERS])
    ca = next(shape(f["geometry"]) for f in load_ne("ne_10m_admin_1_states_provinces") if f["properties"].get("name") == "California")
    ca_a = proj_geom(ca)
    ca_in = ca_a.buffer(-2500)

    # Roads: the real major and secondary highways, clipped to California and simplified (~600 m)
    roads = []
    for f in load_ne("ne_10m_roads"):
        p = f["properties"]
        if p.get("type") not in ("Major Highway", "Secondary Highway", "Beltway") or not f["geometry"]:
            continue
        g = shape(f["geometry"])
        if not bbox_hit(g, -125, -114, 32, 42.1):
            continue
        ga = proj_geom(g).intersection(ca_in)
        for l in lines_of(ga):
            l = l.simplify(600)
            if l.length < 8000:
                continue
            roads.append({"major": p.get("type") != "Secondary Highway", "pts": [[round(x), round(y)] for x, y in l.coords]})
    print(f"roads: {len(roads)} polylines, {sum(len(r['pts']) for r in roads)} points")

    # Urban areas: a raster mask, plus jittered city-block positions inside them (seeded)
    urban = []
    for f in load_ne("ne_10m_urban_areas"):
        g = shape(f["geometry"])
        if not bbox_hit(g, -125, -114, 32, 42.1):
            continue
        ga = proj_geom(g).intersection(ca_in)
        if not ga.is_empty and ga.area > 4e6:
            urban.append(ga)
    urban_u = unary_union(urban)
    mask = rasterize([urban_u] if urban_u.geom_type == "Polygon" else list(urban_u.geoms))
    soft = ndimage.gaussian_filter(mask.astype(np.float32), 1.0)
    Image.fromarray(np.clip(soft, 0, 255).astype(np.uint8)).save(BUILD / "cats_urban.png")
    rng = np.random.default_rng(7)
    blocks = []
    minx, miny, maxx, maxy = urban_u.bounds
    step = 3200
    for y in np.arange(miny, maxy, step):
        for x in np.arange(minx, maxx, step):
            px, py = x + rng.uniform(-0.4, 0.4) * step, y + rng.uniform(-0.4, 0.4) * step
            if urban_u.contains(Point(px, py)):
                blocks.append([round(px), round(py), round(float(rng.uniform(0.6, 1.4)), 2)])
    print(f"urban: {len(urban)} areas, {len(blocks)} city blocks")

    # Fictional territories: Voronoi borders between the invented seats, clipped inside California
    seats = np.array([to_albers.transform(lo, la) for lo, la in SEATS])
    far = np.array([[-3e6, -3e6], [3e6, -3e6], [-3e6, 3e6], [3e6, 3e6]])
    vor = Voronoi(np.vstack([seats, far]))
    borders = []
    clip = ca_a.buffer(-6000)
    for (a, b) in vor.ridge_vertices:
        if a < 0 or b < 0:
            continue
        seg = LineString([vor.vertices[a], vor.vertices[b]]).intersection(clip)
        for l in lines_of(seg):
            if l.length > 15000:
                borders.append([[round(x), round(y)] for x, y in l.segmentize(4000).coords])
    print(f"territory borders: {len(borders)}")

    out = {"crs": "EPSG:3310", "roads": roads, "blocks": blocks, "territories": borders,
           "seats": [[round(x), round(y)] for x, y in seats]}
    (BUILD / "cats_vectors.json").write_text(json.dumps(out, separators=(",", ":")))


if __name__ == "__main__":
    main()
