import type {
  CuratedRouteCorpusDto,
  CuratedRouteCorpusRowDto,
  CuratedRouteDto,
  CuratedRouteSourceDto,
} from "@/lib/contracts";
import type { VehicleType } from "@prisma/client";

function toIsoString(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function formatActorName(
  actor:
    | { firstName?: string | null; lastName?: string | null; username?: string | null }
    | null
    | undefined,
): string | null {
  if (!actor) {
    return null;
  }

  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return actor.username ? `${fullName} (@${actor.username})` : fullName;
  }

  return actor.username ? `@${actor.username}` : null;
}

interface CuratedRouteEndpointRecord {
  id: string;
  name: string;
  barangay?: string | null;
}

export interface CuratedRouteRecordInput {
  id: string;
  vehicleType: VehicleType;
  distanceMeters: number;
  durationSeconds?: number | null;
  polyline?: string | null;
  isBidirectional: boolean;
  source: CuratedRouteSourceDto;
  needsSurvey: boolean;
  notes?: string | null;
  isActive: boolean;
  surveyedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  origin: CuratedRouteEndpointRecord;
  destination: CuratedRouteEndpointRecord;
  surveyedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
}

export function serializeCuratedRoute(record: CuratedRouteRecordInput): CuratedRouteDto {
  return {
    id: record.id,
    origin: {
      id: record.origin.id,
      name: record.origin.name,
      barangay: record.origin.barangay ?? null,
    },
    destination: {
      id: record.destination.id,
      name: record.destination.name,
      barangay: record.destination.barangay ?? null,
    },
    vehicleType: record.vehicleType,
    distanceMeters: record.distanceMeters,
    distanceKm: record.distanceMeters / 1000,
    durationSeconds: record.durationSeconds ?? null,
    polyline: record.polyline ?? null,
    isBidirectional: record.isBidirectional,
    source: record.source,
    needsSurvey: record.needsSurvey,
    notes: record.notes ?? null,
    isActive: record.isActive,
    surveyedAt: toIsoString(record.surveyedAt),
    surveyedByName: formatActorName(record.surveyedByUser),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

interface CuratedRouteCorpusRecordInput {
  originLocationId: string;
  destinationLocationId: string;
  vehicleType: VehicleType;
  distanceMeters: number;
  durationSeconds?: number | null;
  isBidirectional: boolean;
  updatedAt: Date | string;
}

/**
 * Pack active curated rows into the compact corpus the mobile client caches.
 *
 * Builds the id and vehicle-type dictionaries in one pass over the rows rather
 * than a separate query, so the encoding never disagrees with the data it came
 * from.
 */
export function serializeCuratedRouteCorpus(
  records: CuratedRouteCorpusRecordInput[],
): CuratedRouteCorpusDto {
  const locationIds: string[] = [];
  const locationIndex = new Map<string, number>();
  const vehicleTypes: VehicleType[] = [];
  const vehicleIndex = new Map<VehicleType, number>();

  const indexOfLocation = (id: string): number => {
    const existing = locationIndex.get(id);
    if (existing !== undefined) return existing;
    const next = locationIds.push(id) - 1;
    locationIndex.set(id, next);
    return next;
  };

  const indexOfVehicle = (vehicleType: VehicleType): number => {
    const existing = vehicleIndex.get(vehicleType);
    if (existing !== undefined) return existing;
    const next = vehicleTypes.push(vehicleType) - 1;
    vehicleIndex.set(vehicleType, next);
    return next;
  };

  let newest: number | null = null;
  const routes: CuratedRouteCorpusRowDto[] = records.map((record) => {
    const updatedAt = new Date(record.updatedAt).getTime();
    if (Number.isFinite(updatedAt) && (newest === null || updatedAt > newest)) {
      newest = updatedAt;
    }

    return [
      indexOfLocation(record.originLocationId),
      indexOfLocation(record.destinationLocationId),
      indexOfVehicle(record.vehicleType),
      record.distanceMeters,
      record.durationSeconds ?? null,
      record.isBidirectional ? 1 : 0,
    ];
  });

  return {
    locationIds,
    vehicleTypes,
    routes,
    count: routes.length,
    generatedAt: newest === null ? null : new Date(newest).toISOString(),
  };
}
