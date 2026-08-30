import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  layerOptions: [] as Record<string, unknown>[],
  addedTo: [] as unknown[],
}))

vi.mock('protomaps-leaflet', () => ({
  leafletLayer: (options: Record<string, unknown>) => {
    mocks.layerOptions.push(options)
    const layer = {
      addTo: (map: unknown) => {
        mocks.addedTo.push(map)
        return layer
      },
    }
    return layer
  },
}))

import { addBaseTileLayer } from '@/lib/map/baseTileLayer'

describe('addBaseTileLayer', () => {
  beforeEach(() => {
    mocks.layerOptions.length = 0
    mocks.addedTo.length = 0
  })

  it('adds exactly one layer, reading the self-hosted PMTiles archive', async () => {
    const map = {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addBaseTileLayer(map as any)

    expect(mocks.layerOptions).toHaveLength(1)
    expect(mocks.addedTo).toEqual([map])
    expect(mocks.layerOptions[0].url).toBe('/map/basey.pmtiles')
  })

  it('never points at a remote tile server', async () => {
    // Bulk-fetching tile.openstreetmap.org is against the OSM tile usage policy
    // and got the origin IP blocked — every visible tile came back as a 403
    // "Access blocked" image. The basemap must stay entirely self-hosted.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addBaseTileLayer({} as any)

    const url = String(mocks.layerOptions[0].url)
    expect(url.startsWith('/')).toBe(true)
    expect(url).not.toContain('openstreetmap.org')
  })

  it('credits OpenStreetMap, as ODbL requires', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addBaseTileLayer({} as any)

    expect(String(mocks.layerOptions[0].attribution)).toContain('OpenStreetMap')
  })

  it('stops requesting data past the deepest zoom the archive holds', async () => {
    // Mirrors --maxzoom in scripts/build-basemap.mjs. Set higher, the renderer
    // asks for tiles that are not in the file; set lower, detail is thrown away.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addBaseTileLayer({} as any)

    expect(mocks.layerOptions[0].maxDataZoom).toBe(15)
    expect(mocks.layerOptions[0].maxZoom).toBe(19)
  })
})
