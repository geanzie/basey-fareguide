/**
 * Phase 7 regression tests: admin trip/fare analytics endpoint.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  vehicleTripSession: {
    count: vi.fn(),
  },
  fareCalculation: {
    aggregate: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  discountUsageLog: {
    aggregate: vi.fn(),
  },
  incident: {
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
}))

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
  ADMIN_ONLY: ['ADMIN'],
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)

// ---------------------------------------------------------------------------
// Subject import
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/reports/trips/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(period?: string) {
  const url = period
    ? `http://localhost/api/admin/reports/trips?period=${period}`
    : 'http://localhost/api/admin/reports/trips'
  return new Request(url) as never
}

const ADMIN_USER = { id: 'admin-1', userType: 'ADMIN' }

function setupDefaultMocks() {
  prismaMock.vehicleTripSession.count
    .mockResolvedValueOnce(10)   // total sessions
    .mockResolvedValueOnce(8)    // closed sessions

  prismaMock.fareCalculation.aggregate.mockResolvedValueOnce({
    _count: { _all: 25 },
    _sum: { calculatedFare: 1250.0 },
    _avg: { calculatedFare: 50.0 },
  })

  prismaMock.fareCalculation.findMany.mockResolvedValueOnce([
    { createdAt: new Date('2026-04-17T08:00:00Z'), calculatedFare: 50 },
    { createdAt: new Date('2026-04-17T09:00:00Z'), calculatedFare: 50 },
  ])

  prismaMock.fareCalculation.groupBy
    .mockResolvedValueOnce([])   // fareByDiscountType
    .mockResolvedValueOnce([])   // discountByType

  prismaMock.discountUsageLog.aggregate.mockResolvedValueOnce({
    _count: { _all: 5 },
    _sum: { discountAmount: 100.0, originalFare: 500.0 },
  })

  prismaMock.incident.count.mockResolvedValueOnce(3)
  prismaMock.incident.groupBy.mockResolvedValueOnce([
    { paymentStatus: 'PAID', _count: { _all: 2 } },
    { paymentStatus: 'UNPAID', _count: { _all: 1 } },
  ])
  prismaMock.incident.aggregate.mockResolvedValueOnce({
    _sum: { penaltyAmount: 300.0 },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.requireRequestRole.mockResolvedValue(ADMIN_USER)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/reports/trips', () => {
  it('returns 200 with trips, discounts, and tickets sections', async () => {
    setupDefaultMocks()

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('trips')
    expect(json.data).toHaveProperty('discounts')
    expect(json.data).toHaveProperty('tickets')
  })

  it('returns correct trip totals', async () => {
    setupDefaultMocks()

    const res = await GET(makeRequest())
    const { trips } = (await res.json()).data

    expect(trips.totalSessions).toBe(10)
    expect(trips.closedSessions).toBe(8)
    expect(trips.totalTrips).toBe(25)
    expect(trips.totalFare).toBe(1250.0)
    expect(trips.averageFare).toBe(50.0)
  })

  it('returns correct discount totals', async () => {
    setupDefaultMocks()

    const res = await GET(makeRequest())
    const { discounts } = (await res.json()).data

    expect(discounts.totalUsages).toBe(5)
    expect(discounts.totalDiscountAmount).toBe(100.0)
    expect(discounts.totalOriginalFare).toBe(500.0)
  })

  it('returns correct ticket totals', async () => {
    setupDefaultMocks()

    const res = await GET(makeRequest())
    const { tickets } = (await res.json()).data

    expect(tickets.total).toBe(3)
    expect(tickets.byPaymentStatus).toEqual({ PAID: 2, UNPAID: 1 })
    expect(tickets.totalPenaltyAmount).toBe(300.0)
  })

  it('aggregates monthly revenue from fare rows', async () => {
    prismaMock.vehicleTripSession.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
    prismaMock.fareCalculation.aggregate.mockResolvedValueOnce({
      _count: { _all: 2 }, _sum: { calculatedFare: 100 }, _avg: { calculatedFare: 50 },
    })
    prismaMock.fareCalculation.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-04-01T00:00:00Z'), calculatedFare: 50 },
      { createdAt: new Date('2026-04-15T00:00:00Z'), calculatedFare: 50 },
    ])
    prismaMock.fareCalculation.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    prismaMock.discountUsageLog.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 }, _sum: { discountAmount: 0, originalFare: 0 },
    })
    prismaMock.incident.count.mockResolvedValueOnce(0)
    prismaMock.incident.groupBy.mockResolvedValueOnce([])
    prismaMock.incident.aggregate.mockResolvedValueOnce({ _sum: { penaltyAmount: 0 } })

    const res = await GET(makeRequest())
    const { trips } = (await res.json()).data

    expect(trips.monthlyRevenue['2026-04']).toEqual({ trips: 2, fare: 100 })
  })

  it('echoes the period parameter in the response', async () => {
    setupDefaultMocks()

    const res = await GET(makeRequest('7d'))
    const json = await res.json()

    expect(json.data.period).toBe('7d')
  })

  it('defaults to 30d when no period is given', async () => {
    setupDefaultMocks()

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(json.data.period).toBe('30d')
  })

  it('rejects unauthenticated requests with 401', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await GET(makeRequest())

    expect(res.status).toBe(401)
  })

  it('rejects non-admin requests with 403', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const res = await GET(makeRequest())

    expect(res.status).toBe(403)
  })

  it('handles all zero values gracefully (no trips in period)', async () => {
    prismaMock.vehicleTripSession.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0)
    prismaMock.fareCalculation.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 }, _sum: { calculatedFare: null }, _avg: { calculatedFare: null },
    })
    prismaMock.fareCalculation.findMany.mockResolvedValueOnce([])
    prismaMock.fareCalculation.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    prismaMock.discountUsageLog.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 }, _sum: { discountAmount: null, originalFare: null },
    })
    prismaMock.incident.count.mockResolvedValueOnce(0)
    prismaMock.incident.groupBy.mockResolvedValueOnce([])
    prismaMock.incident.aggregate.mockResolvedValueOnce({ _sum: { penaltyAmount: null } })

    const res = await GET(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.trips.totalFare).toBe(0)
    expect(json.data.trips.averageFare).toBe(0)
    expect(json.data.discounts.totalDiscountAmount).toBe(0)
    expect(json.data.tickets.totalPenaltyAmount).toBe(0)
  })
})
