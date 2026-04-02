import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await requireRequestRole(request, [...ENFORCER_ONLY])

    const { incidentId } = await context.params

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    if (incident.status !== 'PENDING') {
      return NextResponse.json({ 
        message: 'This incident has already been assigned or resolved' 
      }, { status: 400 })
    }

    // Update incident to investigating and assign to current enforcer
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: 'INVESTIGATING',
        handledById: user.id,
        updatedAt: new Date()
      },
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
        }
      }
    })

    return NextResponse.json({
      incident: updatedIncident,
      message: 'Incident assigned successfully'
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
