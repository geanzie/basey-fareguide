import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  requireRequestUser: vi.fn(),
  verifyAuth: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  permit: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
}))

const serializersMock = vi.hoisted(() => ({
  serializePermit: vi.fn((permit: Record<string, unknown>) => permit),
  serializeVehicle: vi.fn((vehicle: Record<string, unknown>) => vehicle),
  serializeVehicleLookup: vi.fn((vehicle: Record<string, unknown>) => vehicle),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  ADMIN_OR_ENCODER: ['ADMIN', 'DATA_ENCODER'],
  requireRequestRole: authMock.requireRequestRole,
  requireRequestUser: authMock.requireRequestUser,
  verifyAuth: authMock.verifyAuth,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/serializers', () => ({
  serializePermit: serializersMock.serializePermit,
  serializeVehicle: serializersMock.serializeVehicle,
  serializeVehicleLookup: serializersMock.serializeVehicleLookup,
}))

import { GET as getPermitList } from '@/app/api/permits/route'
import { GET as getPermitDetail } from '@/app/api/permits/[id]/route'
import { GET as getPermitQrDetail } from '@/app/api/permits/[id]/qr/route'
import { GET as getVehicleDetail } from '@/app/api/vehicles/[id]/route'
import { GET as getVehicleOptions } from '@/app/api/vehicles/options/route'
import { GET as getUsers } from '@/app/api/users/route'

function makeRequest(url: string) {
  return new Request(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.verifyAuth.mockResolvedValue({
    id: 'public-1',
    firstName: 'Pat',
    lastName: 'Citizen',
    username: 'public-user',
    userType: 'PUBLIC',
    isActive: true,
  })
})

describe('P0 authorization exposure validation', () => {
  it('rejects anonymous permit listing requests', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await getPermitList(
      makeRequest('http://localhost/api/permits?search=juan&page=1&limit=10') as never,
    )

    expect(response.status).toBe(401)
    expect(prismaMock.permit.findMany).not.toHaveBeenCalled()
    expect(prismaMock.permit.count).not.toHaveBeenCalled()
  })

  it('rejects anonymous permit detail reads by id', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await getPermitDetail(
      makeRequest('http://localhost/api/permits/permit-1') as never,
      { params: Promise.resolve({ id: 'permit-1' }) },
    )

    expect(response.status).toBe(401)
    expect(prismaMock.permit.findUnique).not.toHaveBeenCalled()
  })

  it('rejects anonymous QR detail reads by permit id', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await getPermitQrDetail(
      makeRequest('http://localhost/api/permits/permit-1/qr') as never,
      { params: Promise.resolve({ id: 'permit-1' }) },
    )

    expect(response.status).toBe(401)
    expect(prismaMock.permit.findUnique).not.toHaveBeenCalled()
  })

  it('rejects anonymous vehicle detail reads by id', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const response = await getVehicleDetail(
      makeRequest('http://localhost/api/vehicles/vehicle-1') as never,
      { params: Promise.resolve({ id: 'vehicle-1' }) },
    )

    expect(response.status).toBe(401)
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled()
  })

  it('redacts owner and driver identity fields for authenticated public users in vehicle lookup', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    authMock.requireRequestUser.mockResolvedValueOnce({
      id: 'public-1',
      userType: 'PUBLIC',
    })

    prismaMock.vehicle.findMany.mockResolvedValueOnce([
      {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        make: 'Honda',
        model: 'Wave',
        color: 'Blue',
        ownerName: 'Owner One',
        driverName: 'Driver One',
        driverLicense: 'D-12345',
        permit: {
          permitPlateNumber: 'PERM-001',
        },
      },
    ])

    const response = await getVehicleOptions(
      makeRequest('http://localhost/api/vehicles/options?search=ABC&limit=5') as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(authMock.requireRequestUser).toHaveBeenCalled()
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
    expect(infoSpy).toHaveBeenCalled()
  })

  it('blocks PUBLIC users from enumerating active users', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const response = await getUsers(
      makeRequest('http://localhost/api/users') as never,
    )

    expect(response.status).toBe(403)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('caps the user directory limit for authorized admins', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.user.findMany.mockResolvedValueOnce([])

    const response = await getUsers(
      makeRequest('http://localhost/api/users?limit=200') as never,
    )

    expect(response.status).toBe(200)
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    )
  })
})