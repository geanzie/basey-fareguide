import type { VehicleType } from '@prisma/client'

import type { TerminalPermitStatus } from './terminal'

export interface PublicRideTagPermitDto {
  id: string
  permitPlateNumber: string
  driverFullName: string
  vehicleType: VehicleType | string
  issuedDate: string
  expiryDate: string
  qrIssuedAt: string | null
}

export interface PublicRideTagVehicleDto {
  id: string
  plateNumber: string
  permitPlateNumber: string | null
  vehicleType: VehicleType | string
  make: string
  model: string
  color: string
  driverName: string | null
}

export interface PublicRideTagLookupResultDto {
  scannedToken: string
  matchFound: boolean
  permitStatus: TerminalPermitStatus | null
  permit: PublicRideTagPermitDto | null
  vehicle: PublicRideTagVehicleDto | null
  message: string
}