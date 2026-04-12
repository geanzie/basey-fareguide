import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { issuePermitQrToken } from '@/lib/permits/qr'
import { serializePermit } from '@/lib/serializers'

async function getPermitForQrView(id: string) {
  return prisma.permit.findUnique({
    where: { id },
    include: {
      renewalHistory: {
        orderBy: { renewedAt: 'desc' },
      },
      vehicle: {
        select: {
          id: true,
          plateNumber: true,
          make: true,
          model: true,
          ownerName: true,
          vehicleType: true,
        },
      },
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await params

    const permit = await getPermitForQrView(id)

    if (!permit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 },
      )
    }

    if (!permit.qrToken) {
      return NextResponse.json(
        { error: 'QR token has not been issued for this permit yet' },
        { status: 409 },
      )
    }

    return NextResponse.json(
      {
        permit: serializePermit(permit, { includeQrToken: true }),
      },
      { status: 200 },
    )
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await params

    const permit = await prisma.permit.findUnique({
      where: { id },
      select: {
        id: true,
        qrToken: true,
      },
    })

    if (!permit) {
      return NextResponse.json(
        { error: 'Permit not found' },
        { status: 404 },
      )
    }

    const updatedPermit = await issuePermitQrToken({
      permitId: id,
      issuedBy: actor.id,
    })

    return NextResponse.json(
      {
        permit: serializePermit(updatedPermit, { includeQrToken: true }),
        action: permit.qrToken ? 'rotated' : 'issued',
      },
      { status: 200 },
    )
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}