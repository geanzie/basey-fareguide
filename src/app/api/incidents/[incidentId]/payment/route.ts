import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { incidentId } = await context.params
    const body = await request.json().catch(() => ({}))
    const officialReceiptNumber =
      typeof body.officialReceiptNumber === 'string' ? body.officialReceiptNumber.trim() : ''
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : ''
    const paidAt =
      typeof body.paidAt === 'string' && body.paidAt.trim().length > 0
        ? new Date(body.paidAt)
        : new Date()

    if (!officialReceiptNumber) {
      return NextResponse.json({ message: 'Official receipt number is required.' }, { status: 400 })
    }

    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ message: 'Invalid paidAt value.' }, { status: 400 })
    }

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    if (!incident.ticketNumber) {
      return NextResponse.json({ message: 'Only ticketed incidents can be settled.' }, { status: 400 })
    }

    if (incident.paymentStatus === 'PAID') {
      return NextResponse.json({ message: 'This ticket is already marked as paid.' }, { status: 400 })
    }

    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        paymentStatus: 'PAID',
        paidAt,
        officialReceiptNumber,
        remarks: remarks || incident.remarks,
        updatedAt: new Date(),
      },
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        handledBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        vehicle: {
          select: {
            plateNumber: true,
            vehicleType: true,
            ownerName: true,
          },
        },
      },
    })

    return NextResponse.json({
      incident: updatedIncident,
      message: `Ticket ${incident.ticketNumber} marked as paid.`,
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}