import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserType } from '@prisma/client'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'

const ALLOWED_OFFICIAL_USER_TYPES = new Set<UserType>([
  UserType.ADMIN,
  UserType.DATA_ENCODER,
  UserType.ENFORCER,
  UserType.DRIVER,
])

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireRequestRole(request, [...ADMIN_ONLY])

    const body = await request.json()
    const {
      firstName,
      lastName,
      username,
      phoneNumber,
      userType,
      department,
      position,
      employeeId,
      notes,
    } = body

    const requestedUserType = userType as UserType
    const normalizedUsername =
      requestedUserType === UserType.DRIVER
        ? normalizePlateNumber(username)
        : typeof username === 'string'
          ? username.trim()
          : ''

    // Validate required fields
    if (!firstName || !lastName || !normalizedUsername || !phoneNumber || !userType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!ALLOWED_OFFICIAL_USER_TYPES.has(requestedUserType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only administrator, enforcer, data encoder, and driver accounts can be created here',
        },
        { status: 400 }
      )
    }

    let assignedVehicleId: string | null = null

    if (requestedUserType === UserType.DRIVER) {
      const assignedVehicle = await prisma.vehicle.findUnique({
        where: { plateNumber: normalizedUsername },
        select: { id: true },
      })

      if (!assignedVehicle) {
        return NextResponse.json(
          { success: false, error: 'Driver usernames must match an existing BPLO-issued plate number' },
          { status: 404 }
        )
      }

      const existingAssignedDriver = await prisma.user.findFirst({
        where: { assignedVehicleId: assignedVehicle.id },
        select: { id: true, username: true },
      })

      if (existingAssignedDriver) {
        return NextResponse.json(
          { success: false, error: 'That vehicle already has an active driver account assigned' },
          { status: 409 }
        )
      }

      assignedVehicleId = assignedVehicle.id
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: normalizedUsername }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username already exists' },
        { status: 409 }
      )
    }

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    // Create the user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        username: normalizedUsername,
        password: hashedPassword,
        phoneNumber,
        userType: requestedUserType,
        assignedVehicleId,
        assignedVehicleAssignedAt: assignedVehicleId ? new Date() : null,
        assignedVehicleAssignedBy: assignedVehicleId ? adminUser.id : null,
        isActive: true,
        isVerified: true, // Authority users are pre-verified
        verifiedAt: new Date()
      }
    })

    // Log the creation in AdminUserCreation table
    await prisma.adminUserCreation.create({
      data: {
        requestedBy: adminUser.id,
        userType: requestedUserType,
        firstName,
        lastName,
        phoneNumber,
        assignedVehicleId,
        department,
        position,
        employeeId,
        notes,
        isActive: true,
        approvedBy: adminUser.id,
        approvedAt: new Date(),
        createdUserId: user.id
      }
    })

    if (assignedVehicleId) {
      await prisma.driverVehicleAssignmentHistory.create({
        data: {
          userId: user.id,
          vehicleId: assignedVehicleId,
          assignedBy: adminUser.id,
          reason: 'Initial driver account provisioning',
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        userType: user.userType,
        assignedVehicleId,
      },
      tempPassword // In a real app, you'd send this securely instead
    })
  } catch (error) {
    const authError = createAuthErrorResponse(error)
    if (authError.status !== 500) {
      return authError
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
