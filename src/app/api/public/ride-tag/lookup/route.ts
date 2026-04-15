import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { lookupPublicRideTagToken } from '@/lib/permits/qrIdentity'

export async function POST(request: NextRequest) {
  try {
    await requireRequestUser(request)

    const body = await request.json().catch(() => ({}))
    const submittedToken = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!submittedToken) {
      return NextResponse.json({ message: 'QR token is required.' }, { status: 400 })
    }

    const result = await lookupPublicRideTagToken(submittedToken)
    return NextResponse.json(result)
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}