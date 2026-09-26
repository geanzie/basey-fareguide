import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  verifyAuthWithSelect: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
  },
  incident: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  verifyAuthWithSelect: authMock.verifyAuthWithSelect,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/driver/incidents/count/route'

function request() {
  return new Request('http://localhost/api/driver/incidents/count') as never
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuthWithSelect.mockResolvedValue({
    id: 'driver-1',
    userType: 'DRIVER',
    assignedVehicleId: 'vehicle-1',
  })
  prismaMock.vehicle.findUnique.mockResolvedValue({ id: 'vehicle-1', plateNumber: 'abc 123' })
  prismaMock.incident.count.mockResolvedValue(2)
})

describe('GET /api/driver/incidents/count', () => {
  it('narrows the unlinked-plate lookup to this plate in the database', async () => {
    prismaMock.incident.findMany.mockResolvedValue([])

    await GET(request())

    // Without the plate filter this read every open unlinked incident in the
    // municipality on each 60-second poll from every driver.
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vehicleId: null,
          plateNumber: { contains: 'ABC 123', mode: 'insensitive' },
        }),
      }),
    )
  })

  it('counts only rows whose normalized plate equals the vehicle plate', async () => {
    // `contains` is a prefilter; "XABC 123" matches it but is another vehicle.
    prismaMock.incident.findMany.mockResolvedValue([
      { plateNumber: ' abc 123 ' },
      { plateNumber: 'ABC 123' },
      { plateNumber: 'XABC 123' },
    ])

    const response = await GET(request())

    expect(await response.json()).toEqual({ count: 4 })
  })

  it('returns zero for a driver with no assigned vehicle', async () => {
    authMock.verifyAuthWithSelect.mockResolvedValue({
      id: 'driver-1',
      userType: 'DRIVER',
      assignedVehicleId: null,
    })

    const response = await GET(request())

    expect(await response.json()).toEqual({ count: 0 })
    expect(prismaMock.incident.findMany).not.toHaveBeenCalled()
  })
})
