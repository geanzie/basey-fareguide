import { NextRequest, NextResponse } from 'next/server'
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

    // Clear the httpOnly cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // Expire immediately
      path: '/'
    })
    clearTerminalUnlockCookie(response)

    return response
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
