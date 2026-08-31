import { calculateRoute, selectionToLocationInput, toVehicleType } from '@/services/fare';
import { api } from '@/services/api';
import type { Place, PlaceSelection } from '@/types/places';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const PLACE: Place = {
  id: 'loc-1',
  name: 'Basey Public Market',
  type: 'LANDMARK',
  category: 'landmark',
  coordinates: { lat: 11.279, lng: 125.0645 },
  address: 'Basey Public Market, Basey, Samar',
  verified: false,
  source: 'database',
  pointSource: 'manual',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('selectionToLocationInput', () => {
  it('sends a curated Place by name so the server resolves the blessed coordinate', () => {
    const selection: PlaceSelection = { kind: 'place', place: PLACE };
    expect(selectionToLocationInput(selection)).toEqual({
      type: 'preset',
      name: 'Basey Public Market',
    });
  });

  it('sends a dropped pin as coordinates, which the server bounds-checks', () => {
    const selection: PlaceSelection = {
      kind: 'pin',
      coordinates: { lat: 11.28, lng: 125.07 },
      label: 'Somewhere',
    };
    expect(selectionToLocationInput(selection)).toEqual({
      type: 'pin',
      lat: 11.28,
      lng: 125.07,
    });
  });

  it('never sends a geocoded candidate as a preset', () => {
    // Candidates enter as pins precisely so they cannot skip the bounds guard.
    const candidateSelection: PlaceSelection = {
      kind: 'pin',
      coordinates: { lat: 11.3, lng: 125.1 },
      label: 'Some Resort (from Google)',
    };
    expect(selectionToLocationInput(candidateSelection).type).toBe('pin');
  });
});

describe('toVehicleType', () => {
  it('accepts every member of the mirrored Prisma enum', () => {
    for (const value of ['JEEPNEY', 'TRICYCLE', 'HABAL_HABAL', 'MULTICAB', 'BUS', 'VAN']) {
      expect(toVehicleType(value)).toBe(value);
    }
  });

  it('drops a value the mirror does not know, rather than forwarding it', () => {
    // The lookup endpoint types vehicleType as a bare string. A value this
    // mirror has not been taught about must not reach the server as a 400.
    expect(toVehicleType('HELICOPTER')).toBeNull();
    expect(toVehicleType(null)).toBeNull();
    expect(toVehicleType(undefined)).toBeNull();
    expect(toVehicleType('')).toBeNull();
  });
});

describe('calculateRoute', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts mixed preset and pin ends unchanged', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await calculateRoute({
      origin: { type: 'preset', name: 'Amandayehan' },
      destination: { type: 'pin', lat: 11.28, lng: 125.07 },
    });
    expect(api.post).toHaveBeenCalledWith('/api/routes/calculate', {
      origin: { type: 'preset', name: 'Amandayehan' },
      destination: { type: 'pin', lat: 11.28, lng: 125.07 },
      passengerType: 'REGULAR',
      vehicleType: null,
    });
  });

  it('sends the ride type so the server routes for that vehicle', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await calculateRoute({
      origin: { type: 'preset', name: 'Amandayehan' },
      destination: { type: 'preset', name: 'Anglit' },
      vehicleType: 'HABAL_HABAL',
    });
    expect((api.post as jest.Mock).mock.calls[0][1].vehicleType).toBe('HABAL_HABAL');
  });

  it('sends null when no ride type was chosen, which the server routes as a car', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await calculateRoute({
      origin: { type: 'preset', name: 'Amandayehan' },
      destination: { type: 'preset', name: 'Anglit' },
    });
    expect((api.post as jest.Mock).mock.calls[0][1].vehicleType).toBeNull();
  });

  it('maps discountType onto passengerType', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    await calculateRoute({
      origin: { type: 'preset', name: 'Amandayehan' },
      destination: { type: 'preset', name: 'Anglit' },
      discountType: 'SENIOR_CITIZEN',
    });
    expect((api.post as jest.Mock).mock.calls[0][1].passengerType).toBe('SENIOR');
  });
});
