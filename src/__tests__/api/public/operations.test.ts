import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

const prismaMock = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: {} }),
  })
  return { fareCalculation: model(), incident: model() }
})

vi.mock('@/lib/auth', () => ({
  PUBLIC_ONLY: ['PUBLIC'],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { GET } from '@/app/api/public/operations/route'

function request(query = '') {
  return new Request(`http://localhost/api/public/operations${query}`) as never
}

const decimal = (value: string) => ({ toString: () => value })

const trip = {
  id: 'fc-1',
  fromLocation: 'Poblacion',
  toLocation: 'Basey Port',
  distance: decimal('4.20'),
  calculatedFare: decimal('14.40'),
  originalFare: decimal('18.00'),
  discountApplied: decimal('3.60'),
  discountType: 'STUDENT',
  seatsPaid: 1,
  createdAt: new Date('2026-09-20T01:00:00.000Z'),
  vehicle: { plateNumber: 'ABC-123', vehicleType: 'TRICYCLE', permit: { permitPlateNumber: 'P-9' } },
}

const communityReports = [
  { status: 'PENDING', createdAt: new Date('2026-09-19T00:00:00.000Z'), resolvedAt: null, dismissedAt: null, referredAt: null },
  {
    status: 'RESOLVED',
    createdAt: new Date('2026-09-18T00:00:00.000Z'),
    resolvedAt: new Date('2026-09-18T10:00:00.000Z'),
    dismissedAt: null,
    referredAt: null,
  },
]

describe('GET /api/public/operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.requireRequestRole.mockResolvedValue({ id: 'rider-1', userType: 'PUBLIC' })
    prismaMock.fareCalculation.findMany.mockResolvedValue([])
    prismaMock.fareCalculation.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: {} })
    prismaMock.incident.findMany.mockResolvedValue([])
    prismaMock.incident.count.mockResolvedValue(0)
  })

  it('refuses anyone who is not a PUBLIC user', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(authMock.requireRequestRole).toHaveBeenCalledWith(expect.anything(), ['PUBLIC'])
    expect(prismaMock.fareCalculation.findMany).not.toHaveBeenCalled()
  })

  it('rejects an unknown range with a message mobile can read', async () => {
    const response = await GET(request('?range=year'))
    expect(response.status).toBe(400)
    expect((await response.json()).message).toContain('Invalid range')
  })

  it('reads only the signed-in rider’s trips and reports', async () => {
    await GET(request('?range=7d'))
    for (const call of prismaMock.fareCalculation.findMany.mock.calls) {
      expect(call[0].where.userId).toBe('rider-1')
    }
    for (const call of prismaMock.fareCalculation.aggregate.mock.calls) {
      expect(call[0].where.userId).toBe('rider-1')
    }
    // First incident read is the rider's own; second is the community aggregate.
    expect(prismaMock.incident.findMany.mock.calls[0][0].where.reportedById).toBe('rider-1')
    expect(prismaMock.incident.count.mock.calls[0][0].where.reportedById).toBe('rider-1')
  })

  it('takes tile totals from the database and shapes trips and community aggregates', async () => {
    prismaMock.fareCalculation.findMany.mockResolvedValue([trip])
    prismaMock.fareCalculation.aggregate
      .mockResolvedValueOnce({ _count: { _all: 2 }, _sum: { calculatedFare: decimal('30'), discountApplied: null } })
      .mockResolvedValueOnce({
        _count: { _all: 12 },
        _sum: { calculatedFare: decimal('190.40'), discountApplied: decimal('3.60'), distance: decimal('50.5') },
      })
    prismaMock.incident.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(communityReports)
    prismaMock.incident.count.mockResolvedValueOnce(1).mockResolvedValueOnce(4)

    const response = await GET(request('?range=30d'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const body = await response.json()

    expect(body.pulse).toEqual({ tripCount: 12, spent: 190.4, saved: 3.6, distanceKm: 50.5, openReportCount: 1 })
    expect(body.previousPeriodTrips).toBe(2)
    expect(body.previousPeriodSpent).toBe(30)
    expect(body.previousPeriodSaved).toBe(0)
    expect(body.trips[0]).toMatchObject({
      id: 'fc-1',
      group: 'DISCOUNTED',
      fare: 14.4,
      discount: 3.6,
      plateNumber: 'P-9',
      vehicleType: 'TRICYCLE',
    })
    expect(body.community.reportCount).toBe(2)
    expect(body.community.previousPeriodCount).toBe(4)
    expect(body.community.closedCount).toBe(1)
    expect(body.community.medianCloseHours).toBe(10)
    // Aggregates only: no row-level fields from other riders' reports.
    expect(JSON.stringify(body.community)).not.toMatch(/location|plate|reportedBy/i)
    expect(body.truncated).toBe(false)
  })
})
