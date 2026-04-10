import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { verifyAuth } from '@/lib/auth'
import { serializeIncident } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 100,
      maxLimit: 100,
    })
    
    // Get filter parameters
    const statusFilter = searchParams.get('status')
    const typeFilter = searchParams.get('type')
    const dateRangeFilter = searchParams.get('dateRange')

    // Build where clause based on user role and filters
    const whereClause: any = {}
    
    // Admins see all incidents, regular users see only their own
    if (user.userType !== 'ADMIN' && user.userType !== 'ENFORCER' && user.userType !== 'DATA_ENCODER') {
      whereClause.reportedById = user.id
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter
    }
    
    // Apply incident type filter
    if (typeFilter && typeFilter !== 'ALL') {
      whereClause.incidentType = typeFilter
    }
    
    // Apply date range filter
    if (dateRangeFilter && dateRangeFilter !== 'ALL') {
      const now = new Date()
      let startDate: Date
      
      switch (dateRangeFilter) {
        case 'TODAY':
          startDate = new Date(now.setHours(0, 0, 0, 0))
          break
        case 'WEEK':
          startDate = new Date(now.setDate(now.getDate() - 7))
          break
        case 'MONTH':
          startDate = new Date(now.setMonth(now.getMonth() - 1))
          break
        case 'YEAR':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1))
          break
        default:
          startDate = new Date(0)
      }
      
      whereClause.incidentDate = {
        gte: startDate
      }
    }

    // Fetch incidents with filters
    const [incidents, totalIncidents] = await Promise.all([
      prisma.incident.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          incidentType: true,
          description: true,
          location: true,
          fareCalculationId: true,
          tripOrigin: true,
          tripDestination: true,
          tripFare: true,
          tripDiscountType: true,
          tripCalculatedAt: true,
          tripCalculationType: true,
          tripPermitPlateNumber: true,
          tripPlateNumber: true,
          tripVehicleType: true,
          plateNumber: true,
          driverLicense: true,
          vehicleType: true,
          incidentDate: true,
          status: true,
          ticketNumber: true,
          paymentStatus: true,
          paidAt: true,
          officialReceiptNumber: true,
          penaltyAmount: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          reportedBy: {
            select: {
              firstName: true,
              lastName: true,
              userType: true
            }
          },
          handledBy: {
            select: {
              firstName: true,
              lastName: true
            }
          },
          vehicle: {
            select: {
              vehicleType: true,
              plateNumber: true
            }
          }
        }
      }),
      prisma.incident.count({
        where: whereClause
      }),
    ])

    // Format incidents for frontend
    const formattedIncidents = incidents.map((incident) =>
      serializeIncident({
        id: incident.id,
        incidentType: incident.incidentType,
        description: incident.description,
        location: incident.location,
        fareCalculationId: incident.fareCalculationId,
        tripOrigin: incident.tripOrigin,
        tripDestination: incident.tripDestination,
        tripFare: incident.tripFare ? Number(incident.tripFare) : null,
        tripDiscountType: incident.tripDiscountType,
        tripCalculatedAt: incident.tripCalculatedAt,
        tripCalculationType: incident.tripCalculationType,
        tripPermitPlateNumber: incident.tripPermitPlateNumber,
        tripPlateNumber: incident.tripPlateNumber,
        tripVehicleType: incident.tripVehicleType,
        plateNumber: incident.plateNumber || incident.vehicle?.plateNumber || null,
        driverLicense: incident.driverLicense || null,
        vehicleType: incident.vehicleType || incident.vehicle?.vehicleType || null,
        incidentDate: incident.incidentDate,
        status: incident.status,
        ticketNumber: incident.ticketNumber || null,
        paymentStatus: incident.paymentStatus,
        paidAt: incident.paidAt,
        officialReceiptNumber: incident.officialReceiptNumber,
        penaltyAmount: incident.penaltyAmount ? Number(incident.penaltyAmount) : null,
        remarks: incident.remarks,
        reportedBy: incident.reportedBy,
        handledBy: incident.handledBy,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt
      }),
    )

    return NextResponse.json({
      incidents: formattedIncidents,
      pagination: buildPaginationMetadata(pagination, totalIncidents)
    })
  } catch (error) {
    console.error('Error fetching incidents:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
