import { NextRequest, NextResponse } from 'next/server'

import { UserType } from '@prisma/client'

import { createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { expireAllStalePendingRequests } from '@/lib/driverSession'

/**
 * POST /api/admin/sweep/stale-trips
 *
 * On-demand sweep for expired pending trip requests.
 * Provides a safe fallback when no background scheduler is available.
 * Idempotent — safe to call repeatedly.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestRole(request, [UserType.ADMIN])
    const expired = await expireAllStalePendingRequests()
    return NextResponse.json({ success: true, expiredCount: expired })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
