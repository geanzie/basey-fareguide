"""Writes music.wav: a calm, royalty-free bed for the promo, synthesised here.

A I-V-vi-IV progression in D major as a soft pad, with a plucked arpeggio
that enters after the intro and drops out for the closing chord. Length
matches window.DURATION in promo.html.

    python3 promo/video/music.py
"""
import wave
from pathlib import Path

import numpy as np

RATE = 44100
DURATION = 121.0
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT

# MIDI notes. D, A, Bm, G.
CHORDS = [
    [50, 57, 62, 66, 69],
    [45, 57, 61, 64, 69],
    [47, 59, 62, 66, 71],
    [43, 55, 59, 62, 67],
]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


t = np.arange(int(RATE * DURATION)) / RATE
mix = np.zeros_like(t)

# Pad: detuned sines per chord, with a slow attack and release on each bar.
bars = int(np.ceil(DURATION / BAR))
for b in range(bars):
    start, end = b * BAR, min((b + 1) * BAR + 0.6, DURATION)
    i0, i1 = int(start * RATE), int(end * RATE)
    seg = t[i0:i1] - start
    env = np.minimum(seg / 0.8, 1) * np.minimum((end - start - seg) / 0.8, 1)
    chord = CHORDS[b % 4]
    for n in chord:
        f = hz(n)
        for det in (-0.12, 0.12):
            mix[i0:i1] += 0.035 * env * np.sin(2 * np.pi * (f + det) * seg)
        mix[i0:i1] += 0.012 * env * np.sin(2 * np.pi * 2 * f * seg)

# Pluck arpeggio in eighth notes, from bar 2 until the outro.
step = BEAT / 2
pattern = [0, 2, 3, 4, 3, 2, 1, 2]
k = 0
s = 2 * BAR
while s < DURATION - 9:
    b = int(s // BAR)
    chord = CHORDS[b % 4]
    n = chord[pattern[k % len(pattern)]] + 12
    i0 = int(s * RATE)
    length = int(0.9 * RATE)
    seg = np.arange(min(length, len(t) - i0)) / RATE
    f = hz(n)
    tone = np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(2 * np.pi * 2 * f * seg)
    mix[i0:i0 + len(seg)] += 0.05 * np.exp(-seg * 5.5) * tone
    s += step
    k += 1

# Soft kick on beats 1 and 3 through the middle section.
s = 4 * BAR
while s < DURATION - 13:
    i0 = int(s * RATE)
    seg = np.arange(int(0.25 * RATE)) / RATE
    sweep = 2 * np.pi * (55 * seg + 40 * (1 - np.exp(-seg * 30)) / 30)
    mix[i0:i0 + len(seg)] += 0.12 * np.exp(-seg * 14) * np.sin(sweep)
    s += 2 * BEAT

# Global fade in/out, then normalise.
fade = np.minimum(t / 2.5, 1) * np.minimum((DURATION - t) / 4.0, 1)
mix *= fade
mix /= np.max(np.abs(mix)) / 0.6
stereo = np.stack([mix, np.roll(mix, 300)], axis=1)

out = Path(__file__).with_name('music.wav')
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes((stereo * 32767).astype('<i2').tobytes())
print(f'wrote {out}')
