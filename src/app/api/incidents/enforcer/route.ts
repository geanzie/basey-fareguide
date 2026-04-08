import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { serializeIncident } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ENFORCER_ONLY])

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days') || '30'
    const filter = searchParams.get('filter') || 'all'

    // Calculate date range
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(days))

    // Build where clause
    // Date filter only applies to RESOLVED incidents
    // PENDING and INVESTIGATING incidents should always be visible
    const whereClause: any = {
      OR: [
        {
          // Show pending and investigating incidents regardless of age
          status: { in: ['PENDING', 'INVESTIGATING'] }
        },
        {
          // Show resolved incidents within the date range
          status: 'RESOLVED',
          createdAt: { gte: daysAgo }
        }
      ]
    }

    // Add violation type filter if specified
    if (filter !== 'all') {
      whereClause.incidentType = filter
    }

    const incidents = await prisma.incident.findMany({
      where: whereClause,
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
            model: true
          }
        },
        evidence: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // FIFO - First In, First Out
      }
    })

    const incidentsWithCounts = incidents.map((incident) =>
      serializeIncident({
        id: incident.id,
        incidentType: incident.incidentType,
        description: incident.description,
        location: incident.location,
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
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        reportedBy: incident.reportedBy,
        handledBy: incident.handledBy,
        evidenceCount: incident.evidence?.length || 0,
      }),
    )

    return NextResponse.json({
      incidents: incidentsWithCounts,
      message: 'Incidents retrieved successfully',
      filters: {
        days: parseInt(days),
        violationType: filter
      }
    }, {
      headers: {
        // Per-user browser cache for 30s with SWR
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
