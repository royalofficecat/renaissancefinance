"""Draws a style sheet image: palette swatches, type scale and a sample caption panel.

Run:  python3 render/make_style_sheet.py [palette.json] [out.png] [title] [sample stat]
      (defaults: scene/palette.json -> docs/style-sheet.png, the first video)
"""

import json
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "scene" / "fonts"
PAL_PATH = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "scene" / "palette.json"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "docs" / "style-sheet.png"
TITLE = sys.argv[3] if len(sys.argv) > 3 else "Style sheet — “What if California got 30 days of extreme rain?”"
STAT = sys.argv[4] if len(sys.argv) > 4 else "1,600 miles"
PAL = json.loads(PAL_PATH.read_text())

W, H = 1800, 1290


def font(style, size):
    return ImageFont.truetype(str(FONTS / f"LiberationSerif-{style}.ttf"), size)


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def lum(h):
    r, g, b = rgb(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


t = PAL["text"]
TEXT, SECOND, EDGE = t["text"]["hex"], t["secondary"]["hex"], t["panelEdge"]["hex"]
dark_text = lum(TEXT) < 128
# Sheet background: light paper for dark text, near-black for light text
BG = "#EEE9E0" if dark_text else "#12110F"
SHEET_TEXT = TEXT
SHEET_SECOND = SECOND

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
d.text((60, 46), TITLE, font=font("Bold", 44), fill=SHEET_TEXT)
d.text((60, 104), "Scene colours carry the story; text and panels stay neutral.", font=font("Italic", 28), fill=SHEET_SECOND)


def swatch_row(y, title, entries):
    d.text((60, y), title, font=font("Bold", 30), fill=SHEET_TEXT)
    x = 60
    for e in entries:
        d.rounded_rectangle((x, y + 50, x + 300, y + 200), radius=18, fill=e["hex"], outline=EDGE if dark_text else "#4A4540", width=2)
        d.text((x, y + 214), e["name"], font=font("Bold", 26), fill=SHEET_TEXT)
        d.text((x, y + 248), e["hex"] + (f" · {int(e['opacity']*100)}%" if "opacity" in e else ""), font=font("Regular", 24), fill=SHEET_SECOND)
        d.text((x, y + 280), e["role"], font=font("Italic", 22), fill=SHEET_SECOND)
        x += 340


scene = PAL["scene"]
roles = {"background": "Background", "subject": "Main subject", "accent": "Accent (one colour)", "highlight": "Data / highlight", "water": "Water tint"}
entries = [{**v, "role": roles.get(k, k)} for k, v in scene.items()]
for k, v in PAL.get("extra", {}).items():
    entries.append({**v, "role": "Pale end of subject"})
if "light" in PAL:
    lk = next(iter(PAL["light"]))  # the first light colour (the key)
    entries.append({**PAL["light"][lk], "role": "Key light colour"})
swatch_row(160, "Scene colours (3d world only)", entries[:5])
txt_entries = [{**t["text"], "role": "Titles, captions, numbers"}, {**t["secondary"], "role": "Labels, asides, legends"},
               {**t["panelFill"], "role": "Panel fill + 18 px blur"}, {**t["panelEdge"], "role": "Panel edge, label halo"}, {**t["endCard"], "role": "End-card backdrop"}]
swatch_row(500, "Neutral text colours (all text, panels, legends)", txt_entries)

y = 850
d.text((60, y), "Type: Times New Roman stand-in (Liberation Serif, metric-matched)", font=font("Bold", 30), fill=SHEET_TEXT)
d.text((60, y + 52), "Title · Bold 76", font=font("Bold", 76), fill=SHEET_TEXT)
d.text((60, y + 148), "Caption · Regular 52, key number in bold", font=font("Regular", 52), fill=SHEET_TEXT)
d.text((60, y + 222), "Stat label · Italic 30    Map label · Regular 30    Water name · Italic 30", font=font("Italic", 30), fill=SHEET_SECOND)
d.text((60, y + 280), "Stat number · Regular 72 · tabular figures:", font=font("Regular", 30), fill=SHEET_SECOND)
d.text((640, y + 255), STAT, font=font("Regular", 72), fill=SHEET_TEXT)

# Sample caption panel over a busy patch of the scene palette
px, py, pw, ph = 1180, 840, 560, 360
cols = [rgb(v["hex"]) for v in scene.values()]
bg = Image.new("RGB", (pw, ph), cols[0])
bd = ImageDraw.Draw(bg)
for i in range(ph):
    k = i / ph
    c = tuple(int(a * (1 - k) + b * k) for a, b in zip(cols[0], cols[1]))
    bd.line([(0, i), (pw, i)], fill=c)
for j in range(0, pw, 46):
    bd.ellipse((j, 40 + (j * 7) % 200, j + 70, 110 + (j * 7) % 200), fill=cols[min(3, len(cols) - 1)])
bd.rectangle((0, 260, pw, ph), fill=cols[min(2, len(cols) - 1)])
img.paste(bg, (px, py))
region = img.crop((px + 30, py + 60, px + pw - 30, py + ph - 60)).filter(ImageFilter.GaussianBlur(18))
panel = Image.new("RGBA", region.size, rgb(t["panelFill"]["hex"]) + (int(255 * t["panelFill"]["opacity"]),))
region = Image.alpha_composite(region.convert("RGBA"), panel).convert("RGB")
mask = Image.new("L", region.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, *region.size), radius=26, fill=255)
img.paste(region, (px + 30, py + 60), mask)
d.rounded_rectangle((px + 30, py + 60, px + pw - 30, py + ph - 60), radius=26, outline=EDGE, width=2)
d.text((px + 58, py + 86), "Sample caption panel", font=font("Italic", 26), fill=SECOND)
d.text((px + 58, py + 126), "The key number ", font=font("Regular", 42), fill=TEXT)
w = d.textlength("The key number ", font=font("Regular", 42))
d.text((px + 58 + w, py + 126), "in bold", font=font("Bold", 42), fill=TEXT)
d.text((px + 58, py + 178), "on a soft panel", font=font("Regular", 42), fill=TEXT)

img.save(OUT)
print("wrote", OUT)
