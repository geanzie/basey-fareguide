/**
 * Server-side shaping for GET /api/enforcer/operations. Pure: takes rows the
 * route already read and returns the DTO pieces, so it tests without a DB.
 */
import type {
  EnforcerOperationsFeedItemDto,
  EnforcerOperationsPointDto,
  EnforcerOperationsRecordDto,
  EnforcerOperationsTypeDto,
  IncidentPointPrecision,
} from "@/lib/contracts";
import { resolveCoordinates } from "@/lib/locations/coordinates";
import { formatIncidentTypeLabel } from "@/lib/serializers/incidents";
import { isInBounds } from "@/lib/tracker/calculations";
import { BASEY_SERVICE_AREA } from "@/lib/tracker/constants";
import { manilaParts } from "@/lib/operations/period";
import { isOpenStatus, normalizePlaceKey, violationGroupFor } from "./dashboardGroups";

export {
  OPERATIONS_RANGES as ENFORCER_OPERATIONS_RANGES,
  isOperationsRange as isEnforcerOperationsRange,
  manilaMidnight,
  manilaParts,
  rangeStart,
} from "@/lib/operations/period";

/** Humanizes types the serializer's label table does not cover yet. */
export function incidentTypeLabel(type: string): string {
  const label = formatIncidentTypeLabel(type);
  if (label !== type) return label;
  const words = type.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface DashboardIncidentRow {
  id: string;
  incidentType: string;
  status: string;
  location: string;
  coordinates: string | null;
  tripOrigin: string | null;
  plateNumber: string | null;
  vehicleType: string | null;
  incidentDate: Date;
  createdAt: Date;
  resolvedAt?: Date | null;
  dismissedAt?: Date | null;
  referredAt?: Date | null;
}

/**
 * Where to draw an incident. The reporter's GPS wins; otherwise the trip's
 * origin or the typed location, looked up in the known-places table. A place
 * hit is marked PLACE so the map never presents it as the exact spot.
 */
export function resolveIncidentPoint(
  row: Pick<DashboardIncidentRow, "coordinates" | "tripOrigin" | "location">,
): { lat: number; lng: number; precision: IncidentPointPrecision } | null {
  const gps = parseStoredCoordinates(row.coordinates);
  if (gps) return { ...gps, precision: "GPS" };

  for (const name of [row.tripOrigin, row.location]) {
    if (!name?.trim()) continue;
    const place = resolveCoordinates(name);
    if (place && isInBounds(place.lat, place.lng, BASEY_SERVICE_AREA)) {
      return { lat: place.lat, lng: place.lng, precision: "PLACE" };
    }
  }
  return null;
}

/** `Incident.coordinates` holds `{"latitude":n,"longitude":n}` as written by the report route. */
export function parseStoredCoordinates(value: string | null): { lat: number; lng: number } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { latitude?: unknown; longitude?: unknown };
    const { latitude, longitude } = parsed;
    if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
    if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;
    if (!isInBounds(latitude, longitude, BASEY_SERVICE_AREA)) return null;
    return { lat: latitude, lng: longitude };
  } catch {
    return null;
  }
}

/** When the case left the enforcer queue, whichever way it left. */
export function closedAt(
  row: Pick<DashboardIncidentRow, "resolvedAt" | "dismissedAt" | "referredAt">,
): Date | null {
  return row.resolvedAt ?? row.dismissedAt ?? row.referredAt ?? null;
}

export function buildDashboardRecords(rows: readonly DashboardIncidentRow[]): {
  records: EnforcerOperationsRecordDto[];
  points: EnforcerOperationsPointDto[];
  unplacedCount: number;
  types: EnforcerOperationsTypeDto[];
} {
  const records: EnforcerOperationsRecordDto[] = [];
  const points: EnforcerOperationsPointDto[] = [];
  const types = new Map<string, EnforcerOperationsTypeDto>();
  let unplacedCount = 0;

  for (const row of rows) {
    const group = violationGroupFor(row.incidentType);
    const typeLabel = incidentTypeLabel(row.incidentType);
    const incidentDate = row.incidentDate.toISOString();
    const location = row.location?.trim() ?? "";

    if (!types.has(row.incidentType)) {
      types.set(row.incidentType, { type: row.incidentType, label: typeLabel, group });
    }

    records.push({
      id: row.id,
      type: row.incidentType,
      group,
      open: isOpenStatus(row.status),
      placeKey: normalizePlaceKey(location),
      location,
      plateNumber: row.plateNumber ?? null,
      ...manilaParts(row.incidentDate),
      incidentDate,
      status: row.status,
      vehicleType: row.vehicleType ?? null,
      createdAt: row.createdAt.toISOString(),
      closedAt: closedAt(row)?.toISOString() ?? null,
    });

    const point = resolveIncidentPoint(row);
    if (!point) {
      unplacedCount += 1;
      continue;
    }
    points.push({
      id: row.id,
      ...point,
      type: row.incidentType,
      typeLabel,
      group,
      status: row.status,
      location,
      plateNumber: row.plateNumber ?? null,
      incidentDate,
    });
  }

  return {
    records,
    points,
    unplacedCount,
    types: [...types.values()].sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export function serializeFeedItem(
  row: Pick<
    DashboardIncidentRow,
    "id" | "incidentType" | "status" | "location" | "plateNumber" | "vehicleType" | "incidentDate" | "createdAt"
  >,
): EnforcerOperationsFeedItemDto {
  return {
    id: row.id,
    type: row.incidentType,
    typeLabel: incidentTypeLabel(row.incidentType),
    group: violationGroupFor(row.incidentType),
    status: row.status,
    location: row.location,
    plateNumber: row.plateNumber ?? null,
    vehicleType: row.vehicleType ?? null,
    incidentDate: row.incidentDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
