// Build the self-hosted basemap archive for the Basey service area.
//
// One PMTiles file, range-extracted from the public Protomaps daily OSM build
// (https://build.protomaps.com), written to public/map/basey.pmtiles and served
// by the app itself. Same OpenStreetMap data, same ODbL attribution — but no
// tile server in the request path, so there is no usage policy to violate and
// no rate limit to trip.
//
// This replaces the old scripts/fetch-tiles.mjs, which walked the bbox pulling
// raster tiles from tile.openstreetmap.org. That is bulk downloading, which the
// OSM Tile Usage Policy prohibits outright, and it got the origin IP blocked.
// Nothing in here may ever contact tile.openstreetmap.org again.
//
// Manual, occasional refresh — NOT a build step. Run it when the map data is
// stale enough to matter (new roads in Basey), not per deploy.
//
// Requires the `pmtiles` CLI (github.com/protomaps/go-pmtiles). Install it with
// your package manager, or let this script fetch a pinned release into
// .cache/ with --install-cli.
//
// Usage:
//   node scripts/build-basemap.mjs                 # latest available build
//   node scripts/build-basemap.mjs --install-cli   # fetch the CLI first
//   node scripts/build-basemap.mjs --date=20260815 # pin a build date
//   node scripts/build-basemap.mjs --maxzoom=14    # smaller archive

import { spawn } from 'node:child_process'
import { chmod, mkdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { arch, platform, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'

// Basey service-area bbox — mirrors SERVICE_AREA in
// src/app/api/routes/calculate/route.ts and LOCAL_BBOX's former role in
// src/lib/map/baseTileLayer.ts.
const BBOX = { latMin: 11.1, latMax: 11.5, lngMin: 124.8, lngMax: 125.3 }

const OUT_PATH = 'public/map/basey.pmtiles'

// Keep in step with MAX_DATA_ZOOM in src/lib/map/baseTileLayer.ts.
const DEFAULT_MAX_ZOOM = 15

const CLI_VERSION = '1.31.2'
const CLI_DIR = '.cache/pmtiles'

const args = process.argv.slice(2)
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const maxZoom = Number(flag('maxzoom') ?? DEFAULT_MAX_ZOOM)
const pinnedDate = flag('date')
const shouldInstallCli = args.includes('--install-cli')

function run(command, commandArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)),
    )
  })
}

function onPath(command) {
  return new Promise((resolvePromise) => {
    const probe = spawn(command, ['version'], { stdio: 'ignore' })
    probe.on('error', () => resolvePromise(false))
    probe.on('close', (code) => resolvePromise(code === 0))
  })
}

/** GoReleaser asset naming for go-pmtiles. */
function cliAssetName() {
  const os = { linux: 'Linux', darwin: 'Darwin', win32: 'Windows' }[platform()]
  const cpu = { x64: 'x86_64', arm64: 'arm64' }[arch()]
  if (!os || !cpu) {
    throw new Error(`No go-pmtiles release for ${platform()}/${arch()} — install the CLI manually.`)
  }
  const ext = os === 'Windows' ? 'zip' : 'tar.gz'
  return `go-pmtiles_${CLI_VERSION}_${os}_${cpu}.${ext}`
}

async function installCli() {
  const asset = cliAssetName()
  const url = `https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSION}/${asset}`
  const archivePath = join(tmpdir(), asset)

  console.log(`downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(archivePath))

  await mkdir(CLI_DIR, { recursive: true })
  if (asset.endsWith('.zip')) {
    await run('unzip', ['-o', archivePath, 'pmtiles', '-d', CLI_DIR])
  } else {
    await run('tar', ['-xzf', archivePath, '-C', CLI_DIR, 'pmtiles'])
  }
  await rm(archivePath, { force: true })

  const binary = resolve(CLI_DIR, platform() === 'win32' ? 'pmtiles.exe' : 'pmtiles')
  if (platform() !== 'win32') await chmod(binary, 0o755)
  console.log(`installed ${binary}`)
  return binary
}

async function resolveCli() {
  const local = resolve(CLI_DIR, platform() === 'win32' ? 'pmtiles.exe' : 'pmtiles')
  if (existsSync(local)) return local
  if (await onPath('pmtiles')) return 'pmtiles'
  if (shouldInstallCli) return installCli()

  throw new Error(
    'The `pmtiles` CLI was not found.\n' +
      '  Install it from https://github.com/protomaps/go-pmtiles/releases,\n' +
      '  or re-run this script with --install-cli to fetch it into .cache/pmtiles.',
  )
}

/**
 * Protomaps publishes a build most days but not every day, and today's may not
 * be up yet. Walk back until one answers a HEAD request.
 */
async function resolveBuildUrl() {
  if (pinnedDate) return `https://build.protomaps.com/${pinnedDate}.pmtiles`

  const day = new Date()
  for (let back = 0; back < 14; back++) {
    const stamp = day.toISOString().slice(0, 10).replace(/-/g, '')
    const url = `https://build.protomaps.com/${stamp}.pmtiles`
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok) return url
    day.setUTCDate(day.getUTCDate() - 1)
  }

  throw new Error('No Protomaps build found in the last 14 days — pass --date=YYYYMMDD.')
}

async function main() {
  const cli = await resolveCli()
  const source = await resolveBuildUrl()

  await mkdir('public/map', { recursive: true })
  // `pmtiles extract` refuses to overwrite, and a stale archive next to a
  // half-written one is worse than no archive.
  await rm(OUT_PATH, { force: true })

  console.log(`extracting ${source}`)
  console.log(`  bbox   ${BBOX.lngMin},${BBOX.latMin},${BBOX.lngMax},${BBOX.latMax}`)
  console.log(`  zoom   0..${maxZoom}`)

  await run(cli, [
    'extract',
    source,
    OUT_PATH,
    `--bbox=${BBOX.lngMin},${BBOX.latMin},${BBOX.lngMax},${BBOX.latMax}`,
    `--maxzoom=${maxZoom}`,
  ])

  const { size } = await stat(OUT_PATH)
  console.log(`done: ${OUT_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
