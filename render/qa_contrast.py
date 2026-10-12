"""Contrast check for the neutral text palette (WCAG 2.x relative-luminance formula).

Panels are semi-transparent, so the colour *behind* a panel changes what the text
actually sits on. We test the two extremes: the panel over pure black and over
pure white. Both must reach 4.5:1 for every text colour.

Run:  python3 render/qa_contrast.py [path/to/palette.json]   (default: scene/palette.json)
"""

import json
import pathlib
import sys

_DEFAULT = pathlib.Path(__file__).parent.parent / "scene" / "palette.json"
PALETTE = json.loads(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else _DEFAULT).read_text())


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def luminance(rgb):
    def chan(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (chan(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def over(fg, alpha, bg):
    return tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))


def main():
    text = PALETTE["text"]
    panel = hex_to_rgb(text["panelFill"]["hex"])
    alpha = text["panelFill"]["opacity"]
    ok = True
    rows = []
    for backdrop_name, backdrop in (("black", (0, 0, 0)), ("white", (255, 255, 255))):
        eff = over(panel, alpha, backdrop)
        for key in ("text", "secondary"):
            ratio = contrast(hex_to_rgb(text[key]["hex"]), eff)
            ok &= ratio >= 4.5
            rows.append((key, text[key]["hex"], backdrop_name, "#%02X%02X%02X" % eff, ratio))
    for key, hx, bd, eff, r in rows:
        flag = "PASS" if r >= 4.5 else "FAIL"
        print(f"{flag}  {key:<9} {hx} on panel over {bd:<5} (= {eff})  {r:5.2f}:1")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
