import * as Location from 'expo-location';

import {
  PENDING_LOCATION_LABEL,
  getCurrentPlaceSelection,
  resolveSelectionLabel,
} from '@/services/currentLocation';
import { api } from '@/services/api';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const requestPermissions = Location.requestForegroundPermissionsAsync as jest.Mock;
const getPosition = Location.getCurrentPositionAsync as jest.Mock;

/** Basey poblacion. */
const IN_BASEY = { latitude: 11.28185, longitude: 125.06835 };

function grantWithFix(coords: Partial<Location.LocationObjectCoords>) {
  requestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  getPosition.mockResolvedValue({
    coords: { ...IN_BASEY, accuracy: 12, ...coords },
    timestamp: Date.now(),
  });
}

describe('getCurrentPlaceSelection', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the fix as a pin with a placeholder label', async () => {
    grantWithFix({});

    const result = await getCurrentPlaceSelection();

    expect(result).toEqual({
      ok: true,
      selection: {
        kind: 'pin',
        coordinates: { lat: IN_BASEY.latitude, lng: IN_BASEY.longitude },
        label: PENDING_LOCATION_LABEL,
      },
    });
    expect(getPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.High });
  });

  it('never asks for a position when permission is refused', async () => {
    requestPermissions.mockResolvedValue({ granted: false, status: 'denied' });

    expect(await getCurrentPlaceSelection()).toEqual({ ok: false, reason: 'denied' });
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('refuses a fix too coarse to price a fare from', async () => {
    grantWithFix({ accuracy: 300 });

    expect(await getCurrentPlaceSelection()).toEqual({ ok: false, reason: 'inaccurate' });
  });

  it('accepts a fix whose accuracy the platform does not report', async () => {
    grantWithFix({ accuracy: null });

    expect((await getCurrentPlaceSelection()).ok).toBe(true);
  });

  it('refuses a fix outside the Basey service area before spending a round trip', async () => {
    grantWithFix({ latitude: 52.52, longitude: 13.405 });

    expect(await getCurrentPlaceSelection()).toEqual({
      ok: false,
      reason: 'outside_service_area',
    });
  });

  it('reports an unreadable fix rather than throwing', async () => {
    requestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    getPosition.mockRejectedValue(new Error('Location services are disabled'));

    expect(await getCurrentPlaceSelection()).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('resolveSelectionLabel', () => {
  const pin = {
    kind: 'pin' as const,
    coordinates: { lat: IN_BASEY.latitude, lng: IN_BASEY.longitude },
    label: PENDING_LOCATION_LABEL,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('upgrades a pin to its barangay name', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      success: true,
      pinLabel: {
        displayLabel: 'SULOD',
        barangayName: 'SULOD',
        rawCoordinates: '11.281850, 125.068350',
        isFallback: false,
      },
    });

    expect(await resolveSelectionLabel(pin)).toEqual({ ...pin, label: 'SULOD' });
  });

  it('keeps the placeholder when the lookup fails, so offline still quotes', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    expect(await resolveSelectionLabel(pin)).toEqual(pin);
  });

  it('leaves a chosen Place alone — it already has a name', async () => {
    const place = { kind: 'place' as const, place: { name: 'Basey Public Market' } as never };

    expect(await resolveSelectionLabel(place)).toBe(place);
    expect(api.get).not.toHaveBeenCalled();
  });
});
