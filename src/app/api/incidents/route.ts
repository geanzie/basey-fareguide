import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    const skip = (page - 1) * limit
    
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
    const incidents = await prisma.incident.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        incidentType: true,
        description: true,
        location: true,
        plateNumber: true,
        driverLicense: true,
        vehicleType: true,
        incidentDate: true,
        status: true,
        ticketNumber: true,
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
    })

    // Get total count for pagination
    const totalIncidents = await prisma.incident.count({
      where: whereClause
    })

    // Format incidents for frontend
    const formattedIncidents = incidents.map(incident => ({
      id: incident.id,
      incidentType: incident.incidentType,
      description: incident.description,
      location: incident.location,
      plateNumber: incident.plateNumber || incident.vehicle?.plateNumber || 'N/A',
      driverLicense: incident.driverLicense || 'N/A',
      vehicleType: incident.vehicleType || incident.vehicle?.vehicleType || 'N/A',
      incidentDate: incident.incidentDate.toISOString(),
      status: incident.status,
      ticketNumber: incident.ticketNumber || null,
      penaltyAmount: incident.penaltyAmount ? Number(incident.penaltyAmount) : null,
      remarks: incident.remarks,
      reportedBy: incident.reportedBy,
      handledBy: incident.handledBy,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString()
    }))

    return NextResponse.json({
      incidents: formattedIncidents,
      pagination: {
        page,
        limit,
        total: totalIncidents,
        totalPages: Math.ceil(totalIncidents / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching incidents:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
