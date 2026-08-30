import type * as Leaflet from 'leaflet'

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const PROTOMAPS_ATTRIBUTION = '<a href="https://protomaps.com">Protomaps</a>'

/**
 * The self-hosted basemap archive. A single PMTiles file covering the Basey
 * service-area bbox, built by `scripts/build-basemap.mjs` from the public
 * Protomaps OSM build.
 *
 * Nothing here talks to tile.openstreetmap.org. Bulk-fetching that server is
 * against its usage policy and gets the origin IP blocked, which is what the
 * previous raster layer ran into.
 *
 * Override the location (e.g. to serve the archive from MinIO on the NAS
 * instead of `public/`) with NEXT_PUBLIC_BASEMAP_URL.
 */
const BASEMAP_URL = process.env.NEXT_PUBLIC_BASEMAP_URL || '/map/basey.pmtiles'

/**
 * The deepest zoom present in the archive — mirrors `--maxzoom` in
 * `scripts/build-basemap.mjs`. Vector tiles are overzoomed past this rather
 * than requested, so the map stays sharp up to MAX_ZOOM.
 */
const MAX_DATA_ZOOM = 15
const MAX_ZOOM = 19

/**
 * Add the base map to `map`.
 *
 * One vector layer rendered from the local PMTiles archive — no remote tile
 * server, no API key, and the whole service area works offline once the
 * archive is cached (see the `/map/` entry in `src/app/sw.ts`).
 *
 * Async because `protomaps-leaflet` is browser-only and must be imported the
 * same way Leaflet itself is. Both callers already run inside a client effect.
 */
export async function addBaseTileLayer(map: Leaflet.Map): Promise<Leaflet.Layer> {
  const { leafletLayer } = await import('protomaps-leaflet')

  const layer = leafletLayer({
    url: BASEMAP_URL,
    flavor: 'light',
    lang: 'en',
    maxDataZoom: MAX_DATA_ZOOM,
    maxZoom: MAX_ZOOM,
    attribution: `${OSM_ATTRIBUTION} | ${PROTOMAPS_ATTRIBUTION}`,
  }) as unknown as Leaflet.Layer

  layer.addTo(map)
  return layer
}
