import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuthWithSelect } from '@/lib/auth'
import { parsePaginationParams, buildPaginationMetadata } from '@/lib/api/pagination'
import type { IncidentStatus, IncidentType } from '@/lib/contracts/incidents'

export interface DriverVehicleIncidentDto {
  id: string
  type: IncidentType
  typeLabel: string
  status: IncidentStatus
  statusLabel: string
  createdAt: string
  plateNumber: string | null
  ticketNumber: string | null
  penaltyAmount: number | null
  location: string
}

function labelForType(type: string): string {
  const map: Record<string, string> = {
    FARE_OVERCHARGE: 'Fare Overcharge',
    FARE_UNDERCHARGE: 'Fare Undercharge',
    RECKLESS_DRIVING: 'Reckless Driving',
    VEHICLE_VIOLATION: 'Vehicle Violation',
    ROUTE_VIOLATION: 'Route Violation',
    OTHER: 'Other',
  }
  return map[type] ?? type
}

function labelForStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pending',
    INVESTIGATING: 'Investigating',
    TICKET_ISSUED: 'Ticket Issued',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed',
  }
  return map[status] ?? status
}

/** Strip spaces, hyphens, and uppercase for plate comparison. */
function normalizePlate(plate: string): string {
  return plate.replace(/[\s\-]/g, '').toUpperCase()
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuthWithSelect(request, { assignedVehicleId: true })

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'DRIVER') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    // No assigned vehicle → empty result
    if (!user.assignedVehicleId) {
      return NextResponse.json({ items: [], total: 0, totalPages: 0 })
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: user.assignedVehicleId },
      select: { id: true, plateNumber: true },
    })

    if (!vehicle) {
      return NextResponse.json({ items: [], total: 0, totalPages: 0 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, { defaultLimit: 10, maxLimit: 50 })

    const statusFilter = searchParams.get('status') || null
    const typeFilter = searchParams.get('type') || null
    const search = searchParams.get('search')?.trim() || null

    const normalizedPlate = normalizePlate(vehicle.plateNumber)

    const vehicleMatchClause = {
      OR: [
        { vehicleId: vehicle.id },
        { vehicleId: null, plateNumber: { not: null } },
      ],
    }

    const extraFilters: object[] = []
    if (statusFilter) extraFilters.push({ status: statusFilter })
    if (typeFilter) extraFilters.push({ incidentType: typeFilter })
    if (search) {
      extraFilters.push({
        OR: [
          { location: { contains: search, mode: 'insensitive' } },
          { ticketNumber: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    const whereClause =
      extraFilters.length > 0
        ? { AND: [vehicleMatchClause, ...extraFilters] }
        : vehicleMatchClause

    // vehicleId-first match; plate fallback for incidents without vehicleId
    const [rawIncidents, total] = await Promise.all([
      prisma.incident.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          incidentType: true,
          status: true,
          createdAt: true,
          plateNumber: true,
          ticketNumber: true,
          penaltyAmount: true,
          location: true,
          vehicleId: true,
        },
      }),
      prisma.incident.count({
        where: whereClause,
      }),
    ])

    // Apply normalized plate filter for the fallback rows in JS
    const incidents = rawIncidents.filter((inc) => {
      if (inc.vehicleId === vehicle.id) return true
      if (inc.vehicleId === null && inc.plateNumber) {
        return normalizePlate(inc.plateNumber) === normalizedPlate
      }
      return false
    })

    const items: DriverVehicleIncidentDto[] = incidents.map((inc) => ({
      id: inc.id,
      type: inc.incidentType as IncidentType,
      typeLabel: labelForType(inc.incidentType),
      status: inc.status as IncidentStatus,
      statusLabel: labelForStatus(inc.status),
      createdAt: inc.createdAt.toISOString(),
      plateNumber: inc.plateNumber ?? null,
      ticketNumber: inc.ticketNumber ?? null,
      penaltyAmount: inc.penaltyAmount ? Number(inc.penaltyAmount) : null,
      location: inc.location,
    }))

    const meta = buildPaginationMetadata(pagination, total)

    return NextResponse.json({ items, total: meta.total, totalPages: meta.totalPages })
  } catch (error) {
    console.error('[/api/driver/incidents] Unexpected error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
