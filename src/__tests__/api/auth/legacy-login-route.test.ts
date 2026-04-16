import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}))

const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
}))

const jwtMock = vi.hoisted(() => ({
  sign: vi.fn(),
}))

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    AUTH_LOGIN: {
      maxAttempts: 5,
    },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('bcryptjs', () => ({
  default: { compare: bcryptMock.compare },
  compare: bcryptMock.compare,
}))

vi.mock('jsonwebtoken', () => ({
  default: { sign: jwtMock.sign },
  sign: jwtMock.sign,
}))

vi.mock('@/lib/rateLimit', () => rateLimitMock)

import { POST } from '@/app/auth/login/route'

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'public-user',
    password: 'hashed-password',
    userType: 'PUBLIC',
    firstName: 'Public',
    lastName: 'User',
    dateOfBirth: null,
    phoneNumber: null,
    governmentId: null,
    idType: null,
    isActive: true,
    isVerified: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'test-secret'
  rateLimitMock.getClientIdentifier.mockReturnValue('test-client')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
})

function buildFormRequest(formFields: Record<string, string>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(formFields)) {
    formData.set(key, value)
  }

  return new Request('http://localhost/auth/login', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /auth/login', () => {
  it('redirects successful native form posts to the authenticated home route and sets the auth cookie', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser())
    bcryptMock.compare.mockResolvedValueOnce(true)
    jwtMock.sign.mockReturnValueOnce('signed-session-token')

    const response = await POST(buildFormRequest({ username: 'public-user', password: 'secret' }) as never)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/dashboard')
    expect(response.headers.get('set-cookie')).toContain('auth-token=signed-session-token')
  })

  it('redirects driver form login with different casing through shared driver-only fallback', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildUser({
        id: 'driver-1',
        username: 'ABC-123',
        userType: 'DRIVER',
        firstName: 'Driver',
      }),
    ])
    bcryptMock.compare.mockResolvedValueOnce(true)
    jwtMock.sign.mockReturnValueOnce('driver-session-token')

    const response = await POST(buildFormRequest({ username: 'abc-123', password: 'secret' }) as never)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/driver')
    expect(response.headers.get('set-cookie')).toContain('auth-token=driver-session-token')
  })

  it('redirects failed native form posts back to /auth without putting the password in the URL', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser())
    bcryptMock.compare.mockResolvedValueOnce(false)

    const response = await POST(buildFormRequest({ username: 'public-user', password: 'wrong-secret' }) as never)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://localhost/auth?error=Invalid+credentials&username=public-user')
    expect(response.headers.get('location')).not.toContain('wrong-secret')
  })
})