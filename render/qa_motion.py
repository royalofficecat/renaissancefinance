"""Motion check: looks for flicker, popping or camera snaps in the rendered frames.

For each frame we measure how much the 3d image changes from the previous frame (mean absolute
difference on a small greyscale copy). Smooth motion changes gradually; a snap or pop shows up as a
spike far above its neighbours. Spikes during a cloud-bank wipe (where the cut is hidden) are expected.

Usage: python3 render/qa_motion.py out/frames
"""

import json
import pathlib
import sys

import numpy as np
from PIL import Image

frames = sorted(pathlib.Path(sys.argv[1]).glob("f[0-9][0-9][0-9][0-9].png"))
CUTS = [228, 300, 420, 660, 1320, 1440, 1620]
prev, diffs = None, []
for f in frames:
    # Look only at the middle band (the 3d scene), not at the text panels
    im = np.asarray(Image.open(f).convert("L").crop((0, 560, 1080, 1260)).resize((270, 175)), dtype=np.float32)
    diffs.append(0.0 if prev is None else float(np.mean(np.abs(im - prev))))
    prev = im
d = np.array(diffs)
spikes = []
for i in range(2, len(d) - 2):
    local = np.median(np.r_[d[i - 6 : i - 1], d[i + 2 : i + 7]]) if i > 6 else np.median(d[max(1, i - 3) : i + 4])
    near_cut = any(abs(i - c) <= 16 for c in CUTS)
    if d[i] > max(4.0, local * 3.5) and not near_cut:
        spikes.append({"frame": i, "diff": round(d[i], 2), "local": round(float(local), 2)})
report = {"frames": len(d), "mean_change": round(float(d[1:].mean()), 3), "max_change_outside_cuts": round(float(max([d[i] for i in range(1, len(d)) if not any(abs(i - c) <= 16 for c in CUTS)] or [0])), 2), "spikes": spikes}
pathlib.Path(sys.argv[1]).joinpath("motion.json").write_text(json.dumps(report, indent=1))
print(json.dumps(report, indent=1))
sys.exit(1 if spikes else 0)
