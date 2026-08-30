import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, RangeRequestsPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const BASEMAP_CACHE = "basey-basemap-v1";
const DATA_CACHE = "basey-data-v1";

/** Mirrors BASEMAP_URL in src/lib/map/baseTileLayer.ts. */
const BASEMAP_PATH = "/map/basey.pmtiles";

// Precache the basemap archive on install so the map is fully usable offline
// before the user pans anywhere. One PMTiles file covering the Basey bbox,
// built by scripts/build-basemap.mjs.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(BASEMAP_CACHE);
        await cache.add(BASEMAP_PATH);
      } catch {
        // Archive missing (not built yet) — runtime caching still works.
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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Self-hosted basemap archive. PMTiles is read with HTTP Range requests,
      // so RangeRequestsPlugin is what lets the single cached full response
      // satisfy the partial reads — without it every range request misses.
      matcher: ({ url }) => url.pathname === BASEMAP_PATH,
      handler: new CacheFirst({
        cacheName: BASEMAP_CACHE,
        plugins: [
          new RangeRequestsPlugin(),
          new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 180 }),
        ],
      }),
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
