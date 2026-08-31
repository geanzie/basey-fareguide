/**
 * Mirrors BASEY_SERVICE_AREA / PH_BOUNDS / MAX_RAW_SAMPLE_ACCURACY_M in
 * ../frontend/src/lib/tracker/constants.ts, and the bounds guards in
 * ../frontend/src/app/api/routes/calculate/route.ts. Hand-maintained, like
 * src/types — changing them there means changing them here.
 *
 * These exist so a bad fix is refused before it costs a round trip: the quote
 * API answers an out-of-area pin with a 400 whose message reads to a rider like
 * a bug in the app.
 */

export interface Bounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export const PH_BOUNDS: Bounds = { latMin: 4, latMax: 22, lngMin: 114, lngMax: 128 };

export const BASEY_SERVICE_AREA: Bounds = {
  latMin: 11.1,
  latMax: 11.5,
  lngMin: 124.8,
  lngMax: 125.3,
};

/** Worst GPS accuracy, in metres, still good enough to price a fare from. */
export const MAX_RAW_SAMPLE_ACCURACY_M = 50;

export function isInBounds(lat: number, lng: number, bounds: Bounds): boolean {
  return (
    lat >= bounds.latMin &&
    lat <= bounds.latMax &&
    lng >= bounds.lngMin &&
    lng <= bounds.lngMax
  );
}
