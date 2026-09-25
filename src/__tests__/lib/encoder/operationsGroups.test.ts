import { describe, expect, it } from 'vitest'
import { buildEvent, buildQueueItem } from '@/lib/encoder/operations'
import {
  activitySeries,
  collectedTotal,
  collectionsSeries,
  eventsByVehicleType,
  manilaWeekStart,
  matchesEvent,
  matchesQueueItem,
  outlookWeeks,
  paymentLagSummary,
  permitsByType,
} from '@/lib/encoder/operationsGroups'
import { stackedSeries } from '@/lib/operations/period'

const at = (iso: string) => new Date(iso)

const events = [
  buildEvent('VEHICLE_REGISTERED', 'v1', at('2026-09-20T01:00:00.000Z'), { vehicleType: 'TRICYCLE' }),
  buildEvent('PERMIT_ISSUED', 'p1', at('2026-09-20T02:00:00.000Z'), { vehicleType: 'TRICYCLE' }),
  buildEvent('QR_PRINTED', 'q1', at('2026-09-21T02:00:00.000Z'), { vehicleType: 'HABAL_HABAL' }),
  buildEvent('PAYMENT_RECORDED', 'i1', at('2026-09-21T03:00:00.000Z'), {
    vehicleType: 'TRICYCLE',
    amount: 500,
    lagDays: 0.5,
  }),
  buildEvent('PAYMENT_RECORDED', 'i2', at('2026-09-21T04:00:00.000Z'), { amount: 1000, lagDays: 10 }),
]

describe('activitySeries', () => {
  it('fills every day in the window and stacks by area of work', () => {
    const series = activitySeries(events, at('2026-09-19T00:00:00.000Z'), at('2026-09-21T10:00:00.000Z'), 'day')
    expect(series.map((bucket) => bucket.key)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21'])
    expect(series[0].total).toBe(0)
    expect(series[1].byGroup).toEqual({ REGISTRATIONS: 1, PERMITS: 1, STICKERS: 0, PAYMENTS: 0 })
    expect(series[2].byGroup).toEqual({ REGISTRATIONS: 0, PERMITS: 0, STICKERS: 1, PAYMENTS: 2 })
  })
})

describe('collections', () => {
  it('sums pesos per bucket from payments only', () => {
    const series = collectionsSeries(events, at('2026-09-20T00:00:00.000Z'), at('2026-09-21T10:00:00.000Z'), 'day')
    expect(series.map((bucket) => bucket.total)).toEqual([0, 1500])
    expect(collectedTotal(events)).toBe(1500)
  })

  it('shares one bucketing rule with stackedSeries', () => {
    const hourly = stackedSeries(events, ['X'] as const, () => 'X', at('2026-09-21T00:00:00.000Z'), at('2026-09-21T10:00:00.000Z'), 'hour')
    expect(hourly).toHaveLength(24)
    expect(hourly[11].total).toBe(1) // 03:00 UTC = 11 AM Manila
  })
})

describe('paymentLagSummary', () => {
  it('reports the median and a histogram of days to pay', () => {
    const summary = paymentLagSummary(events)
    expect(summary.paidCount).toBe(2)
    expect(summary.medianDays).toBe(5.25)
    expect(summary.buckets.map((bucket) => bucket.count)).toEqual([1, 0, 0, 1, 0])
  })

  it('has no median without payments', () => {
    expect(paymentLagSummary([]).medianDays).toBeNull()
  })
})

describe('filters', () => {
  it('match events by group or vehicle type, with UNKNOWN for missing types', () => {
    expect(events.filter((e) => matchesEvent({ kind: 'group', group: 'PAYMENTS' }, e))).toHaveLength(2)
    expect(events.filter((e) => matchesEvent({ kind: 'vehicleType', vehicleType: 'TRICYCLE' }, e))).toHaveLength(3)
    expect(events.filter((e) => matchesEvent({ kind: 'vehicleType', vehicleType: 'UNKNOWN' }, e))).toHaveLength(1)
    expect(events.filter((e) => matchesEvent(null, e))).toHaveLength(5)
  })

  it('match queue items by the area their kind belongs to', () => {
    const ticket = buildQueueItem('UNPAID_TICKET', 'i', { vehicleType: 'TRICYCLE' })
    const sticker = buildQueueItem('STICKER_TO_PRINT', 'p', { vehicleType: 'HABAL_HABAL' })
    expect(matchesQueueItem({ kind: 'group', group: 'PAYMENTS' }, ticket)).toBe(true)
    expect(matchesQueueItem({ kind: 'group', group: 'PAYMENTS' }, sticker)).toBe(false)
    expect(matchesQueueItem({ kind: 'vehicleType', vehicleType: 'HABAL_HABAL' }, sticker)).toBe(true)
  })
})

describe('eventsByVehicleType', () => {
  it('ranks types largest first', () => {
    expect(eventsByVehicleType(events)).toEqual([
      { vehicleType: 'TRICYCLE', count: 3 },
      { vehicleType: 'HABAL_HABAL', count: 1 },
      { vehicleType: 'UNKNOWN', count: 1 },
    ])
  })
})

describe('permitsByType', () => {
  it('folds the status snapshot into one row per vehicle type', () => {
    const rows = permitsByType([
      { vehicleType: 'TRICYCLE', status: 'ACTIVE', count: 40 },
      { vehicleType: 'TRICYCLE', status: 'EXPIRED', count: 5 },
      { vehicleType: 'HABAL_HABAL', status: 'REVOKED', count: 2 },
    ])
    expect(rows).toEqual([
      { vehicleType: 'TRICYCLE', total: 45, byStatus: { ACTIVE: 40, EXPIRED: 5, SUSPENDED: 0, REVOKED: 0 } },
      { vehicleType: 'HABAL_HABAL', total: 2, byStatus: { ACTIVE: 0, EXPIRED: 0, SUSPENDED: 0, REVOKED: 2 } },
    ])
  })
})

describe('outlook weeks', () => {
  it('starts weeks on Monday, Philippine time', () => {
    expect(manilaWeekStart(at('2026-09-25T02:00:00.000Z'))).toBe('2026-09-21') // Friday
    expect(manilaWeekStart(at('2026-09-27T17:00:00.000Z'))).toBe('2026-09-28') // Monday 1 AM Manila
  })

  it('lists 12 weeks, filling quiet ones, optionally for one vehicle type', () => {
    const outlook = [
      { weekStart: '2026-09-21', vehicleType: 'TRICYCLE', count: 3 },
      { weekStart: '2026-10-05', vehicleType: 'HABAL_HABAL', count: 2 },
      { weekStart: '2027-06-07', vehicleType: 'TRICYCLE', count: 9 },
    ]
    const weeks = outlookWeeks(outlook, at('2026-09-25T02:00:00.000Z'))
    expect(weeks).toHaveLength(12)
    expect(weeks[0]).toEqual({ weekStart: '2026-09-21', count: 3 })
    expect(weeks[2]).toEqual({ weekStart: '2026-10-05', count: 2 })
    expect(weeks.reduce((sum, week) => sum + week.count, 0)).toBe(5)
    expect(outlookWeeks(outlook, at('2026-09-25T02:00:00.000Z'), 'TRICYCLE')[2].count).toBe(0)
  })
})
