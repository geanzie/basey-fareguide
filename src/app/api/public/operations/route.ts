import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import type { RiderOperationsDto } from '@/lib/contracts'
import { OPERATIONS_RANGES, isOperationsRange, rangeStart } from '@/lib/operations/period'
import {
  CLOSED_REPORT_STATUSES,
  buildCommunity,
  buildReport,
  buildTrip,
  toNumber,
  type ReportRow,
  type TripRow,
} from '@/lib/rider/operations'

/** Trips read per request. A rider takes far fewer in 90 days. */
const MAX_TRIP_ROWS = 2000
/** Community reports read per request, for the outcome and close-time aggregates. */
const MAX_COMMUNITY_ROWS = 5000

const TRIP_SELECT = {
  id: true,
  fromLocation: true,
  toLocation: true,
  distance: true,
  calculatedFare: true,
  originalFare: true,
  discountApplied: true,
  discountType: true,
  seatsPaid: true,
  createdAt: true,
  vehicle: {
    select: {
      plateNumber: true,
      vehicleType: true,
      permit: { select: { permitPlateNumber: true } },
    },
  },
} as const

const CLOSE_SELECT = {
  status: true,
  createdAt: true,
  resolvedAt: true,
  dismissedAt: true,
  referredAt: true,
} as const

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [...PUBLIC_ONLY])

    const rangeParam = new URL(request.url).searchParams.get('range') ?? '30d'
    if (!isOperationsRange(rangeParam)) {
      return NextResponse.json(
        { message: `Invalid range "${rangeParam}". Expected one of: ${OPERATIONS_RANGES.join(', ')}.` },
        { status: 400 },
      )
    }

    const now = new Date()
    const since = rangeStart(rangeParam, now)
    const previousSince = new Date(since.getTime() - (now.getTime() - since.getTime()))
    const mine = { userId: user.id }

    const [tripRows, previousTrips, periodTotals, reportRows, openReportCount, communityRows, previousCommunityCount] =
      await Promise.all([
        prisma.fareCalculation.findMany({
          where: { ...mine, createdAt: { gte: since } },
          select: TRIP_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_TRIP_ROWS + 1,
        }),
        prisma.fareCalculation.aggregate({
          where: { ...mine, createdAt: { gte: previousSince, lt: since } },
          _count: { _all: true },
          _sum: { calculatedFare: true, discountApplied: true },
        }),
        // Totals from the database, so the tiles stay right even past the row cap.
        prisma.fareCalculation.aggregate({
          where: { ...mine, createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { calculatedFare: true, discountApplied: true, distance: true },
        }),
        prisma.incident.findMany({
          where: { reportedById: user.id, createdAt: { gte: since } },
          select: {
            id: true,
            incidentType: true,
            location: true,
            ticketNumber: true,
            ...CLOSE_SELECT,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
        }),
        prisma.incident.count({
          where: { reportedById: user.id, status: { notIn: [...CLOSED_REPORT_STATUSES] } },
        }),
        prisma.incident.findMany({
          where: { createdAt: { gte: since } },
          select: CLOSE_SELECT,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MAX_COMMUNITY_ROWS,
        }),
        prisma.incident.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
      ])

    const body: RiderOperationsDto = {
      generatedAt: now.toISOString(),
      range: rangeParam,
      since: since.toISOString(),
      pulse: {
        tripCount: periodTotals._count._all,
        spent: toNumber(periodTotals._sum.calculatedFare) ?? 0,
        saved: toNumber(periodTotals._sum.discountApplied) ?? 0,
        distanceKm: toNumber(periodTotals._sum.distance) ?? 0,
        openReportCount,
      },
      trips: (tripRows as TripRow[]).slice(0, MAX_TRIP_ROWS).map(buildTrip),
      reports: (reportRows as ReportRow[]).map(buildReport),
      previousPeriodTrips: previousTrips._count._all,
      previousPeriodSpent: toNumber(previousTrips._sum.calculatedFare) ?? 0,
      previousPeriodSaved: toNumber(previousTrips._sum.discountApplied) ?? 0,
      community: buildCommunity(communityRows, previousCommunityCount, now),
      truncated: tripRows.length > MAX_TRIP_ROWS,
    }

    // Polled by the dashboard; a cached copy would miss the trip just taken.
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
