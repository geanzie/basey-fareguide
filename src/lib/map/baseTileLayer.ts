import type * as Leaflet from 'leaflet'

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/**
 * The area and zoom range actually present in `public/tiles`. Mirrors BBOX and
 * the zoom arguments of `scripts/fetch-tiles.mjs` — if the pack is ever
 * extended, raise LOCAL_MAX_NATIVE_ZOOM to match, or the extra tiles are never
 * requested.
 */
const LOCAL_BBOX = { latMin: 11.1, latMax: 11.5, lngMin: 124.8, lngMax: 125.3 }
const LOCAL_MIN_ZOOM = 11
const LOCAL_MAX_NATIVE_ZOOM = 12
const MAX_ZOOM = 19

/**
 * Add the base map tiles.
 *
 * Two layers, because the local pack covers only Basey at zoom 11-12 while the
 * planner opens at zoom 13:
 *
 * - OSM underneath, covering every zoom and everywhere outside the bbox;
 * - the pre-packed `/tiles` on top, clamped to the bbox and to the zooms that
 *   exist on disk. Leaflet upscales the z12 tiles above `maxNativeZoom` rather
 *   than requesting tiles that would 404, and `bounds` stops it asking for
 *   anything outside the pack at all.
 *
 * Offline (service worker) the local pack still paints Basey; the OSM layer
 * underneath simply fails to load.
 */
export function addBaseTileLayer(L: typeof Leaflet, map: Leaflet.Map): Leaflet.TileLayer {
  L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: MAX_ZOOM,
  }).addTo(map)

  const localLayer = L.tileLayer('/tiles/{z}/{x}/{y}.png', {
    attribution: OSM_ATTRIBUTION,
    minZoom: LOCAL_MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxNativeZoom: LOCAL_MAX_NATIVE_ZOOM,
    bounds: L.latLngBounds(
      [LOCAL_BBOX.latMin, LOCAL_BBOX.lngMin],
      [LOCAL_BBOX.latMax, LOCAL_BBOX.lngMax],
    ),
  })

  // The bounds and zoom clamp should make this unreachable; keep it so a gap in
  // the pack degrades to a transparent tile over OSM instead of a broken image.
  localLayer.on('tileerror', (event: Leaflet.TileErrorEvent) => {
    const tile = event.tile as HTMLImageElement
    tile.style.display = 'none'
  })

  localLayer.addTo(map)
  return localLayer
}
