import { VehicleType } from "@prisma/client";

import type {
  AdminVehicleCapacitySettingsResponseDto,
  SeatCapacityMap,
  VehicleCapacitySettingsDto,
} from "@/lib/contracts";
import { serializeAdminVehicleCapacitySettings } from "@/lib/serializers";

export const VEHICLE_CAPACITY_SETTINGS_ID = "global";

/**
 * Types the municipality sells seats for. These are exactly the rider-scan
 * types: their drivers are not required to own a smartphone, so the rider
 * scans the printed permit QR and there is no driver tap to police how many
 * people climb aboard.
 *
 * A type outside this list has no ceiling and no charter option. Adding one
 * means a column on VehicleCapacitySettings and a case in the two mapping
 * helpers below — deliberately more friction than a JSON blob, because a typo
 * in a JSON key would silently read back as "no ceiling".
 */
export const CAPACITY_CONFIGURABLE_VEHICLE_TYPES: readonly VehicleType[] = [
  VehicleType.HABAL_HABAL,
  VehicleType.TRICYCLE,
];

/**
 * The standard that ships. A missing row or an unmigrated table falls back
 * here rather than to "unlimited": an over-tight ceiling costs a rider one
 * refused scan, while no ceiling at all silently re-permits the overcharge
 * this whole feature exists to catch.
 */
export const DEFAULT_SEAT_CAPACITIES: Readonly<
  Record<"HABAL_HABAL" | "TRICYCLE", number>
> = {
  HABAL_HABAL: 3,
  TRICYCLE: 6,
};

export const MIN_SEAT_CAPACITY = 1;
export const MAX_SEAT_CAPACITY = 8;

export const VEHICLE_CAPACITY_SETTINGS_MIGRATION_REQUIRED_MESSAGE =
  "Vehicle seat capacity is waiting on database migrations. Run `npx prisma migrate deploy` against the active database to enable admin updates.";

const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 180_000;

type Snapshot = Omit<AdminVehicleCapacitySettingsResponseDto, "warning">;

let cache: { value: Snapshot; expiresAt: number; staleUntil: number } | null =
  null;

// Coalesces concurrent callers during a cache miss so only one DB read fires.
let refreshPromise: Promise<Snapshot> | null = null;

type CapacityRow = {
  habalHabalCapacity: number;
  tricycleCapacity: number;
};

function rowToSeatCapacities(row: CapacityRow): SeatCapacityMap {
  return {
    [VehicleType.HABAL_HABAL]: row.habalHabalCapacity,
    [VehicleType.TRICYCLE]: row.tricycleCapacity,
  };
}

function seatCapacitiesToRow(map: SeatCapacityMap): CapacityRow {
  return {
    habalHabalCapacity:
      map[VehicleType.HABAL_HABAL] ?? DEFAULT_SEAT_CAPACITIES.HABAL_HABAL,
    tricycleCapacity:
      map[VehicleType.TRICYCLE] ?? DEFAULT_SEAT_CAPACITIES.TRICYCLE,
  };
}

function defaultSeatCapacities(): SeatCapacityMap {
  return {
    [VehicleType.HABAL_HABAL]: DEFAULT_SEAT_CAPACITIES.HABAL_HABAL,
    [VehicleType.TRICYCLE]: DEFAULT_SEAT_CAPACITIES.TRICYCLE,
  };
}

function defaultSnapshot(): Snapshot {
  return serializeAdminVehicleCapacitySettings({
    seatCapacities: defaultSeatCapacities(),
    configurableVehicleTypes: [...CAPACITY_CONFIGURABLE_VEHICLE_TYPES],
    minCapacity: MIN_SEAT_CAPACITY,
    maxCapacity: MAX_SEAT_CAPACITY,
  });
}

function cacheSnapshot(value: Snapshot, now: Date) {
  cache = {
    value,
    expiresAt: now.getTime() + CACHE_TTL_MS,
    staleUntil: now.getTime() + STALE_TTL_MS,
  };
}

/**
 * Narrows loose client input to seat-managed types and sane seat counts.
 * Anything unrecognised or out of range is dropped rather than forwarded, and
 * a dropped key falls back to the shipped standard — so a typo cannot remove a
 * ceiling, only fail to change it.
 */
export function parseSeatCapacities(input: unknown): SeatCapacityMap {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;
  const parsed: SeatCapacityMap = {};

  for (const type of CAPACITY_CONFIGURABLE_VEHICLE_TYPES) {
    const raw = source[type];
    const value = typeof raw === "number" ? raw : Number(raw);

    if (
      Number.isInteger(value) &&
      value >= MIN_SEAT_CAPACITY &&
      value <= MAX_SEAT_CAPACITY
    ) {
      parsed[type] = value;
    }
  }

  return parsed;
}

export function isVehicleCapacitySettingsTableMissingError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("vehicle_capacity_settings") ||
    message.includes("vehiclecapacitysettings")
  );
}

async function loadPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

async function readStoredSettings(): Promise<Snapshot | null> {
  const prisma = await loadPrisma();
  if (!prisma) {
    return null;
  }

  const settings = await prisma.vehicleCapacitySettings.findUnique({
    where: { id: VEHICLE_CAPACITY_SETTINGS_ID },
    include: {
      updatedByUser: {
        select: { firstName: true, lastName: true, username: true },
      },
    },
  });

  if (!settings) {
    return null;
  }

  return serializeAdminVehicleCapacitySettings({
    seatCapacities: rowToSeatCapacities(settings),
    configurableVehicleTypes: [...CAPACITY_CONFIGURABLE_VEHICLE_TYPES],
    minCapacity: MIN_SEAT_CAPACITY,
    maxCapacity: MAX_SEAT_CAPACITY,
    updatedBy: settings.updatedBy,
    updatedAt: settings.updatedAt,
    updatedByUser: settings.updatedByUser,
  });
}

async function loadFresh(now: Date): Promise<Snapshot> {
  try {
    const stored = await readStoredSettings();
    const resolved = stored ?? defaultSnapshot();
    cacheSnapshot(resolved, now);
    return resolved;
  } catch (error) {
    if (isVehicleCapacitySettingsTableMissingError(error)) {
      const fallback = defaultSnapshot();
      cacheSnapshot(fallback, now);
      return fallback;
    }
    throw error;
  }
}

/**
 * Cached read of the per-type seat standard. An admin change is picked up
 * within a minute without a deploy, and reads in between cost nothing.
 */
export async function getVehicleCapacitySettings(
  now: Date = new Date(),
): Promise<VehicleCapacitySettingsDto> {
  const nowMs = now.getTime();

  if (cache && cache.expiresAt > nowMs) {
    return cache.value;
  }

  // Stale but inside the grace window — serve stale, refresh behind it.
  if (cache && cache.staleUntil > nowMs) {
    if (!refreshPromise) {
      refreshPromise = loadFresh(new Date(nowMs)).finally(() => {
        refreshPromise = null;
      });
    }
    return cache.value;
  }

  if (!refreshPromise) {
    refreshPromise = loadFresh(new Date(nowMs)).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * The admin-set standard for a type, or null when the type is not seat-managed
 * — which means no ceiling and no charter, not a ceiling of zero.
 */
export async function getSeatCapacityStandard(
  vehicleType: VehicleType | string | null | undefined,
): Promise<number | null> {
  if (!vehicleType) {
    return null;
  }

  const settings = await getVehicleCapacitySettings();
  return settings.seatCapacities[vehicleType as VehicleType] ?? null;
}

/**
 * The seat ceiling actually in force for one vehicle.
 *
 * The per-vehicle value may only *lower* the type standard, never raise it.
 * That clamp is the security property: capacity is the charter price
 * multiplier, so an uncapped override would be a direct revenue lever for
 * whoever registers the vehicle. Errors therefore push capacity down, which
 * blocks a scan earlier — protecting the rider — rather than overcharging one.
 */
export async function resolveSeatCapacity(
  vehicleType: VehicleType | string | null | undefined,
  vehicleOverride: number | null | undefined,
): Promise<number | null> {
  const standard = await getSeatCapacityStandard(vehicleType);
  if (standard === null) {
    return null;
  }

  if (
    typeof vehicleOverride !== "number" ||
    !Number.isInteger(vehicleOverride) ||
    vehicleOverride < MIN_SEAT_CAPACITY
  ) {
    return standard;
  }

  return Math.min(vehicleOverride, standard);
}

export function invalidateVehicleCapacitySettingsCache() {
  cache = null;
  refreshPromise = null;
}

export async function getAdminVehicleCapacitySettings(
  now: Date = new Date(),
): Promise<AdminVehicleCapacitySettingsResponseDto> {
  try {
    const stored = await readStoredSettings();
    const resolved = stored ?? defaultSnapshot();
    cacheSnapshot(resolved, now);
    return resolved;
  } catch (error) {
    if (isVehicleCapacitySettingsTableMissingError(error)) {
      return {
        ...defaultSnapshot(),
        warning: VEHICLE_CAPACITY_SETTINGS_MIGRATION_REQUIRED_MESSAGE,
      };
    }
    throw error;
  }
}

export class VehicleCapacitySettingsMigrationRequiredError extends Error {
  constructor() {
    super(VEHICLE_CAPACITY_SETTINGS_MIGRATION_REQUIRED_MESSAGE);
    this.name = "VehicleCapacitySettingsMigrationRequiredError";
  }
}

/**
 * Writes the per-type standard, records who changed it, and drops the cache so
 * the next read is authoritative rather than up to a minute stale.
 *
 * Sessions already open are untouched on purpose: each snapshots its ceiling
 * at open, so lowering the standard cannot strand riders already aboard.
 */
export async function updateVehicleCapacitySettings(input: {
  seatCapacities: SeatCapacityMap;
  adminUserId: string;
}): Promise<{
  changed: boolean;
  settings: AdminVehicleCapacitySettingsResponseDto;
}> {
  const prisma = await loadPrisma();
  if (!prisma) {
    throw new VehicleCapacitySettingsMigrationRequiredError();
  }

  try {
    const existing = await prisma.vehicleCapacitySettings.findUnique({
      where: { id: VEHICLE_CAPACITY_SETTINGS_ID },
      select: { habalHabalCapacity: true, tricycleCapacity: true },
    });

    const previous: CapacityRow = existing ?? {
      habalHabalCapacity: DEFAULT_SEAT_CAPACITIES.HABAL_HABAL,
      tricycleCapacity: DEFAULT_SEAT_CAPACITIES.TRICYCLE,
    };

    // Unset keys keep their current value rather than snapping to the default,
    // so a partial PATCH cannot silently reset the type it did not mention.
    const next = seatCapacitiesToRow({
      ...rowToSeatCapacities(previous),
      ...input.seatCapacities,
    });

    const changed =
      previous.habalHabalCapacity !== next.habalHabalCapacity ||
      previous.tricycleCapacity !== next.tricycleCapacity;

    if (changed) {
      await prisma.$transaction(async (tx) => {
        await tx.vehicleCapacitySettings.upsert({
          where: { id: VEHICLE_CAPACITY_SETTINGS_ID },
          create: {
            id: VEHICLE_CAPACITY_SETTINGS_ID,
            ...next,
            updatedBy: input.adminUserId,
          },
          update: {
            ...next,
            updatedBy: input.adminUserId,
          },
        });

        await tx.vehicleCapacitySettingsAudit.create({
          data: {
            vehicleCapacitySettingsId: VEHICLE_CAPACITY_SETTINGS_ID,
            previousHabalHabalCapacity: previous.habalHabalCapacity,
            previousTricycleCapacity: previous.tricycleCapacity,
            newHabalHabalCapacity: next.habalHabalCapacity,
            newTricycleCapacity: next.tricycleCapacity,
            changedBy: input.adminUserId,
          },
        });
      });
    }

    invalidateVehicleCapacitySettingsCache();

    return {
      changed,
      settings: await getAdminVehicleCapacitySettings(),
    };
  } catch (error) {
    if (isVehicleCapacitySettingsTableMissingError(error)) {
      throw new VehicleCapacitySettingsMigrationRequiredError();
    }
    throw error;
  }
}
