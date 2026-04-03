import type {
  FarePolicySnapshotDto,
  FareRateVersionDto,
} from "@/lib/contracts";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown): number {
  return Number.parseFloat(String(value));
}

function formatActorName(actor: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null | undefined): string | null {
  if (!actor) {
    return null;
  }

  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return actor.username ? `${fullName} (@${actor.username})` : fullName;
  }

  return actor.username ? `@${actor.username}` : null;
}

export function serializeFarePolicySnapshot(input: {
  versionId: string | null;
  baseDistanceKm: number;
  baseFare: unknown;
  perKmRate: unknown;
  effectiveAt: Date | string | null;
}): FarePolicySnapshotDto {
  return {
    versionId: input.versionId,
    baseDistanceKm: input.baseDistanceKm,
    baseFare: toNumber(input.baseFare),
    perKmRate: toNumber(input.perKmRate),
    effectiveAt: toIsoString(input.effectiveAt),
  };
}

export function serializeFareRateVersion(
  input: {
    id: string;
    baseFare: unknown;
    perKmRate: unknown;
    effectiveAt: Date | string;
    createdAt: Date | string;
    createdBy?: string | null;
    notes: string;
    canceledAt?: Date | string | null;
    canceledBy?: string | null;
    cancellationReason?: string | null;
    createdByUser?: {
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
    } | null;
    canceledByUser?: {
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
    } | null;
  },
  options: {
    baseDistanceKm: number;
    now?: Date;
  },
): FareRateVersionDto {
  const now = options.now ?? new Date();
  const effectiveAtDate = new Date(input.effectiveAt);
  const isCanceled = Boolean(input.canceledAt);

  return {
    id: input.id,
    baseDistanceKm: options.baseDistanceKm,
    baseFare: toNumber(input.baseFare),
    perKmRate: toNumber(input.perKmRate),
    effectiveAt: toIsoString(input.effectiveAt) ?? new Date(0).toISOString(),
    createdAt: toIsoString(input.createdAt) ?? new Date(0).toISOString(),
    createdById: input.createdBy ?? null,
    createdByName: formatActorName(input.createdByUser),
    notes: input.notes,
    canceledAt: toIsoString(input.canceledAt),
    canceledById: input.canceledBy ?? null,
    canceledByName: formatActorName(input.canceledByUser),
    cancellationReason: input.cancellationReason ?? null,
    isActive: !isCanceled && effectiveAtDate <= now,
    isUpcoming: !isCanceled && effectiveAtDate > now,
  };
}
