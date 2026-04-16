import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse, verifyAuthWithSelect } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyAuthWithSelect(request, {
      assignedVehicleId: true,
    })

    if (!currentUser) {
      return createAuthErrorResponse(new Error('Unauthorized'))
    }

    if (currentUser.userType !== 'DRIVER') {
      return createAuthErrorResponse(new Error('Forbidden'))
    }

    if (!currentUser.assignedVehicleId) {
      return NextResponse.json(
        { error: 'No active vehicle assignment found for this driver account.' },
        { status: 404 },
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: currentUser.assignedVehicleId },
      select: {
        permit: {
          select: {
            permitPlateNumber: true,
            qrToken: true,
            driverFullName: true,
            status: true,
            expiryDate: true,
          },
        },
      },
    })

    if (!vehicle?.permit) {
      return NextResponse.json(
        { error: 'No permit found for the assigned vehicle.' },
        { status: 404 },
      )
    }

    if (!vehicle.permit.qrToken) {
      return NextResponse.json(
        { error: 'No QR token has been issued for this permit yet. Contact the encoder to issue one.' },
        { status: 409 },
      )
    }

    return NextResponse.json({
      permitPlateNumber: vehicle.permit.permitPlateNumber,
      qrToken: vehicle.permit.qrToken,
      driverFullName: vehicle.permit.driverFullName,
      permitStatus: vehicle.permit.status,
      permitExpiryDate: vehicle.permit.expiryDate.toISOString(),
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
