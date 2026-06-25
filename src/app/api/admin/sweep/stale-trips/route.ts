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

/**
 * GET /api/admin/sweep/stale-trips
 *
 * Scheduled entry point for the Vercel Cron job (see frontend/vercel.json).
 * Vercel issues GET requests and, when CRON_SECRET is set, includes
 * `Authorization: Bearer <CRON_SECRET>`. Reject anything without that secret so
 * the endpoint can't be triggered anonymously.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const expired = await expireAllStalePendingRequests()
  return NextResponse.json({ success: true, expiredCount: expired })
}
