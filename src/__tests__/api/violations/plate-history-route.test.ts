import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  incident: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  vehicle: {
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENFORCER: ['ADMIN', 'ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/violations/history/[plateNumber]/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'enforcer-1', userType: 'ENFORCER' })
})

describe('GET /api/violations/history/[plateNumber]', () => {
  it('prefers canonical exact plate matching when the vehicle lookup resolves a canonical plate', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValueOnce({
      id: 'vehicle-1',
      plateNumber: 'ABC-123',
      vehicleType: 'JEEPNEY',
      make: 'Toyota',
      model: 'HiAce',
      year: 2020,
      color: 'White',
      capacity: 18,
      ownerName: 'Owner Name',
      ownerContact: '09123456789',
      driverName: 'Driver Name',
      driverLicense: 'D-123',
      isActive: true,
      registrationExpiry: new Date('2027-01-01T00:00:00.000Z'),
      insuranceExpiry: null,
    })
    prismaMock.incident.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
    prismaMock.incident.findMany.mockResolvedValueOnce([
      {
        id: 'incident-1',
        plateNumber: 'ABC-123',
        ticketNumber: 'T-1001',
      },
    ])
    prismaMock.incident.aggregate
      .mockResolvedValueOnce({ _sum: { penaltyAmount: 1500 } })
      .mockResolvedValueOnce({ _sum: { penaltyAmount: 500 } })

    const response = await GET(
      new Request('http://localhost/api/violations/history/abc-123?page=1&limit=25') as never,
      { params: Promise.resolve({ plateNumber: 'abc-123' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.plateNumber).toBe('ABC-123')
    expect(prismaMock.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          plateNumber: {
            equals: 'ABC-123',
            mode: 'insensitive',
          },
        },
      }),
    )
    expect(prismaMock.incident.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          OR: [
            { vehicleId: 'vehicle-1' },
            { plateNumber: { in: ['abc-123', 'ABC-123'] } },
          ],
        },
      }),
    )
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { vehicleId: 'vehicle-1' },
            { plateNumber: { in: ['abc-123', 'ABC-123'] } },
          ],
        },
      }),
    )
  })

  it('falls back to the insensitive incident filter when no exact canonical matches exist', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValueOnce(null)
    prismaMock.incident.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    prismaMock.incident.findMany.mockResolvedValueOnce([
      {
        id: 'incident-legacy-1',
        plateNumber: 'Abc-123',
        ticketNumber: 'T-1002',
      },
    ])
    prismaMock.incident.aggregate
      .mockResolvedValueOnce({ _sum: { penaltyAmount: 500 } })
      .mockResolvedValueOnce({ _sum: { penaltyAmount: 500 } })

    const response = await GET(
      new Request('http://localhost/api/violations/history/ABC-123?page=1&limit=25') as never,
      { params: Promise.resolve({ plateNumber: 'ABC-123' }) },
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.plateNumber).toBe('ABC-123')
    expect(prismaMock.incident.count).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          plateNumber: {
            in: ['ABC-123'],
          },
        },
      }),
    )
    expect(prismaMock.incident.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          plateNumber: {
            equals: 'ABC-123',
            mode: 'insensitive',
          },
        },
      }),
    )
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          plateNumber: {
            equals: 'ABC-123',
            mode: 'insensitive',
          },
        },
      }),
    )
  })
})