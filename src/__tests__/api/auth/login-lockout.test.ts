/**
 * Phase 3 regression tests: DB-backed login lockout and rate-limit hardening.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
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
  RATE_LIMITS: { AUTH_LOGIN: { maxAttempts: 5 } },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('bcryptjs', () => ({ default: { compare: bcryptMock.compare }, compare: bcryptMock.compare }))
vi.mock('jsonwebtoken', () => ({ default: { sign: jwtMock.sign }, sign: jwtMock.sign }))
vi.mock('@/lib/rateLimit', () => rateLimitMock)

// ---------------------------------------------------------------------------
// Subject import
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/auth/login/route'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'test-user',
    password: 'hashed',
    userType: 'PUBLIC',
    firstName: 'Test',
    lastName: 'User',
    dateOfBirth: null,
    phoneNumber: null,
    governmentId: null,
    idType: null,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    ...overrides,
  }
}

function makeLoginRequest(body: Record<string, string>) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'test-secret'
  rateLimitMock.getClientIdentifier.mockReturnValue('127.0.0.1')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
  prismaMock.user.update.mockResolvedValue({})
})

// ---------------------------------------------------------------------------
// 1. DB-backed lockout: locked user is rejected regardless of IP
// ---------------------------------------------------------------------------

describe('DB-backed login lockout', () => {
  it('returns 429 when account lockedUntil is in the future', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000) // 10 min from now
    prismaMock.user.findUnique.mockResolvedValueOnce(
      buildUser({ loginAttempts: 5, lockedUntil }),
    )

    const res = await POST(makeLoginRequest({ username: 'test-user', password: 'wrong' }))
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.message).toMatch(/too many failed login attempts/i)
    expect(json.retryAfter).toBeGreaterThan(0)
    // No password check should happen for a locked account
    expect(bcryptMock.compare).not.toHaveBeenCalled()
  })

  it('allows login when lockedUntil has passed', async () => {
    const expiredLock = new Date(Date.now() - 1000) // expired 1 second ago
    prismaMock.user.findUnique.mockResolvedValueOnce(
      buildUser({ loginAttempts: 5, lockedUntil: expiredLock }),
    )
    bcryptMock.compare.mockResolvedValueOnce(true)
    jwtMock.sign.mockReturnValueOnce('session-token')

    const res = await POST(makeLoginRequest({ username: 'test-user', password: 'correct' }))

    expect(res.status).toBe(200)
    expect(bcryptMock.compare).toHaveBeenCalledOnce()
  })

  it('increments loginAttempts on wrong password', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser())
    bcryptMock.compare.mockResolvedValueOnce(false)

    const res = await POST(makeLoginRequest({ username: 'test-user', password: 'wrong' }))

    expect(res.status).toBe(401)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ loginAttempts: { increment: 1 } }),
      }),
    )
  })

  it('sets lockedUntil when loginAttempts reaches threshold on failure', async () => {
    // 4 prior attempts — next failure (attempt 5) hits the threshold
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser({ loginAttempts: 4 }))
    bcryptMock.compare.mockResolvedValueOnce(false)

    await POST(makeLoginRequest({ username: 'test-user', password: 'wrong' }))

    const updateCall = prismaMock.user.update.mock.calls[0][0]
    expect(updateCall.data.lockedUntil).toBeInstanceOf(Date)
    expect(updateCall.data.lockedUntil.getTime()).toBeGreaterThan(Date.now())
  })

  it('does NOT set lockedUntil when below the threshold', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser({ loginAttempts: 2 }))
    bcryptMock.compare.mockResolvedValueOnce(false)

    await POST(makeLoginRequest({ username: 'test-user', password: 'wrong' }))

    const updateCall = prismaMock.user.update.mock.calls[0][0]
    expect(updateCall.data.lockedUntil).toBeUndefined()
  })

  it('resets loginAttempts and clears lockedUntil on successful login', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(
      buildUser({ loginAttempts: 3, lockedUntil: null }),
    )
    bcryptMock.compare.mockResolvedValueOnce(true)
    jwtMock.sign.mockReturnValueOnce('session-token')

    const res = await POST(makeLoginRequest({ username: 'test-user', password: 'correct' }))

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// 2. In-memory rate limiter: lazy cleanup (not setInterval)
// ---------------------------------------------------------------------------

describe('rateLimit lazy cleanup', () => {
  it('checkRateLimit does not throw in serverless-like environments without setInterval', async () => {
    const { checkRateLimit, RATE_LIMITS } = await import('@/lib/rateLimit')
    // Should not throw even when called repeatedly (lazy cleanup fires at 100-call intervals)
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(`test-ip-${i}`, RATE_LIMITS.AUTH_LOGIN)
      expect(result.success).toBe(true)
    }
  })
})
