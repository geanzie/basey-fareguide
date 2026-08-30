import { describe, expect, it } from 'vitest'

import { addBaseTileLayer } from '@/lib/map/baseTileLayer'

type TileLayerCall = { url: string; options: Record<string, unknown> }

function createLeafletStub() {
  const calls: TileLayerCall[] = []
  const addOrder: string[] = []

  const L = {
    tileLayer: (url: string, options: Record<string, unknown>) => {
      calls.push({ url, options })
      const layer = {
        addTo: () => {
          addOrder.push(url)
          return layer
        },
        on: () => layer,
      }
      return layer
    },
    latLngBounds: (a: [number, number], b: [number, number]) => ({ a, b }),
  }

  return { L, calls, addOrder }
}

describe('addBaseTileLayer', () => {
  it('puts live OSM underneath the pre-packed Basey tiles', () => {
    const { L, addOrder } = createLeafletStub()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addBaseTileLayer(L as any, {} as any)

    expect(addOrder).toHaveLength(2)
    expect(addOrder[0]).toContain('tile.openstreetmap.org')
    expect(addOrder[1]).toBe('/tiles/{z}/{x}/{y}.png')
  })

  it('never asks for a local tile the pack does not contain', () => {
    // `public/tiles` holds zoom 11-12 for the Basey bbox only, while the
    // planner opens at zoom 13. Without the clamp every tile 404s and each one
    // is re-fetched from OSM — the console flood this test exists to prevent.
    const { L, calls } = createLeafletStub()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addBaseTileLayer(L as any, {} as any)

    const local = calls.find((call) => call.url.startsWith('/tiles/'))
    expect(local).toBeDefined()
    expect(local?.options.maxNativeZoom).toBe(12)
    expect(local?.options.minZoom).toBe(11)
    expect(local?.options.bounds).toBeDefined()
  })
})
