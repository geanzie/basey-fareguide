import type { CuratedRouteDto, CuratedRouteSourceDto } from "@/lib/contracts";
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
