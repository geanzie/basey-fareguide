import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500

    return new Response(JSON.stringify({ error: message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => ({
  incident: {
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  ADMIN_OR_ENFORCER: ['ADMIN', 'ENFORCER'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

import { GET } from '@/app/api/admin/incidents/stats/route'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'))
  vi.clearAllMocks()

  authMock.requireRequestRole.mockResolvedValue({ id: 'admin-1', userType: 'ADMIN' })
  prismaMock.incident.groupBy.mockResolvedValue([
    { status: 'PENDING', _count: { id: 3 } },
    { status: 'INVESTIGATING', _count: { id: 2 } },
    { status: 'RESOLVED', _count: { id: 5 } },
  ])
  prismaMock.incident.count.mockResolvedValue(10)
  prismaMock.incident.findMany
    .mockResolvedValueOnce([
      {
        id: 'incident-1',
        incidentType: 'FARE_OVERCHARGE',
        description: 'Collected more than the posted fare',
        status: 'PENDING',
        location: 'Basey Terminal',
        createdAt: new Date('2026-04-09T00:00:00.000Z'),
        reportedBy: { firstName: 'Ana', lastName: 'Santos' },
        handledBy: null,
      },
    ])
    .mockResolvedValueOnce([
      { createdAt: new Date('2026-04-02T00:00:00.000Z'), status: 'RESOLVED' },
      { createdAt: new Date('2026-04-01T00:00:00.000Z'), status: 'PENDING' },
      { createdAt: new Date('2026-03-15T00:00:00.000Z'), status: 'PENDING' },
    ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/admin/incidents/stats', () => {
  it('caps the six-month trend scan and computes the current-month summary from the correct month', async () => {
    const res = await GET(new Request('http://localhost/api/admin/incidents/stats') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.summary).toEqual({
      totalThisMonth: 2,
      resolvedThisMonth: 1,
      averageResolutionTime: null,
    })
    expect(json.recent).toHaveLength(1)

    expect(prismaMock.incident.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
    expect(prismaMock.incident.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 5000,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        where: {
          createdAt: {
            gte: expect.any(Date),
          },
        },
      }),
    )
  })
})