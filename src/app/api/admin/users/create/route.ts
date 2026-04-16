import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserType } from '@prisma/client'
import { ADMIN_ONLY, requireRequestRole } from '@/lib/auth'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'
import { toAdminUserDto, type AdminUserCreateData } from '@/lib/admin/user-management-contract'
import {
  createAdminRouteAuthError,
  createAdminRouteError,
  createAdminRouteSuccess,
} from '@/lib/admin/user-management-route'

const ALLOWED_OFFICIAL_USER_TYPES = new Set<UserType>([
  UserType.ADMIN,
  UserType.DATA_ENCODER,
  UserType.ENFORCER,
  UserType.DRIVER,
])

function splitDriverDisplayName(fullName: string) {
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

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY])

    const body = await request.json()
    const {
      firstName,
      lastName,
      username,
      phoneNumber,
      tempPassword,
      userType,
      driverVehicleId,
      department,
      position,
      employeeId,
      notes,
    } = body

    const requestedUserType = userType as UserType
    let normalizedUsername =
      requestedUserType === UserType.DRIVER
        ? normalizePlateNumber(username)
        : typeof username === 'string'
          ? username.trim()
          : ''

    let resolvedFirstName = typeof firstName === 'string' ? firstName.trim() : ''
    let resolvedLastName = typeof lastName === 'string' ? lastName.trim() : ''
    let resolvedPhoneNumber = typeof phoneNumber === 'string' ? phoneNumber.trim() : ''
    const requestedTempPassword = typeof tempPassword === 'string' ? tempPassword.trim() : ''

    // Validate required fields
    if (
      requestedUserType !== UserType.DRIVER &&
      (!resolvedFirstName || !resolvedLastName || !normalizedUsername || !resolvedPhoneNumber || !userType)
    ) {
      return createAdminRouteError('Missing required fields', 400)
    }

    if (!ALLOWED_OFFICIAL_USER_TYPES.has(requestedUserType)) {
      return createAdminRouteError(
        'Only administrator, enforcer, data encoder, and driver accounts can be created here',
        400,
      )
    }

    const createdUserData = await prisma.$transaction(async (tx) => {
      let assignedVehicleId: string | null = null

      if (requestedUserType === UserType.DRIVER) {
        if (!requestedTempPassword) {
          throw new Error('Temporary password is required for driver accounts')
        }

        const selectedDriverVehicleId = typeof driverVehicleId === 'string' ? driverVehicleId.trim() : ''
        const assignedVehicleWhere = selectedDriverVehicleId
          ? { id: selectedDriverVehicleId }
          : normalizedUsername
            ? { plateNumber: normalizedUsername }
            : null

        if (!assignedVehicleWhere) {
          throw new Error('Select a registered driver before creating a driver account')
        }

        const assignedVehicle = await tx.vehicle.findUnique({
          where: assignedVehicleWhere,
          select: {
            id: true,
            plateNumber: true,
            driverName: true,
            driverLicense: true,
            vehicleType: true,
            permit: {
              select: {
                driverFullName: true,
                permitPlateNumber: true,
              },
            },
          },
        })

        if (!assignedVehicle) {
          throw new Error('Select a registered driver from the encoder-managed list')
        }

        const registeredDriverName =
          assignedVehicle.permit?.driverFullName?.trim() || assignedVehicle.driverName?.trim() || ''

        if (!registeredDriverName) {
          throw new Error('The selected vehicle does not have an encoder-registered driver name yet')
        }

        normalizedUsername = normalizePlateNumber(assignedVehicle.plateNumber) || ''

        if (!normalizedUsername) {
          throw new Error('The selected vehicle is missing a usable BPLO-issued plate number')
        }

        const parsedDriverName = splitDriverDisplayName(registeredDriverName)
        resolvedFirstName = parsedDriverName.firstName
        resolvedLastName = parsedDriverName.lastName
        resolvedPhoneNumber = ''

        const existingAssignedDriver = await tx.user.findFirst({
          where: { assignedVehicleId: assignedVehicle.id },
          select: { id: true, username: true },
        })

        if (existingAssignedDriver) {
          throw new Error('That vehicle already has an active driver account assigned')
        }

        assignedVehicleId = assignedVehicle.id
      }

      if (!normalizedUsername) {
        throw new Error('Missing required fields')
      }

      const resolvedUsername = normalizedUsername
      const existingUser = await tx.user.findUnique({
        where: { username: resolvedUsername },
      })

      if (existingUser) {
        throw new Error('Username already exists')
      }

      const resolvedTempPassword =
        requestedUserType === UserType.DRIVER ? requestedTempPassword : Math.random().toString(36).slice(-8)
      const hashedPassword = await bcrypt.hash(resolvedTempPassword, 12)

      const user = await tx.user.create({
        data: {
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          username: resolvedUsername,
          password: hashedPassword,
          phoneNumber: resolvedPhoneNumber || null,
          userType: requestedUserType,
          assignedVehicleId,
          assignedVehicleAssignedAt: assignedVehicleId ? new Date() : null,
          assignedVehicleAssignedBy: assignedVehicleId ? adminUser.id : null,
          isActive: true,
          isVerified: true,
          verifiedAt: new Date(),
        },
        select: {
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
        },
      })

      await tx.adminUserCreation.create({
        data: {
          requestedBy: adminUser.id,
          userType: requestedUserType,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          phoneNumber: resolvedPhoneNumber,
          assignedVehicleId,
          department,
          position,
          employeeId,
          notes,
          isActive: true,
          approvedBy: adminUser.id,
          approvedAt: new Date(),
          createdUserId: user.id,
        },
      })

      if (assignedVehicleId) {
        await tx.driverVehicleAssignmentHistory.create({
          data: {
            userId: user.id,
            vehicleId: assignedVehicleId,
            assignedBy: adminUser.id,
            reason: 'Initial driver account provisioning',
          },
        })
      }

      return {
        user,
        tempPassword: resolvedTempPassword,
      }
    })

    const data: AdminUserCreateData = {
      user: toAdminUserDto(createdUserData.user),
      tempPassword: createdUserData.tempPassword,
    }

    return createAdminRouteSuccess(data, {
      message:
        requestedUserType === UserType.DRIVER
          ? 'Driver account created successfully'
          : 'Official account created successfully',
    })
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Missing required fields' ||
        error.message === 'Temporary password is required for driver accounts' ||
        error.message === 'Select a registered driver before creating a driver account'
      ) {
        return createAdminRouteError(error.message, 400)
      }

      if (
        error.message === 'Select a registered driver from the encoder-managed list' ||
        error.message === 'Username already exists'
      ) {
        return createAdminRouteError(error.message, error.message === 'Username already exists' ? 409 : 404)
      }

      if (
        error.message === 'The selected vehicle does not have an encoder-registered driver name yet' ||
        error.message === 'The selected vehicle is missing a usable BPLO-issued plate number' ||
        error.message === 'That vehicle already has an active driver account assigned'
      ) {
        return createAdminRouteError(error.message, 409)
      }
    }

    return createAdminRouteAuthError(error)
  }
}
