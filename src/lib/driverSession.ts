import type { NextRequest } from 'next/server'

import {
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
  DriverSessionRiderCardDto,
  DriverSessionSummaryDto,
} from '@/lib/contracts'
import { verifyAuthWithSelect } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ACTIVE_SESSION_STATUSES = [DriverTripSessionStatus.OPEN, DriverTripSessionStatus.IN_PROGRESS] as const
const CLOSURE_BLOCKING_RIDER_STATUSES = [
  DriverTripSessionRiderStatus.PENDING,
  DriverTripSessionRiderStatus.ACCEPTED,
  DriverTripSessionRiderStatus.BOARDED,
] as const

const riderActionConfig: Record<
  DriverTripSessionRiderAction,
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
}

const sessionStatusLabels: Record<DriverTripSessionStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
}

const driverSessionSelect = {
  id: true,
  status: true,
  openedAt: true,
  closedAt: true,
  riders: {
    orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      fareCalculationId: true,
      status: true,
      originSnapshot: true,
      destinationSnapshot: true,
      fareSnapshot: true,
      discountTypeSnapshot: true,
      joinedAt: true,
    },
  },
} satisfies Prisma.VehicleTripSessionSelect

type DriverSessionRecord = Prisma.VehicleTripSessionGetPayload<{ select: typeof driverSessionSelect }>

type DriverContext = {
  id: string
  firstName: string
  lastName: string
  username: string
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

type FareCalculationJoinCandidate = {
  id: string
  userId: string | null
  vehicleId: string | null
  fromLocation: string
  toLocation: string
  calculatedFare: Prisma.Decimal | number | string
  discountType: string | null
  createdAt: Date
}

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
    fareCalculationId: rider.fareCalculationId,
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

  const pendingCount = session.riders.filter((rider) =>
    [DriverTripSessionRiderStatus.PENDING, DriverTripSessionRiderStatus.ACCEPTED].includes(rider.status),
  ).length
  const boardedCount = session.riders.filter((rider) => rider.status === DriverTripSessionRiderStatus.BOARDED).length
  const completedCount = session.riders.filter((rider) => rider.status === DriverTripSessionRiderStatus.COMPLETED).length
  const archivedCount = session.riders.filter((rider) =>
    [
      DriverTripSessionRiderStatus.REJECTED_NOT_HERE,
      DriverTripSessionRiderStatus.REJECTED_FULL,
      DriverTripSessionRiderStatus.REJECTED_WRONG_TRIP,
      DriverTripSessionRiderStatus.CANCELLED,
    ].includes(rider.status),
  ).length

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
      riders: riders.filter((rider) => ['PENDING', 'ACCEPTED'].includes(rider.status)),
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
      riders: riders.filter((rider) =>
        ['REJECTED_NOT_HERE', 'REJECTED_FULL', 'REJECTED_WRONG_TRIP', 'CANCELLED'].includes(rider.status),
      ),
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

async function findDriverSessionOrThrow(driverContext: DriverContext, sessionId: string) {
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
  const driverContext = await requireDriverContext(request)
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

export async function startDriverSession(request: NextRequest): Promise<DriverSessionActiveResponseDto> {
  const driverContext = await requireDriverContext(request)
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
  const driverContext = await requireDriverContext(request)
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
  const driverContext = await requireDriverContext(request)
  const session = await findDriverSessionOrThrow(driverContext, sessionId)
  const rider = session.riders.find((entry) => entry.id === sessionRiderId)

  if (!rider) {
    throw new DriverSessionError('Rider entry not found in this trip session.', 404, 'SESSION_RIDER_NOT_FOUND')
  }

  const actionConfig = riderActionConfig[action as DriverTripSessionRiderAction]

  if (!actionConfig) {
    throw new DriverSessionError('Unsupported driver action.', 400, 'INVALID_DRIVER_ACTION')
  }

  if (!actionConfig.from.includes(rider.status)) {
    throw new DriverSessionError('That action is not allowed for the rider\'s current status.', 409, 'INVALID_RIDER_TRANSITION')
  }

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.vehicleTripSessionRider.update({
      where: { id: rider.id },
      data: {
        status: actionConfig.to,
        acceptedAt: action === DriverTripSessionRiderAction.ACCEPT ? now : undefined,
        boardedAt: action === DriverTripSessionRiderAction.BOARDED ? now : undefined,
        completedAt: action === DriverTripSessionRiderAction.DROPPED_OFF ? now : undefined,
        finalisedAt: [
          DriverTripSessionRiderStatus.COMPLETED,
          DriverTripSessionRiderStatus.REJECTED_NOT_HERE,
          DriverTripSessionRiderStatus.REJECTED_FULL,
          DriverTripSessionRiderStatus.REJECTED_WRONG_TRIP,
          DriverTripSessionRiderStatus.CANCELLED,
        ].includes(actionConfig.to)
          ? now
          : undefined,
      },
    })

    await tx.vehicleTripSessionRiderEvent.create({
      data: {
        sessionRiderId: rider.id,
        action: action as DriverTripSessionRiderAction,
        fromStatus: rider.status,
        toStatus: actionConfig.to,
        actedByUserId: driverContext.id,
      },
    })

    if (action === DriverTripSessionRiderAction.BOARDED && session.status === DriverTripSessionStatus.OPEN) {
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
    message: `${riderActionConfig[action as DriverTripSessionRiderAction].label} saved.`,
  }
}

export async function attachFareCalculationToActiveDriverSession(
  fareCalculation: FareCalculationJoinCandidate,
  userType: UserType,
) {
  if (userType !== UserType.PUBLIC || !fareCalculation.userId || !fareCalculation.vehicleId) {
    return null
  }

  const activeSession = await prisma.vehicleTripSession.findFirst({
    where: {
      vehicleId: fareCalculation.vehicleId,
      status: {
        in: [...ACTIVE_SESSION_STATUSES],
      },
      openedAt: {
        lte: fareCalculation.createdAt,
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

  const existingEntry = await prisma.vehicleTripSessionRider.findUnique({
    where: {
      fareCalculationId: fareCalculation.id,
    },
    select: {
      id: true,
      sessionId: true,
    },
  })

  if (existingEntry) {
    return existingEntry
  }

  try {
    return await prisma.vehicleTripSessionRider.create({
      data: {
        sessionId: activeSession.id,
        fareCalculationId: fareCalculation.id,
        riderUserId: fareCalculation.userId,
        status: DriverTripSessionRiderStatus.PENDING,
        originSnapshot: fareCalculation.fromLocation,
        destinationSnapshot: fareCalculation.toLocation,
        fareSnapshot: toNumber(fareCalculation.calculatedFare),
        discountTypeSnapshot: fareCalculation.discountType,
      },
      select: {
        id: true,
        sessionId: true,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.vehicleTripSessionRider.findUnique({
        where: {
          fareCalculationId: fareCalculation.id,
        },
        select: {
          id: true,
          sessionId: true,
        },
      })
    }

    throw error
  }
}