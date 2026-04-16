import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse } from '@/lib/auth'
import { getDriverSessionHistoryResponse, isDriverSessionError } from '@/lib/driverSession'

export async function GET(request: NextRequest) {
  try {
    const response = await getDriverSessionHistoryResponse(request)
    return NextResponse.json(response)
  } catch (error) {
    if (isDriverSessionError(error)) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
    }

    console.error('[/api/driver/session/history] Unexpected error:', error)
    return createAuthErrorResponse(error)
  }
}