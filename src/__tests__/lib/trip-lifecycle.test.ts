import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must come before module imports
// ---------------------------------------------------------------------------

const txMock = vi.hoisted(() => ({
  vehicleTripSessionRider: {
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  vehicleTripSessionRiderEvent: {
    create: vi.fn(),
  },
  vehicleTripSession: {
    update: vi.fn(),
  },
  fareCalculation: {
    create: vi.fn(),
  },
  discountUsageLog: {
    create: vi.fn(),
  },
  discountCard: {
    update: vi.fn(),
  },
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: { findUnique: vi.fn() },
  vehicleTripSession: { findFirst: vi.fn(), findUnique: vi.fn() },
  vehicleTripSessionRider: { updateMany: vi.fn() },
  $transaction: vi.fn((cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
}))

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthWithSelect: authMock.verifyAuthWithSelect,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

// ---------------------------------------------------------------------------
// Subject imports (after mocks)
// ---------------------------------------------------------------------------

import {
  DriverSessionError,
  applyDriverSessionAction,
  createPendingTripRequest,
  expireAllStalePendingRequests,
} from '@/lib/driverSession'
import { UserType } from '@prisma/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDriverRequest(url = 'http://localhost/api/driver/session') {
  return { nextUrl: new URL(url) } as never
}

function makeDriverUser() {
  return {
    id: 'driver-1',
    firstName: 'Driver',
    lastName: 'One',
    username: 'ABC-123',
    userType: 'DRIVER',
    isActive: true,
    isVerified: true,
    assignedVehicleId: 'vehicle-1',
    assignedVehicleAssignedAt: new Date('2026-04-15T07:00:00.000Z'),
  }
}

function makeVehicle() {
  return {
    id: 'vehicle-1',
    plateNumber: 'ABC-123',
    vehicleType: 'TRICYCLE',
    make: 'Honda',
    model: 'TMX',
    color: 'Blue',
  }
}

function makePendingRider(overrides: Record<string, unknown> = {}) {
  return {
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
    routeDataSnapshot: null,
    farePolicySnapshot: null,
    discountCardIdSnapshot: null,
    originalFareSnapshot: null,
    discountAppliedSnapshot: null,
    discountTypeSnapshot: null,
    joinedAt: new Date('2026-04-16T08:05:00.000Z'),
    expiresAt: new Date('2026-04-16T08:15:00.000Z'),
    acceptedAt: null,
    boardedAt: null,
    completedAt: null,
    finalisedAt: null,
    ...overrides,
  }
}

function makeOpenSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    vehicleId: 'vehicle-1',
    status: 'OPEN' as const,
    openedAt: new Date('2026-04-16T08:00:00.000Z'),
    closedAt: null,
    riders: [],
    ...overrides,
  }
}

function makePendingTripCandidate(overrides: Partial<Parameters<typeof createPendingTripRequest>[0]> = {}) {
  return {
    userId: 'rider-1',
    vehicleId: 'vehicle-1',
    fromLocation: 'Market',
    toLocation: 'Terminal',
    distance: 4.5,
    calculatedFare: 35,
    calculationType: 'Road Route Planner',
    routeData: null,
    farePolicySnapshot: null,
    discountCardId: null,
    originalFare: null,
    discountApplied: null,
    discountType: null,
    createdAt: new Date('2026-04-16T08:05:00.000Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuthWithSelect.mockResolvedValue(makeDriverUser())
  prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle())
  txMock.vehicleTripSessionRider.updateMany.mockResolvedValue({ count: 0 })
  txMock.fareCalculation.create.mockResolvedValue({ id: 'calc-new-1' })
  txMock.vehicleTripSessionRiderEvent.create.mockResolvedValue({})
  txMock.vehicleTripSessionRider.findFirst.mockResolvedValue(null)
  txMock.vehicleTripSessionRider.create.mockResolvedValue({
    id: 'sr-1',
    sessionId: 'session-1',
    fareCalculationId: null,
    status: 'PENDING',
  })
})

// ---------------------------------------------------------------------------
// 1. Cross-session contamination: rider submits to new session
// ---------------------------------------------------------------------------

describe('createPendingTripRequest — cross-session contamination', () => {
  it('cancels other-session PENDING rows when rider submits to a new session', async () => {
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce({ id: 'session-2' })

    await createPendingTripRequest(
      makePendingTripCandidate({ vehicleId: 'vehicle-2' }),
      UserType.PUBLIC,
    )

    // updateMany calls inside the transaction:
    // 1st = expireStalePendingRequestForKey (same key, expired rows)
    // 2nd = cancelSupersededPendingRequestsForRider (other-session rows)
    const updateCalls = txMock.vehicleTripSessionRider.updateMany.mock.calls

    expect(updateCalls.length).toBeGreaterThanOrEqual(2)

    const cancelCall = updateCalls.find(
      ([args]: [{ data: { status: string } }]) => args.data.status === 'CANCELLED',
    )
    expect(cancelCall).toBeDefined()
    expect(cancelCall![0].where.riderUserId).toBe('rider-1')
    expect(cancelCall![0].data.activeRequestKey).toBeNull()
    expect(cancelCall![0].data.finalisedAt).toBeInstanceOf(Date)
  })

  it('does NOT cancel the current session key when cancelling superseded requests', async () => {
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce({ id: 'session-1' })

    await createPendingTripRequest(makePendingTripCandidate(), UserType.PUBLIC)

    const updateCalls = txMock.vehicleTripSessionRider.updateMany.mock.calls
    const cancelCall = updateCalls.find(
      ([args]: [{ data: { status: string } }]) => args.data.status === 'CANCELLED',
    )
    // The cancellation where clause must exclude the current key
    expect(cancelCall![0].where.activeRequestKey).toEqual(
      expect.objectContaining({ not: 'session-1:rider-1' }),
    )
  })
})

// ---------------------------------------------------------------------------
// 2. Global stale sweep
// ---------------------------------------------------------------------------

describe('expireAllStalePendingRequests — global sweep', () => {
  it('expires all PENDING rows past their TTL and returns the count', async () => {
    prismaMock.vehicleTripSessionRider.updateMany.mockResolvedValueOnce({ count: 7 })
    const cutoff = new Date('2026-04-16T09:00:00.000Z')

    const expired = await expireAllStalePendingRequests(cutoff)

    expect(expired).toBe(7)
    expect(prismaMock.vehicleTripSessionRider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          expiresAt: { lte: cutoff },
        }),
        data: expect.objectContaining({
          status: 'EXPIRED',
          activeRequestKey: null,
          finalisedAt: cutoff,
        }),
      }),
    )
  })

  it('uses current time when no cutoff is provided', async () => {
    prismaMock.vehicleTripSessionRider.updateMany.mockResolvedValueOnce({ count: 0 })
    const before = new Date()

    await expireAllStalePendingRequests()

    const after = new Date()
    const calledWith = prismaMock.vehicleTripSessionRider.updateMany.mock.calls[0][0]
    const usedCutoff: Date = calledWith.where.expiresAt.lte
    expect(usedCutoff.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(usedCutoff.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('returns 0 when no stale rows exist', async () => {
    prismaMock.vehicleTripSessionRider.updateMany.mockResolvedValueOnce({ count: 0 })
    const count = await expireAllStalePendingRequests()
    expect(count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3. ACCEPT idempotency — retry after successful ACCEPT
// ---------------------------------------------------------------------------

describe('applyDriverSessionAction — ACCEPT idempotency', () => {
  it('returns current state (success) when retrying ACCEPT on already-BOARDED rider', async () => {
    const boardedRider = makePendingRider({
      status: 'BOARDED',
      fareCalculationId: 'calc-1',
      expiresAt: null,
      acceptedAt: new Date('2026-04-16T08:06:00.000Z'),
      boardedAt: new Date('2026-04-16T08:06:00.000Z'),
    })

    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeOpenSession({ riders: [boardedRider] }),
    )
    prismaMock.vehicleTripSession.findUnique.mockResolvedValueOnce(
      makeOpenSession({ riders: [boardedRider] }),
    )

    const response = await applyDriverSessionAction(
      makeDriverRequest(),
      'session-1',
      'sr-1',
      'ACCEPT',
    )

    // No transaction should be started for idempotent case
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(response.success).toBe(true)
    expect(response.message).toMatch(/already accepted/i)
    expect(response.rider.status).toBe('BOARDED')
  })

  it('returns current state (success) when retrying ACCEPT on already-ACCEPTED rider', async () => {
    const acceptedRider = makePendingRider({
      status: 'ACCEPTED',
      fareCalculationId: 'calc-1',
      expiresAt: null,
      acceptedAt: new Date('2026-04-16T08:06:00.000Z'),
    })

    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeOpenSession({ riders: [acceptedRider] }),
    )
    prismaMock.vehicleTripSession.findUnique.mockResolvedValueOnce(
      makeOpenSession({ riders: [acceptedRider] }),
    )

    const response = await applyDriverSessionAction(
      makeDriverRequest(),
      'session-1',
      'sr-1',
      'ACCEPT',
    )

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(response.success).toBe(true)
    expect(response.rider.status).toBe('ACCEPTED')
  })

  it('still throws INVALID_RIDER_TRANSITION for non-ACCEPT actions on wrong status', async () => {
    const boardedRider = makePendingRider({ status: 'BOARDED' })

    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeOpenSession({ riders: [boardedRider] }),
    )

    // WRONG_TRIP is only valid from PENDING — should still throw
    await expect(
      applyDriverSessionAction(makeDriverRequest(), 'session-1', 'sr-1', 'WRONG_TRIP'),
    ).rejects.toMatchObject({ code: 'INVALID_RIDER_TRANSITION' })
  })
})

// ---------------------------------------------------------------------------
// 4. Duplicate FareCalculation prevention (concurrent ACCEPT)
// ---------------------------------------------------------------------------

describe('applyDriverSessionAction — duplicate ACCEPT prevention', () => {
  it('rolls back FareCalculation creation when concurrent ACCEPT already updated the row', async () => {
    // expiresAt must be in the future so the expiry-check path is not triggered first
    const pendingRider = makePendingRider({
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })

    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeOpenSession({ riders: [pendingRider] }),
    )

    // Simulate concurrent ACCEPT: updateMany finds 0 matching rows
    txMock.vehicleTripSessionRider.updateMany.mockResolvedValueOnce({ count: 0 })
    txMock.fareCalculation.create.mockResolvedValueOnce({ id: 'calc-concurrent' })

    await expect(
      applyDriverSessionAction(makeDriverRequest(), 'session-1', 'sr-1', 'ACCEPT'),
    ).rejects.toMatchObject({ code: 'SESSION_RIDER_ALREADY_UPDATED' })

    // FareCalculation.create was called — the transaction rollback is DB-level;
    // in unit test the mock can't rollback, but the service correctly throws
    // so the caller knows the ACCEPT did NOT succeed.
    expect(txMock.fareCalculation.create).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// 5. Expired rider blocked from driver ACCEPT
// ---------------------------------------------------------------------------

describe('applyDriverSessionAction — expired rider check', () => {
  it('expires and rejects an already-expired PENDING rider on ACCEPT attempt', async () => {
    const expiredRider = makePendingRider({
      expiresAt: new Date('2026-04-16T07:00:00.000Z'), // past
    })

    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeOpenSession({ riders: [expiredRider] }),
    )
    txMock.vehicleTripSessionRider.updateMany.mockResolvedValueOnce({ count: 1 })

    await expect(
      applyDriverSessionAction(makeDriverRequest(), 'session-1', 'sr-1', 'ACCEPT'),
    ).rejects.toMatchObject({ code: 'SESSION_RIDER_EXPIRED' })
  })
})
