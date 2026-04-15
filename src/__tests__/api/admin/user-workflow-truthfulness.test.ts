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
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
import { POST as verifyUser } from '@/app/api/admin/users/verify/route'
import { POST as toggleUserStatus } from '@/app/api/admin/users/toggle-status/route'

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
    expect(json.message).toBe('User created successfully')
    expect(json.tempPassword).toEqual(expect.any(String))
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
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({ id: 'vehicle-1' })
    prismaMock.user.findFirst.mockResolvedValueOnce(null)
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.create.mockResolvedValueOnce({
      id: 'driver-1',
      firstName: 'Driver',
      lastName: 'One',
      username: 'ABC-123',
      userType: 'DRIVER',
    })
    prismaMock.adminUserCreation.create.mockResolvedValueOnce({ id: 'audit-2' })
    prismaMock.driverVehicleAssignmentHistory.create.mockResolvedValueOnce({ id: 'assignment-1' })

    const response = await createOfficialUser(
      makeJsonRequest('http://localhost/api/admin/users/create', {
        username: ' abc-123 ',
        firstName: 'Driver',
        lastName: 'One',
        phoneNumber: '09123456789',
        userType: 'DRIVER',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.vehicle.findUnique).toHaveBeenCalledWith({
      where: { plateNumber: 'ABC-123' },
      select: { id: true },
    })
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'ABC-123',
          userType: 'DRIVER',
          assignedVehicleId: 'vehicle-1',
          assignedVehicleAssignedBy: 'admin-1',
        }),
      }),
    )
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
    expect(json.user.assignedVehicleId).toBe('vehicle-1')
  })

  it('records the provided rejection reason when a public registration is rejected', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-2',
      isVerified: false,
      isActive: true,
    })
    prismaMock.user.update.mockResolvedValueOnce({ id: 'user-2' })
    prismaMock.userVerificationLog.create.mockResolvedValueOnce({ id: 'log-1' })

    const response = await verifyUser(
      makeJsonRequest('http://localhost/api/admin/users/verify', {
        userId: 'user-2',
        action: 'reject',
        reason: 'Government ID did not match the submitted information.',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.message).toBe('User rejected successfully')
    expect(prismaMock.userVerificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REJECTED',
          performedBy: 'admin-1',
          reason: 'Government ID did not match the submitted information.',
        }),
      }),
    )
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
    expect(json.message).toBe('User deactivated successfully')
    expect(json.newStatus).toBe(false)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-3' },
        data: { isActive: false },
      }),
    )
  })
})
