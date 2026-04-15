import { NextRequest, NextResponse } from 'next/server'

import type { DriverSessionActionRequestDto } from '@/lib/contracts'
import { createAuthErrorResponse } from '@/lib/auth'
import { applyDriverSessionAction, isDriverSessionError } from '@/lib/driverSession'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string; sessionRiderId: string }> },
) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<DriverSessionActionRequestDto>
    const action = typeof body.action === 'string' ? body.action : ''

    if (!action) {
      return NextResponse.json({ message: 'Action is required.' }, { status: 400 })
    }

    const { sessionId, sessionRiderId } = await context.params
    const response = await applyDriverSessionAction(request, sessionId, sessionRiderId, action)
    return NextResponse.json(response)
  } catch (error) {
    if (isDriverSessionError(error)) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
    }

    return createAuthErrorResponse(error)
  }
}