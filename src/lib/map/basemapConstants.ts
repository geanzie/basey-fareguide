/**
 * Shared between the map layer and the service worker. Kept free of any
 * `serwist` import so the client bundle does not pull the worker runtime in.
 */

/** Default location of the self-hosted basemap archive. */
export const BASEMAP_PATH = '/map/basey.pmtiles'

/**
 * Cache holding the one archive. Bumped whenever the caching scheme changes,
 * so a client running the previous scheme starts clean rather than reading
 * entries written under different assumptions.
 */
export const BASEMAP_CACHE = 'basey-basemap-v2'
