import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
  },
  fareCalculation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}))

const driverSessionMock = vi.hoisted(() => ({
  createPendingTripRequest: vi.fn(),
  createRiderConfirmedTrip: vi.fn(),
}))

const suspensionMock = vi.hoisted(() => ({
  isDriverAcceptSuspended: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  verifyAuth: authMock.verifyAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/driverSession', () => ({
  createPendingTripRequest: driverSessionMock.createPendingTripRequest,
  createRiderConfirmedTrip: driverSessionMock.createRiderConfirmedTrip,
}))

vi.mock('@/lib/driverSessionSettings/settingsService', () => ({
  isDriverAcceptSuspended: suspensionMock.isDriverAcceptSuspended,
}))

import { POST } from '@/app/api/fare-calculations/route'

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/fare-calculations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromLocation: 'Poblacion',
      toLocation: 'Basey Church',
      distance: 4.2,
      calculatedFare: 18,
      calculationType: 'ROUTE',
      vehicleId: 'vehicle-1',
      ...overrides,
    }),
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuth.mockResolvedValue({ id: 'rider-1', userType: 'PUBLIC' })
  prismaMock.vehicle.findUnique.mockResolvedValue({
    id: 'vehicle-1',
    isActive: true,
    vehicleType: 'TRICYCLE',
  })
})

describe('POST /api/fare-calculations — which flow a scanned vehicle takes', () => {
  it('commits the trip immediately for a suspended vehicle type', async () => {
    suspensionMock.isDriverAcceptSuspended.mockResolvedValue(true)
    driverSessionMock.createRiderConfirmedTrip.mockResolvedValue({
      id: 'rider-entry-1',
      sessionId: 'session-r1',
      fareCalculationId: 'fare-1',
      status: 'BOARDED',
      created: true,
    })

    const response = await POST(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json).toMatchObject({
      success: true,
      tripRequestId: 'rider-entry-1',
      requestStatus: 'BOARDED',
      riderConfirmsTrip: true,
      message: 'Trip started',
    })
    expect(driverSessionMock.createRiderConfirmedTrip).toHaveBeenCalledOnce()
    expect(driverSessionMock.createPendingTripRequest).not.toHaveBeenCalled()
  })

  it('still offers the request to the driver for a vehicle type that is not suspended', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-2',
      isActive: true,
      vehicleType: 'JEEPNEY',
    })
    suspensionMock.isDriverAcceptSuspended.mockResolvedValue(false)
    driverSessionMock.createPendingTripRequest.mockResolvedValue({
      id: 'rider-entry-2',
      sessionId: 'session-1',
      fareCalculationId: null,
      status: 'PENDING',
      created: true,
    })

    const response = await POST(makeRequest({ vehicleId: 'vehicle-2' }))
    const json = await response.json()

    expect(json).toMatchObject({
      requestStatus: 'PENDING',
      riderConfirmsTrip: false,
      message: 'Trip request sent successfully',
    })
    expect(driverSessionMock.createRiderConfirmedTrip).not.toHaveBeenCalled()
  })

  it('does not charge twice when the rider re-submits the same scan', async () => {
    suspensionMock.isDriverAcceptSuspended.mockResolvedValue(true)
    driverSessionMock.createRiderConfirmedTrip.mockResolvedValue({
      id: 'rider-entry-1',
      sessionId: 'session-r1',
      fareCalculationId: 'fare-1',
      status: 'BOARDED',
      created: false,
    })

    const json = await (await POST(makeRequest())).json()

    expect(json.message).toBe('Trip already in progress')
  })

  it('still requires a scanned vehicle', async () => {
    const response = await POST(makeRequest({ vehicleId: '' }))

    expect(response.status).toBe(400)
    expect(driverSessionMock.createRiderConfirmedTrip).not.toHaveBeenCalled()
    expect(driverSessionMock.createPendingTripRequest).not.toHaveBeenCalled()
  })

  it('refuses an inactive vehicle before deciding on a flow', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      isActive: false,
      vehicleType: 'TRICYCLE',
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    expect(suspensionMock.isDriverAcceptSuspended).not.toHaveBeenCalled()
  })
})
