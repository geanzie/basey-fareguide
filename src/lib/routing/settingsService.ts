import type { AdminRoutingSettingsResponseDto } from "@/lib/contracts";
import { serializeAdminRoutingSettings } from "@/lib/serializers";

export type RoutingPrimaryProvider = "ors" | "google_routes";

type RoutingSettingsSource = "database" | "environment_default";

type RoutingSettingsSnapshot = Omit<AdminRoutingSettingsResponseDto, "warning">;

type RoutingSettingsActor = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null;

type RoutingSettingsRow = {
  primaryProvider: "ORS" | "GOOGLE_ROUTES";
  updatedBy: string | null;
  updatedAt: Date;
  updatedByUser: RoutingSettingsActor;
};

const ROUTING_SETTINGS_CACHE_TTL_MS = 60_000;
const ROUTING_SETTINGS_ID = "global";

export const ROUTING_SETTINGS_MIGRATION_REQUIRED_MESSAGE =
  "Routing provider management is waiting on database migrations. Run `npx prisma migrate deploy` against the active database to enable admin updates.";

let resolvedRoutingSettingsCache:
  | {
      value: RoutingSettingsSnapshot;
      expiresAt: number;
    }
  | null = null;

export class RoutingSettingsMigrationRequiredError extends Error {
  constructor() {
    super(ROUTING_SETTINGS_MIGRATION_REQUIRED_MESSAGE);
    this.name = "RoutingSettingsMigrationRequiredError";
  }
}

function normalizeConfiguredPrimaryProvider(
  rawValue: string | null | undefined,
): RoutingPrimaryProvider {
  const normalized = rawValue?.trim().toLowerCase();

  if (
    normalized === "google_routes" ||
    normalized === "google-routes" ||
    normalized === "google routes" ||
    normalized === "google"
  ) {
    return "google_routes";
  }

  return "ors";
}

function mapStoredProviderToRuntime(
  provider: "ORS" | "GOOGLE_ROUTES",
): RoutingPrimaryProvider {
  return provider === "GOOGLE_ROUTES" ? "google_routes" : "ors";
}

function mapRuntimeProviderToStored(
  provider: RoutingPrimaryProvider,
): "ORS" | "GOOGLE_ROUTES" {
  return provider === "google_routes" ? "GOOGLE_ROUTES" : "ORS";
}

function getDatabaseDefaultSnapshot(): RoutingSettingsSnapshot {
  return serializeAdminRoutingSettings({
    primaryProvider: normalizeConfiguredPrimaryProvider(process.env.ROUTING_PROVIDER),
    source: "environment_default",
  });
}

function cacheResolvedRoutingSettings(
  value: RoutingSettingsSnapshot,
  now: Date,
) {
  resolvedRoutingSettingsCache = {
    value,
    expiresAt: now.getTime() + ROUTING_SETTINGS_CACHE_TTL_MS,
  };
}

function isRoutingSettingsTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("routing_settings") ||
    message.includes("routingsettings") ||
    message.includes("routing_settings_audit") ||
    message.includes("routingsettingsaudit")
  );
}

async function loadPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function toSnapshot(
  row: RoutingSettingsRow,
  source: RoutingSettingsSource,
): RoutingSettingsSnapshot {
  return serializeAdminRoutingSettings({
    primaryProvider: mapStoredProviderToRuntime(row.primaryProvider),
    source,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    updatedByUser: row.updatedByUser,
  });
}

async function readStoredRoutingSettings(): Promise<RoutingSettingsSnapshot | null> {
  const prisma = await loadPrisma();
  if (!prisma) {
    return null;
  }

  const settings = await prisma.routingSettings.findUnique({
    where: { id: ROUTING_SETTINGS_ID },
    include: {
      updatedByUser: {
        select: {
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },
  });

  if (!settings) {
    return null;
  }

  return toSnapshot(settings, "database");
}

export async function getResolvedRoutingSettings(
  now: Date = new Date(),
): Promise<RoutingSettingsSnapshot> {
  if (resolvedRoutingSettingsCache && resolvedRoutingSettingsCache.expiresAt > now.getTime()) {
    return resolvedRoutingSettingsCache.value;
  }

  try {
    const storedSettings = await readStoredRoutingSettings();
    const resolvedSettings = storedSettings ?? getDatabaseDefaultSnapshot();
    cacheResolvedRoutingSettings(resolvedSettings, now);
    return resolvedSettings;
  } catch (error) {
    if (isRoutingSettingsTableMissingError(error)) {
      const fallbackSettings = getDatabaseDefaultSnapshot();
      cacheResolvedRoutingSettings(fallbackSettings, now);
      return fallbackSettings;
    }

    throw error;
  }
}

export function invalidateResolvedRoutingSettingsCache() {
  resolvedRoutingSettingsCache = null;
}

export async function getAdminRoutingSettings(
  now: Date = new Date(),
): Promise<AdminRoutingSettingsResponseDto> {
  try {
    const storedSettings = await readStoredRoutingSettings();
    const resolvedSettings = storedSettings ?? getDatabaseDefaultSnapshot();
    cacheResolvedRoutingSettings(resolvedSettings, now);
    return resolvedSettings;
  } catch (error) {
    if (isRoutingSettingsTableMissingError(error)) {
      return {
        ...getDatabaseDefaultSnapshot(),
        warning: ROUTING_SETTINGS_MIGRATION_REQUIRED_MESSAGE,
      };
    }

    throw error;
  }
}

export async function updateRoutingSettings(options: {
  primaryProvider: RoutingPrimaryProvider;
  adminUserId: string;
}): Promise<{
  changed: boolean;
  settings: AdminRoutingSettingsResponseDto;
}> {
  const prisma = await loadPrisma();

  if (!prisma) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const nextPrimaryProvider = mapRuntimeProviderToStored(options.primaryProvider);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.routingSettings.findUnique({
        where: { id: ROUTING_SETTINGS_ID },
        include: {
          updatedByUser: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });

      if (existing && existing.primaryProvider === nextPrimaryProvider) {
        return {
          changed: false,
          settings: toSnapshot(existing, "database"),
        };
      }

      const settings = await tx.routingSettings.upsert({
        where: { id: ROUTING_SETTINGS_ID },
        create: {
          id: ROUTING_SETTINGS_ID,
          primaryProvider: nextPrimaryProvider,
          updatedBy: options.adminUserId,
        },
        update: {
          primaryProvider: nextPrimaryProvider,
          updatedBy: options.adminUserId,
        },
        include: {
          updatedByUser: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      });

      await tx.routingSettingsAudit.create({
        data: {
          routingSettingsId: ROUTING_SETTINGS_ID,
          previousPrimaryProvider: existing?.primaryProvider ?? null,
          newPrimaryProvider: nextPrimaryProvider,
          changedBy: options.adminUserId,
        },
      });

      return {
        changed: true,
        settings: toSnapshot(settings, "database"),
      };
    });

    invalidateResolvedRoutingSettingsCache();

    return result;
  } catch (error) {
    if (isRoutingSettingsTableMissingError(error)) {
      throw new RoutingSettingsMigrationRequiredError();
    }

    throw error;
  }
}