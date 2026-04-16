import type { NextRequest } from 'next/server'

import {
  DiscountType,
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
} from '@/lib/contracts'
import { verifyAuthWithSelect } from '@/lib/auth'
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
    to: DriverTripSessionRiderStatus.ACCEPTED,
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

  constructor(message: string, status = 400, code = 'DRIVER_SESSION_ERROR') {
    super(message)
    this.name = 'DriverSessionError'
    this.status = status
    this.code = code
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
      (rider) => !CLOSURE_BLOCKING_RIDER_STATUSES.includes(rider.status),
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

async function createFareCalculationFromPendingRequest(
  tx: Prisma.TransactionClient,
  session: DriverSessionRecord,
  rider: DriverSessionRecord['riders'][number],
) {
  const fareCalculation = await tx.fareCalculation.create({
    data: {
      userId: rider.riderUserId,
      vehicleId: session.vehicleId,
      fromLocation: rider.originSnapshot,
      toLocation: rider.destinationSnapshot,
      distance: toNumber(rider.distanceSnapshot),
      calculatedFare: toNumber(rider.fareSnapshot),
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
        discountRate: originalFare > 0 ? discountApplied / originalFare : 0,
        fromLocation: rider.originSnapshot,
        toLocation: rider.destinationSnapshot,
        distance: toNumber(rider.distanceSnapshot),
        gpsCoordinates: null,
        ipAddress: null,
        isSuspicious: false,
      },
    })

    await tx.discountCard.update({
      where: { id: rider.discountCardIdSnapshot },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
        dailyUsageCount: { increment: 1 },
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

  const sessions = await prisma.vehicleTripSession.findMany({
    where: {
      driverUserId: driverContext.id,
      status: DriverTripSessionStatus.CLOSED,
      closedAt: { not: null },
    },
    orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
    take: limit,
    select: driverHistorySessionSelect,
  })

  return {
    items: sessions.map(toHistoryItem),
    limit,
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

  if (session.riders.some((rider) => CLOSURE_BLOCKING_RIDER_STATUSES.includes(rider.status))) {
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
        boardedAt: action === DriverTripSessionRiderAction.BOARDED ? now : undefined,
        completedAt: action === DriverTripSessionRiderAction.DROPPED_OFF ? now : undefined,
        expiresAt:
          action === DriverTripSessionRiderAction.ACCEPT || action === DriverTripSessionRiderAction.BOARDED
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