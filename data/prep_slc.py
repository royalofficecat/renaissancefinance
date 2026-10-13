"""Builds the Salt Lake City diorama data: real terrain under the city and the drainage it hides.

Inputs: Terrain Tiles on AWS (Terrarium PNG, zoom 13; USGS 3DEP) - downloaded into data/raw/.
Outputs (data/build/), on a NAD83 / UTM zone 12N grid, 30 m cells, row 0 = north:
  - slc_height.f32 + slc_meta.json   heights in metres (9 km x 9 km around downtown and the foothills)
  - slc_flow.png    R = flow accumulation (log; the natural creeks the streets hide), G = low ground that ponds
Run:  .venv/bin/python data/prep_slc.py   (after data/prep_utah.py)
"""

import json
import math

import numpy as np
from PIL import Image
from scipy import ndimage

from prep_map import BUILD, RAW, curl_many
from prep_utah import accumulate, d8_receivers, priority_fill, to_ll, to_utm

CX, CY = to_utm.transform(-111.872, 40.772)  # downtown Salt Lake City, nudged east to take in the foothills
HALF, RES = 4500, 30
N = 2 * HALF // RES


def main():
    x0, y1 = CX - HALF, CY + HALF
    gx, gy = np.meshgrid(x0 + (np.arange(N) + 0.5) * RES, y1 - (np.arange(N) + 0.5) * RES)
    lon, lat = to_ll.transform(gx, gy)
    z = 13
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
    h = ndimage.map_coordinates(mosaic, [(ty - ys[0]) * 256 - 0.5, (tx - xs[0]) * 256 - 0.5], order=1, mode="nearest").astype(np.float32)
    h = ndimage.gaussian_filter(h, 0.8)
    h.tofile(BUILD / "slc_height.f32")
    edge = np.zeros(h.shape, bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    filled = priority_fill(h, edge, np.zeros(h.shape, bool))
    rec = d8_receivers(filled)
    acc = accumulate(filled, rec)
    accn = np.clip(np.log10(acc) / math.log10(acc.max()), 0, 1)
    pond = np.clip((filled - h) / 3.0, 0, 1)
    # low ground: the lowest third of the valley floor, where water would gather on the streets
    low = np.clip((np.percentile(h, 35) - h) / 25 + 0.5, 0, 1)
    Image.merge("RGB", [Image.fromarray((accn * 255).astype(np.uint8)), Image.fromarray((np.maximum(pond, low * 0.6) * 255).astype(np.uint8)), Image.new("L", (N, N), 0)]).save(BUILD / "slc_flow.png")
    meta = {"crs": "EPSG:26912", "cx": CX, "cy": CY, "half": HALF, "res": RES, "n": N, "minH": float(h.min()), "maxH": float(h.max())}
    (BUILD / "slc_meta.json").write_text(json.dumps(meta, indent=1))
    print(meta)


if __name__ == "__main__":
    main()
