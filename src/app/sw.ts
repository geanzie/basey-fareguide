import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const TILE_CACHE = "basey-tiles-v1";
const DATA_CACHE = "basey-data-v1";

// Precache the pre-packed Basey bbox tiles on install so the map is fully
// usable offline before the user pans anywhere. The list is emitted by
// scripts/fetch-tiles.mjs as /tiles/manifest.json.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/tiles/manifest.json", { cache: "no-cache" });
        if (res.ok) {
          const urls = (await res.json()) as string[];
          const cache = await caches.open(TILE_CACHE);
          await cache.addAll(urls);
        }
      } catch {
        // Manifest missing (tiles not fetched yet) — runtime caching still works.
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
      // Pre-packed local Basey tiles.
      matcher: ({ url }) => url.pathname.startsWith("/tiles/"),
      handler: new CacheFirst({
        cacheName: TILE_CACHE,
        plugins: [
          new ExpirationPlugin({ maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 180 }),
        ],
      }),
    },
    {
      // Live OSM fallback tiles (areas outside the bbox / higher zooms).
      matcher: ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
      handler: new CacheFirst({
        cacheName: "osm-tiles-runtime",
        plugins: [
          new ExpirationPlugin({ maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 }),
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
