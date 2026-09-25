import { describe, expect, it } from 'vitest'
import {
  buildDashboardRecords,
  incidentTypeLabel,
  manilaMidnight,
  manilaParts,
  parseStoredCoordinates,
  resolveIncidentPoint,
  type DashboardIncidentRow,
} from '@/lib/incidents/dashboard'
import {
  closeTimes,
  countByType,
  countByVehicleType,
  outcomeCounts,
  reportSeries,
  hourByWeekday,
  rankHotspots,
  repeatPlates,
  violationGroupFor,
} from '@/lib/incidents/dashboardGroups'

function row(overrides: Partial<DashboardIncidentRow> = {}): DashboardIncidentRow {
  return {
    id: 'i1',
    incidentType: 'FARE_OVERCHARGE',
    status: 'PENDING',
    location: 'Amandayehan',
    coordinates: null,
    tripOrigin: null,
    plateNumber: 'ABC-123',
    vehicleType: 'TRICYCLE',
    incidentDate: new Date('2026-09-20T02:00:00.000Z'),
    createdAt: new Date('2026-09-20T02:05:00.000Z'),
    ...overrides,
  }
}

describe('resolveIncidentPoint', () => {
  it('uses reporter GPS as an exact point', () => {
    const point = resolveIncidentPoint(
      row({ coordinates: JSON.stringify({ latitude: 11.28, longitude: 125.07 }) }),
    )
    expect(point).toEqual({ lat: 11.28, lng: 125.07, precision: 'GPS' })
  })

  it('falls back to the trip origin place, marked approximate', () => {
    const point = resolveIncidentPoint(row({ tripOrigin: 'Anglit', location: 'somewhere' }))
    expect(point).toEqual({ lat: 11.304796, lng: 125.10899, precision: 'PLACE' })
  })

  it('resolves the typed location case-insensitively', () => {
    expect(resolveIncidentPoint(row({ location: '  amandayehan ' }))?.precision).toBe('PLACE')
  })

  it('returns null for an unknown place', () => {
    expect(resolveIncidentPoint(row({ location: 'Near the big tree' }))).toBeNull()
  })

  it('rejects GPS outside the Basey service area and falls back to the place', () => {
    const point = resolveIncidentPoint(
      row({ coordinates: JSON.stringify({ latitude: 14.6, longitude: 121.0 }) }),
    )
    expect(point?.precision).toBe('PLACE')
  })

  it('ignores malformed coordinates', () => {
    expect(parseStoredCoordinates('not json')).toBeNull()
    expect(parseStoredCoordinates(JSON.stringify({ latitude: '11', longitude: 125 }))).toBeNull()
  })
})

describe('Manila time', () => {
  it('buckets a UTC-evening report into the next Manila day', () => {
    // 2026-09-19 (Sat) 17:30 UTC = 2026-09-20 (Sun) 01:30 Manila
    expect(manilaParts(new Date('2026-09-19T17:30:00.000Z'))).toEqual({
      weekday: 0,
      hour: 1,
      day: '2026-09-20',
    })
  })

  it('finds Manila midnight', () => {
    expect(manilaMidnight(new Date('2026-09-20T02:00:00.000Z')).toISOString()).toBe(
      '2026-09-19T16:00:00.000Z',
    )
    expect(manilaMidnight(new Date('2026-09-19T17:00:00.000Z')).toISOString()).toBe(
      '2026-09-19T16:00:00.000Z',
    )
  })
})

describe('buildDashboardRecords', () => {
  it('counts unplaced incidents and keeps every record', () => {
    const result = buildDashboardRecords([
      row({ id: 'a' }),
      row({ id: 'b', location: 'Unknown spot' }),
      row({ id: 'c', status: 'RESOLVED', incidentType: 'RECKLESS_DRIVING' }),
    ])
    expect(result.records).toHaveLength(3)
    expect(result.points.map((p) => p.id)).toEqual(['a', 'c'])
    expect(result.unplacedCount).toBe(1)
    expect(result.records.find((r) => r.id === 'c')).toMatchObject({ open: false, group: 'DRIVING' })
    expect(result.types.map((t) => t.type).sort()).toEqual(['FARE_OVERCHARGE', 'RECKLESS_DRIVING'])
  })
})

describe('aggregations', () => {
  const { records } = buildDashboardRecords([
    row({ id: '1', location: 'Anglit', plateNumber: 'ABC 123' }),
    row({ id: '2', location: 'anglit', plateNumber: 'abc-123', incidentType: 'RECKLESS_DRIVING' }),
    row({ id: '3', location: 'Anglit', plateNumber: 'XYZ-9', incidentType: 'RECKLESS_DRIVING', status: 'RESOLVED' }),
    row({ id: '4', location: 'Amandayehan', plateNumber: null }),
  ])

  it('ranks hotspots by count with the dominant type', () => {
    const [top, second] = rankHotspots(records)
    expect(top).toMatchObject({ placeKey: 'anglit', count: 3, open: 2, topType: 'RECKLESS_DRIVING' })
    expect(second).toMatchObject({ placeKey: 'amandayehan', count: 1 })
  })

  it('finds plates reported twice or more, ignoring spacing and dashes', () => {
    const plates = repeatPlates(records)
    expect(plates).toHaveLength(1)
    expect(plates[0]).toMatchObject({ count: 2, open: 2 })
  })

  it('counts by type and fills the hour grid', () => {
    expect(countByType(records)[0]).toMatchObject({ count: 2 })
    const grid = hourByWeekday(records)
    // 2026-09-20T02:00Z = Sunday 10:00 Manila
    expect(grid[0][10]).toBe(4)
  })
})

describe('labels and groups', () => {
  it('humanizes types missing from the label table', () => {
    expect(incidentTypeLabel('FARE_OVERCHARGE')).toBe('Fare Overcharge')
    expect(incidentTypeLabel('SOME_FUTURE_TYPE')).toBe('Some future type')
  })

  it('groups franchise offences together and unknowns under OTHER', () => {
    expect(violationGroupFor('NO_FRANCHISE_AND_MTOP')).toBe('FRANCHISE')
    expect(violationGroupFor('SOMETHING_NEW')).toBe('OTHER')
  })
})

describe('analytics', () => {
  const hour = 3_600_000
  const filed = new Date('2026-09-20T02:00:00.000Z')
  const { records } = buildDashboardRecords([
    row({ id: 'a', status: 'RESOLVED', createdAt: filed, resolvedAt: new Date(filed.getTime() + 10 * hour) }),
    row({ id: 'b', status: 'DISMISSED', createdAt: filed, dismissedAt: new Date(filed.getTime() + 50 * hour) }),
    row({ id: 'c', status: 'REFERRED_FOR_FRANCHISE_ACTION', createdAt: filed, referredAt: new Date(filed.getTime() + 100 * hour), vehicleType: 'JEEPNEY' }),
    row({ id: 'd', status: 'INVESTIGATING', createdAt: filed, vehicleType: null, incidentType: 'RECKLESS_DRIVING' }),
  ])

  it('measures time to close from filing, whichever way the case left', () => {
    const summary = closeTimes(records, new Date('2026-09-30T00:00:00.000Z'))
    expect(summary.closedCount).toBe(3)
    expect(summary.medianHours).toBe(50)
    expect(summary.buckets.map((b) => b.count)).toEqual([1, 1, 1, 0, 0])
    expect(summary.openOverAWeek).toBe(1)
  })

  it('folds legacy INVESTIGATING into pending', () => {
    expect(outcomeCounts(records)).toEqual([
      { status: 'PENDING', count: 1 },
      { status: 'TICKET_ISSUED', count: 0 },
      { status: 'REFERRED_FOR_FRANCHISE_ACTION', count: 1 },
      { status: 'RESOLVED', count: 1 },
      { status: 'DISMISSED', count: 1 },
    ])
  })

  it('fills every day in the window, empty ones included, split by group', () => {
    const series = reportSeries(
      records,
      new Date('2026-09-17T16:00:00.000Z'),
      new Date('2026-09-20T05:00:00.000Z'),
      'day',
    )
    expect(series.map((b) => b.key)).toEqual(['2026-09-18', '2026-09-19', '2026-09-20'])
    expect(series[2]).toMatchObject({ total: 4, byGroup: { FARE: 3, DRIVING: 1 } })
  })

  it('uses 24 hourly buckets for a single day', () => {
    const series = reportSeries(records, new Date(0), new Date(0), 'hour')
    expect(series).toHaveLength(24)
    expect(series[10].total).toBe(4)
  })

  it('counts vehicle types with unknown kept separate', () => {
    expect(countByVehicleType(records)).toEqual([
      { vehicleType: 'TRICYCLE', count: 2 },
      { vehicleType: 'JEEPNEY', count: 1 },
      { vehicleType: 'UNKNOWN', count: 1 },
    ])
  })
})
