import bcrypt from 'bcryptjs'
import { Prisma, UserType } from '@prisma/client'

import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'

/** Select shape consumable by toAdminUserDto. */
export const driverAccountUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  userType: true,
  isActive: true,
  createdAt: true,
  phoneNumber: true,
  governmentId: true,
  barangayResidence: true,
  reasonForRegistration: true,
  assignedVehicle: {
    select: {
      id: true,
      plateNumber: true,
      vehicleType: true,
      permit: {
        select: {
          permitPlateNumber: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect

export type DriverAccountUser = Prisma.UserGetPayload<{ select: typeof driverAccountUserSelect }>

export function splitDriverDisplayName(fullName: string) {
  const normalizedName = fullName.trim().replace(/\s+/g, ' ')
  const nameParts = normalizedName.split(' ')

  if (nameParts.length === 1) {
    return {
      firstName: normalizedName,
      lastName: 'Driver',
    }
  }

  return {
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' '),
  }
}

export function generateTempPassword(): string {
  return Math.random().toString(36).slice(-8)
}

export interface ProvisionDriverAccountInput {
  vehicleId: string
  plateNumber: string
  driverFullName: string
  actorId: string
  /** Caller-supplied temp password; auto-generated when omitted. */
  tempPassword?: string
}

export interface ProvisionDriverAccountResult {
  created: boolean
  username: string
  /** Only present when an account was created (idempotent re-runs return created=false). */
  tempPassword?: string
  user?: DriverAccountUser
}

/**
 * Creates a DRIVER login account for a vehicle: username = normalized plate, name
 * pulled from the vehicle/permit (no personal info re-entry). Idempotent — if an
 * account already exists for this vehicle or username, returns { created: false }
 * instead of throwing, so it never breaks the caller's primary action (e.g. permit
 * creation). Must run inside a Prisma transaction.
 */
export async function provisionDriverAccount(
  tx: Prisma.TransactionClient,
  input: ProvisionDriverAccountInput,
): Promise<ProvisionDriverAccountResult> {
  const username = normalizePlateNumber(input.plateNumber) || ''
  if (!username) {
    throw new Error('The selected vehicle is missing a usable BPLO-issued plate number')
  }

  const driverName = input.driverFullName?.trim() || ''
  if (!driverName) {
    throw new Error('The selected vehicle does not have an encoder-registered driver name yet')
  }

  const existing = await tx.user.findFirst({
    where: { OR: [{ assignedVehicleId: input.vehicleId }, { username }] },
    select: { username: true },
  })

  if (existing) {
    return { created: false, username: existing.username }
  }

  const tempPassword = input.tempPassword?.trim() || generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 12)
  const { firstName, lastName } = splitDriverDisplayName(driverName)
  const now = new Date()

  const user = await tx.user.create({
    data: {
      firstName,
      lastName,
      username,
      password: hashedPassword,
      phoneNumber: null,
      userType: UserType.DRIVER,
      assignedVehicleId: input.vehicleId,
      assignedVehicleAssignedAt: now,
      assignedVehicleAssignedBy: input.actorId,
      isActive: true,
      isVerified: true,
      verifiedAt: now,
    },
    select: driverAccountUserSelect,
  })

  await tx.adminUserCreation.create({
    data: {
      requestedBy: input.actorId,
      userType: UserType.DRIVER,
      firstName,
      lastName,
      phoneNumber: '',
      assignedVehicleId: input.vehicleId,
      isActive: true,
      approvedBy: input.actorId,
      approvedAt: now,
      createdUserId: user.id,
    },
  })

  await tx.driverVehicleAssignmentHistory.create({
    data: {
      userId: user.id,
      vehicleId: input.vehicleId,
      assignedBy: input.actorId,
      reason: 'Initial driver account provisioning',
    },
  })

  return { created: true, username, tempPassword, user }
}
