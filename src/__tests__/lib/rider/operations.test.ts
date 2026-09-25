import { describe, expect, it } from 'vitest'
import { buildCommunity, buildReport, buildTrip, isOpenReport, type TripRow } from '@/lib/rider/operations'

const baseTrip: TripRow = {
  id: 'fc-1',
  fromLocation: 'Poblacion',
  toLocation: 'Basey Port',
  distance: '3.00',
  calculatedFare: '15.00',
  originalFare: null,
  discountApplied: null,
  discountType: null,
  seatsPaid: null,
  // 23:30 UTC = 07:30 next day in Manila
  createdAt: new Date('2026-09-19T23:30:00.000Z'),
  vehicle: null,
}

describe('buildTrip', () => {
  it('buckets by Philippine time and treats no discount as a full fare', () => {
    const trip = buildTrip(baseTrip)
    expect(trip.day).toBe('2026-09-20')
    expect(trip.hour).toBe(7)
    expect(trip.group).toBe('FULL')
    expect(trip).toMatchObject({ fare: 15, discount: 0, originalFare: null, seatsPaid: 1, vehicleType: null, plateNumber: null })
  })

  it('marks discounted fares and prefers the permit plate', () => {
    const trip = buildTrip({
      ...baseTrip,
      calculatedFare: '12.00',
      originalFare: '15.00',
      discountApplied: '3.00',
      seatsPaid: 3,
      vehicle: { plateNumber: 'ABC', vehicleType: 'TRICYCLE', permit: { permitPlateNumber: 'P-1' } },
    })
    expect(trip).toMatchObject({ group: 'DISCOUNTED', fare: 12, originalFare: 15, discount: 3, seatsPaid: 3, plateNumber: 'P-1' })
  })
})

describe('reports', () => {
  it('counts every status but resolved and dismissed as open', () => {
    expect(isOpenReport('PENDING')).toBe(true)
    expect(isOpenReport('TICKET_ISSUED')).toBe(true)
    expect(isOpenReport('REFERRED_FOR_FRANCHISE_ACTION')).toBe(true)
    expect(isOpenReport('RESOLVED')).toBe(false)
    expect(isOpenReport('DISMISSED')).toBe(false)
  })

  it('closes a report at resolution, dismissal or referral', () => {
    const report = buildReport({
      id: 'inc-1',
      incidentType: 'FARE_OVERCHARGE',
      status: 'REFERRED_FOR_FRANCHISE_ACTION',
      location: 'Poblacion',
      ticketNumber: null,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      resolvedAt: null,
      dismissedAt: null,
      referredAt: new Date('2026-09-03T00:00:00.000Z'),
    })
    expect(report.closedAt).toBe('2026-09-03T00:00:00.000Z')
    expect(report.open).toBe(true)
  })

  it('aggregates community reports into outcomes and close times', () => {
    const now = new Date('2026-09-25T00:00:00.000Z')
    const community = buildCommunity(
      [
        { status: 'PENDING', createdAt: new Date('2026-09-10T00:00:00.000Z'), resolvedAt: null, dismissedAt: null, referredAt: null },
        { status: 'INVESTIGATING', createdAt: new Date('2026-09-24T00:00:00.000Z'), resolvedAt: null, dismissedAt: null, referredAt: null },
        {
          status: 'DISMISSED',
          createdAt: new Date('2026-09-20T00:00:00.000Z'),
          resolvedAt: null,
          dismissedAt: new Date('2026-09-22T00:00:00.000Z'),
          referredAt: null,
        },
      ],
      7,
      now,
    )
    expect(community.reportCount).toBe(3)
    expect(community.previousPeriodCount).toBe(7)
    expect(community.outcomes.find((o) => o.status === 'PENDING')?.count).toBe(2)
    expect(community.outcomes.find((o) => o.status === 'DISMISSED')?.count).toBe(1)
    expect(community.closedCount).toBe(1)
    expect(community.medianCloseHours).toBe(48)
    expect(community.openOverAWeek).toBe(1)
  })
})
