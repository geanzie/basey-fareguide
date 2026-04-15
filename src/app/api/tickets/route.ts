import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      message:
        'Direct ticket creation has been removed. Issue tickets from the assigned incident workflow after taking the incident and moving it into investigation.',
    },
    { status: 410 },
  )
}
