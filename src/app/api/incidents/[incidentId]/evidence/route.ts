import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import {
  canReadIncidentEvidence,
  INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE,
} from '@/lib/incidents/evidenceAuthorization'
import { extractEvidenceFiles, uploadEvidenceFiles } from '@/lib/evidenceStorage'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await requireRequestUser(request)

    const { incidentId } = await context.params
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    // Only the original reporter or an admin can append follow-up evidence.
    const canUpload = incident.reportedById === user.id || user.userType === 'ADMIN'

    if (!canUpload) {
      return NextResponse.json({ 
        message: 'Only the incident reporter or an admin can upload evidence.' 
      }, { status: 403 })
    }

    const formData = await request.formData()
    const files = extractEvidenceFiles(formData)

    if (files.length === 0) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 })
    }

    let evidence
    try {
      evidence = await uploadEvidenceFiles({
        incidentId,
        files,
        uploadedBy: user.id
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save evidence'
      return NextResponse.json({ message }, { status: 400 })
    }

    return NextResponse.json({
      evidence: evidence[0] || null,
      uploadedEvidence: evidence,
      evidenceCount: evidence.length,
      message: 'Evidence uploaded successfully'
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await requireRequestUser(request)

    const { incidentId } = await context.params
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    const canView = canReadIncidentEvidence(incident, user)

    if (!canView) {
      return NextResponse.json({
        message: INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE,
      }, { status: 403 })
    }

    // Get all evidence for this incident
    const evidence = await prisma.evidence.findMany({
      where: { incidentId },
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
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({
      evidence,
      message: 'Evidence retrieved successfully'
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
