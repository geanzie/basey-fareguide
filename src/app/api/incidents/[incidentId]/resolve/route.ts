import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanupEvidenceFiles } from '@/lib/evidenceCleanup'
import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await requireRequestRole(request, [...ENFORCER_ONLY])

    const { incidentId } = await context.params
    const body = await request.json().catch(() => ({}))
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : ''

    // Check if incident exists and is being handled by this enforcer
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    if (incident.handledById !== user.id) {
      return NextResponse.json({ 
        message: 'You can only resolve incidents that are assigned to you' 
      }, { status: 403 })
    }

    if (incident.status !== 'INVESTIGATING') {
      return NextResponse.json({ 
        message: 'This incident is not in investigating status' 
      }, { status: 400 })
    }

    if (incident.ticketNumber) {
      return NextResponse.json({
        message: 'This incident already has a ticket. Use the ticket workflow instead of resolving it again.'
      }, { status: 400 })
    }

    // Resolve the incident without issuing a ticket
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        remarks: remarks || incident.remarks,
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
        },
        evidence: {
          select: {
            id: true,
            fileName: true,
            fileType: true
          }
        }
      }
    })

    // **AUTOMATIC EVIDENCE CLEANUP** when incident is resolved
    try {
      
      // Clean up evidence files in background (don't wait for completion)
      cleanupEvidenceFiles(incidentId)
        .then(() => {
        })
        .catch((error) => {
          // Don't fail the request if cleanup fails - just log the error
        })
      
      
    } catch (cleanupError) {
      // Don't fail the request if cleanup fails
    }

    return NextResponse.json({
      incident: updatedIncident,
      message: 'Incident resolved without issuing a ticket. Evidence cleanup has been initiated.',
      evidenceCleanupInitiated: true
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
