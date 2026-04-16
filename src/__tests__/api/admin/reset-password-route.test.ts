import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: bcryptMock.hash,
  },
}))

import { POST as resetPassword } from '@/app/api/admin/reset-password/route'

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
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  bcryptMock.hash.mockResolvedValue('hashed-password')
})

describe('POST /api/admin/reset-password', () => {
  it('returns a canonical token-generation payload', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      username: 'casey.encoder',
      firstName: 'Casey',
      lastName: 'Encoder',
      userType: 'DATA_ENCODER',
      isActive: true,
    })
    prismaMock.user.update.mockResolvedValueOnce({ id: 'user-1' })

    const response = await resetPassword(
      makeJsonRequest('http://localhost/api/admin/reset-password', {
        userId: 'user-1',
        action: 'generate-token',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.message).toBe('Password reset token generated successfully')
    expect(json.data).toEqual(
      expect.objectContaining({
        action: 'generate-token',
        token: expect.any(String),
        user: expect.objectContaining({
          id: 'user-1',
          fullName: 'Casey Encoder',
          userType: 'DATA_ENCODER',
          isActive: true,
        }),
      }),
    )
  })

  it('returns a canonical direct-reset payload', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-2',
      username: 'driver.user',
      firstName: 'Driver',
      lastName: 'User',
      userType: 'DRIVER',
      isActive: false,
    })
    prismaMock.user.update.mockResolvedValueOnce({ id: 'user-2' })

    const response = await resetPassword(
      makeJsonRequest('http://localhost/api/admin/reset-password', {
        userId: 'user-2',
        action: 'set-password',
        newPassword: 'new-password-1',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(bcryptMock.hash).toHaveBeenCalledWith('new-password-1', 12)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({
      action: 'set-password',
      token: null,
      expiresAt: null,
      user: {
        id: 'user-2',
        username: 'driver.user',
        firstName: 'Driver',
        lastName: 'User',
        fullName: 'Driver User',
        userType: 'DRIVER',
        isActive: false,
      },
    })
  })
})