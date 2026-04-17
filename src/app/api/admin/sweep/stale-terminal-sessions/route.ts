import { NextRequest, NextResponse } from 'next/server'

import { UserType } from '@prisma/client'

import { createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { expireAllStaleTerminalUnlockSessions } from '@/lib/terminal/session'

/**
 * POST /api/admin/sweep/stale-terminal-sessions
 *
 * Admin-only on-demand sweep: deletes all TerminalUnlockSession rows whose
 * expiresAt is in the past. Expired sessions are only cleaned up lazily
 * on access otherwise, so this endpoint prevents indefinite table growth.
 * Idempotent — safe to call repeatedly.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRequestRole(request, [UserType.ADMIN])
    const deletedCount = await expireAllStaleTerminalUnlockSessions()
    return NextResponse.json({ success: true, deletedCount })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
