import { describe, expect, it } from 'vitest'
import type { RiderTripDto } from '@/lib/contracts'
import {
  frequentRoutes,
  matchesTrip,
  savingsSeries,
  spendSeries,
  tripTotals,
  tripsByVehicleType,
} from '@/lib/rider/operationsGroups'

function trip(overrides: Partial<RiderTripDto>): RiderTripDto {
  return {
    id: 'fc',
    at: '2026-09-20T01:00:00.000Z',
    day: '2026-09-20',
    hour: 9,
    weekday: 0,
    group: 'FULL',
    from: 'Poblacion',
    to: 'Basey Port',
    distanceKm: 3,
    fare: 15,
    originalFare: null,
    discount: 0,
    discountType: null,
    seatsPaid: 1,
    plateNumber: null,
    vehicleType: 'TRICYCLE',
    ...overrides,
  }
}

const trips = [
  trip({ id: 'a' }),
  trip({ id: 'b', fare: 12, discount: 3, group: 'DISCOUNTED', day: '2026-09-21', to: 'basey port ' }),
  trip({ id: 'c', fare: 30, vehicleType: null, to: 'Sohoton', distanceKm: 10 }),
]

const since = new Date('2026-09-19T16:00:00.000Z') // Manila midnight, 2026-09-20
const until = new Date('2026-09-21T10:00:00.000Z')

describe('rider operations groups', () => {
  it('sums pesos per day, split by full and discounted fares', () => {
    const series = spendSeries(trips, since, until, 'day')
    expect(series.map((bucket) => bucket.key)).toEqual(['2026-09-20', '2026-09-21'])
    expect(series[0].byGroup).toEqual({ FULL: 45, DISCOUNTED: 0 })
    expect(series[1].byGroup).toEqual({ FULL: 0, DISCOUNTED: 12 })
  })

  it('sums savings only from discounted trips', () => {
    const series = savingsSeries(trips, since, until, 'day')
    expect(series.map((bucket) => bucket.total)).toEqual([0, 3])
  })

  it('totals fares, savings and distance', () => {
    expect(tripTotals(trips)).toEqual({ spent: 57, saved: 3, distanceKm: 16 })
  })

  it('groups by vehicle type with unknown types kept', () => {
    expect(tripsByVehicleType(trips)).toEqual([
      { vehicleType: 'TRICYCLE', count: 2, spent: 27 },
      { vehicleType: 'UNKNOWN', count: 1, spent: 30 },
    ])
    expect(matchesTrip({ kind: 'vehicleType', vehicleType: 'UNKNOWN' }, trips[2])).toBe(true)
    expect(matchesTrip({ kind: 'vehicleType', vehicleType: 'UNKNOWN' }, trips[0])).toBe(false)
    expect(matchesTrip(null, trips[0])).toBe(true)
  })

  it('merges routes that differ only in case or spacing', () => {
    const routes = frequentRoutes(trips)
    expect(routes[0]).toMatchObject({ from: 'Poblacion', to: 'Basey Port', count: 2, averageFare: 13.5 })
    expect(routes).toHaveLength(2)
  })
})
