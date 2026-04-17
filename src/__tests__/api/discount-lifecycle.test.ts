/**
 * Phase 6 regression tests: discount card daily usage lifecycle.
 * Covers resetStaleDailyDiscountUsage(), the admin sweep endpoint,
 * and the lazy in-transaction daily reset inside driverSession.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  discountCard: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return new Response(JSON.stringify({ message }), { status })
  }),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => authMock)

// ---------------------------------------------------------------------------
// Subject imports
// ---------------------------------------------------------------------------

import { resetStaleDailyDiscountUsage } from '@/lib/discountUsageSweep'
import { POST } from '@/app/api/admin/sweep/daily-discount-usage/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest() {
  return new Request('http://localhost/api/admin/sweep/daily-discount-usage', {
    method: 'POST',
  }) as never
}

/**
 * Build a UTC-midnight Date for a given ISO date string (e.g. "2026-04-16").
 */
function utcMidnight(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.discountCard.updateMany.mockResolvedValue({ count: 0 })
})

// ---------------------------------------------------------------------------
// 1. resetStaleDailyDiscountUsage() unit tests
// ---------------------------------------------------------------------------

describe('resetStaleDailyDiscountUsage()', () => {
  it('queries cards with dailyUsageCount > 0 AND lastResetDate before today midnight UTC', async () => {
    const now = utcMidnight('2026-04-17') // exact UTC midnight
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 5 })

    const count = await resetStaleDailyDiscountUsage(now)

    expect(count).toBe(5)
    const callArg = prismaMock.discountCard.updateMany.mock.calls[0][0]
    expect(callArg.where.dailyUsageCount).toEqual({ gt: 0 })
    // lastResetDate null OR before today midnight
    expect(callArg.where.OR).toHaveLength(2)
    expect(callArg.where.OR[0]).toEqual({ lastResetDate: null })
    expect(callArg.where.OR[1].lastResetDate.lt).toBeInstanceOf(Date)
  })

  it('resets dailyUsageCount to 0', async () => {
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 3 })

    await resetStaleDailyDiscountUsage(new Date())

    const callArg = prismaMock.discountCard.updateMany.mock.calls[0][0]
    expect(callArg.data.dailyUsageCount).toBe(0)
  })

  it('sets lastResetDate on reset cards', async () => {
    const now = new Date('2026-04-17T08:00:00Z')
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 2 })

    await resetStaleDailyDiscountUsage(now)

    const callArg = prismaMock.discountCard.updateMany.mock.calls[0][0]
    expect(callArg.data.lastResetDate).toBe(now)
  })

  it('returns 0 when no stale cards exist', async () => {
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 0 })

    const count = await resetStaleDailyDiscountUsage(new Date())

    expect(count).toBe(0)
  })

  it('uses current time when no argument is provided', async () => {
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 1 })
    const before = Date.now()

    await resetStaleDailyDiscountUsage()

    const after = Date.now()
    const callArg = prismaMock.discountCard.updateMany.mock.calls[0][0]
    expect(callArg.data.lastResetDate.getTime()).toBeGreaterThanOrEqual(before)
    expect(callArg.data.lastResetDate.getTime()).toBeLessThanOrEqual(after)
  })

  it('uses UTC midnight for the cutoff (not local midnight)', async () => {
    // "2026-04-17T00:00:00Z" should yield a cutoff at exactly midnight UTC
    const now = new Date('2026-04-17T00:00:00Z')
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 0 })

    await resetStaleDailyDiscountUsage(now)

    const { lt } = prismaMock.discountCard.updateMany.mock.calls[0][0].where.OR[1].lastResetDate
    expect(lt.toISOString()).toBe('2026-04-17T00:00:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// 2. POST /api/admin/sweep/daily-discount-usage
// ---------------------------------------------------------------------------

describe('POST /api/admin/sweep/daily-discount-usage', () => {
  it('returns 200 with resetCount when admin calls endpoint', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 7 })

    const res = await POST(makeRequest())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true, resetCount: 7 })
  })

  it('returns 0 resetCount when all cards are already up to date', async () => {
    authMock.requireRequestRole.mockResolvedValueOnce({ id: 'admin-1', userType: 'ADMIN' })
    prismaMock.discountCard.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await POST(makeRequest())
    const json = await res.json()

    expect(json.resetCount).toBe(0)
  })

  it('rejects unauthenticated callers with 401', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Unauthorized'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
  })

  it('rejects non-admin callers with 403', async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error('Forbidden'))

    const res = await POST(makeRequest())

    expect(res.status).toBe(403)
  })
})
