import { lookupByRideTag } from '@/services/vehicles';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const VEHICLE = {
  id: 'veh-1',
  plateNumber: 'ABC-1234',
  permitPlateNumber: 'BSY-001',
  vehicleType: 'TRICYCLE',
};

describe('lookupByRideTag', () => {
  afterEach(() => jest.clearAllMocks());

  it('keeps a non-ACTIVE permit status so the caller can warn before using it', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      matchFound: true,
      permitStatus: 'EXPIRED',
      vehicle: VEHICLE,
      message: 'Permit matched, but it is currently expired.',
    });

    const result = await lookupByRideTag('token-abc');

    expect(result.permitStatus).toBe('EXPIRED');
    expect(result.vehicle).toEqual(VEHICLE);
    expect(result.message).toBe('Permit matched, but it is currently expired.');
  });

  it('reports a miss without inventing a vehicle', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      matchFound: false,
      permitStatus: null,
      vehicle: null,
      message: 'No permit matched the submitted QR token.',
    });

    const result = await lookupByRideTag('nope');

    expect(result.matchFound).toBe(false);
    expect(result.vehicle).toBeNull();
  });

  it('defaults the fields a sparse response omits', async () => {
    (api.post as jest.Mock).mockResolvedValue({ matchFound: true, vehicle: VEHICLE });

    const result = await lookupByRideTag('token-abc');

    expect(result.permitStatus).toBeNull();
    expect(result.message).toBe('');
  });
});
