"""Builds the Shasta Lake close-up terrain (beat 3).

Elevation models store a reservoir as a flat surface, so to show the shoreline climbing we carve
a plausible bowl under that surface (deeper further from shore). The carved lakebed is a visual
device, not survey data; everything above the water line is real USGS 3DEP terrain.

Outputs (data/build/):
  shasta_height.f32  carved heights in metres, row 0 = north
  shasta_basin.png   255 where water may appear (the reservoir basin, upstream of the dam)
  shasta_meta.json   grid, levels, dam position

Run:  .venv/bin/python data/prep_shasta.py
"""

import json
import math
import pathlib
import subprocess

import numpy as np
from PIL import Image
from pyproj import Transformer
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent
RAW, BUILD = ROOT / "raw", ROOT / "build"
BUILD.mkdir(exist_ok=True)

LON0, LON1, LAT0, LAT1 = -122.53, -122.15, 40.685, 40.955
RES = 40  # metres
DAM = (-122.4189, 40.7185)
SEED = (-122.38, 40.775)  # open water in the Sacramento arm
FULL_POOL = 325.2  # 1,067 ft, USBR

to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32610", always_xy=True)
to_ll = Transformer.from_crs("EPSG:32610", "EPSG:4326", always_xy=True)


def main():
    z = 12
    (ux0, uy0), (ux1, uy1) = to_utm.transform(LON0, LAT0), to_utm.transform(LON1, LAT1)
    nx, ny = int((ux1 - ux0) / RES), int((uy1 - uy0) / RES)
    gx, gy = np.meshgrid(ux0 + (np.arange(nx) + 0.5) * RES, uy1 - (np.arange(ny) + 0.5) * RES)
    lon, lat = to_ll.transform(gx, gy)
    n = 2**z
    tx = (lon + 180) / 360 * n
    ty = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n
    xs, ys = range(int(tx.min()), int(tx.max()) + 1), range(int(ty.min()), int(ty.max()) + 1)
    jobs = [(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", RAW / f"terrarium/{z}/{x}/{y}.png") for x in xs for y in ys]
    for u, p in jobs:
        p.parent.mkdir(parents=True, exist_ok=True)
    procs = [subprocess.Popen(["curl", "-sS", "--fail", "--retry", "3", "-o", str(p), u]) for u, p in jobs if not p.exists()]
    for pr in procs:
        pr.wait()
    mosaic = np.zeros((len(ys) * 256, len(xs) * 256), np.float32)
    for x in xs:
        for y in ys:
            a = np.asarray(Image.open(RAW / f"terrarium/{z}/{x}/{y}.png").convert("RGB")).astype(np.float32)
            mosaic[(y - ys[0]) * 256 : (y - ys[0] + 1) * 256, (x - xs[0]) * 256 : (x - xs[0] + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    h = ndimage.map_coordinates(mosaic, [(ty - ys[0]) * 256 - 0.5, (tx - xs[0]) * 256 - 0.5], order=1, mode="nearest").astype(np.float32)

    def cell(lonlat):
        x, y = to_utm.transform(*lonlat)
        return int((uy1 - y) / RES), int((x - ux0) / RES)

    sy, sx = cell(SEED)
    z0 = float(np.median(h[sy - 2 : sy + 3, sx - 2 : sx + 3]))
    # The dam: find the shortest line through the dam point between ground higher than the crest
    dy, dx = cell(DAM)
    best = None
    for ang in range(0, 180, 3):
        a = math.radians(ang)
        ends = []
        for sgn in (1, -1):
            t = 0
            while True:
                t += 0.5
                yy, xx = int(round(dy - sgn * t * math.sin(a))), int(round(dx + sgn * t * math.cos(a)))
                if not (0 <= yy < ny and 0 <= xx < nx) or h[yy, xx] > FULL_POOL + 8 or t > 60:
                    break
            ends.append((yy, xx, t))
        length = ends[0][2] + ends[1][2]
        if best is None or length < best[0]:
            best = (length, ends)
    (_, ((ay, ax, _), (by, bx, _))) = best
    # Impose the dam crest as a barrier so water can't leak downstream
    barrier = np.zeros_like(h, bool)
    for t in np.linspace(0, 1, 200):
        barrier[int(round(ay + (by - ay) * t)), int(round(ax + (bx - ax) * t))] = True
    barrier = ndimage.binary_dilation(barrier, iterations=1)
    h = np.where(barrier, np.maximum(h, FULL_POOL + 3), h)

    flat = np.abs(h - z0) < 1.2
    lab, _ = ndimage.label(flat)
    lake = lab == lab[sy, sx]
    lake = ndimage.binary_closing(lake, iterations=1) & ~barrier
    dist = ndimage.distance_transform_edt(lake) * RES
    depth = 130 * (1 - np.exp(-dist / 1300)) + 3
    h = np.where(lake, z0 - depth, h)
    h = ndimage.gaussian_filter(h, 0.6) * lake + h * ~lake

    # Basin: everything below full pool + 2 m that's connected to the lake without crossing the dam
    lab2, _ = ndimage.label((h < max(FULL_POOL, z0) + 2) & ~barrier)
    basin = lab2 == lab2[sy, sx]
    print(f"grid {nx}x{ny} @ {RES} m, DEM lake surface {z0:.1f} m, lake cells {lake.sum()}, basin cells {basin.sum()}")
    print("dam cells", (ay, ax), (by, bx))

    h.astype("<f4").tofile(BUILD / "shasta_height.f32")
    Image.fromarray((basin * 255).astype(np.uint8)).save(BUILD / "shasta_basin.png")
    meta = {"crs": "EPSG:32610 (UTM 10N)", "nx": nx, "ny": ny, "res": RES, "surface": z0, "fullPool": FULL_POOL,
            "levelLow": z0 - 32, "levelHigh": max(FULL_POOL, z0) + 0.5,
            "dam": [[ax, ay], [bx, by]], "damCrest": FULL_POOL + 3,
            "labels": {"lake": list(cell((-122.33, 40.80)))[::-1], "dam": [dx, dy]},
            "note": "lakebed below the DEM water surface is carved for illustration"}
    (BUILD / "shasta_meta.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
