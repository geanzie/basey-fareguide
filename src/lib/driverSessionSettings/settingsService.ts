import { VehicleType } from "@prisma/client";

import type {
  AdminDriverSessionSettingsResponseDto,
  DriverSessionSettingsDto,
} from "@/lib/contracts";
import { serializeAdminDriverSessionSettings } from "@/lib/serializers";

export const DRIVER_SESSION_SETTINGS_ID = "global";

/**
 * The suspension ships on. Tricycle and habal-habal drivers in Basey are not
 * required to own a smartphone, so those trips are recorded by the rider
 * scanning the vehicle's printed permit QR instead of by a driver tapping
 * Accept. A missing row or an unmigrated table falls back to this list rather
 * than to "nothing suspended" — handing a driver a flow their phone cannot
 * serve strands the rider, while an extra suspension only costs a scan.
 */
export const DEFAULT_SUSPENDED_VEHICLE_TYPES: readonly VehicleType[] = [
  VehicleType.TRICYCLE,
  VehicleType.HABAL_HABAL,
];

export const DRIVER_SESSION_SETTINGS_MIGRATION_REQUIRED_MESSAGE =
  "Driver session suspension is waiting on database migrations. Run `npx prisma migrate deploy` against the active database to enable admin updates.";

const CACHE_TTL_MS = 60_000;
const STALE_TTL_MS = 180_000;

type Snapshot = Omit<AdminDriverSessionSettingsResponseDto, "warning">;

let cache: { value: Snapshot; expiresAt: number; staleUntil: number } | null =
  null;

// Coalesces concurrent callers during a cache miss so only one DB read fires.
let refreshPromise: Promise<Snapshot> | null = null;

export const ALL_VEHICLE_TYPES: readonly VehicleType[] =
  Object.values(VehicleType);

/**
 * Narrows loose client input to real enum members. Anything unrecognised is
 * dropped rather than forwarded, so a typo cannot silently suspend nothing.
 */
export function parseVehicleTypes(input: unknown): VehicleType[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<VehicleType>();
  for (const value of input) {
    if (
      typeof value === "string" &&
      (ALL_VEHICLE_TYPES as readonly string[]).includes(value)
    ) {
      seen.add(value as VehicleType);
    }
  }

  // Stable enum order keeps audit rows and UI comparable.
  return ALL_VEHICLE_TYPES.filter((type) => seen.has(type));
}

function defaultSnapshot(): Snapshot {
  return serializeAdminDriverSessionSettings({
    suspendedVehicleTypes: [...DEFAULT_SUSPENDED_VEHICLE_TYPES],
    availableVehicleTypes: [...ALL_VEHICLE_TYPES],
  });
}

function cacheSnapshot(value: Snapshot, now: Date) {
  cache = {
    value,
    expiresAt: now.getTime() + CACHE_TTL_MS,
    staleUntil: now.getTime() + STALE_TTL_MS,
  };
}

export function isDriverSessionSettingsTableMissingError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("driver_session_settings") ||
    message.includes("driversessionsettings")
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

  const settings = await prisma.driverSessionSettings.findUnique({
    where: { id: DRIVER_SESSION_SETTINGS_ID },
    include: {
      updatedByUser: {
        select: { firstName: true, lastName: true, username: true },
      },
    },
  });

  if (!settings) {
    return null;
  }

  return serializeAdminDriverSessionSettings({
    suspendedVehicleTypes: settings.suspendedVehicleTypes,
    availableVehicleTypes: [...ALL_VEHICLE_TYPES],
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
    if (isDriverSessionSettingsTableMissingError(error)) {
      const fallback = defaultSnapshot();
      cacheSnapshot(fallback, now);
      return fallback;
    }
    throw error;
  }
}

/**
 * Cached read of the municipal suspension list. An admin change is picked up
 * within a minute without a deploy, and reads in between cost nothing.
 */
export async function getDriverSessionSettings(
  now: Date = new Date(),
): Promise<DriverSessionSettingsDto> {
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
 * Whether the driver session flow is suspended for this vehicle type — the one
 * question every call site actually asks.
 */
export async function isDriverAcceptSuspended(
  vehicleType: VehicleType | string | null | undefined,
): Promise<boolean> {
  if (!vehicleType) {
    return false;
  }

  const settings = await getDriverSessionSettings();
  return (settings.suspendedVehicleTypes as readonly string[]).includes(
    vehicleType,
  );
}

export function invalidateDriverSessionSettingsCache() {
  cache = null;
  refreshPromise = null;
}

export async function getAdminDriverSessionSettings(
  now: Date = new Date(),
): Promise<AdminDriverSessionSettingsResponseDto> {
  try {
    const stored = await readStoredSettings();
    const resolved = stored ?? defaultSnapshot();
    cacheSnapshot(resolved, now);
    return resolved;
  } catch (error) {
    if (isDriverSessionSettingsTableMissingError(error)) {
      return {
        ...defaultSnapshot(),
        warning: DRIVER_SESSION_SETTINGS_MIGRATION_REQUIRED_MESSAGE,
      };
    }
    throw error;
  }
}

export class DriverSessionSettingsMigrationRequiredError extends Error {
  constructor() {
    super(DRIVER_SESSION_SETTINGS_MIGRATION_REQUIRED_MESSAGE);
    this.name = "DriverSessionSettingsMigrationRequiredError";
  }
}

/**
 * Writes the municipal suspension list, records who changed it, and drops the
 * cache so the next read is authoritative rather than up to a minute stale.
 */
export async function updateDriverSessionSettings(input: {
  suspendedVehicleTypes: VehicleType[];
  adminUserId: string;
}): Promise<{
  changed: boolean;
  newlySuspended: VehicleType[];
  settings: AdminDriverSessionSettingsResponseDto;
}> {
  const prisma = await loadPrisma();
  if (!prisma) {
    throw new DriverSessionSettingsMigrationRequiredError();
  }

  try {
    const existing = await prisma.driverSessionSettings.findUnique({
      where: { id: DRIVER_SESSION_SETTINGS_ID },
      select: { suspendedVehicleTypes: true },
    });

    const previous = existing?.suspendedVehicleTypes ?? [
      ...DEFAULT_SUSPENDED_VEHICLE_TYPES,
    ];
    const next = input.suspendedVehicleTypes;
    const changed =
      previous.length !== next.length ||
      previous.some((type) => !next.includes(type));

    const newlySuspended = next.filter((type) => !previous.includes(type));

    if (changed) {
      await prisma.$transaction(async (tx) => {
        await tx.driverSessionSettings.upsert({
          where: { id: DRIVER_SESSION_SETTINGS_ID },
          create: {
            id: DRIVER_SESSION_SETTINGS_ID,
            suspendedVehicleTypes: next,
            updatedBy: input.adminUserId,
          },
          update: {
            suspendedVehicleTypes: next,
            updatedBy: input.adminUserId,
          },
        });

        await tx.driverSessionSettingsAudit.create({
          data: {
            driverSessionSettingsId: DRIVER_SESSION_SETTINGS_ID,
            previousSuspendedTypes: previous,
            newSuspendedTypes: next,
            changedBy: input.adminUserId,
          },
        });
      });
    }

    invalidateDriverSessionSettingsCache();

    return {
      changed,
      newlySuspended,
      settings: await getAdminDriverSessionSettings(),
    };
  } catch (error) {
    if (isDriverSessionSettingsTableMissingError(error)) {
      throw new DriverSessionSettingsMigrationRequiredError();
    }
    throw error;
  }
}
