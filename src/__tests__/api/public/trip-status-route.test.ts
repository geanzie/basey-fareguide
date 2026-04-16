import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  vehicleTripSessionRider: {
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/public/trip-status/route'

function makeRequest(params = '') {
  return new Request(`http://localhost/api/public/trip-status${params}`) as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/public/trip-status', () => {
  it('rejects unauthenticated requests', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.message).toBe('Unauthorized')
  })

  it('rejects non-PUBLIC roles', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(403)
  })

  it('returns hasActiveTrip false when no active trip exists', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'user-1', userType: 'PUBLIC' })
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValueOnce(null)

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.hasActiveTrip).toBe(false)
    expect(json.trip).toBeNull()
  })

  it('returns PENDING trip status for the rider', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'user-1', userType: 'PUBLIC' })
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValueOnce({
      id: 'sr-1',
      fareCalculationId: 'calc-1',
      status: 'PENDING',
      originSnapshot: 'Market',
      destinationSnapshot: 'Terminal',
      fareSnapshot: '35.00',
      discountTypeSnapshot: null,
      joinedAt: new Date('2026-04-16T08:00:00.000Z'),
      acceptedAt: null,
      session: {
        vehicle: { plateNumber: 'ABC-123', vehicleType: 'TRICYCLE' },
      },
    })

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.hasActiveTrip).toBe(true)
    expect(json.trip.status).toBe('PENDING')
    expect(json.trip.statusLabel).toBe('Waiting for driver')
    expect(json.trip.origin).toBe('Market')
    expect(json.trip.destination).toBe('Terminal')
    expect(json.trip.fare).toBe(35)
    expect(json.trip.acceptedAt).toBeNull()
    expect(json.trip.vehiclePlateNumber).toBe('ABC-123')
  })

  it('returns ACCEPTED trip status with acceptedAt after driver accepts', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'user-1', userType: 'PUBLIC' })
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValueOnce({
      id: 'sr-1',
      fareCalculationId: 'calc-1',
      status: 'ACCEPTED',
      originSnapshot: 'Market',
      destinationSnapshot: 'Terminal',
      fareSnapshot: '35.00',
      discountTypeSnapshot: null,
      joinedAt: new Date('2026-04-16T08:00:00.000Z'),
      acceptedAt: new Date('2026-04-16T08:02:00.000Z'),
      session: {
        vehicle: { plateNumber: 'ABC-123', vehicleType: 'TRICYCLE' },
      },
    })

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.trip.status).toBe('ACCEPTED')
    expect(json.trip.statusLabel).toBe('Trip accepted')
    expect(json.trip.acceptedAt).toBe('2026-04-16T08:02:00.000Z')
  })

  it('returns Trip accepted label for BOARDED status', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'user-1', userType: 'PUBLIC' })
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValueOnce({
      id: 'sr-1',
      fareCalculationId: 'calc-1',
      status: 'BOARDED',
      originSnapshot: 'Market',
      destinationSnapshot: 'Terminal',
      fareSnapshot: '35.00',
      discountTypeSnapshot: null,
      joinedAt: new Date('2026-04-16T08:00:00.000Z'),
      acceptedAt: new Date('2026-04-16T08:02:00.000Z'),
      session: {
        vehicle: { plateNumber: 'ABC-123', vehicleType: 'TRICYCLE' },
      },
    })

    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.trip.status).toBe('BOARDED')
    expect(json.trip.statusLabel).toBe('Trip accepted')
  })

  it('scopes query to the correct rider when fareCalculationId is provided', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'user-1', userType: 'PUBLIC' })
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValueOnce(null)

    await GET(makeRequest('?fareCalculationId=calc-99'))

    const whereArg = prismaMock.vehicleTripSessionRider.findFirst.mock.calls[0][0].where
    expect(whereArg.fareCalculationId).toBe('calc-99')
    expect(whereArg.riderUserId).toBe('user-1')
  })

  it('does not include fareCalculationId scope when param is absent', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'user-1', userType: 'PUBLIC' })
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValueOnce(null)

    await GET(makeRequest())

    const whereArg = prismaMock.vehicleTripSessionRider.findFirst.mock.calls[0][0].where
    expect(whereArg.fareCalculationId).toBeUndefined()
    expect(whereArg.riderUserId).toBe('user-1')
    expect(whereArg.status).toBeDefined()
  })
})
