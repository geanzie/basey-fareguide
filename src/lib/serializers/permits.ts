import type { PermitDto, PermitQrPrintState } from "@/lib/contracts";

interface SerializePermitOptions {
  includeQrToken?: boolean;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializePermit(record: {
  id: string;
  permitPlateNumber: string;
  qrToken?: string | null;
  qrIssuedAt?: Date | string | null;
  qrIssuedBy?: string | null;
  qrPrintedAt?: Date | string | null;
  qrPrintedBy?: string | null;
  driverFullName: string;
  vehicleType: string;
  issuedDate: Date | string;
  expiryDate: Date | string;
  status: string;
  remarks?: string | null;
  encodedBy: string;
  encodedAt: Date | string;
  lastUpdatedBy?: string | null;
  lastUpdatedAt?: Date | string | null;
  renewalHistory?: Array<{
    id: string;
    previousExpiry: Date | string;
    newExpiry: Date | string;
    renewedBy: string;
    renewedAt: Date | string;
    notes?: string | null;
  }>;
  vehicle?: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    ownerName: string;
    vehicleType: string;
  } | null;
}, options: SerializePermitOptions = {}): PermitDto {
  const hasQrToken = Boolean(record.qrToken);
  const qrPrintedAt = toIsoString(record.qrPrintedAt);
  // Derived unconditionally: the print state is not the secret, the token is.
  // A rotated token clears qrPrintedAt, so NEEDS_PRINT also covers "reprint required".
  const qrPrintState: PermitQrPrintState = !hasQrToken
    ? "NOT_ISSUED"
    : qrPrintedAt
      ? "PRINTED"
      : "NEEDS_PRINT";

  return {
    id: record.id,
    permitPlateNumber: record.permitPlateNumber,
    hasQrToken,
    qrToken: options.includeQrToken ? record.qrToken ?? null : null,
    qrIssuedAt: toIsoString(record.qrIssuedAt),
    qrIssuedBy: record.qrIssuedBy ?? null,
    qrPrintedAt,
    qrPrintedBy: record.qrPrintedBy ?? null,
    qrPrintState,
    driverFullName: record.driverFullName,
    vehicleType: record.vehicleType,
    issuedDate: toIsoString(record.issuedDate) ?? new Date(0).toISOString(),
    expiryDate: toIsoString(record.expiryDate) ?? new Date(0).toISOString(),
    status: record.status,
    remarks: record.remarks ?? null,
    encodedBy: record.encodedBy,
    encodedAt: toIsoString(record.encodedAt) ?? new Date(0).toISOString(),
    lastUpdatedBy: record.lastUpdatedBy ?? null,
    lastUpdatedAt: toIsoString(record.lastUpdatedAt),
    renewalHistory: (record.renewalHistory ?? []).map((renewal) => ({
      id: renewal.id,
      previousExpiry: toIsoString(renewal.previousExpiry) ?? new Date(0).toISOString(),
      newExpiry: toIsoString(renewal.newExpiry) ?? new Date(0).toISOString(),
      renewedBy: renewal.renewedBy,
      renewedAt: toIsoString(renewal.renewedAt) ?? new Date(0).toISOString(),
      notes: renewal.notes ?? null,
    })),
    vehicle: record.vehicle
      ? {
          id: record.vehicle.id,
          plateNumber: record.vehicle.plateNumber,
          make: record.vehicle.make,
          model: record.vehicle.model,
          ownerName: record.vehicle.ownerName,
          vehicleType: record.vehicle.vehicleType,
        }
      : null,
  };
}
