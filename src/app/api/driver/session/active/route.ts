import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse } from '@/lib/auth'
import { getDriverSessionActiveResponse, isDriverSessionError } from '@/lib/driverSession'

export async function GET(request: NextRequest) {
  try {
    const response = await getDriverSessionActiveResponse(request)
    return NextResponse.json(response)
  } catch (error) {
    if (isDriverSessionError(error)) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
    }

    return createAuthErrorResponse(error)
  }
}