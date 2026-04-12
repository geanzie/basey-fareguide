import type {
  PermitStatus,
  QrScanResultType,
  QrScanSource,
  ScanDisposition,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
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
import { fingerprintQrToken } from '@/lib/permits/qrToken'

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

function resolvePermitStatus(status: string, expiryDate: Date): TerminalPermitStatus {
  if (status === 'SUSPENDED' || status === 'REVOKED') {
    return status
  }

  if (expiryDate.getTime() < Date.now()) {
    return 'EXPIRED'
  }

  return 'ACTIVE'
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
  const normalizedToken = scannedToken.trim()

  const permit = await prisma.permit.findUnique({
    where: { qrToken: normalizedToken },
    include: {
      vehicle: true,
    },
  })

  if (!permit || !permit.vehicle) {
    return {
      result: {
        scannedToken: normalizedToken,
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

  const plateCandidates = [...new Set([
    permit.vehicle.plateNumber,
    normalizePlateNumber(permit.vehicle.plateNumber),
  ].filter((value): value is string => Boolean(value)))]

  const incidentWhere = {
    OR: [
      { vehicleId: permit.vehicleId },
      { plateNumber: { in: plateCandidates } },
    ],
  }

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
      where: incidentWhere,
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

  const permitStatus = resolvePermitStatus(permit.status, permit.expiryDate)
  const complianceChecklist = buildComplianceChecklist({
    permitStatus,
    vehicleActive: permit.vehicle.isActive,
    registrationExpiry: permit.vehicle.registrationExpiry,
    insuranceExpiry: permit.vehicle.insuranceExpiry,
    unpaidTickets,
    openIncidents,
  })
  const complianceStatus = resolveComplianceStatus(complianceChecklist)
  const scanDisposition = resolveScanDisposition(permitStatus, complianceStatus)

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
    permitId: permit.id,
    vehicleId: permit.vehicle.id,
    operatorId: null,
    scannedTokenFingerprint: fingerprintQrToken(normalizedToken),
    permitStatusAtScan: permitStatus,
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
      driverFullName: permit.driverFullName,
      driverName: permit.vehicle.driverName,
      ownerName: permit.vehicle.ownerName,
      driverLicense: permit.vehicle.driverLicense,
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
      registrationExpiry: toIsoString(permit.vehicle.registrationExpiry) ?? new Date(0).toISOString(),
      insuranceExpiry: toIsoString(permit.vehicle.insuranceExpiry),
      isActive: permit.vehicle.isActive,
    },
  }

  return {
    result: {
      scannedToken: normalizedToken,
      matchFound: true,
      permitStatus,
      complianceStatus,
      scanDisposition,
      permit: {
        id: permit.id,
        permitPlateNumber: permit.permitPlateNumber,
        qrToken: permit.qrToken ?? normalizedToken,
        qrIssuedAt: toIsoString(permit.qrIssuedAt),
        qrIssuedBy: permit.qrIssuedBy ?? null,
        driverFullName: permit.driverFullName,
        issuedDate: toIsoString(permit.issuedDate) ?? new Date(0).toISOString(),
        expiryDate: toIsoString(permit.expiryDate) ?? new Date(0).toISOString(),
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
      matchedPermitId: permit.id,
      resultType: 'MATCHED',
      disposition: toAuditDisposition(scanDisposition),
    },
  }
}