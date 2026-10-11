"""Draws docs/style-sheet.png: palette swatches, type scale and a sample caption panel.

Run:  python3 render/make_style_sheet.py
"""

import json
import pathlib

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "scene" / "fonts"
PAL = json.loads((ROOT / "scene" / "palette.json").read_text())

W, H = 1800, 1240
BG = "#12110F"
TEXT = PAL["text"]["text"]["hex"]
SECOND = PAL["text"]["secondary"]["hex"]
EDGE = PAL["text"]["panelEdge"]["hex"]


def font(style, size):
    return ImageFont.truetype(str(FONTS / f"LiberationSerif-{style}.ttf"), size)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

d.text((60, 46), "Style sheet — “What if California got 30 days of extreme rain?”", font=font("Bold", 44), fill=TEXT)
d.text((60, 104), "Scene colours carry the story; text and panels stay neutral.", font=font("Italic", 28), fill=SECOND)


def swatch_row(y, title, entries):
    d.text((60, y), title, font=font("Bold", 30), fill=TEXT)
    x = 60
    for e in entries:
        d.rounded_rectangle((x, y + 50, x + 300, y + 200), radius=18, fill=e["hex"], outline=EDGE, width=2)
        d.text((x, y + 214), e["name"], font=font("Bold", 26), fill=TEXT)
        d.text((x, y + 248), e["hex"] + (f" · {int(e['opacity']*100)}%" if "opacity" in e else ""), font=font("Regular", 24), fill=SECOND)
        d.text((x, y + 280), e["role"], font=font("Italic", 22), fill=SECOND)
        x += 340


scene = PAL["scene"]
swatch_row(
    160,
    "Scene colours (3d world only)",
    [
        {**scene["background"], "role": "Background · water tint below"},
        {**scene["subject"], "role": "Main subject: land, clouds"},
        {**scene["accent"], "role": "Accent: warnings only"},
        {**scene["highlight"], "role": "Highlight: recovery"},
        {**scene["water"], "name": "Water (tint)", "role": "Lifted deep blue"},
    ],
)
t = PAL["text"]
swatch_row(
    500,
    "Neutral text colours (all text, panels, legends)",
    [
        {**t["text"], "role": "Titles, captions, numbers"},
        {**t["secondary"], "role": "Labels, asides, legends"},
        {**t["panelFill"], "role": "Panel fill + 18 px blur"},
        {**t["panelEdge"], "role": "Panel edge, label halo"},
        {**t["endCard"], "role": "End-card background"},
    ],
)

# Type scale
y = 850
d.text((60, y), "Type: Times New Roman stand-in (Liberation Serif, metric-matched)", font=font("Bold", 30), fill=TEXT)
d.text((60, y + 52), "Title · Bold 80", font=font("Bold", 80), fill=TEXT)
d.text((60, y + 150), "Caption · Regular 52 with the key number in bold", font=font("Regular", 52), fill=TEXT)
d.text((60, y + 222), "Stat label · Italic 30    Map label · Regular 30    Water name · Italic 30", font=font("Italic", 30), fill=SECOND)
d.text((60, y + 270), "Stat number · Regular 72 · tabular figures:", font=font("Regular", 30), fill=SECOND)
d.text((640, y + 245), "1,600 miles", font=font("Regular", 72), fill=TEXT)

# Sample caption panel over a busy gradient, to show legibility
px, py, pw, ph = 1180, 840, 560, 340
bg = Image.new("RGB", (pw, ph))
bd = ImageDraw.Draw(bg)
for i in range(ph):
    k = i / ph
    c = tuple(int(a * (1 - k) + b * k) for a, b in zip(rgb(scene["water"]["hex"]), rgb(scene["subject"]["hex"])))
    bd.line([(0, i), (pw, i)], fill=c)
for j in range(0, pw, 46):
    bd.ellipse((j, 40 + (j * 7) % 200, j + 70, 110 + (j * 7) % 200), fill=rgb(scene["highlight"]["hex"]))
bd.rectangle((0, 250, pw, ph), fill=rgb(scene["accent"]["hex"]))
img.paste(bg, (px, py))
region = img.crop((px + 30, py + 60, px + pw - 30, py + ph - 60)).filter(ImageFilter.GaussianBlur(18))
panel = Image.new("RGBA", region.size, rgb(t["panelFill"]["hex"]) + (int(255 * t["panelFill"]["opacity"]),))
region = Image.alpha_composite(region.convert("RGBA"), panel).convert("RGB")
mask = Image.new("L", region.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, *region.size), radius=26, fill=255)
img.paste(region, (px + 30, py + 60), mask)
d.rounded_rectangle((px + 30, py + 60, px + pw - 30, py + ph - 60), radius=26, outline=EDGE, width=2)
d.text((px + 58, py + 86), "Sample caption panel", font=font("Italic", 26), fill=SECOND)
d.text((px + 58, py + 126), "About ", font=font("Regular", 42), fill=TEXT)
w = d.textlength("About ", font=font("Regular", 42))
d.text((px + 58 + w, py + 126), "1,600 miles", font=font("Bold", 42), fill=TEXT)
d.text((px + 58, py + 178), "of levees guard the valley", font=font("Regular", 42), fill=TEXT)

out = ROOT / "docs" / "style-sheet.png"
img.save(out)
print("wrote", out)
