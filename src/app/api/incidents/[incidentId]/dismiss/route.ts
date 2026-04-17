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
    const body = await request.json().catch(() => ({}))
    const dismissRemarks = typeof body.remarks === 'string' ? body.remarks.trim() : ''

    if (!dismissRemarks) {
      return NextResponse.json(
        { message: 'Dismissal remarks are required.' },
        { status: 400 },
      )
    }

    const updatedIncident = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId },
      })

      if (!incident) {
        throw Object.assign(new Error('Incident not found'), { statusCode: 404 })
      }

      if (incident.status !== 'PENDING') {
        throw Object.assign(
          new Error(
            'Dismissal is only allowed for pending incidents. Incidents with an issued ticket cannot be dismissed.',
          ),
          { statusCode: 400 },
        )
      }

      return tx.incident.update({
        where: { id: incidentId },
        data: {
          status: 'DISMISSED',
          dismissedAt: new Date(),
          dismissedById: user.id,
          dismissRemarks,
          handledById: user.id,
          updatedAt: new Date(),
        },
        include: {
          reportedBy: {
            select: { firstName: true, lastName: true, username: true },
          },
          dismissedBy: {
            select: { firstName: true, lastName: true, username: true },
          },
        },
      })
    })

    return NextResponse.json({
      incident: updatedIncident,
      message: 'Incident dismissed. No ticket will be issued.',
    })
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as Error & { statusCode: number }).statusCode
      return NextResponse.json({ message: error.message }, { status: statusCode })
    }
    return createAuthErrorResponse(error)
  }
}
