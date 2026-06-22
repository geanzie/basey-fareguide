import { createIncident, fetchMyIncidents } from '@/services/incidents';
import { api } from '@/services/api';

jest.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(jest.fn(() => ({ token: 'test-token' })), {
    getState: jest.fn(() => ({ token: 'test-token' })),
  }),
}));

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const BASE_PAYLOAD = {
  incidentType: 'FARE_OVERCHARGE' as const,
  description: 'Driver overcharged',
  location: 'Basey Poblacion',
  incidentDate: '2026-06-22T10:30:00.000Z',
};

function mockFetch(ok: boolean, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    text: async () => JSON.stringify(body),
  } as unknown as Response);
}

describe('createIncident', () => {
  beforeEach(() => {
    mockFetch(true, { referenceNumber: 'INC-001', message: 'Incident reported successfully' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls correct endpoint', async () => {
    await createIncident(BASE_PAYLOAD);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/incidents/report'),
      expect.any(Object),
    );
  });

  it('uses POST method', async () => {
    await createIncident(BASE_PAYLOAD);
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe('POST');
  });

  it('sends Authorization header with token', async () => {
    await createIncident(BASE_PAYLOAD);
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(opts.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
  });

  it('strips time component from incidentDate — sends YYYY-MM-DD only', async () => {
    await createIncident({ ...BASE_PAYLOAD, incidentDate: '2026-06-22T10:30:00.000Z' });
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const form = opts.body as FormData;
    expect(form.get('incidentDate')).toBe('2026-06-22');
  });

  it('appends incidentType exactly as provided', async () => {
    await createIncident(BASE_PAYLOAD);
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(form.get('incidentType')).toBe('FARE_OVERCHARGE');
  });

  it('appends incidentTime as HH:MM format', async () => {
    await createIncident(BASE_PAYLOAD);
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    const time = form.get('incidentTime') as string;
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('appends fareCalculationId when provided', async () => {
    await createIncident({ ...BASE_PAYLOAD, fareCalculationId: 'calc-abc-123' });
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(form.get('fareCalculationId')).toBe('calc-abc-123');
  });

  it('omits fareCalculationId when not provided', async () => {
    await createIncident(BASE_PAYLOAD);
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(form.get('fareCalculationId')).toBeNull();
  });

  it('appends vehicleId when provided', async () => {
    await createIncident({ ...BASE_PAYLOAD, vehicleId: 'vehicle-xyz' });
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(form.get('vehicleId')).toBe('vehicle-xyz');
  });

  it('omits vehicleId when undefined', async () => {
    await createIncident(BASE_PAYLOAD);
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(form.get('vehicleId')).toBeNull();
  });

  it('appends plateNumber when provided', async () => {
    await createIncident({ ...BASE_PAYLOAD, plateNumber: 'ABC-123' });
    const form = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(form.get('plateNumber')).toBe('ABC-123');
  });

  it('returns referenceNumber on success', async () => {
    const result = await createIncident(BASE_PAYLOAD);
    expect(result.referenceNumber).toBe('INC-001');
  });

  it('throws with backend error message on non-ok response', async () => {
    mockFetch(false, { message: 'Select one of your 10 most recent trips.' });
    await expect(createIncident(BASE_PAYLOAD)).rejects.toThrow(
      'Select one of your 10 most recent trips.',
    );
  });

  it('throws generic HTTP error when body has no message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({}),
    } as unknown as Response);
    await expect(createIncident(BASE_PAYLOAD)).rejects.toThrow('HTTP 400');
  });

  it('handles non-JSON response body without crashing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Internal Server Error',
    } as unknown as Response);
    await expect(createIncident(BASE_PAYLOAD)).rejects.toThrow('HTTP');
  });
});

describe('fetchMyIncidents — normalizeIncident', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps raw.type to incidentType', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      incidents: [
        {
          id: '1',
          type: 'FARE_OVERCHARGE',
          incidentDate: '2026-06-22',
          status: 'PENDING',
          description: 'test',
          location: 'test',
          createdAt: '2026-06-22',
        },
      ],
    });
    const result = await fetchMyIncidents();
    expect(result.items[0].incidentType).toBe('FARE_OVERCHARGE');
  });

  it('maps raw.date to incidentDate', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      incidents: [
        {
          id: '1',
          incidentType: 'RECKLESS_DRIVING',
          date: '2026-05-01',
          status: 'RESOLVED',
          description: 'test',
          location: 'test',
          createdAt: '2026-05-01',
        },
      ],
    });
    const result = await fetchMyIncidents();
    expect(result.items[0].incidentDate).toBe('2026-05-01');
  });

  it('prefers raw.type over raw.incidentType', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      incidents: [
        {
          id: '1',
          type: 'VEHICLE_VIOLATION',
          incidentType: 'OTHER',
          incidentDate: '2026-06-01',
          status: 'PENDING',
          description: 'test',
          location: 'test',
          createdAt: '2026-06-01',
        },
      ],
    });
    const result = await fetchMyIncidents();
    expect(result.items[0].incidentType).toBe('VEHICLE_VIOLATION');
  });

  it('returns empty items when incidents array is missing', async () => {
    (api.get as jest.Mock).mockResolvedValue({});
    const result = await fetchMyIncidents();
    expect(result.items).toEqual([]);
  });
});
