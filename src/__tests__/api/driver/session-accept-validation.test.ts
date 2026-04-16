import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const txMock = vi.hoisted(() => ({
  vehicleTripSessionRider: { updateMany: vi.fn() },
  vehicleTripSession: { update: vi.fn() },
  vehicleTripSessionRiderEvent: { create: vi.fn() },
  fareCalculation: { create: vi.fn() },
  discountUsageLog: { create: vi.fn() },
  discountCard: { update: vi.fn() },
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: { findUnique: vi.fn() },
  vehicleTripSession: { findFirst: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn((callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthWithSelect: authMock.verifyAuthWithSelect,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { POST } from '@/app/api/driver/session/[sessionId]/riders/[sessionRiderId]/action/route'

const DRIVER_USER = {
  id: 'driver-1',
  firstName: 'Driver',
  lastName: 'One',
  username: 'drv-001',
  userType: 'DRIVER',
  isActive: true,
  isVerified: true,
  assignedVehicleId: 'vehicle-1',
  assignedVehicleAssignedAt: new Date('2026-04-01T00:00:00.000Z'),
}

const VEHICLE = {
  id: 'vehicle-1',
  plateNumber: 'ABC-123',
  vehicleType: 'TRICYCLE',
  make: 'Honda',
  model: 'TMX',
  color: 'Blue',
}

const OPEN_SESSION_WITH_PENDING_RIDER = {
  id: 'session-1',
  vehicleId: 'vehicle-1',
  status: 'OPEN' as const,
  openedAt: new Date('2026-04-16T08:00:00.000Z'),
  closedAt: null,
  riders: [
    {
      id: 'sr-1',
      riderUserId: 'rider-1',
      fareCalculationId: null,
      activeRequestKey: 'session-1:rider-1',
      status: 'PENDING' as const,
      originSnapshot: 'Market',
      destinationSnapshot: 'Terminal',
      distanceSnapshot: '4.50',
      fareSnapshot: '35.00',
      calculationTypeSnapshot: 'Road Route Planner',
      routeDataSnapshot: '{"provider":"ors"}',
      farePolicySnapshot: null,
      discountCardIdSnapshot: null,
      originalFareSnapshot: null,
      discountAppliedSnapshot: null,
      discountTypeSnapshot: null,
      joinedAt: new Date('2026-04-16T08:05:00.000Z'),
      expiresAt: new Date('2026-04-17T08:15:00.000Z'),
      acceptedAt: null,
      boardedAt: null,
      completedAt: null,
      finalisedAt: null,
    },
  ],
}

const OPEN_SESSION_WITH_ACCEPTED_RIDER = {
  ...OPEN_SESSION_WITH_PENDING_RIDER,
  riders: [
    {
      ...OPEN_SESSION_WITH_PENDING_RIDER.riders[0],
      status: 'ACCEPTED' as const,
      fareCalculationId: 'calc-1',
      acceptedAt: new Date('2026-04-16T08:06:00.000Z'),
      expiresAt: null,
    },
  ],
}

function makeRequest(sessionId: string, sessionRiderId: string, body: unknown) {
  return new Request(`http://localhost/api/driver/session/${sessionId}/riders/${sessionRiderId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

function makeContext(sessionId: string, sessionRiderId: string) {
  return {
    params: Promise.resolve({ sessionId, sessionRiderId }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/driver/session/[sessionId]/riders/[sessionRiderId]/action — ACCEPT validation', () => {
  it('rejects unauthenticated driver', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(null)

    const response = await POST(
      makeRequest('session-1', 'sr-1', { action: 'ACCEPT' }),
      makeContext('session-1', 'sr-1'),
    )
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.message).toMatch(/Unauthorized/i)
  })

  it('rejects non-DRIVER role', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce({ ...DRIVER_USER, userType: 'PUBLIC' })

    const response = await POST(
      makeRequest('session-1', 'sr-1', { action: 'ACCEPT' }),
      makeContext('session-1', 'sr-1'),
    )
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.message).toMatch(/Forbidden/i)
  })

  it('returns 404 SESSION_NOT_FOUND when session is outside driver vehicle scope', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(DRIVER_USER)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(VEHICLE)
    // Session query with vehicleId filter returns null → not found for this vehicle
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(null)

    const response = await POST(
      makeRequest('other-session', 'sr-1', { action: 'ACCEPT' }),
      makeContext('other-session', 'sr-1'),
    )
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 409 SESSION_CLOSED when no active session exists', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(DRIVER_USER)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(VEHICLE)
    // Session found but already closed
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce({
      ...OPEN_SESSION_WITH_PENDING_RIDER,
      status: 'CLOSED',
    })

    const response = await POST(
      makeRequest('session-1', 'sr-1', { action: 'ACCEPT' }),
      makeContext('session-1', 'sr-1'),
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.code).toBe('SESSION_CLOSED')
  })

  it('returns 409 INVALID_RIDER_TRANSITION on duplicate accept attempt', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(DRIVER_USER)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(VEHICLE)
    // Rider is already ACCEPTED — duplicate accept is invalid
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(OPEN_SESSION_WITH_ACCEPTED_RIDER)

    const response = await POST(
      makeRequest('session-1', 'sr-1', { action: 'ACCEPT' }),
      makeContext('session-1', 'sr-1'),
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.code).toBe('INVALID_RIDER_TRANSITION')
  })

  it('returns 409 INVALID_RIDER_TRANSITION when accepting a non-PENDING rider', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(DRIVER_USER)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(VEHICLE)
    // Rider is BOARDED — not eligible for ACCEPT
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce({
      ...OPEN_SESSION_WITH_PENDING_RIDER,
      riders: [{ ...OPEN_SESSION_WITH_PENDING_RIDER.riders[0], status: 'BOARDED' }],
    })

    const response = await POST(
      makeRequest('session-1', 'sr-1', { action: 'ACCEPT' }),
      makeContext('session-1', 'sr-1'),
    )
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.code).toBe('INVALID_RIDER_TRANSITION')
  })

  it('accepts a PENDING rider and writes acceptedAt plus fare history via transaction', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(DRIVER_USER)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(VEHICLE)
    // Initial session load
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(OPEN_SESSION_WITH_PENDING_RIDER)
    // Session refresh after transaction uses findUnique
    prismaMock.vehicleTripSession.findUnique.mockResolvedValueOnce({
      ...OPEN_SESSION_WITH_PENDING_RIDER,
      riders: [{
        ...OPEN_SESSION_WITH_PENDING_RIDER.riders[0],
        status: 'ACCEPTED',
        fareCalculationId: 'calc-accepted-1',
        acceptedAt: new Date('2026-04-16T08:06:00.000Z'),
        boardedAt: null,
        expiresAt: null,
      }],
    })

    txMock.fareCalculation.create.mockResolvedValueOnce({ id: 'calc-accepted-1' })
    txMock.vehicleTripSessionRider.updateMany.mockResolvedValueOnce({ count: 1 })
    txMock.vehicleTripSessionRiderEvent.create.mockResolvedValueOnce({})

    const response = await POST(
      makeRequest('session-1', 'sr-1', { action: 'ACCEPT' }),
      makeContext('session-1', 'sr-1'),
    )

    expect(response.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    expect(txMock.fareCalculation.create).toHaveBeenCalledOnce()

    const updateCall = txMock.vehicleTripSessionRider.updateMany.mock.calls[0][0]
    expect(updateCall.where.id).toBe('sr-1')
    expect(updateCall.data.status).toBe('ACCEPTED')
    expect(updateCall.data.acceptedAt).toBeInstanceOf(Date)
    expect(updateCall.data.boardedAt).toBeUndefined()
    expect(updateCall.data.fareCalculationId).toBe('calc-accepted-1')

    const eventCall = txMock.vehicleTripSessionRiderEvent.create.mock.calls[0][0]
    expect(eventCall.data.action).toBe('ACCEPT')
    expect(eventCall.data.fromStatus).toBe('PENDING')
    expect(eventCall.data.toStatus).toBe('ACCEPTED')
    expect(eventCall.data.actedByUserId).toBe('driver-1')
  })
})
