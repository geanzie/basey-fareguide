export const REPORTABLE_FARE_HISTORY_LIMIT = 10
export const REPORTABLE_FARE_HISTORY_DAYS = 30

export function getReportableFareHistoryCutoff(now = new Date()): Date {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - REPORTABLE_FARE_HISTORY_DAYS)
  return cutoff
}

export function buildTripRouteLabel(origin: string, destination: string): string {
  return `${origin} to ${destination}`
}

export function formatVehicleIdentity(
  permitPlateNumber?: string | null,
  plateNumber?: string | null,
): string | null {
  return permitPlateNumber || plateNumber || null
}

export function hasVehicleContext(
  permitPlateNumber?: string | null,
  plateNumber?: string | null,
): boolean {
  return Boolean(formatVehicleIdentity(permitPlateNumber, plateNumber))
}