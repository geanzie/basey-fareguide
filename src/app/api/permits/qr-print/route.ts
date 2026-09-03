import { NextRequest, NextResponse } from 'next/server'

import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { markPermitQrPrinted } from '@/lib/permits/qr'
import { prisma } from '@/lib/prisma'
import { serializePermit } from '@/lib/serializers'

export const dynamic = 'force-dynamic'

const PRINT_BATCH_CAP = 200

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    const body = (await request.json().catch(() => null)) as { permitIds?: unknown } | null
    const rawIds = body?.permitIds

    if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== 'string' || id.length === 0)) {
      return NextResponse.json({ message: 'permitIds must be an array of permit ids' }, { status: 400 })
    }

    const permitIds = Array.from(new Set(rawIds as string[]))

    if (permitIds.length === 0) {
      return NextResponse.json({ message: 'At least one permit id is required' }, { status: 400 })
    }

    if (permitIds.length > PRINT_BATCH_CAP) {
      return NextResponse.json(
        { message: `A print batch cannot exceed ${PRINT_BATCH_CAP} permits` },
        { status: 400 },
      )
    }

    const { markedIds, skippedIds } = await markPermitQrPrinted({ permitIds, printedBy: actor.id })

    const permits = markedIds.length
      ? await prisma.permit.findMany({
          where: { id: { in: markedIds } },
          orderBy: { permitPlateNumber: 'asc' },
          include: {
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
      : []

    return NextResponse.json(
      {
        markedCount: markedIds.length,
        skippedCount: skippedIds.length,
        permits: permits.map((permit) => serializePermit(permit)),
      },
      { status: 200 },
    )
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
