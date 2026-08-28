import type { PlannerPoint } from '@/lib/planner/routePlanner'
import { resolvePinLabel } from '@/lib/locations/pinLabelResolver'
import { isInBounds } from '@/lib/tracker/calculations'
import { BASEY_SERVICE_AREA, MAX_RAW_SAMPLE_ACCURACY_M } from '@/lib/tracker/constants'

/**
 * Why a browser fix could not be used as a trip origin. Each reason maps to a
 * different thing to tell the rider, which is the only reason they are
 * distinguished at all.
 */
export type CurrentLocationFailure =
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'inaccurate'
  | 'outside_service_area'

export type CurrentLocationResult =
  | { ok: true; point: PlannerPoint }
  | { ok: false; reason: CurrentLocationFailure }

/** Matches the incident reporter's options — the one other GPS call in the app. */
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 300_000,
}

/**
 * Reads one GPS fix and turns it into a planner point, or says why it cannot.
 *
 * The two rejections that matter are accuracy and bounds. A fix worse than
 * MAX_RAW_SAMPLE_ACCURACY_M would quote a fare from a point the rider is not
 * standing on, and a fix outside the service area would be rejected by
 * /api/routes/calculate with a 400 that reads to the rider like a bug — better
 * to say "you're outside Basey" before spending the round trip.
 */
export async function getCurrentLocationPoint(): Promise<CurrentLocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ok: false, reason: 'unsupported' }
  }

  const position = await new Promise<GeolocationPosition | GeolocationPositionError>((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, resolve, POSITION_OPTIONS)
  })

  if (!('coords' in position)) {
    return {
      ok: false,
      reason: position.code === position.PERMISSION_DENIED ? 'denied' : 'unavailable',
    }
  }

  const { latitude, longitude, accuracy } = position.coords

  if (Number.isFinite(accuracy) && accuracy > MAX_RAW_SAMPLE_ACCURACY_M) {
    return { ok: false, reason: 'inaccurate' }
  }

  if (!isInBounds(latitude, longitude, BASEY_SERVICE_AREA)) {
    return { ok: false, reason: 'outside_service_area' }
  }

  return {
    ok: true,
    point: {
      lat: latitude,
      lng: longitude,
      label: resolvePinLabel(latitude, longitude).displayLabel,
    },
  }
}

/** Rider-facing copy for each failure. Kept beside the reasons it explains. */
export const CURRENT_LOCATION_MESSAGES: Record<CurrentLocationFailure, string> = {
  unsupported: 'This browser cannot share your location. Tap the map to set your pickup.',
  denied: 'Location permission is off. Tap the map to set your pickup.',
  unavailable: 'Could not read your location. Tap the map to set your pickup.',
  inaccurate: 'Your GPS signal is too weak to place a pickup. Tap the map instead.',
  outside_service_area: "You're outside Basey — tap the map to set your pickup.",
}
