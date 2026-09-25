/**
 * GET /api/enforcer/operations — the enforcer control center payload.
 *
 * One response feeds the whole page (map, feed, charts), so every client-side
 * filter works on data already in hand. The page fetches it on load and on a
 * period change, then again only when the watermark below reports a new
 * incident.
 */

export type EnforcerOperationsRange = "today" | "7d" | "30d" | "90d";

/**
 * Violation groups used for color on the map and charts. Twelve incident
 * types are too many hues to tell apart on a street map; five groups are not.
 */
export type ViolationGroup = "FARE" | "DRIVING" | "FRANCHISE" | "ROUTE" | "OTHER";

/**
 * GPS — the reporter's phone position when the report was filed.
 * PLACE — resolved from a place name (trip origin or typed location), so it
 * marks the barangay or landmark, not the exact spot.
 */
export type IncidentPointPrecision = "GPS" | "PLACE";

export interface EnforcerOperationsPointDto {
  id: string;
  lat: number;
  lng: number;
  precision: IncidentPointPrecision;
  type: string;
  typeLabel: string;
  group: ViolationGroup;
  status: string;
  location: string;
  plateNumber: string | null;
  incidentDate: string;
}

export interface EnforcerOperationsPulseDto {
  /** PENDING + legacy INVESTIGATING + TICKET_ISSUED. */
  openCount: number;
  pendingCount: number;
  /** Tickets issued and not yet paid. */
  awaitingPaymentCount: number;
  referredCount: number;
  /** Reports filed since midnight, Philippine time. */
  newTodayCount: number;
  oldestOpenAt: string | null;
}

export interface EnforcerOperationsFeedItemDto {
  id: string;
  type: string;
  typeLabel: string;
  group: ViolationGroup;
  status: string;
  location: string;
  plateNumber: string | null;
  vehicleType: string | null;
  incidentDate: string;
  createdAt: string;
}

/**
 * One row per incident in the range, stripped to what the charts need.
 * The client derives every chart from these so a filter re-slices all of
 * them at once without another request.
 */
export interface EnforcerOperationsRecordDto {
  id: string;
  type: string;
  group: ViolationGroup;
  open: boolean;
  /** Normalized location key used for hotspot grouping. */
  placeKey: string;
  location: string;
  plateNumber: string | null;
  /** 0 = Sunday, Philippine time. */
  weekday: number;
  /** 0-23, Philippine time. */
  hour: number;
  /** YYYY-MM-DD, Philippine time. */
  day: string;
  incidentDate: string;
  status: string;
  vehicleType: string | null;
  /** When the report was filed. Time-to-close is measured from here. */
  createdAt: string;
  /**
   * When the case left the enforcer queue: resolved (paid), dismissed, or
   * referred to the Sangguniang Bayan. Null while still open.
   */
  closedAt: string | null;
}

export interface EnforcerOperationsTypeDto {
  type: string;
  label: string;
  group: ViolationGroup;
}

export interface EnforcerOperationsDto {
  generatedAt: string;
  range: EnforcerOperationsRange;
  since: string;
  pulse: EnforcerOperationsPulseDto;
  feed: EnforcerOperationsFeedItemDto[];
  records: EnforcerOperationsRecordDto[];
  points: EnforcerOperationsPointDto[];
  /** Incidents in range with no usable position. */
  unplacedCount: number;
  /** Reports in the period of equal length just before `since`. */
  previousPeriodCount: number;
  /** True when the range held more rows than the server reads at once. */
  truncated: boolean;
  types: EnforcerOperationsTypeDto[];
}

/**
 * GET /api/enforcer/operations/latest — the newest reported incident. The
 * control center polls this every 15 s instead of the full payload.
 */
export interface EnforcerIncidentWatermarkDto {
  /** When the server answered; drives the "Live · updated" label. */
  checkedAt: string;
  latestId: string | null;
  latestCreatedAt: string | null;
}
