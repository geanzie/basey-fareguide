import { saveFareCalculation } from '@/services/fare';
import { api } from '@/services/api';

jest.mock('@/services/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

const BASE = {
  originLat: 11.28,
  originLng: 125.07,
  originLabel: 'Basey Town Hall',
  destinationLat: 11.3,
  destinationLng: 125.09,
  destinationLabel: 'Simeon Ocdol National High School',
  distanceKm: 8.11,
  fare: 33,
  isEstimate: false,
  vehicleId: 'veh-1',
  method: 'ors' as const,
  provider: 'ors' as const,
  polyline: 'abc',
  farePolicySnapshot: {
    versionId: null,
    baseFare: 15,
    baseDistanceKm: 3,
    perKmRate: 3,
    effectiveAt: null,
  },
};

function sentBody() {
  return (api.post as jest.Mock).mock.calls[0][1];
}

describe('saveFareCalculation — discount payload', () => {
  beforeEach(() => (api.post as jest.Mock).mockResolvedValue({ success: true }));
  afterEach(() => jest.clearAllMocks());

  it('sends the discount trio together when a card produced a discount', async () => {
    await saveFareCalculation({
      ...BASE,
      fare: 26.4,
      discountType: 'STUDENT',
      discountCardId: 'card-1',
      originalFare: 33,
      discountApplied: 6.6,
    });

    expect(sentBody()).toMatchObject({
      discountType: 'STUDENT',
      discountCardId: 'card-1',
      originalFare: 33,
      discountApplied: 6.6,
    });
  });

  // The server 400s on a card id without a positive discount, so the three
  // fields have to travel as a set or not at all.
  it('withholds the card id when no discount was actually applied', async () => {
    await saveFareCalculation({
      ...BASE,
      discountType: 'STUDENT',
      discountCardId: 'card-1',
      originalFare: 33,
      discountApplied: 0,
    });

    expect(sentBody()).toMatchObject({
      discountCardId: null,
      originalFare: null,
      discountApplied: null,
    });
  });

  it('sends nulls for a regular fare', async () => {
    await saveFareCalculation({ ...BASE, discountType: 'NONE' });

    expect(sentBody()).toMatchObject({
      discountType: null,
      discountCardId: null,
      originalFare: null,
      discountApplied: null,
    });
  });
});
