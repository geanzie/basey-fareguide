import { NextRequest, NextResponse } from 'next/server'
import { UserType } from '@prisma/client'

import { createAuthErrorResponse, requireRole, verifyAuth } from '@/lib/auth'
import { listRecentTerminalScanHistory } from '@/lib/terminal/history'
import {
  applyTerminalUnlockCookie,
  clearTerminalUnlockCookie,
  getTerminalUnlockSession,
  getTerminalUnlockToken,
  touchTerminalUnlockSession,
} from '@/lib/terminal/session'

function parseLimit(request: NextRequest): number {
  const requestUrl = 'nextUrl' in request && request.nextUrl ? request.nextUrl : new URL(request.url)
  const rawLimit = requestUrl.searchParams.get('limit')
  const parsedLimit = Number.parseInt(rawLimit ?? '10', 10)
  return Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10
}

export async function GET(request: NextRequest) {
  try {
    const authenticatedUser = await verifyAuth(request)
    const user = requireRole(authenticatedUser, [UserType.ENFORCER])
    const unlockSession = await getTerminalUnlockSession(request, user.id)

    if (!unlockSession) {
      const response = NextResponse.json(
        { message: 'QR terminal is locked. Unlock it again to review recent scans.' },
        { status: 403 },
      )
      clearTerminalUnlockCookie(response)
      return response
    }

    const refreshedSession = await touchTerminalUnlockSession(unlockSession.id)
    const items = await listRecentTerminalScanHistory(user.id, parseLimit(request))
    const response = NextResponse.json({ items })
    const rawUnlockToken = getTerminalUnlockToken(request)

    if (rawUnlockToken) {
      applyTerminalUnlockCookie(response, rawUnlockToken)
    }

    response.headers.set('X-Terminal-Unlock-Expires-At', refreshedSession.expiresAt.toISOString())
    return response
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}