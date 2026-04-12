import { NextRequest, NextResponse } from 'next/server'
import { UserType } from '@prisma/client'

import {
  createAuthErrorResponse,
  requireRole,
  verifyAuth,
} from '@/lib/auth'
import { lookupQrToken, writeQrScanAudit } from '@/lib/terminal/lookup'
import {
  applyTerminalUnlockCookie,
  clearTerminalUnlockCookie,
  getTerminalUnlockSession,
  getTerminalUnlockToken,
  touchTerminalUnlockSession,
} from '@/lib/terminal/session'

function resolveScanSource(value: unknown): 'CAMERA' | 'MANUAL' {
  return value === 'CAMERA' ? 'CAMERA' : 'MANUAL'
}

export async function POST(request: NextRequest) {
  let submittedToken = ''
  let scanSource: 'CAMERA' | 'MANUAL' = 'MANUAL'
  const authenticatedUser = await verifyAuth(request)

  try {
    const body = await request.json()
    submittedToken = typeof body?.token === 'string' ? body.token.trim() : ''
    scanSource = resolveScanSource(body?.scanSource)

    if (!submittedToken) {
      return NextResponse.json({ message: 'QR token is required.' }, { status: 400 })
    }

    const user = requireRole(authenticatedUser, [UserType.ENFORCER])
    const unlockSession = await getTerminalUnlockSession(request, user.id)

    if (!unlockSession) {
      await writeQrScanAudit({
        scannerUserId: user.id,
        submittedToken,
        resultType: 'UNAUTHORIZED',
        scanSource,
      })

      const response = NextResponse.json(
        { message: 'QR terminal is locked. Unlock it again to continue scanning.' },
        { status: 403 },
      )
      clearTerminalUnlockCookie(response)

      return response
    }

    const refreshedSession = await touchTerminalUnlockSession(unlockSession.id)
    const { result, audit } = await lookupQrToken(submittedToken)

    await writeQrScanAudit({
      scannerUserId: user.id,
      submittedToken,
      matchedPermitId: audit.matchedPermitId,
      resultType: audit.resultType,
      scanSource,
      disposition: audit.disposition,
    })

    const response = NextResponse.json(result)
    const rawUnlockToken = getTerminalUnlockToken(request)

    if (rawUnlockToken) {
      applyTerminalUnlockCookie(response, rawUnlockToken)
    }

    response.headers.set('X-Terminal-Unlock-Expires-At', refreshedSession.expiresAt.toISOString())
    return response
  } catch (error) {
    if (submittedToken) {
      await writeQrScanAudit({
        scannerUserId: authenticatedUser?.id ?? null,
        submittedToken,
        resultType: error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')
          ? 'UNAUTHORIZED'
          : 'ERROR',
        scanSource,
      }).catch(() => {})
    }

    return createAuthErrorResponse(error)
  }
}