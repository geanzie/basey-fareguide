import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse, verifyAuthWithSelect } from '@/lib/auth'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'
import { prisma } from '@/lib/prisma'

function uniqueCandidates(...values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.length > 0)))]
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyAuthWithSelect(request, {
      assignedVehicleId: true,
      assignedVehicleAssignedAt: true,
    })

    if (!currentUser) {
      return createAuthErrorResponse(new Error('Unauthorized'))
    }

    if (currentUser.userType !== 'DRIVER') {
      return createAuthErrorResponse(new Error('Forbidden'))
    }

    if (!currentUser.assignedVehicleId) {
      return NextResponse.json(
        { message: 'No active vehicle assignment was found for this driver account.' },
        { status: 404 }
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: currentUser.assignedVehicleId },
      include: {
        permit: {
          select: {
            id: true,
            permitPlateNumber: true,
            qrToken: true,
            qrIssuedAt: true,
            driverFullName: true,
            status: true,
            issuedDate: true,
            expiryDate: true,
          },
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json(
        { message: 'Assigned vehicle was not found.' },
        { status: 404 }
      )
    }

    const plateCandidates = uniqueCandidates(vehicle.plateNumber, normalizePlateNumber(vehicle.plateNumber))
    const permitPlateCandidates = uniqueCandidates(
      vehicle.permit?.permitPlateNumber,
      normalizePlateNumber(vehicle.permit?.permitPlateNumber),
    )
    const incidentWhere = {
      OR: [
        { vehicleId: vehicle.id },
        { plateNumber: { in: plateCandidates } },
        { tripPlateNumber: { in: plateCandidates } },
        ...(permitPlateCandidates.length > 0
          ? [{ tripPermitPlateNumber: { in: permitPlateCandidates } }]
          : []),
      ],
    }

    const [fareCalculationCount, totalIncidents, openIncidents, unpaidTickets, outstandingPenalties, recentFareCalculations] =
      await Promise.all([
        prisma.fareCalculation.count({
          where: { vehicleId: vehicle.id },
        }),
        prisma.incident.count({
          where: incidentWhere,
        }),
        prisma.incident.count({
          where: {
            ...incidentWhere,
            status: { in: ['PENDING', 'INVESTIGATING'] },
          },
        }),
        prisma.incident.count({
          where: {
            ...incidentWhere,
            ticketNumber: { not: null },
            paymentStatus: 'UNPAID',
          },
        }),
        prisma.incident.aggregate({
          where: {
            ...incidentWhere,
            ticketNumber: { not: null },
            paymentStatus: 'UNPAID',
          },
          _sum: {
            penaltyAmount: true,
          },
        }),
        prisma.fareCalculation.findMany({
          where: { vehicleId: vehicle.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: {
            id: true,
            fromLocation: true,
            toLocation: true,
            calculatedFare: true,
            createdAt: true,
          },
        }),
      ])

    return NextResponse.json({
      driver: {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        assignedVehicleAssignedAt: currentUser.assignedVehicleAssignedAt?.toISOString() ?? null,
      },
      vehicle: {
        id: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vehicleType: vehicle.vehicleType,
        make: vehicle.make,
        model: vehicle.model,
        color: vehicle.color,
        isActive: vehicle.isActive,
        registrationExpiry: vehicle.registrationExpiry.toISOString(),
        insuranceExpiry: vehicle.insuranceExpiry?.toISOString() ?? null,
      },
      permit: vehicle.permit
        ? {
            id: vehicle.permit.id,
            permitPlateNumber: vehicle.permit.permitPlateNumber,
            driverFullName: vehicle.permit.driverFullName,
            status: vehicle.permit.status,
            issuedDate: vehicle.permit.issuedDate.toISOString(),
            expiryDate: vehicle.permit.expiryDate.toISOString(),
            qrIssuedAt: vehicle.permit.qrIssuedAt?.toISOString() ?? null,
            hasQrToken: Boolean(vehicle.permit.qrToken),
          }
        : null,
      summary: {
        fareCalculationCount,
        totalIncidents,
        openIncidents,
        unpaidTickets,
        outstandingPenalties: Number(outstandingPenalties._sum.penaltyAmount ?? 0),
      },
      recentFareCalculations: recentFareCalculations.map((calculation) => ({
        id: calculation.id,
        fromLocation: calculation.fromLocation,
        toLocation: calculation.toLocation,
        calculatedFare: Number(calculation.calculatedFare),
        createdAt: calculation.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}