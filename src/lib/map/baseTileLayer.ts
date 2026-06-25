import type * as Leaflet from 'leaflet'

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** OSM subdomains for fallback round-robin. */
const OSM_SUBDOMAINS = ['a', 'b', 'c']

function osmTileUrl(coords: { x: number; y: number; z: number }): string {
  const sub = OSM_SUBDOMAINS[Math.abs(coords.x + coords.y) % OSM_SUBDOMAINS.length]
  return `https://${sub}.tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`
}

/**
 * Add the base map tiles: serve pre-packed Basey tiles from `/tiles` first
 * (works offline via the service worker), and fall back to live OSM tiles for
 * any tile not bundled locally (areas outside the bbox or higher zooms).
 */
export function addBaseTileLayer(L: typeof Leaflet, map: Leaflet.Map): Leaflet.TileLayer {
  const layer = L.tileLayer('/tiles/{z}/{x}/{y}.png', {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  })

  layer.on('tileerror', (event: Leaflet.TileErrorEvent) => {
    const tile = event.tile as HTMLImageElement & { dataset: DOMStringMap }
    // Guard against an infinite loop if the OSM tile also fails (offline).
    if (tile.dataset.osmFallback) return
    tile.dataset.osmFallback = '1'
    if (event.coords) {
      tile.src = osmTileUrl(event.coords)
    }
  })

  layer.addTo(map)
  return layer
}
