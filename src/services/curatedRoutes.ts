import { api } from './api';
import { saveCuratedCorpus } from '@/lib/offline/curatedCache';
import type { CuratedRouteCorpus } from '@/types/curatedRoutes';

/**
 * Pull the municipality's surveyed distance corpus and cache it on device.
 *
 * Called in the background after a successful online session, not on demand.
 * The point is that a rider who has been online at all can then price any
 * surveyed barangay pair from a dead zone — including pairs they have never
 * personally calculated, which a route-by-route cache could never cover.
 *
 * ~107 KB. Served public with a cache header, so a repeat call on a live
 * connection is cheap.
 */
export async function fetchCuratedRoutes(): Promise<CuratedRouteCorpus> {
  const corpus = await api.get<CuratedRouteCorpus>('/api/curated-routes');
  await saveCuratedCorpus(corpus);
  return corpus;
}
