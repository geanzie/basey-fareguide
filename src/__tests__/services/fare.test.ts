import { fetchFareHistory } from '@/services/fare';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const BASE_RAW = {
  id: 'calc-1',
  distanceKm: 5,
  fare: 27,
  discountType: 'NONE',
  isEstimate: false,
  createdAt: '2026-06-22T10:00:00.000Z',
};

describe('fetchFareHistory — normalizeFareCalc', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps from/to to originLabel/destinationLabel', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      calculations: [{ ...BASE_RAW, from: 'Basey Poblacion', to: 'Magtanggol' }],
    });
    const result = await fetchFareHistory();
    expect(result.items[0].originLabel).toBe('Basey Poblacion');
    expect(result.items[0].destinationLabel).toBe('Magtanggol');
  });

  it('falls back to fromLocation/toLocation when from/to absent', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      calculations: [{ ...BASE_RAW, fromLocation: 'Brgy. 1', toLocation: 'Brgy. 5' }],
    });
    const result = await fetchFareHistory();
    expect(result.items[0].originLabel).toBe('Brgy. 1');
    expect(result.items[0].destinationLabel).toBe('Brgy. 5');
  });

  it('prefers from/to over fromLocation/toLocation', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      calculations: [{ ...BASE_RAW, from: 'A', to: 'B', fromLocation: 'X', toLocation: 'Y' }],
    });
    const result = await fetchFareHistory();
    expect(result.items[0].originLabel).toBe('A');
    expect(result.items[0].destinationLabel).toBe('B');
  });

  it('preserves vehicle object with hasVehicleContext true', async () => {
    const vehicle = {
      id: 'v-001',
      plateNumber: 'ABC-123',
      permitPlateNumber: null,
      vehicleType: 'JEEPNEY',
      hasVehicleContext: true,
    };
    (api.get as jest.Mock).mockResolvedValue({
      calculations: [{ ...BASE_RAW, from: 'A', to: 'B', vehicle }],
    });
    const result = await fetchFareHistory();
    expect(result.items[0].vehicle).toEqual(vehicle);
  });

  it('preserves vehicle when hasVehicleContext is false', async () => {
    const vehicle = {
      plateNumber: null,
      permitPlateNumber: null,
      vehicleType: null,
      hasVehicleContext: false,
    };
    (api.get as jest.Mock).mockResolvedValue({
      calculations: [{ ...BASE_RAW, from: 'A', to: 'B', vehicle }],
    });
    const result = await fetchFareHistory();
    expect(result.items[0].vehicle).toEqual(vehicle);
  });

  it('sets vehicle to null when absent from response', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      calculations: [{ ...BASE_RAW, from: 'A', to: 'B' }],
    });
    const result = await fetchFareHistory();
    expect(result.items[0].vehicle).toBeNull();
  });

  it('returns empty items when calculations array is missing', async () => {
    (api.get as jest.Mock).mockResolvedValue({});
    const result = await fetchFareHistory();
    expect(result.items).toEqual([]);
  });

  it('passes page and pageSize as query params', async () => {
    (api.get as jest.Mock).mockResolvedValue({ calculations: [] });
    await fetchFareHistory(2, 5);
    expect(api.get).toHaveBeenCalledWith('/api/fare-calculations?page=2&pageSize=5');
  });
});
