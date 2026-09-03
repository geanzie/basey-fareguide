import { NextRequest, NextResponse } from 'next/server'
import { PermitStatus, VehicleType } from '@prisma/client'

import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializePermit } from '@/lib/serializers'

export const dynamic = 'force-dynamic'

const BULK_QR_CAP = 200

type BulkQrScope = 'unprinted' | 'all'

function parseScope(raw: string | null): BulkQrScope {
  return raw === 'all' ? 'all' : 'unprinted'
}

function parseIds(raw: string | null): string[] {
  if (!raw) {
    return []
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ).slice(0, BULK_QR_CAP)
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    const { searchParams } = new URL(request.url)
    const vehicleType = searchParams.get('vehicleType') as VehicleType | null
    const ids = parseIds(searchParams.get('ids'))
    // An explicit id list is the manual reprint path, so it overrides the scope filter.
    const scope: BulkQrScope = ids.length > 0 ? 'all' : parseScope(searchParams.get('scope'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      qrToken: { not: null },
      status: PermitStatus.ACTIVE,
    }

    if (ids.length > 0) {
      where.id = { in: ids }
    } else if (scope === 'unprinted') {
      where.qrPrintedAt = null
    }

    if (vehicleType) {
      where.vehicleType = vehicleType
    }

    const total = await prisma.permit.count({ where })
    const truncated = total > BULK_QR_CAP

    // The permits list only needs the queue size for its button label; skip
    // shipping 200 live QR tokens to render a number.
    if (searchParams.get('countOnly') === '1') {
      return NextResponse.json(
        { permits: [], total, truncated, scope },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
          },
        },
      )
    }

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
        scope,
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
