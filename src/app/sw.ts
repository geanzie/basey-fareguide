import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";

import { BASEMAP_PATH } from "@/lib/map/basemapConstants";
import {
  evictStaleBasemap,
  handleBasemapRequest,
  warmBasemapCache,
} from "@/lib/map/basemapRequest";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The cache that held /data/basey-roads.geojson for the on-device road graph.
 *
 * That graph is gone: it produced distances that disagreed with the server's,
 * and an offline fare that disagrees with the driver's app is a dispute under
 * Ordinance 105. The name survives only so an already-installed worker can
 * reclaim the 2.8 MB it is still holding, and can be deleted once installs have
 * turned over.
 */
const RETIRED_DATA_CACHE = "basey-data-v1";

// Precache the basemap archive on install so the map is fully usable offline
// before the user pans anywhere. One PMTiles file covering the Basey bbox,
// built by scripts/build-basemap.mjs.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await warmBasemapCache();
      } catch {
        // Archive missing (not built yet) — the fetch handler falls back to
        // the network, which byte-serves ranges correctly.
      }
    })(),
  );
});

// A rebuilt archive must not be shadowed by the copy a client already holds.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await evictStaleBasemap();
      // Reclaim the retired road graph from clients that installed before it
      // was removed. Failure here must not block activation.
      await caches.delete(RETIRED_DATA_CACHE).catch(() => false);
    })(),
  );
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Self-hosted basemap archive, read with HTTP Range requests.
      //
      // An explicit handler rather than a strategy: with CacheFirst the answer
      // to a ranged request depends on plugin ordering and on ExpirationPlugin's
      // view of an entry's age, and any path that returns the cached body whole
      // breaks the PMTiles reader outright. See src/lib/map/basemapRequest.ts.
      matcher: ({ url }) => url.pathname === BASEMAP_PATH,
      handler: ({ request, event }) =>
        handleBasemapRequest(request, (promise) => event.waitUntil(promise)),
    },
    {
      // Self-hosted Leaflet marker assets.
      matcher: ({ url }) => url.pathname.startsWith("/leaflet/"),
      handler: new CacheFirst({ cacheName: "leaflet-assets" }),
    },
    {
      // The curated distance corpus, which is what lets an offline quote agree
      // with the server instead of estimating.
      //
      // The planner also keeps its own copy in localStorage, and that is what
      // the offline quote actually reads. This entry covers the gap that copy
      // cannot: a reload with no connection, where the fetch would otherwise
      // reject and leave the planner holding whatever it last persisted with no
      // way to notice a newer corpus. Stale-while-revalidate because a distance
      // that is a few minutes out of date still beats no distance at all.
      matcher: ({ url }) => url.pathname === "/api/curated-routes",
      handler: new StaleWhileRevalidate({ cacheName: "curated-routes" }),
    },
    {
      // Enforcement state gates mutating actions, so it must never be served
      // from cache. defaultCache ends with a catch-all NetworkFirst over every
      // same-origin /api/ GET (cacheName "apis", 24h, 10s network timeout); on a
      // slow connection that hands an enforcer a day-old queue whose rows still
      // offer Issue Ticket for incidents the server has already moved on from.
      // NetworkOnly, the same exemption defaultCache gives /api/auth/*.
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/incidents"),
      handler: new NetworkOnly({ networkTimeoutSeconds: 10 }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
