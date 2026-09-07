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

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: rateLimitMock.checkRateLimit,
  getClientIdentifier: rateLimitMock.getClientIdentifier,
  RATE_LIMITS: rateLimitMock.RATE_LIMITS,
}))

vi.mock('bcryptjs', () => ({
  default: bcryptMock,
}))

import { POST } from '@/app/api/auth/reset-password/route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/reset-password', {
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
  bcryptMock.hash.mockResolvedValue('hashed-password')
})

describe('reset-password route', () => {
  it('refuses at the IP throttle before touching the database', async () => {
    rateLimitMock.checkRateLimit.mockReturnValue({ success: false, retryAfter: 42 })

    const response = await POST(
      makeRequest({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'longenoughpw',
      }) as never,
    )

    expect(response.status).toBe(429)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('sets the new password and clears the OTP and its attempt counter on a correct guess', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: FUTURE,
      passwordResetOtpAttempts: 1,
    })

    const response = await POST(
      makeRequest({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'longenoughpw',
      }) as never,
    )

    expect(response.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'hashed-password',
        hasUsablePassword: true,
        passwordResetOtp: null,
        passwordResetOtpExpiry: null,
        passwordResetOtpAttempts: 0,
        loginAttempts: 0,
        lockedUntil: null,
      },
    })
  })

  it('charges the attempt budget on a wrong guess and never sets a password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: FUTURE,
      passwordResetOtpAttempts: 0,
    })

    const response = await POST(
      makeRequest({
        email: 'user@example.com',
        otp: '000000',
        newPassword: 'longenoughpw',
      }) as never,
    )

    expect(response.status).toBe(400)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordResetOtpAttempts: { increment: 1 } },
    })
    expect(bcryptMock.hash).not.toHaveBeenCalled()
  })

  it('refuses once the attempt budget is exhausted, even with the right code and a valid password', async () => {
    // This is the actual fix: an attacker who has burned the guess budget
    // cannot take over the account even by later landing on the right code.
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: FUTURE,
      passwordResetOtpAttempts: 5,
    })

    const response = await POST(
      makeRequest({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'longenoughpw',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.message).toMatch(/too many/i)
    expect(bcryptMock.hash).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('does not charge the budget for an unknown email (no enumeration signal)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const response = await POST(
      makeRequest({
        email: 'nobody@example.com',
        otp: '000000',
        newPassword: 'longenoughpw',
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.message).toBe('Invalid OTP code or email address')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('rejects an expired OTP even with the right code', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtp: '123456',
      passwordResetOtpExpiry: new Date(Date.now() - 1000),
      passwordResetOtpAttempts: 0,
    })

    const response = await POST(
      makeRequest({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'longenoughpw',
      }) as never,
    )

    expect(response.status).toBe(400)
    expect(bcryptMock.hash).not.toHaveBeenCalled()
  })

  it('rejects a short password before any OTP check', async () => {
    const response = await POST(
      makeRequest({ email: 'user@example.com', otp: '123456', newPassword: 'short' }) as never,
    )

    expect(response.status).toBe(400)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
})
