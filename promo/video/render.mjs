// Renders promo.html to an MP4, frame by frame.
//
//   npm i --no-save playwright-core        (once; uses the local Chromium)
//   python3 promo/video/music.py           (writes music.wav)
//   python3 promo/video/narration.py       (optional: writes soundtrack.wav, voice + music)
//   node promo/video/render.mjs            (writes public/promo/basey-farecheck-promo.mp4)
//
// Options: --stills t1,t2,...  writes PNG stills at those seconds instead.
//          CHROMIUM_PATH=...     Chromium binary (default: Playwright's lookup).
//
// Also writes captions.srt from the narration lines in promo.html. It is the
// voice-over script for narration.py; the MP4 carries no subtitle track.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const here = dirname(fileURLToPath(import.meta.url))
const FPS = 30
const args = process.argv.slice(2)
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(pathToFileURL(join(here, 'promo.html')).href + '?render')
await page.evaluate(() => document.fonts.ready)
await page.waitForLoadState('networkidle')

if (stillsArg) {
  for (const t of stillsArg.split(',').map(Number)) {
    await page.evaluate((t) => window.seek(t), t)
    await page.screenshot({ path: join(here, `still-${t}.png`) })
  }
  await browser.close()
  process.exit(0)
}

const { narration, duration } = await page.evaluate(() => ({
  narration: window.NARRATION,
  duration: window.DURATION,
}))

const stamp = (s) => {
  const ms = Math.round(s * 1000)
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}
writeFileSync(
  join(here, 'captions.srt'),
  narration.map(([a, b, text], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${text}\n`).join('\n'),
)

// The voiced soundtrack when narration.py has written one, else the music bed.
const music = [join(here, 'soundtrack.wav'), join(here, 'music.wav')].find(existsSync) ?? join(here, 'music.wav')
// Written straight into public/, where the landing page plays it from.
const out = join(here, '../../public/promo/basey-farecheck-promo.mp4')
const ffmpeg = spawn(
  'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(existsSync(music) ? ['-i', music, '-map', '1:a', '-c:a', 'aac', '-b:a', '160k'] : []),
    '-map', '0:v',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
)

const frames = Math.round(duration * FPS)
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS)
  const jpg = await page.screenshot({ type: 'jpeg', quality: 92 })
  if (!ffmpeg.stdin.write(jpg)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
  if (i % 300 === 0) console.log(`frame ${i}/${frames}`)
}
ffmpeg.stdin.end()
await new Promise((r) => ffmpeg.on('close', r))
await browser.close()
console.log(`wrote ${out}`)
