import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import type { EnforcerOperationsDto } from '@/lib/contracts'
import {
  ENFORCER_OPERATIONS_RANGES,
  buildDashboardRecords,
  isEnforcerOperationsRange,
  manilaMidnight,
  rangeStart,
  serializeFeedItem,
} from '@/lib/incidents/dashboard'
import { OPEN_INCIDENT_STATUSES } from '@/lib/incidents/dashboardGroups'

/** Rows read per request. 90 days in Basey is far below this today. */
const MAX_RANGE_ROWS = 5000
const FEED_LIMIT = 15

const INCIDENT_SELECT = {
  id: true,
  incidentType: true,
  status: true,
  location: true,
  coordinates: true,
  tripOrigin: true,
  plateNumber: true,
  vehicleType: true,
  incidentDate: true,
  createdAt: true,
  resolvedAt: true,
  dismissedAt: true,
  referredAt: true,
  vehicle: { select: { plateNumber: true, vehicleType: true } },
} as const

type SelectedIncident = {
  id: string
  incidentType: string
  status: string
  location: string
  coordinates: string | null
  tripOrigin: string | null
  plateNumber: string | null
  vehicleType: string | null
  incidentDate: Date
  createdAt: Date
  resolvedAt: Date | null
  dismissedAt: Date | null
  referredAt: Date | null
  vehicle: { plateNumber: string; vehicleType: string } | null
}

function flatten(row: SelectedIncident) {
  return {
    ...row,
    plateNumber: row.plateNumber || row.vehicle?.plateNumber || null,
    vehicleType: row.vehicleType || row.vehicle?.vehicleType || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

    const rangeParam = new URL(request.url).searchParams.get('range') ?? '7d'
    if (!isEnforcerOperationsRange(rangeParam)) {
      return NextResponse.json(
        { message: `Invalid range "${rangeParam}". Expected one of: ${ENFORCER_OPERATIONS_RANGES.join(', ')}.` },
        { status: 400 },
      )
    }

    const now = new Date()
    const since = rangeStart(rangeParam, now)
    const openStatuses = [...OPEN_INCIDENT_STATUSES]
    const previousSince = new Date(since.getTime() - (now.getTime() - since.getTime()))

    const [rangeRows, previousPeriodCount, feedRows, openCount, pendingCount, awaitingPaymentCount, referredCount, newTodayCount, oldestOpen] =
      await Promise.all([
        prisma.incident.findMany({
          where: { incidentDate: { gte: since } },
          select: INCIDENT_SELECT,
          orderBy: [{ incidentDate: 'desc' }, { id: 'desc' }],
          take: MAX_RANGE_ROWS + 1,
        }),
        prisma.incident.count({ where: { incidentDate: { gte: previousSince, lt: since } } }),
        prisma.incident.findMany({
          select: INCIDENT_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: FEED_LIMIT,
        }),
        prisma.incident.count({ where: { status: { in: openStatuses } } }),
        prisma.incident.count({ where: { status: { in: ['PENDING', 'INVESTIGATING'] } } }),
        prisma.incident.count({ where: { status: 'TICKET_ISSUED', paymentStatus: 'UNPAID' } }),
        prisma.incident.count({ where: { status: 'REFERRED_FOR_FRANCHISE_ACTION' } }),
        prisma.incident.count({ where: { createdAt: { gte: manilaMidnight(now) } } }),
        prisma.incident.findFirst({
          where: { status: { in: openStatuses } },
          select: { incidentDate: true },
          orderBy: [{ incidentDate: 'asc' }, { id: 'asc' }],
        }),
      ])

    const truncated = rangeRows.length > MAX_RANGE_ROWS
    const rows = (rangeRows as SelectedIncident[]).slice(0, MAX_RANGE_ROWS).map(flatten)
    const { records, points, unplacedCount, types } = buildDashboardRecords(rows)

    const body: EnforcerOperationsDto = {
      generatedAt: now.toISOString(),
      range: rangeParam,
      since: since.toISOString(),
      pulse: {
        openCount,
        pendingCount,
        awaitingPaymentCount,
        referredCount,
        newTodayCount,
        oldestOpenAt: oldestOpen?.incidentDate.toISOString() ?? null,
      },
      feed: (feedRows as SelectedIncident[]).map(flatten).map(serializeFeedItem),
      records,
      points,
      unplacedCount,
      previousPeriodCount,
      truncated,
      types,
    }

    // Refetched whenever the control center sees a new report; a cached copy
    // would show a stale queue next to live action buttons.
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
