import type { FarePolicySnapshotDto } from "@/lib/contracts";
import type { Coordinates } from "@/lib/routing/providers/base";

const DB_NAME = "basey-offline";
const STORE = "routes";
const DB_VERSION = 1;

export interface CachedRoute {
  distanceKm: number;
  durationMin: number | null;
  polyline: string | null;
  /** Fare policy active when this route was computed online. */
  farePolicy: FarePolicySnapshotDto;
}

/**
 * Pair key from origin/destination, rounded to 4 dp (~11 m) to match the
 * server routing cache precision so the same pin pair hits the same entry.
 */
export function routePairKey(origin: Coordinates, destination: Coordinates): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(origin.lat)},${r(origin.lng)}->${r(destination.lat)},${r(destination.lng)}`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function saveCachedRoute(key: string, value: CachedRoute): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

export async function loadCachedRoute(key: string): Promise<CachedRoute | null> {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise<CachedRoute | null>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as CachedRoute) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return value;
}
