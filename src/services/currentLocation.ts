import * as Location from 'expo-location';

import { fetchPinLabel } from './locations';
import {
  BASEY_SERVICE_AREA,
  MAX_RAW_SAMPLE_ACCURACY_M,
  isInBounds,
} from '@/lib/serviceArea';
import type { PlaceSelection } from '@/types/places';

/**
 * Why a fix could not be used as a trip origin. Each reason maps to different
 * copy for the rider, which is the only reason they are distinguished.
 */
export type CurrentLocationFailure =
  | 'denied'
  | 'unavailable'
  | 'inaccurate'
  | 'outside_service_area';

export type CurrentLocationResult =
  | { ok: true; selection: PlaceSelection }
  | { ok: false; reason: CurrentLocationFailure };

/** Shown until the barangay name arrives, and kept if it never does. */
export const PENDING_LOCATION_LABEL = 'Your location';

export const CURRENT_LOCATION_MESSAGES: Record<CurrentLocationFailure, string> = {
  denied: 'Location permission is off. Search a place or tap the map instead.',
  unavailable: 'Could not read your location. Search a place or tap the map instead.',
  inaccurate: 'Your GPS signal is too weak to set a pickup. Search or tap the map instead.',
  outside_service_area: "You're outside Basey. Search a place or tap the map instead.",
};

/**
 * Reads one GPS fix and turns it into a trip endpoint, or says why it cannot.
 *
 * The point enters as a pin, never as a Place: the rider is standing where they
 * are standing, not at a barangay centroid, and the server bounds-checks it like
 * any other dropped pin.
 */
export async function getCurrentPlaceSelection(): Promise<CurrentLocationResult> {
  let position: Location.LocationObject;

  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { ok: false, reason: 'denied' };

    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  const { latitude, longitude, accuracy } = position.coords;

  if (accuracy != null && accuracy > MAX_RAW_SAMPLE_ACCURACY_M) {
    return { ok: false, reason: 'inaccurate' };
  }

  if (!isInBounds(latitude, longitude, BASEY_SERVICE_AREA)) {
    return { ok: false, reason: 'outside_service_area' };
  }

  return {
    ok: true,
    selection: {
      kind: 'pin',
      coordinates: { lat: latitude, lng: longitude },
      label: PENDING_LOCATION_LABEL,
    },
  };
}

/**
 * Upgrades a GPS pin's placeholder label to its barangay name.
 *
 * Deliberately separate from the fix itself and deliberately failable: the
 * quote must not wait on a label, and offline "Your location" is a perfectly
 * good thing to call the spot the rider is standing on.
 */
export async function resolveSelectionLabel(
  selection: PlaceSelection,
): Promise<PlaceSelection> {
  if (selection.kind !== 'pin') return selection;

  try {
    const { displayLabel } = await fetchPinLabel(
      selection.coordinates.lat,
      selection.coordinates.lng,
    );
    return { ...selection, label: displayLabel };
  } catch {
    return selection;
  }
}
