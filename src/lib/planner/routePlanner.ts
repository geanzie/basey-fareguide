export interface PlannerCoordinates {
  lat: number
  lng: number
}

export interface PlannerPoint extends PlannerCoordinates {
  label?: string
}

export type PlannerViewState =
  | 'placing_points'
  | 'calculating'
  | 'route_ready'
  | 'no_route_found'
  | 'network_error'
  | 'out_of_service_area'

export function approxMeters(a: PlannerCoordinates, b: PlannerCoordinates): number {
  const dLat = (a.lat - b.lat) * 111_000
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos(a.lat * (Math.PI / 180))
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

export function pointsEffectivelyEqual(
  current: PlannerCoordinates | null,
  next: PlannerCoordinates | null,
  thresholdMeters = 5,
): boolean {
  if (!current && !next) return true
  if (!current || !next) return false
  return approxMeters(current, next) < thresholdMeters
}

export function routePairEffectivelyEqual(
  current:
    | {
        origin: PlannerCoordinates
        destination: PlannerCoordinates
      }
    | null,
  next:
    | {
        origin: PlannerCoordinates
        destination: PlannerCoordinates
      }
    | null,
  thresholdMeters = 5,
): boolean {
  if (!current && !next) return true
  if (!current || !next) return false

  return (
    pointsEffectivelyEqual(current.origin, next.origin, thresholdMeters) &&
    pointsEffectivelyEqual(current.destination, next.destination, thresholdMeters)
  )
}

export function classifyPlannerError(message: string, code?: string | null): PlannerViewState {
  if (code === 'NO_ROAD_ROUTE_FOUND') {
    return 'no_route_found'
  }

  if (code === 'ROUTE_UNVERIFIED') {
    return 'no_route_found'
  }

  if (code === 'ROUTING_SERVICE_UNAVAILABLE') {
    return 'network_error'
  }

  const normalized = message.toLowerCase()

  if (
    normalized.includes('outside the basey service area') ||
    normalized.includes('outside the philippines')
  ) {
    return 'out_of_service_area'
  }

  if (
    normalized.includes('too far from any road') ||
    normalized.includes('unknown location') ||
    normalized.includes('same point') ||
    normalized.includes('no route')
  ) {
    return 'no_route_found'
  }

  return 'network_error'
}

export function getRouteSourceBadge(method: string | null, distanceKm: number): string {
  if (method == null && distanceKm === 0) return 'Same-point result'
  return 'Verified road route'
}
