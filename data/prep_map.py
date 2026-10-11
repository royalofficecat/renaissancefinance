"""Builds the California map data used by the 3d scene.

Inputs (downloaded into data/raw/, not in git):
  - Terrain Tiles on AWS (Terrarium PNG, zoom 8): elevation from USGS 3DEP/SRTM, NOAA ETOPO1, INEGI
  - Natural Earth 1:10m / 1:50m GeoJSON: states, rivers, lakes, cities, land
  - USGS Watershed Boundary Dataset, region 18 (GeoPackage)

Outputs (data/build/):
  - ca_height.i16 + ca_meta.json  heights in metres on a California Albers (EPSG:3310) grid
  - ca_masks.png                  R = land, G = California (soft edge), B = illustrative flood arrival; ca_lakes.png = reservoirs
  - ca_vectors.json               rivers, reservoirs, cities, watersheds, Santa Ana River, all in Albers metres
  - globe_land.png                equirectangular land mask for the globe

Run:  .venv/bin/python data/prep_map.py
"""

import gzip
import heapq
import io
import json
import math
import pathlib
import sqlite3
import subprocess
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
from scipy import ndimage
from shapely import wkb
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform as shp_transform, unary_union

ROOT = pathlib.Path(__file__).resolve().parent
RAW = ROOT / "raw"
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)

# Grid: California Albers, 600 m cells, generous margin of ocean and neighbouring states.
X0, X1, Y0, Y1, RES = -540_000, 660_000, -740_000, 580_000, 600
NX, NY = int((X1 - X0) / RES), int((Y1 - Y0) / RES)

to_albers = Transformer.from_crs("EPSG:4326", "EPSG:3310", always_xy=True)
to_lonlat = Transformer.from_crs("EPSG:3310", "EPSG:4326", always_xy=True)


def curl_many(jobs):
    """jobs: list of (url, path). Downloads missing files with parallel curl."""
    todo = [(u, p) for u, p in jobs if not p.exists()]
    for u, p in todo:
        p.parent.mkdir(parents=True, exist_ok=True)
    for i in range(0, len(todo), 16):
        procs = [subprocess.Popen(["curl", "-sS", "--fail", "--retry", "3", "-o", str(p), u]) for u, p in todo[i : i + 16]]
        for pr in procs:
            pr.wait()
    missing = [str(p) for u, p in jobs if not p.exists()]
    if missing:
        raise SystemExit(f"download failed: {missing[:3]}")


# ---------------------------------------------------------------- elevation
def lonlat_to_tile(lon, lat, z):
    n = 2**z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def build_height():
    z = 8
    gx, gy = np.meshgrid(X0 + (np.arange(NX) + 0.5) * RES, Y1 - (np.arange(NY) + 0.5) * RES)
    lon, lat = to_lonlat.transform(gx, gy)
    n = 2**z
    tx = (lon + 180) / 360 * n
    ty = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n
    xs, ys = range(int(tx.min()), int(tx.max()) + 1), range(int(ty.min()), int(ty.max()) + 1)
    jobs = [(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", RAW / f"terrarium/{z}/{x}/{y}.png") for x in xs for y in ys]
    curl_many(jobs)
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
    for x in xs:
        for y in ys:
            a = np.asarray(Image.open(RAW / f"terrarium/{z}/{x}/{y}.png").convert("RGB")).astype(np.float32)
            h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
            mosaic[(y - ys[0]) * 256 : (y - ys[0] + 1) * 256, (x - xs[0]) * 256 : (x - xs[0] + 1) * 256] = h
    px = (tx - xs[0]) * 256 - 0.5
    py = (ty - ys[0]) * 256 - 0.5
    height = ndimage.map_coordinates(mosaic, [py, px], order=1, mode="nearest")
    return height.astype(np.float32)


# ---------------------------------------------------------------- vectors
def proj_geom(g):
    return shp_transform(lambda x, y, z=None: to_albers.transform(x, y), g)


def to_px(x, y):
    return (x - X0) / RES, (Y1 - y) / RES


def rasterize(geoms, value=255):
    img = Image.new("L", (NX, NY), 0)
    d = ImageDraw.Draw(img)
    for g in geoms:
        polys = g.geoms if isinstance(g, MultiPolygon) else [g]
        for p in polys:
            d.polygon([to_px(*c) for c in p.exterior.coords], fill=value)
            for hole in p.interiors:
                d.polygon([to_px(*c) for c in hole.coords], fill=0)
    return np.asarray(img)


def load_ne(name):
    return json.loads((RAW / "naturalearth" / f"{name}.geojson").read_text())["features"]


def bbox_hit(g, lon0=-127, lon1=-112, lat0=31, lat1=44):
    b = g.bounds
    return b[2] > lon0 and b[0] < lon1 and b[3] > lat0 and b[1] < lat1


def line_coords(g):
    lines = g.geoms if isinstance(g, MultiLineString) else [g]
    return [list(l.coords) for l in lines]


def sample_height(height, x, y):
    px, py = to_px(x, y)
    return float(ndimage.map_coordinates(height, [[py - 0.5], [px - 0.5]], order=1, mode="nearest")[0])


# ---------------------------------------------------------------- watersheds (USGS WBD)
def wbd_geoms(codes):
    zpath = RAW / "wbd" / "WBD_18_HU2_GPKG.zip"
    curl_many([("https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/HU2/GPKG/WBD_18_HU2_GPKG.zip", zpath)])
    gpkg = RAW / "wbd" / "WBD_18_HU2_GPKG.gpkg"
    if not gpkg.exists():
        with zipfile.ZipFile(zpath) as zf:
            name = [n for n in zf.namelist() if n.endswith(".gpkg")][0]
            gpkg.write_bytes(zf.read(name))
    con = sqlite3.connect(gpkg)
    out = {}
    for code in codes:
        table = f"WBDHU{len(code)}"
        cols = [r[1] for r in con.execute(f"PRAGMA table_info({table})")]
        geom_col = "shape" if "shape" in cols else ("geom" if "geom" in cols else [c for c in cols if c.lower() in ("shape", "geom", "geometry")][0])
        key = f"huc{len(code)}"
        row = con.execute(f"SELECT {geom_col}, name FROM {table} WHERE {key} = ?", (code,)).fetchone()
        blob = row[0]
        flags = blob[3]
        env_len = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
        out[code] = (wkb.loads(bytes(blob[8 + env_len :])), row[1])
    return out


# ---------------------------------------------------------------- hydrology helpers
def priority_fill(h, mask=None):
    """Priority-flood depression filling (Barnes et al. 2014). Returns filled heights."""
    ny, nx = h.shape
    filled = h.copy()
    done = np.zeros(h.shape, bool)
    heap = []
    for y in range(ny):
        for x in (0, nx - 1):
            heap.append((filled[y, x], y, x)); done[y, x] = True
    for x in range(nx):
        for y in (0, ny - 1):
            if not done[y, x]:
                heap.append((filled[y, x], y, x)); done[y, x] = True
    heapq.heapify(heap)
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    while heap:
        z, y, x = heapq.heappop(heap)
        for dy, dx in nb:
            yy, xx = y + dy, x + dx
            if 0 <= yy < ny and 0 <= xx < nx and not done[yy, xx]:
                done[yy, xx] = True
                if filled[yy, xx] < z:
                    filled[yy, xx] = z + 1e-3
                heapq.heappush(heap, (filled[yy, xx], yy, xx))
    return filled


def trace_downhill(filled, y, x, max_steps=4000):
    ny, nx = filled.shape
    path = [(y, x)]
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for _ in range(max_steps):
        best, bz = None, filled[y, x]
        for dy, dx in nb:
            yy, xx = y + dy, x + dx
            if 0 <= yy < ny and 0 <= xx < nx:
                drop = (filled[y, x] - filled[yy, xx]) / math.hypot(dy, dx)
                if filled[yy, xx] < bz and (best is None or drop > best[0]):
                    best = (drop, yy, xx)
        if best is None:
            break
        _, y, x = best
        path.append((y, x))
        if filled[y, x] <= 0:
            break
    return path


def chaikin(pts, n=2):
    for _ in range(n):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
        out.append(pts[-1])
        pts = out
    return pts


# ---------------------------------------------------------------- main
NE_LAYERS = ["ne_10m_rivers_lake_centerlines", "ne_10m_rivers_north_america", "ne_10m_lakes", "ne_10m_lakes_north_america",
             "ne_10m_populated_places_simple", "ne_10m_admin_1_states_provinces", "ne_50m_land"]


def main():
    print(f"grid {NX} x {NY} at {RES} m")
    curl_many([(f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{n}.geojson", RAW / "naturalearth" / f"{n}.geojson") for n in NE_LAYERS])
    height = build_height()

    # Land, California, neighbours
    states = [f for f in load_ne("ne_10m_admin_1_states_provinces") if f["geometry"] and bbox_hit(shape(f["geometry"]))]
    land_geoms = [proj_geom(shape(f["geometry"])) for f in states]
    ca_geom = proj_geom(shape([f for f in states if f["properties"]["name"] == "California"][0]["geometry"]))
    land = rasterize(land_geoms)
    ca = rasterize([ca_geom])
    # Smooth the coast a touch so the shoreline gradient looks bevelled, not pixelated
    land = (ndimage.gaussian_filter(land.astype(np.float32), 0.8)).clip(0, 255).astype(np.uint8)

    # Rivers (Natural Earth): the Sierra tributaries and the two trunk rivers
    wanted = {
        "Sacramento": "trunk", "San Joaquin": "trunk", "Feather": "sierra", "North Fork Feather": "sierra", "Yuba": "sierra", "North Yuba": "sierra",
        "American": "sierra", "North Fork American": "sierra", "S.  Fk.  American": "sierra", "Mokelumne": "sierra", "Stanislaus": "sierra",
        "Tuolumne": "sierra", "Merced": "sierra", "Kings": "sierra", "Kern": "sierra", "Pit": "north", "Fresno Slough": "trunk",
    }
    rivers = []
    for layer in ("ne_10m_rivers_lake_centerlines", "ne_10m_rivers_north_america"):
        for f in load_ne(layer):
            nm = f["properties"].get("name")
            if nm in wanted and f["geometry"]:
                g = shape(f["geometry"])
                if not bbox_hit(g, -124.5, -117.5, 34.5, 42.2):
                    continue
                for line in line_coords(proj_geom(g)):
                    ls = LineString(line).simplify(250)
                    pts = list(ls.coords)
                    if len(pts) < 2 or ls.length < 8000:
                        continue
                    if sample_height(height, *pts[0]) < sample_height(height, *pts[-1]):
                        pts = pts[::-1]  # orient source -> mouth
                    rivers.append({"name": nm.replace("S.  Fk.  ", "South Fork "), "kind": wanted[nm], "pts": [[round(x), round(y)] for x, y in pts]})
    print("river segments", len(rivers))

    lakes = []
    for layer in ("ne_10m_lakes", "ne_10m_lakes_north_america"):
        for f in load_ne(layer):
            nm = f["properties"].get("name")
            if nm in ("Shasta Lake", "Lake Oroville", "Millerton Lake", "Isabella Lake", "San Luis Reservoir", "Lake Berryessa", "Trinity Lake", "Lake Almanor") and f["geometry"]:
                g = proj_geom(shape(f["geometry"])).simplify(150)
                polys = g.geoms if isinstance(g, MultiPolygon) else [g]
                for p in polys:
                    lakes.append({"name": nm, "pts": [[round(x), round(y)] for x, y in p.exterior.coords]})

    cities = []
    want_c = ["Sacramento", "Stockton", "Fresno", "Bakersfield", "Redding", "Los Angeles", "Riverside", "San Francisco", "Irvine", "Visalia", "Modesto"]
    for f in load_ne("ne_10m_populated_places_simple"):
        p = f["properties"]
        if p.get("adm1name") == "California" and p["name"] in want_c:
            x, y = to_albers.transform(*f["geometry"]["coordinates"])
            cities.append({"name": p["name"], "x": round(x), "y": round(y), "lon": f["geometry"]["coordinates"][0], "lat": f["geometry"]["coordinates"][1]})

    # Watersheds from USGS WBD
    wb = wbd_geoms(["1802", "1803", "1804", "18070202", "18070203"])
    sheds = {}
    for key, codes, label in (("sacramento", ["1802"], "Sacramento"), ("sanjoaquin", ["1804"], "San Joaquin"), ("tulare", ["1803"], "Tulare Lake basin"), ("santaana", ["18070202", "18070203"], "Santa Ana River watershed")):
        g = unary_union([proj_geom(wb[c][0]).buffer(0) for c in codes]).buffer(300).buffer(-300).simplify(400)
        polys = sorted(g.geoms if isinstance(g, MultiPolygon) else [g], key=lambda p: -p.area)
        sheds[key] = {"label": label, "huc": codes, "pts": [[round(x), round(y)] for x, y in polys[0].exterior.coords]}
        print("watershed", key, [wb[c][1] for c in codes], round(polys[0].area / 1e6), "km2")

    # Santa Ana River: traced downhill on the depression-filled terrain from the San Bernardino Mountains
    sub = (slice(int((Y1 - (-280_000)) / RES), int((Y1 - (-560_000)) / RES)), slice(int((80_000 - X0) / RES), int((420_000 - X0) / RES)))
    hsub = height[sub].astype(np.float64)
    hsub = np.where(hsub < 0, -1, hsub)
    filled = priority_fill(hsub)
    sx, sy = to_albers.transform(-116.83, 34.17)  # headwaters near Big Bear
    py, px = int((Y1 - sy) / RES) - sub[0].start, int((sx - X0) / RES) - sub[1].start
    path = trace_downhill(filled, py, px)
    pts = [(X0 + (sub[1].start + x + 0.5) * RES, Y1 - (sub[0].start + y + 0.5) * RES) for y, x in path]
    # Below Prado Dam the river is channelised across a flat plain the 600 m terrain can't resolve,
    # so the trace stops at the dam and follows the real channel through known points to the mouth.
    prado = to_albers.transform(-117.643, 33.889)
    cut = int(np.argmin([math.hypot(x - prado[0], y - prado[1]) for x, y in pts]))
    lower = [(-117.643, 33.889), (-117.735, 33.862), (-117.80, 33.855), (-117.865, 33.825), (-117.885, 33.78), (-117.895, 33.74), (-117.92, 33.70), (-117.957, 33.630)]
    pts = pts[:cut] + [to_albers.transform(lo, la) for lo, la in lower]
    pts = list(LineString(pts).simplify(500).coords)
    pts = chaikin(pts, 2)
    end_ll = to_lonlat.transform(*pts[-1])
    print("Santa Ana trace ends at", [round(v, 3) for v in end_ll], "after", len(path), "cells")
    santa_ana = [[round(x), round(y)] for x, y in pts]

    # ---------------- illustrative flood arrival map (NOT a flood model)
    # Valley floor = low land connected to the valley seeds, east of the Carquinez Strait
    gx = X0 + (np.arange(NX) + 0.5) * RES
    gy = Y1 - (np.arange(NY) + 0.5) * RES
    lon_g, lat_g = to_lonlat.transform(*np.meshgrid(gx, gy))
    low = (height < 125) & (height > -20) & (land > 128) & (lon_g > -122.15)
    lab, _ = ndimage.label(low)
    seeds_ll = [(-122.0, 39.3), (-121.6, 38.6), (-121.55, 38.05), (-120.8, 37.2), (-119.75, 36.05)]
    keep = set()
    for lo, la in seeds_ll:
        x, y = to_albers.transform(lo, la)
        keep.add(lab[int((Y1 - y) / RES), int((x - X0) / RES)])
    keep.discard(0)
    valley = np.isin(lab, list(keep))
    valley = ndimage.binary_opening(valley, iterations=2)
    # Drainage: trunk rivers + Sierra rivers on the valley floor + the old Tulare lakebed
    drain = Image.new("L", (NX, NY), 0)
    dd = ImageDraw.Draw(drain)
    for r in rivers:
        if r["kind"] in ("trunk", "sierra"):
            dd.line([to_px(*p) for p in r["pts"]], fill=255, width=3)
    tx, ty = to_albers.transform(-119.78, 36.03)
    tpx, tpy = to_px(tx, ty)
    dd.ellipse((tpx - 18, tpy - 26, tpx + 18, tpy + 26), fill=255)
    drain = (np.asarray(drain) > 0) & valley
    # Height above nearest drainage, then a gentle north-to-south delay and seeded noise for organic edges
    dist, (iy, ix) = ndimage.distance_transform_edt(~drain, return_indices=True)
    hand = np.clip(height - height[iy, ix], 0, None)
    rng = np.random.default_rng(1862)
    noise = ndimage.gaussian_filter(rng.standard_normal((NY, NX)), 6)
    noise /= np.abs(noise).max()
    arrival = 0.55 * np.clip(hand / 14.0, 0, 1) + 0.30 * np.clip(dist * RES / 22_000, 0, 1) + 0.10 * noise + 0.15
    arrival = np.where(valley, np.clip(arrival, 0.02, 0.97), 1.0)
    arrival = ndimage.gaussian_filter(arrival, 1.0)
    arrival = np.where(valley, arrival, 1.0)
    flood_u8 = (arrival * 255).astype(np.uint8)
    cover_km2 = (arrival < 0.95).sum() * RES * RES / 1e6
    print(f"illustrative flood: valley floor {valley.sum() * RES * RES / 1e6:.0f} km2, final cover {cover_km2:.0f} km2")

    lake_mask = rasterize([Polygon(l["pts"]) for l in lakes])
    # Extra layers: R = Delta levees (edge of the below-sea-level islands), G = ocean distance from shore,
    # B = valley floor (soft)
    delta_box = (lon_g > -121.95) & (lon_g < -121.2) & (lat_g > 37.75) & (lat_g < 38.45)
    below = (height < 0.5) & (land > 128) & delta_box
    # Smooth the island outlines and drop specks so the levee rings read as clean shapes
    below = ndimage.gaussian_filter(below.astype(np.float32), 1.6) > 0.5
    lab_b, nb = ndimage.label(below)
    sizes = ndimage.sum(below, lab_b, range(1, nb + 1))
    below = np.isin(lab_b, [i + 1 for i, sz in enumerate(sizes) if sz >= 40])
    edge = below & ~ndimage.binary_erosion(below, iterations=1)
    levee = np.clip(1 - ndimage.distance_transform_edt(~edge) / 1.6, 0, 1)
    ocean_dist = ndimage.distance_transform_edt(land < 128) * RES / 1000
    shore = np.clip(ocean_dist / 80, 0, 1)
    valley_soft = ndimage.gaussian_filter(valley.astype(np.float32), 2.0)
    ca_soft = ndimage.gaussian_filter((ca > 128).astype(np.float32), 1.2)
    extra = np.dstack([(levee * 255), (shore * 255), (valley_soft * 255)]).astype(np.uint8)
    Image.fromarray(extra).save(BUILD / "ca_extra.png")
    print("delta levee cells", int(edge.sum()))
    # Note: no data in alpha channels; browsers may zero colour where alpha is 0.
    masks = np.dstack([land, (ca_soft * 255).astype(np.uint8), flood_u8])
    Image.fromarray(lake_mask).save(BUILD / "ca_lakes.png")
    Image.fromarray(masks).save(BUILD / "ca_masks.png")
    np.clip(np.round(height), -32000, 32000).astype("<i2").tofile(BUILD / "ca_height.i16")
    meta = {"crs": "EPSG:3310 (NAD83 / California Albers)", "x0": X0, "x1": X1, "y0": Y0, "y1": Y1, "res": RES, "nx": NX, "ny": NY,
            "minH": float(height.min()), "maxH": float(height.max()), "note": "row 0 = north edge (y1)",
            # Flood mask thresholds: patches appear at floodStart; floodEnd covers ~17,000 km2, close to the
            # USGS ARkStorm scenario's "300 miles long and 20 or more miles wide" (~15,500 km2).
            "floodStart": 0.12, "floodEnd": 0.37}
    (BUILD / "ca_meta.json").write_text(json.dumps(meta, indent=1))
    ca_poly = max(ca_geom.geoms, key=lambda p: p.area) if isinstance(ca_geom, MultiPolygon) else ca_geom
    vectors = {"rivers": rivers, "lakes": lakes, "cities": cities, "watersheds": sheds, "santaAnaRiver": santa_ana,
               "california": [[round(x), round(y)] for x, y in ca_poly.simplify(800).exterior.coords]}
    (BUILD / "ca_vectors.json").write_text(json.dumps(vectors))
    print("wrote", [p.name for p in BUILD.iterdir()])

    # ---------------- globe land mask (equirectangular, Natural Earth 1:50m)
    W, H = 4096, 2048
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for f in load_ne("ne_50m_land"):
        g = shape(f["geometry"])
        for p in g.geoms if isinstance(g, MultiPolygon) else [g]:
            d.polygon([((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in p.exterior.coords], fill=255)
    for f in load_ne("ne_10m_lakes"):
        if f["properties"].get("scalerank", 9) <= 1:
            g = shape(f["geometry"])
            for p in g.geoms if isinstance(g, MultiPolygon) else [g]:
                d.polygon([((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in p.exterior.coords], fill=0)
    ca_img = Image.new("L", (W, H), 0)
    dc = ImageDraw.Draw(ca_img)
    ca_ll = shape([f for f in states if f["properties"]["name"] == "California"][0]["geometry"])
    for p in ca_ll.geoms if isinstance(ca_ll, MultiPolygon) else [ca_ll]:
        dc.polygon([((x + 180) / 360 * W, (90 - y) / 180 * H) for x, y in p.exterior.coords], fill=255)
    Image.merge("RGB", (img, ca_img, Image.new("L", (W, H), 0))).save(BUILD / "globe_land.png")


if __name__ == "__main__":
    main()
