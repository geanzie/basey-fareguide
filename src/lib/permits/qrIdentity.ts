import type {
  PublicRideTagLookupResultDto,
  PublicRideTagPermitDto,
  PublicRideTagVehicleDto,
  TerminalPermitStatus,
} from '@/lib/contracts'
import { prisma } from '@/lib/prisma'
import { fingerprintQrToken } from '@/lib/permits/qrToken'

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function resolvePermitStatus(status: string, expiryDate: Date): TerminalPermitStatus {
  if (status === 'SUSPENDED' || status === 'REVOKED') {
    return status
  }

  if (expiryDate.getTime() < Date.now()) {
    return 'EXPIRED'
  }

  return 'ACTIVE'
}

interface ResolvedPermitRecord {
  id: string
  permitPlateNumber: string
  qrToken: string | null
  qrIssuedAt: Date | null
  qrIssuedBy: string | null
  driverFullName: string
  vehicleType: string
  issuedDate: Date
  expiryDate: Date
  status: string
}

interface ResolvedVehicleRecord {
  id: string
  plateNumber: string
  vehicleType: string
  make: string
  model: string
  color: string
  ownerName: string
  driverName: string | null
  driverLicense: string | null
  registrationExpiry: Date
  insuranceExpiry: Date | null
  isActive: boolean
}

interface ResolvedOperatorSnapshot {
  driverFullName: string | null
  driverName: string | null
  ownerName: string | null
  driverLicense: string | null
}

interface PermitQrIdentityMatch {
  matchFound: true
  normalizedToken: string
  scannedTokenFingerprint: string
  permitStatus: TerminalPermitStatus
  permit: ResolvedPermitRecord
  vehicle: ResolvedVehicleRecord
  operator: ResolvedOperatorSnapshot
}

interface PermitQrIdentityMiss {
  matchFound: false
  normalizedToken: string
  scannedTokenFingerprint: null
  permitStatus: null
}

export type PermitQrIdentityLookupResult = PermitQrIdentityMatch | PermitQrIdentityMiss

export async function lookupPermitQrIdentity(scannedToken: string): Promise<PermitQrIdentityLookupResult> {
  const normalizedToken = scannedToken.trim()

  const permit = await prisma.permit.findUnique({
    where: { qrToken: normalizedToken },
    include: {
      vehicle: true,
    },
  })

  if (!permit || !permit.vehicle) {
    return {
      matchFound: false,
      normalizedToken,
      scannedTokenFingerprint: null,
      permitStatus: null,
    }
  }

  return {
    matchFound: true,
    normalizedToken,
    scannedTokenFingerprint: fingerprintQrToken(normalizedToken),
    permitStatus: resolvePermitStatus(permit.status, permit.expiryDate),
    permit: {
      id: permit.id,
      permitPlateNumber: permit.permitPlateNumber,
      qrToken: permit.qrToken,
      qrIssuedAt: permit.qrIssuedAt,
      qrIssuedBy: permit.qrIssuedBy,
      driverFullName: permit.driverFullName,
      vehicleType: permit.vehicleType,
      issuedDate: permit.issuedDate,
      expiryDate: permit.expiryDate,
      status: permit.status,
    },
    vehicle: {
      id: permit.vehicle.id,
      plateNumber: permit.vehicle.plateNumber,
      vehicleType: permit.vehicle.vehicleType,
      make: permit.vehicle.make,
      model: permit.vehicle.model,
      color: permit.vehicle.color,
      ownerName: permit.vehicle.ownerName,
      driverName: permit.vehicle.driverName,
      driverLicense: permit.vehicle.driverLicense,
      registrationExpiry: permit.vehicle.registrationExpiry,
      insuranceExpiry: permit.vehicle.insuranceExpiry,
      isActive: permit.vehicle.isActive,
    },
    operator: {
      driverFullName: permit.driverFullName,
      driverName: permit.vehicle.driverName,
      ownerName: permit.vehicle.ownerName,
      driverLicense: permit.vehicle.driverLicense,
    },
  }
}

function toPublicRideTagPermit(match: PermitQrIdentityMatch): PublicRideTagPermitDto {
  return {
    id: match.permit.id,
    permitPlateNumber: match.permit.permitPlateNumber,
    driverFullName: match.permit.driverFullName,
    vehicleType: match.permit.vehicleType,
    issuedDate: toIsoString(match.permit.issuedDate) ?? new Date(0).toISOString(),
    expiryDate: toIsoString(match.permit.expiryDate) ?? new Date(0).toISOString(),
    qrIssuedAt: toIsoString(match.permit.qrIssuedAt),
  }
}

function toPublicRideTagVehicle(match: PermitQrIdentityMatch): PublicRideTagVehicleDto {
  return {
    id: match.vehicle.id,
    plateNumber: match.vehicle.plateNumber,
    permitPlateNumber: match.permit.permitPlateNumber,
    vehicleType: match.vehicle.vehicleType,
    make: match.vehicle.make,
    model: match.vehicle.model,
    color: match.vehicle.color,
    driverName: match.vehicle.driverName,
  }
}

function buildPublicMatchMessage(match: PermitQrIdentityMatch): string {
  if (match.permitStatus === 'ACTIVE') {
    return 'Vehicle identity confirmed. Review it and confirm before saving this trip.'
  }

  return `Permit matched, but it is currently ${match.permitStatus.toLowerCase()}. Review the vehicle identity before continuing.`
}

export function toPublicRideTagLookupResult(
  identity: PermitQrIdentityLookupResult,
): PublicRideTagLookupResultDto {
  if (!identity.matchFound) {
    return {
      scannedToken: identity.normalizedToken,
      matchFound: false,
      permitStatus: null,
      permit: null,
      vehicle: null,
      message: 'No permit matched the submitted QR token.',
    }
  }

  return {
    scannedToken: identity.normalizedToken,
    matchFound: true,
    permitStatus: identity.permitStatus,
    permit: toPublicRideTagPermit(identity),
    vehicle: toPublicRideTagVehicle(identity),
    message: buildPublicMatchMessage(identity),
  }
}

export async function lookupPublicRideTagToken(scannedToken: string): Promise<PublicRideTagLookupResultDto> {
  const identity = await lookupPermitQrIdentity(scannedToken)
  return toPublicRideTagLookupResult(identity)
}