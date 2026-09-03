import type {
  FarePolicySnapshotDto,
  FareRateDocumentDto,
  FareRateDocumentEntryDto,
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

type ActorFields = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
};

export type FareRateVersionSerializerInput = {
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
  documentKey?: string | null;
  documentTitle?: string | null;
  documentReference?: string | null;
  documentMimeType?: string | null;
  documentFileName?: string | null;
  documentSize?: number | null;
  documentUploadedAt?: Date | string | null;
  documentUploadedBy?: string | null;
  createdByUser?: ActorFields | null;
  canceledByUser?: ActorFields | null;
  documentUploadedByUser?: ActorFields | null;
};

/**
 * The document half of a version row, or null when nothing is attached.
 *
 * `documentKey` is the only field that decides whether a document exists; the
 * rest are written and cleared with it in the same update.
 */
function serializeFareRateDocument(
  input: FareRateVersionSerializerInput,
): FareRateDocumentDto | null {
  if (!input.documentKey) {
    return null;
  }

  return {
    title: input.documentTitle ?? "Supporting document",
    reference: input.documentReference ?? null,
    fileName: input.documentFileName ?? "document",
    mimeType: input.documentMimeType ?? "application/octet-stream",
    sizeBytes: input.documentSize ?? 0,
    uploadedAt: toIsoString(input.documentUploadedAt),
    uploadedByName: formatActorName(input.documentUploadedByUser),
    downloadUrl: `/api/fare-rates/${input.id}/document`,
  };
}

export function serializeFareRateVersion(
  input: FareRateVersionSerializerInput,
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
    document: serializeFareRateDocument(input),
  };
}

/**
 * A documented rate change for the About page listing.
 *
 * Returns null for a version with no document attached, so callers can filter a
 * mixed list in one pass without re-checking `documentKey` themselves.
 */
export function serializeFareRateDocumentEntry(
  input: FareRateVersionSerializerInput,
  options: {
    baseDistanceKm: number;
    now?: Date;
  },
): FareRateDocumentEntryDto | null {
  const version = serializeFareRateVersion(input, options);

  if (!version.document) {
    return null;
  }

  return {
    versionId: version.id,
    effectiveAt: version.effectiveAt,
    baseFare: version.baseFare,
    perKmRate: version.perKmRate,
    baseDistanceKm: version.baseDistanceKm,
    notes: version.notes,
    isActive: version.isActive,
    isUpcoming: version.isUpcoming,
    document: version.document,
  };
}
