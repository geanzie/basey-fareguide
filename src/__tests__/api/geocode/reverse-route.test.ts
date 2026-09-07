import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const reverseGeocodeMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRequestUser: authMock.requireRequestUser,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@googlemaps/google-maps-services-js', () => ({
  Client: class {
    reverseGeocode(...args: unknown[]) {
      return reverseGeocodeMock(...args)
    }
  },
}))

import { POST } from '@/app/api/geocode/reverse/route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/geocode/reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GOOGLE_MAPS_SERVER_API_KEY = 'test-key'
  authMock.requireRequestUser.mockResolvedValue({ id: 'user-1' })
  reverseGeocodeMock.mockResolvedValue({
    data: { status: 'OK', results: [{ formatted_address: 'Basey, Samar' }] },
  })
})

describe('POST /api/geocode/reverse', () => {
  it('refuses an unauthenticated caller before spending the API key', async () => {
    // This is the fix: previously this route had no auth check at all,
    // unlike its sibling /api/geocode/forward.
    authMock.requireRequestUser.mockRejectedValue(new Error('Unauthorized'))

    const response = await POST(makeRequest({ lat: 11.28, lng: 125.07 }) as never)

    expect(response.status).toBe(401)
    expect(reverseGeocodeMock).not.toHaveBeenCalled()
  })

  it('serves an authenticated caller', async () => {
    const response = await POST(makeRequest({ lat: 11.28, lng: 125.07 }) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(reverseGeocodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ latlng: '11.28,125.07', key: 'test-key' }),
      }),
    )
  })

  it('rejects non-numeric coordinates', async () => {
    const response = await POST(makeRequest({ lat: 'north', lng: 125.07 }) as never)

    expect(response.status).toBe(400)
    expect(reverseGeocodeMock).not.toHaveBeenCalled()
  })

  it('rate-limits one user past the per-minute cap', async () => {
    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ lat: 11.28, lng: 125.07 }) as never)
    }

    const response = await POST(makeRequest({ lat: 11.28, lng: 125.07 }) as never)

    expect(response.status).toBe(429)
  })
})
