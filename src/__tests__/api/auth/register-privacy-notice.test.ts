import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
  },
}))

const bcryptMock = vi.hoisted(() => ({
  hash: vi.fn(),
}))

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    AUTH_REGISTER: { maxAttempts: 5 },
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
    email: 'juan@example.com',
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

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.getClientIdentifier.mockReturnValue('test-client')
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true })
})

describe('POST /api/auth/register — privacy notice enforcement', () => {
  it('rejects 400 when privacyNoticeAcknowledged is false', async () => {
    const res = await POST(buildRequest(buildValidPayload({ privacyNoticeAcknowledged: false })) as never)
    expect(res.status).toBe(400)
    const body = await res.json() as { message: string }
    expect(body.message).toContain('Privacy Notice')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects 400 when privacyNoticeAcknowledged is missing', async () => {
    const { privacyNoticeAcknowledged: _ack, ...rest } = buildValidPayload()
    void _ack
    const res = await POST(buildRequest(rest) as never)
    expect(res.status).toBe(400)
    const body = await res.json() as { message: string }
    expect(body.message).toContain('Privacy Notice')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects 400 when privacyNoticeVersion is stale', async () => {
    const res = await POST(
      buildRequest(buildValidPayload({ privacyNoticeVersion: '2020-01-01' })) as never,
    )
    expect(res.status).toBe(400)
    const body = await res.json() as { message: string }
    expect(body.message).toContain('Privacy Notice version')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejects 400 when privacyNoticeVersion is missing', async () => {
    const { privacyNoticeVersion: _ver, ...rest } = buildValidPayload()
    void _ver
    const res = await POST(buildRequest(rest) as never)
    expect(res.status).toBe(400)
    const body = await res.json() as { message: string }
    expect(body.message).toContain('Privacy Notice version')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('returns 201 and persists acknowledgment fields on valid registration', async () => {
    bcryptMock.hash.mockResolvedValue('hashed-pw')
    prismaMock.user.create.mockResolvedValue({ id: 'user-1', username: 'testuser' })

    const res = await POST(buildRequest(buildValidPayload()) as never)
    expect(res.status).toBe(201)

    expect(prismaMock.user.create).toHaveBeenCalledOnce()
    const callArgs = prismaMock.user.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(callArgs.data.privacyNoticeAcknowledgedAt).toBeInstanceOf(Date)
    expect(callArgs.data.privacyNoticeVersion).toBe(CURRENT_PRIVACY_NOTICE_VERSION)
  })
})
