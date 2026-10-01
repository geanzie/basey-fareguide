# Basey FareCheck promotional video

`basey-farecheck-promo.mp4` — 2:01, 1920×1080, 30 fps, with a music bed and an
English subtitle track (switch it on in your player).

| Time | Scene | What it covers |
| --- | --- | --- |
| 0:00 | Hook | Thousands of daily tricycle and habal-habal rides start with "How much is the fare?" |
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

The video has no narration. `captions.srt` has the script with timings, so
it can be recorded as a voice-over (or translated into Waray or Filipino) and
mixed over `music.wav`.

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
