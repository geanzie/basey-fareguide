import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  _request: NextRequest,
  _context: { params: Promise<{ incidentId: string }> }
) {
  return NextResponse.json(
    {
      message:
        'The take-ownership step has been removed. Scan the QR token and verify evidence to proceed.',
    },
    { status: 410 },
  )
}
