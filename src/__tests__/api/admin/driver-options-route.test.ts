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
  vehicle: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/admin/users/driver-options/route'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
})

describe('GET /api/admin/users/driver-options', () => {
  it('rejects non-admin access', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await GET(new Request('http://localhost/api/admin/users/driver-options') as never)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json).toEqual({ success: false, error: 'Access denied. Insufficient permissions.' })
    expect(prismaMock.vehicle.findMany).not.toHaveBeenCalled()
  })

  it('returns unassigned registered drivers with plate-number usernames', async () => {
    prismaMock.vehicle.findMany.mockResolvedValueOnce([
      {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        driverName: 'Pedro Santos',
        driverLicense: 'D-1234',
        permit: {
          permitPlateNumber: 'PERMIT-001',
          driverFullName: 'Pedro Santos',
        },
      },
      {
        id: 'vehicle-2',
        plateNumber: 'XYZ-789',
        vehicleType: 'HABAL_HABAL',
        driverName: null,
        driverLicense: null,
        permit: {
          permitPlateNumber: 'PERMIT-002',
          driverFullName: 'Liza Mae',
        },
      },
    ])

    const response = await GET(new Request('http://localhost/api/admin/users/driver-options') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          assignedDriver: null,
        }),
      }),
    )
    expect(json.success).toBe(true)
    expect(json.data.drivers).toEqual([
      expect.objectContaining({
        vehicleId: 'vehicle-1',
        driverName: 'Pedro Santos',
        username: 'ABC-123',
        plateNumber: 'ABC-123',
      }),
      expect.objectContaining({
        vehicleId: 'vehicle-2',
        driverName: 'Liza Mae',
        username: 'XYZ-789',
        plateNumber: 'XYZ-789',
      }),
    ])
  })
})