import { NextRequest, NextResponse } from 'next/server'
import { clearLoginSessionCookie } from '@/lib/login'
import {
  clearTerminalUnlockCookie,
  invalidateTerminalUnlockSession,
} from '@/lib/terminal/session'

/**
 * POST /api/auth/logout
 * Logs out the user by clearing the httpOnly auth cookie
 */
export async function POST(request: NextRequest) {
  try {
    await invalidateTerminalUnlockSession(request)

    // Create response
    const response = NextResponse.json({
      message: 'Logged out successfully'
    })

    // Clear the httpOnly cookie. Shares its attributes with the login path so
    // the two can never drift and leave an uncleared cookie behind.
    clearLoginSessionCookie(response)
    clearTerminalUnlockCookie(response)

    return response
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
