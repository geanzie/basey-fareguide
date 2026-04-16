import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
}))

const transactionMock = vi.hoisted(() => ({
  vehicleTripSessionRider: {
    update: vi.fn(),
  },
  vehicleTripSessionRiderEvent: {
    create: vi.fn(),
  },
  vehicleTripSession: {
    update: vi.fn(),
  },
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
  },
  vehicleTripSession: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  vehicleTripSessionRider: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  vehicleTripSessionRiderEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)),
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthWithSelect: authMock.verifyAuthWithSelect,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import {
  DriverSessionError,
  applyDriverSessionAction,
  closeDriverSession,
  startDriverSession,
} from '@/lib/driverSession'

function makeDriverRequest() {
  return new Request('http://localhost/api/driver/session') as never
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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    status: 'OPEN',
    openedAt: new Date('2026-04-15T08:00:00.000Z'),
    closedAt: null,
    riders: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuthWithSelect.mockResolvedValue(makeDriverUser())
  prismaMock.vehicle.findUnique.mockResolvedValue(makeVehicle())
  prismaMock.vehicleTripSession.findFirst.mockResolvedValue(makeSession())
  prismaMock.vehicleTripSession.findUnique.mockResolvedValue(makeSession())
  prismaMock.vehicleTripSession.create.mockResolvedValue({ id: 'session-1' })
})

describe('driver session service', () => {
  it('reuses the existing active session instead of creating a duplicate one', async () => {
    const response = await startDriverSession(makeDriverRequest())

    expect(prismaMock.vehicleTripSession.create).not.toHaveBeenCalled()
    expect(response.session.id).toBe('session-1')
    expect(response.session.canStartSession).toBe(false)
  })

  it('accepts a pending rider using the canonical transition map', async () => {
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeSession({
        riders: [
          {
            id: 'session-rider-1',
            fareCalculationId: 'calc-1',
            status: 'PENDING',
            originSnapshot: 'Mercado',
            destinationSnapshot: 'Terminal',
            fareSnapshot: 35,
            discountTypeSnapshot: null,
            joinedAt: new Date('2026-04-15T08:05:00.000Z'),
          },
        ],
      }),
    )
    prismaMock.vehicleTripSession.findUnique.mockResolvedValueOnce(
      makeSession({
        riders: [
          {
            id: 'session-rider-1',
            fareCalculationId: 'calc-1',
            status: 'BOARDED',
            originSnapshot: 'Mercado',
            destinationSnapshot: 'Terminal',
            fareSnapshot: 35,
            discountTypeSnapshot: null,
            joinedAt: new Date('2026-04-15T08:05:00.000Z'),
          },
        ],
      }),
    )

    const response = await applyDriverSessionAction(
      makeDriverRequest(),
      'session-1',
      'session-rider-1',
      'ACCEPT',
    )

    expect(transactionMock.vehicleTripSessionRider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-rider-1' },
        data: expect.objectContaining({ status: 'BOARDED' }),
      }),
    )
    expect(transactionMock.vehicleTripSessionRiderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ACCEPT',
          fromStatus: 'PENDING',
          toStatus: 'BOARDED',
          actedByUserId: 'driver-1',
        }),
      }),
    )
    expect(response.rider.status).toBe('BOARDED')
  })

  it('rejects invalid rider state transitions', async () => {
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(
      makeSession({
        riders: [
          {
            id: 'session-rider-1',
            fareCalculationId: 'calc-1',
            status: 'PENDING',
            originSnapshot: 'Mercado',
            destinationSnapshot: 'Terminal',
            fareSnapshot: 35,
            discountTypeSnapshot: null,
            joinedAt: new Date('2026-04-15T08:05:00.000Z'),
          },
        ],
      }),
    )

    await expect(
      applyDriverSessionAction(makeDriverRequest(), 'session-1', 'session-rider-1', 'DROPPED_OFF'),
    ).rejects.toMatchObject<Partial<DriverSessionError>>({
      status: 409,
      code: 'INVALID_RIDER_TRANSITION',
    })
  })

  it('blocks closing or mutating a session outside the assigned vehicle scope', async () => {
    prismaMock.vehicleTripSession.findFirst.mockResolvedValueOnce(null)

    await expect(closeDriverSession(makeDriverRequest(), 'session-other')).rejects.toMatchObject<Partial<DriverSessionError>>({
      status: 404,
      code: 'SESSION_NOT_FOUND',
    })
  })
})