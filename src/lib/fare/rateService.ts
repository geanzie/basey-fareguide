import { prisma } from "@/lib/prisma";
import type {
  AdminFareRatesResponseDto,
  FarePolicySnapshotDto,
  FareRatesResponseDto,
} from "@/lib/contracts";
import { serializeFarePolicySnapshot, serializeFareRateVersion } from "@/lib/serializers";
import { DEFAULT_FARE_POLICY, FARE_BASE_DISTANCE_KM } from "@/lib/fare/policy";

export const FARE_RATE_MIGRATION_REQUIRED_MESSAGE =
  "Fare rate management is waiting on database migrations. Run `npx prisma migrate deploy` against the active database to enable version history and admin updates.";

const fareRateVersionInclude = {
  createdByUser: {
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  },
  canceledByUser: {
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  },
} as const;

function isFareRateTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("fare_rate_versions") ||
    message.includes("farerateversion")
  );
}

function buildFarePolicySnapshot(
  version:
    | {
        id: string;
        baseFare: unknown;
        perKmRate: unknown;
        effectiveAt: Date | string;
      }
    | null,
): FarePolicySnapshotDto {
  if (!version) {
    return DEFAULT_FARE_POLICY;
  }

  return serializeFarePolicySnapshot({
    versionId: version.id,
    baseDistanceKm: FARE_BASE_DISTANCE_KM,
    baseFare: version.baseFare,
    perKmRate: version.perKmRate,
    effectiveAt: version.effectiveAt,
  });
}

export async function getResolvedFareRates(now: Date = new Date()): Promise<FareRatesResponseDto> {
  let currentVersion;
  let upcomingVersion;

  try {
    [currentVersion, upcomingVersion] = await Promise.all([
      prisma.fareRateVersion.findFirst({
        where: {
          canceledAt: null,
          effectiveAt: {
            lte: now,
          },
        },
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.fareRateVersion.findFirst({
        where: {
          canceledAt: null,
          effectiveAt: {
            gt: now,
          },
        },
        orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
      }),
    ]);
  } catch (error) {
    if (isFareRateTableMissingError(error)) {
      return {
        current: DEFAULT_FARE_POLICY,
        upcoming: null,
      };
    }

    throw error;
  }

  return {
    current: buildFarePolicySnapshot(currentVersion),
    upcoming: upcomingVersion ? buildFarePolicySnapshot(upcomingVersion) : null,
  };
}

export async function getAdminFareRates(now: Date = new Date()): Promise<AdminFareRatesResponseDto> {
  let resolved;
  let currentVersion;
  let upcomingVersion;
  let history;

  try {
    [resolved, currentVersion, upcomingVersion, history] = await Promise.all([
      getResolvedFareRates(now),
      prisma.fareRateVersion.findFirst({
        where: {
          canceledAt: null,
          effectiveAt: {
            lte: now,
          },
        },
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
        include: fareRateVersionInclude,
      }),
      prisma.fareRateVersion.findFirst({
        where: {
          canceledAt: null,
          effectiveAt: {
            gt: now,
          },
        },
        orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
        include: fareRateVersionInclude,
      }),
      prisma.fareRateVersion.findMany({
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
        include: fareRateVersionInclude,
      }),
    ]);
  } catch (error) {
    if (isFareRateTableMissingError(error)) {
      return {
        current: DEFAULT_FARE_POLICY,
        upcoming: null,
        currentVersion: null,
        upcomingVersion: null,
        history: [],
        warning: FARE_RATE_MIGRATION_REQUIRED_MESSAGE,
      };
    }

    throw error;
  }

  return {
    ...resolved,
    currentVersion: currentVersion
      ? serializeFareRateVersion(currentVersion, {
          baseDistanceKm: FARE_BASE_DISTANCE_KM,
          now,
        })
      : null,
    upcomingVersion: upcomingVersion
      ? serializeFareRateVersion(upcomingVersion, {
          baseDistanceKm: FARE_BASE_DISTANCE_KM,
          now,
        })
      : null,
    history: history.map((version) =>
      serializeFareRateVersion(version, {
        baseDistanceKm: FARE_BASE_DISTANCE_KM,
        now,
      }),
    ),
    warning: null,
  };
}
