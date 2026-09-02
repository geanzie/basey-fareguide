import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500

    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  userFeedback: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_ONLY: ['ADMIN'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/admin/feedback/route'
import { PATCH } from '@/app/api/admin/feedback/[id]/route'

const ROW = {
  id: 'feedback-1',
  userId: 'user-1',
  category: 'BUG' as const,
  rating: 2,
  message: 'The map is blank on my phone.',
  status: 'NEW' as const,
  reviewedById: null,
  reviewedAt: null,
  reviewNotes: null,
  createdAt: new Date('2026-09-01T02:00:00.000Z'),
  updatedAt: new Date('2026-09-01T02:00:00.000Z'),
  user: {
    firstName: 'Ana',
    lastName: 'Santos',
    username: 'ana',
    userType: 'PUBLIC' as const,
  },
  reviewedBy: null,
}

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/feedback/feedback-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

const params = { params: Promise.resolve({ id: 'feedback-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  prismaMock.userFeedback.findMany.mockResolvedValue([ROW])
  prismaMock.userFeedback.count.mockResolvedValue(1)
  prismaMock.userFeedback.groupBy.mockResolvedValue([
    { status: 'NEW', _count: { _all: 3 } },
    { status: 'RESOLVED', _count: { _all: 1 } },
  ])
  prismaMock.userFeedback.findUnique.mockResolvedValue(ROW)
  prismaMock.userFeedback.update.mockResolvedValue({
    ...ROW,
    status: 'REVIEWED',
    reviewedById: 'admin-1',
    reviewNotes: 'Reproduced on Android.',
    reviewedAt: new Date('2026-09-02T03:00:00.000Z'),
    updatedAt: new Date('2026-09-02T03:00:00.000Z'),
    reviewedBy: { firstName: 'Mayor', lastName: 'Staff', username: 'admin' },
  })
})

describe('GET /api/admin/feedback', () => {
  it('rejects a non-admin caller', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const res = await GET(new Request('http://localhost/api/admin/feedback') as never)

    expect(res.status).toBe(403)
    expect(prismaMock.userFeedback.findMany).not.toHaveBeenCalled()
  })

  it('returns serialized rows, pagination, and whole-table status counts', async () => {
    const res = await GET(new Request('http://localhost/api/admin/feedback') as never)
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.feedback[0]).toMatchObject({
      id: 'feedback-1',
      categoryLabel: 'Something Broken',
      statusLabel: 'New',
      submittedByName: 'Ana Santos (@ana)',
      submittedByRole: 'PUBLIC',
      reviewedByName: null,
      createdAt: '2026-09-01T02:00:00.000Z',
    })
    expect(payload.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    expect(payload.counts).toEqual({ all: 4, NEW: 3, REVIEWED: 0, RESOLVED: 1 })
  })

  it('passes known filters into the where clause and ignores unknown ones', async () => {
    await GET(
      new Request(
        'http://localhost/api/admin/feedback?status=NEW&category=NOT_A_CATEGORY&search=map&limit=500',
      ) as never,
    )

    const args = prismaMock.userFeedback.findMany.mock.calls[0][0]
    expect(args.where).toEqual({
      status: 'NEW',
      message: { contains: 'map', mode: 'insensitive' },
    })
    expect(args.take).toBe(100)
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
  })
})

describe('PATCH /api/admin/feedback/[id]', () => {
  it('rejects a non-admin caller', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const res = await PATCH(patchRequest({ status: 'REVIEWED' }), params)

    expect(res.status).toBe(403)
    expect(prismaMock.userFeedback.update).not.toHaveBeenCalled()
  })

  it('rejects an unknown status', async () => {
    const res = await PATCH(patchRequest({ status: 'ARCHIVED' }), params)

    expect(res.status).toBe(400)
    expect(prismaMock.userFeedback.update).not.toHaveBeenCalled()
  })

  it('answers 404 when the feedback is gone', async () => {
    prismaMock.userFeedback.findUnique.mockResolvedValueOnce(null)

    const res = await PATCH(patchRequest({ status: 'REVIEWED' }), params)

    expect(res.status).toBe(404)
    expect(prismaMock.userFeedback.update).not.toHaveBeenCalled()
  })

  it('records the reviewing admin and returns the admin DTO', async () => {
    const res = await PATCH(
      patchRequest({ status: 'REVIEWED', reviewNotes: '  Reproduced on Android.  ' }),
      params,
    )
    const payload = await res.json()

    expect(res.status).toBe(200)
    const updateArgs = prismaMock.userFeedback.update.mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: 'feedback-1' })
    expect(updateArgs.data).toMatchObject({
      status: 'REVIEWED',
      reviewNotes: 'Reproduced on Android.',
      reviewedById: 'admin-1',
    })
    expect(updateArgs.data.reviewedAt).toBeInstanceOf(Date)
    expect(payload.feedback).toMatchObject({
      status: 'REVIEWED',
      statusLabel: 'Reviewed',
      reviewedById: 'admin-1',
      reviewedByName: 'Mayor Staff (@admin)',
      reviewedAt: '2026-09-02T03:00:00.000Z',
      reviewNotes: 'Reproduced on Android.',
    })
  })

  it('stores empty review notes as null', async () => {
    await PATCH(patchRequest({ status: 'RESOLVED', reviewNotes: '   ' }), params)

    expect(prismaMock.userFeedback.update.mock.calls[0][0].data.reviewNotes).toBeNull()
  })
})
