import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findMany: vi.fn(),
  },
}))

const serializersMock = vi.hoisted(() => ({
  serializeVehicleLookup: vi.fn((vehicle: Record<string, unknown>) => ({
    ...vehicle,
    serialized: true,
  })),
}))

vi.mock('@/lib/auth', () => ({
  requireRequestUser: authMock.requireRequestUser,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/serializers', () => ({
  serializeVehicleLookup: serializersMock.serializeVehicleLookup,
}))

import { GET } from '@/app/api/vehicles/options/route'

function makeRequest(url: string) {
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestUser.mockResolvedValue({ id: 'encoder-1', userType: 'DATA_ENCODER' })
})

describe('GET /api/vehicles/options', () => {
  it('rejects unauthenticated lookup requests', async () => {
    authMock.requireRequestUser.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await GET(
      makeRequest('http://localhost/api/vehicles/options?search=ab') as never,
    )

    expect(response.status).toBe(401)
    expect(prismaMock.vehicle.findMany).not.toHaveBeenCalled()
  })

  it('returns empty results for short searches without querying prisma', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const response = await GET(
      makeRequest('http://localhost/api/vehicles/options?search=a') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.vehicles).toEqual([])
    expect(prismaMock.vehicle.findMany).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledWith(
      '[vehicle-options] query',
      expect.objectContaining({
        queryLength: 1,
        resultCount: 0,
      }),
    )
  })

  it('queries active permitted vehicles with a lightweight lookup response', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    prismaMock.vehicle.findMany.mockResolvedValueOnce([
      {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'Wave',
        color: 'Blue',
        ownerName: 'Juan Dela Cruz',
        driverName: 'Pedro Santos',
        driverLicense: 'D-1234',
        permit: {
          permitPlateNumber: 'PERMIT-001',
        },
      },
    ])

    const response = await GET(
      makeRequest(
        'http://localhost/api/vehicles/options?search=ab&limit=5&activeOnly=true&requireActivePermit=true',
      ) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          isActive: true,
          permit: {
            is: expect.objectContaining({
              status: 'ACTIVE',
              expiryDate: expect.objectContaining({
                gt: expect.any(Date),
              }),
            }),
          },
        }),
      }),
    )
    expect(serializersMock.serializeVehicleLookup).toHaveBeenCalledTimes(1)
    expect(json.vehicles[0]).toEqual(
      expect.objectContaining({
        id: 'vehicle-1',
        serialized: true,
      }),
    )
    expect(infoSpy).toHaveBeenCalledWith(
      '[vehicle-options] query',
      expect.objectContaining({
        queryLength: 2,
        limit: 5,
        resultCount: 1,
        activeOnly: true,
        requireActivePermit: true,
      }),
    )
  })

  it('logs slow queries when lookup duration exceeds the threshold', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const nowSpy = vi.spyOn(Date, 'now')

    prismaMock.vehicle.findMany.mockResolvedValueOnce([])
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1605)

    const response = await GET(
      makeRequest('http://localhost/api/vehicles/options?search=permit') as never,
    )

    expect(response.status).toBe(200)
    expect(infoSpy).toHaveBeenCalledWith(
      '[vehicle-options] query',
      expect.objectContaining({
        durationMs: 605,
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      '[vehicle-options] slow-query',
      expect.objectContaining({
        durationMs: 605,
        queryLength: 6,
        resultCount: 0,
      }),
    )
  })

  it('redacts owner and driver identity fields for PUBLIC users', async () => {
    authMock.requireRequestUser.mockResolvedValueOnce({ id: 'public-1', userType: 'PUBLIC' })
    prismaMock.vehicle.findMany.mockResolvedValueOnce([
      {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'Wave',
        color: 'Blue',
        ownerName: 'Juan Dela Cruz',
        driverName: 'Pedro Santos',
        driverLicense: 'D-1234',
        permit: {
          permitPlateNumber: 'PERMIT-001',
        },
      },
    ])

    const response = await GET(
      makeRequest('http://localhost/api/vehicles/options?search=ABC') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.vehicles[0]).toEqual(
      expect.objectContaining({
        ownerName: null,
        driverName: null,
        driverLicense: null,
      }),
    )
    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.not.arrayContaining([
            expect.objectContaining({ ownerName: expect.anything() }),
            expect.objectContaining({ driverName: expect.anything() }),
          ]),
        }),
      }),
    )
  })
})
