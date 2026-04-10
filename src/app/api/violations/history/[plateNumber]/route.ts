import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'

function uniquePlateCandidates(...values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.length > 0)))]
}

function buildExactIncidentWhere(vehicleId: string | null, plateCandidates: string[]) {
  if (vehicleId) {
    return {
      OR: [
        { vehicleId },
        { plateNumber: { in: plateCandidates } },
      ],
    }
  }

  return {
    plateNumber: {
      in: plateCandidates,
    },
  }
}

function buildInsensitiveIncidentWhere(plateNumber: string) {
  return {
    plateNumber: {
      equals: plateNumber,
      mode: 'insensitive' as const,
    },
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plateNumber: string }> }
) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

    const { plateNumber } = await params

    if (!plateNumber) {
      return NextResponse.json({ message: 'Plate number is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 25,
      maxLimit: 100,
    })

    const decodedPlateNumber = decodeURIComponent(plateNumber).trim()
    const normalizedPlateNumber = normalizePlateNumber(decodedPlateNumber)

    if (!normalizedPlateNumber) {
      return NextResponse.json({ message: 'Plate number is required' }, { status: 400 })
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        plateNumber: {
          equals: normalizedPlateNumber,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        plateNumber: true,
        vehicleType: true,
        make: true,
        model: true,
        year: true,
        color: true,
        capacity: true,
        ownerName: true,
        ownerContact: true,
        driverName: true,
        driverLicense: true,
        isActive: true,
        registrationExpiry: true,
        insuranceExpiry: true,
      },
    })

    const exactPlateCandidates = uniquePlateCandidates(
      decodedPlateNumber,
      normalizedPlateNumber,
      vehicle?.plateNumber,
    )
    const exactIncidentWhere = buildExactIncidentWhere(vehicle?.id ?? null, exactPlateCandidates)
    const exactTotalViolations = await prisma.incident.count({
      where: exactIncidentWhere,
    })
    const fallbackIncidentWhere = buildInsensitiveIncidentWhere(normalizedPlateNumber)

    const shouldUseFallbackWhere = exactTotalViolations === 0
    const incidentWhere = shouldUseFallbackWhere ? fallbackIncidentWhere : exactIncidentWhere
    const totalViolations = shouldUseFallbackWhere
      ? await prisma.incident.count({ where: incidentWhere })
      : exactTotalViolations
    const resolvedPlateNumber = vehicle?.plateNumber ?? normalizedPlateNumber

    const [
      violations,
      totalPenaltiesAggregate,
      outstandingPenaltiesAggregate,
      ticketedViolations,
      resolvedTicketedViolations,
      activeTicketedViolations,
      openIncidents,
      dismissedIncidents,
    ] = await Promise.all([
      prisma.incident.findMany({
        where: incidentWhere,
        include: {
          reportedBy: {
            select: {
              firstName: true,
              lastName: true,
              username: true
            }
          },
          handledBy: {
            select: {
              firstName: true,
              lastName: true,
              username: true
            }
          },
          vehicle: {
            select: {
              plateNumber: true,
              vehicleType: true,
              make: true,
              model: true,
              year: true,
              color: true,
              ownerName: true,
              driverName: true
            }
          }
        },
        orderBy: [{ incidentDate: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.incident.aggregate({
        where: incidentWhere,
        _sum: {
          penaltyAmount: true,
        },
      }),
      prisma.incident.aggregate({
        where: {
          ...incidentWhere,
          ticketNumber: {
            not: null,
          },
          paymentStatus: 'UNPAID',
        },
        _sum: {
          penaltyAmount: true,
        },
      }),
      prisma.incident.count({
        where: {
          ...incidentWhere,
          ticketNumber: {
            not: null,
          },
          NOT: {
            status: 'DISMISSED',
          },
        },
      }),
      prisma.incident.count({
        where: {
          ...incidentWhere,
          ticketNumber: {
            not: null,
          },
          paymentStatus: 'PAID',
        },
      }),
      prisma.incident.count({
        where: {
          ...incidentWhere,
          ticketNumber: {
            not: null,
          },
          paymentStatus: 'UNPAID',
        },
      }),
      prisma.incident.count({
        where: {
          ...incidentWhere,
          ticketNumber: null,
          status: {
            in: ['PENDING', 'INVESTIGATING'],
          },
        },
      }),
      prisma.incident.count({
        where: {
          ...incidentWhere,
          status: 'DISMISSED',
        },
      }),
    ])

    const totalPenalties = Number(totalPenaltiesAggregate._sum.penaltyAmount || 0)
    const outstandingPenalties = Number(outstandingPenaltiesAggregate._sum.penaltyAmount || 0)

    return NextResponse.json({
      plateNumber: resolvedPlateNumber,
      vehicle,
      violations,
      pagination: buildPaginationMetadata(pagination, totalViolations),
      summary: {
        totalViolations,
        totalPenalties,
        outstandingPenalties,
        paidTickets: resolvedTicketedViolations,
        unpaidTickets: activeTicketedViolations,
        ticketedViolations,
        resolvedTicketedViolations,
        activeTicketedViolations,
        openIncidents,
        dismissedIncidents
      }
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
