import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { UserType } from '@prisma/client'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

const ALLOWED_OFFICIAL_USER_TYPES = new Set<UserType>([
  UserType.ADMIN,
  UserType.DATA_ENCODER,
  UserType.ENFORCER,
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

    // Validate required fields
    if (!firstName || !lastName || !username || !phoneNumber || !userType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!ALLOWED_OFFICIAL_USER_TYPES.has(userType as UserType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only administrator, enforcer, and data encoder accounts can be created here',
        },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
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
        username,
        password: hashedPassword,
        phoneNumber,
        userType: userType as UserType,
        isActive: true,
        isVerified: true, // Authority users are pre-verified
        verifiedAt: new Date()
      }
    })

    // Log the creation in AdminUserCreation table
    await prisma.adminUserCreation.create({
      data: {
        requestedBy: adminUser.id,
        userType: userType as UserType,
        firstName,
        lastName,
        phoneNumber,
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

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        userType: user.userType
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
