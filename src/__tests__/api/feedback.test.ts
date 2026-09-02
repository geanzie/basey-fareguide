import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500

    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  userFeedback: {
    count: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  requireRequestUser: authMock.requireRequestUser,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { POST } from '@/app/api/feedback/route'

const VALID_BODY = {
  category: 'FARE_CALCULATOR',
  rating: 4,
  message: 'The calculator is easy to use but the map takes a while to load.',
}

function postRequest(body: unknown) {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestUser.mockResolvedValue({ id: 'user-1', userType: 'PUBLIC' })
  prismaMock.userFeedback.count.mockResolvedValue(0)
  prismaMock.userFeedback.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'feedback-1',
    userId: data.userId,
    category: data.category,
    rating: data.rating,
    message: data.message,
    status: 'NEW',
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date('2026-09-02T01:00:00.000Z'),
    updatedAt: new Date('2026-09-02T01:00:00.000Z'),
  }))
})

describe('POST /api/feedback', () => {
  it('rejects an unauthenticated caller', async () => {
    authMock.requireRequestUser.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await POST(postRequest(VALID_BODY))

    expect(res.status).toBe(401)
    expect(prismaMock.userFeedback.create).not.toHaveBeenCalled()
  })

  it('rejects an unknown category', async () => {
    const res = await POST(postRequest({ ...VALID_BODY, category: 'PIZZA' }))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toHaveProperty('message')
    expect(prismaMock.userFeedback.create).not.toHaveBeenCalled()
  })

  it('rejects a rating outside 1 to 5', async () => {
    for (const rating of [0, 6, 2.5, '4']) {
      const res = await POST(postRequest({ ...VALID_BODY, rating }))
      expect(res.status).toBe(400)
    }

    expect(prismaMock.userFeedback.create).not.toHaveBeenCalled()
  })

  it('rejects a message that is too short or too long', async () => {
    const short = await POST(postRequest({ ...VALID_BODY, message: '  hi  ' }))
    expect(short.status).toBe(400)

    const long = await POST(postRequest({ ...VALID_BODY, message: 'a'.repeat(1001) }))
    expect(long.status).toBe(400)

    expect(prismaMock.userFeedback.create).not.toHaveBeenCalled()
  })

  it('stops an account that already sent the daily limit', async () => {
    prismaMock.userFeedback.count.mockResolvedValueOnce(5)

    const res = await POST(postRequest(VALID_BODY))

    expect(res.status).toBe(429)
    expect(prismaMock.userFeedback.create).not.toHaveBeenCalled()
  })

  it('stores the feedback and returns the serialized DTO', async () => {
    const res = await POST(postRequest({ ...VALID_BODY, message: `  ${VALID_BODY.message}  ` }))

    expect(res.status).toBe(201)
    const payload = await res.json()

    expect(prismaMock.userFeedback.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        category: 'FARE_CALCULATOR',
        rating: 4,
        message: VALID_BODY.message,
      },
    })
    expect(payload.feedback).toMatchObject({
      id: 'feedback-1',
      category: 'FARE_CALCULATOR',
      categoryLabel: 'Fare Calculator',
      rating: 4,
      status: 'NEW',
      statusLabel: 'New',
      createdAt: '2026-09-02T01:00:00.000Z',
    })
    // The DTO never leaks raw columns from the row.
    expect('userId' in payload.feedback).toBe(false)
    expect('reviewNotes' in payload.feedback).toBe(false)
  })
})
