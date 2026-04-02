import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}))

const jwtMock = vi.hoisted(() => ({
  verify: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('jsonwebtoken', () => ({
  default: { verify: jwtMock.verify },
  verify: jwtMock.verify,
}))

import {
  ADMIN_ONLY,
  createAuthErrorResponse,
  requireRequestRole,
  requireRequestUser,
  verifyAuth,
} from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'test-secret'
})

describe('shared auth policy', () => {
  it('accepts an active cookie-backed session through the shared role helper', async () => {
    jwtMock.verify.mockReturnValueOnce({ userId: 'admin-1' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin.user',
      userType: 'ADMIN',
      isActive: true,
    })

    const user = await requireRequestRole(
      new NextRequest('http://localhost/api/admin/users', {
        headers: { cookie: 'auth-token=session-cookie' },
      }),
      [...ADMIN_ONLY],
    )

    expect(user).toMatchObject({ id: 'admin-1', userType: 'ADMIN' })
    expect(jwtMock.verify).toHaveBeenCalledWith('session-cookie', 'test-secret')
  })

  it('rejects inactive sessions through the shared request-user helper', async () => {
    jwtMock.verify.mockReturnValueOnce({ userId: 'public-1' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'public-1',
      firstName: 'Public',
      lastName: 'User',
      username: 'public.user',
      userType: 'PUBLIC',
      isActive: false,
    })

    await expect(
      requireRequestUser(
        new NextRequest('http://localhost/api/user/profile', {
          headers: { cookie: 'auth-token=session-cookie' },
        }),
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects role mismatches through the shared request-role helper', async () => {
    jwtMock.verify.mockReturnValueOnce({ userId: 'public-1' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'public-1',
      firstName: 'Public',
      lastName: 'User',
      username: 'public.user',
      userType: 'PUBLIC',
      isActive: true,
    })

    await expect(
      requireRequestRole(
        new NextRequest('http://localhost/api/admin/users', {
          headers: { cookie: 'auth-token=session-cookie' },
        }),
        [...ADMIN_ONLY],
      ),
    ).rejects.toThrow('Forbidden')
  })

  it('allows direct verification from a bearer token for non-browser callers', async () => {
    jwtMock.verify.mockReturnValueOnce({ userId: 'admin-1' })
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'admin-1',
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin.user',
      userType: 'ADMIN',
      isActive: true,
    })

    const user = await verifyAuth(
      new NextRequest('http://localhost/api/admin/users', {
        headers: { authorization: 'Bearer token-123' },
      }),
    )

    expect(user).toMatchObject({ id: 'admin-1', userType: 'ADMIN' })
    expect(jwtMock.verify).toHaveBeenCalledWith('token-123', 'test-secret')
  })

  it('maps auth failures to the standardized HTTP responses', async () => {
    const unauthorized = createAuthErrorResponse(new Error('Unauthorized'))
    const forbidden = createAuthErrorResponse(new Error('Forbidden'))

    expect(unauthorized.status).toBe(401)
    expect((await unauthorized.json()).message).toMatch(/please login/i)
    expect(forbidden.status).toBe(403)
    expect((await forbidden.json()).message).toMatch(/access denied/i)
  })
})
