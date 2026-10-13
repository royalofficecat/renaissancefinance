"""Builds the Utah map data for "What if it rained in Utah for 30 days?".

Inputs (downloaded into data/raw/, not in git):
  - Terrain Tiles on AWS (Terrarium PNG, zoom 9): elevation from USGS 3DEP / SRTM / NOAA ETOPO1
  - Natural Earth 1:10m GeoJSON: states, rivers, lakes, cities
  - USGS Watershed Boundary Dataset, regions 14, 15 (Colorado River) and 16 (Great Basin): HU2 outlines

Outputs (data/build/), all on a NAD83 / UTM zone 12N (EPSG:26912) grid, 400 m cells, row 0 = north:
  - ut_height.i16 + ut_meta.json   heights in metres
  - ut_masks.png   R = Utah (hard), G = Utah (soft edge), B = Great Basin (soft edge)
  - ut_water.png   R = lakes today, G = imagined Great Salt Lake growth (0 = water now ... 1 = last to flood,
                   only the low ground the lake could actually reach), B = ponding depth in closed depressions
  - ut_flow.png    R = flow accumulation (log, for runoff threads), G = southern-Utah greening potential
  - ut_vectors.json  state outline, neighbours, rivers, lakes, cities, drainage divide, flow arrows (traced
                   downhill on the real terrain: Colorado arrows leave the map, Great Basin arrows end inland)

Run:  .venv/bin/python data/prep_utah.py
"""

import heapq
import json
import math
import pathlib
import sqlite3
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
from scipy import ndimage
from shapely import wkb
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon, shape
from shapely.ops import transform as shp_transform, unary_union

from prep_map import BUILD, RAW, chaikin, curl_many, load_ne

X0, X1, Y0, Y1, RES = 160_000, 740_000, 4_030_000, 4_720_000, 400
NX, NY = (X1 - X0) // RES, (Y1 - Y0) // RES
to_utm = Transformer.from_crs("EPSG:4326", "EPSG:26912", always_xy=True)
to_ll = Transformer.from_crs("EPSG:26912", "EPSG:4326", always_xy=True)
GSL_LEVEL = 1279.0  # metres: an ordinary recent Great Salt Lake surface (about 4,196 ft), the start of the imagined rise
GSL_RISE = 6.0  # metres of imagined rise used to order the flooding (illustrative, never shown as a number)


def proj(g):
    return shp_transform(lambda x, y, z=None: to_utm.transform(x, y), g)


def to_px(x, y):
    return (x - X0) / RES, (Y1 - y) / RES


def rasterize(geoms, value=255):
    img = Image.new("L", (NX, NY), 0)
    d = ImageDraw.Draw(img)
    for g in geoms:
        for p in (g.geoms if isinstance(g, MultiPolygon) else [g]):
            d.polygon([to_px(*c) for c in p.exterior.coords], fill=value)
            for hole in p.interiors:
                d.polygon([to_px(*c) for c in hole.coords], fill=0)
    return np.asarray(img)


def build_height(z=9):
    gx, gy = np.meshgrid(X0 + (np.arange(NX) + 0.5) * RES, Y1 - (np.arange(NY) + 0.5) * RES)
    lon, lat = to_ll.transform(gx, gy)
    n = 2**z
    tx = (lon + 180) / 360 * n
    ty = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n
    xs, ys = range(int(tx.min()), int(tx.max()) + 1), range(int(ty.min()), int(ty.max()) + 1)
    curl_many([(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", RAW / f"terrarium/{z}/{x}/{y}.png") for x in xs for y in ys])
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
    for x in xs:
        for y in ys:
            a = np.asarray(Image.open(RAW / f"terrarium/{z}/{x}/{y}.png").convert("RGB")).astype(np.float32)
            mosaic[(y - ys[0]) * 256 : (y - ys[0] + 1) * 256, (x - xs[0]) * 256 : (x - xs[0] + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    return ndimage.map_coordinates(mosaic, [(ty - ys[0]) * 256 - 0.5, (tx - xs[0]) * 256 - 0.5], order=1, mode="nearest").astype(np.float32)


def hu2(region):
    """The HU2 outline of a WBD region (USGS GeoPackage), in lon/lat."""
    zpath = RAW / "wbd" / f"WBD_{region}_HU2_GPKG.zip"
    curl_many([(f"https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/HU2/GPKG/WBD_{region}_HU2_GPKG.zip", zpath)])
    gpkg = RAW / "wbd" / f"WBD_{region}_HU2_GPKG.gpkg"
    if not gpkg.exists():
        with zipfile.ZipFile(zpath) as zf:
            gpkg.write_bytes(zf.read([n for n in zf.namelist() if n.endswith(".gpkg")][0]))
    con = sqlite3.connect(gpkg)
    cols = [r[1] for r in con.execute("PRAGMA table_info(WBDHU2)")]
    gcol = [c for c in cols if c.lower() in ("shape", "geom", "geometry")][0]
    blob = con.execute(f"SELECT {gcol} FROM WBDHU2").fetchone()[0]
    env_len = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(blob[3] >> 1) & 7]
    return wkb.loads(bytes(blob[8 + env_len :]))


def priority_fill(h, seeds, wall):
    """Priority-flood fill from seed cells; `wall` cells are never entered. Returns filled heights (inf = unreached)."""
    filled = np.full(h.shape, np.inf, np.float32)
    heap = []
    for y, x in zip(*np.nonzero(seeds)):
        filled[y, x] = h[y, x]
        heap.append((float(h[y, x]), int(y), int(x)))
    heapq.heapify(heap)
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    ny, nx = h.shape
    while heap:
        z, y, x = heapq.heappop(heap)
        for dy, dx in nb:
            yy, xx = y + dy, x + dx
            if 0 <= yy < ny and 0 <= xx < nx and filled[yy, xx] == np.inf and not wall[yy, xx]:
                filled[yy, xx] = max(h[yy, xx], z + 1e-3)
                heapq.heappush(heap, (float(filled[yy, xx]), yy, xx))
    return filled


def d8_receivers(filled):
    """Steepest-descent neighbour of every cell on a filled surface (-1 = outlet / sink)."""
    ny, nx = filled.shape
    best = np.zeros(filled.shape, np.float32)
    rec = np.full(filled.shape, -1, np.int64)
    idx = np.arange(ny * nx).reshape(ny, nx)
    for dy, dx in [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]:
        sh = np.full(filled.shape, np.inf, np.float32)
        ys, yd = (slice(max(0, -dy), ny - max(0, dy)), slice(max(0, dy), ny - max(0, -dy)))
        xs, xd = (slice(max(0, -dx), nx - max(0, dx)), slice(max(0, dx), nx - max(0, -dx)))
        sh[ys, xs] = filled[yd, xd]
        drop = (filled - sh) / math.hypot(dy, dx)
        drop[~np.isfinite(drop)] = -1
        tgt = np.full(filled.shape, -1, np.int64)
        tgt[ys, xs] = idx[yd, xd]
        better = drop > best
        best[better] = drop[better]
        rec[better] = tgt[better]
    return rec


def accumulate(filled, rec):
    order = np.argsort(-np.where(np.isfinite(filled), filled, -1e9), axis=None)
    acc = np.ones(filled.size, np.float32)
    r = rec.ravel()
    for i in order:
        j = r[i]
        if j >= 0:
            acc[j] += acc[i]
    return acc.reshape(filled.shape)


def trace(rec, y, x, max_steps=3000):
    path = [(y, x)]
    i = y * NX + x
    r = rec.ravel()
    for _ in range(max_steps):
        j = r[i]
        if j < 0:
            break
        i = j
        path.append(divmod(i, NX))
    return path


def lines_of(g):
    if g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    return [x for x in getattr(g, "geoms", []) if isinstance(x, LineString)]


def main():
    (RAW / "wbd").mkdir(parents=True, exist_ok=True)
    meta = {"crs": "EPSG:26912 (NAD83 / UTM zone 12N)", "x0": X0, "x1": X1, "y0": Y0, "y1": Y1, "res": RES, "nx": NX, "ny": NY, "note": "row 0 = north edge (y1)"}
    print(f"grid {NX} x {NY}")
    h = build_height()
    meta.update(minH=float(h.min()), maxH=float(h.max()))
    h.round().astype(np.int16).tofile(BUILD / "ut_height.i16")

    states = {f["properties"]["name"]: shape(f["geometry"]) for f in load_ne("ne_10m_admin_1_states_provinces") if f["properties"].get("name") in ("Utah", "Nevada", "Idaho", "Wyoming", "Colorado", "Arizona", "New Mexico")}
    utah = proj(states["Utah"])
    ut = rasterize([utah]) > 127
    ut_soft = ndimage.gaussian_filter(ut.astype(np.float32), 1.2)
    gb_ll = hu2("16")
    gb = rasterize([proj(gb_ll)]) > 127
    gb_soft = ndimage.gaussian_filter(gb.astype(np.float32), 1.2)
    co = rasterize([proj(hu2("14")), proj(hu2("15"))]) > 127
    Image.merge("RGB", [Image.fromarray((ut * 255).astype(np.uint8)), Image.fromarray((ut_soft * 255).astype(np.uint8)), Image.fromarray((gb_soft * 255).astype(np.uint8))]).save(BUILD / "ut_masks.png")

    # lakes today (Natural Earth): Great Salt Lake, Utah Lake, Lake Powell, Bear Lake, Flaming Gorge ...
    lakes, lake_out = [], []
    for layer in ("ne_10m_lakes", "ne_10m_lakes_north_america"):
        for f in load_ne(layer):
            g = shape(f["geometry"])
            b = g.bounds
            if b[2] < -114.8 or b[0] > -108.3 or b[3] < 36.6 or b[1] > 42.6:
                continue
            gp = proj(g)
            lakes.append(gp)
            name = f["properties"].get("name") or ""
            for p in (gp.geoms if isinstance(gp, MultiPolygon) else [gp]):
                if p.area > 4e6:
                    lake_out.append({"name": name, "pts": [[round(x), round(y)] for x, y in p.simplify(300).exterior.coords]})
    lake = rasterize(lakes) > 127
    gsl_ll = Point(-112.5, 41.1)
    gsl_poly = next(l for l in lakes if l.buffer(0).contains(Point(*to_utm.transform(gsl_ll.x, gsl_ll.y))))
    gsl = rasterize([gsl_poly]) > 127

    # imagined Great Salt Lake growth: low ground connected to today's lake, flooded in order of height
    reach = (h <= GSL_LEVEL + GSL_RISE) & gb
    lab, _ = ndimage.label(reach | gsl)
    keep = np.unique(lab[gsl & (lab > 0)])
    grow = np.isin(lab, keep) & ~gsl
    arrival = np.ones(h.shape, np.float32)
    arrival[grow] = np.clip((h[grow] - GSL_LEVEL) / GSL_RISE, 0.02, 1.0)
    arrival[gsl] = 0.0
    print(f"imagined lake growth area: {grow.sum() * RES * RES / 2.59e6:.0f} sq mi on top of {gsl.sum() * RES * RES / 2.59e6:.0f} sq mi")

    # Great Basin: fill from its own terminal sinks; Colorado side: fill from the map edges inside the basin
    edge = np.zeros(h.shape, bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    hs = ndimage.gaussian_filter(h, 0.7)
    sinks_gb = gsl | (lake & gb)
    # any closed depression deeper than 25 m in the Great Basin is a terminal sink (Sevier Lake, the salt flats, playas)
    fill_all = priority_fill(hs, edge | sinks_gb, np.zeros(h.shape, bool))
    deep = gb & ((fill_all - hs) > 25)
    lab2, n2 = ndimage.label(deep)
    if n2:
        mins = ndimage.minimum_position(hs, lab2, range(1, n2 + 1))
        for (yy, xx) in mins:
            sinks_gb[yy, xx] = True
    filled_gb = priority_fill(hs, sinks_gb | (edge & gb), ~gb)
    filled_co = priority_fill(hs, edge & ~gb, gb)
    filled = np.where(gb, filled_gb, filled_co)
    filled[~np.isfinite(filled)] = hs[~np.isfinite(filled)]
    pond = np.clip((fill_all - hs) / 40, 0, 1) * gb  # where water would stand in closed basins
    rec = d8_receivers(filled)
    acc = accumulate(filled, rec)
    accn = np.clip(np.log10(acc) / math.log10(acc.max()), 0, 1)
    # greening potential: southern / eastern Utah valleys and washes (moderate slopes, some flow)
    gy_, gx_ = np.gradient(h, RES)
    slope = np.hypot(gx_, gy_)
    green = np.clip(accn * 1.6 - 0.35, 0, 1) * (1 - np.clip(slope / 0.35, 0, 1)) * ut * (~gb | (h > 1500))
    green = ndimage.gaussian_filter(green, 1.0)
    Image.merge("RGB", [Image.fromarray((lake * 255).astype(np.uint8)), Image.fromarray((arrival * 255).astype(np.uint8)), Image.fromarray((pond * 255).astype(np.uint8))]).save(BUILD / "ut_water.png")
    Image.merge("RGB", [Image.fromarray((accn * 255).astype(np.uint8)), Image.fromarray((np.clip(green, 0, 1) * 255).astype(np.uint8)), Image.new("L", (NX, NY), 0)]).save(BUILD / "ut_flow.png")

    # flow arrows: start on a jittered grid inside Utah, follow the receivers for a stretch
    rnd = np.random.default_rng(30)
    arrows = []
    for yy in range(12, NY - 12, 46):
        for xx in range(12, NX - 12, 46):
            y, x = yy + rnd.integers(-12, 13), xx + rnd.integers(-12, 13)
            if not ut[y, x] or lake[y, x]:
                continue
            path = trace(rec, y, x, 900)
            if len(path) < 25:
                continue
            pts = [[round(X0 + (px + 0.5) * RES), round(Y1 - (py + 0.5) * RES)] for py, px in path[::3]]
            end_y, end_x = path[-1]
            arrows.append({"basin": "gb" if gb[y, x] else "co", "ends": "inland" if gb[y, x] else "downstream", "pts": [list(p) for p in chaikin([tuple(p) for p in pts], 2)][::2]})
    print(f"flow arrows: {len(arrows)} ({sum(a['basin'] == 'gb' for a in arrows)} Great Basin)")

    # drainage divide inside the map: the Great Basin boundary where it meets the Colorado basin
    gbp = proj(gb_ll)
    frame = Polygon([(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)]).buffer(-2000)
    divide = []
    for l in lines_of(gbp.boundary.intersection(frame).intersection(utah.buffer(20000))):
        l = l.simplify(500)
        if l.length > 5000:
            divide.append([[round(x), round(y)] for x, y in l.coords])

    rivers = []
    wanted = ("Colorado", "Green", "San Juan", "Virgin", "Bear", "Weber", "Jordan", "Sevier", "Provo", "Dirty Devil", "Escalante", "Price", "Duchesne", "White", "Fremont")
    for layer in ("ne_10m_rivers_lake_centerlines", "ne_10m_rivers_north_america"):
        for f in load_ne(layer):
            name = f["properties"].get("name") or ""
            if not any(w == name or name.startswith(w + " ") for w in wanted) or not f["geometry"]:
                continue
            g = proj(shape(f["geometry"])).intersection(frame)
            for l in lines_of(g) + [x for m in getattr(g, "geoms", []) if isinstance(m, MultiLineString) for x in m.geoms]:
                if l.length > 4000:
                    rivers.append({"name": name, "pts": [[round(x), round(y)] for x, y in l.simplify(250).coords]})
    print(f"rivers: {len(rivers)}")

    cities = []
    for f in load_ne("ne_10m_populated_places_simple"):
        p = f["properties"]
        if p.get("name") in ("Salt Lake City",) and p.get("adm1name") == "Utah":
            x, y = to_utm.transform(p["longitude"], p["latitude"])
            cities.append({"name": p["name"], "x": round(x), "y": round(y), "lon": p["longitude"], "lat": p["latitude"]})
    nb = []
    for name, g in states.items():
        if name == "Utah":
            continue
        gp = proj(g).intersection(frame.buffer(40000))
        for p in (gp.geoms if isinstance(gp, MultiPolygon) else [gp]):
            if not p.is_empty and p.area > 1e6:
                nb.append({"name": name, "pts": [[round(x), round(y)] for x, y in p.exterior.simplify(500).coords]})
    out = {"crs": "EPSG:26912", "utah": [[round(x), round(y)] for x, y in utah.exterior.simplify(200).coords], "neighbours": nb, "lakes": lake_out,
           "rivers": rivers, "cities": cities, "divide": divide, "arrows": arrows}
    (BUILD / "ut_vectors.json").write_text(json.dumps(out, separators=(",", ":")))
    (BUILD / "ut_meta.json").write_text(json.dumps(meta, indent=1))
    print("done")


if __name__ == "__main__":
    main()
