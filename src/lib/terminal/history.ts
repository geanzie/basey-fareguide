import { prisma } from '@/lib/prisma'
import type { TerminalScanHistoryItemDto } from '@/lib/contracts'

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString()
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString()
}

export async function listRecentTerminalScanHistory(userId: string, limit = 10): Promise<TerminalScanHistoryItemDto[]> {
  const normalizedLimit = Math.min(Math.max(limit, 1), 25)

  const audits = await prisma.qrScanAudit.findMany({
    where: {
      scannerUserId: userId,
    },
    orderBy: [{ scannedAt: 'desc' }, { id: 'desc' }],
    take: normalizedLimit,
  })

  const permitIds = [...new Set(audits.map((audit) => audit.matchedPermitId).filter((value): value is string => Boolean(value)))]

  const permits = permitIds.length > 0
    ? await prisma.permit.findMany({
        where: {
          id: { in: permitIds },
        },
        select: {
          id: true,
          permitPlateNumber: true,
          vehicle: {
            select: {
              plateNumber: true,
            },
          },
        },
      })
    : []

  const permitIndex = new Map(
    permits.map((permit) => [
      permit.id,
      {
        permitPlateNumber: permit.permitPlateNumber,
        vehiclePlateNumber: permit.vehicle?.plateNumber ?? null,
      },
    ]),
  )

  return audits.map((audit) => {
    const permitContext = audit.matchedPermitId ? permitIndex.get(audit.matchedPermitId) : null

    return {
      id: audit.id,
      scannedAt: toIsoString(audit.scannedAt),
      submittedToken: audit.submittedToken,
      resultType: audit.resultType,
      scanSource: audit.scanSource,
      disposition: audit.disposition as TerminalScanHistoryItemDto['disposition'],
      matchedPermitId: audit.matchedPermitId,
      permitPlateNumber: permitContext?.permitPlateNumber ?? null,
      vehiclePlateNumber: permitContext?.vehiclePlateNumber ?? null,
    }
  })
}