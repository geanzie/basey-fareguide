# Basey FareCheck promotional video

`public/promo/basey-farecheck-promo.mp4` — 2:01, 1920×1080, 30 fps, with a Tagalog (Taglish)
voice-over over a music bed; the on-screen text stays English. No subtitle track:
`narration.tl.srt` is the voice-over script, `captions.srt` the English one.

The landing page (`src/components/landing/LandingVideo.tsx`) plays it from
`public/promo/`, next to its poster (`basey-farecheck-promo-poster.webp`, the
frame at 0:18). There is no captions file. Re-make the poster when
the video changes. The service worker does not precache `*.mp4`
(`next.config.ts`), so the file downloads only when someone presses play.

| Time | Scene | What it covers |
| --- | --- | --- |
| 0:00 | Hook | Riding a tricycle or habal-habal? Get the answer to "How much is the fare?" before you board |
| 0:07 | The problem | Guessing, drop-off arguments, skipped discounts, no proof of overcharging |
| 0:15 | Brand reveal | Basey FareCheck: *Know the fare before you ride.* |
| 0:22 | How it works | Pick a trip, measured by road, see the approved fare (sample: 5.2 km → ₱24.00) |
| 0:37 | Rider features | 20% student/senior/PWD discount, permit QR scan, overcharging reports, offline fares |
| 0:48 | Legal basis | RA 7160 (Local Government Code) → Municipal Ordinance No. 105, s. 2023 → the app, shown over the ordinance itself |
| 1:01 | What the law says | Secs. 2, 7, 24, 19(k), 19(n), 29–30; RA 11314, RA 9994, RA 10754; RA 10173 (Data Privacy Act) |
| 1:14 | Built to stay lawful | Verified routes only, fare changes need an SB issuance, penalties cite their section |
| 1:24 | Advantages: commuters | Fair price, discounts, trip proof, a voice when overcharged, confidence for visitors, plus drivers |
| 1:36 | Advantages: government | Evidence-based enforcement, one shared record, town-wide fare updates, auditable franchise actions, planning data |
| 1:49 | Call to action | *Know the fare before you ride.* |

The sample fare uses the seeded ₱15 base for 3 km plus ₱3 per extra km, and
the video labels it as a sample. If the Sangguniang Bayan changes the rate,
update the numbers in scene 4 of `promo.html` and re-render.

## Voice-over

`narration.py` speaks each cue of a script at the cue's start, mixes it over
`music.wav` with the music ducked under the voice, and writes `soundtrack.wav`.

- **Tagalog (shipped):** `python3 narration.py` reads `narration.tl.srt`, a
  hand-written Taglish script on the same cue times as `captions.srt`, and
  speaks it with Microsoft's `fil-PH-BlessicaNeural` through `edge-tts`
  (`pip install edge-tts numpy`; needs internet and `ffmpeg` on the `PATH`).
  Tagalog runs longer than English, so its lines are shorter and leave some
  details to the on-screen text (the ordinance's date and vote, the Act's
  year). If you change a cue time in `promo.html`, change it here too. Free
  use of the Edge voice service for published media is a grey area in
  Microsoft's terms; a recorded human voice-over avoids that.
- **English:** `python3 narration.py en` reads `captions.srt` with Piper TTS,
  the same voice as basey-queueflow's display board (`en_US-lessac-medium`).
- **Human (recorded):** `python3 narration.py rec` builds the voice-over from
  a person reading `narration.tl.srt`, one take per cue. Both TTS voices sound
  machine-made (each line is spoken on its own, long lines are sped up), so
  this is the way to a voice that sounds like a person.

### Recording a human voice-over

1. `python3 narration.py rec --list` prints the recording sheet: each cue's
   number, the seconds its take may last, and the line.
2. Record one take per cue with a phone voice-memo app, in a quiet room with
   curtains or a bed nearby (soft things stop echo), phone about 20 cm from
   the mouth. Read it the way you would tell a friend, not like an
   announcement; keep the Taglish. Small changes to the wording are fine.
3. Save the takes in `voice/` (git-ignored), named by cue number with any
   extension ffmpeg reads: `01.m4a`, `02.m4a`, ... `14.m4a`.
4. `python3 narration.py rec` cleans each take (low cut, light denoise,
   silence trimmed off both ends, gentle compression), levels all takes to
   the same loudness, and mixes them over the music. A take is not sped up
   unless it is longer than its slot, and then only up to 6%
   (`REC_MAX_TEMPO`, pitch kept). A line the report shows as `starts late`
   follows a take that was too long; re-record that take a little tighter.
5. Swap the audio into the MP4 (below) and listen.

ffmpeg must be on the `PATH` (`sudo apt install ffmpeg`), and building the mix
needs numpy: the repo's `.venv` has none, so `deactivate` it and use the system
`python3` (Ubuntu ships numpy as `python3-numpy`). Waray works the same
way: write a `narration.war.srt` on the same cue times and add a `LANGUAGES`
entry like `rec` that reads it.

Some cues are longer than their slot, so they are spoken up to 18% faster
(`MIN_LENGTH_SCALE`), and a clip that still runs long pushes the next one
back (about 1.4s at most). `PRONOUNCE` spells the local words as IPA phonemes, which Piper reads inside
`[[ ]]`: Basey `bɐsˈej` (ba-SAY), habal-habal `hɐbˈal hɐbˈal` (ha-BAL ha-BAL),
Sangguniang Bayan `saŋɡʊnjˈaŋ bɐjˈan` (sang-gu-NYANG ba-YAN). The script keeps
the real spelling.

```bash
pip install piper-tts==1.8.0 numpy
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
python3 music.py
python3 narration.py en   # reads PIPER_MODEL_PATH, default ./en_US-lessac-medium.onnx
```

To swap only the audio without re-rendering frames:

```bash
ffmpeg -i ../../public/promo/basey-farecheck-promo.mp4 -i soundtrack.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 160k -movflags +faststart out.mp4
```

`render.mjs` rewrites `captions.srt` from `promo.html`, so after changing the
script there, render once and then run `narration.py` and render again (or swap
the audio as above). A human voice-over, or one in Waray, can replace
`soundtrack.wav` the same way.

## Re-rendering

Every frame comes from `promo.html`. Open it in a browser to preview the
whole video playing live.

```bash
cd promo/video
npm i --no-save --prefix /tmp/pw playwright-core
python3 music.py                          # writes music.wav (needs numpy)
NODE_PATH=/tmp/pw/node_modules node render.mjs              # full MP4, ~4 min
NODE_PATH=/tmp/pw/node_modules node render.mjs --stills 5,30  # PNG stills
```

Set `CHROMIUM_PATH` if Playwright can't find a Chromium on its own, and make
sure `ffmpeg` is on the `PATH`.

`assets/` holds pages 1 and 5 of `public/ordinances/municipal-ordinance-no-105.pdf`
(rendered with `pdftoppm -r 110`), the brand files from `public/brand/`, and
local copies of the Bricolage Grotesque and Inter fonts (SIL Open Font License).
