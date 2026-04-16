import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ success: false, error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
  },
  adminUserCreation: {
    create: vi.fn(),
  },
  driverVehicleAssignmentHistory: {
    create: vi.fn(),
  },
  userVerificationLog: {
    create: vi.fn(),
  },
}))

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: bcryptMock.hash,
  },
}))

import { POST as createOfficialUser } from '@/app/api/admin/users/create/route'
import { POST as toggleUserStatus } from '@/app/api/admin/users/toggle-status/route'
import { GET as listUsers } from '@/app/api/admin/users/route'

function makeJsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  bcryptMock.hash.mockResolvedValue('hashed-password')
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock))
})

describe('admin user workflow truthfulness', () => {
  it('rejects unsupported public-account creation from the official account workflow', async () => {
    const response = await createOfficialUser(
      makeJsonRequest('http://localhost/api/admin/users/create', {
        username: 'public-user',
        firstName: 'Public',
        lastName: 'User',
        phoneNumber: '09123456789',
        userType: 'PUBLIC',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/administrator, enforcer, data encoder, and driver/i)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('returns the real temporary password payload and logs the creating admin on success', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'user-1',
      firstName: 'Casey',
      lastName: 'Encoder',
      username: 'casey.encoder',
      userType: 'DATA_ENCODER',
      isActive: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      phoneNumber: '09123456789',
      governmentId: null,
      barangayResidence: null,
      reasonForRegistration: null,
      assignedVehicle: null,
    })
    prismaMock.adminUserCreation.create.mockResolvedValueOnce({ id: 'audit-1' })

    const response = await createOfficialUser(
      makeJsonRequest('http://localhost/api/admin/users/create', {
        username: 'casey.encoder',
        firstName: 'Casey',
        lastName: 'Encoder',
        phoneNumber: '09123456789',
        userType: 'DATA_ENCODER',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(json.message).toBe('Official account created successfully')
    expect(json.data.tempPassword).toEqual(expect.any(String))
    expect(json.data.user).toEqual(
      expect.objectContaining({
        id: 'user-1',
        fullName: 'Casey Encoder',
        creationSource: 'ADMIN_CREATED',
      }),
    )
    expect(prismaMock.adminUserCreation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedBy: 'admin-1',
          approvedBy: 'admin-1',
          createdUserId: 'user-1',
          userType: 'DATA_ENCODER',
        }),
      }),
    )
  })

  it('creates driver accounts from an existing BPLO plate and records the initial assignment', async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({
      id: 'vehicle-1',
      plateNumber: 'ABC-123',
      driverName: 'Driver One',
      driverLicense: 'D-1234',
      vehicleType: 'TRICYCLE',
      permit: {
        driverFullName: 'Pedro Driver One',
        permitPlateNumber: 'PERMIT-001',
      },
    })
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'driver-1',
      firstName: 'Pedro',
      lastName: 'Driver One',
      username: 'ABC-123',
      userType: 'DRIVER',
      isActive: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      phoneNumber: null,
      governmentId: null,
      barangayResidence: null,
      reasonForRegistration: null,
      assignedVehicle: {
        id: 'vehicle-1',
        plateNumber: 'ABC-123',
        vehicleType: 'TRICYCLE',
        permit: {
          permitPlateNumber: 'PERMIT-001',
        },
      },
    })
    prismaMock.adminUserCreation.create.mockResolvedValueOnce({ id: 'audit-2' })
    prismaMock.driverVehicleAssignmentHistory.create.mockResolvedValueOnce({ id: 'assignment-1' })

    const response = await createOfficialUser(
      makeJsonRequest('http://localhost/api/admin/users/create', {
        driverVehicleId: 'vehicle-1',
        tempPassword: 'driver-temp-1',
        userType: 'DRIVER',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.vehicle.findUnique).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      select: {
        id: true,
        plateNumber: true,
        driverName: true,
        driverLicense: true,
        vehicleType: true,
        permit: {
          select: {
            driverFullName: true,
            permitPlateNumber: true,
          },
        },
      },
    })
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Pedro',
          lastName: 'Driver One',
          username: 'ABC-123',
          phoneNumber: null,
          userType: 'DRIVER',
          assignedVehicleId: 'vehicle-1',
          assignedVehicleAssignedBy: 'admin-1',
        }),
      }),
    )
    expect(bcryptMock.hash).toHaveBeenCalledWith('driver-temp-1', 12)
    expect(prismaMock.driverVehicleAssignmentHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'driver-1',
          vehicleId: 'vehicle-1',
          assignedBy: 'admin-1',
          reason: 'Initial driver account provisioning',
        }),
      }),
    )
    expect(json.message).toBe('Driver account created successfully')
    expect(json.data.user.assignedVehicle).toEqual({
      vehicleId: 'vehicle-1',
      plateNumber: 'ABC-123',
      vehicleType: 'TRICYCLE',
      permitPlateNumber: 'PERMIT-001',
    })
    expect(json.data.tempPassword).toBe('driver-temp-1')
  })

  it('requires the admin to supply a temporary password for driver accounts', async () => {
    const response = await createOfficialUser(
      makeJsonRequest('http://localhost/api/admin/users/create', {
        driverVehicleId: 'vehicle-1',
        userType: 'DRIVER',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toMatch(/temporary password is required/i)
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('returns a canonical admin list contract without verification-era summary fields', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: 'user-2',
        username: 'casey.encoder',
        firstName: 'Casey',
        lastName: 'Encoder',
        userType: 'DATA_ENCODER',
        isActive: true,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        phoneNumber: '09123456789',
        governmentId: null,
        barangayResidence: null,
        reasonForRegistration: null,
        assignedVehicle: null,
      },
    ])
    prismaMock.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
    prismaMock.user.groupBy.mockResolvedValueOnce([
      { userType: 'ADMIN', _count: { _all: 1 } },
      { userType: 'DATA_ENCODER', _count: { _all: 1 } },
      { userType: 'PUBLIC', _count: { _all: 1 } },
    ])

    const response = await listUsers(new Request('http://localhost/api/admin/users') as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.summary).toEqual({
      total: 3,
      active: 2,
      inactive: 1,
      adminCreated: 2,
      selfRegistered: 1,
      byType: {
        ADMIN: 1,
        DATA_ENCODER: 1,
        PUBLIC: 1,
      },
    })
    expect(json.data.users[0]).toEqual(
      expect.objectContaining({
        id: 'user-2',
        fullName: 'Casey Encoder',
        creationSource: 'ADMIN_CREATED',
        isActive: true,
      }),
    )
    expect(json.data.summary.pending).toBeUndefined()
  })

  it('honors the requested active status instead of blindly toggling', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-3',
      isActive: true,
    })
    prismaMock.user.update.mockResolvedValueOnce({ id: 'user-3', isActive: false })
    prismaMock.userVerificationLog.create.mockResolvedValueOnce({ id: 'log-2' })

    const response = await toggleUserStatus(
      makeJsonRequest('http://localhost/api/admin/users/toggle-status', {
        userId: 'user-3',
        isActive: false,
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(json.message).toBe('Account deactivated successfully')
    expect(json.data).toEqual({
      userId: 'user-3',
      isActive: false,
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-3' },
        data: { isActive: false },
      }),
    )
  })
})
