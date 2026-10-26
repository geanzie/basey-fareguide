"""Writes soundtrack.wav: a voice-over mixed over music.wav.

    python3 narration.py            # Tagalog (Taglish): narration.tl.srt, Microsoft fil-PH voice
    python3 narration.py en         # English: captions.srt, Piper voice
    python3 narration.py rec        # human takes in voice/, one per cue of narration.tl.srt
    python3 narration.py rec --list # recording sheet: each cue, its slot length, missing takes

The shipped video uses the Tagalog voice-over. Its script, narration.tl.srt,
is hand-written and keeps captions.srt's cue times, so after changing a cue's
time in promo.html, change it in both. The Tagalog voice is fil-PH-BlessicaNeural
through edge-tts (pip install edge-tts), which needs internet access and ffmpeg
on the PATH to decode its MP3s.

Each subtitle cue is spoken as one clip starting at the cue's start time. A
clip longer than its cue is re-rendered faster (never below MIN_LENGTH_SCALE);
if it still runs long, the next clip waits for it instead of overlapping. The
music is ducked under the voice.

The English voice is the same Piper voice as basey-queueflow's display board:

    pip install piper-tts==1.8.0 numpy
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
    python3 promo/video/music.py
    PIPER_MODEL_PATH=./en_US-lessac-medium.onnx python3 promo/video/narration.py

A recorded human voice sounds like a person, which neither TTS voice does.
For `rec`, put one take per cue in voice/, named by cue number (01.m4a,
02.wav, ...; anything ffmpeg decodes). Each take is cleaned (low cut, light
denoise, silence trimmed off both ends, gentle compression) and all takes are
levelled to the same loudness. A take is never sped up unless it is longer
than its slot, and then by REC_MAX_TEMPO at most (pitch kept); a take still
too long pushes the next one back, which the report shows as "starts late".
Re-record those lines a little tighter.

render.mjs muxes soundtrack.wav in place of music.wav when it exists.
"""
import asyncio
import io
import os
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

try:
    import numpy as np
except ImportError:  # --list works without it; building the mix does not
    np = None

HERE = Path(__file__).parent
RATE = 44100
MIN_LENGTH_SCALE = 0.82  # fastest speaking rate allowed when fitting a cue
GAP = 0.15               # seconds of quiet kept before the next cue starts
VOICE_GAIN = 0.9
MUSIC_UNDER_VOICE = 0.3  # music level while the voice speaks
DUCK_RAMP = 0.35         # seconds for the music to dip and recover
REC_MAX_TEMPO = 1.06     # fastest a human take is played to fit its cue
REC_RMS = 0.08           # loudness every human take is levelled to
VOICE_DIR = HERE / 'voice'

# Local words spelled as IPA phonemes (Piper reads [[ ]] as raw phonemes), so
# the English voice says them with Filipino vowels and a single stress, chosen
# by ear from auditioned variants. The subtitles/script keep the real spelling.
PRONOUNCE = {
    'Basey': '[[bɐsˈej]]',                              # ba-SAY
    'habal-habal': '[[hɐbˈal hɐbˈal]]',                 # ha-BAL ha-BAL
    'Sangguniang Bayan': '[[saŋɡʊnjˈaŋ bɐjˈan]]',       # sang-gu-NYANG ba-YAN
    'Ordinance No.': 'Ordinance Number',
}


def parse_srt(path):
    cues = []
    for block in path.read_text(encoding='utf-8').strip().split('\n\n'):
        lines = block.strip().splitlines()
        a, b = re.findall(r'(\d+):(\d+):(\d+),(\d+)', lines[1])
        to_s = lambda h, m, s, ms: int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
        cues.append((to_s(*a), to_s(*b), ' '.join(lines[2:])))
    return cues


def spoken(text):
    for word, say in PRONOUNCE.items():
        text = text.replace(word, say)
    return text


def piper_synth():
    """English: Piper, with local words spelled as IPA (PRONOUNCE)."""
    from piper import PiperVoice, SynthesisConfig

    model = os.environ.get('PIPER_MODEL_PATH', str(HERE / 'en_US-lessac-medium.onnx'))
    voice = PiperVoice.load(model)

    def synth(i, text, length_scale):
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            voice.synthesize_wav(spoken(text), w, syn_config=SynthesisConfig(length_scale=length_scale))
        buf.seek(0)
        with wave.open(buf, 'rb') as w:
            rate = w.getframerate()
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768
        # Linear resample to the music's rate; plenty for speech.
        n = int(len(pcm) * RATE / rate)
        return np.interp(np.linspace(0, len(pcm) - 1, n), np.arange(len(pcm)), pcm)

    return synth


def edge_synth(voice):
    """Tagalog: a Microsoft neural voice through edge-tts. It already says
    Basey, habal-habal and Sangguniang Bayan the Filipino way, so no PRONOUNCE."""
    import edge_tts

    def synth(i, text, length_scale):
        # length_scale 0.82 (22% shorter) is edge-tts rate "+22%".
        rate = f'{round((1 / length_scale - 1) * 100):+d}%'
        with tempfile.TemporaryDirectory() as tmp:
            mp3 = Path(tmp) / 'cue.mp3'
            asyncio.run(edge_tts.Communicate(text, voice, rate=rate).save(str(mp3)))
            raw = subprocess.run(
                ['ffmpeg', '-loglevel', 'error', '-i', str(mp3), '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'],
                check=True, capture_output=True,
            ).stdout
        return np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768

    return synth


def take_path(i):
    """The take for cue i (0-based) in voice/, e.g. voice/03.m4a, or None."""
    found = sorted(VOICE_DIR.glob(f'{i + 1:02d}.*'))
    return found[0] if found else None


def rec_synth():
    """Human: one recorded take per cue from voice/, cleaned and levelled.
    length_scale below 1 plays the take faster; atempo keeps the pitch."""
    def synth(i, text, length_scale):
        tempo = 1 / length_scale
        trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05'
        filters = [
            'highpass=f=80',
            'afftdn=nf=-25',
            trim, 'areverse', trim, 'areverse',  # trim both ends
            'acompressor=threshold=-20dB:ratio=3:attack=10:release=150',
        ]
        if tempo > 1.001:
            filters.append(f'atempo={tempo:.4f}')
        raw = subprocess.run(
            ['ffmpeg', '-loglevel', 'error', '-i', str(take_path(i)), '-af', ','.join(filters),
             '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'],
            check=True, capture_output=True,
        ).stdout
        clip = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768
        # Level by the RMS of the voiced part only, so pauses inside a take
        # do not make it come out louder than the others.
        voiced = clip[np.abs(clip) > 0.02]
        rms = np.sqrt(np.mean(voiced ** 2)) if len(voiced) else 0
        return clip * (REC_RMS / rms) if rms else clip

    return synth


LANGUAGES = {
    'tl': ('narration.tl.srt', lambda: edge_synth('fil-PH-BlessicaNeural')),
    'en': ('captions.srt', piper_synth),
    'rec': ('narration.tl.srt', rec_synth),
}


def recording_sheet(cues):
    """Print each cue with the seconds a take may last; True if none missing."""
    complete = True
    for i, (start, end, text) in enumerate(cues):
        slot = (cues[i + 1][0] if i + 1 < len(cues) else end) - start - GAP
        take = take_path(i)
        status = take.name if take else 'MISSING'
        complete = complete and take is not None
        print(f'{i + 1:02d}  {slot:5.2f}s  [{status}]  {text}')
    return complete


def read_wav(path):
    with wave.open(str(path), 'rb') as w:
        assert w.getframerate() == RATE and w.getsampwidth() == 2
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768
        return pcm.reshape(-1, w.getnchannels())


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'tl'
    script, make_synth = LANGUAGES[mode]
    cues = parse_srt(HERE / script)
    if mode == 'rec':
        complete = recording_sheet(cues)
        if '--list' in sys.argv:
            sys.exit(0 if complete else 1)
        if not complete:
            sys.exit(f'record the MISSING takes into {VOICE_DIR} first')
    if np is None:
        sys.exit(f'numpy is missing for {sys.executable}; run with /usr/bin/python3 '
                 '(after `deactivate` if a venv is active) or `pip install numpy`')
    synth = make_synth()
    min_scale = 1 / REC_MAX_TEMPO if mode == 'rec' else MIN_LENGTH_SCALE
    music = read_wav(HERE / 'music.wav')
    narration = np.zeros(len(music))

    free_at = 0.0  # when the previous clip (plus GAP) has finished
    for i, (start, end, text) in enumerate(cues):
        # A clip waits for the one before it, so an overrun shifts later
        # cues rather than overlapping them.
        at = max(start, free_at)
        limit = cues[i + 1][0] if i + 1 < len(cues) else end
        room = max(limit - at - GAP, end - start - GAP)
        scale = 1.0
        clip = synth(i, text, scale)
        # Length is not exactly proportional to length_scale; refine twice.
        for _ in range(2):
            if len(clip) / RATE <= room or scale <= min_scale:
                break
            scale = max(min_scale, scale * room / (len(clip) / RATE))
            clip = synth(i, text, scale)
        length = len(clip) / RATE
        late = f'  starts {at - start:.2f}s late' if at > start else ''
        print(f'{i + 1:2d} {start:6.2f}s  {length:5.2f}s of {room:5.2f}s  x{scale:.2f}{late}')
        i0 = int(at * RATE)
        clip = clip[:len(narration) - i0]
        narration[i0:i0 + len(clip)] += clip
        free_at = at + length + GAP

    # Duck: music drops to MUSIC_UNDER_VOICE wherever the voice is speaking.
    win = int(0.05 * RATE)
    level = np.convolve(np.abs(narration), np.ones(win) / win, mode='same')
    speaking = (level > 0.01).astype(np.float64)
    ramp = int(DUCK_RAMP * RATE)
    speaking = np.convolve(speaking, np.ones(ramp) / ramp, mode='same').clip(0, 1)
    duck = 1 - (1 - MUSIC_UNDER_VOICE) * speaking

    mix = music * duck[:, None] + VOICE_GAIN * narration[:, None]
    mix /= max(1.0, np.max(np.abs(mix)) / 0.95)

    out = HERE / 'soundtrack.wav'
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(music.shape[1])
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((mix * 32767).astype('<i2').tobytes())
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
