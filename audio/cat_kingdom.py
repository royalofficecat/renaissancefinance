"""Soundtrack for "What if domestic cats took over California?": music + sound effects, all made in code.

- Music: 120 bpm (one bar = 2 s = 60 frames), F major. Playful pizzicato strings first (the takeover),
  swelling into a grand orchestra (strings, horns, timpani) as the cat civilisation grows, a tutti hit
  when the whole state is revealed as one living room (0:50), then soft and warm in the kitchen:
  celesta and low strings, and a final button chord on the end card (1:00).
- Sound effects: purrs, claws tapping stone (and kitchen tile), cardboard rustles, a door creak, bird
  chirps, a glass tink, and one absurdly ceremonial can opening. Soft whooshes on every scene dissolve,
  quiet ticks on every count-up. Every cue sits on an exact video frame.
- Mix: each effect is measured (BS.1770 momentary loudness) and set ~9 dB above the music under it, and the
  music dips 5 dB while it plays (so the music sits 8-10 dB under the effects).
  Master to -14 LUFS integrated, true peak below -1 dBTP in the encoded file (-2.5 dBTP in the WAV).

Shared synthesis and loudness tools come from audio/generate.py (the first video).
Run:  .venv/bin/python audio/cat_kingdom.py   -> out/cat-kingdom/audio/soundtrack.wav (48 kHz stereo float)
"""

import json
import math
import pathlib
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import generate as g  # noqa: E402  (helpers: place, env_adsr, filters, piano, bell, whoosh, tick, pop, pk, lufs, peak_limit ...)

ROOT = pathlib.Path(__file__).resolve().parent.parent
BEATS = json.loads((ROOT / "scene" / "videos" / "cat-kingdom" / "beats.json").read_text())
SR, FPS = g.SR, BEATS["fps"]
DUR = BEATS["totalFrames"] / FPS
N = int(round(DUR * SR))
g.N = N
BEAT = 60 / BEATS["bpm"]
BAR = 4 * BEAT
rng = np.random.default_rng(1854)
g.rng = rng
place, lp, hp, bp, env_adsr, mtof, t_of, pk = g.place, g.lp, g.hp, g.bp, g.env_adsr, g.mtof, g.t_of, g.pk
CUTS = [b["start"] for b in BEATS["beats"][1:] if b["id"] != "end"]


def fr(frame):
    return int(round(frame / FPS * SR))


# ------------------------------------------------------------------ instruments
def pizz(m, dur=0.7, vel=1.0, bright=0.5):
    """Plucked string: inharmonic partials with fast, frequency-dependent decay, a finger thump, body resonance."""
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m)
    x = np.zeros(n)
    for k in range(1, 11):
        fk = f * k * math.sqrt(1 + 0.0002 * k * k)
        if fk > 12000:
            break
        x += (1 / k ** (1.6 - bright * 0.6)) * np.sin(2 * np.pi * fk * t + rng.random() * 0.3) * np.exp(-t * (5 + 2.4 * k + f / 160))
    thump = lp(rng.standard_normal(n), 700) * np.exp(-t * 160) * 0.25
    x = (x + thump) * np.minimum(1, t * 900)
    x = x + 0.5 * bp(x, 220, 700)
    return x * vel * 0.6


def saw(freq_t):
    ph = np.cumsum(freq_t) / SR
    return 2 * (ph % 1.0) - 1


def strings(notes, dur, att=0.35, rel=0.6, bright=0.5, vib=0.004, voices=3, spread=0.6):
    """Bowed string section: detuned saws per note, slow vibrato, warm low-pass, gentle bow noise."""
    n = int(dur * SR)
    t = t_of(n)
    out = np.zeros((n, 2))
    for i, m in enumerate(notes):
        f = mtof(m)
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 0.0035
            vr = 5.2 + rng.random() * 0.8
            fq = f * (1 + det) * (1 + vib * np.sin(2 * np.pi * vr * t + rng.random() * 6.28) * np.minimum(1, t / 0.6))
            w = saw(fq)
            pan = ((v / max(1, voices - 1)) - 0.5) * spread + (i / max(1, len(notes) - 1) - 0.5) * 0.3
            out[:, 0] += w * math.cos((pan + 1) * math.pi / 4)
            out[:, 1] += w * math.sin((pan + 1) * math.pi / 4)
    out = lp(out, 1400 + 3200 * bright, 4)
    out = hp(out, 70)
    out += hp(lp(rng.standard_normal((n, 2)), 5000), 1500) * 0.015 * len(notes)
    e = env_adsr(n, a=att, d=0.2, s=0.9, r=rel)
    return out * e[:, None] / (voices * max(1, len(notes))) * 1.4


def horns(notes, dur, att=0.12, rel=0.5, bright=0.5):
    """French-horn section: saws through a filter that opens as the note speaks (two-filter crossfade)."""
    n = int(dur * SR)
    t = t_of(n)
    raw = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for det in (-0.002, 0.002):
            raw += saw(f * (1 + det) * (1 + 0.003 * np.sin(2 * np.pi * 4.8 * t) * np.minimum(1, t / 0.8)))
    dark, brt = lp(raw, 650, 4), lp(raw, 1300 + 1600 * bright, 4)
    open_ = np.minimum(1, t / (att * 2.2))
    x = dark * (1 - open_) + brt * open_
    x = hp(x, 60)
    return x * env_adsr(n, a=att, d=0.25, s=0.85, r=rel) / (2 * max(1, len(notes)))


def timp(m, dur=2.2, vel=1.0):
    """Timpani: drum partials with a slight pitch settle and a felt-mallet attack."""
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m) * (1 + 0.04 * np.exp(-t * 20))
    x = sum(a * np.sin(2 * np.pi * np.cumsum(f * r) / SR) * np.exp(-t * d) for r, a, d in [(1, 1.0, 2.0), (1.5, 0.45, 3.2), (1.99, 0.3, 4.0), (2.44, 0.18, 6.0)])
    mallet = lp(rng.standard_normal(n), 900) * np.exp(-t * 60) * 0.5
    return (x + mallet) * np.minimum(1, t * 1500) * vel * 0.5


def timp_roll(m, dur, v0=0.15, v1=1.0):
    out = np.zeros(int((dur + 2.0) * SR))
    k, step = 0, 0.065
    while k * step < dur:
        v = v0 + (v1 - v0) * (k * step / dur) ** 1.6
        h = timp(m, 1.2, v * (0.85 + 0.15 * rng.random()))
        s = int(k * step * SR)
        out[s : s + len(h)] += h * 0.55
        k += 1
    return out


def cymbal(dur=3.0, swell=False):
    n = int(dur * SR)
    t = t_of(n)
    x = hp(rng.standard_normal((n, 2)), 3000) + 0.5 * bp(rng.standard_normal((n, 2)), 5500, 9000)
    e = (t / dur) ** 2.2 if swell else np.exp(-t * 1.4) * np.minimum(1, t * 3000)
    return x * e[:, None] * 0.35


def celesta(m, dur=2.2):
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.8) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * f * 10.1 * t) * np.exp(-t * 12)
    return x * np.minimum(1, t * 900) * 0.45


def choir(notes, dur, att=0.25, rel=0.9):
    """'Aah' choir pad: buzzy sources through vowel formants (800 / 1150 / 2900 Hz)."""
    n = int(dur * SR)
    t = t_of(n)
    src = np.zeros(n)
    for m in notes:
        for det in (-0.004, 0.0, 0.004):
            src += saw(mtof(m) * (1 + det) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * t + rng.random() * 6)))
    x = bp(src, 650, 950) * 1.0 + bp(src, 1000, 1300) * 0.6 + bp(src, 2600, 3200) * 0.25
    return x * env_adsr(n, a=att, d=0.2, s=0.9, r=rel) / max(1, len(notes))


def reverb(x, rt=2.0, wet=0.25, pre=0.02, seed=7):
    """Synthetic hall: decorrelated decaying noise impulse response, darker as it decays."""
    r = np.random.default_rng(seed)
    n = int(rt * 1.2 * SR)
    t = t_of(n)
    ir = r.standard_normal((n, 2)) * np.exp(-t * 6.9 / rt)[:, None]
    ir = lp(ir, 5000) * 0.6 + lp(ir, 1500) * 0.4
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    wetsig = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet * 0.5) + wetsig * wet


# ------------------------------------------------------------------ music
CH = {
    "F": [53, 57, 60, 65], "C": [48, 55, 60, 64], "Dm": [50, 57, 62, 65], "Bb": [46, 53, 58, 62],
    "Gm": [43, 55, 58, 62], "Am": [45, 57, 60, 64], "C7": [48, 58, 64, 67],
}
ROOTS = {"F": 41, "C": 48, "Dm": 50, "Bb": 46, "Gm": 43, "Am": 45, "C7": 48}
# 32 bars of 2 s. "Bb/C" = Bb for the first half of the bar, C for the second.
PROG = ["F", "C", "Dm", "Bb", "F", "C", "Bb/C", "F",  # 0-7   pizzicato takeover (0-16 s)
        "Dm", "Bb", "F", "C", "Bb/C",  # 8-12  the city rebuilt (16-26 s)
        "F", "Dm", "Bb", "C", "F", "Am", "Bb", "C", "Dm", "Bb", "Gm", "C7",  # 13-24 the orchestra grows (26-50 s)
        "F", "Bb/F",  # 25-26 the living room (50-54 s)
        "Bb", "F", "C",  # 27-29 the kitchen, soft (54-60 s)
        "F", "F"]  # 30-31 end card
# The theme: 8th notes per bar (None = rest), "tiptoe" pizzicato
C5, A4, F5, E5, D5, G4, F4, Bb4, G5, A5 = 72, 69, 77, 76, 74, 67, 65, 70, 79, 81
THEME = [
    [C5, None, A4, C5, F5, None, E5, None], [D5, None, C5, None, G4, None, None, None],
    [A4, None, F4, A4, D5, None, C5, None], [Bb4, None, A4, None, F4, None, None, None],
    [C5, None, A4, C5, F5, None, E5, None], [D5, None, E5, None, F5, None, G5, None],
    [A5, None, G5, None, F5, None, E5, None], [F5, None, None, None, C5, None, F4, None],
]
# The broad orchestral line over bars 13-26 (half notes; one pair per bar)
LINE = [(69, 69), (65, 69), (74, 72), (67, 67), (69, 72), (76, 72), (74, 77), (76, 76), (77, 76), (74, 77), (79, 77), (76, 79), (77, 77), (77, 77)]


def chord_at(bar, half):
    c = PROG[bar]
    if "/" in c:
        a, b = c.split("/")
        return a if half == 0 else b
    return c


def music():
    buf = np.zeros((N, 2))
    for bar in range(32):
        s0 = bar * BAR
        S = lambda beat: int((s0 + beat * BEAT) * SR)  # noqa: E731
        sec = "A" if bar < 8 else "B" if bar < 13 else "C" if bar < 25 else "D" if bar < 27 else "E" if bar < 30 else "END"
        # --- pizzicato bass (beats 1, 3) and off-beat chord stabs, A-C
        if sec in ("A", "B", "C"):
            for beat in range(4):
                ch = chord_at(bar, beat // 2)
                if beat % 2 == 0:
                    place(buf, S(beat), pizz(ROOTS[ch] if beat == 0 else ROOTS[ch] + 7, 0.9, 0.9, 0.3), 0.55, pan=-0.2)
                else:
                    for k, m in enumerate(CH[ch][1:]):
                        place(buf, S(beat) + k * 40, pizz(m + 12, 0.45, 0.45, 0.5), 0.2, pan=0.25)
        # --- the theme, pizzicato (A), doubled by glockenspiel (B)
        if sec in ("A", "B"):
            mel = THEME[bar % 8] if sec == "A" else [None if m is None else m for m in THEME[(bar - 8 + 2) % 8]]
            for e, m in enumerate(mel):
                if m is None:
                    continue
                place(buf, S(e / 2), pizz(m, 0.7, 1.0, 0.6), 0.5, pan=0.1)
                if sec == "B":
                    place(buf, S(e / 2), g.bell(m + 12, 1.4), 0.09, pan=0.35)
        # --- string pad from B on; horns and timpani join in C
        if sec in ("B", "C", "D"):
            ch0, ch1 = chord_at(bar, 0), chord_at(bar, 1)
            grow = 0 if sec == "B" else min(1, (bar - 13) / 11) if sec == "C" else 1
            gain = 0.22 + 0.25 * grow if sec != "D" else 0.6
            if ch0 == ch1:
                place(buf, S(0), strings(CH[ch0], BAR + 0.7, 0.4 if sec == "B" else 0.25, 0.7, 0.35 + 0.4 * grow), gain)
            else:
                place(buf, S(0), strings(CH[ch0], BAR / 2 + 0.5, 0.25, 0.5, 0.35 + 0.4 * grow), gain)
                place(buf, S(2), strings(CH[ch1], BAR / 2 + 0.7, 0.2, 0.6, 0.35 + 0.4 * grow), gain)
        if sec == "C":
            k = bar - 13
            grow = min(1, k / 11)
            a, b = LINE[k]
            # the broad line: violins, an octave above, with horns underneath from bar 17
            place(buf, S(0), strings([a], BAR / 2 + 0.4, 0.15, 0.4, 0.6, 0.006, 4, 0.3), 0.32 + 0.2 * grow, pan=0.1)
            place(buf, S(2), strings([b], BAR / 2 + 0.6, 0.12, 0.5, 0.6, 0.006, 4, 0.3), 0.32 + 0.2 * grow, pan=0.1)
            if bar >= 17:
                hc = CH[chord_at(bar, 0)]
                place(buf, S(0), horns([hc[0], hc[2]], BAR + 0.3, 0.15, 0.5, 0.3 + 0.5 * grow), 0.3 + 0.3 * grow, pan=-0.25)
                place(buf, S(0), timp(41 if chord_at(bar, 0) in ("F", "Dm", "Bb") else 48, 2.0, 0.6 + 0.4 * grow), 0.5)
            # drive: 8th-note pizzicato ostinato
            for e in range(8):
                ch = chord_at(bar, e // 4)
                place(buf, S(e / 2), pizz(CH[ch][e % 4] + 12, 0.35, 0.5, 0.6), 0.12 + 0.06 * grow, pan=(e % 2) * 0.5 - 0.25)
            if bar == 24:  # timpani roll and a cymbal swell into the reveal
                place(buf, S(0), timp_roll(41, BAR, 0.2, 1.0), 0.75)
                place(buf, int((s0 + BAR - 2.2) * SR), cymbal(2.2, swell=True), 0.6)
        if sec == "D":
            # 0:50 the tutti hit, then the plagal 'amen' (Bb -> F), grand
            if bar == 25:
                place(buf, S(0), timp(41, 2.6, 1.0), 0.9)
                place(buf, S(0), cymbal(3.4), 0.55)
                place(buf, S(0), horns([53, 60, 65, 69], BAR + 0.6, 0.06, 0.8, 0.9), 0.75, pan=-0.2)
                place(buf, S(0), strings([65, 69, 72, 77, 81], BAR + 0.6, 0.06, 0.8, 0.85, 0.006, 3, 0.8), 0.6)
                for m in (41, 53, 65):
                    place(buf, S(0), pizz(m, 1.2, 1.0, 0.4), 0.5)
            else:
                place(buf, S(0), horns([46, 58, 62, 65], BAR / 2 + 0.3, 0.1, 0.4, 0.7), 0.6, pan=-0.2)
                place(buf, S(0), strings([70, 74, 77, 82], BAR / 2 + 0.3, 0.1, 0.4, 0.7, 0.006, 3, 0.8), 0.45)
                place(buf, S(2), horns([53, 57, 60, 65], BAR / 2 + 1.4, 0.15, 1.2, 0.5), 0.5, pan=-0.2)
                place(buf, S(2), strings([69, 72, 77, 81], BAR / 2 + 1.4, 0.15, 1.2, 0.6, 0.006, 3, 0.8), 0.4)
                place(buf, S(2), timp(41, 2.0, 0.6), 0.5)
        if sec == "E":
            # the kitchen: soft low strings and a celesta playing the theme's opening, slowly
            ch = PROG[bar]
            place(buf, S(0), strings([n - 12 for n in CH[ch][:3]], BAR + 0.9, 0.6, 0.9, 0.25, 0.003, 3, 0.4), 0.3)
            mel = [THEME[0], THEME[1], THEME[3]][bar - 27]
            for e, m in enumerate(mel):
                if m is not None and e % 2 == 0:
                    place(buf, S(e / 2), celesta(m + 12, 2.0), 0.3, pan=0.15)
    # 1:00 the button: a warm F major chord, piano + strings + bell, ringing out
    s = fr(1800)
    for m in (41, 53, 60, 65, 69, 72, 77):
        place(buf, s, g.piano(m, 3.8, 0.65), 0.2)
    place(buf, s, strings([53, 60, 65, 69], 3.9, 0.3, 1.6, 0.3, 0.003, 3, 0.6), 0.3)
    place(buf, s, g.bell(89, 3.6), 0.12)
    buf = reverb(buf, rt=2.1, wet=0.3)
    fade_in = np.minimum(1, t_of(N) / 0.05)
    fade_out = np.clip((DUR - t_of(N)) / 1.5, 0, 1)
    return buf * (fade_in * fade_out)[:, None]


# ------------------------------------------------------------------ sound effects
def purr(dur=1.6, rate=26.0):
    """A purr: a rough buzz of ~26 pulses a second (rich in harmonics, like the real thing), through a
    soft nasal resonance, swelling on each breath in and out."""
    n = int(dur * SR)
    t = t_of(n)
    ph = np.cumsum(rate * (1 + 0.06 * lp(rng.standard_normal(n), 6) * 8)) / SR
    pulses = np.exp(-((ph % 1.0 - 0.5) / 0.07) ** 2)  # one soft click per cycle -> buzz
    breath = 0.45 + 0.55 * np.sin(2 * np.pi * t / 0.95 - 1.2) ** 2
    src = pulses + 0.15 * lp(rng.standard_normal(n), 2500)
    x = bp(src, 90, 1600) + 0.8 * bp(src, 350, 700)
    return x * breath * env_adsr(n, 0.12, 0.1, 0.9, 0.35)


def mrrp(f0=520, dur=0.32):
    """A short questioning 'mrrp' trill (not a word, just a cat noise)."""
    n = int(dur * SR)
    t = t_of(n)
    f = f0 * (1 + 0.35 * np.sin(np.pi * t / dur)) * (1 + 0.04 * np.sin(2 * np.pi * 32 * t))
    src = saw(f)
    x = bp(src, 500, 1500) + 0.5 * bp(src, 1800, 2600)
    return x * np.sin(np.pi * t / dur) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 30 * t))


def yawn(dur=1.1):
    n = int(dur * SR)
    t = t_of(n)
    f = 300 + 260 * np.sin(np.pi * np.minimum(1, t / (dur * 0.7))) ** 0.8
    src = saw(f) * 0.6 + rng.standard_normal(n) * 0.25
    x = bp(src, 450, 1400) * (0.6 + 0.4 * np.sin(np.pi * t / dur))
    return x * np.sin(np.pi * t / dur) ** 1.2 * 0.8


def snore(dur=1.8):
    """Two soft snores: a breathy, slightly buzzy inhale and a gentle sigh out."""
    n = int(dur * SR)
    t = t_of(n)
    br = np.maximum(0, np.sin(2 * np.pi * t / dur)) ** 2
    ph = np.cumsum(np.full(n, 34.0)) / SR
    buzz = np.exp(-((ph % 1.0 - 0.5) / 0.1) ** 2)
    inhale = (bp(rng.standard_normal(n), 300, 1800) * 0.6 + bp(buzz, 120, 1200)) * br
    sigh = bp(rng.standard_normal(n), 600, 3000) * np.maximum(0, -np.sin(2 * np.pi * t / dur)) ** 2 * 0.5
    return inhale + sigh


def clicks(times, f=4200, decay=900, jitter=0.15, scrape=0.0):
    """A run of small taps (claws on stone or tile, keys, paw pats) at the given times (s).
    Each tap has a click and a little body; `scrape` adds a soft drag of claw between taps."""
    n = int((max(times) + 0.25) * SR)
    out = np.zeros(n)
    L = int(0.06 * SR)
    tl = t_of(L)
    for tt in times:
        c = bp(rng.standard_normal(L), f * (1 - jitter), f * (1 + jitter)) * np.exp(-tl * decay)
        body = np.sin(2 * np.pi * f * 0.31 * tl) * np.exp(-tl * decay * 0.45) * 0.5
        s0 = int(tt * SR)
        out[s0 : s0 + L] += (c + body)[: n - s0] * (0.7 + 0.3 * rng.random())
    if scrape:
        t = t_of(n)
        out += bp(rng.standard_normal(n), 2500, 7000) * scrape * (0.5 + 0.5 * np.sin(2 * np.pi * t * 3.1) ** 2) * np.minimum(1, t / 0.05)
    return out


def creak(dur=0.7):
    """A short, friendly door creak: stick-slip pulses through a wooden resonance."""
    n = int(dur * SR)
    t = t_of(n)
    f = (70 + 60 * np.sin(np.pi * t / dur)) * (1 + 0.15 * lp(rng.standard_normal(n), 8))
    imp = (np.diff(np.floor(np.cumsum(f) / SR), prepend=0) > 0).astype(float)
    x = bp(imp, 500, 1600) * 6 + bp(imp, 1800, 3200) * 4
    return x * np.sin(np.pi * t / dur) ** 0.7


def rustle(dur=0.9, density=140):
    """Cardboard: crinkly band-limited crackles in bursts."""
    n = int(dur * SR)
    t = t_of(n)
    out = np.zeros(n)
    k = int(density * dur)
    for _ in range(k):
        s = int(rng.random() * (n - 900))
        L = int((0.004 + rng.random() * 0.012) * SR)
        tl = t_of(L)
        out[s : s + L] += rng.standard_normal(L) * np.exp(-tl * 300) * (0.3 + rng.random())
    x = bp(out, 900, 6000) + 0.4 * lp(out, 600)
    return x * np.sin(np.pi * t / dur) ** 0.6


def thunk(f0=95):
    L = int(0.35 * SR)
    tl = t_of(L)
    x = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.5 * np.exp(-tl * 40))) / SR) * np.exp(-tl * 14)
    return x + lp(rng.standard_normal(L), 1200) * np.exp(-tl * 60) * 0.5


def chirp(f0=3200, f1=4600, dur=0.09):
    n = int(dur * SR)
    t = t_of(n)
    f = f0 + (f1 - f0) * np.sin(np.pi * t / dur) + 250 * np.sin(2 * np.pi * 40 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 2


def birdsong(dur=1.4, seed=3):
    r = np.random.default_rng(seed)
    out = np.zeros(int((dur + 0.3) * SR))
    tt = 0.0
    while tt < dur:
        phrase = r.integers(2, 5)
        base = 2600 + r.random() * 1800
        for k in range(phrase):
            c = chirp(base * (1 + 0.08 * k), base * (1.3 + 0.1 * k), 0.06 + r.random() * 0.05)
            s = int((tt + k * 0.085) * SR)
            out[s : s + len(c)] += c * (0.6 + 0.4 * r.random())
        tt += 0.25 + r.random() * 0.35
    return out


def tink(f=2900):
    L = int(0.6 * SR)
    tl = t_of(L)
    return (np.sin(2 * np.pi * f * tl) + 0.5 * np.sin(2 * np.pi * f * 2.7 * tl) * np.exp(-tl * 10)) * np.exp(-tl * 7) * np.minimum(1, tl * 4000)


def fwump():
    L = int(0.3 * SR)
    tl = t_of(L)
    return lp(rng.standard_normal(L), 500) * np.exp(-tl * 18) * np.minimum(1, tl * 300)


def tonk(f=640):
    """A tap on a tin can."""
    L = int(0.4 * SR)
    tl = t_of(L)
    x = sum(a * np.sin(2 * np.pi * f * r * tl) * np.exp(-tl * d) for r, a, d in [(1, 1, 14), (2.32, 0.6, 20), (4.1, 0.35, 30), (6.3, 0.2, 40)])
    return x * np.minimum(1, tl * 5000)


def pulltab():
    """Can opening: a click, a short hiss of air, a little metallic ring."""
    L = int(0.6 * SR)
    tl = t_of(L)
    click = hp(rng.standard_normal(L), 2500) * np.exp(-tl * 400) * 1.2
    hiss = bp(rng.standard_normal(L), 3000, 9000) * np.exp(-((tl - 0.06) / 0.09) ** 2) * 0.5
    ring = (np.sin(2 * np.pi * 2350 * tl) + 0.5 * np.sin(2 * np.pi * 5300 * tl)) * np.exp(-tl * 9) * 0.25
    return click + hiss + ring


def glide(notes, dur=0.6):
    """A harp glissando up through the given notes."""
    out = np.zeros(int((dur + 1.4) * SR))
    for k, m in enumerate(notes):
        p = pizz(m, 1.3, 0.8, 0.7) * 0.8
        s = int(k * dur / len(notes) * SR)
        out[s : s + len(p)] += p
    return out


def car_by(dur=1.4):
    n = int(dur * SR)
    t = t_of(n)
    x = lp(rng.standard_normal(n), 900) * (1 / (1 + ((t - dur / 2) / 0.25) ** 2))
    return x


def stereo(x, pan=0.0):
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1) if x.ndim == 1 else x


def sfx():
    """Two lists of (start sample, stereo clip):
    accents  - the story's sound effects; each is levelled to sit ~9 dB above the (ducked) music
    textures - whooshes, ticks, press thunks: quiet glue at fixed levels relative to the music"""
    accents, textures = [], []

    def acc(frame, x, pan=0.0, soft=0.0):
        x = x / (np.max(np.abs(x)) + 1e-12)
        if soft:  # round off the sharpest transient peaks (tanh), so short sounds can sit louder without clipping
            x = np.tanh(x * (1 + soft * 3)) / np.tanh(1 + soft * 3)
        accents.append((fr(frame), stereo(x, pan)))

    def tex(sample, x, db, pan=0.0):
        textures.append((sample, stereo(pk(x, db), pan)))

    # soft whoosh across every scene dissolve, peaking at its midpoint (4 frames before the cut)
    for i, c in enumerate(CUTS):
        d = 1.0 + 0.15 * (i % 3)
        w = g.whoosh(d, 260 + 40 * (i % 4), 2000 + 300 * (i % 3))
        tex(fr(c - 4) - int(d * 0.6 * SR), w, -17, 0.2 if i % 2 else -0.2)
    # count-up ticks on every stats panel (eight per count)
    for b in BEATS["beats"]:
        if b.get("stat"):
            t0 = (b["start"] + 10.5) / FPS
            for k in range(1, 9):
                u = 1 - (1 - k / 8) ** (1 / 3)
                tex(int((t0 + u * 0.9) * SR), g.tick(), -26 + 3 * (k == 8), 0.2)

    # beat 1: the governor purrs through a slow blink, then a little 'mrrp' at us
    acc(36, purr(1.7), -0.1)
    acc(66, mrrp(560), -0.1)
    # beat 2: soft typing around a sleeping cat, a tiny snore
    tex(fr(196), clicks(list(np.cumsum(0.11 + 0.08 * rng.random(22)))[:20], 2600, 420, 0.3), -17, 0.3)
    acc(250, snore(1.6), -0.2)
    # beat 3: cats pop up across the map (rising notes), then every head snaps round at once
    pops = np.zeros(int(1.8 * SR))
    for k, f in enumerate([310, 316, 322, 329, 336, 343, 350, 356]):
        p = g.pop([660, 740, 880, 990, 1110, 1320, 1480, 1760][k])
        s0 = fr(f - 310)
        pops[s0 : s0 + len(p)] += p
    acc(310, pops, soft=0.7)
    snap = np.zeros(int(0.6 * SR))
    snap[: int(0.22 * SR)] += pk(g.whoosh(0.22, 1500, 5000, 0.5), -6)
    for m in (77, 81, 84):
        snap += pizz(m, 0.6, 1.0, 0.8)[: len(snap)]
    acc(369, snap, soft=0.6)
    # beat 4: the door creaks open; the cat looks back up with a questioning pluck
    acc(434, creak(0.75), 0.2)
    acc(488, np.concatenate([pizz(72, 0.18), pizz(79, 0.6)]), -0.1)
    # beat 5: claws tapping on stone along the rooftops
    acc(588, clicks([0.0, 0.16, 0.29, 0.47, 0.6, 0.79, 0.93, 1.1], 3600, 380, 0.25, scrape=0.06), 0.3, soft=1)
    # beat 6: cars passing below, a purr from the cushions
    tex(fr(676), car_by(1.4), -22, -0.5)
    acc(724, purr(1.5), 0.2)
    tex(fr(742), car_by(1.4), -23, 0.5)
    # beat 7: an ultrasonic shimmer, the glass tinks off the table into the net, bird videos
    tex(fr(800), glide([96, 100, 103, 108], 0.25), -24, 0.4)
    acc(828, tink(3100), -0.2, soft=0.5)
    acc(839, fwump(), -0.2)
    tex(fr(855), birdsong(1.3, 4), -19, 0.3)
    # beat 8: the press dents each box as it passes; cats settle into boxes with a rustle
    L, X0, XP, SP, GAP, NB = 9.45, -4.6, -0.5, 0.75, 1.05, 9
    for i in range(NB):
        for k in range(-2, 3):
            tt = ((XP - X0) - i * GAP + k * L) / SP
            if 0.1 < tt < 3.9:
                tex(fr(900 + tt * FPS), thunk(), -19, -0.2)
    acc(955, rustle(1.0), 0.3, soft=0.8)
    # beat 9: the paw stamp comes down; later, the council nods off
    acc(1054, thunk(70) + 0.6 * np.pad(rustle(0.15, 300), (0, int(0.35 * SR) - int(0.15 * SR))), soft=0.6)
    acc(1092, snore(1.7), -0.3)
    # beat 10: paw prints patter along the lot lines; the staring contest
    tex(fr(1158), clicks(list(np.arange(0, 1.6, 0.09)), 900, 400, 0.4), -20, 0.2)
    acc(1200, np.concatenate([pizz(65, 0.22, 1.0, 0.8), pizz(64, 0.8, 1.0, 0.8)]) + 0.0)
    # beat 11: birds in the dome
    tex(fr(1270), birdsong(1.6, 8), -18, -0.3)
    tex(fr(1325), birdsong(1.2, 9), -20, 0.3)
    # beat 12: the lone cat yawns and purrs on its estate
    acc(1450, yawn(1.0), 0.3)
    acc(1478, purr(1.2), 0.3)
    # beat 13: the orchestral hit is in the music; a long whoosh as the camera cranes up
    tex(fr(1556) - int(1.6 * 0.6 * SR), g.whoosh(1.6, 200, 2400), -16)
    # beat 14: the can ceremony
    acc(1626, tonk(640), -0.2, soft=0.6)
    acc(1651, tonk(610), -0.2, soft=0.6)
    acc(1662, glide([65, 69, 72, 77, 81, 84], 0.55), 0.1)
    acc(1691, pulltab(), 0.1, soft=1)
    acc(1692, choir([65, 69, 72, 77], 1.6))
    acc(1694, g.shimmer(2.0), 0.2)
    acc(1710, clicks([0.0, 0.24, 0.47, 0.72, 0.95, 1.2, 1.42], 3000, 380, 0.2, scrape=0.03), -0.2, soft=1)
    acc(1758, purr(1.9), 0.1)
    return accents, textures


# ------------------------------------------------------------------ mix
GAP_DB = 9.0  # each effect sits this far above the music (the brief: music 8-10 dB under the effects)
DUCK_DB = 5.0  # how far the music dips while an effect plays


def duck_envelope(accents, depths=None):
    """Music gain: dips around each accent (40 ms attack before it, 250 ms release after).
    The dip is DUCK_DB, or deeper for an accent that couldn't otherwise sit far enough above the music."""
    act = np.zeros(N)
    for i, (s, x) in enumerate(accents):
        d = DUCK_DB if depths is None else depths[i]
        e = np.abs(x).max(1)
        nz = np.nonzero(e > 0.02)[0]
        if len(nz):
            a0, a1 = max(0, s + nz[0] - int(0.04 * SR)), min(N, s + nz[-1])
            act[a0:a1] = np.maximum(act[a0:a1], d)
    from scipy.ndimage import uniform_filter1d
    a = math.exp(-1 / (0.25 * SR))
    out = np.empty(N)
    v = 0.0
    for i in range(N):
        v = act[i] if act[i] >= v else v * a
        out[i] = v
    out = uniform_filter1d(out, int(0.04 * SR))
    return 10 ** (-out / 20)


def momentary_max(x, s0, s1, win=0.1):
    """Max loudness of x[s0:s1] over short windows (default 100 ms, 25 ms hop), BS.1770 K-weighting.
    A short window measures short effects (a tink, a click) by their own sound, not by the silence around them."""
    w, hop = int(win * SR), int(0.025 * SR)
    seg = x[max(0, s0 - w // 2) : min(len(x), s1 + w // 2)]
    if len(seg) < w:
        seg = np.pad(seg, ((0, w - len(seg)), (0, 0)))
    y = g.k_weight(seg)
    best = -99.0
    for i in range(0, len(y) - w + 1, hop):
        ms = np.mean(y[i : i + w] ** 2, axis=0).sum()
        best = max(best, -0.691 + 10 * np.log10(ms + 1e-12))
    return best


def build(m_target, music_raw, accents, textures, duck):
    """Music at m_target LUFS (ducked), every accent levelled GAP_DB above the music under it."""
    m = music_raw * 10 ** ((m_target - g.lufs(music_raw)) / 20) * duck[:, None]
    shift = m_target + 17.0  # textures were tuned against music at -17 LUFS
    fx = np.zeros((N, 2))
    gaps = []
    for s, x in accents:
        e = s + len(x)
        mus = momentary_max(m, s, e)
        own = momentary_max(np.pad(x, ((0, 0), (0, 0))), 0, len(x))
        gain = 10 ** ((mus + GAP_DB - own) / 20)
        gain = min(gain, 10 ** (-1.0 / 20) / (np.max(np.abs(x)) + 1e-12))  # never above -1 dBFS before mastering
        place(fx, s, x * gain)
        gaps.append(own + 20 * math.log10(gain) - mus)
    for s, x in textures:
        place(fx, s, x * 10 ** (shift / 20))
    return m, fx, gaps


def main():
    out_dir = ROOT / "out" / "cat-kingdom" / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    music_raw = music()
    accents, textures = sfx()
    # choose the music level so the finished mix lands on -14 LUFS without extra gain, and duck deeper
    # (up to 12 dB) under any effect that can't otherwise sit GAP_DB above the music
    depths = [DUCK_DB] * len(accents)
    m_target = -18.0
    for _ in range(4):
        duck = duck_envelope(accents, depths)
        m, fx, gaps = build(m_target, music_raw, accents, textures, duck)
        depths = [min(12.0, d + max(0.0, GAP_DB - 0.5 - gp)) for d, gp in zip(depths, gaps)]
        m_target += -14.0 - g.lufs(m + fx)
    duck = duck_envelope(accents, depths)
    m, fx, gaps = build(m_target, music_raw, accents, textures, duck)
    mix = m + fx
    # ceiling -2.5 dBTP: AAC encoding adds up to ~1 dB of overshoot, and the finished MP4 must stay under -1 dBTP
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
