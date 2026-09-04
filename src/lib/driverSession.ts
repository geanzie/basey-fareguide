import type { NextRequest } from 'next/server'

import {
  DiscountType,
  DriverTripSessionInitiator,
  DriverTripSessionRiderAction,
  DriverTripSessionRiderStatus,
  DriverTripSessionStatus,
  Prisma,
  UserType,
} from '@prisma/client'

import type {
  DriverSessionActionButtonDto,
  DriverSessionActionDto,
  DriverSessionActionResponseDto,
  DriverSessionActiveResponseDto,
  DriverSessionHistoryItemDto,
  DriverSessionHistoryResponseDto,
  DriverSessionHistoryRiderDto,
  DriverSessionRiderCardDto,
  DriverSessionSummaryDto,
  RiderTripActionButtonDto,
  RiderTripActionDto,
} from '@/lib/contracts'
import { verifyAuthWithSelect } from '@/lib/auth'
import { isDriverAcceptSuspended } from '@/lib/driverSessionSettings/settingsService'
import { resolveSeatCapacity } from '@/lib/vehicleCapacitySettings/settingsService'
import { prisma } from '@/lib/prisma'

const DRIVER_HISTORY_DEFAULT_LIMIT = 10
const DRIVER_HISTORY_MAX_LIMIT = 20
export const PENDING_TRIP_REQUEST_TTL_MS = 10 * 60 * 1000

const ACTIVE_SESSION_STATUSES: readonly DriverTripSessionStatus[] = [
  DriverTripSessionStatus.OPEN,
  DriverTripSessionStatus.IN_PROGRESS,
]
const CLOSURE_BLOCKING_RIDER_STATUSES: readonly DriverTripSessionRiderStatus[] = [
  DriverTripSessionRiderStatus.PENDING,
  DriverTripSessionRiderStatus.ACCEPTED,
  DriverTripSessionRiderStatus.BOARDED,
]
// Only riders the driver has committed to (accepted) or that are onboard should
// block going offline. An unanswered PENDING request must never trap the driver —
// closing the session expires it instead (see closeDriverSession).
const CLOSE_BLOCKING_RIDER_STATUSES: readonly DriverTripSessionRiderStatus[] = [
  DriverTripSessionRiderStatus.ACCEPTED,
  DriverTripSessionRiderStatus.BOARDED,
]
const PENDING_SECTION_RIDER_STATUSES: readonly DriverTripSessionRiderStatus[] = [
  DriverTripSessionRiderStatus.PENDING,
  DriverTripSessionRiderStatus.ACCEPTED,
]
const ARCHIVED_RIDER_STATUSES: readonly DriverTripSessionRiderStatus[] = [
  DriverTripSessionRiderStatus.REJECTED_NOT_HERE,
  DriverTripSessionRiderStatus.REJECTED_FULL,
  DriverTripSessionRiderStatus.REJECTED_WRONG_TRIP,
  DriverTripSessionRiderStatus.CANCELLED,
  DriverTripSessionRiderStatus.EXPIRED,
]
const FINALIZED_RIDER_STATUSES: readonly DriverTripSessionRiderStatus[] = [
  DriverTripSessionRiderStatus.COMPLETED,
  DriverTripSessionRiderStatus.REJECTED_NOT_HERE,
  DriverTripSessionRiderStatus.REJECTED_FULL,
  DriverTripSessionRiderStatus.REJECTED_WRONG_TRIP,
  DriverTripSessionRiderStatus.CANCELLED,
  DriverTripSessionRiderStatus.EXPIRED,
]
const PENDING_SECTION_CARD_STATUSES: readonly DriverSessionRiderCardDto['status'][] = ['PENDING', 'ACCEPTED']
const ARCHIVED_CARD_STATUSES: readonly DriverSessionRiderCardDto['status'][] = [
  'REJECTED_NOT_HERE',
  'REJECTED_FULL',
  'REJECTED_WRONG_TRIP',
  'CANCELLED',
  'EXPIRED',
]

type DriverManagedRiderAction = Exclude<DriverTripSessionRiderAction, 'EXPIRE'>

const riderActionConfig: Record<
  DriverManagedRiderAction,
  {
    label: string
    kind: DriverSessionActionButtonDto['kind']
    from: DriverTripSessionRiderStatus[]
    to: DriverTripSessionRiderStatus
  }
> = {
  ACCEPT: {
    label: 'Accept',
    kind: 'positive',
    from: [DriverTripSessionRiderStatus.PENDING],
    to: DriverTripSessionRiderStatus.BOARDED,
  },
  BOARDED: {
    label: 'Boarded',
    kind: 'positive',
    from: [DriverTripSessionRiderStatus.ACCEPTED],
    to: DriverTripSessionRiderStatus.BOARDED,
  },
  DROPPED_OFF: {
    label: 'Dropped Off',
    kind: 'positive',
    from: [DriverTripSessionRiderStatus.BOARDED],
    to: DriverTripSessionRiderStatus.COMPLETED,
  },
  NOT_HERE: {
    label: 'Not Here',
    kind: 'negative',
    from: [DriverTripSessionRiderStatus.PENDING],
    to: DriverTripSessionRiderStatus.REJECTED_NOT_HERE,
  },
  FULL: {
    label: 'Full',
    kind: 'negative',
    from: [DriverTripSessionRiderStatus.PENDING],
    to: DriverTripSessionRiderStatus.REJECTED_FULL,
  },
  WRONG_TRIP: {
    label: 'Wrong Trip',
    kind: 'negative',
    from: [DriverTripSessionRiderStatus.PENDING],
    to: DriverTripSessionRiderStatus.REJECTED_WRONG_TRIP,
  },
  CANCELLED: {
    label: 'Cancelled',
    kind: 'negative',
    from: [DriverTripSessionRiderStatus.PENDING, DriverTripSessionRiderStatus.ACCEPTED],
    to: DriverTripSessionRiderStatus.CANCELLED,
  },
}

/**
 * The transitions a rider may make on their own trip. Only reachable on a
 * rider-initiated trip: when the vehicle type is suspended from the driver
 * session flow there is no driver app to press Dropped Off, so the rider ends
 * the trip themselves. The driver's table above is deliberately left alone.
 */
const riderTripActionConfig: Record<
  RiderTripActionDto,
  {
    label: string
    kind: RiderTripActionButtonDto['kind']
    from: DriverTripSessionRiderStatus[]
    to: DriverTripSessionRiderStatus
    event: DriverTripSessionRiderAction
  }
> = {
  DROPPED_OFF: {
    label: 'Dropped off',
    kind: 'positive',
    from: [DriverTripSessionRiderStatus.BOARDED],
    to: DriverTripSessionRiderStatus.COMPLETED,
    event: DriverTripSessionRiderAction.DROPPED_OFF,
  },
  CANCELLED: {
    label: 'Cancel trip',
    kind: 'negative',
    from: [DriverTripSessionRiderStatus.BOARDED],
    to: DriverTripSessionRiderStatus.CANCELLED,
    event: DriverTripSessionRiderAction.CANCELLED,
  },
}

export function buildAvailableRiderActions(
  status: DriverTripSessionRiderStatus,
  riderInitiated: boolean,
): RiderTripActionButtonDto[] {
  if (!riderInitiated) {
    return []
  }

  return (Object.entries(riderTripActionConfig) as [
    RiderTripActionDto,
    (typeof riderTripActionConfig)[RiderTripActionDto],
  ][])
    .filter(([, config]) => config.from.includes(status))
    .map(([action, config]) => ({ action, label: config.label, kind: config.kind }))
}

const riderStatusLabels: Record<DriverTripSessionRiderStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  BOARDED: 'Boarded',
  COMPLETED: 'Completed',
  REJECTED_NOT_HERE: 'Not Here',
  REJECTED_FULL: 'Full',
  REJECTED_WRONG_TRIP: 'Wrong Trip',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

const sessionStatusLabels: Record<DriverTripSessionStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
}

const driverSessionSelect = {
  id: true,
  vehicleId: true,
  status: true,
  openedAt: true,
  closedAt: true,
  riders: {
    orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      riderUserId: true,
      fareCalculationId: true,
      activeRequestKey: true,
      status: true,
      originSnapshot: true,
      destinationSnapshot: true,
      distanceSnapshot: true,
      fareSnapshot: true,
      seatsPaid: true,
      calculationTypeSnapshot: true,
      routeDataSnapshot: true,
      farePolicySnapshot: true,
      discountCardIdSnapshot: true,
      originalFareSnapshot: true,
      discountAppliedSnapshot: true,
      discountTypeSnapshot: true,
      joinedAt: true,
      expiresAt: true,
      acceptedAt: true,
      boardedAt: true,
      completedAt: true,
      finalisedAt: true,
    },
  },
} satisfies Prisma.VehicleTripSessionSelect

type DriverSessionRecord = Prisma.VehicleTripSessionGetPayload<{ select: typeof driverSessionSelect }>

type DriverContext = {
  id: string
  firstName: string
  lastName: string
  username: string
}

type DriverVehicleContext = DriverContext & {
  assignedVehicleAssignedAt: Date | null
  vehicle: {
    id: string
    plateNumber: string
    vehicleType: string
    make: string
    model: string
    color: string
  }
}

type PendingTripRequestCandidate = {
  userId: string | null
  vehicleId: string | null
  /**
   * Seats this fare buys. 1 is an ordinary shared ride; the vehicle's capacity
   * is a charter, where the rider pays for the whole vehicle to leave now.
   * Absent means 1, so every existing caller keeps its current behaviour.
   */
  seatsPaid?: number | null
  fromLocation: string
  toLocation: string
  distance: Prisma.Decimal | number | string
  calculatedFare: Prisma.Decimal | number | string
  calculationType: string
  routeData: string | null
  farePolicySnapshot: string | null
  discountCardId: string | null
  originalFare: Prisma.Decimal | number | string | null
  discountApplied: Prisma.Decimal | number | string | null
  discountType: DiscountType | null
  createdAt: Date
}

type PendingTripRequestResult = {
  id: string
  sessionId: string
  fareCalculationId: string | null
  status: DriverTripSessionRiderStatus
  created: boolean
}

const driverHistorySessionSelect = {
  id: true,
  vehicleId: true,
  status: true,
  openedAt: true,
  closedAt: true,
  riders: {
    orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      riderUserId: true,
      fareCalculationId: true,
      activeRequestKey: true,
      status: true,
      originSnapshot: true,
      destinationSnapshot: true,
      distanceSnapshot: true,
      fareSnapshot: true,
      calculationTypeSnapshot: true,
      routeDataSnapshot: true,
      farePolicySnapshot: true,
      discountCardIdSnapshot: true,
      originalFareSnapshot: true,
      discountAppliedSnapshot: true,
      discountTypeSnapshot: true,
      joinedAt: true,
      expiresAt: true,
      acceptedAt: true,
      boardedAt: true,
      completedAt: true,
      finalisedAt: true,
    },
  },
} satisfies Prisma.VehicleTripSessionSelect

type DriverHistorySessionRecord = Prisma.VehicleTripSessionGetPayload<{ select: typeof driverHistorySessionSelect }>

export class DriverSessionError extends Error {
  status: number
  code: string
  /**
   * Machine-readable context for errors a client must explain rather than just
   * report — a capacity block needs to tell the rider how many seats are taken
   * and by whom, or the refusal reads as an app bug and they board anyway with
   * no record at all.
   */
  details?: Record<string, unknown>

  constructor(
    message: string,
    status = 400,
    code = 'DRIVER_SESSION_ERROR',
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DriverSessionError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function isDriverSessionError(error: unknown): error is DriverSessionError {
  return error instanceof DriverSessionError
}

function toIsoString(value: Date | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value.toISOString()
}

function toNumber(value: Prisma.Decimal | number | string): number {
  return Number(value)
}

function toNullableNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  return Number(value)
}

function buildActiveRequestKey(sessionId: string, riderUserId: string) {
  return `${sessionId}:${riderUserId}`
}

function buildPendingRequestExpiry(createdAt: Date) {
  return new Date(createdAt.getTime() + PENDING_TRIP_REQUEST_TTL_MS)
}

function buildAvailableActions(status: DriverTripSessionRiderStatus): DriverSessionActionButtonDto[] {
  return Object.entries(riderActionConfig)
    .filter(([, config]) => config.from.includes(status))
    .map(([action, config]) => ({
      action: action as DriverSessionActionDto,
      label: config.label,
      kind: config.kind,
    }))
}

function toRiderCard(rider: DriverSessionRecord['riders'][number]): DriverSessionRiderCardDto {
  return {
    id: rider.id,
    fareCalculationId: rider.fareCalculationId ?? null,
    origin: rider.originSnapshot,
    destination: rider.destinationSnapshot,
    fareSnapshot: toNumber(rider.fareSnapshot),
    discountType: rider.discountTypeSnapshot ?? null,
    status: rider.status,
    statusLabel: riderStatusLabels[rider.status],
    joinedAt: rider.joinedAt.toISOString(),
    availableActions: buildAvailableActions(rider.status),
  }
}

function toHistoryRider(rider: DriverHistorySessionRecord['riders'][number]): DriverSessionHistoryRiderDto {
  return {
    id: rider.id,
    fareCalculationId: rider.fareCalculationId ?? null,
    origin: rider.originSnapshot,
    destination: rider.destinationSnapshot,
    fareSnapshot: toNumber(rider.fareSnapshot),
    discountType: rider.discountTypeSnapshot ?? null,
    status: rider.status,
    statusLabel: riderStatusLabels[rider.status],
    joinedAt: rider.joinedAt.toISOString(),
    acceptedAt: toIsoString(rider.acceptedAt),
    boardedAt: toIsoString(rider.boardedAt),
    completedAt: toIsoString(rider.completedAt),
    finalisedAt: toIsoString(rider.finalisedAt),
  }
}

function toHistoryItem(session: DriverHistorySessionRecord): DriverSessionHistoryItemDto {
  const riders = session.riders.map(toHistoryRider)

  return {
    id: session.id,
    status: DriverTripSessionStatus.CLOSED,
    statusLabel: sessionStatusLabels[DriverTripSessionStatus.CLOSED],
    openedAt: session.openedAt.toISOString(),
    closedAt: session.closedAt!.toISOString(),
    riderCount: riders.length,
    completedCount: riders.filter((rider) => rider.status === DriverTripSessionRiderStatus.COMPLETED).length,
    archivedCount: riders.filter((rider) => ARCHIVED_CARD_STATUSES.includes(rider.status)).length,
    riders,
  }
}

function parseDriverHistoryLimit(request: NextRequest) {
  const rawLimit = request.nextUrl.searchParams.get('limit')

  if (!rawLimit) {
    return DRIVER_HISTORY_DEFAULT_LIMIT
  }

  const parsedLimit = Number.parseInt(rawLimit, 10)

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    throw new DriverSessionError('History limit must be a positive integer.', 400, 'INVALID_HISTORY_LIMIT')
  }

  return Math.min(parsedLimit, DRIVER_HISTORY_MAX_LIMIT)
}

function parseDriverHistoryPage(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('page')

  if (!raw) {
    return 1
  }

  const parsed = Number.parseInt(raw, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new DriverSessionError('Page must be a positive integer.', 400, 'INVALID_HISTORY_PAGE')
  }

  return parsed
}

function parseDriverHistorySearch(request: NextRequest) {
  return request.nextUrl.searchParams.get('search')?.trim() ?? ''
}

function buildSessionSummary(session: DriverSessionRecord | null): DriverSessionSummaryDto {
  if (!session) {
    return {
      id: null,
      status: null,
      statusLabel: 'No Active Trip',
      activeRiderCount: 0,
      pendingCount: 0,
      boardedCount: 0,
      completedCount: 0,
      archivedCount: 0,
      openedAt: null,
      closedAt: null,
      canStartSession: true,
      canCloseSession: false,
    }
  }

  const pendingCount = session.riders.filter((rider) => PENDING_SECTION_RIDER_STATUSES.includes(rider.status)).length
  const boardedCount = session.riders.filter((rider) => rider.status === DriverTripSessionRiderStatus.BOARDED).length
  const completedCount = session.riders.filter((rider) => rider.status === DriverTripSessionRiderStatus.COMPLETED).length
  const archivedCount = session.riders.filter((rider) => ARCHIVED_RIDER_STATUSES.includes(rider.status)).length

  return {
    id: session.id,
    status: session.status,
    statusLabel: sessionStatusLabels[session.status],
    activeRiderCount: session.riders.filter((rider) => CLOSURE_BLOCKING_RIDER_STATUSES.includes(rider.status)).length,
    pendingCount,
    boardedCount,
    completedCount,
    archivedCount,
    openedAt: toIsoString(session.openedAt),
    closedAt: toIsoString(session.closedAt),
    canStartSession: false,
    canCloseSession: session.riders.every(
      (rider) => !CLOSE_BLOCKING_RIDER_STATUSES.includes(rider.status),
    ),
  }
}

function groupSessionRiders(session: DriverSessionRecord | null) {
  const riders = session?.riders.map(toRiderCard) ?? []

  return [
    {
      key: 'pending' as const,
      label: 'Pending',
      riders: riders.filter((rider) => PENDING_SECTION_CARD_STATUSES.includes(rider.status)),
    },
    {
      key: 'boarded' as const,
      label: 'Boarded',
      riders: riders.filter((rider) => rider.status === 'BOARDED'),
    },
    {
      key: 'completed' as const,
      label: 'Completed',
      riders: riders.filter((rider) => rider.status === 'COMPLETED'),
    },
    {
      key: 'archived' as const,
      label: 'Archived',
      riders: riders.filter((rider) => ARCHIVED_CARD_STATUSES.includes(rider.status)),
    },
  ]
}

async function requireDriverContext(request: NextRequest): Promise<DriverContext> {
  const currentUser = await verifyAuthWithSelect(request, {
    assignedVehicleId: true,
    assignedVehicleAssignedAt: true,
  })

  if (!currentUser) {
    throw new Error('Unauthorized')
  }

  if (currentUser.userType !== UserType.DRIVER) {
    throw new Error('Forbidden')
  }

  return {
    id: currentUser.id,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    username: currentUser.username,
  }
}

async function requireAssignedDriverContext(request: NextRequest): Promise<DriverVehicleContext> {
  const currentUser = await verifyAuthWithSelect(request, {
    assignedVehicleId: true,
    assignedVehicleAssignedAt: true,
  })

  if (!currentUser) {
    throw new Error('Unauthorized')
  }

  if (currentUser.userType !== UserType.DRIVER) {
    throw new Error('Forbidden')
  }

  if (!currentUser.assignedVehicleId) {
    throw new DriverSessionError('No active vehicle assignment was found for this driver account.', 404, 'DRIVER_ASSIGNMENT_MISSING')
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: currentUser.assignedVehicleId },
    select: {
      id: true,
      plateNumber: true,
      vehicleType: true,
      make: true,
      model: true,
      color: true,
    },
  })

  if (!vehicle) {
    throw new DriverSessionError('Assigned vehicle was not found.', 404, 'DRIVER_VEHICLE_NOT_FOUND')
  }

  // Every driver session route funnels through here, so one check suspends the
  // whole flow for this vehicle type: going online, going offline, and each of
  // Accept / Boarded / Dropped Off / Not Here / Full / Wrong Trip / Cancel.
  // Read-only driver routes use requireDriverContext and stay available.
  if (await isDriverAcceptSuspended(vehicle.vehicleType)) {
    throw new DriverSessionError(
      'Trip acceptance is suspended for this vehicle type. Riders record their own trips by scanning the permit QR on the vehicle.',
      409,
      'DRIVER_SESSION_SUSPENDED',
    )
  }

  return {
    id: currentUser.id,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    username: currentUser.username,
    assignedVehicleAssignedAt: currentUser.assignedVehicleAssignedAt ?? null,
    vehicle,
  }
}

async function findActiveSessionByVehicle(vehicleId: string) {
  return prisma.vehicleTripSession.findFirst({
    where: {
      vehicleId,
      status: { in: [...ACTIVE_SESSION_STATUSES] },
    },
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    select: driverSessionSelect,
  })
}

async function expireStalePendingRequestForKey(
  tx: Prisma.TransactionClient,
  activeRequestKey: string,
  now: Date,
) {
  await tx.vehicleTripSessionRider.updateMany({
    where: {
      activeRequestKey,
      status: DriverTripSessionRiderStatus.PENDING,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: DriverTripSessionRiderStatus.EXPIRED,
      activeRequestKey: null,
      finalisedAt: now,
    },
  })
}

/**
 * Cancel any other open PENDING requests this rider has in different sessions.
 * Prevents cross-session contamination when a rider submits to a different vehicle.
 */
async function cancelSupersededPendingRequestsForRider(
  tx: Prisma.TransactionClient,
  riderUserId: string,
  exceptKey: string,
  now: Date,
) {
  await tx.vehicleTripSessionRider.updateMany({
    where: {
      riderUserId,
      status: DriverTripSessionRiderStatus.PENDING,
      activeRequestKey: { not: exceptKey },
    },
    data: {
      status: DriverTripSessionRiderStatus.CANCELLED,
      activeRequestKey: null,
      finalisedAt: now,
    },
  })
}

/**
 * Expire all globally stale PENDING rows whose TTL has elapsed.
 * Safe to call at any time; idempotent. Returns the count of rows expired.
 * Provides an on-demand fallback when no background scheduler is available.
 */
export async function expireAllStalePendingRequests(now?: Date): Promise<number> {
  const cutoff = now ?? new Date()
  const result = await prisma.vehicleTripSessionRider.updateMany({
    where: {
      status: DriverTripSessionRiderStatus.PENDING,
      expiresAt: { lte: cutoff },
    },
    data: {
      status: DriverTripSessionRiderStatus.EXPIRED,
      activeRequestKey: null,
      finalisedAt: cutoff,
    },
  })
  return result.count
}

/**
 * The snapshot fields a fare calculation is built from. Structural rather than
 * tied to DriverSessionRecord so the rider-confirmed path can pass the row it
 * just created without re-reading the whole session.
 */
type FareCalculationRiderSnapshot = {
  riderUserId: string
  seatsPaid: number
  originSnapshot: string
  destinationSnapshot: string
  distanceSnapshot: Prisma.Decimal | number | string
  fareSnapshot: Prisma.Decimal | number | string
  calculationTypeSnapshot: string
  routeDataSnapshot: string | null
  discountCardIdSnapshot: string | null
  originalFareSnapshot: Prisma.Decimal | number | string | null
  discountAppliedSnapshot: Prisma.Decimal | number | string | null
  discountTypeSnapshot: DiscountType | null
}

async function createFareCalculationFromPendingRequest(
  tx: Prisma.TransactionClient,
  session: { vehicleId: string },
  rider: FareCalculationRiderSnapshot,
) {
  const fareCalculation = await tx.fareCalculation.create({
    data: {
      userId: rider.riderUserId,
      vehicleId: session.vehicleId,
      fromLocation: rider.originSnapshot,
      toLocation: rider.destinationSnapshot,
      distance: toNumber(rider.distanceSnapshot),
      calculatedFare: toNumber(rider.fareSnapshot),
      seatsPaid: rider.seatsPaid,
      calculationType: rider.calculationTypeSnapshot,
      routeData: rider.routeDataSnapshot,
      discountCardId: rider.discountCardIdSnapshot,
      originalFare: toNullableNumber(rider.originalFareSnapshot),
      discountApplied: toNullableNumber(rider.discountAppliedSnapshot),
      discountType: rider.discountTypeSnapshot,
    },
    select: {
      id: true,
    },
  })

  const originalFare = toNullableNumber(rider.originalFareSnapshot)
  const discountApplied = toNullableNumber(rider.discountAppliedSnapshot)
  const finalFare = toNumber(rider.fareSnapshot)
  const perSeatOriginalFare =
    originalFare !== null && rider.seatsPaid > 0 ? originalFare / rider.seatsPaid : 0

  if (
    rider.discountCardIdSnapshot &&
    originalFare !== null &&
    discountApplied !== null &&
    discountApplied > 0
  ) {
    await tx.discountUsageLog.create({
      data: {
        discountCardId: rider.discountCardIdSnapshot,
        fareCalculationId: fareCalculation.id,
        originalFare,
        discountAmount: discountApplied,
        finalFare,
        // Rate is a property of the card, not of the trip. On a charter the
        // discount covers only the holder's own seat, so dividing by the
        // whole-vehicle originalFare would record 0.067 for a 20% card and
        // silently corrupt any audit of discount usage. Divide by what that one
        // seat would have cost undiscounted instead.
        discountRate: perSeatOriginalFare > 0 ? discountApplied / perSeatOriginalFare : 0,
        fromLocation: rider.originSnapshot,
        toLocation: rider.destinationSnapshot,
        distance: toNumber(rider.distanceSnapshot),
        gpsCoordinates: null,
        ipAddress: null,
        isSuspicious: false,
      },
    })

    // Lazy daily-reset: if the card's lastResetDate is from a previous UTC calendar day,
    // reset dailyUsageCount to 1 (this use) instead of incrementing yesterday's count.
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    const card = await tx.discountCard.findUnique({
      where: { id: rider.discountCardIdSnapshot },
      select: { lastResetDate: true },
    })

    const lastResetUTC = card?.lastResetDate
      ? Date.UTC(
          card.lastResetDate.getUTCFullYear(),
          card.lastResetDate.getUTCMonth(),
          card.lastResetDate.getUTCDate(),
        )
      : 0
    const isNewDay = lastResetUTC < todayUTC

    await tx.discountCard.update({
      where: { id: rider.discountCardIdSnapshot },
      data: {
        lastUsedAt: now,
        usageCount: { increment: 1 },
        dailyUsageCount: isNewDay ? 1 : { increment: 1 },
        lastResetDate: isNewDay ? now : undefined,
      },
    })
  }

  return fareCalculation
}

export async function createPendingTripRequest(
  pendingTrip: PendingTripRequestCandidate,
  userType: UserType,
): Promise<PendingTripRequestResult | null> {
  if (userType !== UserType.PUBLIC || !pendingTrip.userId || !pendingTrip.vehicleId) {
    return null
  }

  const riderUserId = pendingTrip.userId
  const vehicleId = pendingTrip.vehicleId

  const activeSession = await prisma.vehicleTripSession.findFirst({
    where: {
      vehicleId,
      status: {
        in: [...ACTIVE_SESSION_STATUSES],
      },
      openedAt: {
        lte: pendingTrip.createdAt,
      },
    },
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
    },
  })

  if (!activeSession) {
    return null
  }

  const activeRequestKey = buildActiveRequestKey(activeSession.id, riderUserId)
  const now = pendingTrip.createdAt

  return prisma.$transaction(async (tx) => {
    await expireStalePendingRequestForKey(tx, activeRequestKey, now)
    await cancelSupersededPendingRequestsForRider(tx, riderUserId, activeRequestKey, now)

    const existingEntry = await tx.vehicleTripSessionRider.findFirst({
      where: {
        activeRequestKey,
      },
      select: {
        id: true,
        sessionId: true,
        fareCalculationId: true,
        status: true,
      },
    })

    if (existingEntry) {
      return {
        ...existingEntry,
        fareCalculationId: existingEntry.fareCalculationId ?? null,
        created: false,
      }
    }

    try {
      const createdEntry = await tx.vehicleTripSessionRider.create({
        data: {
          sessionId: activeSession.id,
          riderUserId,
          activeRequestKey,
          status: DriverTripSessionRiderStatus.PENDING,
          originSnapshot: pendingTrip.fromLocation,
          destinationSnapshot: pendingTrip.toLocation,
          distanceSnapshot: toNumber(pendingTrip.distance),
          fareSnapshot: toNumber(pendingTrip.calculatedFare),
          calculationTypeSnapshot: pendingTrip.calculationType,
          routeDataSnapshot: pendingTrip.routeData,
          farePolicySnapshot: pendingTrip.farePolicySnapshot,
          discountCardIdSnapshot: pendingTrip.discountCardId,
          originalFareSnapshot: toNullableNumber(pendingTrip.originalFare),
          discountAppliedSnapshot: toNullableNumber(pendingTrip.discountApplied),
          discountTypeSnapshot: pendingTrip.discountType,
          expiresAt: buildPendingRequestExpiry(now),
        },
        select: {
          id: true,
          sessionId: true,
          fareCalculationId: true,
          status: true,
        },
      })

      return {
        ...createdEntry,
        fareCalculationId: createdEntry.fareCalculationId ?? null,
        created: true,
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const collidedEntry = await tx.vehicleTripSessionRider.findFirst({
          where: {
            activeRequestKey,
          },
          select: {
            id: true,
            sessionId: true,
            fareCalculationId: true,
            status: true,
          },
        })

        if (collidedEntry) {
          return {
            ...collidedEntry,
            fareCalculationId: collidedEntry.fareCalculationId ?? null,
            created: false,
          }
        }
      }

      throw error
    }
  })
}

/**
 * Records a trip the rider commits to themselves, for a vehicle type suspended
 * from the driver session flow.
 *
 * The driver holds no phone here: the rider scans the permit QR printed on the
 * vehicle, so by the time this runs they are already aboard. The row therefore
 * starts at BOARDED and the FareCalculation is written immediately — there is
 * nobody to accept it later, and nothing to time out. The rider ends the trip
 * with applyRiderTripAction.
 */
/**
 * Seats are clamped, never trusted. A client computing a charter from a stale
 * cached capacity would otherwise buy more seats than the vehicle has, and the
 * ceiling — not the client — is authoritative.
 */
function clampSeatsRequested(
  requested: number | null | undefined,
  capacity: number,
): number {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) {
    return 1
  }

  return Math.min(Math.max(Math.floor(requested), 1), capacity)
}

export async function createRiderConfirmedTrip(
  pendingTrip: PendingTripRequestCandidate,
  userType: UserType,
): Promise<PendingTripRequestResult | null> {
  if (userType !== UserType.PUBLIC || !pendingTrip.userId || !pendingTrip.vehicleId) {
    return null
  }

  const riderUserId = pendingTrip.userId
  const vehicleId = pendingTrip.vehicleId
  const now = pendingTrip.createdAt

  // Resolved before the transaction opens on purpose: resolveSeatCapacity reads
  // the settings cache through the global client, and taking a second
  // connection while a transaction holds one can exhaust a pool of 5.
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { vehicleType: true, capacity: true },
  })

  const resolvedCapacity = await resolveSeatCapacity(
    vehicle?.vehicleType,
    vehicle?.capacity,
  )

  // Null capacity means the type is not seat-managed: no ceiling, no charter,
  // and every rider takes exactly one seat.
  const seatsRequested =
    resolvedCapacity === null
      ? 1
      : clampSeatsRequested(pendingTrip.seatsPaid, resolvedCapacity)

  return prisma.$transaction(async (tx) => {
    // Reuse an open rider-initiated session for this vehicle rather than opening
    // one per passenger: a tricycle carries several riders on the same run.
    const existingSession = await tx.vehicleTripSession.findFirst({
      where: {
        vehicleId,
        initiatedBy: DriverTripSessionInitiator.RIDER,
        status: { in: [...ACTIVE_SESSION_STATUSES] },
      },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, seatCapacitySnapshot: true },
    })

    const session =
      existingSession ??
      (await tx.vehicleTripSession.create({
        data: {
          vehicleId,
          driverUserId: null,
          initiatedBy: DriverTripSessionInitiator.RIDER,
          status: DriverTripSessionStatus.IN_PROGRESS,
          openedAt: now,
          // Snapshotted so an admin lowering the standard mid-run cannot
          // strand riders already aboard, and so a charter's price can never
          // disagree with the ceiling that priced it.
          seatCapacitySnapshot: resolvedCapacity,
        },
        select: { id: true, seatCapacitySnapshot: true },
      }))

    const activeRequestKey = buildActiveRequestKey(session.id, riderUserId)

    await cancelSupersededPendingRequestsForRider(tx, riderUserId, activeRequestKey, now)

    const existingEntry = await tx.vehicleTripSessionRider.findFirst({
      where: { activeRequestKey },
      select: {
        id: true,
        sessionId: true,
        fareCalculationId: true,
        status: true,
      },
    })

    // The rider is already on this vehicle in this session — their previous
    // scan stands rather than being double-charged by a retry.
    //
    // This must stay ahead of the capacity check below: a rider whose scan
    // succeeded and whose network then dropped would otherwise be refused by
    // the seats their own first scan is holding.
    if (existingEntry) {
      return {
        ...existingEntry,
        fareCalculationId: existingEntry.fareCalculationId ?? null,
        created: false,
      }
    }

    // Sessions opened before seat accounting existed carry no snapshot; fall
    // back to the ceiling in force now rather than treating null as unlimited.
    const seatCeiling = session.seatCapacitySnapshot ?? resolvedCapacity

    if (seatCeiling !== null) {
      const aboard = await tx.vehicleTripSessionRider.findMany({
        where: {
          sessionId: session.id,
          status: { in: [...CLOSE_BLOCKING_RIDER_STATUSES] },
        },
        select: { seatsPaid: true },
      })

      const occupied = aboard.reduce((sum, entry) => sum + entry.seatsPaid, 0)

      if (occupied + seatsRequested > seatCeiling) {
        // Refusing writes no FareCalculation, which is the point: issuing one
        // would record a fare the ordinance does not permit. The rider is told
        // why and offered a report instead — they are the natural witness, and
        // a silent refusal just puts them aboard with no record at all.
        throw new DriverSessionError(
          'This vehicle has no seats left. Another passenger has already paid for them.',
          409,
          'VEHICLE_AT_CAPACITY',
          {
            occupied,
            capacity: seatCeiling,
            seatsRequested,
            chartered: aboard.some((entry) => entry.seatsPaid > 1),
          },
        )
      }
    }

    const riderSnapshot = {
      riderUserId,
      seatsPaid: seatsRequested,
      originSnapshot: pendingTrip.fromLocation,
      destinationSnapshot: pendingTrip.toLocation,
      distanceSnapshot: toNumber(pendingTrip.distance),
      fareSnapshot: toNumber(pendingTrip.calculatedFare),
      calculationTypeSnapshot: pendingTrip.calculationType,
      routeDataSnapshot: pendingTrip.routeData,
      discountCardIdSnapshot: pendingTrip.discountCardId,
      originalFareSnapshot: toNullableNumber(pendingTrip.originalFare),
      discountAppliedSnapshot: toNullableNumber(pendingTrip.discountApplied),
      discountTypeSnapshot: pendingTrip.discountType,
    }

    const fareCalculation = await createFareCalculationFromPendingRequest(
      tx,
      { vehicleId },
      riderSnapshot,
    )

    const createdEntry = await tx.vehicleTripSessionRider.create({
      data: {
        sessionId: session.id,
        riderUserId,
        activeRequestKey,
        fareCalculationId: fareCalculation.id,
        status: DriverTripSessionRiderStatus.BOARDED,
        originSnapshot: pendingTrip.fromLocation,
        destinationSnapshot: pendingTrip.toLocation,
        distanceSnapshot: toNumber(pendingTrip.distance),
        fareSnapshot: toNumber(pendingTrip.calculatedFare),
        seatsPaid: seatsRequested,
        calculationTypeSnapshot: pendingTrip.calculationType,
        routeDataSnapshot: pendingTrip.routeData,
        farePolicySnapshot: pendingTrip.farePolicySnapshot,
        discountCardIdSnapshot: pendingTrip.discountCardId,
        originalFareSnapshot: toNullableNumber(pendingTrip.originalFare),
        discountAppliedSnapshot: toNullableNumber(pendingTrip.discountApplied),
        discountTypeSnapshot: pendingTrip.discountType,
        // No TTL: the rider is aboard, so there is no offer left hanging.
        expiresAt: null,
        acceptedAt: now,
        boardedAt: now,
      },
      select: {
        id: true,
        sessionId: true,
        fareCalculationId: true,
        status: true,
      },
    })

    await tx.vehicleTripSessionRiderEvent.create({
      data: {
        sessionRiderId: createdEntry.id,
        action: DriverTripSessionRiderAction.ACCEPT,
        fromStatus: DriverTripSessionRiderStatus.PENDING,
        toStatus: DriverTripSessionRiderStatus.BOARDED,
        actedByUserId: riderUserId,
      },
    })

    return {
      ...createdEntry,
      fareCalculationId: createdEntry.fareCalculationId ?? null,
      created: true,
    }
  })
}

/**
 * Ends a rider-initiated trip. The rider owns these transitions because no
 * driver is running the session.
 */
export async function applyRiderTripAction(
  riderUserId: string,
  sessionRiderId: string,
  action: RiderTripActionDto,
): Promise<{ status: DriverTripSessionRiderStatus; message: string }> {
  const actionConfig = riderTripActionConfig[action]

  if (!actionConfig) {
    throw new DriverSessionError('Unsupported rider action.', 400, 'INVALID_RIDER_ACTION')
  }

  const rider = await prisma.vehicleTripSessionRider.findFirst({
    where: { id: sessionRiderId, riderUserId },
    select: {
      id: true,
      status: true,
      sessionId: true,
      session: { select: { id: true, initiatedBy: true, status: true } },
    },
  })

  if (!rider) {
    throw new DriverSessionError('Trip not found for this rider.', 404, 'SESSION_RIDER_NOT_FOUND')
  }

  if (rider.session.initiatedBy !== DriverTripSessionInitiator.RIDER) {
    throw new DriverSessionError(
      'This trip is managed by the driver. Ask the driver to close it.',
      409,
      'RIDER_ACTION_NOT_ALLOWED',
    )
  }

  if (!actionConfig.from.includes(rider.status)) {
    // Idempotency: a retry after a successful tap reports success rather than a
    // confusing transition error.
    if (rider.status === actionConfig.to) {
      return { status: rider.status, message: `${actionConfig.label} saved.` }
    }

    throw new DriverSessionError(
      "That action is not allowed for this trip's current status.",
      409,
      'INVALID_RIDER_TRANSITION',
    )
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const updateResult = await tx.vehicleTripSessionRider.updateMany({
      where: { id: rider.id, status: rider.status },
      data: {
        status: actionConfig.to,
        completedAt: actionConfig.to === DriverTripSessionRiderStatus.COMPLETED ? now : undefined,
        activeRequestKey: null,
        finalisedAt: now,
      },
    })

    if (updateResult.count !== 1) {
      throw new DriverSessionError(
        'That trip was already updated by another action.',
        409,
        'SESSION_RIDER_ALREADY_UPDATED',
      )
    }

    await tx.vehicleTripSessionRiderEvent.create({
      data: {
        sessionRiderId: rider.id,
        action: actionConfig.event,
        fromStatus: rider.status,
        toStatus: actionConfig.to,
        actedByUserId: riderUserId,
      },
    })

    await closeRiderSessionIfEmpty(tx, rider.sessionId, now)
  })

  return { status: actionConfig.to, message: `${actionConfig.label} saved.` }
}

/**
 * Closes a rider-initiated session once nobody is still aboard. Nobody goes
 * offline on this flow, so the session's life is the life of its riders.
 */
async function closeRiderSessionIfEmpty(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
) {
  const remaining = await tx.vehicleTripSessionRider.count({
    where: {
      sessionId,
      status: { in: [...CLOSE_BLOCKING_RIDER_STATUSES] },
    },
  })

  if (remaining > 0) {
    return
  }

  await tx.vehicleTripSession.updateMany({
    where: {
      id: sessionId,
      initiatedBy: DriverTripSessionInitiator.RIDER,
      status: { in: [...ACTIVE_SESSION_STATUSES] },
    },
    data: {
      status: DriverTripSessionStatus.CLOSED,
      closedAt: now,
    },
  })
}

/** Riders who forget to tap Dropped off. The fare is already recorded, so
 * completing the row states what happened rather than inventing anything. */
export const RIDER_TRIP_AUTO_COMPLETE_AFTER_MS = 4 * 60 * 60 * 1000

export async function autoCompleteStaleRiderTrips(now?: Date): Promise<number> {
  const cutoffNow = now ?? new Date()
  const cutoff = new Date(cutoffNow.getTime() - RIDER_TRIP_AUTO_COMPLETE_AFTER_MS)

  const stale = await prisma.vehicleTripSessionRider.findMany({
    where: {
      status: DriverTripSessionRiderStatus.BOARDED,
      boardedAt: { lte: cutoff },
      session: { initiatedBy: DriverTripSessionInitiator.RIDER },
    },
    select: { id: true, sessionId: true },
  })

  if (stale.length === 0) {
    return 0
  }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTripSessionRider.updateMany({
      where: { id: { in: stale.map((entry) => entry.id) } },
      data: {
        status: DriverTripSessionRiderStatus.COMPLETED,
        completedAt: cutoffNow,
        finalisedAt: cutoffNow,
        activeRequestKey: null,
      },
    })

    // No rider event row: VehicleTripSessionRiderEvent.actedByUserId records a
    // person, and nobody acted here. expireAllStalePendingRequests takes the
    // same line for its system transitions.

    for (const sessionId of new Set(stale.map((entry) => entry.sessionId))) {
      await closeRiderSessionIfEmpty(tx, sessionId, cutoffNow)
    }
  })

  return stale.length
}

/**
 * Closes every open session for vehicle types an admin has just suspended, so
 * no driver is left stranded online with a queue they can no longer act on.
 * Riders already aboard are completed — the fare was recorded on ACCEPT.
 */
export async function closeSessionsForSuspendedVehicleTypes(
  vehicleTypes: readonly string[],
  now: Date = new Date(),
): Promise<number> {
  if (vehicleTypes.length === 0) {
    return 0
  }

  const sessions = await prisma.vehicleTripSession.findMany({
    where: {
      initiatedBy: DriverTripSessionInitiator.DRIVER,
      status: { in: [...ACTIVE_SESSION_STATUSES] },
      vehicle: { vehicleType: { in: vehicleTypes as never } },
    },
    select: { id: true },
  })

  if (sessions.length === 0) {
    return 0
  }

  const sessionIds = sessions.map((session) => session.id)

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTripSessionRider.updateMany({
      where: {
        sessionId: { in: sessionIds },
        status: DriverTripSessionRiderStatus.PENDING,
      },
      data: {
        status: DriverTripSessionRiderStatus.EXPIRED,
        activeRequestKey: null,
        finalisedAt: now,
      },
    })

    await tx.vehicleTripSessionRider.updateMany({
      where: {
        sessionId: { in: sessionIds },
        status: {
          in: [DriverTripSessionRiderStatus.ACCEPTED, DriverTripSessionRiderStatus.BOARDED],
        },
      },
      data: {
        status: DriverTripSessionRiderStatus.COMPLETED,
        completedAt: now,
        finalisedAt: now,
        activeRequestKey: null,
      },
    })

    await tx.vehicleTripSession.updateMany({
      where: { id: { in: sessionIds } },
      data: {
        status: DriverTripSessionStatus.CLOSED,
        closedAt: now,
      },
    })
  })

  return sessionIds.length
}

async function findDriverSessionOrThrow(driverContext: DriverVehicleContext, sessionId: string) {
  const session = await prisma.vehicleTripSession.findFirst({
    where: {
      id: sessionId,
      vehicleId: driverContext.vehicle.id,
    },
    select: driverSessionSelect,
  })

  if (!session) {
    throw new DriverSessionError('Trip session not found for this assigned vehicle.', 404, 'SESSION_NOT_FOUND')
  }

  if (!ACTIVE_SESSION_STATUSES.includes(session.status)) {
    throw new DriverSessionError('This trip session is already closed.', 409, 'SESSION_CLOSED')
  }

  return session
}

export async function getDriverSessionActiveResponse(request: NextRequest): Promise<DriverSessionActiveResponseDto> {
  const driverContext = await requireAssignedDriverContext(request)
  // Lazily expire TTL-elapsed PENDING requests before reading, so the driver
  // never sees a stale "pending" card they can't act on (expiry is otherwise
  // only enforced on action or by the background sweeper).
  await expireAllStalePendingRequests()
  const session = await findActiveSessionByVehicle(driverContext.vehicle.id)

  return {
    driver: {
      id: driverContext.id,
      firstName: driverContext.firstName,
      lastName: driverContext.lastName,
      username: driverContext.username,
    },
    vehicle: {
      id: driverContext.vehicle.id,
      plateNumber: driverContext.vehicle.plateNumber,
      vehicleType: driverContext.vehicle.vehicleType,
      make: driverContext.vehicle.make,
      model: driverContext.vehicle.model,
      color: driverContext.vehicle.color,
      assignedAt: toIsoString(driverContext.assignedVehicleAssignedAt),
    },
    session: buildSessionSummary(session),
    sections: groupSessionRiders(session),
  }
}

export async function getDriverSessionHistoryResponse(request: NextRequest): Promise<DriverSessionHistoryResponseDto> {
  const driverContext = await requireDriverContext(request)
  const limit = parseDriverHistoryLimit(request)
  const page = parseDriverHistoryPage(request)
  const search = parseDriverHistorySearch(request)

  const baseWhere: Prisma.VehicleTripSessionWhereInput = {
    driverUserId: driverContext.id,
    status: DriverTripSessionStatus.CLOSED,
    closedAt: { not: null },
    ...(search
      ? {
          riders: {
            some: {
              OR: [
                { originSnapshot: { contains: search, mode: 'insensitive' } },
                { destinationSnapshot: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        }
      : {}),
  }

  const [sessions, total] = await prisma.$transaction([
    prisma.vehicleTripSession.findMany({
      where: baseWhere,
      orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: driverHistorySessionSelect,
    }),
    prisma.vehicleTripSession.count({ where: baseWhere }),
  ])

  return {
    items: sessions.map(toHistoryItem),
    limit,
    page,
    total,
    totalPages: total === 0 ? 1 : Math.ceil(total / limit),
  }
}

export async function startDriverSession(request: NextRequest): Promise<DriverSessionActiveResponseDto> {
  const driverContext = await requireAssignedDriverContext(request)
  let session = await findActiveSessionByVehicle(driverContext.vehicle.id)

  if (!session) {
    try {
      await prisma.vehicleTripSession.create({
        data: {
          vehicleId: driverContext.vehicle.id,
          driverUserId: driverContext.id,
          status: DriverTripSessionStatus.OPEN,
        },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
        throw error
      }
    }

    session = await findActiveSessionByVehicle(driverContext.vehicle.id)
  }

  if (!session) {
    throw new DriverSessionError('Unable to start a trip session for this vehicle.', 500, 'SESSION_START_FAILED')
  }

  return getDriverSessionActiveResponse(request)
}

export async function closeDriverSession(request: NextRequest, sessionId: string): Promise<DriverSessionActiveResponseDto> {
  const driverContext = await requireAssignedDriverContext(request)
  const session = await findDriverSessionOrThrow(driverContext, sessionId)

  // Going offline never waits on unanswered requests: expire any PENDING riders
  // up front so a stale/expired public request can't trap the driver online.
  if (session.riders.some((rider) => rider.status === DriverTripSessionRiderStatus.PENDING)) {
    await prisma.vehicleTripSessionRider.updateMany({
      where: { sessionId: session.id, status: DriverTripSessionRiderStatus.PENDING },
      data: {
        status: DriverTripSessionRiderStatus.EXPIRED,
        activeRequestKey: null,
        finalisedAt: new Date(),
      },
    })
  }

  if (session.riders.some((rider) => CLOSE_BLOCKING_RIDER_STATUSES.includes(rider.status))) {
    throw new DriverSessionError('Finish or clear active riders before closing this trip.', 409, 'SESSION_HAS_ACTIVE_RIDERS')
  }

  await prisma.vehicleTripSession.update({
    where: { id: session.id },
    data: {
      status: DriverTripSessionStatus.CLOSED,
      closedAt: new Date(),
    },
  })

  return getDriverSessionActiveResponse(request)
}

export async function applyDriverSessionAction(
  request: NextRequest,
  sessionId: string,
  sessionRiderId: string,
  action: DriverSessionActionDto,
): Promise<DriverSessionActionResponseDto> {
  const driverContext = await requireAssignedDriverContext(request)
  const session = await findDriverSessionOrThrow(driverContext, sessionId)
  const rider = session.riders.find((entry) => entry.id === sessionRiderId)

  if (!rider) {
    throw new DriverSessionError('Rider entry not found in this trip session.', 404, 'SESSION_RIDER_NOT_FOUND')
  }

  const managedAction = action as DriverManagedRiderAction
  const actionConfig = riderActionConfig[managedAction]

  if (!actionConfig) {
    throw new DriverSessionError('Unsupported driver action.', 400, 'INVALID_DRIVER_ACTION')
  }

  if (!actionConfig.from.includes(rider.status)) {
    // Idempotency guard: if ACCEPT already succeeded (rider is in or past the target
    // state), return the current state instead of a misleading transition error.
    // This covers transient network failures where the driver retries a successful ACCEPT.
    if (
      action === DriverTripSessionRiderAction.ACCEPT &&
      (rider.status === DriverTripSessionRiderStatus.BOARDED ||
        rider.status === DriverTripSessionRiderStatus.ACCEPTED)
    ) {
      const refreshed = await prisma.vehicleTripSession.findUnique({
        where: { id: session.id },
        select: driverSessionSelect,
      })
      const refreshedRider = refreshed?.riders.find((e) => e.id === rider.id)
      if (refreshed && refreshedRider) {
        return {
          success: true,
          session: buildSessionSummary(refreshed),
          rider: toRiderCard(refreshedRider),
          message: 'Rider already accepted.',
        }
      }
    }
    throw new DriverSessionError('That action is not allowed for the rider\'s current status.', 409, 'INVALID_RIDER_TRANSITION')
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    if (
      rider.status === DriverTripSessionRiderStatus.PENDING &&
      rider.expiresAt &&
      rider.expiresAt <= now
    ) {
      await tx.vehicleTripSessionRider.updateMany({
        where: {
          id: rider.id,
          status: DriverTripSessionRiderStatus.PENDING,
        },
        data: {
          status: DriverTripSessionRiderStatus.EXPIRED,
          activeRequestKey: null,
          finalisedAt: now,
        },
      })

      throw new DriverSessionError('This rider request already expired.', 409, 'SESSION_RIDER_EXPIRED')
    }

    let fareCalculationId: string | undefined

    if (action === DriverTripSessionRiderAction.ACCEPT) {
      const fareCalculation = await createFareCalculationFromPendingRequest(tx, session, rider)
      fareCalculationId = fareCalculation.id
    }

    const updateResult = await tx.vehicleTripSessionRider.updateMany({
      where: {
        id: rider.id,
        status: rider.status,
        fareCalculationId:
          action === DriverTripSessionRiderAction.ACCEPT ? null : rider.fareCalculationId ?? undefined,
      },
      data: {
        status: actionConfig.to,
        fareCalculationId,
        acceptedAt: action === DriverTripSessionRiderAction.ACCEPT ? now : undefined,
        boardedAt: (action === DriverTripSessionRiderAction.ACCEPT || action === DriverTripSessionRiderAction.BOARDED) ? now : undefined,
        completedAt: action === DriverTripSessionRiderAction.DROPPED_OFF ? now : undefined,
        expiresAt:
          action === DriverTripSessionRiderAction.ACCEPT
            ? null
            : undefined,
        activeRequestKey: FINALIZED_RIDER_STATUSES.includes(actionConfig.to)
          ? null
          : undefined,
        finalisedAt: FINALIZED_RIDER_STATUSES.includes(actionConfig.to)
          ? now
          : undefined,
      },
    })

    if (updateResult.count !== 1) {
      throw new DriverSessionError('That rider request was already updated by another action.', 409, 'SESSION_RIDER_ALREADY_UPDATED')
    }

    await tx.vehicleTripSessionRiderEvent.create({
      data: {
        sessionRiderId: rider.id,
        action: action as DriverTripSessionRiderAction,
        fromStatus: rider.status,
        toStatus: actionConfig.to,
        actedByUserId: driverContext.id,
      },
    })

    if (actionConfig.to === DriverTripSessionRiderStatus.BOARDED && session.status === DriverTripSessionStatus.OPEN) {
      await tx.vehicleTripSession.update({
        where: { id: session.id },
        data: {
          status: DriverTripSessionStatus.IN_PROGRESS,
        },
      })
    }
  })

  const refreshed = await prisma.vehicleTripSession.findUnique({
    where: { id: session.id },
    select: driverSessionSelect,
  })

  if (!refreshed) {
    throw new DriverSessionError('Trip session not found after updating rider status.', 500, 'SESSION_REFRESH_FAILED')
  }

  const refreshedRider = refreshed.riders.find((entry) => entry.id === rider.id)

  if (!refreshedRider) {
    throw new DriverSessionError('Updated rider entry could not be loaded.', 500, 'SESSION_RIDER_REFRESH_FAILED')
  }

  return {
    success: true,
    session: buildSessionSummary(refreshed),
    rider: toRiderCard(refreshedRider),
    message: `${actionConfig.label} saved.`,
  }
}

export async function attachFareCalculationToActiveDriverSession(
  fareCalculation: PendingTripRequestCandidate,
  userType: UserType,
) {
  return createPendingTripRequest(fareCalculation, userType)
}