import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reverseGeocode } from '@/utils/googleMapsVerification'

const originalFetch = global.fetch

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        result: {
          results: [
            {
              formatted_address: 'Basey, Samar, Philippines',
              place_id: 'place-1',
              geometry: {
                location: { lat: 11.28, lng: 125.07 },
                locationType: 'ROOFTOP',
                viewport: {
                  northeast: { lat: 11.29, lng: 125.08 },
                  southwest: { lat: 11.27, lng: 125.06 },
                },
              },
              address_components: [
                { longName: 'Basey', shortName: 'Basey', types: ['locality'] },
                { longName: 'Samar', shortName: 'Samar', types: ['administrative_area_level_1'] },
                { longName: 'Philippines', shortName: 'PH', types: ['country'] },
              ],
              types: ['locality'],
            },
          ],
        },
      }),
      { status: 200 },
    ),
  )
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('reverseGeocode (server-side, internal caller)', () => {
  it('forwards the caller-supplied cookie and authorization into the internal request', async () => {
    // /api/geocode/reverse now requires a session. The internal caller
    // (admin location validation) must carry its own request's credential
    // through, or every server-side validation would start failing 401.
    await reverseGeocode([11.28, 125.07], 'http://localhost:3000', {
      cookie: 'auth-token=abc123',
      authorization: 'Bearer xyz',
    })

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.cookie).toBe('auth-token=abc123')
    expect(init.headers.authorization).toBe('Bearer xyz')
  })

  it('omits auth headers entirely when none are supplied, rather than sending empty ones', async () => {
    await reverseGeocode([11.28, 125.07], 'http://localhost:3000')

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers.cookie).toBeUndefined()
    expect(init.headers.authorization).toBeUndefined()
  })

  it('still returns a valid, high-confidence result when the forwarded call succeeds', async () => {
    const result = await reverseGeocode([11.28, 125.07], 'http://localhost:3000', {
      cookie: 'auth-token=abc123',
    })

    expect(result.isValidLocation).toBe(true)
    expect(result.municipality).toBe('Basey')
  })

  it('fails closed to a low-confidence result if the forwarded call is refused (e.g. 401)', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 401 }))

    const result = await reverseGeocode([11.28, 125.07], 'http://localhost:3000', {})

    expect(result.isValidLocation).toBe(false)
    expect(result.confidence).toBe('low')
  })
})
