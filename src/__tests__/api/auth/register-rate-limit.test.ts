import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
  },
}))

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}))

const RATE_LIMITS = {
  REGISTER_REJECT: { name: 'register-reject', windowMs: 900_000, maxAttempts: 10 },
  REGISTER_CREATE: { name: 'register-create', windowMs: 3_600_000, maxAttempts: 5 },
  REGISTER_IP_BURST: { name: 'register-burst', windowMs: 3_600_000, maxAttempts: 60 },
}

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  peekRateLimit: vi.fn(),
  consumeRateLimit: vi.fn(),
  logRateLimitHit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    REGISTER_REJECT: { name: 'register-reject', windowMs: 900_000, maxAttempts: 10 },
    REGISTER_CREATE: { name: 'register-create', windowMs: 3_600_000, maxAttempts: 5 },
    REGISTER_IP_BURST: { name: 'register-burst', windowMs: 3_600_000, maxAttempts: 60 },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('bcryptjs', () => ({
  default: { hash: bcryptMock.hash },
  hash: bcryptMock.hash,
}))
vi.mock('@/lib/rateLimit', () => rateLimitMock)

import { POST } from '@/app/api/auth/register/route'

function buildValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    username: 'testuser',
    password: 'TestPass123',
    firstName: 'Juan',
    lastName: 'dela Cruz',
    email: 'Juan@Example.com',
    phoneNumber: '09123456789',
    dateOfBirth: '1990-01-01',
    governmentId: 'ABC-12345678',
    idType: 'NATIONAL_ID',
    barangayResidence: 'Cogon',
    userType: 'PUBLIC',
    privacyNoticeAcknowledged: true,
    privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
    ...overrides,
  }
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const consumedWith = (config: { name: string }) =>
  rateLimitMock.consumeRateLimit.mock.calls.filter(
    ([, usedConfig]) => (usedConfig as { name: string }).name === config.name,
  )

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.getClientIdentifier.mockReturnValue('203.0.113.9')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
  rateLimitMock.peekRateLimit.mockReturnValue({ success: true })
  bcryptMock.hash.mockResolvedValue('hashed')
  prismaMock.user.create.mockResolvedValue({ id: 'user-1' })
})

describe('POST /api/auth/register — what spends rate limit budget', () => {
  it('does not spend the rejection budget on a successful registration', async () => {
    const res = await POST(buildRequest(buildValidPayload()) as never)

    expect(res.status).toBe(201)
    expect(consumedWith(RATE_LIMITS.REGISTER_REJECT)).toHaveLength(0)
  })

  it('spends the per-IP creation budget only when an account is created', async () => {
    const res = await POST(buildRequest(buildValidPayload()) as never)

    expect(res.status).toBe(201)
    expect(consumedWith(RATE_LIMITS.REGISTER_CREATE)).toEqual([
      ['203.0.113.9', rateLimitMock.RATE_LIMITS.REGISTER_CREATE],
    ])
  })

  it('spends the rejection budget on a duplicate email, keyed on the email', async () => {
    prismaMock.user.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      }),
    )

    const res = await POST(buildRequest(buildValidPayload()) as never)

    expect(res.status).toBe(409)
    // Normalized to lowercase, so casing cannot be used to get a fresh budget.
    expect(consumedWith(RATE_LIMITS.REGISTER_REJECT)).toEqual([
      ['juan@example.com', rateLimitMock.RATE_LIMITS.REGISTER_REJECT],
    ])
    expect(consumedWith(RATE_LIMITS.REGISTER_CREATE)).toHaveLength(0)
  })

  it('spends the rejection budget on a validation rejection', async () => {
    const res = await POST(
      buildRequest(buildValidPayload({ phoneNumber: '12345' })) as never,
    )

    expect(res.status).toBe(400)
    expect(consumedWith(RATE_LIMITS.REGISTER_REJECT)).toHaveLength(1)
  })

  it('spends nothing when the handler throws', async () => {
    prismaMock.user.create.mockRejectedValueOnce(new Error('database is down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(buildRequest(buildValidPayload()) as never)

    expect(res.status).toBe(500)
    expect(consumedWith(RATE_LIMITS.REGISTER_REJECT)).toHaveLength(0)
    expect(consumedWith(RATE_LIMITS.REGISTER_CREATE)).toHaveLength(0)
  })

  it('returns 429 with retryAfter when the identity budget is gone', async () => {
    rateLimitMock.peekRateLimit.mockImplementation((_key: string, config: { name: string }) =>
      config.name === RATE_LIMITS.REGISTER_REJECT.name
        ? { success: false, remaining: 0, resetTime: 0, retryAfter: 420 }
        : { success: true, remaining: 5, resetTime: 0 },
    )

    const res = await POST(buildRequest(buildValidPayload()) as never)
    const body = (await res.json()) as { retryAfter: number }

    expect(res.status).toBe(429)
    expect(body.retryAfter).toBe(420)
    expect(res.headers.get('Retry-After')).toBe('420')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})
