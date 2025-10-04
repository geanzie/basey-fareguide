import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import bcrypt from 'bcryptjs'
import { UserType } from '@/generated/prisma'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      userType,
      department,
      position,
      employeeId,
      notes,
      requestedBy
    } = body

    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !userType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
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
        email,
        username: email, // Use email as username
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
        requestedBy: requestedBy || 'system',
        userType: userType as UserType,
        firstName,
        lastName,
        email,
        phoneNumber,
        department,
        position,
        employeeId,
        notes,
        isActive: true,
        approvedBy: requestedBy || 'system',
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
        email: user.email,
        userType: user.userType
      },
      tempPassword // In a real app, you'd send this via email instead
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}