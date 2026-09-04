import type { VehicleType } from "@prisma/client";

import type {
  AdminVehicleCapacitySettingsResponseDto,
  SeatCapacityMap,
} from "@/lib/contracts";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatActorName(
  actor:
    | {
        firstName?: string | null;
        lastName?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!actor) {
    return null;
  }

  const fullName = [actor.firstName, actor.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) {
    return actor.username ? `${fullName} (@${actor.username})` : fullName;
  }

  return actor.username ? `@${actor.username}` : null;
}

export function serializeAdminVehicleCapacitySettings(input: {
  seatCapacities: SeatCapacityMap;
  configurableVehicleTypes: VehicleType[];
  minCapacity: number;
  maxCapacity: number;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
  updatedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  warning?: string | null;
}): AdminVehicleCapacitySettingsResponseDto {
  return {
    seatCapacities: input.seatCapacities,
    configurableVehicleTypes: input.configurableVehicleTypes,
    minCapacity: input.minCapacity,
    maxCapacity: input.maxCapacity,
    lastUpdatedById: input.updatedBy ?? null,
    lastUpdatedByName: formatActorName(input.updatedByUser),
    lastUpdatedAt: toIsoString(input.updatedAt),
    warning: input.warning ?? null,
  };
}
