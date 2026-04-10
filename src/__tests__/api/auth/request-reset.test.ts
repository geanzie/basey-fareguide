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
    AUTH_RESET: 'AUTH_RESET',
  },
}))

const emailMock = vi.hoisted(() => ({
  getPasswordResetEmailCapability: vi.fn(),
  sendOTPEmail: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: rateLimitMock.checkRateLimit,
  getClientIdentifier: rateLimitMock.getClientIdentifier,
  RATE_LIMITS: rateLimitMock.RATE_LIMITS,
}))

vi.mock('@/lib/email', () => ({
  getPasswordResetEmailCapability: emailMock.getPasswordResetEmailCapability,
  sendOTPEmail: emailMock.sendOTPEmail,
}))

import { POST } from '@/app/api/auth/request-reset/route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/request-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.getClientIdentifier.mockReturnValue('client-1')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
  emailMock.getPasswordResetEmailCapability.mockReturnValue({
    available: true,
    mode: 'provider',
    from: 'Basey Fare Check <noreply@example.com>',
  })
})

describe('request reset route', () => {
  it('returns a truthful 503 when password reset email delivery is unavailable', async () => {
    emailMock.getPasswordResetEmailCapability.mockReturnValue({
      available: false,
      mode: 'provider',
      reason: 'Sender domain is not verified.',
    })

    const response = await POST(makeRequest({ email: 'user@example.com' }) as never)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.message).toMatch(/temporarily unavailable/i)
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('clears the stored OTP again if email delivery fails after generation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'sampleuser',
    })
    prismaMock.user.update
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce({ id: 'user-1' })
    emailMock.sendOTPEmail.mockResolvedValue({
      success: false,
      mode: 'provider',
      reason: 'Provider rejected the email.',
    })

    const response = await POST(makeRequest({ email: 'user@example.com' }) as never)
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json.message).toMatch(/temporarily unavailable/i)
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'user-1' },
        data: {
          passwordResetOtp: null,
          passwordResetOtpExpiry: null,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
    )
  })

  it('returns masked email details only after OTP email delivery succeeds', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'username@example.com',
      username: 'sampleuser',
    })
    prismaMock.user.update.mockResolvedValue({ id: 'user-1' })
    emailMock.sendOTPEmail.mockResolvedValue({
      success: true,
      mode: 'provider',
    })

    const response = await POST(makeRequest({ email: 'username@example.com' }) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.email).toBe('u***e@example.com')
    expect(json.deliveryMode).toBe('provider')
  })
})
