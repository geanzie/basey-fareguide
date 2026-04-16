import { NextRequest, NextResponse } from 'next/server'

import { DriverTripSessionRiderStatus, UserType } from '@prisma/client'

import type { RiderActiveTripStatusResponseDto, RiderTripStatusDto } from '@/lib/contracts'
import { createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ACTIVE_RIDER_STATUSES = [
  DriverTripSessionRiderStatus.PENDING,
  DriverTripSessionRiderStatus.ACCEPTED,
  DriverTripSessionRiderStatus.BOARDED,
  DriverTripSessionRiderStatus.COMPLETED,
] as const

const riderStatusLabels: Record<DriverTripSessionRiderStatus, string> = {
  PENDING: 'Waiting for driver',
  ACCEPTED: 'Trip accepted',
  BOARDED: 'Trip accepted',
  COMPLETED: 'Completed',
  REJECTED_NOT_HERE: 'Not Here',
  REJECTED_FULL: 'Full',
  REJECTED_WRONG_TRIP: 'Wrong Trip',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [UserType.PUBLIC])

    const { searchParams } = new URL(request.url)
    const tripRequestId = searchParams.get('tripRequestId')
    const fareCalculationId = searchParams.get('fareCalculationId')
    const now = new Date()

    await prisma.vehicleTripSessionRider.updateMany({
      where: {
        riderUserId: user.id,
        status: DriverTripSessionRiderStatus.PENDING,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: DriverTripSessionRiderStatus.EXPIRED,
        activeRequestKey: null,
        finalisedAt: now,
      },
    })

    const whereClause = tripRequestId
      ? {
          id: tripRequestId,
          riderUserId: user.id,
          status: { in: [...ACTIVE_RIDER_STATUSES] },
        }
      : fareCalculationId
      ? { fareCalculationId, riderUserId: user.id }
      : {
          riderUserId: user.id,
          status: { in: [...ACTIVE_RIDER_STATUSES] },
        }

    const entry = await prisma.vehicleTripSessionRider.findFirst({
      where: whereClause,
      orderBy: { joinedAt: 'desc' },
      select: {
        id: true,
        fareCalculationId: true,
        status: true,
        originSnapshot: true,
        destinationSnapshot: true,
        fareSnapshot: true,
        discountTypeSnapshot: true,
        joinedAt: true,
        expiresAt: true,
        acceptedAt: true,
        boardedAt: true,
        session: {
          select: {
            vehicle: {
              select: {
                plateNumber: true,
                vehicleType: true,
              },
            },
          },
        },
      },
    })

    if ((tripRequestId || fareCalculationId) && entry && entry.id) {
      // Already scoped by riderUserId in the where clause — nothing extra needed.
    }

    if (!entry) {
      const emptyResponse: RiderActiveTripStatusResponseDto = { hasActiveTrip: false, trip: null }
      return NextResponse.json(emptyResponse)
    }

    const trip: RiderTripStatusDto = {
      id: entry.id,
      fareCalculationId: entry.fareCalculationId,
      status: entry.status as RiderTripStatusDto['status'],
      statusLabel: riderStatusLabels[entry.status],
      origin: entry.originSnapshot,
      destination: entry.destinationSnapshot,
      fare: Number(entry.fareSnapshot),
      discountType: entry.discountTypeSnapshot ?? null,
      joinedAt: entry.joinedAt.toISOString(),
      expiresAt: entry.expiresAt ? entry.expiresAt.toISOString() : null,
      acceptedAt: entry.acceptedAt ? entry.acceptedAt.toISOString() : null,
      boardedAt: entry.boardedAt ? entry.boardedAt.toISOString() : null,
      vehiclePlateNumber: entry.session.vehicle.plateNumber,
      vehicleType: entry.session.vehicle.vehicleType,
    }

    const response: RiderActiveTripStatusResponseDto = { hasActiveTrip: true, trip }
    return NextResponse.json(response)
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
