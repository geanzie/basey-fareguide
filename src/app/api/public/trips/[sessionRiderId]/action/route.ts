import { NextRequest, NextResponse } from 'next/server'

import { UserType } from '@prisma/client'

import type { RiderTripActionDto } from '@/lib/contracts'
import { createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { applyRiderTripAction, isDriverSessionError } from '@/lib/driverSession'

const RIDER_ACTIONS: readonly RiderTripActionDto[] = ['DROPPED_OFF', 'CANCELLED']

/**
 * Ends a trip the rider opened themselves by scanning the vehicle's printed
 * permit QR. On the driver-run flow these transitions belong to the driver, and
 * applyRiderTripAction refuses them here.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionRiderId: string }> },
) {
  try {
    const user = await requireRequestRole(request, [UserType.PUBLIC])

    const body = (await request.json().catch(() => ({}))) as { action?: unknown }
    const action = typeof body.action === 'string' ? body.action : ''

    if (!RIDER_ACTIONS.includes(action as RiderTripActionDto)) {
      return NextResponse.json(
        { message: 'Action must be DROPPED_OFF or CANCELLED.', code: 'INVALID_RIDER_ACTION' },
        { status: 400 },
      )
    }

    const { sessionRiderId } = await context.params
    const result = await applyRiderTripAction(user.id, sessionRiderId, action as RiderTripActionDto)

    return NextResponse.json({ success: true, status: result.status, message: result.message })
  } catch (error) {
    if (isDriverSessionError(error)) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
    }

    return createAuthErrorResponse(error)
  }
}
