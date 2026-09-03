export interface FarePolicySnapshotDto {
  versionId: string | null;
  baseDistanceKm: number;
  baseFare: number;
  perKmRate: number;
  effectiveAt: string | null;
}

/**
 * The municipal issuance behind a fare rate change — the Sangguniang Bayan
 * resolution or ordinance that authorized it.
 */
export interface FareRateDocumentDto {
  title: string;
  /** e.g. "SB Resolution No. 42, Series of 2026". Null when not recorded. */
  reference: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string | null;
  uploadedByName: string | null;
  /**
   * Authenticated route that 302s to a short-lived presigned URL. Built here so
   * neither client hand-assembles the path.
   */
  downloadUrl: string;
}

export interface FareRateVersionDto {
  id: string;
  baseDistanceKm: number;
  baseFare: number;
  perKmRate: number;
  effectiveAt: string;
  createdAt: string;
  createdById: string | null;
  createdByName: string | null;
  notes: string;
  canceledAt: string | null;
  canceledById: string | null;
  canceledByName: string | null;
  cancellationReason: string | null;
  isActive: boolean;
  isUpcoming: boolean;
  document: FareRateDocumentDto | null;
}

/** One documented rate change, as listed on the About page. */
export interface FareRateDocumentEntryDto {
  versionId: string;
  effectiveAt: string;
  baseFare: number;
  perKmRate: number;
  baseDistanceKm: number;
  notes: string;
  isActive: boolean;
  isUpcoming: boolean;
  document: FareRateDocumentDto;
}

export interface FareRateDocumentsResponseDto {
  documents: FareRateDocumentEntryDto[];
}

export interface FareRatesResponseDto {
  current: FarePolicySnapshotDto;
  upcoming: FarePolicySnapshotDto | null;
}

export interface AdminFareRatesResponseDto extends FareRatesResponseDto {
  currentVersion: FareRateVersionDto | null;
  upcomingVersion: FareRateVersionDto | null;
  history: FareRateVersionDto[];
  warning?: string | null;
}
