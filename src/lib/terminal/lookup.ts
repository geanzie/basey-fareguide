import type {
  PermitStatus,
  QrScanResultType,
  QrScanSource,
  ScanDisposition,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { lookupPermitQrIdentity } from '@/lib/permits/qrIdentity'
import type {
  TerminalComplianceChecklistItemDto,
  TerminalComplianceStatus,
  TerminalIncidentHandoffSnapshotDto,
  TerminalLookupResultDto,
  TerminalPermitStatus,
  TerminalScanDisposition,
  TerminalViolationSummaryDto,
} from '@/lib/contracts'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function uniqueCandidates(...values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.length > 0)))]
}

function buildIncidentLookupWhere(input: {
  vehicleId: string | null
  plateNumber: string | null
  permitPlateNumber: string | null
  driverLicense: string | null
}) {
  const plateCandidates = uniqueCandidates(
    input.plateNumber,
    normalizePlateNumber(input.plateNumber),
  )
  const permitPlateCandidates = uniqueCandidates(
    input.permitPlateNumber,
    normalizePlateNumber(input.permitPlateNumber),
  )
  const whereClauses: Array<Record<string, unknown>> = []

  if (input.vehicleId) {
    whereClauses.push({ vehicleId: input.vehicleId })
  }

  if (plateCandidates.length > 0) {
    whereClauses.push({ plateNumber: { in: plateCandidates } })
    whereClauses.push({ tripPlateNumber: { in: plateCandidates } })
  }

  if (permitPlateCandidates.length > 0) {
    whereClauses.push({ tripPermitPlateNumber: { in: permitPlateCandidates } })
  }

  if (input.driverLicense) {
    whereClauses.push({ driverLicense: input.driverLicense })
  }

  return whereClauses.length === 1 ? whereClauses[0] : { OR: whereClauses }
}

function buildComplianceChecklist(input: {
  permitStatus: TerminalPermitStatus
  vehicleActive: boolean
  registrationExpiry: Date
  insuranceExpiry: Date | null
  unpaidTickets: number
  openIncidents: number
}): TerminalComplianceChecklistItemDto[] {
  return [
    {
      key: 'permit-valid',
      label: 'Permit validity',
      status: input.permitStatus === 'ACTIVE' ? 'PASS' : 'FAIL',
      detail:
        input.permitStatus === 'ACTIVE'
          ? 'Permit is active for field validation.'
          : `Permit is ${input.permitStatus.toLowerCase()}.`,
    },
    {
      key: 'vehicle-active',
      label: 'Vehicle registry status',
      status: input.vehicleActive ? 'PASS' : 'FAIL',
      detail: input.vehicleActive ? 'Vehicle is active in the registry.' : 'Vehicle is inactive in the registry.',
    },
    {
      key: 'registration-current',
      label: 'Registration expiry',
      status: input.registrationExpiry.getTime() >= Date.now() ? 'PASS' : 'FAIL',
      detail:
        input.registrationExpiry.getTime() >= Date.now()
          ? 'Vehicle registration is current.'
          : 'Vehicle registration has expired.',
    },
    {
      key: 'insurance-current',
      label: 'Insurance coverage',
      status:
        input.insuranceExpiry == null
          ? 'REVIEW'
          : input.insuranceExpiry.getTime() >= Date.now()
            ? 'PASS'
            : 'FAIL',
      detail:
        input.insuranceExpiry == null
          ? 'Insurance validity is not recorded and needs review.'
          : input.insuranceExpiry.getTime() >= Date.now()
            ? 'Vehicle insurance is current.'
            : 'Vehicle insurance has expired.',
    },
    {
      key: 'unpaid-penalties',
      label: 'Outstanding penalties',
      status: input.unpaidTickets > 0 ? 'FAIL' : 'PASS',
      detail:
        input.unpaidTickets > 0
          ? `${input.unpaidTickets} unpaid ticket(s) require settlement.`
          : 'No unpaid penalties are recorded.',
    },
    {
      key: 'open-incidents',
      label: 'Open incidents',
      status: input.openIncidents > 0 ? 'REVIEW' : 'PASS',
      detail:
        input.openIncidents > 0
          ? `${input.openIncidents} open incident(s) still need review.`
          : 'No open incidents are recorded.',
    },
  ]
}

function resolveComplianceStatus(
  checklist: TerminalComplianceChecklistItemDto[],
): TerminalComplianceStatus {
  if (checklist.some((item) => item.status === 'FAIL')) {
    return 'NON_COMPLIANT'
  }

  if (checklist.some((item) => item.status === 'REVIEW')) {
    return 'REVIEW_REQUIRED'
  }

  return 'COMPLIANT'
}

function resolveScanDisposition(
  permitStatus: TerminalPermitStatus | null,
  complianceStatus: TerminalComplianceStatus | null,
): TerminalScanDisposition {
  if (!permitStatus || !complianceStatus) {
    return 'NOT_FOUND'
  }

  if (permitStatus === 'SUSPENDED' || permitStatus === 'REVOKED') {
    return 'BLOCKED'
  }

  if (complianceStatus === 'COMPLIANT') {
    return 'CLEAR'
  }

  return 'FLAGGED'
}

export async function writeQrScanAudit(input: {
  scannerUserId?: string | null
  submittedToken: string
  matchedPermitId?: string | null
  resultType: QrScanResultType
  scanSource: QrScanSource
  disposition?: ScanDisposition | null
}) {
  return prisma.qrScanAudit.create({
    data: {
      scannerUserId: input.scannerUserId ?? null,
      submittedToken: input.submittedToken,
      matchedPermitId: input.matchedPermitId ?? null,
      resultType: input.resultType,
      scanSource: input.scanSource,
      disposition: input.disposition ?? null,
    },
  })
}

function toAuditDisposition(value: TerminalScanDisposition): ScanDisposition | null {
  if (value === 'CLEAR' || value === 'FLAGGED' || value === 'BLOCKED') {
    return value as ScanDisposition
  }

  return null
}

export async function lookupQrToken(scannedToken: string): Promise<{
  result: TerminalLookupResultDto
  audit: {
    matchedPermitId: string | null
    resultType: QrScanResultType
    disposition: ScanDisposition | null
  }
}> {
  const identity = await lookupPermitQrIdentity(scannedToken)

  if (!identity.matchFound) {
    return {
      result: {
        scannedToken: identity.normalizedToken,
        matchFound: false,
        permitStatus: null,
        complianceStatus: null,
        scanDisposition: 'NOT_FOUND',
        permit: null,
        vehicle: null,
        operator: null,
        complianceChecklist: [],
        violationSummary: null,
        incidentHandoff: null,
        message: 'No permit matched the submitted QR token.',
      },
      audit: {
        matchedPermitId: null,
        resultType: 'NOT_FOUND',
        disposition: null,
      },
    }
  }

  const incidentWhere = buildIncidentLookupWhere({
    vehicleId: identity.vehicle.id,
    plateNumber: identity.vehicle.plateNumber,
    permitPlateNumber: identity.permit.permitPlateNumber,
    driverLicense: identity.vehicle.driverLicense,
  })

  const [
    totalViolations,
    openIncidents,
    unpaidTickets,
    outstandingPenalties,
    recentViolations,
  ] = await Promise.all([
    prisma.incident.count({ where: incidentWhere }),
    prisma.incident.count({
      where: {
        ...incidentWhere,
        status: { in: ['PENDING', 'INVESTIGATING'] },
      },
    }),
    prisma.incident.count({
      where: {
        ...incidentWhere,
        ticketNumber: { not: null },
        paymentStatus: 'UNPAID',
      },
    }),
    prisma.incident.aggregate({
      where: {
        ...incidentWhere,
        ticketNumber: { not: null },
        paymentStatus: 'UNPAID',
      },
      _sum: {
        penaltyAmount: true,
      },
    }),
    prisma.incident.findMany({
      where: {
        ...incidentWhere,
        status: { in: ['PENDING', 'INVESTIGATING'] },
      },
      orderBy: [{ incidentDate: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        incidentType: true,
        status: true,
        ticketNumber: true,
        paymentStatus: true,
        penaltyAmount: true,
        incidentDate: true,
      },
    }),
  ])

  const complianceChecklist = buildComplianceChecklist({
    permitStatus: identity.permitStatus,
    vehicleActive: identity.vehicle.isActive,
    registrationExpiry: identity.vehicle.registrationExpiry,
    insuranceExpiry: identity.vehicle.insuranceExpiry,
    unpaidTickets,
    openIncidents,
  })
  const complianceStatus = resolveComplianceStatus(complianceChecklist)
  const scanDisposition = resolveScanDisposition(identity.permitStatus, complianceStatus)

  const violationSummary: TerminalViolationSummaryDto = {
    totalViolations,
    openIncidents,
    unpaidTickets,
    outstandingPenalties: Number(outstandingPenalties._sum.penaltyAmount ?? 0),
    recentViolations: recentViolations.map((incident) => ({
      id: incident.id,
      incidentType: incident.incidentType,
      incidentTypeLabel: humanizeEnum(incident.incidentType),
      status: incident.status,
      ticketNumber: incident.ticketNumber,
      paymentStatus: incident.paymentStatus,
      penaltyAmount: incident.penaltyAmount == null ? null : Number(incident.penaltyAmount),
      incidentDate: toIsoString(incident.incidentDate) ?? new Date(0).toISOString(),
    })),
  }

  const complianceFlags = complianceChecklist
    .filter((item) => item.status !== 'PASS')
    .map((item) => item.key)

  const incidentHandoff: TerminalIncidentHandoffSnapshotDto = {
    permitId: identity.permit.id,
    vehicleId: identity.vehicle.id,
    operatorId: null,
    scannedTokenFingerprint: identity.scannedTokenFingerprint,
    permitStatusAtScan: identity.permitStatus,
    complianceStatus,
    scanDispositionAtScan: scanDisposition,
    complianceFlags,
    complianceChecklistAtScan: complianceChecklist,
    violationSummary: {
      totalViolations,
      openIncidents,
      unpaidTickets,
      outstandingPenalties: Number(outstandingPenalties._sum.penaltyAmount ?? 0),
    },
    operator: {
      // Operator IDs are not yet first-class permit relations, so handoff stays snapshot-only.
      operatorId: null,
      operatorIdStatus: 'UNAVAILABLE',
      driverFullName: identity.operator.driverFullName,
      driverName: identity.operator.driverName,
      ownerName: identity.operator.ownerName,
      driverLicense: identity.operator.driverLicense,
    },
    vehicle: {
      id: identity.vehicle.id,
      plateNumber: identity.vehicle.plateNumber,
      vehicleType: identity.vehicle.vehicleType,
      make: identity.vehicle.make,
      model: identity.vehicle.model,
      color: identity.vehicle.color,
      ownerName: identity.vehicle.ownerName,
      driverName: identity.vehicle.driverName,
      driverLicense: identity.vehicle.driverLicense,
      registrationExpiry: toIsoString(identity.vehicle.registrationExpiry) ?? new Date(0).toISOString(),
      insuranceExpiry: toIsoString(identity.vehicle.insuranceExpiry),
      isActive: identity.vehicle.isActive,
    },
  }

  return {
    result: {
      scannedToken: identity.normalizedToken,
      matchFound: true,
      permitStatus: identity.permitStatus,
      complianceStatus,
      scanDisposition,
      permit: {
        id: identity.permit.id,
        permitPlateNumber: identity.permit.permitPlateNumber,
        qrToken: identity.permit.qrToken ?? identity.normalizedToken,
        qrIssuedAt: toIsoString(identity.permit.qrIssuedAt),
        qrIssuedBy: identity.permit.qrIssuedBy ?? null,
        driverFullName: identity.permit.driverFullName,
        issuedDate: toIsoString(identity.permit.issuedDate) ?? new Date(0).toISOString(),
        expiryDate: toIsoString(identity.permit.expiryDate) ?? new Date(0).toISOString(),
      },
      vehicle: incidentHandoff.vehicle,
      operator: incidentHandoff.operator,
      complianceChecklist,
      violationSummary,
      incidentHandoff,
      message:
        scanDisposition === 'CLEAR'
          ? 'Permit is clear for compliance validation.'
          : scanDisposition === 'BLOCKED'
            ? 'Permit is blocked and requires enforcement action.'
            : 'Permit matched, but compliance review is required before clearing the operator.',
    },
    audit: {
      matchedPermitId: identity.permit.id,
      resultType: 'MATCHED',
      disposition: toAuditDisposition(scanDisposition),
    },
  }
}