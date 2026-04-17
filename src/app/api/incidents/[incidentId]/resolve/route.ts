import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  _request: NextRequest,
  _context: { params: Promise<{ incidentId: string }> }
) {
  return NextResponse.json(
    {
      message:
        'Direct resolution without payment has been removed. Issue a ticket and record confirmed full payment to resolve.',
    },
    { status: 410 },
  )
}

