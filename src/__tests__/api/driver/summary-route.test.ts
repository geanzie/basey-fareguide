import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
  },
  fareCalculation: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  incident: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthWithSelect: authMock.verifyAuthWithSelect,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/incidents/penaltyRules', () => ({
  normalizePlateNumber: (plateNumber: string | null | undefined) => {
    if (!plateNumber) {
      return null
    }

    const normalized = plateNumber.trim().toUpperCase()
    return normalized.length > 0 ? normalized : null
  },
}))

import { GET } from '@/app/api/driver/summary/route'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/driver/summary', () => {
  it('rejects unauthenticated access', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce(null)

    const response = await GET(new Request('http://localhost/api/driver/summary') as never)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.message).toBe('Unauthorized')
  })

  it('returns a read-only summary for the assigned driver vehicle', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValueOnce({
      id: 'driver-1',
      firstName: 'Driver',
      lastName: 'One',
      username: 'ABC-123',
      userType: 'DRIVER',
      isActive: true,
      isVerified: true,
      assignedVehicleId: 'vehicle-1',
      assignedVehicleAssignedAt: new Date('2026-04-01T00:00:00.000Z'),
    })
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({
      id: 'vehicle-1',
      plateNumber: 'ABC-123',
      vehicleType: 'TRICYCLE',
      make: 'Honda',
      model: 'Wave',
      color: 'Blue',
      isActive: true,
      registrationExpiry: new Date('2027-01-01T00:00:00.000Z'),
      insuranceExpiry: null,
      permit: {
        id: 'permit-1',
        permitPlateNumber: 'BP-1001',
        qrToken: 'qr-token-1',
        qrIssuedAt: new Date('2026-04-02T00:00:00.000Z'),
        driverFullName: 'Driver One',
        status: 'ACTIVE',
        issuedDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2027-01-01T00:00:00.000Z'),
      },
    })
    prismaMock.fareCalculation.count.mockResolvedValueOnce(3)
    prismaMock.incident.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
    prismaMock.incident.aggregate.mockResolvedValueOnce({ _sum: { penaltyAmount: 500 } })
    prismaMock.fareCalculation.findMany.mockResolvedValueOnce([
      {
        id: 'calc-1',
        fromLocation: 'Market',
        toLocation: 'Terminal',
        calculatedFare: 35,
        createdAt: new Date('2026-04-10T12:00:00.000Z'),
      },
    ])

    const response = await GET(new Request('http://localhost/api/driver/summary') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.driver.username).toBe('ABC-123')
    expect(json.vehicle.plateNumber).toBe('ABC-123')
    expect(json.permit.permitPlateNumber).toBe('BP-1001')
    expect(json.summary).toMatchObject({
      fareCalculationCount: 3,
      totalIncidents: 4,
      openIncidents: 1,
      unpaidTickets: 2,
      outstandingPenalties: 500,
    })
    expect(json.recentFareCalculations).toHaveLength(1)
  })
})