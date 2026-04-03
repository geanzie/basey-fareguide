export interface FarePolicySnapshotDto {
  versionId: string | null;
  baseDistanceKm: number;
  baseFare: number;
  perKmRate: number;
  effectiveAt: string | null;
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

export interface FareRateMutationResponseDto {
  success: boolean;
  fareRateVersion: FareRateVersionDto;
  replacedVersionId: string | null;
  message: string;
}

export interface FareRateCancellationResponseDto {
  success: boolean;
  canceledVersionId: string;
  message: string;
}
