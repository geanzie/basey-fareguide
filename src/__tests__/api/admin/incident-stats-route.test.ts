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
  $queryRaw: vi.fn(),
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
  prismaMock.incident.findMany.mockResolvedValue([
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
  prismaMock.$queryRaw.mockResolvedValue([
    { month: '2026-04', total: BigInt(2), resolved: BigInt(1), pending: BigInt(1) },
    { month: '2026-03', total: BigInt(1), resolved: BigInt(0), pending: BigInt(1) },
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/admin/incidents/stats', () => {
  it('aggregates the six-month trend in the database and computes the current-month summary', async () => {
    const res = await GET(new Request('http://localhost/api/admin/incidents/stats') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.summary).toEqual({
      totalThisMonth: 2,
      resolvedThisMonth: 1,
      averageResolutionTime: null,
    })
    expect(json.monthlyTrends).toEqual({
      '2026-04': { total: 2, resolved: 1, pending: 1 },
      '2026-03': { total: 1, resolved: 0, pending: 1 },
    })
    expect(json.recent).toHaveLength(1)

    // Recent incidents stay a bounded findMany; trend buckets come from one aggregate query.
    expect(prismaMock.incident.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })
})