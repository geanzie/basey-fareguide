import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
}))

const suspensionMock = vi.hoisted(() => ({
  isDriverAcceptSuspended: vi.fn(),
}))

const transactionMock = vi.hoisted(() => ({
  vehicleTripSession: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  vehicleTripSessionRider: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  vehicleTripSessionRiderEvent: {
    create: vi.fn(),
  },
  fareCalculation: {
    create: vi.fn(),
  },
  discountUsageLog: {
    create: vi.fn(),
  },
  discountCard: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
  },
  vehicleTripSession: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  vehicleTripSessionRider: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(
    async (
      callbackOrArray:
        | ((tx: typeof transactionMock) => Promise<unknown>)
        | Promise<unknown>[],
    ) => {
      if (Array.isArray(callbackOrArray)) return Promise.all(callbackOrArray)
      return callbackOrArray(transactionMock)
    },
  ),
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthWithSelect: authMock.verifyAuthWithSelect,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/driverSessionSettings/settingsService', () => ({
  isDriverAcceptSuspended: suspensionMock.isDriverAcceptSuspended,
}))

import {
  applyDriverSessionAction,
  applyRiderTripAction,
  buildAvailableRiderActions,
  closeDriverSession,
  createRiderConfirmedTrip,
  getDriverSessionActiveResponse,
  isDriverSessionError,
  startDriverSession,
} from '@/lib/driverSession'

function makeDriverRequest() {
  return { nextUrl: new URL('http://localhost/api/driver/session') } as never
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

function makeTripCandidate(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'rider-1',
    vehicleId: 'vehicle-1',
    fromLocation: 'Poblacion',
    toLocation: 'Basey Church',
    distance: 4.2,
    calculatedFare: 18,
    calculationType: 'ROUTE',
    routeData: null,
    farePolicySnapshot: null,
    discountCardId: null,
    originalFare: null,
    discountApplied: null,
    discountType: null,
    createdAt: new Date('2026-09-02T08:00:00.000Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  suspensionMock.isDriverAcceptSuspended.mockResolvedValue(true)
  authMock.verifyAuthWithSelect.mockResolvedValue(makeDriverUser())
  prismaMock.vehicle.findUnique.mockResolvedValue({
    id: 'vehicle-1',
    plateNumber: 'ABC-123',
    vehicleType: 'TRICYCLE',
    make: 'Honda',
    model: 'TMX',
    color: 'Blue',
  })
})

describe('driver session routes while the vehicle type is suspended', () => {
  it('refuses to open a session', async () => {
    await expect(startDriverSession(makeDriverRequest())).rejects.toMatchObject({
      status: 409,
      code: 'DRIVER_SESSION_SUSPENDED',
    })
  })

  it('refuses to read the rider queue', async () => {
    await expect(
      getDriverSessionActiveResponse(makeDriverRequest()),
    ).rejects.toMatchObject({ code: 'DRIVER_SESSION_SUSPENDED' })
  })

  it('refuses to close a session', async () => {
    await expect(
      closeDriverSession(makeDriverRequest(), 'session-1'),
    ).rejects.toMatchObject({ code: 'DRIVER_SESSION_SUSPENDED' })
  })

  it.each(['ACCEPT', 'BOARDED', 'DROPPED_OFF', 'NOT_HERE', 'FULL', 'WRONG_TRIP', 'CANCELLED'])(
    'refuses the %s rider action',
    async (action) => {
      const error = await applyDriverSessionAction(
        makeDriverRequest(),
        'session-1',
        'rider-entry-1',
        action as never,
      ).catch((thrown) => thrown)

      expect(isDriverSessionError(error)).toBe(true)
      expect(error).toMatchObject({ status: 409, code: 'DRIVER_SESSION_SUSPENDED' })
    },
  )

  it('still allows the driver flow when the type is not suspended', async () => {
    suspensionMock.isDriverAcceptSuspended.mockResolvedValue(false)
    prismaMock.vehicleTripSession.findFirst.mockResolvedValue(null)

    await expect(startDriverSession(makeDriverRequest())).rejects.not.toMatchObject({
      code: 'DRIVER_SESSION_SUSPENDED',
    })
  })
})

describe('createRiderConfirmedTrip', () => {
  it('opens a rider-initiated session, boards the rider and writes the fare immediately', async () => {
    transactionMock.vehicleTripSession.findFirst.mockResolvedValue(null)
    transactionMock.vehicleTripSession.create.mockResolvedValue({ id: 'session-r1' })
    transactionMock.vehicleTripSessionRider.findFirst.mockResolvedValue(null)
    transactionMock.fareCalculation.create.mockResolvedValue({ id: 'fare-1' })
    transactionMock.vehicleTripSessionRider.create.mockResolvedValue({
      id: 'rider-entry-1',
      sessionId: 'session-r1',
      fareCalculationId: 'fare-1',
      status: 'BOARDED',
    })

    const result = await createRiderConfirmedTrip(makeTripCandidate(), 'PUBLIC' as never)

    expect(result).toMatchObject({ id: 'rider-entry-1', status: 'BOARDED', created: true })

    // No driver account exists on this flow at all.
    expect(transactionMock.vehicleTripSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driverUserId: null,
          initiatedBy: 'RIDER',
          status: 'IN_PROGRESS',
        }),
      }),
    )

    // The fare is recorded on the scan, not on a later acceptance.
    expect(transactionMock.fareCalculation.create).toHaveBeenCalledOnce()
    expect(transactionMock.vehicleTripSessionRider.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'BOARDED',
          fareCalculationId: 'fare-1',
          expiresAt: null,
        }),
      }),
    )
    expect(transactionMock.vehicleTripSessionRiderEvent.create).toHaveBeenCalledOnce()
  })

  it('reuses an open rider-initiated session so two riders share the same tricycle run', async () => {
    transactionMock.vehicleTripSession.findFirst.mockResolvedValue({ id: 'session-r1' })
    transactionMock.vehicleTripSessionRider.findFirst.mockResolvedValue(null)
    transactionMock.fareCalculation.create.mockResolvedValue({ id: 'fare-2' })
    transactionMock.vehicleTripSessionRider.create.mockResolvedValue({
      id: 'rider-entry-2',
      sessionId: 'session-r1',
      fareCalculationId: 'fare-2',
      status: 'BOARDED',
    })

    await createRiderConfirmedTrip(
      makeTripCandidate({ userId: 'rider-2' }),
      'PUBLIC' as never,
    )

    expect(transactionMock.vehicleTripSession.create).not.toHaveBeenCalled()
    expect(transactionMock.vehicleTripSessionRider.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: 'session-r1' }),
      }),
    )
  })

  it('does not charge twice when the same rider re-submits in the same session', async () => {
    transactionMock.vehicleTripSession.findFirst.mockResolvedValue({ id: 'session-r1' })
    transactionMock.vehicleTripSessionRider.findFirst.mockResolvedValue({
      id: 'rider-entry-1',
      sessionId: 'session-r1',
      fareCalculationId: 'fare-1',
      status: 'BOARDED',
    })

    const result = await createRiderConfirmedTrip(makeTripCandidate(), 'PUBLIC' as never)

    expect(result).toMatchObject({ created: false, fareCalculationId: 'fare-1' })
    expect(transactionMock.fareCalculation.create).not.toHaveBeenCalled()
    expect(transactionMock.vehicleTripSessionRider.create).not.toHaveBeenCalled()
  })

  it('ignores non-PUBLIC callers', async () => {
    await expect(
      createRiderConfirmedTrip(makeTripCandidate(), 'DRIVER' as never),
    ).resolves.toBeNull()
  })
})

describe('applyRiderTripAction', () => {
  function boardedRider(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rider-entry-1',
      status: 'BOARDED',
      sessionId: 'session-r1',
      session: { id: 'session-r1', initiatedBy: 'RIDER', status: 'IN_PROGRESS' },
      ...overrides,
    }
  }

  it('completes the trip and closes the session once nobody is aboard', async () => {
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValue(boardedRider())
    transactionMock.vehicleTripSessionRider.updateMany.mockResolvedValue({ count: 1 })
    transactionMock.vehicleTripSessionRider.count.mockResolvedValue(0)

    const result = await applyRiderTripAction('rider-1', 'rider-entry-1', 'DROPPED_OFF')

    expect(result.status).toBe('COMPLETED')
    expect(transactionMock.vehicleTripSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CLOSED' }),
      }),
    )
  })

  it('leaves the session open while another rider is still aboard', async () => {
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValue(boardedRider())
    transactionMock.vehicleTripSessionRider.updateMany.mockResolvedValue({ count: 1 })
    transactionMock.vehicleTripSessionRider.count.mockResolvedValue(1)

    await applyRiderTripAction('rider-1', 'rider-entry-1', 'DROPPED_OFF')

    expect(transactionMock.vehicleTripSession.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to touch a driver-run trip', async () => {
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValue(
      boardedRider({
        session: { id: 'session-1', initiatedBy: 'DRIVER', status: 'IN_PROGRESS' },
      }),
    )

    await expect(
      applyRiderTripAction('rider-1', 'rider-entry-1', 'DROPPED_OFF'),
    ).rejects.toMatchObject({ status: 409, code: 'RIDER_ACTION_NOT_ALLOWED' })
  })

  it('rejects a transition the trip is not in', async () => {
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValue(
      boardedRider({ status: 'PENDING' }),
    )

    await expect(
      applyRiderTripAction('rider-1', 'rider-entry-1', 'DROPPED_OFF'),
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_RIDER_TRANSITION' })
  })

  it('treats a retry after success as success', async () => {
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValue(
      boardedRider({ status: 'COMPLETED' }),
    )

    await expect(
      applyRiderTripAction('rider-1', 'rider-entry-1', 'DROPPED_OFF'),
    ).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  it('404s a trip belonging to somebody else', async () => {
    prismaMock.vehicleTripSessionRider.findFirst.mockResolvedValue(null)

    await expect(
      applyRiderTripAction('rider-1', 'rider-entry-1', 'DROPPED_OFF'),
    ).rejects.toMatchObject({ status: 404, code: 'SESSION_RIDER_NOT_FOUND' })
  })
})

describe('buildAvailableRiderActions', () => {
  it('offers dropped off and cancel while the rider is aboard their own trip', () => {
    expect(buildAvailableRiderActions('BOARDED' as never, true).map((a) => a.action)).toEqual([
      'DROPPED_OFF',
      'CANCELLED',
    ])
  })

  it('offers nothing on a driver-run trip', () => {
    expect(buildAvailableRiderActions('BOARDED' as never, false)).toEqual([])
  })

  it('offers nothing once the trip is finished', () => {
    expect(buildAvailableRiderActions('COMPLETED' as never, true)).toEqual([])
  })
})
