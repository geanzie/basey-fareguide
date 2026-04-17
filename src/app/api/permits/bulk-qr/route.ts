import { NextRequest, NextResponse } from 'next/server'
import { PermitStatus, VehicleType } from '@prisma/client'

import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializePermit } from '@/lib/serializers'

export const dynamic = 'force-dynamic'

const BULK_QR_CAP = 200

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    const { searchParams } = new URL(request.url)
    const vehicleType = searchParams.get('vehicleType') as VehicleType | null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      qrToken: { not: null },
      status: PermitStatus.ACTIVE,
    }

    if (vehicleType) {
      where.vehicleType = vehicleType
    }

    const total = await prisma.permit.count({ where })
    const truncated = total > BULK_QR_CAP

    const permits = await prisma.permit.findMany({
      where,
      take: BULK_QR_CAP,
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

    return NextResponse.json(
      {
        permits: permits.map((permit) => serializePermit(permit, { includeQrToken: true })),
        total,
        truncated,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      },
    )
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
