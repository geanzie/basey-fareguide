import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { TerminalScanHistoryItemDto } from '@/lib/contracts'

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString()
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString()
}

interface ScanHistoryRow {
  id: string
  scanned_at: Date
  submitted_token: string
  result_type: string
  scan_source: string
  disposition: string | null
  matched_permit_id: string | null
  permit_plate_number: string | null
  vehicle_plate_number: string | null
}

export async function listRecentTerminalScanHistory(userId: string, limit = 10): Promise<TerminalScanHistoryItemDto[]> {
  const normalizedLimit = Math.min(Math.max(limit, 1), 25)

  // Single LEFT JOIN query replaces the previous N+1 pattern (two round-trips).
  // PrismaPg sets search_path=nextjs so no schema prefix is needed.
  // Tagged template → fully parameterized, no injection risk.
  const rows = await prisma.$queryRaw<ScanHistoryRow[]>(Prisma.sql`
    SELECT
      qa.id,
      qa.scanned_at,
      qa.submitted_token,
      qa.result_type,
      qa.scan_source,
      qa.disposition,
      qa.matched_permit_id,
      p.permit_plate_number,
      v.plate_number AS vehicle_plate_number
    FROM qr_scan_audit qa
    LEFT JOIN permits p ON p.id = qa.matched_permit_id
    LEFT JOIN vehicles v ON v.id = p.vehicle_id
    WHERE qa.scanner_user_id = ${userId}
    ORDER BY qa.scanned_at DESC, qa.id DESC
    LIMIT ${normalizedLimit}
  `)

  return rows.map((row) => ({
    id: row.id,
    scannedAt: toIsoString(row.scanned_at),
    submittedToken: row.submitted_token,
    resultType: row.result_type as TerminalScanHistoryItemDto['resultType'],
    scanSource: row.scan_source as TerminalScanHistoryItemDto['scanSource'],
    disposition: row.disposition as TerminalScanHistoryItemDto['disposition'],
    matchedPermitId: row.matched_permit_id,
    permitPlateNumber: row.permit_plate_number,
    vehiclePlateNumber: row.vehicle_plate_number,
  }))
}