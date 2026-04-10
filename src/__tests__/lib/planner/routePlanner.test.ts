import { describe, expect, it } from 'vitest'

import {
  approxMeters,
  classifyPlannerError,
  pointsEffectivelyEqual,
  routePairEffectivelyEqual,
} from '@/lib/planner/routePlanner'

describe('planner route helpers', () => {
  it('treats tiny point movement as unchanged at the planner threshold', () => {
    expect(
      pointsEffectivelyEqual(
        { lat: 11.2754, lng: 125.0689 },
        { lat: 11.27541, lng: 125.06891 },
      ),
    ).toBe(true)
  })

  it('treats larger point movement as changed', () => {
    expect(
      pointsEffectivelyEqual(
        { lat: 11.2754, lng: 125.0689 },
        { lat: 11.276, lng: 125.0695 },
      ),
    ).toBe(false)
  })

  it('compares origin and destination together for route dedupe', () => {
    expect(
      routePairEffectivelyEqual(
        {
          origin: { lat: 11.2754, lng: 125.0689 },
          destination: { lat: 11.2854, lng: 125.0789 },
        },
        {
          origin: { lat: 11.27541, lng: 125.06891 },
          destination: { lat: 11.28541, lng: 125.07891 },
        },
      ),
    ).toBe(true)
  })

  it('classifies service-area and routing failures into explicit planner states', () => {
    expect(classifyPlannerError('Origin pin is outside the Basey service area')).toBe(
      'out_of_service_area',
    )
    expect(classifyPlannerError('Destination pin is too far from any road', 'NO_ROAD_ROUTE_FOUND')).toBe(
      'no_route_found',
    )
    expect(classifyPlannerError('Routing service unavailable', 'ROUTING_SERVICE_UNAVAILABLE')).toBe('network_error')
  })

  it('keeps distance approximation stable enough for request dedupe', () => {
    expect(
      approxMeters(
        { lat: 11.2754, lng: 125.0689 },
        { lat: 11.2755, lng: 125.069 },
      ),
    ).toBeGreaterThan(0)
  })
})
