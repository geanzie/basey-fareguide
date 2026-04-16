import { NextRequest, NextResponse } from 'next/server'

import { DriverTripSessionRiderStatus, UserType } from '@prisma/client'

import type { RiderActiveTripStatusResponseDto, RiderTripStatusDto } from '@/lib/contracts'
import { createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ACTIVE_RIDER_STATUSES = [
  DriverTripSessionRiderStatus.PENDING,
  DriverTripSessionRiderStatus.ACCEPTED,
  DriverTripSessionRiderStatus.BOARDED,
] as const

const riderStatusLabels: Record<DriverTripSessionRiderStatus, string> = {
  PENDING: 'Waiting for driver',
  ACCEPTED: 'Trip accepted',
  BOARDED: 'Boarded',
  COMPLETED: 'Completed',
  REJECTED_NOT_HERE: 'Not Here',
  REJECTED_FULL: 'Full',
  REJECTED_WRONG_TRIP: 'Wrong Trip',
  CANCELLED: 'Cancelled',
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [UserType.PUBLIC])

    const { searchParams } = new URL(request.url)
    const fareCalculationId = searchParams.get('fareCalculationId')

    const whereClause = fareCalculationId
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
        acceptedAt: true,
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

    // Explicit ownership check when fareCalculationId is provided
    if (fareCalculationId && entry && entry.id) {
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
      acceptedAt: entry.acceptedAt ? entry.acceptedAt.toISOString() : null,
      vehiclePlateNumber: entry.session.vehicle.plateNumber,
      vehicleType: entry.session.vehicle.vehicleType,
    }

    const response: RiderActiveTripStatusResponseDto = { hasActiveTrip: true, trip }
    return NextResponse.json(response)
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
