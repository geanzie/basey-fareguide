import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RESOLVED_EVIDENCE_RETENTION_DAYS } from '@/lib/evidenceCleanup'
import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import {
  buildOffensePenaltyDecision,
  getOffenseTierLabel,
  normalizePlateNumber,
} from '@/lib/incidents/penaltyRules'
import { formatIncidentStatusLabel } from '@/lib/serializers/incidents'

interface TicketIssuanceContext {
  incident: Awaited<ReturnType<typeof prisma.incident.findUnique>> extends infer T
    ? Exclude<T, null>
    : never
  normalizedPlateNumber: string
  penaltyDecision: ReturnType<typeof buildOffensePenaltyDecision>
}

async function resolveTicketIssuanceContext(
  incidentId: string,
): Promise<{ response: NextResponse } | TicketIssuanceContext> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
  })

  if (!incident) {
    return {
      response: NextResponse.json({ message: 'Incident not found' }, { status: 404 }),
    }
  }

  // Order matters: issuance sets ticketNumber and status together, so an
  // already-ticketed incident would otherwise fall out at the status check and
  // be told it is "not pending" — true, but useless. Check the most specific
  // state first.
  if (incident.ticketNumber) {
    return {
      response: NextResponse.json(
        { message: 'Ticket has already been issued for this incident.' },
        { status: 409 },
      ),
    }
  }

  if (incident.status !== 'PENDING') {
    return {
      response: NextResponse.json(
        {
          message: `Can only issue tickets for pending incidents. This incident is ${formatIncidentStatusLabel(incident.status)}.`,
        },
        { status: 400 },
      ),
    }
  }

  if (!incident.evidenceVerifiedAt || !incident.evidenceVerifiedById) {
    return {
      response: NextResponse.json(
        { message: 'Evidence must be verified before issuing a ticket.' },
        { status: 400 },
      ),
    }
  }

  const normalizedPlateNumber = normalizePlateNumber(incident.plateNumber)

  if (!normalizedPlateNumber) {
    return {
      response: NextResponse.json(
        { message: 'A plate number is required before issuing a ticket.' },
        { status: 400 },
      ),
    }
  }

  const priorTicketWhere = {
    id: { not: incident.id },
    plateNumber: {
      equals: normalizedPlateNumber,
      mode: 'insensitive' as const,
    },
    ticketNumber: { not: null },
    status: { not: 'DISMISSED' as const },
    OR: [
      {
        incidentDate: {
          lt: incident.incidentDate,
        },
      },
      {
        incidentDate: incident.incidentDate,
        createdAt: {
          lt: incident.createdAt,
        },
      },
    ],
  }

  // The offence tier and the arrears answer different questions, so they are
  // counted differently.
  //
  // Sec. 33(a) speaks of a first, second and third *offence* -- a repeat of the
  // same offence. Counting an unrelated ticket toward the ladder raises the
  // fine on a basis the ordinance does not give, which is what the previous
  // plate-wide, type-blind count did.
  //
  // Arrears are the opposite: money already owed on the plate, whatever it was
  // owed for. That stays plate-wide, and stays out of this ticket's amount.
  const [priorSameTypeTicketCount, unpaidPriorTicketSummary] = await Promise.all([
    prisma.incident.count({
      where: {
        ...priorTicketWhere,
        incidentType: incident.incidentType,
      },
    }),
    prisma.incident.aggregate({
      where: {
        ...priorTicketWhere,
        paymentStatus: 'UNPAID',
      },
      _count: {
        id: true,
      },
      _sum: {
        penaltyAmount: true,
      },
    }),
  ])

  const outstandingArrears = Number(unpaidPriorTicketSummary._sum.penaltyAmount ?? 0)
  const priorUnpaidTicketCount = unpaidPriorTicketSummary._count.id

  return {
    incident,
    normalizedPlateNumber,
    penaltyDecision: buildOffensePenaltyDecision(
      incident.incidentType,
      priorSameTypeTicketCount,
      outstandingArrears,
      priorUnpaidTicketCount,
    ),
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    await requireRequestRole(request, [...ENFORCER_ONLY])
    const { incidentId } = await context.params
    const contextResult = await resolveTicketIssuanceContext(incidentId)

    if ('response' in contextResult) {
      return contextResult.response
    }

    const { penaltyDecision, normalizedPlateNumber } = contextResult

    return NextResponse.json({
      plateNumber: normalizedPlateNumber,
      penalty: {
        ...penaltyDecision,
        offenseTierLabel: penaltyDecision.offenseTier
          ? getOffenseTierLabel(penaltyDecision.offenseTier)
          : null,
      },
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await requireRequestRole(request, [...ENFORCER_ONLY])

    const { incidentId } = await context.params
    const body = await request.json()
    const { ticketNumber, remarks } = body

    // Validate required fields
    if (!ticketNumber) {
      return NextResponse.json({
        message: 'Missing required field: ticketNumber'
      }, { status: 400 })
    }

    const contextResult = await resolveTicketIssuanceContext(incidentId)

    if ('response' in contextResult) {
      return contextResult.response
    }

    const { incident, normalizedPlateNumber, penaltyDecision } = contextResult

    // Ordinance 105 fines only the franchise offences in Sec. 33 and Sec. 28.
    // For anything else its remedy is franchise action, not money, so a ticket
    // here would impose a penalty no provision authorises. Refuse and name the
    // route that does exist.
    if (!penaltyDecision.fineable) {
      return NextResponse.json(
        {
          message:
            'Ordinance 105 imposes no fine for this violation. Refer it for franchise action instead: Sec. 29(a) is the ground, Sec. 30 the Sangguniang Bayan process.',
          code: 'NO_PENALTY_BASIS',
          details: {
            incidentType: incident.incidentType,
            groundSection: '29(a)',
            processSection: '30',
          },
        },
        { status: 400 },
      )
    }

    // Check if ticket number is already in use
    const existingTicket = await prisma.incident.findUnique({
      where: { ticketNumber }
    })

    if (existingTicket) {
      return NextResponse.json({ 
        message: 'Ticket number already exists. Please use a different number.' 
      }, { status: 400 })
    }

    // Update incident with computed ticket penalty and mark as resolved
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        plateNumber: normalizedPlateNumber,
        ticketNumber,
        // The tier amount alone. Arrears are a separate plate balance and
        // must never be folded in here, or the next ticket's arrears sum
        // would count them twice.
        penaltyAmount: penaltyDecision.penaltyAmount,
        offenseNumberAtIssuance: penaltyDecision.offenseNumber,
        offenseTierAtIssuance: penaltyDecision.offenseTier,
        penaltyRuleVersion: penaltyDecision.ruleVersion,
        paymentStatus: 'UNPAID',
        paidAt: null,
        remarks: remarks || incident.remarks,
        status: 'TICKET_ISSUED',
        handledById: user.id,
        ticketIssuedAt: new Date(),
        ticketIssuedById: user.id,
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
        vehicle: {
          select: {
            plateNumber: true,
            vehicleType: true,
            ownerName: true
          }
        }
      }
    })

    return NextResponse.json({
      incident: updatedIncident,
      penalty: {
        ...penaltyDecision,
        offenseTierLabel: penaltyDecision.offenseTier
          ? getOffenseTierLabel(penaltyDecision.offenseTier)
          : null,
      },
      message: `Ticket ${ticketNumber} issued. Awaiting confirmed full payment before the incident is marked as resolved. Evidence remains available for ${RESOLVED_EVIDENCE_RETENTION_DAYS} days.`,
      evidenceRetainedUntilCleanup: true,
      evidenceRetentionDays: RESOLVED_EVIDENCE_RETENTION_DAYS,
    })

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
