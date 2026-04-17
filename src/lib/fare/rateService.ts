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

type FareRateVersionClient = Pick<typeof prisma, "fareRateVersion">;

export const fareRateVersionInclude = {
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

const FARE_RATE_CACHE_TTL_MS = 60_000;
const FARE_RATE_STALE_TTL_MS = 120_000;

let resolvedFareRatesCache:
  | {
      value: FareRatesResponseDto;
      expiresAt: number;
      staleUntil: number;
    }
  | null = null;

// Coalesces concurrent callers during a cache miss so only one DB fetch fires.
let fareRateRefreshPromise: Promise<FareRatesResponseDto> | null = null;

export function isFareRateStorageMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("fare_rate_versions") ||
    message.includes("farerateversion") ||
    message.includes("fare_rate_deletion_audit") ||
    message.includes("fareratedeletionaudit")
  );
}

export function isCurrentLiveFareRateVersion(
  version:
    | {
        effectiveAt: Date | string;
        canceledAt?: Date | string | null;
      }
    | null,
  now: Date = new Date(),
): boolean {
  if (!version || version.canceledAt) {
    return false;
  }

  return new Date(version.effectiveAt) <= now;
}

export function isDeletableFareRateVersion(
  version:
    | {
        effectiveAt: Date | string;
        canceledAt?: Date | string | null;
      }
    | null,
  now: Date = new Date(),
): boolean {
  return Boolean(version) && !isCurrentLiveFareRateVersion(version, now);
}

export async function getCurrentLiveFareRateVersion(
  client: FareRateVersionClient = prisma,
  now: Date = new Date(),
) {
  return client.fareRateVersion.findFirst({
    where: {
      canceledAt: null,
      effectiveAt: {
        lte: now,
      },
    },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    include: fareRateVersionInclude,
  });
}

export async function getUpcomingFareRateVersion(
  client: FareRateVersionClient = prisma,
  now: Date = new Date(),
) {
  return client.fareRateVersion.findFirst({
    where: {
      canceledAt: null,
      effectiveAt: {
        gt: now,
      },
    },
    orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
    include: fareRateVersionInclude,
  });
}

export async function getPreviousEligibleFareRateVersion(
  currentVersion: {
    effectiveAt: Date | string;
  },
  client: FareRateVersionClient = prisma,
) {
  return client.fareRateVersion.findFirst({
    where: {
      canceledAt: null,
      effectiveAt: {
        lt: new Date(currentVersion.effectiveAt),
      },
    },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    include: fareRateVersionInclude,
  });
}

export async function getFareRateVersionById(
  id: string,
  client: FareRateVersionClient = prisma,
) {
  return client.fareRateVersion.findUnique({
    where: { id },
    include: fareRateVersionInclude,
  });
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
  const nowMs = now.getTime();

  // Fresh — return immediately.
  if (resolvedFareRatesCache && resolvedFareRatesCache.expiresAt > nowMs) {
    return resolvedFareRatesCache.value;
  }

  // Stale but within grace window — serve stale and kick off a background
  // refresh (coalesced so at most one concurrent DB fetch runs).
  if (resolvedFareRatesCache && resolvedFareRatesCache.staleUntil > nowMs) {
    if (!fareRateRefreshPromise) {
      fareRateRefreshPromise = loadFreshFareRates(new Date(nowMs)).finally(() => {
        fareRateRefreshPromise = null;
      });
    }
    return resolvedFareRatesCache.value;
  }

  // Fully expired — coalesce concurrent callers into a single DB fetch.
  if (!fareRateRefreshPromise) {
    fareRateRefreshPromise = loadFreshFareRates(new Date(nowMs)).finally(() => {
      fareRateRefreshPromise = null;
    });
  }
  return fareRateRefreshPromise;
}

async function loadFreshFareRates(now: Date): Promise<FareRatesResponseDto> {
  let currentVersion;
  let upcomingVersion;

  try {
    [currentVersion, upcomingVersion] = await Promise.all([
      getCurrentLiveFareRateVersion(prisma, now),
      getUpcomingFareRateVersion(prisma, now),
    ]);
  } catch (error) {
    if (isFareRateStorageMissingError(error)) {
      const fallbackValue = {
        current: DEFAULT_FARE_POLICY,
        upcoming: null,
      };

      resolvedFareRatesCache = {
        value: fallbackValue,
        expiresAt: now.getTime() + FARE_RATE_CACHE_TTL_MS,
        staleUntil: now.getTime() + FARE_RATE_STALE_TTL_MS,
      };

      return fallbackValue;
    }

    throw error;
  }

  const resolvedFareRates = {
    current: buildFarePolicySnapshot(currentVersion),
    upcoming: upcomingVersion ? buildFarePolicySnapshot(upcomingVersion) : null,
  };

  resolvedFareRatesCache = {
    value: resolvedFareRates,
    expiresAt: now.getTime() + FARE_RATE_CACHE_TTL_MS,
    staleUntil: now.getTime() + FARE_RATE_STALE_TTL_MS,
  };

  return resolvedFareRates;
}

export function invalidateResolvedFareRatesCache() {
  resolvedFareRatesCache = null;
  fareRateRefreshPromise = null;
}

export async function getAdminFareRates(now: Date = new Date()): Promise<AdminFareRatesResponseDto> {
  let resolved;
  let currentVersion;
  let upcomingVersion;
  let history;

  try {
    [resolved, currentVersion, upcomingVersion, history] = await Promise.all([
      getResolvedFareRates(now),
      getCurrentLiveFareRateVersion(prisma, now),
      getUpcomingFareRateVersion(prisma, now),
      prisma.fareRateVersion.findMany({
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
        include: fareRateVersionInclude,
      }),
    ]);
  } catch (error) {
    if (isFareRateStorageMissingError(error)) {
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
