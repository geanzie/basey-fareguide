export type PermitStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';

/** Vehicle types eligible for a permit (jeepneys are not permitted vehicles). */
export const PERMIT_VEHICLE_TYPES = ['TRICYCLE', 'HABAL_HABAL'] as const;
export type PermitVehicleType = (typeof PERMIT_VEHICLE_TYPES)[number];

export interface PermitVehicleSummary {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  ownerName: string;
  vehicleType: string;
}

export interface Permit {
  id: string;
  permitPlateNumber: string;
  hasQrToken: boolean;
  qrToken: string | null;
  qrIssuedAt: string | null;
  driverFullName: string;
  vehicleType: string;
  issuedDate: string;
  expiryDate: string;
  status: string;
  remarks: string | null;
  vehicle: PermitVehicleSummary | null;
}

export interface CreatePermitInput {
  vehicleId: string;
  permitPlateNumber: string;
  driverFullName: string;
  vehicleType: string;
  remarks?: string;
}

/** Driver login account auto-provisioned by POST /api/permits. */
export interface DriverAccountResult {
  created: boolean;
  username: string;
  tempPassword?: string;
}

export type CreatePermitResult = Permit & { driverAccount?: DriverAccountResult | null };

export interface UpdatePermitInput {
  permitPlateNumber?: string;
  driverFullName?: string;
  status?: string;
  remarks?: string;
}
