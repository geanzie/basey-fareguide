import type {
  RoadRestrictionDto,
  RoadRestrictionGeometryDto,
  RoadRestrictionKindDto,
} from "@/lib/contracts";
import type { VehicleType } from "@prisma/client";

function toIsoString(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  return value ? toIsoString(value) : null;
}

function formatActorName(
  actor:
    | { firstName?: string | null; lastName?: string | null; username?: string | null }
    | null
    | undefined,
): string | null {
  if (!actor) return null;

  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return actor.username ? `${fullName} (@${actor.username})` : fullName;
  return actor.username ? `@${actor.username}` : null;
}

type Actor = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null;

export interface RoadRestrictionRecordInput {
  id: string;
  name: string;
  kind: RoadRestrictionKindDto;
  geometryType: RoadRestrictionGeometryDto;
  geometry: unknown;
  appliesTo: VehicleType[];
  isActive: boolean;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  note?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  createdByUser?: Actor;
  updatedByUser?: Actor;
}

export function serializeRoadRestriction(
  record: RoadRestrictionRecordInput,
  now: Date = new Date(),
): RoadRestrictionDto {
  const from = record.effectiveFrom ? new Date(record.effectiveFrom) : null;
  const to = record.effectiveTo ? new Date(record.effectiveTo) : null;

  // A row can be active but out of season, which the admin list has to show
  // differently from one that is simply switched off.
  const inEffect =
    record.isActive && (!from || from <= now) && (!to || to >= now);

  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    geometryType: record.geometryType,
    geometry: record.geometry,
    appliesTo: record.appliesTo,
    isActive: record.isActive,
    effectiveFrom: toNullableIsoString(record.effectiveFrom),
    effectiveTo: toNullableIsoString(record.effectiveTo),
    note: record.note ?? null,
    inEffect,
    createdByName: formatActorName(record.createdByUser),
    updatedByName: formatActorName(record.updatedByUser),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}
