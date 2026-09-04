import { NextRequest, NextResponse } from 'next/server'

import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { isFineable, normalizePlateNumber } from '@/lib/incidents/penaltyRules'
import { prisma } from '@/lib/prisma'

/**
 * Refers a verified incident for cancellation or revocation of the franchise.
 *
 * Ordinance 105 fines only the franchise offences in Sec. 33 and Sec. 28. For
 * every other violation -- a fare overcharge above all -- Sec. 29(a) makes it a
 * ground for cancelling the franchise and Sec. 30 is the process, read in
 * session by the Sangguniang Bayan on the Secretariat's recommendation.
 *
 * Without this route the only outcome available to an enforcer holding a
 * verified overcharge is DISMISSED, which tells the rider who reported it that
 * their report was thrown out.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> },
) {
  try {
    const user = await requireRequestRole(request, [...ENFORCER_ONLY])
    const { incidentId } = await context.params
    const body = await request.json().catch(() => ({}))
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : ''

    const incident = await prisma.incident.findUnique({ where: { id: incidentId } })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    // Same gate order as issuing a ticket: an already-ticketed incident has
    // taken the other branch and must not also be referred.
    if (incident.ticketNumber) {
      return NextResponse.json(
        { message: 'This incident already has a ticket issued.', code: 'TICKET_ALREADY_ISSUED' },
        { status: 409 },
      )
    }

    if (incident.status !== 'PENDING') {
      return NextResponse.json(
        {
          message: 'Only a pending incident can be referred for franchise action.',
          code: 'INVALID_INCIDENT_STATUS',
        },
        { status: 400 },
      )
    }

    if (!incident.evidenceVerifiedAt || !incident.evidenceVerifiedById) {
      return NextResponse.json(
        { message: 'Evidence must be verified before referring this incident.' },
        { status: 400 },
      )
    }

    // A fineable franchise offence has a penalty the ordinance does authorise;
    // referring it instead would quietly drop that fine.
    if (isFineable(incident.incidentType)) {
      return NextResponse.json(
        {
          message:
            'Ordinance 105 imposes a fine for this violation. Issue a ticket instead of referring it.',
          code: 'PENALTY_BASIS_EXISTS',
        },
        { status: 400 },
      )
    }

    const referredAt = new Date()

    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        plateNumber: normalizePlateNumber(incident.plateNumber) ?? incident.plateNumber,
        status: 'REFERRED_FOR_FRANCHISE_ACTION',
        referredAt,
        referredById: user.id,
        handledById: user.id,
        remarks: remarks || incident.remarks,
        updatedAt: referredAt,
      },
      include: {
        reportedBy: { select: { firstName: true, lastName: true, username: true } },
        handledBy: { select: { firstName: true, lastName: true, username: true } },
        vehicle: { select: { plateNumber: true, vehicleType: true, ownerName: true } },
      },
    })

    return NextResponse.json({
      incident: updatedIncident,
      referral: {
        groundSection: '29(a)',
        processSection: '30',
        referredAt: referredAt.toISOString(),
      },
      message:
        'Referred for franchise action. The Sangguniang Bayan decides cancellation or revocation under Sec. 30; no fine is imposed by the municipality for this violation.',
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
