// Build-time extractor for the Basey road network. Pulls highway ways from the
// Overpass API for the service-area bbox and writes a compact GeoJSON
// LineString FeatureCollection consumed by the on-device offline router
// (src/lib/routing/offlineGraph.ts).
//
// Usage:
//   node scripts/fetch-roads.mjs
//
// OSM/Overpass policy: rate-limited. Run ONCE, not per build. Output is cached
// in public/data. Data © OpenStreetMap contributors (ODbL).

import { mkdir, writeFile } from 'node:fs/promises'

// Mirrors SERVICE_AREA in src/app/api/routes/calculate/route.ts
const BBOX = { latMin: 11.1, latMax: 11.5, lngMin: 124.8, lngMax: 125.3 }

const OUT = 'public/data/basey-roads.geojson'
const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const USER_AGENT =
  'BaseyFareCheck/1.0 offline road graph build (municipal use; contact: ocenagener@gmail.com)'

// Drivable / rideable classes for jeepney, tricycle, habal-habal, multicab.
const EXCLUDED = new Set([
  'steps',
  'elevator',
  'construction',
  'proposed',
  'corridor',
  'platform',
])

const COORD_DP = 5

function round(n) {
  return Number(n.toFixed(COORD_DP))
}

async function main() {
  const query = `[out:json][timeout:120];
way["highway"](${BBOX.latMin},${BBOX.lngMin},${BBOX.latMax},${BBOX.lngMax});
out geom;`

  console.log('querying Overpass...')
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const features = []

  for (const el of data.elements) {
    if (el.type !== 'way' || !Array.isArray(el.geometry)) continue
    const highway = el.tags?.highway
    if (!highway || EXCLUDED.has(highway)) continue

    const coords = el.geometry.map((g) => [round(g.lon), round(g.lat)])
    if (coords.length < 2) continue

    features.push({
      type: 'Feature',
      properties: { highway, oneway: el.tags?.oneway ?? null },
      geometry: { type: 'LineString', coordinates: coords },
    })
  }

  const fc = { type: 'FeatureCollection', features }
  await mkdir('public/data', { recursive: true })
  await writeFile(OUT, JSON.stringify(fc))

  const bytes = Buffer.byteLength(JSON.stringify(fc))
  console.log(
    `done: ${features.length} road segments, ${(bytes / 1024).toFixed(0)} KB raw -> ${OUT}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
