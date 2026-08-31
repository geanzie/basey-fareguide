import { api, ApiError } from '@/services/api';

jest.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ token: null, clearSession: jest.fn() }) },
}));

jest.mock('@/store/terminalUnlockStore', () => ({
  useTerminalUnlockStore: {
    getState: () => ({ unlockToken: null, setUnlock: jest.fn(), clearUnlock: jest.fn() }),
  },
}));

function mockFetch(status: number, body: unknown) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  });
  (global as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch;
  return fn;
}

const DROPOFF = {
  lat: 11.28174,
  lng: 125.06754,
  label: 'the nearest road in Poblacion',
  walkMeters: 148,
  source: 'foot_probe',
};

describe('api error passthrough', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('carries the drop-off details of a NO_VEHICLE_ACCESS error', async () => {
    mockFetch(422, {
      code: 'NO_VEHICLE_ACCESS',
      message: 'Habal-habal and tricycles can only reach the nearest road in Poblacion.',
      details: { field: 'destination', dropoff: DROPOFF },
    });

    await expect(api.post('/api/routes/calculate', {})).rejects.toThrow(ApiError);

    try {
      await api.post('/api/routes/calculate', {});
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.code).toBe('NO_VEHICLE_ACCESS');
      expect(apiError.details).toEqual({ field: 'destination', dropoff: DROPOFF });
    }
  });

  it('leaves details undefined on an error that carries none', async () => {
    mockFetch(400, { code: 'INVALID_ROUTE_INPUT', message: 'Origin is required' });

    try {
      await api.post('/api/routes/calculate', {});
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.message).toBe('Origin is required');
      expect(apiError.details).toBeUndefined();
    }
  });
});
