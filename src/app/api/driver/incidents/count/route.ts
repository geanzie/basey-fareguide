import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithSelect } from '@/lib/auth'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuthWithSelect(request, { assignedVehicleId: true })

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'DRIVER') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    if (!user.assignedVehicleId) {
      return NextResponse.json({ count: 0 })
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: user.assignedVehicleId },
      select: { id: true, plateNumber: true },
    })

    if (!vehicle) {
      return NextResponse.json({ count: 0 })
    }

    const normalizedPlate = normalizePlateNumber(vehicle.plateNumber) ?? vehicle.plateNumber

    // vehicleId match: use count() directly (cheap)
    const vehicleIdCount = await prisma.incident.count({
      where: {
        vehicleId: vehicle.id,
        status: { in: ['PENDING', 'TICKET_ISSUED'] },
      },
    })

    // Plate fallback: incidents without vehicleId — fetch only id + plateNumber to filter
    const plateFallbackRows = await prisma.incident.findMany({
      where: {
        vehicleId: null,
        plateNumber: { not: null },
        status: { in: ['PENDING', 'TICKET_ISSUED'] },
      },
      select: { plateNumber: true },
    })

    const plateFallbackCount = plateFallbackRows.filter(
      (r) => r.plateNumber && (normalizePlateNumber(r.plateNumber) ?? r.plateNumber) === normalizedPlate,
    ).length

    return NextResponse.json({ count: vehicleIdCount + plateFallbackCount })
  } catch (error) {
    console.error('[/api/driver/incidents/count] Unexpected error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
