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

    const updatedIncident = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId },
        include: {
          _count: {
            select: { evidence: true },
          },
        },
      })

      if (!incident) {
        throw Object.assign(new Error('Incident not found'), { statusCode: 404 })
      }

      if (incident.status !== 'PENDING') {
        throw Object.assign(
          new Error('Evidence verification is only allowed for pending incidents.'),
          { statusCode: 400 },
        )
      }

      if (incident.evidenceVerifiedAt) {
        throw Object.assign(
          new Error('Evidence already verified for this incident.'),
          { statusCode: 409 },
        )
      }

      if (incident._count.evidence === 0) {
        throw Object.assign(
          new Error('At least one piece of evidence must be uploaded before verifying.'),
          { statusCode: 400 },
        )
      }

      return tx.incident.update({
        where: { id: incidentId },
        data: {
          evidenceVerifiedAt: new Date(),
          evidenceVerifiedById: user.id,
          updatedAt: new Date(),
        },
        include: {
          reportedBy: {
            select: { firstName: true, lastName: true, username: true },
          },
          handledBy: {
            select: { firstName: true, lastName: true, username: true },
          },
          evidenceVerifiedBy: {
            select: { firstName: true, lastName: true, username: true },
          },
        },
      })
    })

    return NextResponse.json({
      incident: updatedIncident,
      message: 'Evidence verified. Ticket issuance is now available.',
    })
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as Error & { statusCode: number }).statusCode
      return NextResponse.json({ message: error.message }, { status: statusCode })
    }
    return createAuthErrorResponse(error)
  }
}
