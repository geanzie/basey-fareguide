import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import {
  canReviewIncidentEvidence,
  INCIDENT_EVIDENCE_REVIEW_ACCESS_DENIED_MESSAGE,
} from '@/lib/incidents/evidenceAuthorization'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

    const { evidenceId } = await params
    const { status, remarks } = await request.json()

    // Validate status
    const validStatuses = ['VERIFIED', 'REJECTED', 'REQUIRES_ADDITIONAL']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        message: 'Invalid status. Must be VERIFIED, REJECTED, or REQUIRES_ADDITIONAL' 
      }, { status: 400 })
    }

    // Check if evidence exists
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        incident: true,
        uploader: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    if (!evidence) {
      return NextResponse.json({ message: 'Evidence not found' }, { status: 404 })
    }

    if (!canReviewIncidentEvidence(evidence.incident, user)) {
      return NextResponse.json(
        { message: INCIDENT_EVIDENCE_REVIEW_ACCESS_DENIED_MESSAGE },
        { status: 403 },
      )
    }

    // Update evidence status
    const updatedEvidence = await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        status: status as any,
        remarks,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        uploader: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    return NextResponse.json({
      evidence: updatedEvidence,
      message: `Evidence ${status.toLowerCase()} successfully`
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
