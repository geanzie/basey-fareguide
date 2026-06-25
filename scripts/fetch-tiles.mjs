// Pre-pack OpenStreetMap raster tiles for the Basey service area so the map
// works fully offline (served from /tiles via the service worker).
//
// Usage:
//   node scripts/fetch-tiles.mjs            # default zoom 11..15
//   node scripts/fetch-tiles.mjs 11 16      # custom min/max zoom
//
// OSM tile policy: bulk downloading is rate-limited and discouraged at scale.
// This is a ONE-TIME pull of a tiny municipal bbox, throttled, with a
// descriptive User-Agent. Do not run it in a loop or per build. If coverage
// needs to grow, switch to a self-hosted or commercial tile source.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Basey service-area bbox — mirrors SERVICE_AREA in
// src/app/api/routes/calculate/route.ts
const BBOX = { latMin: 11.1, latMax: 11.5, lngMin: 124.8, lngMax: 125.3 }

const MIN_ZOOM = Number(process.argv[2] ?? 11)
const MAX_ZOOM = Number(process.argv[3] ?? 15)
const THROTTLE_MS = 120
const USER_AGENT =
  'BaseyFareCheck/1.0 offline tile prefetch (municipal use; contact: ocenagener@gmail.com)'
const OUT_DIR = 'public/tiles'

const lon2tile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2tile = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const subdomains = ['a', 'b', 'c']
let subIndex = 0
const nextSubdomain = () => subdomains[subIndex++ % subdomains.length]

async function main() {
  const manifest = []
  let downloaded = 0
  let skipped = 0

  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const xMin = lon2tile(BBOX.lngMin, z)
    const xMax = lon2tile(BBOX.lngMax, z)
    // y is inverted: north (latMax) gives the smaller y.
    const yMin = lat2tile(BBOX.latMax, z)
    const yMax = lat2tile(BBOX.latMin, z)

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const rel = `${z}/${x}/${y}.png`
        const outPath = `${OUT_DIR}/${rel}`
        manifest.push(`/tiles/${rel}`)

        const { existsSync } = await import('node:fs')
        if (existsSync(outPath)) {
          skipped++
          continue
        }

        const url = `https://${nextSubdomain()}.tile.openstreetmap.org/${rel}`
        try {
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
          if (!res.ok) {
            console.warn(`skip ${rel}: HTTP ${res.status}`)
            continue
          }
          const buf = Buffer.from(await res.arrayBuffer())
          await mkdir(dirname(outPath), { recursive: true })
          await writeFile(outPath, buf)
          downloaded++
          if (downloaded % 100 === 0) console.log(`  ...${downloaded} tiles`)
        } catch (err) {
          console.warn(`error ${rel}: ${err.message}`)
        }
        await sleep(THROTTLE_MS)
      }
    }
    console.log(`zoom ${z}: x[${xMin}..${xMax}] y[${yMin}..${yMax}]`)
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest))
  console.log(
    `done: ${downloaded} downloaded, ${skipped} cached, ${manifest.length} tiles in manifest`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
