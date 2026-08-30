import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  partialCalls: [] as { request: Request; response: Response }[],
}))

vi.mock('serwist', () => ({
  createPartialResponse: async (request: Request, response: Response) => {
    mocks.partialCalls.push({ request, response })
    return new Response('sliced', { status: 206, headers: { 'content-length': '6' } })
  },
}))

import { BASEMAP_CACHE, BASEMAP_PATH } from '@/lib/map/basemapConstants'
import {
  evictStaleBasemap,
  handleBasemapRequest,
  warmBasemapCache,
} from '@/lib/map/basemapRequest'

/** Enough of the Cache API for these paths, keyed by URL like the real one. */
function createCacheStub() {
  const store = new Map<string, Response>()
  const cache = {
    match: async (key: string) => store.get(key),
    put: async (key: string, response: Response) => {
      store.set(key, response)
    },
    delete: async (key: string) => store.delete(key),
  }
  const opened: string[] = []
  return {
    store,
    opened,
    caches: { open: async (name: string) => (opened.push(name), cache) },
  }
}

const fullArchive = () =>
  new Response('a'.repeat(64), { status: 200, headers: { 'content-length': '64' } })

const rangedRequest = () =>
  new Request('https://example.test' + BASEMAP_PATH, { headers: { range: 'bytes=0-15' } })

let stub: ReturnType<typeof createCacheStub>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  mocks.partialCalls.length = 0
  stub = createCacheStub()
  fetchMock = vi.fn(async () => fullArchive())
  vi.stubGlobal('caches', stub.caches)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('handleBasemapRequest', () => {
  it('slices the cached archive for a ranged request', async () => {
    stub.store.set(BASEMAP_PATH, fullArchive())

    const response = await handleBasemapRequest(rangedRequest())

    expect(response.status).toBe(206)
    expect(mocks.partialCalls).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(stub.opened).toEqual([BASEMAP_CACHE])
  })

  it('returns the whole archive when no range was asked for', async () => {
    stub.store.set(BASEMAP_PATH, fullArchive())

    const response = await handleBasemapRequest(
      new Request('https://example.test' + BASEMAP_PATH),
    )

    expect(response.status).toBe(200)
    expect(mocks.partialCalls).toHaveLength(0)
  })

  it('passes the ranged request through on a cache miss, keeping its Range header', async () => {
    // The network byte-serves correctly; answering from a not-yet-warm cache is
    // what would hand the reader a full body.
    const request = rangedRequest()

    await handleBasemapRequest(request)

    expect(fetchMock).toHaveBeenCalledWith(request)
    expect(fetchMock.mock.calls[0][0].headers.get('range')).toBe('bytes=0-15')
  })

  it('never answers a ranged request with a full 200, whatever the cache holds', async () => {
    // The reported failure: pmtiles throws "content-length exceeding request"
    // on any 200 bigger than what it asked for. A partial or errored cache
    // entry must fall through to the network, never be served as-is.
    for (const poisoned of [
      new Response('partial', { status: 206 }),
      new Response('', { status: 404 }),
    ]) {
      stub.store.set(BASEMAP_PATH, poisoned)
      fetchMock.mockClear()
      fetchMock.mockResolvedValue(new Response('sliced', { status: 206 }))

      const response = await handleBasemapRequest(rangedRequest())

      expect(response.status).not.toBe(200)
      expect(fetchMock).toHaveBeenCalled()
    }
  })

  it('warms the cache in the background on a miss', async () => {
    const waitUntil = vi.fn()

    await handleBasemapRequest(rangedRequest(), waitUntil)

    expect(waitUntil).toHaveBeenCalledTimes(1)
    await waitUntil.mock.calls[0][0]
    expect(stub.store.get(BASEMAP_PATH)?.status).toBe(200)
  })
})

describe('warmBasemapCache', () => {
  it('stores the complete archive, fetched without a Range header', async () => {
    await warmBasemapCache()

    expect(fetchMock).toHaveBeenCalledWith(BASEMAP_PATH, { cache: 'no-store' })
    expect(stub.store.get(BASEMAP_PATH)?.status).toBe(200)
  })

  it('does not re-download an archive it already holds', async () => {
    stub.store.set(BASEMAP_PATH, fullArchive())

    await warmBasemapCache()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches nothing when the archive is not deployed', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))

    await warmBasemapCache()

    expect(stub.store.has(BASEMAP_PATH)).toBe(false)
  })
})

describe('evictStaleBasemap', () => {
  it('drops the cached archive when the deployed ETag differs', async () => {
    stub.store.set(
      BASEMAP_PATH,
      new Response('old', { status: 200, headers: { etag: '"old"' } }),
    )
    fetchMock.mockResolvedValue(new Response('', { status: 200, headers: { etag: '"new"' } }))

    await evictStaleBasemap()

    expect(stub.store.has(BASEMAP_PATH)).toBe(false)
  })

  it('keeps the archive when the ETag still matches', async () => {
    stub.store.set(
      BASEMAP_PATH,
      new Response('same', { status: 200, headers: { etag: '"same"' } }),
    )
    fetchMock.mockResolvedValue(new Response('', { status: 200, headers: { etag: '"same"' } }))

    await evictStaleBasemap()

    expect(stub.store.has(BASEMAP_PATH)).toBe(true)
  })

  it('keeps the archive when offline', async () => {
    stub.store.set(BASEMAP_PATH, fullArchive())
    fetchMock.mockRejectedValue(new Error('offline'))

    await evictStaleBasemap()

    expect(stub.store.has(BASEMAP_PATH)).toBe(true)
  })
})
