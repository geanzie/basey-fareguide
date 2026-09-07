import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    AUTH_OTP_VERIFY: 'AUTH_OTP_VERIFY',
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: rateLimitMock.checkRateLimit,
  getClientIdentifier: rateLimitMock.getClientIdentifier,
  RATE_LIMITS: rateLimitMock.RATE_LIMITS,
}))

import { POST } from '@/app/api/auth/verify-otp/route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const FUTURE = new Date(Date.now() + 60_000)

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.getClientIdentifier.mockReturnValue('client-1')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
})

describe('verify-otp route', () => {
  it('refuses at the IP throttle before touching the database', async () => {
    rateLimitMock.checkRateLimit.mockReturnValue({ success: false, retryAfter: 42 })

    const response = await POST(
      makeRequest({ email: 'user@example.com', otp: '123456' }) as never,
    )

    expect(response.status).toBe(429)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('accepts a correct, unexpired, unexhausted code without charging the attempt budget', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'sampleuser',
      firstName: 'Sam',
      lastName: 'Ple',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: FUTURE,
      passwordResetOtpAttempts: 0,
    })

    const response = await POST(
      makeRequest({ email: 'user@example.com', otp: '123456' }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.valid).toBe(true)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('charges the attempt budget on a wrong guess', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: FUTURE,
      passwordResetOtpAttempts: 2,
    })

    const response = await POST(
      makeRequest({ email: 'user@example.com', otp: '000000' }) as never,
    )

    expect(response.status).toBe(400)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordResetOtpAttempts: { increment: 1 } },
    })
  })

  it('refuses once the attempt budget is exhausted, even with the right code', async () => {
    // This is the actual fix: brute force is bounded by guesses against this
    // account, not by wall-clock rate from one IP.
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: FUTURE,
      passwordResetOtpAttempts: 5,
    })

    const response = await POST(
      makeRequest({ email: 'user@example.com', otp: '123456' }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.message).toMatch(/too many/i)
    // No budget left to charge further — must not increment past the cap.
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('does not charge the budget for an unknown email (no enumeration signal)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const response = await POST(
      makeRequest({ email: 'nobody@example.com', otp: '000000' }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('Invalid OTP code or email address')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('rejects a malformed OTP before any database lookup', async () => {
    const response = await POST(
      makeRequest({ email: 'user@example.com', otp: 'abcdef' }) as never,
    )

    expect(response.status).toBe(400)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
})
