import { createPartialResponse } from 'serwist'

import { BASEMAP_CACHE, BASEMAP_PATH } from './basemapConstants'

/**
 * Service-worker handling for the PMTiles basemap archive.
 *
 * PMTiles reads the archive with HTTP Range requests, which makes it the one
 * asset where a plausible-looking caching strategy is actively harmful: hand a
 * ranged request the whole cached body and the reader throws
 *
 *   "Server returned no content-length header or content-length exceeding
 *    request. Check that your storage backend supports HTTP Byte Serving."
 *
 * because it only accepts a 200 whose Content-Length is no larger than what it
 * asked for. So the rule here is explicit rather than assembled from a strategy
 * plus plugins whose ordering and expiry semantics decide the outcome:
 *
 *   cached full copy  -> slice it, answer 206
 *   no cached copy    -> pass the ranged request to the network, which
 *                        byte-serves it correctly, and warm the cache behind it
 *
 * Either way a ranged request never receives a full 200.
 */

/**
 * Download the archive once and store the complete response.
 *
 * Deliberately fetched without a Range header: the cache holds one full body
 * that every later range is sliced out of. No-ops if already warm.
 */
export async function warmBasemapCache(): Promise<void> {
  const cache = await caches.open(BASEMAP_CACHE)
  if (await cache.match(BASEMAP_PATH)) return

  const response = await fetch(BASEMAP_PATH, { cache: 'no-store' })
  if (response.status === 200) {
    await cache.put(BASEMAP_PATH, response)
  }
}

/**
 * Answer one request for the archive.
 *
 * `waitUntil` keeps the background warm alive past the response; it is optional
 * so the function stays callable outside a fetch event.
 */
export async function handleBasemapRequest(
  request: Request,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const cache = await caches.open(BASEMAP_CACHE)
  const cached = await cache.match(BASEMAP_PATH)

  // Only a complete body can be sliced. Anything else is treated as a miss
  // rather than served as-is — serving it is exactly the bug.
  if (cached?.status === 200) {
    return request.headers.has('range') ? createPartialResponse(request, cached) : cached
  }

  waitUntil?.(warmBasemapCache().catch(() => {}))
  return fetch(request)
}

/**
 * Drop the cached archive when the deployed one no longer matches it.
 *
 * Without this a client keeps its first copy forever and never sees a rebuilt
 * basemap. Failure here means offline — keep what we have.
 */
export async function evictStaleBasemap(): Promise<void> {
  const cache = await caches.open(BASEMAP_CACHE)
  const cached = await cache.match(BASEMAP_PATH)
  if (!cached) return

  try {
    const head = await fetch(BASEMAP_PATH, { method: 'HEAD', cache: 'no-store' })
    const live = head.headers.get('etag')
    const held = cached.headers.get('etag')
    if (head.ok && live && held && live !== held) {
      await cache.delete(BASEMAP_PATH)
    }
  } catch {
    // Offline, or HEAD unsupported. The cached archive stays usable.
  }
}
