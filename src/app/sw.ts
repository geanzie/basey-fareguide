import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, Serwist } from "serwist";

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

const DATA_CACHE = "basey-data-v1";

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

      try {
        // Road graph for offline routing.
        const cache = await caches.open(DATA_CACHE);
        await cache.add("/data/basey-roads.geojson");
      } catch {
        // Graph not fetched yet — offline routing falls back to straight-line.
      }
    })(),
  );
});

// A rebuilt archive must not be shadowed by the copy a client already holds.
self.addEventListener("activate", (event) => {
  event.waitUntil(evictStaleBasemap());
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
      // Bundled road graph for offline routing.
      matcher: ({ url }) => url.pathname.startsWith("/data/"),
      handler: new CacheFirst({ cacheName: DATA_CACHE }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
