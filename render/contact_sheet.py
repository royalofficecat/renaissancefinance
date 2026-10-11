"""Builds a labelled contact sheet from rendered stills (timestamp under each frame).

Usage: python3 render/contact_sheet.py <frames_dir> <out.png> [--cols 7] [--title "..."] [--only f0012,f0300]
Frame files are named fNNNN.png (or fNNNN_safe.png) where NNNN is the frame number at 30 fps.
"""

import argparse
import json
import pathlib
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = ROOT / "scene" / "fonts"
BEATS = json.loads((ROOT / "scene" / "beats.json").read_text())


def font(style, size):
    return ImageFont.truetype(str(FONT / f"LiberationSerif-{style}.ttf"), size)


def beat_for(frame):
    for b in BEATS["beats"]:
        if b["start"] <= frame < b["end"]:
            return b
    return BEATS["beats"][-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir")
    ap.add_argument("out")
    ap.add_argument("--cols", type=int, default=7)
    ap.add_argument("--title", default="Contact sheet")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    files = sorted(pathlib.Path(a.frames_dir).glob("f*.png"))
    if a.only:
        keep = set(a.only.split(","))
        files = [f for f in files if f.stem.split("_")[0] in keep]
    tw, th = 300, 533
    pad, lab = 18, 74
    cols = min(a.cols, len(files))
    rows = (len(files) + cols - 1) // cols
    W = pad + cols * (tw + pad)
    H = 96 + rows * (th + lab + pad) + pad
    sheet = Image.new("RGB", (W, H), "#12110F")
    d = ImageDraw.Draw(sheet)
    d.text((pad, 24), a.title, font=font("Bold", 40), fill="#F4F1EA")
    for i, f in enumerate(files):
        n = int(re.match(r"f(\d+)", f.stem).group(1))
        r, c = divmod(i, cols)
        x, y = pad + c * (tw + pad), 96 + r * (th + lab + pad)
        im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (x, y))
        d.rectangle((x - 1, y - 1, x + tw, y + th), outline="#4A4540")
        s = n / BEATS["fps"]
        b = beat_for(n)
        d.text((x, y + th + 8), f"{int(s // 60)}:{s % 60:05.2f}  ·  frame {n}", font=font("Regular", 24), fill="#F4F1EA")
        d.text((x, y + th + 38), f"beat {b['id']} · {b['point']}"[:34], font=font("Italic", 21), fill="#BFB8AC")
    sheet.save(a.out)
    print("wrote", a.out, sheet.size)


if __name__ == "__main__":
    main()
