import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import type { EncoderEventDto, EncoderOperationsDto } from '@/lib/contracts'
import {
  OPERATIONS_RANGES,
  DAY_MS,
  isOperationsRange,
  manilaMidnight,
  rangeStart,
} from '@/lib/operations/period'
import {
  buildEvent,
  buildExpiryOutlook,
  buildQueueItem,
  paymentLagDays,
  qrEventKind,
  sortEventsDesc,
  toPesos,
  type Money,
} from '@/lib/encoder/operations'
import { OUTLOOK_WEEKS } from '@/lib/encoder/operationsGroups'

/** Rows read per source per request. 90 days in Basey is far below this today. */
const MAX_RANGE_ROWS = 5000
const FEED_LIMIT = 15
const QUEUE_LIMIT = 25
const SOON_DAYS = 30

const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  penaltyAmount: true,
  ticketIssuedAt: true,
  paidAt: true,
  paymentRecordedAt: true,
  plateNumber: true,
  vehicleType: true,
  vehicle: { select: { plateNumber: true, vehicleType: true } },
} as const

type TicketRow = {
  id: string
  ticketNumber: string | null
  penaltyAmount: Money
  ticketIssuedAt: Date | null
  paidAt: Date | null
  paymentRecordedAt: Date | null
  plateNumber: string | null
  vehicleType: string | null
  vehicle: { plateNumber: string; vehicleType: string } | null
}

const PERMIT_QUEUE_SELECT = {
  id: true,
  permitPlateNumber: true,
  vehicleType: true,
  expiryDate: true,
  qrIssuedAt: true,
} as const

type PermitQueueRow = {
  id: string
  permitPlateNumber: string
  vehicleType: string
  expiryDate: Date
  qrIssuedAt: Date | null
}

const VEHICLE_SELECT = {
  id: true,
  plateNumber: true,
  vehicleType: true,
  createdAt: true,
  registrationExpiry: true,
} as const

type VehicleRow = {
  id: string
  plateNumber: string
  vehicleType: string
  createdAt: Date
  registrationExpiry: Date
}

/** When the desk recorded a payment; older rows only have the OR date. */
function paymentTime(row: TicketRow): Date | null {
  return row.paymentRecordedAt ?? row.paidAt
}

/** Payments recorded in [from, to), falling back to the OR date for old rows. */
function paymentsBetween(from: Date, to?: Date) {
  const window = to ? { gte: from, lt: to } : { gte: from }
  return {
    paymentStatus: 'PAID' as const,
    OR: [{ paymentRecordedAt: window }, { paymentRecordedAt: null, paidAt: window }],
  }
}

function ticketPlate(row: TicketRow) {
  return {
    plateNumber: row.plateNumber || row.vehicle?.plateNumber || null,
    vehicleType: row.vehicleType || row.vehicle?.vehicleType || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    const rangeParam = new URL(request.url).searchParams.get('range') ?? '7d'
    if (!isOperationsRange(rangeParam)) {
      return NextResponse.json(
        { message: `Invalid range "${rangeParam}". Expected one of: ${OPERATIONS_RANGES.join(', ')}.` },
        { status: 400 },
      )
    }

    const now = new Date()
    const since = rangeStart(rangeParam, now)
    const previousSince = new Date(since.getTime() - (now.getTime() - since.getTime()))
    const soon = new Date(now.getTime() + SOON_DAYS * DAY_MS)
    const outlookEnd = new Date(now.getTime() + OUTLOOK_WEEKS * 7 * DAY_MS)
    const take = MAX_RANGE_ROWS + 1

    const unpaidWhere = { status: 'TICKET_ISSUED' as const, paymentStatus: 'UNPAID' as const }
    const lapsedWhere = { status: 'ACTIVE' as const, expiryDate: { lt: now } }
    const expiringWhere = { status: 'ACTIVE' as const, expiryDate: { gte: now, lte: soon } }
    const stickerWhere = { status: 'ACTIVE' as const, qrToken: { not: null }, qrPrintedAt: null }
    const noPermitWhere = { isActive: true, permit: { is: null } }
    const registrationWhere = { isActive: true, registrationExpiry: { lte: soon } }

    const [
      vehicleRows,
      permitRows,
      renewalRows,
      qrRows,
      paymentRows,
      previousCounts,
      previousCollected,
      unpaidRows,
      unpaidCount,
      unpaidSum,
      lapsedRows,
      lapsedCount,
      expiringRows,
      expiringCount,
      stickerRows,
      stickerCount,
      withoutQrCount,
      noPermitRows,
      noPermitCount,
      registrationRows,
      registrationCount,
      snapshot,
      outlookRows,
    ] = await Promise.all([
      prisma.vehicle.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, plateNumber: true, vehicleType: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
      }),
      prisma.permit.findMany({
        where: { encodedAt: { gte: since } },
        select: { id: true, permitPlateNumber: true, vehicleType: true, encodedAt: true },
        orderBy: [{ encodedAt: 'desc' }, { id: 'desc' }],
        take,
      }),
      prisma.permitRenewal.findMany({
        where: { renewedAt: { gte: since } },
        select: {
          id: true,
          renewedAt: true,
          permit: { select: { permitPlateNumber: true, vehicleType: true } },
        },
        orderBy: [{ renewedAt: 'desc' }, { id: 'desc' }],
        take,
      }),
      prisma.permitQrAudit.findMany({
        where: { actedAt: { gte: since } },
        select: {
          id: true,
          action: true,
          actedAt: true,
          permitPlateNumber: true,
          permit: { select: { vehicleType: true } },
        },
        orderBy: [{ actedAt: 'desc' }, { id: 'desc' }],
        take,
      }),
      prisma.incident.findMany({
        where: paymentsBetween(since),
        select: TICKET_SELECT,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        take,
      }),
      Promise.all([
        prisma.vehicle.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
        prisma.permit.count({ where: { encodedAt: { gte: previousSince, lt: since } } }),
        prisma.permitRenewal.count({ where: { renewedAt: { gte: previousSince, lt: since } } }),
        prisma.permitQrAudit.count({ where: { actedAt: { gte: previousSince, lt: since } } }),
        prisma.incident.count({ where: paymentsBetween(previousSince, since) }),
      ]),
      prisma.incident.aggregate({
        where: paymentsBetween(previousSince, since),
        _sum: { penaltyAmount: true },
      }),
      prisma.incident.findMany({
        where: unpaidWhere,
        select: TICKET_SELECT,
        orderBy: [{ ticketIssuedAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_LIMIT,
      }),
      prisma.incident.count({ where: unpaidWhere }),
      prisma.incident.aggregate({ where: unpaidWhere, _sum: { penaltyAmount: true } }),
      prisma.permit.findMany({
        where: lapsedWhere,
        select: PERMIT_QUEUE_SELECT,
        orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        take: QUEUE_LIMIT,
      }),
      prisma.permit.count({ where: lapsedWhere }),
      prisma.permit.findMany({
        where: expiringWhere,
        select: PERMIT_QUEUE_SELECT,
        orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        take: QUEUE_LIMIT,
      }),
      prisma.permit.count({ where: expiringWhere }),
      prisma.permit.findMany({
        where: stickerWhere,
        select: PERMIT_QUEUE_SELECT,
        orderBy: [{ qrIssuedAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_LIMIT,
      }),
      prisma.permit.count({ where: stickerWhere }),
      prisma.permit.count({ where: { status: 'ACTIVE', qrToken: null } }),
      prisma.vehicle.findMany({
        where: noPermitWhere,
        select: VEHICLE_SELECT,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_LIMIT,
      }),
      prisma.vehicle.count({ where: noPermitWhere }),
      prisma.vehicle.findMany({
        where: registrationWhere,
        select: VEHICLE_SELECT,
        orderBy: [{ registrationExpiry: 'asc' }, { id: 'asc' }],
        take: QUEUE_LIMIT,
      }),
      prisma.vehicle.count({ where: registrationWhere }),
      prisma.permit.groupBy({
        by: ['vehicleType', 'status'],
        _count: { _all: true },
      }),
      prisma.permit.findMany({
        where: { status: 'ACTIVE', expiryDate: { gte: now, lt: outlookEnd } },
        select: { expiryDate: true, vehicleType: true },
      }),
    ])

    const truncated = [vehicleRows, permitRows, renewalRows, qrRows, paymentRows].some(
      (rows) => rows.length > MAX_RANGE_ROWS,
    )

    const events: EncoderEventDto[] = []
    for (const row of vehicleRows.slice(0, MAX_RANGE_ROWS)) {
      events.push(buildEvent('VEHICLE_REGISTERED', row.id, row.createdAt, row))
    }
    for (const row of permitRows.slice(0, MAX_RANGE_ROWS)) {
      events.push(
        buildEvent('PERMIT_ISSUED', row.id, row.encodedAt, {
          plateNumber: row.permitPlateNumber,
          vehicleType: row.vehicleType,
        }),
      )
    }
    for (const row of renewalRows.slice(0, MAX_RANGE_ROWS)) {
      events.push(
        buildEvent('PERMIT_RENEWED', row.id, row.renewedAt, {
          plateNumber: row.permit.permitPlateNumber,
          vehicleType: row.permit.vehicleType,
        }),
      )
    }
    for (const row of qrRows.slice(0, MAX_RANGE_ROWS)) {
      const kind = qrEventKind(row.action)
      if (!kind) continue
      events.push(
        buildEvent(kind, row.id, row.actedAt, {
          plateNumber: row.permitPlateNumber,
          vehicleType: row.permit.vehicleType,
        }),
      )
    }
    for (const row of (paymentRows as TicketRow[]).slice(0, MAX_RANGE_ROWS)) {
      const at = paymentTime(row)
      if (!at) continue
      events.push(
        buildEvent('PAYMENT_RECORDED', row.id, at, {
          ...ticketPlate(row),
          amount: toPesos(row.penaltyAmount) ?? 0,
          lagDays: paymentLagDays(row.ticketIssuedAt, row.paidAt ?? at),
        }),
      )
    }
    sortEventsDesc(events)

    const todayStart = manilaMidnight(now).toISOString()

    const queue = [
      ...(unpaidRows as TicketRow[]).map((row) =>
        buildQueueItem('UNPAID_TICKET', row.id, {
          ...ticketPlate(row),
          dueAt: row.ticketIssuedAt,
          amount: toPesos(row.penaltyAmount),
          reference: row.ticketNumber,
        }),
      ),
      ...(lapsedRows as PermitQueueRow[]).map((row) =>
        buildQueueItem('PERMIT_LAPSED', row.id, {
          plateNumber: row.permitPlateNumber,
          vehicleType: row.vehicleType,
          dueAt: row.expiryDate,
          reference: row.permitPlateNumber,
        }),
      ),
      ...(expiringRows as PermitQueueRow[]).map((row) =>
        buildQueueItem('PERMIT_EXPIRING', row.id, {
          plateNumber: row.permitPlateNumber,
          vehicleType: row.vehicleType,
          dueAt: row.expiryDate,
          reference: row.permitPlateNumber,
        }),
      ),
      ...(stickerRows as PermitQueueRow[]).map((row) =>
        buildQueueItem('STICKER_TO_PRINT', row.id, {
          plateNumber: row.permitPlateNumber,
          vehicleType: row.vehicleType,
          dueAt: row.qrIssuedAt,
          reference: row.permitPlateNumber,
        }),
      ),
      ...(noPermitRows as VehicleRow[]).map((row) =>
        buildQueueItem('VEHICLE_NO_PERMIT', row.id, {
          plateNumber: row.plateNumber,
          vehicleType: row.vehicleType,
          dueAt: row.createdAt,
        }),
      ),
      ...(registrationRows as VehicleRow[]).map((row) =>
        buildQueueItem('REGISTRATION_EXPIRING', row.id, {
          plateNumber: row.plateNumber,
          vehicleType: row.vehicleType,
          dueAt: row.registrationExpiry,
        }),
      ),
    ]

    const body: EncoderOperationsDto = {
      generatedAt: now.toISOString(),
      range: rangeParam,
      since: since.toISOString(),
      pulse: {
        unpaidTicketCount: unpaidCount,
        unpaidAmount: toPesos(unpaidSum._sum.penaltyAmount) ?? 0,
        oldestUnpaidAt: (unpaidRows as TicketRow[])[0]?.ticketIssuedAt?.toISOString() ?? null,
        permitsExpiringCount: expiringCount,
        permitsLapsedCount: lapsedCount,
        stickersToPrintCount: stickerCount,
        permitsWithoutQrCount: withoutQrCount,
        vehiclesWithoutPermitCount: noPermitCount,
        registrationsExpiringCount: registrationCount,
        doneTodayCount: events.filter((event) => event.at >= todayStart).length,
      },
      queue,
      feed: events.slice(0, FEED_LIMIT),
      events,
      previousPeriodCount: previousCounts.reduce((sum, count) => sum + count, 0),
      previousPeriodCollected: toPesos(previousCollected._sum.penaltyAmount) ?? 0,
      truncated,
      permitSnapshot: snapshot.map((entry) => ({
        vehicleType: entry.vehicleType,
        status: entry.status,
        count: entry._count._all,
      })),
      expiryOutlook: buildExpiryOutlook(outlookRows),
    }

    // Polled by the control center; a cached copy would show a stale queue
    // next to pages where the encoder has just cleared it.
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
