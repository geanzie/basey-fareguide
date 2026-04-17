import { NextRequest, NextResponse } from 'next/server'

import { UserType } from '@prisma/client'

import { createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { resetStaleDailyDiscountUsage } from '@/lib/discountUsageSweep'

/**
 * POST /api/admin/sweep/daily-discount-usage
 *
 * Admin-only: resets dailyUsageCount to 0 on all DiscountCard rows whose
 * lastResetDate is from a previous UTC calendar day. Idempotent — safe to
 * call repeatedly (WHERE clause only matches cards not yet reset today).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRequestRole(request, [UserType.ADMIN])
    const resetCount = await resetStaleDailyDiscountUsage()
    return NextResponse.json({ success: true, resetCount })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
