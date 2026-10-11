"""Generates the whole soundtrack in code: music + sound effects, mixed and mastered.

- Music: cinematic electronic, 120 bpm (one bar = 2 s = 60 frames), D major. Soft pads and rain first,
  a growing pulse as the flood spreads, then warm piano as the clouds clear, and a final button note.
- Sound effects: rain, whooshes on every cloud-bank transition and big camera move, ticks on every
  count-up, pops when objects arrive, warning tones, a soft boom when the floods join.
  Every cue is placed on an exact video frame (timings come from scene/beats.json).
- Mix: music sits ~9 dB under the effects; master to -14 LUFS integrated with true peak below -1 dBTP.

Run:  .venv/bin/python audio/generate.py     -> out/audio/soundtrack.wav (48 kHz stereo float)
"""

import json
import math
import pathlib

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
BEATS = json.loads((ROOT / "scene" / "beats.json").read_text())
SR = 48000
FPS = BEATS["fps"]
DUR = BEATS["totalFrames"] / FPS
N = int(round(DUR * SR))
BPM = BEATS["bpm"]
BEAT = 60 / BPM  # 0.5 s
BAR = 4 * BEAT  # 2 s
rng = np.random.default_rng(30)


def fr(frame):
    """Video frame -> sample index (exact)."""
    return int(round(frame / FPS * SR))


def t_of(n):
    return np.arange(n) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, start, x, gain=1.0, pan=0.0):
    """Add a mono or stereo clip into the stereo buffer at sample `start` with equal-power pan."""
    if x.ndim == 1:
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    a, b = max(0, start), min(len(buf), start + len(x))
    if b > a:
        buf[a:b] += x[a - start : b - start] * gain


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, hold=None):
    hold = n / SR - a - d - r if hold is None else hold
    seg = [np.linspace(0, 1, max(1, int(a * SR))), np.linspace(1, s, max(1, int(d * SR))), np.full(max(0, int(hold * SR)), s), np.linspace(s, 0, max(1, int(r * SR)))]
    e = np.concatenate(seg)
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, f1, f2, order=2):
    return signal.sosfilt(signal.butter(order, [f1, f2], "band", fs=SR, output="sos"), x, axis=0)


# ------------------------------------------------------------------ instruments
def pad_chord(notes, dur, bright=0.5, detune=0.07):
    n = int(dur * SR)
    t = t_of(n)
    out = np.zeros((n, 2))
    for m in notes:
        f = mtof(m)
        for ch, dt in ((0, -detune), (1, detune)):
            ph = rng.random() * 6.28
            ff = f * 2 ** (dt / 12)
            # soft saw from a few harmonics (premium, not buzzy)
            w = sum((0.6 ** k) * np.sin(2 * np.pi * ff * (k + 1) * t + ph * (k + 1)) for k in range(5))
            out[:, ch] += w
    out = lp(out, 900 + 2600 * bright)
    e = env_adsr(n, a=0.6, d=0.4, s=0.85, r=0.8)
    return out * e[:, None] / max(1, len(notes))


def pluck(m, dur=0.9, bright=0.6):
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9) + 0.15 * np.sin(6 * np.pi * f * t) * np.exp(-t * 14)
    x *= np.exp(-t * (3.5 - bright * 1.5)) * np.minimum(1, t * 400)
    return x


def piano(m, dur=2.2, vel=0.8):
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m)
    B = 0.0004
    x = np.zeros(n)
    for k in range(1, 8):
        fk = f * k * math.sqrt(1 + B * k * k)
        x += (vel ** (0.5 + k * 0.15)) / k ** 1.1 * np.sin(2 * np.pi * fk * t + rng.random()) * np.exp(-t * (0.9 + k * 0.55))
    ham = hp(rng.standard_normal(n) * np.exp(-t * 90), 1500) * 0.05 * vel
    x = (x + ham) * np.minimum(1, t * 600)
    return x * 0.5


def bell(m, dur=2.5):
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m)
    parts = [(1, 1.0, 1.2), (2.76, 0.5, 2.0), (5.4, 0.25, 3.0), (8.93, 0.12, 4.5)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in parts) * np.minimum(1, t * 800) * 0.4


def bass_note(m, dur, cutoff=500):
    n = int(dur * SR)
    t = t_of(n)
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sign(np.sin(2 * np.pi * f * t)) * 0.5
    x = lp(x, cutoff)
    return x * np.exp(-t * 5.0) * np.minimum(1, t * 300)


def kick(dur=0.45):
    n = int(dur * SR)
    t = t_of(n)
    f = 45 + 80 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * np.minimum(1, t * 2000)


def hat(dur=0.05):
    n = int(dur * SR)
    t = t_of(n)
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * 90)


# ------------------------------------------------------------------ music
def music():
    buf = np.zeros((N, 2))
    D = 50  # D3
    chords = {
        "D": [D, D + 4, D + 7, D + 11, D + 14], "Bm": [D - 3, D + 2, D + 5, D + 9, D + 14], "G": [D - 7, D - 3, D, D + 4, D + 9],
        "A": [D - 5, D - 1, D + 2, D + 7, D + 9], "Em": [D - 10, D - 3, D + 2, D + 5, D + 9], "Dsus": [D, D + 5, D + 7, D + 12, D + 14],
    }
    roots = {"D": 38, "Bm": 35, "G": 31, "A": 33, "Em": 28, "Dsus": 38}
    # one chord per bar (32 bars = 64 s)
    prog = (["D", "Bm", "G", "A"] * 2)[:7]  # bars 0-6   gentle (0-14 s)
    prog += ["Bm", "G", "D", "A"] * 2 + ["Bm", "G", "A"]  # bars 7-17 pulse grows (14-36 s)
    prog += ["Em", "G", "Bm", "A"]  # bars 18-21 sustain (36-44 s)
    prog += ["G", "D", "A", "D", "Bm", "G", "Dsus", "D"]  # bars 22-29 warm piano (44-60 s)
    prog += ["D", "D"]  # bars 30-31 end card
    for bar, ch in enumerate(prog):
        t0 = bar * BAR
        s = int(t0 * SR)
        act = 0 if bar < 7 else 1 if bar < 18 else 2 if bar < 22 else 3 if bar < 30 else 4
        bright = [0.25, 0.45 + 0.04 * (bar - 7), 0.5, 0.55, 0.4][act]
        if bar < 30:
            place(buf, s, pad_chord(chords[ch], BAR + 0.8, bright=min(bright, 0.9)), gain=0.55 if act != 3 else 0.7)
        # Act 1: sparse plucked arpeggio
        if act == 0:
            for k, step in enumerate([0, 2, 3, 5, 6]):
                place(buf, s + int(step * BEAT / 2 * SR) + int(k * 0.0 * SR), pluck(chords[ch][k % 5] + 12, 1.1, 0.4), 0.14, pan=(-0.4 + 0.2 * k))
        # Act 2-3: 8th-note bass pulse, kick from bar 11, quiet 16th hats from bar 13
        if act in (1, 2):
            for e in range(8):
                vel = 0.55 + 0.15 * (e % 2 == 0)
                cutoff = 280 + 40 * (bar - 7) if act == 1 else 420
                place(buf, s + int(e * BEAT / 2 * SR), bass_note(roots[ch], BEAT / 2 * 0.95, cutoff), 0.42 * vel)
            if bar >= 11 and not (act == 2 and bar == 21):
                for q in range(4):
                    place(buf, s + int(q * BEAT * SR), kick(), 0.55)
            if bar >= 13:
                for h in range(16):
                    place(buf, s + int(h * BEAT / 4 * SR), hat(), 0.05 if h % 2 else 0.08, pan=0.3 if h % 2 else -0.2)
            if 15 <= bar <= 17:  # peak: high arpeggio
                for k in range(8):
                    place(buf, s + int(k * BEAT / 2 * SR), pluck(chords[ch][k % 5] + 24, 0.6, 0.8), 0.07, pan=(k % 2) * 0.6 - 0.3)
        # Act 4: warm piano melody over the chords
        if act == 3:
            mel = {"G": [74, 71, 69], "D": [69, 66, 64], "A": [73, 69, 66], "Bm": [71, 69, 66], "Dsus": [74, 72, 69]}[ch]
            place(buf, s, piano(roots[ch] + 12, 2.6, 0.6), 0.85, pan=-0.15)
            for k, m in enumerate(mel):
                place(buf, s + int((k * 1.5) * BEAT * SR), piano(m, 2.0, 0.55 + 0.1 * (k == 0)), 0.75, pan=0.15)
    # Button note on the end card (frame 1800): D major piano chord + bell
    s = fr(1800)
    for m in (38, 50, 57, 62, 66, 69, 74):
        place(buf, s, piano(m, 3.6, 0.7), 0.5)
    place(buf, s, bell(86, 3.5), 0.28)
    # Fade in / fade out
    fade_in = np.minimum(1, t_of(N) / 1.5)
    fade_out = np.clip((DUR - t_of(N)) / 1.2, 0, 1)
    buf *= (fade_in * np.maximum(fade_out, 0))[:, None] ** 1.0
    return buf


# ------------------------------------------------------------------ sound effects
def rain_bed():
    """Continuous rain whose intensity follows the story (and the nine storm pulses of beat 4)."""
    t = t_of(N)
    white = rng.standard_normal((N, 2))
    hiss = bp(white, 2500, 9000) * 0.6 + bp(white, 600, 2500) * 0.25
    f = t * FPS
    inten = np.interp(f, [0, 60, 300, 420, 540, 660, 900, 1080, 1200, 1320, 1370, 1380], [0, 0.35, 0.45, 0.6, 0.75, 0.55, 0.6, 0.65, 0.4, 0.3, 0.05, 0])
    storm = (f >= 420) & (f < 540)
    pulse = np.where(storm, 0.55 + 0.45 * np.abs(np.sin((f - 420) / 120 * np.pi * 9)) ** 0.6, 1.0)
    inten = inten * pulse
    out = hiss * inten[:, None]
    # droplets: tiny tuned ticks, density follows intensity
    n_drops = 5000
    times = np.sort(rng.random(n_drops) * DUR)
    for tt in times:
        i = int(tt * SR)
        k = inten[min(i, N - 1)]
        if rng.random() > k:
            continue
        L = 240
        tl = t_of(L)
        d = np.sin(2 * np.pi * (2500 + rng.random() * 3500) * tl) * np.exp(-tl * 900) * 0.25
        place(out, i, d, 1.0, pan=rng.random() * 1.6 - 0.8)
    return out


def whoosh(dur=1.0, f0=300, f1=2500, rise=0.6):
    """Filtered noise sweep (time-varying band-pass), peak at `rise` of its length."""
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    fc = np.where(t < rise, f0 * (f1 / f0) ** (t / rise), f1 * (f0 / f1) ** ((t - rise) / (1 - rise)))
    y = np.zeros(n)
    lo = bp_s = 0.0
    q = 0.35
    for i in range(n):  # state-variable filter
        f = 2 * math.sin(math.pi * min(fc[i], 18000) / SR)
        hi_ = noise[i] - lo - q * bp_s
        bp_s += f * hi_
        lo += f * bp_s
        y[i] = bp_s
    env = np.where(t < rise, (t / rise) ** 2, ((1 - t) / (1 - rise)) ** 1.5)
    return y * env * 0.5


def tick():
    L = 900
    tl = t_of(L)
    return (np.sin(2 * np.pi * 3200 * tl) * 0.6 + np.sin(2 * np.pi * 1600 * tl) * 0.4) * np.exp(-tl * 260)


def pop(pitch=880):
    L = int(0.12 * SR)
    tl = t_of(L)
    f = pitch * (1 + 0.6 * np.exp(-tl * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tl * 28) * np.minimum(1, tl * 3000)


def tone(m, dur, vib=0.0):
    n = int(dur * SR)
    tl = t_of(n)
    f = mtof(m) * (1 + vib * np.sin(2 * np.pi * 5 * tl))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return x * env_adsr(n, 0.02, 0.1, 0.7, 0.15)


def warning():
    return np.concatenate([tone(69, 0.22), np.zeros(int(0.05 * SR)), tone(65, 0.32)]) * 0.5


def boom(dur=2.2, f0=70):
    n = int(dur * SR)
    tl = t_of(n)
    f = f0 * (0.6 + 0.4 * np.exp(-tl * 3))
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tl * 2.2)
    rumble = lp(rng.standard_normal(n), 180) * np.exp(-tl * 2.5) * 0.6
    return (sub + rumble) * np.minimum(1, tl * 200)


def swell(dur=3.2):
    n = int(dur * SR)
    tl = t_of(n)
    x = lp(rng.standard_normal(n), 300) * 0.8 + np.sin(2 * np.pi * 41 * tl) * 0.6
    return x * (tl / dur) ** 2 * np.exp(-np.maximum(0, tl - dur * 0.92) * 30)


def rush(dur, up=True):
    n = int(dur * SR)
    tl = t_of(n)
    brown = np.cumsum(rng.standard_normal(n))
    brown = hp(brown - np.mean(brown), 30)
    x = bp(brown / np.max(np.abs(brown)), 180, 1400) * (1 + 0.3 * np.sin(2 * np.pi * 0.7 * tl))
    e = np.minimum(1, tl / (dur * 0.5)) if up else np.ones(n)
    return x * e * np.minimum(1, (dur - tl) / 0.6)


def gulp():
    L = int(0.35 * SR)
    tl = t_of(L)
    f = 260 * np.exp(-tl * 6) + 90
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tl * 9) * 0.8


def power_down():
    L = int(0.9 * SR)
    tl = t_of(L)
    f = 420 * np.exp(-tl * 3.2) + 30
    hum = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    click = hp(rng.standard_normal(L), 2000) * np.exp(-tl * 200) * 0.5
    return lp(hum, 1800) * np.exp(-tl * 2.5) * 0.7 + click


def shimmer(dur=2.8):
    out = np.zeros(int(dur * SR))
    for k, m in enumerate([86, 90, 93, 98, 102]):
        b = bell(m, dur - k * 0.12)
        out[int(k * 0.12 * SR) : int(k * 0.12 * SR) + len(b)] += b * (0.9 - k * 0.12)
    return out


def sfx():
    buf = rain_bed()
    cues = {}
    for b in BEATS["beats"]:
        for c in b["sound"]:
            cues.setdefault(c["cue"], []).append((b, b["start"] + c["at"]))
    for cue, items in cues.items():
        for b, f in items:
            s = fr(f)
            if cue == "ticks" and b.get("stat"):
                # one tick each time the count-up passes another twelfth of its value (ease-out curve)
                t_start = f / FPS
                for k in range(1, 13):
                    p = k / 12
                    u = 1 - (1 - p) ** (1 / 3)  # invert outCubic
                    place(buf, fr(t_start * FPS + u * 0.9 * FPS), tick(), 0.16 * (0.6 + 0.4 * (k == 12)), pan=0.2)
            elif cue in ("whoosh-soft", "whoosh-map", "whoosh-big"):
                d, a, bb = {"whoosh-soft": (0.9, 400, 2200), "whoosh-map": (1.1, 300, 3000), "whoosh-big": (1.4, 200, 2600)}[cue]
                place(buf, s - int(d * 0.6 * SR), whoosh(d, a, bb), 0.5, pan=-0.2)
            elif cue == "water-swell":
                place(buf, s, rush(3.8), 0.32)
                place(buf, s, tone(62, 3.6) * np.linspace(0.2, 1, int(3.6 * SR)) * 0.15, 0.6)
            elif cue == "soil-gulp":
                place(buf, s, gulp(), 0.45)
            elif cue == "rush-rise":
                place(buf, s, rush(4.0), 0.36)
            elif cue == "warning-tone":
                place(buf, s, warning(), 0.32)
            elif cue == "swell-deep":
                place(buf, s, swell(3.3), 0.7)
                place(buf, s, rush(6.0), 0.45)
            elif cue == "boom-soft":
                place(buf, s, boom(2.4, 62), 0.75)
            elif cue == "power-down":
                place(buf, s, power_down(), 0.45, pan=0.3)
            elif cue == "clear-shimmer":
                place(buf, s, shimmer(), 0.35, pan=0.1)
            elif cue == "reveal-boom":
                place(buf, s, boom(2.6, 55), 0.5)
                place(buf, s + int(0.05 * SR), bell(81, 2.5), 0.2)
    # Whoosh on every cloud-bank transition (peaks on the cut frame)
    for cut in (228, 300, 420, 660, 1320, 1440, 1620):
        d = 1.0
        place(buf, fr(cut) - int(d * 0.6 * SR), whoosh(d, 350, 2800), 0.45, pan=0.2)
    # Pops when objects arrive on screen (springs in the scene)
    for f, p in [(1100, 660), (1108, 740), (1135, 520), (1262, 880)] + [(1640 + 4 * i, 990 + 60 * i) for i in range(5)]:
        place(buf, fr(f), pop(p), 0.22, pan=0.25)
    return buf


# ------------------------------------------------------------------ loudness (ITU-R BS.1770-4)
def k_weight(x):
    # pre-filter (high shelf) + RLB high-pass, coefficients for 48 kHz
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def lufs(x):
    y = k_weight(x)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.mean(y[i : i + blk] ** 2, axis=0).sum() for i in range(0, len(y) - blk, hop)])
    l = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[l > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = g[(-0.691 + 10 * np.log10(g)) > rel]
    return -0.691 + 10 * np.log10(g2.mean())


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(up)) + 1e-12)


def main():
    out_dir = ROOT / "out" / "audio"
    out_dir.mkdir(parents=True, exist_ok=True)
    m = music()
    s = sfx()
    lm, ls = lufs(m), lufs(s)
    # Music sits about 9 dB under the effects
    m *= 10 ** ((ls - 9 - lm) / 20)
    mix = m + s
    # Master: gain to -14 LUFS, then a gentle soft-clip limiter, re-check, iterate
    target = -14.0
    for _ in range(4):
        mix *= 10 ** ((target - lufs(mix)) / 20)
        ceiling = 10 ** (-1.5 / 20)
        mix = np.tanh(mix / ceiling) * ceiling
    stats = {"music_lufs_rel": round(lufs(m) - lufs(s), 1), "integrated_lufs": round(lufs(mix), 2), "true_peak_dbtp": round(true_peak_db(mix), 2), "seconds": round(len(mix) / SR, 3)}
    wavfile.write(out_dir / "soundtrack.wav", SR, mix.astype(np.float32))
    wavfile.write(out_dir / "music.wav", SR, m.astype(np.float32))
    wavfile.write(out_dir / "sfx.wav", SR, s.astype(np.float32))
    (out_dir / "stats.json").write_text(json.dumps(stats, indent=1))
    print(stats)


if __name__ == "__main__":
    main()
