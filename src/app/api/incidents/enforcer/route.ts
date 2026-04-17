import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { serializeIncident } from '@/lib/serializers'
import type { EnforcerIncidentScope } from '@/lib/contracts'

const ENFORCER_INCIDENT_SCOPES: readonly EnforcerIncidentScope[] = ['all', 'unresolved']

function isEnforcerIncidentScope(value: string): value is EnforcerIncidentScope {
  return ENFORCER_INCIDENT_SCOPES.includes(value as EnforcerIncidentScope)
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ENFORCER_ONLY])

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const scopeParam = searchParams.get('scope')
    const filter = searchParams.get('filter') || 'all'

    if (scopeParam !== null && !isEnforcerIncidentScope(scopeParam)) {
      return NextResponse.json(
        {
          message: `Invalid scope \"${scopeParam}\". Expected one of: ${ENFORCER_INCIDENT_SCOPES.join(', ')}.`,
        },
        { status: 400 },
      )
    }

    const scope: EnforcerIncidentScope = scopeParam ?? 'all'

    // Build where clause
    const whereClause: any =
      scope === 'unresolved'
        ? {
            status: { in: ['PENDING', 'TICKET_ISSUED'] },
          }
        : {}

    // Add violation type filter if specified
    if (filter !== 'all') {
      whereClause.incidentType = filter
    }

    const orderBy = {
      createdAt: scope === 'unresolved' ? 'asc' : 'desc',
    } as const

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
        },
        evidenceVerifiedBy: {
          select: { firstName: true, lastName: true, username: true },
        },
        ticketIssuedBy: {
          select: { firstName: true, lastName: true, username: true },
        },
        dismissedBy: {
          select: { firstName: true, lastName: true, username: true },
        },
        paymentRecordedBy: {
          select: { firstName: true, lastName: true, username: true },
        },
      },
      orderBy,
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
        handledById: incident.handledById,
        reportedBy: incident.reportedBy,
        handledBy: incident.handledBy,
        evidenceCount: incident.evidence?.length || 0,
        evidenceVerifiedAt: incident.evidenceVerifiedAt,
        evidenceVerifiedBy: (incident as any).evidenceVerifiedBy ?? null,
        ticketIssuedAt: incident.ticketIssuedAt,
        ticketIssuedBy: (incident as any).ticketIssuedBy ?? null,
        dismissedAt: incident.dismissedAt,
        dismissedBy: (incident as any).dismissedBy ?? null,
        dismissRemarks: incident.dismissRemarks,
        paymentRecordedAt: incident.paymentRecordedAt,
        paymentRecordedBy: (incident as any).paymentRecordedBy ?? null,
      }),
    )

    return NextResponse.json({
      incidents: incidentsWithCounts,
      message: 'Incidents retrieved successfully',
      filters: {
        scope,
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
