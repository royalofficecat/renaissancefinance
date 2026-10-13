"""Soundtrack for "What if it rained in Utah for 30 days?": music + sound effects, all made in code.

- Music: 120 bpm (one bar = 2 s = 60 frames), D minor / dorian. Ambient desert first: a low drone, a wind
  shimmer and a sparse plucked line that echoes off the canyon walls (a dotted-eighth delay). Deep drums
  come in as the runoff builds (from the cut-away block, 0:18) and grow bar by bar, dropping out for the
  hush of the salt flats. On day 30 (0:50) the drums stop and wide D-major chords open up (strings, choir,
  horns) as the clouds break; the quiet chords of the months-later beat stop dead at 0:59 (the sudden
  quiet), and a single button note lands on the end card (1:00).
- Sound effects: thunder, rain arriving on rock, rushing water, waterfalls, a canyon call and its echoes,
  water swelling, a drain gurgle, birds over the wetlands. Soft whooshes on every scene dissolve and
  fly-to, quiet ticks on every count-up. Rain is a texture only in the scenes where it is falling on screen.
  Every cue sits on an exact video frame.
- Mix: each effect is measured (BS.1770 loudness over 100 ms windows) and set ~9 dB above the music under
  it, and the music dips while it plays (so the music sits 8-10 dB under the effects).
  Master to -14 LUFS integrated, true peak below -1 dBTP in the encoded file (-2.5 dBTP in the WAV).

Instruments and the mixing tools come from audio/cat_kingdom.py and audio/generate.py.
Run:  .venv/bin/python audio/utah_rain.py   -> out/utah-rain/audio/soundtrack.wav (48 kHz stereo float)
"""

import json
import math
import pathlib
import sys

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import generate as g  # noqa: E402
import cat_kingdom as ck  # noqa: E402  (pizz, strings, horns, timp, cymbal, celesta, choir, reverb, birdsong, mix tools)

ROOT = pathlib.Path(__file__).resolve().parent.parent
BEATS = json.loads((ROOT / "scene" / "videos" / "utah-rain" / "beats.json").read_text())
SR, FPS = g.SR, BEATS["fps"]
DUR = BEATS["totalFrames"] / FPS
N = int(round(DUR * SR))
g.N = ck.N = N
BEAT = 60 / BEATS["bpm"]
BAR = 4 * BEAT
rng = np.random.default_rng(4096)
g.rng = ck.rng = rng
place, lp, hp, bp, env_adsr, mtof, t_of, pk = g.place, g.lp, g.hp, g.bp, g.env_adsr, g.mtof, g.t_of, g.pk
stereo = ck.stereo
# scene changes (dissolves) and the camera's fly-to moves, for the whooshes
CUTS = [180, 264, 420, 540, 660, 780, 1140, 1260, 1380]
FLYS = [(232, 1.3), (920, 1.6), (1040, 1.8), (1520, 2.0)]
QUIET = 1770  # the sudden quiet
END = 1800    # end card


def fr(frame):
    return int(round(frame / FPS * SR))


def bar_s(b):
    return int(round(b * BAR * SR))


# ------------------------------------------------------------------ instruments
def echo(x, delay=0.375, fb=0.42, n=4, lpf=2600):
    """Canyon echo: repeats that get darker and quieter, alternating left and right."""
    x = stereo(x) if x.ndim == 1 else x
    out = np.zeros((len(x) + int(delay * SR * (n + 1)), 2))
    out[: len(x)] += x
    y = x
    for k in range(1, n + 1):
        y = lp(y, lpf * (0.8 ** k)) * fb
        s = int(delay * SR * k)
        side = np.array([1.0, 0.45]) if k % 2 else np.array([0.45, 1.0])
        out[s : s + len(y)] += y * side
    return out


def drone(dur, notes=(38, 45), bright=0.25):
    """Low desert drone: slow-beating sines with a breathy band of noise."""
    n = int(dur * SR)
    t = t_of(n)
    x = np.zeros(n)
    for m in notes:
        f = mtof(m)
        x += np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2.003 * t) + 0.12 * np.sin(2 * np.pi * f * 3.01 * t)
    air = bp(rng.standard_normal(n), 300, 900) * bright * (0.6 + 0.4 * np.sin(2 * np.pi * t / 7.0))
    return stereo((x / len(notes) * 0.5 + air) * np.minimum(1, t / 2.5) * np.minimum(1, (dur - t) / 1.5))


def wind(dur, f0=500, f1=1800, depth=0.6):
    """Wind: band-passed noise whose brightness and level drift slowly."""
    n = int(dur * SR)
    t = t_of(n)
    w = rng.standard_normal((n, 2))
    lo, hi = bp(w, f0, f0 * 2.2), bp(w, f1 * 0.6, f1 * 1.6)
    mod = 0.5 + 0.5 * np.sin(2 * np.pi * t / 5.3) * np.sin(2 * np.pi * t / 3.1 + 1)
    e = np.minimum(1, t / 1.5) * np.minimum(1, (dur - t) / 1.5)
    return (lo * (1 - depth * mod)[:, None] + hi * (depth * mod)[:, None]) * e[:, None]


def tom(m, dur=1.2, vel=1.0):
    """Deep drum (taiko-like): pitched body that drops, a skin slap, a long low tail."""
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m) * (1 + 0.5 * np.exp(-t * 25))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.6) / SR) * np.exp(-t * 9)
    slap = bp(rng.standard_normal(n), 300, 2200) * np.exp(-t * 55) * 0.5
    return (body + slap) * np.minimum(1, t * 1200) * vel


def shaker(dur=0.12, vel=1.0):
    n = int(dur * SR)
    t = t_of(n)
    return hp(rng.standard_normal(n), 5000) * np.sin(np.pi * t / dur) ** 2 * vel * 0.35


# ------------------------------------------------------------------ music
CH = {  # pads, low to high
    "Dm": [50, 57, 62, 65], "Bb": [46, 53, 58, 62], "C": [48, 55, 60, 64], "Am": [45, 52, 57, 60], "F": [41, 53, 57, 60], "A": [45, 52, 57, 61],
    "D": [50, 57, 62, 66], "G": [43, 55, 59, 62], "Bm": [47, 54, 59, 62], "Asus": [45, 52, 57, 62], "Dadd9": [50, 57, 64, 66],
}
# one chord per bar (32 bars = 64 s); drone-only in the opening, the build from bar 9, the clearing from bar 25
PROG = [None] * 6 + ["Dm", "Dm", "Bb", "C",                      # 0-9   desert, canyon, waterfalls
        "Dm", "Dm", "Bb", "Bb", "C", "C", "Am", "Am",           # 10-17 funnels, divide, Powell
        "F", "F", "C", "Dm", "Bb", "C", "A", "Dm"] + [None] * 0  # 18-25 lake, flats (hush), city, wetlands
PROG = PROG[:25] + ["D", "D", "G", "Bm", "Asus", "Dadd9", None, None]   # 25-31 the clearing, afterwards, end
PLUCK = [(1.0, 69), (1.75, 72), (2.5, 74), (3.25, 69), (4.0, 67), (4.75, 65), (5.5, 62), (6.25, 69),
         (7.0, 74), (7.5, 72), (8.0, 69), (8.75, 77), (9.5, 74)]  # (bar, midi): the sparse desert line


def music():
    buf = np.zeros((N + SR * 4, 2))
    # opening drone and wind, fading under the build; back for the hush of the salt flats
    place(buf, 0, drone(26.0, (38, 45), 0.3) * 0.9)
    place(buf, 0, wind(22.0) * 0.08)
    place(buf, fr(1140), drone(4.2, (38, 45), 0.2) * 0.7)
    place(buf, fr(1140), wind(4.4, 700, 2400) * 0.1)
    # the plucked line with canyon echoes
    for b, m in PLUCK:
        place(buf, bar_s(b), echo(ck.pizz(m, 1.4, 0.9, 0.7) * 0.55))
    # pads
    for b, name in enumerate(PROG):
        if name is None:
            continue
        clearing = b >= 25
        hush = 19 <= b <= 20
        dur = BAR + (0.7 if not clearing else 1.2)
        s = ck.strings(CH[name], dur, att=0.6 if not clearing else 0.35, rel=0.8, bright=0.35 if not clearing else 0.6)
        v = 0.5 + 0.03 * min(b, 24) if not clearing else 0.95
        if hush:
            v *= 0.55
        if b >= 27:
            v *= 0.7  # the afterwards chords are quieter
        place(buf, bar_s(b), s * v)
        if clearing:
            place(buf, bar_s(b), stereo(ck.choir([n + 12 for n in CH[name][1:]], dur, att=0.4, rel=1.2)) * 0.5)
            if b in (25, 26, 28):
                place(buf, bar_s(b), stereo(ck.horns(CH[name][:3], dur, att=0.25, rel=0.8, bright=0.4)) * 0.55)
        # bass: low root, pulsing in eighths during the build
        root = CH[name][0] - 12
        if 10 <= b <= 24 and not hush:
            for k in range(8):
                nb = ck.pizz(root + (12 if k % 4 == 3 else 0), 0.5, 0.7 + 0.3 * (k % 2 == 0), 0.3)
                place(buf, bar_s(b) + int(k * BEAT / 2 * SR), stereo(nb) * (0.35 + 0.02 * (b - 10)))
        elif clearing and b <= 29:
            place(buf, bar_s(b), stereo(ck.strings([root, root + 12], dur, att=0.5, rel=1.0, bright=0.2)) * 0.6)
    # deep drums: in from bar 9, denser every two bars, out for the salt flats and at the clearing
    for b in range(9, 25):
        if 19 <= b <= 20:
            continue
        lvl = min(1.0, 0.45 + 0.05 * (b - 9))
        hits = [(0, 33, 1.0), (2, 33, 0.7)]
        if b >= 12:
            hits += [(1.5, 38, 0.5), (3, 33, 0.6)]
        if b >= 15:
            hits += [(3.5, 36, 0.45), (0.5, 33, 0.35)]
        if b >= 21:
            hits += [(2.5, 38, 0.5), (3.75, 40, 0.4)]
        for beat, m, v in hits:
            place(buf, bar_s(b) + int(beat * BEAT * SR), stereo(tom(m, 1.3, v * lvl)) * 0.9)
        if b >= 13:
            for k in range(8):
                place(buf, bar_s(b) + int((k + 0.5) * BEAT / 2 * SR), stereo(shaker(0.1, (0.5 + 0.5 * (k % 2)) * lvl), 0.3))
    # a big drum roll into the clearing, a cymbal swell, and the release
    for k in range(16):
        place(buf, bar_s(24) + int((2 + k * 0.125) * BEAT * SR), stereo(tom(36 if k % 2 else 33, 0.8, 0.3 + 0.045 * k)))
    place(buf, bar_s(25) - int(2.2 * SR), stereo(ck.cymbal(2.2, swell=True)[:, 0]) * 0.5)
    place(buf, bar_s(25), stereo(tom(31, 2.2, 1.0)) * 0.9)
    buf = ck.reverb(buf, rt=2.6, wet=0.3)[: N + SR * 4]
    # the sudden quiet: everything stops at 0:59 (a 60 ms fade, no tail)
    q = fr(QUIET)
    fade = int(0.06 * SR)
    buf[q : q + fade] *= np.linspace(1, 0, fade)[:, None]
    buf[q + fade :] = 0
    # the button note on the end card: low D and a high bell-like D, ringing out
    hi = ck.celesta(74, 3.0)
    hi[: int(2.4 * SR)] += 0.6 * ck.celesta(86, 2.4)
    btn = stereo(hi) + stereo(ck.strings([38, 50], 3.0, att=0.02, rel=1.6, bright=0.2)[:, 0]) * 0.8
    place(buf, fr(END), ck.reverb(np.pad(btn, ((0, SR), (0, 0))), rt=3.0, wet=0.4) * 0.8)
    buf = buf[:N]
    buf *= np.clip((DUR - t_of(N)) / 0.4, 0, 1)[:, None]
    return buf


# ------------------------------------------------------------------ sound effects
def thunder(dur=4.0):
    """A thunder roll: a sharp crack, then low rumbles that surge and fade."""
    n = int(dur * SR)
    t = t_of(n)
    brown = np.cumsum(rng.standard_normal(n))
    brown = hp(brown - brown.mean(), 25)
    brown /= np.max(np.abs(brown)) + 1e-9
    surges = sum(np.exp(-((t - c) / w) ** 2) * a for c, w, a in [(0.25, 0.25, 1.0), (0.9, 0.4, 0.7), (1.8, 0.6, 0.5), (2.8, 0.7, 0.3)])
    rumble = lp(brown, 160) * surges * 2.5
    crack = bp(rng.standard_normal(n), 800, 5000) * np.exp(-t * 18) * 0.6
    return (rumble + crack) * np.minimum(1, t * 400) * np.minimum(1, (dur - t) / 0.8)


def rain(dur, k0=0.3, k1=1.0, drops=900):
    """Rain on rock: a hiss plus tiny droplet ticks; intensity ramps k0 -> k1 and fades at the end."""
    n = int(dur * SR)
    t = t_of(n)
    inten = (k0 + (k1 - k0) * np.minimum(1, t / max(0.1, dur * 0.35))) * np.minimum(1, (dur - t) / 0.8) * np.minimum(1, t / 0.3)
    w = rng.standard_normal((n, 2))
    out = (bp(w, 2500, 9000) * 0.5 + bp(w, 600, 2500) * 0.2) * inten[:, None]
    L = 240
    tl = t_of(L)
    for tt in np.sort(rng.random(int(drops * dur / 4)) * dur):
        i = int(tt * SR)
        if rng.random() > inten[min(i, n - 1)]:
            continue
        d = np.sin(2 * np.pi * (2500 + rng.random() * 3500) * tl) * np.exp(-tl * 900) * 0.3
        place(out, i, d, 1.0, pan=rng.random() * 1.6 - 0.8)
    return out


def water(dur, low=160, high=1600, swell=0.5):
    """Rushing water: brown noise in a moving band, with a churning wobble."""
    n = int(dur * SR)
    t = t_of(n)
    x = g.rush(dur, up=True)
    churn = bp(rng.standard_normal(n), high * 0.8, high * 3) * (0.5 + 0.5 * np.sin(2 * np.pi * 6.3 * t) ** 2) * 0.25
    return (x + churn) * (1 - swell + swell * np.minimum(1, t / (dur * 0.6)))


def waterfall(dur):
    n = int(dur * SR)
    t = t_of(n)
    w = rng.standard_normal(n)
    x = bp(w, 250, 4000) * 0.6 + lp(np.cumsum(w) / 300, 200)
    return x * np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.6)


def chimes(notes, step=0.16):
    """Water drops as small tuned chimes."""
    out = np.zeros(int((step * len(notes) + 1.6) * SR))
    for i, m in enumerate(notes):
        c = ck.celesta(m, 1.4) * (0.8 + 0.2 * rng.random())
        s = int(i * step * SR)
        out[s : s + len(c)] += c
    return out


def trickle(dur=2.0):
    """Bubbly trickle: short rising sine blips."""
    out = np.zeros(int(dur * SR))
    tt = 0.0
    while tt < dur - 0.1:
        L = int((0.02 + rng.random() * 0.03) * SR)
        tl = t_of(L)
        f = (600 + rng.random() * 900) * (1 + 2.5 * tl / tl[-1])
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tl / tl[-1])
        s = int(tt * SR)
        out[s : s + L] += b * (0.4 + 0.6 * rng.random())
        tt += 0.03 + rng.random() * 0.09
    return out


def gurgle(dur=1.4):
    out = np.zeros(int(dur * SR))
    for k in range(7):
        x = g.gulp() * (0.6 + 0.4 * rng.random())
        s = int((k * 0.16 + rng.random() * 0.05) * SR)
        out[s : s + len(x)] += x[: len(out) - s]
    return out + bp(rng.standard_normal(len(out)), 200, 900) * 0.15


def sfx():
    accents, textures = [], []

    def acc(frame, x, pan=0.0, soft=0.0):
        x = stereo(x, pan) if x.ndim == 1 else x
        x = x / (np.max(np.abs(x)) + 1e-12)
        if soft:
            x = np.tanh(x * (1 + soft * 3)) / np.tanh(1 + soft * 3)
        accents.append((fr(frame), x))

    def tex(sample, x, db, pan=0.0):
        textures.append((sample, stereo(pk(x, db), pan) if x.ndim == 1 else pk(x, db)))

    # whooshes: every dissolve (peaking 4 frames before the cut) and every fly-to
    for i, c in enumerate(CUTS):
        d = 1.0 + 0.15 * (i % 3)
        tex(fr(c - 4) - int(d * 0.6 * SR), g.whoosh(d, 240 + 40 * (i % 4), 1900 + 300 * (i % 3)), -18, 0.2 if i % 2 else -0.2)
    for f0, d in FLYS:
        tex(fr(f0), g.whoosh(d, 180, 1500, 0.55), -19, 0.0)
    # count-up ticks on every stats panel (eight per count)
    for b in BEATS["beats"]:
        if b.get("stat"):
            t0 = (b["start"] + 10.5) / FPS
            for k in range(1, 9):
                u = 1 - (1 - k / 8) ** (1 / 3)
                tex(int((t0 + u * 0.9) * SR), g.tick(), -27 + 3 * (k == 8), 0.2)
    # rain where it is falling on screen: the canyon, the alcove, the block, the slot, the flats, the city
    for f0, f1, k0, k1, db in [(0, 186, 0.25, 1.0, -21), (420, 546, 0.6, 0.8, -24), (540, 666, 0.7, 1.0, -22),
                               (660, 786, 0.6, 0.7, -25), (1140, 1266, 0.3, 0.35, -28), (1260, 1386, 0.6, 0.8, -24)]:
        tex(fr(f0), rain((f1 - f0) / FPS, k0, k1), db)

    # beat 1: lightning, thunder; rain arrives on the rock; the wash starts to run
    acc(16, thunder(4.0), -0.2)
    acc(55, water(3.6, swell=0.8), 0.1)
    # beat 2: wind swells over the globe
    tex(fr(182), wind(3.2, 400, 1600), -22, 0.0)
    # beat 3: drops like chimes as the washes light up, then a bubbling trickle
    acc(300, chimes([74, 77, 81, 79, 86, 84]), 0.2)
    acc(332, trickle(2.2), -0.2)
    # beat 4: a call bounces off the canyon walls; the waterfalls pour
    acc(422, echo(ck.pizz(81, 0.9, 1.0, 0.8) + 0.5 * ck.pizz(74, 0.9, 1.0, 0.8), 0.32, 0.55, 5), -0.3)
    acc(460, waterfall(2.4), 0.25)
    # beat 5: a gust of rain; the gathered water rushes out of the slot (the low drum is in the music)
    tex(fr(542), g.whoosh(1.6, 300, 2600, 0.4), -19, -0.3)
    acc(615, water(1.8, 120, 1300, 0.3), 0.2)
    # beat 6: the surge comes down the slot; a canyon echo as it passes
    acc(668, water(3.2, 140, 1500, 0.7), 0.0)
    acc(730, echo(ck.pizz(76, 0.8, 1.0, 0.7), 0.3, 0.5, 5), 0.3)
    # beat 7: the arrows draw on with soft pulses
    acc(812, np.concatenate([g.pop(f) for f in (660, 740, 880, 990, 880, 1110)]), 0.0, soft=0.6)
    # beat 8: a deep drum as the water reaches Lake Powell
    acc(962, tom(28, 2.0, 1.0) + 0.5 * thunder(2.0)[: int(2.0 * SR)] * 0.3)
    # beat 9: the lake swells
    acc(1058, g.swell(2.6) + 0.5 * water(2.6, 100, 900, 0.9)[: int(2.6 * SR)], -0.1)
    # beat 10: the hush of the flats, then a shimmer as the mirror appears
    tex(fr(1144), wind(3.6, 600, 2200, 0.4), -23)
    acc(1190, g.shimmer(2.4), 0.2)
    # beat 11: storm drains gurgle under the streets
    acc(1290, gurgle(1.4), -0.2)
    acc(1330, gurgle(1.2), 0.3)
    # beat 12: birds over the wetlands; a soft swell as the camera cranes up
    tex(fr(1410), ck.birdsong(1.6, 8), -17, 0.3)
    tex(fr(1446), ck.birdsong(1.2, 9), -18, -0.3)
    tex(fr(1452), g.swell(1.6), -22)
    # beat 13: the cloud-break chord is the music; a high shimmer as the light comes through
    acc(1512, g.shimmer(2.6), 0.0)
    # beat 14: a last trickle as the water soaks away; then the sudden quiet (in the music)
    acc(1660, trickle(1.6) * 0.8, 0.2)
    return accents, textures


# ------------------------------------------------------------------ mix (as in the cat video)
GAP_DB = 9.0
DUCK_DB = 5.0


def build(m_target, music_raw, accents, textures, duck):
    m = music_raw * 10 ** ((m_target - g.lufs(music_raw)) / 20) * duck[:, None]
    shift = m_target + 17.0
    fx = np.zeros((N, 2))
    gaps = []
    for s, x in accents:
        e = s + len(x)
        mus = ck.momentary_max(m, s, e)
        own = ck.momentary_max(x, 0, len(x))
        # 9 dB over the music under it, but never so quiet it vanishes over a sparse passage (the hook's
        # thunder) nor so loud it jumps out over the drum roll (the birds)
        want = min(max(mus + GAP_DB, m_target - 2.0), m_target + 9.0)
        gain = 10 ** ((want - own) / 20)
        gain = min(gain, 10 ** (-1.0 / 20) / (np.max(np.abs(x)) + 1e-12))
        place(fx, s, x * gain)
        gaps.append(own + 20 * math.log10(gain) - mus)
    for s, x in textures:
        place(fx, s, x * 10 ** (shift / 20))
    return m, fx, gaps


def main():
    out_dir = ROOT / "out" / "utah-rain" / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    music_raw = music()
    accents, textures = sfx()
    depths = [DUCK_DB] * len(accents)
    m_target = -18.0
    for _ in range(4):
        duck = ck.duck_envelope(accents, depths)
        m, fx, gaps = build(m_target, music_raw, accents, textures, duck)
        depths = [min(12.0, d + max(0.0, GAP_DB - 0.5 - gp)) for d, gp in zip(depths, gaps)]
        m_target += -14.0 - g.lufs(m + fx)
    duck = ck.duck_envelope(accents, depths)
    m, fx, gaps = build(m_target, music_raw, accents, textures, duck)
    # the sudden quiet holds for the effects too (only the end-card note after it)
    q = fr(QUIET)
    fx[q : q + int(0.06 * SR)] *= np.linspace(1, 0, int(0.06 * SR))[:, None]
    fx[q + int(0.06 * SR) :] = 0
    mix = m + fx
    for _ in range(3):
        mix *= 10 ** ((-14.0 - g.lufs(mix)) / 20)
        mix = g.peak_limit(mix, -2.5)
    stats = {
        "integrated_lufs": round(float(g.lufs(mix)), 2), "true_peak_dbtp": round(float(g.true_peak_db(mix)), 2), "seconds": round(len(mix) / SR, 3),
        "music_lufs": round(float(m_target), 1), "music_ducks_db": [round(min(depths), 1), round(max(depths), 1)],
        "effects_over_music_db_median": round(float(np.median(gaps)), 1),
        "effects_over_music_db_10_90": [round(float(np.percentile(gaps, 10)), 1), round(float(np.percentile(gaps, 90)), 1)], "accents": len(gaps),
    }
    wavfile.write(out_dir / "soundtrack.wav", SR, mix.astype(np.float32))
    wavfile.write(out_dir / "music.wav", SR, m.astype(np.float32))
    wavfile.write(out_dir / "sfx.wav", SR, fx.astype(np.float32))
    (out_dir / "stats.json").write_text(json.dumps(stats, indent=1))
    print(stats)


if __name__ == "__main__":
    main()
